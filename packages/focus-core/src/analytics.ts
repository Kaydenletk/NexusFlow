import type {
  BurnoutAssessment,
  BurnoutSignal,
  CategorySummary,
  CategoryTransition,
  DailyFocusMetrics,
  DeepWorkBlock,
  FocusSession,
  FragmentationResult,
  HostSummary,
} from "./schema.js";
import { focusSnapshotSchema } from "./schema.js";

const DEEP_WORK_MIN_SECONDS = 25 * 60;
const DEEP_WORK_GAP_MS = 60 * 1000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

type DayBounds = {
  start: Date;
  end: Date;
};

function round(value: number) {
  return Number(value.toFixed(2));
}

function toDate(value: string) {
  return new Date(value);
}

export function formatLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getDayBounds(date: string): DayBounds {
  const start = new Date(`${date}T00:00:00`);

  return {
    start,
    end: new Date(start.getTime() + MS_PER_DAY),
  };
}

function addDays(date: string, offset: number) {
  const start = new Date(`${date}T00:00:00`);
  start.setDate(start.getDate() + offset);

  return formatLocalDate(start);
}

function clipSession(
  session: FocusSession,
  bounds: DayBounds,
): FocusSession | null {
  const startAt = toDate(session.startTime);
  const endAt = toDate(session.endTime);
  const clippedStart = new Date(Math.max(startAt.getTime(), bounds.start.getTime()));
  const clippedEnd = new Date(Math.min(endAt.getTime(), bounds.end.getTime()));
  const durationSeconds = Math.max(
    0,
    Math.round((clippedEnd.getTime() - clippedStart.getTime()) / 1000),
  );

  if (durationSeconds <= 0) {
    return null;
  }

  return {
    ...session,
    startTime: clippedStart.toISOString(),
    endTime: clippedEnd.toISOString(),
    durationSeconds,
  };
}

function getSessionsForDateInternal(sessions: FocusSession[], date: string) {
  const bounds = getDayBounds(date);

  return sessions
    .map((session) => clipSession(session, bounds))
    .filter((session): session is FocusSession => session !== null)
    .sort((left, right) =>
      left.startTime === right.startTime
        ? left.endTime.localeCompare(right.endTime)
        : left.startTime.localeCompare(right.startTime),
    );
}

function sumDurationSeconds(sessions: FocusSession[]) {
  return sessions.reduce((total, session) => total + session.durationSeconds, 0);
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((total, value) => total + value, 0) / values.length;
}

function isIncreaseByThreshold(current: number, previous: number, threshold: number) {
  if (previous === 0) {
    return current > 0;
  }

  return current >= previous * (1 + threshold);
}

function isDecreaseByThreshold(current: number, previous: number, threshold: number) {
  if (previous === 0) {
    return false;
  }

  return current <= previous * (1 - threshold);
}

export function createFocusSnapshot(
  sessions: FocusSession[],
  options?: {
    exportedAt?: string;
    timezone?: string;
  },
) {
  return focusSnapshotSchema.parse({
    version: 1,
    exportedAt: options?.exportedAt ?? new Date().toISOString(),
    timezone:
      options?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
    sessions,
  });
}

export function calculateFragmentation(
  sessions: FocusSession[],
  date: string,
): FragmentationResult {
  const daySessions = getSessionsForDateInternal(sessions, date);
  const hourly = Array.from({ length: 24 }, (_, hour) => ({
    hour: `${String(hour).padStart(2, "0")}:00`,
    switches: 0,
  }));
  const transitions = new Map<string, CategoryTransition>();
  let totalSwitches = 0;

  for (let index = 1; index < daySessions.length; index += 1) {
    const previous = daySessions[index - 1];
    const current = daySessions[index];

    if (!previous || !current) {
      continue;
    }

    if (previous.category === current.category) {
      continue;
    }

    totalSwitches += 1;
    const key = `${previous.category}->${current.category}`;
    const hour = toDate(current.startTime).getHours();
    const hourlyEntry = hourly[hour];

    if (!hourlyEntry) {
      continue;
    }

    hourly[hour] = {
      ...hourlyEntry,
      switches: hourlyEntry.switches + 1,
    };

    const existing = transitions.get(key);
    transitions.set(key, {
      from: previous.category,
      to: current.category,
      count: (existing?.count ?? 0) + 1,
    });
  }

  const activeHours = sumDurationSeconds(daySessions) / 3600;

  return {
    date,
    totalSwitches,
    activeHours: round(activeHours),
    fragmentationScore:
      activeHours === 0 ? 0 : round(totalSwitches / activeHours),
    hourly,
    matrix: Array.from(transitions.values()).sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count;
      }

      return `${left.from}-${left.to}`.localeCompare(`${right.from}-${right.to}`);
    }),
  };
}

