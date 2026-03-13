import {
  addDays as addCalendarDays,
  format,
  parseISO,
  startOfDay,
} from "date-fns";
import type {
  BurnoutAssessment,
  BurnoutSignal,
  CanvasCourseDailyPoint,
  CanvasCourseInterruption,
  CanvasCourseReport,
  CanvasCourseReportItem,
  CategorySummary,
  CategoryTransition,
  DailyMetrics,
  DailyFocusMetrics,
  DeepWorkBlock,
  FocusSession,
  FocusSnapshotV1,
  FragmentationResult,
  HostSummary,
} from "./types.js";
import { canvasCourseReportSchema, focusSnapshotSchema } from "./schema.js";
import { extractCanvasCourseId, isCanvasHostname } from "./url.js";

const DEEP_WORK_MIN_SECONDS = 25 * 60;
const DEEP_WORK_GAP_MS = 60 * 1000;
const MICROTASK_DURATION_SECONDS = 60;
const MICROTASK_BURST_WINDOW_MS = 4 * 60 * 60 * 1000;
const MICROTASK_BURST_THRESHOLD = 20;
const DEFAULT_CANVAS_FAST_SWITCH_THRESHOLD_SECONDS = 30;

type DayBounds = {
  start: Date;
  end: Date;
};

type ContextSwitchAnalysis = {
  taxScore: number;
  microTaskingSwitchTimestamps: number[];
};

function round(value: number) {
  return Number(value.toFixed(2));
}

function toDate(value: string) {
  return parseISO(value);
}

function sortSessionsChronologically(sessions: FocusSession[]) {
  return [...sessions].sort((left, right) => {
    if (left.startTime !== right.startTime) {
      return left.startTime.localeCompare(right.startTime);
    }

    if (left.endTime !== right.endTime) {
      return left.endTime.localeCompare(right.endTime);
    }

    return (left.id ?? "").localeCompare(right.id ?? "");
  });
}

export function formatLocalDate(date: Date) {
  return format(date, "yyyy-MM-dd");
}

function getDayBounds(date: string): DayBounds {
  const start = startOfDay(new Date(`${date}T00:00:00`));

  return {
    start,
    end: addCalendarDays(start, 1),
  };
}

