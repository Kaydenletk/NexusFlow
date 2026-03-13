import {
  calculateFragmentation,
  focusCategoryValues,
  formatLocalDate,
  getBurnoutAssessment,
  getCategoryBreakdown,
  getDailyFocusMetric,
  getDailyFocusMetrics,
  getTopHosts,
  type BurnoutAssessment,
  type FocusCategory,
  type FocusSnapshotV1,
} from "@quantified-self/focus-core";

import { formatDate, formatShortDate } from "./format";

function round(value: number) {
  return Number(value.toFixed(2));
}

function formatShortLocalDate(value: string) {
  return formatShortDate(`${value}T00:00:00`);
}

function burnoutToRisk(level: BurnoutAssessment["level"]) {
  if (level === "critical") {
    return 3;
  }

  if (level === "warning") {
    return 2;
  }

  if (level === "safe") {
    return 1;
  }

  return 0;
}

export function buildFocusDashboardView(snapshot: FocusSnapshotV1) {
  const metrics = getDailyFocusMetrics(snapshot.sessions);
  const latestDate =
    metrics.at(-1)?.date ?? formatLocalDate(new Date(snapshot.exportedAt));
  const todayMetric =
    metrics.at(-1) ?? getDailyFocusMetric(snapshot.sessions, latestDate);
  const burnout = getBurnoutAssessment(metrics);
  const fragmentation = calculateFragmentation(snapshot.sessions, latestDate);
  const recentMetrics = metrics.slice(-14);
  const burnoutTrend = recentMetrics.map((metric, index) => {
    const assessment = getBurnoutAssessment(recentMetrics.slice(0, index + 1));

    return {
      date: formatShortLocalDate(metric.date),
      risk: burnoutToRisk(assessment.level),
    };
  });
  const categoryBreakdown = getCategoryBreakdown(snapshot.sessions).slice(0, 6);
  const topHosts = getTopHosts(snapshot.sessions, 6);
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

  return {
    exportedAtLabel: formatDate(snapshot.exportedAt),
    sessionCount: snapshot.sessions.length,
    timezone: snapshot.timezone,
    latestDateLabel: formatShortLocalDate(latestDate),
    burnout,
    summaryCards: [
      {
        label: "Latest active time",
        value: `${round(todayMetric.activeMinutes / 60)}h`,
      },
      {
        label: "Latest deep work",
        value: `${round(todayMetric.deepWorkMinutes / 60)}h`,
      },
      {
        label: "Fragmentation",
        value: todayMetric.fragmentationScore.toFixed(2),
      },
      {
        label: "Burnout level",
        value: burnout.level.replaceAll("_", " "),
      },
    ],
    deepWorkTrend: recentMetrics.map((metric) => ({
      date: formatShortLocalDate(metric.date),
      deepWork: round(metric.deepWorkMinutes / 60),
      shallowWork: round(metric.shallowWorkMinutes / 60),
    })),
    burnoutTrend,
    categoryBreakdown: categoryBreakdown.map((item) => ({
      name: item.category.replaceAll("_", " "),
      value: round(item.durationMinutes / 60),
    })),
    topHosts: topHosts.map((item) => ({
      name: item.hostname,
      value: round(item.durationMinutes / 60),
    })),
    matrixCategories,
    getMatrixValue(from: FocusCategory, to: FocusCategory) {
      return matrixLookup.get(`${from}->${to}`) ?? 0;
    },
  };
}