export function getDeepWorkBlocks(
  sessions: FocusSession[],
  date: string,
): DeepWorkBlock[] {
  const productiveSessions = getSessionsForDateInternal(sessions, date).filter(
    (session) => session.intent === "productive",
  );

  const blocks: DeepWorkBlock[] = [];
  let currentBlock:
    | {
        startTime: string;
        endTime: string;
        categories: Set<FocusSession["category"]>;
      }
    | null = null;

  for (const session of productiveSessions) {
    if (!currentBlock) {
      currentBlock = {
        startTime: session.startTime,
        endTime: session.endTime,
        categories: new Set([session.category]),
      };
      continue;
    }

    const gapMs =
      toDate(session.startTime).getTime() - toDate(currentBlock.endTime).getTime();

    if (gapMs <= DEEP_WORK_GAP_MS) {
      currentBlock.endTime = session.endTime;
      currentBlock.categories.add(session.category);
      continue;
    }

    const durationMinutes =
      (toDate(currentBlock.endTime).getTime() -
        toDate(currentBlock.startTime).getTime()) /
      60000;

    if (durationMinutes * 60 >= DEEP_WORK_MIN_SECONDS) {
      blocks.push({
        startTime: currentBlock.startTime,
        endTime: currentBlock.endTime,
        durationMinutes: round(durationMinutes),
        categories: Array.from(currentBlock.categories),
      });
    }

    currentBlock = {
      startTime: session.startTime,
      endTime: session.endTime,
      categories: new Set([session.category]),
    };
  }

  if (currentBlock) {
    const durationMinutes =
      (toDate(currentBlock.endTime).getTime() -
        toDate(currentBlock.startTime).getTime()) /
      60000;

    if (durationMinutes * 60 >= DEEP_WORK_MIN_SECONDS) {
      blocks.push({
        startTime: currentBlock.startTime,
        endTime: currentBlock.endTime,
        durationMinutes: round(durationMinutes),
        categories: Array.from(currentBlock.categories),
      });
    }
  }

  return blocks;
}

export function getDailyFocusMetric(
  sessions: FocusSession[],
  date: string,
): DailyFocusMetrics {
  const daySessions = getSessionsForDateInternal(sessions, date);
  const productiveMinutes =
    sumDurationSeconds(
      daySessions.filter((session) => session.intent === "productive"),
    ) / 60;
  const activeMinutes = sumDurationSeconds(daySessions) / 60;
  const deepWorkMinutes = getDeepWorkBlocks(sessions, date).reduce(
    (total, block) => total + block.durationMinutes,
    0,
  );
  const fragmentation = calculateFragmentation(sessions, date);

  return {
    date,
    activeMinutes: round(activeMinutes),
    productiveMinutes: round(productiveMinutes),
    deepWorkMinutes: round(deepWorkMinutes),
    shallowWorkMinutes: round(Math.max(activeMinutes - deepWorkMinutes, 0)),
    fragmentationScore: fragmentation.fragmentationScore,
    categorySwitches: fragmentation.totalSwitches,
  };
}

export function getDailyFocusMetrics(
  sessions: FocusSession[],
  options?: {
    startDate?: string;
    endDate?: string;
  },
): DailyFocusMetrics[] {
  if (sessions.length === 0 && !options?.startDate && !options?.endDate) {
    return [];
  }

  const sortedSessions = [...sessions].sort((left, right) =>
    left.startTime.localeCompare(right.startTime),
  );
  const startDate =
    options?.startDate ??
    formatLocalDate(toDate(sortedSessions[0]?.startTime ?? new Date().toISOString()));
  const endDate =
    options?.endDate ??
    formatLocalDate(
      toDate(sortedSessions.at(-1)?.endTime ?? new Date().toISOString()),
    );
  const metrics: DailyFocusMetrics[] = [];

  for (let cursor = startDate; cursor <= endDate; cursor = addDays(cursor, 1)) {
    metrics.push(getDailyFocusMetric(sortedSessions, cursor));
  }

  return metrics;
}