function addDays(date: string, offset: number) {
  return formatLocalDate(addCalendarDays(new Date(`${date}T00:00:00`), offset));
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

  return sortSessionsChronologically(
    sessions
      .map((session) => clipSession(session, bounds))
      .filter((session): session is FocusSession => session !== null),
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

function getComparableRootPath(path: string) {
  const segments = path.split("/").filter(Boolean).slice(0, 2);

  if (segments.length === 0) {
    return "/";
  }

  return `/${segments.join("/")}`;
}

function getCanvasCourseKey(session: FocusSession) {
  if (!isCanvasHostname(session.hostname)) {
    return null;
  }

  return extractCanvasCourseId(session.path);
}

function isContextSwitch(previous: FocusSession, current: FocusSession) {
  return (
    previous.hostname !== current.hostname ||
    getComparableRootPath(previous.path) !== getComparableRootPath(current.path)
  );
}

function analyzeContextSwitches(
  sessions: FocusSession[],
): ContextSwitchAnalysis {
  const sortedSessions = sortSessionsChronologically(sessions);
  const microTaskingSwitchTimestamps: number[] = [];
  let taxScore = 0;

  for (let index = 1; index < sortedSessions.length; index += 1) {
    const previous = sortedSessions[index - 1];
    const current = sortedSessions[index];

    if (!previous || !current || !isContextSwitch(previous, current)) {
      continue;
    }

    taxScore += 1;

    if (previous.durationSeconds < MICROTASK_DURATION_SECONDS) {
      taxScore += 2;
      microTaskingSwitchTimestamps.push(toDate(current.startTime).getTime());
    }

    if (
      previous.intent === "productive" &&
      current.intent === "distracting"
    ) {
      taxScore += 3;
    }
  }

  return {
    taxScore,
    microTaskingSwitchTimestamps,
  };
}

function hasMicroTaskingBurst(timestamps: number[]) {
  let windowStartIndex = 0;

  for (let index = 0; index < timestamps.length; index += 1) {
    const currentTimestamp = timestamps[index];

    if (typeof currentTimestamp !== "number") {
      continue;
    }

    while (
      currentTimestamp - timestamps[windowStartIndex]! > MICROTASK_BURST_WINDOW_MS
    ) {
      windowStartIndex += 1;
    }

    if (index - windowStartIndex + 1 > MICROTASK_BURST_THRESHOLD) {
      return true;
    }
  }

  return false;
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
  date: Date,
): number;
export function calculateFragmentation(
  sessions: FocusSession[],
  date: string,
): FragmentationResult;
export function calculateFragmentation(
  sessions: FocusSession[],
  date: Date | string,
): number | FragmentationResult {
  const targetDate = typeof date === "string" ? date : formatLocalDate(date);
  const daySessions = getSessionsForDateInternal(sessions, targetDate);
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
  const result = {
    date: targetDate,
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
  } satisfies FragmentationResult;

  return date instanceof Date ? result.fragmentationScore : result;
}

export function calculateContextSwitchTax(sessions: FocusSession[]): number {
  return analyzeContextSwitches(sessions).taxScore;
}

export function getDeepWorkBlocks(
  sessions: FocusSession[],
  date: Date,
): DeepWorkBlock[];
export function getDeepWorkBlocks(
  sessions: FocusSession[],
  date: string,
): DeepWorkBlock[];
export function getDeepWorkBlocks(
  sessions: FocusSession[],
  date: Date | string,
): DeepWorkBlock[] {
  const targetDate = typeof date === "string" ? date : formatLocalDate(date);
  const productiveSessions = getSessionsForDateInternal(sessions, targetDate).filter(
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

  const sortedSessions = sortSessionsChronologically(sessions);
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

export function getEarlyBurnoutWarning(
  sessions: FocusSession[],
): BurnoutAssessment {
  const { taxScore, microTaskingSwitchTimestamps } = analyzeContextSwitches(sessions);
  const totalDurationSeconds = sumDurationSeconds(sessions);
  const productiveDurationSeconds = sumDurationSeconds(
    sessions.filter((session) => session.intent === "productive"),
  );
  const totalActiveHours = totalDurationSeconds / 3600;
  const productiveRatio =
    totalDurationSeconds === 0 ? 0 : productiveDurationSeconds / totalDurationSeconds;
  const taxPerHour = totalActiveHours === 0 ? 0 : taxScore / totalActiveHours;
  const criticalBurst = hasMicroTaskingBurst(microTaskingSwitchTimestamps);

  if (taxPerHour > 30 || criticalBurst) {
    return {
      level: "Critical",
      warmingUp: false,
      message:
        "Severe Context Switching Tax. Brain is fragmented. Take a 15-minute screen break immediately.",
      signals: [],
      triggeredSignalKeys: [],
      currentWindow: null,
      previousWindow: null,
    };
  }

  if (taxPerHour >= 15 && taxPerHour <= 30) {
    return {
      level: "Warning",
      warmingUp: false,
      message:
        "High context switching detected. Cognitive tax is accumulating.",
      signals: [],
      triggeredSignalKeys: [],
      currentWindow: null,
      previousWindow: null,
    };
  }

  if (taxPerHour < 15 && productiveRatio > 0.5) {
    return {
      level: "Safe",
      warmingUp: false,
      message: "Good focus rhythm.",
      signals: [],
      triggeredSignalKeys: [],
      currentWindow: null,
      previousWindow: null,
    };
  }

  return {
    level: "Warning",
    warmingUp: false,
    message: "Focus quality is too weak to stay in the safe zone.",
    signals: [],
    triggeredSignalKeys: [],
    currentWindow: null,
    previousWindow: null,
  };
}

export function getBurnoutAssessment(
  dailyMetrics: DailyMetrics[],
): BurnoutAssessment {
  if (dailyMetrics.length < 6) {
    return {
      level: "Safe",
      warmingUp: true,
      message: "Collect at least six days of browsing data before burnout checks begin.",
      signals: [
        { key: "active_time", triggered: false, previous: 0, current: 0 },
        { key: "deep_work", triggered: false, previous: 0, current: 0 },
        { key: "fragmentation", triggered: false, previous: 0, current: 0 },
      ],
      triggeredSignalKeys: [],
      currentWindow: null,
      previousWindow: null,
    };
  }

  const sorted = [...dailyMetrics].sort((left, right) => left.date.localeCompare(right.date));
  const previousWindow = sorted.slice(-6, -3);
  const currentWindow = sorted.slice(-3);

  if (previousWindow.length < 3 || currentWindow.length < 3) {
    return {
      level: "Safe",
      warmingUp: true,
      message: "Collect at least six days of browsing data before burnout checks begin.",
      signals: [
        { key: "active_time", triggered: false, previous: 0, current: 0 },
        { key: "deep_work", triggered: false, previous: 0, current: 0 },
        { key: "fragmentation", triggered: false, previous: 0, current: 0 },
      ],
      triggeredSignalKeys: [],
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
  const level =
    triggeredCount >= 3
      ? "Critical"
      : triggeredCount >= 2
        ? "Warning"
        : "Safe";

  return {
    level,
    warmingUp: false,
    message:
      triggeredCount >= 3
        ? "Active time is climbing while deep work collapses and fragmentation spikes."
        : triggeredCount >= 2
          ? "Context switching is trending up and your focus quality is slipping."
          : "Recent browsing patterns are stable enough to stay in the safe zone.",
    signals,
    triggeredSignalKeys: signals
      .filter((signal) => signal.triggered)
      .map((signal) => signal.key),
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

export function getCanvasCourseReport(
  snapshot: FocusSnapshotV1,
  options?: {
    fastSwitchThresholdSeconds?: number;
  },
): CanvasCourseReport {
  const fastSwitchThresholdSeconds =
    options?.fastSwitchThresholdSeconds ?? DEFAULT_CANVAS_FAST_SWITCH_THRESHOLD_SECONDS;
  const sortedSessions = sortSessionsChronologically(snapshot.sessions);
  const courseMap = new Map<
    string,
    {
      totalSeconds: number;
      sessionCount: number;
      switchOutCount: number;
      distractingSwitchCount: number;
      fastSwitchCount: number;
      returnToCourseCount: number;
      daily: Map<string, CanvasCourseDailyPoint>;
      distractionHosts: Map<string, number>;
      interruptions: CanvasCourseInterruption[];
    }
  >();

  function ensureCourse(courseId: string) {
    const existing = courseMap.get(courseId);

    if (existing) {
      return existing;
    }

    const created = {
      totalSeconds: 0,
      sessionCount: 0,
      switchOutCount: 0,
      distractingSwitchCount: 0,
      fastSwitchCount: 0,
      returnToCourseCount: 0,
      daily: new Map<string, CanvasCourseDailyPoint>(),
      distractionHosts: new Map<string, number>(),
      interruptions: [] as CanvasCourseInterruption[],
    };

    courseMap.set(courseId, created);
    return created;
  }

  for (let index = 0; index < sortedSessions.length; index += 1) {
    const session = sortedSessions[index];

    if (!session) {
      continue;
    }

    const courseId = getCanvasCourseKey(session);

    if (!courseId) {
      continue;
    }

    const course = ensureCourse(courseId);
    const date = formatLocalDate(toDate(session.startTime));
    const daily = course.daily.get(date) ?? {
      date,
      durationMinutes: 0,
      sessionCount: 0,
      switchOutCount: 0,
      distractingSwitchCount: 0,
    };

    course.totalSeconds += session.durationSeconds;
    course.sessionCount += 1;
    daily.durationMinutes = round(daily.durationMinutes + session.durationSeconds / 60);
    daily.sessionCount += 1;
    course.daily.set(date, daily);

    const nextSession = sortedSessions[index + 1];

    if (!nextSession) {
      continue;
    }

    const nextCourseId = getCanvasCourseKey(nextSession);

    if (nextCourseId === courseId) {
      continue;
    }

    course.switchOutCount += 1;
    daily.switchOutCount += 1;

    if (nextSession.intent === "distracting") {
      course.distractingSwitchCount += 1;
      daily.distractingSwitchCount += 1;
      course.distractionHosts.set(
        nextSession.hostname,
        (course.distractionHosts.get(nextSession.hostname) ?? 0) +
          nextSession.durationSeconds / 60,
      );
    }

    let returnAt: string | null = null;

    for (let cursor = index + 1; cursor < sortedSessions.length; cursor += 1) {
      const candidate = sortedSessions[cursor];

      if (!candidate) {
        continue;
      }

      if (getCanvasCourseKey(candidate) === courseId) {
        returnAt = candidate.startTime;
        course.returnToCourseCount += 1;
        break;
      }
    }

    const interruptionDurationSeconds = Math.max(
      0,
      Math.round(
        ((returnAt
          ? toDate(returnAt).getTime()
          : toDate(nextSession.endTime).getTime()) -
          toDate(nextSession.startTime).getTime()) /
          1000,
      ),
    );
    const fastSwitch =
      returnAt !== null &&
      interruptionDurationSeconds <= fastSwitchThresholdSeconds;

    if (fastSwitch) {
      course.fastSwitchCount += 1;
    }

    course.interruptions.push({
      at: nextSession.startTime,
      hostname: nextSession.hostname,
      path: nextSession.path,
      intent: nextSession.intent,
      durationSeconds: interruptionDurationSeconds,
      returnedToCourse: returnAt !== null,
      returnAt,
      fastSwitch,
    });
  }

  const courses: CanvasCourseReportItem[] = Array.from(courseMap.entries())
    .map(([courseId, course]) => ({
      courseId,
      totalMinutes: round(course.totalSeconds / 60),
      sessionCount: course.sessionCount,
      switchOutCount: course.switchOutCount,
      distractingSwitchCount: course.distractingSwitchCount,
      fastSwitchCount: course.fastSwitchCount,
      returnToCourseCount: course.returnToCourseCount,
      returnRate:
        course.switchOutCount === 0
          ? 0
          : round(course.returnToCourseCount / course.switchOutCount),
      daily: Array.from(course.daily.values()).sort((left, right) =>
        left.date.localeCompare(right.date),
      ),
      topDistractionHosts: Array.from(course.distractionHosts.entries())
        .map(([hostname, durationMinutes]) => ({
          hostname,
          durationMinutes: round(durationMinutes),
        }))
        .sort((left, right) => right.durationMinutes - left.durationMinutes)
        .slice(0, 5),
      interruptions: course.interruptions.sort((left, right) =>
        left.at.localeCompare(right.at),
      ),
    }))
    .sort((left, right) => {
      if (right.totalMinutes !== left.totalMinutes) {
        return right.totalMinutes - left.totalMinutes;
      }

      return left.courseId.localeCompare(right.courseId);
    });

  return canvasCourseReportSchema.parse({
    fastSwitchThresholdSeconds,
    totalCanvasMinutes: round(
      courses.reduce((total, course) => total + course.totalMinutes, 0),
    ),
    totalCourseCount: courses.length,
    courses,
  });
}
