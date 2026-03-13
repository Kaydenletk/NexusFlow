import {
  calculateContextSwitchTax,
  calculateFragmentation,
  focusCategoryValues,
  formatLocalDate,
  getBurnoutAssessment,
  getCategoryBreakdown,
  getDailyFocusMetric,
  getDailyFocusMetrics,
  getDeepWorkBlocks,
  getTopHosts,
  type BurnoutAssessment,
  type BurnoutSignalKey,
  type FocusCategory,
  type FocusSession,
  type FocusSnapshotV1,
} from "@nexusflow/focus-core";

import { formatDate, formatShortDate } from "./format";

function round(value: number) {
  return Number(value.toFixed(2));
}

function formatShortLocalDate(value: string) {
  return formatShortDate(`${value}T00:00:00`);
}

function burnoutToRisk(level: BurnoutAssessment["level"]) {
  if (level === "Critical") {
    return 3;
  }

  if (level === "Warning") {
    return 2;
  }

  if (level === "Safe") {
    return 1;
  }

  return 0;
}

function getBurnoutTone(assessment: BurnoutAssessment) {
  if (assessment.warmingUp) {
    return "warming";
  }

  if (assessment.level === "Critical") {
    return "critical";
  }

  if (assessment.level === "Warning") {
    return "warning";
  }

  return "safe";
}

function formatHoursFromMinutes(value: number) {
  return `${round(value / 60)}h`;
}

function formatSignalLabel(key: BurnoutSignalKey) {
  if (key === "active_time") {
    return "Active time";
  }

  if (key === "deep_work") {
    return "Deep work";
  }

  return "Fragmentation";
}

function formatSignalValue(key: BurnoutSignalKey, value: number) {
  if (key === "fragmentation") {
    return value.toFixed(2);
  }

  return formatHoursFromMinutes(value);
}

function formatSignalDelta(key: BurnoutSignalKey, current: number, previous: number) {
  const delta = current - previous;

  if (delta === 0) {
    return "Stable";
  }

  const prefix = delta > 0 ? "+" : "-";
  const absolute = Math.abs(delta);

  if (key === "fragmentation") {
    return `${prefix}${absolute.toFixed(2)}`;
  }

  return `${prefix}${round(absolute / 60)}h`;
}