export function getBurnoutAssessment(
  dailyMetrics: DailyFocusMetrics[],
): BurnoutAssessment {
  if (dailyMetrics.length < 6) {
    return {
      level: "warming_up",
      message: "Collect at least six days of browsing data before burnout checks begin.",
      signals: [
        { key: "active_time", triggered: false, previous: 0, current: 0 },
        { key: "deep_work", triggered: false, previous: 0, current: 0 },
        { key: "fragmentation", triggered: false, previous: 0, current: 0 },
      ],
      currentWindow: null,
      previousWindow: null,
    };
  }

  const sorted = [...dailyMetrics].sort((left, right) => left.date.localeCompare(right.date));
  const previousWindow = sorted.slice(-6, -3);
  const currentWindow = sorted.slice(-3);

  if (previousWindow.length < 3 || currentWindow.length < 3) {
    return {
      level: "warming_up",
      message: "Collect at least six days of browsing data before burnout checks begin.",
      signals: [
        { key: "active_time", triggered: false, previous: 0, current: 0 },
        { key: "deep_work", triggered: false, previous: 0, current: 0 },
        { key: "fragmentation", triggered: false, previous: 0, current: 0 },
      ],
      currentWindow: null,
      previousWindow: null,
    };
  }

  const previousSummary = {
    startDate: previousWindow[0]!.date,
    endDate: previousWindow.at(-1)!.date,
    averages: {
      activeMinutes: round(average(previousWindow.map((metric) => metric.activeMinutes))),
      deepWorkMinutes: round(
        average(previousWindow.map((metric) => metric.deepWorkMinutes)),
      ),
      fragmentationScore: round(
        average(previousWindow.map((metric) => metric.fragmentationScore)),
      ),
    },
  };
  const currentSummary = {
    startDate: currentWindow[0]!.date,
    endDate: currentWindow.at(-1)!.date,
    averages: {
      activeMinutes: round(average(currentWindow.map((metric) => metric.activeMinutes))),
      deepWorkMinutes: round(
        average(currentWindow.map((metric) => metric.deepWorkMinutes)),
      ),
      fragmentationScore: round(
        average(currentWindow.map((metric) => metric.fragmentationScore)),
      ),
    },
  };
  const signals: BurnoutSignal[] = [
    {
      key: "active_time",
      triggered: isIncreaseByThreshold(
        currentSummary.averages.activeMinutes,
        previousSummary.averages.activeMinutes,
        0.15,
      ),
      previous: previousSummary.averages.activeMinutes,
      current: currentSummary.averages.activeMinutes,
    },
    {
      key: "deep_work",
      triggered: isDecreaseByThreshold(
        currentSummary.averages.deepWorkMinutes,
        previousSummary.averages.deepWorkMinutes,
        0.15,
      ),
      previous: previousSummary.averages.deepWorkMinutes,
      current: currentSummary.averages.deepWorkMinutes,
    },
    {
      key: "fragmentation",
      triggered: isIncreaseByThreshold(
        currentSummary.averages.fragmentationScore,
        previousSummary.averages.fragmentationScore,
        0.25,
      ),
      previous: previousSummary.averages.fragmentationScore,
      current: currentSummary.averages.fragmentationScore,
    },
  ];
  const triggeredCount = signals.filter((signal) => signal.triggered).length;

  return {
    level:
      triggeredCount >= 3
        ? "critical"
        : triggeredCount >= 2
          ? "warning"
          : "safe",
    message:
      triggeredCount >= 3
        ? "Active time is climbing while deep work collapses and fragmentation spikes."
        : triggeredCount >= 2
          ? "Context switching is trending up and your focus quality is slipping."
          : "Recent browsing patterns are stable enough to stay in the safe zone.",
    signals,
    currentWindow: currentSummary,
    previousWindow: previousSummary,
  };
}

export function getCategoryBreakdown(
  sessions: FocusSession[],
): CategorySummary[] {
  const totals = new Map<string, number>();

  for (const session of sessions) {
    totals.set(
      session.category,
      (totals.get(session.category) ?? 0) + session.durationSeconds / 60,
    );
  }

  return Array.from(totals.entries())
    .map(([category, durationMinutes]) => ({
      category: category as CategorySummary["category"],
      durationMinutes: round(durationMinutes),
    }))
    .sort((left, right) => right.durationMinutes - left.durationMinutes);
}

export function getTopHosts(sessions: FocusSession[], limit = 6): HostSummary[] {
  const totals = new Map<string, number>();

  for (const session of sessions) {
    totals.set(
      session.hostname,
      (totals.get(session.hostname) ?? 0) + session.durationSeconds / 60,
    );
  }

  return Array.from(totals.entries())
    .map(([hostname, durationMinutes]) => ({
      hostname,
      durationMinutes: round(durationMinutes),
    }))
    .sort((left, right) => right.durationMinutes - left.durationMinutes)
    .slice(0, limit);
}