function getDayBounds(date: string) {
  const start = new Date(`${date}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return {
    start,
    end,
  };
}

function getSessionsForDate(sessions: FocusSession[], date: string) {
  const bounds = getDayBounds(date);

  return [...sessions]
    .map((session) => {
      const startTime = new Date(session.startTime);
      const endTime = new Date(session.endTime);

      if (endTime <= bounds.start || startTime >= bounds.end) {
        return null;
      }

      const clippedStart = new Date(
        Math.max(startTime.getTime(), bounds.start.getTime()),
      );
      const clippedEnd = new Date(Math.min(endTime.getTime(), bounds.end.getTime()));
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
    })
    .filter((session): session is FocusSession => session !== null)
    .sort((left, right) => {
      if (left.startTime !== right.startTime) {
        return left.startTime.localeCompare(right.startTime);
      }

      if (left.endTime !== right.endTime) {
        return left.endTime.localeCompare(right.endTime);
      }

      return left.id.localeCompare(right.id);
    });
}

function describeContextSwitching(taxScore: number, switches: number) {
  if (taxScore >= 30) {
    return "Micro-tasking burst detected. The latest day was cognitively expensive.";
  }

  if (taxScore >= 15) {
    return "Switching pressure is elevated. Protect larger uninterrupted blocks.";
  }

  if (switches >= 12) {
    return "Switch counts are active, but the overall tax is still manageable.";
  }

  return "Switching stayed relatively contained on the latest tracked day.";
}

export function buildFocusDashboardView(snapshot: FocusSnapshotV1) {
  const metrics = getDailyFocusMetrics(snapshot.sessions);
  const latestDate =
    metrics.at(-1)?.date ?? formatLocalDate(new Date(snapshot.exportedAt));
  const latestMetric =
    metrics.at(-1) ?? getDailyFocusMetric(snapshot.sessions, latestDate);
  const burnout = getBurnoutAssessment(metrics);
  const burnoutTone = getBurnoutTone(burnout);
  const fragmentation = calculateFragmentation(snapshot.sessions, latestDate);
  const burnoutTrend = metrics
    .map((metric, index) => {
      const assessment = getBurnoutAssessment(metrics.slice(0, index + 1));

      return {
        date: formatShortLocalDate(metric.date),
        risk: assessment.warmingUp ? 0 : burnoutToRisk(assessment.level),
        triggeredSignals: assessment.triggeredSignalKeys.length,
      };
    })
    .slice(-14);
  const contextSwitchTrend = metrics
    .map((metric) => {
      const daySessions = getSessionsForDate(snapshot.sessions, metric.date);

      return {
        date: formatShortLocalDate(metric.date),
        switchTax: round(calculateContextSwitchTax(daySessions)),
        fragmentation: metric.fragmentationScore,
      };
    })
    .slice(-14);
  const categoryBreakdown = getCategoryBreakdown(snapshot.sessions).slice(0, 6);
  const topHosts = getTopHosts(snapshot.sessions, 6);
  const deepWorkBlocks = getDeepWorkBlocks(snapshot.sessions, latestDate).sort(
    (left, right) => right.durationMinutes - left.durationMinutes,
  );
  const longestDeepWorkBlock = deepWorkBlocks[0] ?? null;
  const matrixCategories = focusCategoryValues.filter(
    (category) =>
      categoryBreakdown.some((item) => item.category === category) ||
      fragmentation.matrix.some(
        (transition) =>
          transition.from === category || transition.to === category,
      ),
  );
  const matrixLookup = new Map(
    fragmentation.matrix.map((transition) => [
      `${transition.from}->${transition.to}`,
      transition.count,
    ]),
  );
  const matrixMax = fragmentation.matrix.reduce(
    (max, transition) => Math.max(max, transition.count),
    0,
  );
  const latestSwitchTax = contextSwitchTrend.at(-1)?.switchTax ?? 0;
  const firstTrackedDate = metrics[0]?.date ?? latestDate;
  const burnoutStateLabel = burnout.warmingUp ? "Warming up" : burnout.level;

  return {
    burnoutTone,
    burnoutStateLabel,
    exportedAtLabel: formatDate(snapshot.exportedAt),
    sessionCount: snapshot.sessions.length,
    timezone: snapshot.timezone,
    latestDateLabel: formatShortLocalDate(latestDate),
    coverageLabel:
      firstTrackedDate === latestDate
        ? formatShortLocalDate(latestDate)
        : `${formatShortLocalDate(firstTrackedDate)} - ${formatShortLocalDate(latestDate)}`,
    trackedDayCount: metrics.length,
    burnout,
    latestContextNarrative: describeContextSwitching(
      latestSwitchTax,
      fragmentation.totalSwitches,
    ),
    summaryCards: [
      {
        label: "Burnout state",
        value: burnoutStateLabel,
        helper: burnout.warmingUp
          ? "Need six tracked days before rolling burnout windows activate."
          : `${burnout.triggeredSignalKeys.length}/3 heuristic signals triggered`,
      },
      {
        label: "Context switch tax",
        value: latestSwitchTax.toFixed(1),
        helper: `${fragmentation.totalSwitches} category jumps on ${formatShortLocalDate(latestDate)}`,
      },
      {
        label: "Fragmentation",
        value: latestMetric.fragmentationScore.toFixed(2),
        helper: `${latestMetric.categorySwitches} switches across ${formatHoursFromMinutes(latestMetric.activeMinutes)}`,
      },
      {
        label: "Deep work",
        value: formatHoursFromMinutes(latestMetric.deepWorkMinutes),
        helper: longestDeepWorkBlock
          ? `Longest uninterrupted block ${formatHoursFromMinutes(longestDeepWorkBlock.durationMinutes)}`
          : "No uninterrupted block crossed the 25-minute threshold.",
      },
    ],
    burnoutTrend,
    burnoutSignals: burnout.signals.map((signal) => ({
      key: signal.key,
      label: formatSignalLabel(signal.key),
      previousLabel: formatSignalValue(signal.key, signal.previous),
      currentLabel: formatSignalValue(signal.key, signal.current),
      deltaLabel: formatSignalDelta(signal.key, signal.current, signal.previous),
      triggered: signal.triggered,
    })),
    burnoutWindows:
      burnout.previousWindow && burnout.currentWindow
        ? [
            {
              label: "Previous window",
              range: `${formatShortLocalDate(burnout.previousWindow.startDate)} - ${formatShortLocalDate(
                burnout.previousWindow.endDate,
              )}`,
              activeTime: formatHoursFromMinutes(
                burnout.previousWindow.averages.activeMinutes,
              ),
              deepWork: formatHoursFromMinutes(
                burnout.previousWindow.averages.deepWorkMinutes,
              ),
              fragmentation:
                burnout.previousWindow.averages.fragmentationScore.toFixed(2),
            },
            {
              label: "Current window",
              range: `${formatShortLocalDate(burnout.currentWindow.startDate)} - ${formatShortLocalDate(
                burnout.currentWindow.endDate,
              )}`,
              activeTime: formatHoursFromMinutes(
                burnout.currentWindow.averages.activeMinutes,
              ),
              deepWork: formatHoursFromMinutes(
                burnout.currentWindow.averages.deepWorkMinutes,
              ),
              fragmentation:
                burnout.currentWindow.averages.fragmentationScore.toFixed(2),
            },
          ]
        : [],
    contextSwitchTrend,
    latestHourlySwitches: fragmentation.hourly.map((item) => ({
      hour: item.hour,
      switches: item.switches,
    })),
    latestDayHighlights: [
      {
        label: "Active time",
        value: formatHoursFromMinutes(latestMetric.activeMinutes),
      },
      {
        label: "Productive time",
        value: formatHoursFromMinutes(latestMetric.productiveMinutes),
      },
      {
        label: "Switches",
        value: String(fragmentation.totalSwitches),
      },
    ],
    transitionHighlights: fragmentation.matrix.slice(0, 5).map((transition) => ({
      id: `${transition.from}-${transition.to}`,
      label: `${transition.from.replaceAll("_", " ")} -> ${transition.to.replaceAll("_", " ")}`,
      count: transition.count,
    })),
    categoryBreakdown: categoryBreakdown.map((item) => ({
      name: item.category.replaceAll("_", " "),
      value: round(item.durationMinutes / 60),
    })),
    topHosts: topHosts.map((item) => ({
      name: item.hostname,
      value: round(item.durationMinutes / 60),
    })),
    matrixCategories,
    matrixMax,
    getMatrixValue(from: FocusCategory, to: FocusCategory) {
      return matrixLookup.get(`${from}->${to}`) ?? 0;
    },
  };
}
