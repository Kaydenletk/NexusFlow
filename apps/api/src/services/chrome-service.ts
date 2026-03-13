import { randomUUID } from "node:crypto";

import {
  applyPrivacyPolicy,
  calculateContextSwitchTax,
  createFocusSnapshot,
  focusCategoryValues,
  formatLocalDate,
  getBurnoutAssessment,
  getCanvasCourseReport,
  getDailyFocusMetrics,
  getDeepWorkBlocks,
  type DailyFocusMetrics,
  type FocusCategory,
  type FocusSession,
} from "@nexusflow/focus-core";
import type {
  ChromeBulkIngestResponse,
  ChromeBulkSessionsInput,
  ChromeCanvasCourseReport,
  ChromeCategoriesResponse,
  ChromeContextSwitchingResponse,
  ChromeHealthResponse,
  ChromeHostsResponse,
  ChromeOverviewResponse,
  ChromeRange,
  ChromeSessionRecord,
  ChromeSessionsResponse,
  ChromeSyncRun,
  ChromeSyncStatusResponse,
  ChromeTimelineResponse,
} from "@quantified-self/contracts";
import {
  chromePrivacyRules,
  chromeSessions,
  chromeSyncRuns,
  getDb,
  getPool,
} from "@quantified-self/db";
import { desc, sql } from "drizzle-orm";

import { env } from "../env.js";
import { AppError } from "../lib/errors.js";
import { serializeRows } from "../lib/serialization.js";

const dayMs = 86_400_000;

type ChromeSessionRowShape = {
  id: string;
  tab_id: number | null;
  window_id: number | null;
  origin: string;
  path: string;
  hostname: string;
  document_title: string | null;
  category: string;
  intent: "productive" | "neutral" | "distracting";
  event_reason: "activated" | "updated" | "window_blur" | "removed" | "heartbeat";
  is_path_masked: boolean;
  start_time: Date;
  end_time: Date;
  duration_seconds: number;
  created_at: Date;
};

function getChromeRangeDays(range: ChromeRange) {
  switch (range) {
    case "1d":
      return 1;
    case "7d":
      return 7;
    case "30d":
      return 30;
  }
}

function getChromeRangeWindow(range: ChromeRange) {
  const end = new Date();
  const start = new Date(end.getTime() - getChromeRangeDays(range) * dayMs);

  return { start, end };
}

function knownCategory(value: string): FocusCategory {
  if ((focusCategoryValues as readonly string[]).includes(value)) {
    return value as FocusCategory;
  }

  return "uncategorized";
}

function rowToFocusSession(row: ChromeSessionRowShape): FocusSession {
  return {
    id: row.id,
    tabId: row.tab_id,
    windowId: row.window_id,
    origin: row.origin,
    path: row.path,
    hostname: row.hostname,
    documentTitle: row.document_title,
    category: knownCategory(row.category),
    intent: row.intent,
    eventReason: row.event_reason,
    isPathMasked: row.is_path_masked,
    startTime: row.start_time.toISOString(),
    endTime: row.end_time.toISOString(),
    durationSeconds: row.duration_seconds,
  };
}

function rowToChromeRecord(row: ChromeSessionRowShape): ChromeSessionRecord {
  return {
    id: row.id,
    tabId: row.tab_id,
    windowId: row.window_id,
    origin: row.origin,
    path: row.path,
    hostname: row.hostname,
    documentTitle: row.document_title,
    category: row.category,
    intent: row.intent,
    eventReason: row.event_reason,
    isPathMasked: row.is_path_masked,
    startTime: row.start_time.toISOString(),
    endTime: row.end_time.toISOString(),
    durationSeconds: row.duration_seconds,
    createdAt: row.created_at.toISOString(),
  };
}

function toChromeSyncRun(row: {
  id: string;
  status: string;
  rowsReceived: number;
  rowsInserted: number;
  errorMessage: string | null;
  createdAt: Date;
  finishedAt: Date | null;
}): ChromeSyncRun {
  return {
    id: row.id,
    status: row.status as ChromeSyncRun["status"],
    rowsReceived: row.rowsReceived,
    rowsInserted: row.rowsInserted,
    errorMessage: row.errorMessage,
    createdAt: row.createdAt.toISOString(),
    finishedAt: row.finishedAt?.toISOString() ?? null,
  };
}

function clipSessionsForDate(sessions: FocusSession[], date: string) {
  const start = new Date(`${date}T00:00:00`);
  const end = new Date(start.getTime() + dayMs);

  return sessions
    .map((session) => {
      const startTime = new Date(session.startTime);
      const endTime = new Date(session.endTime);

      if (endTime <= start || startTime >= end) {
        return null;
      }

      const clippedStart = new Date(Math.max(startTime.getTime(), start.getTime()));
      const clippedEnd = new Date(Math.min(endTime.getTime(), end.getTime()));
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
    .sort((left, right) => left.startTime.localeCompare(right.startTime));
}

async function fetchChromeRows(
  range: ChromeRange,
  limit?: number,
): Promise<ChromeSessionRowShape[]> {
  const pool = getPool();
  const { start, end } = getChromeRangeWindow(range);
  const values: unknown[] = [start, end];
  let limitSql = "";

  if (typeof limit === "number") {
    values.push(limit);
    limitSql = "LIMIT $3";
  }

  const { rows } = await pool.query<ChromeSessionRowShape>(
    `
      SELECT
        id,
        tab_id,
        window_id,
        origin,
        path,
        hostname,
        document_title,
        category,
        intent,
        event_reason,
        is_path_masked,
        start_time,
        end_time,
        duration_seconds,
        created_at
      FROM chrome_sessions
      WHERE start_time >= $1 AND start_time < $2
      ORDER BY start_time DESC
      ${limitSql}
    `,
    values,
  );

  return rows;
}

export async function ingestChromeSessions(
  payload: ChromeBulkSessionsInput,
): Promise<ChromeBulkIngestResponse> {
  const db = getDb();
  const runId = randomUUID();
  const createdAt = new Date();

  await db.insert(chromeSyncRuns).values({
    id: runId,
    status: "completed",
    rowsReceived: payload.sessions.length,
    rowsInserted: 0,
    createdAt,
  });

  try {
    const values = payload.sessions.map((session) => {
      const category = knownCategory(session.category);
      const privacy = applyPrivacyPolicy(
        {
          origin: session.origin,
          path: session.path,
          hostname: session.hostname,
        },
        category,
      );

      return {
        id: session.id,
        tabId: session.tabId ?? null,
        windowId: session.windowId ?? null,
        origin: privacy.origin,
        path: privacy.path,
        hostname: privacy.hostname,
        documentTitle: privacy.isPathMasked ? null : session.documentTitle ?? null,
        category,
        intent: session.intent,
        eventReason: session.eventReason,
        isPathMasked: session.isPathMasked || privacy.isPathMasked,
        startTime: new Date(session.startTime),
        endTime: new Date(session.endTime),
        durationSeconds: session.durationSeconds,
        source: "chrome_extension",
        syncRunId: runId,
      };
    });

    const inserted = await db
      .insert(chromeSessions)
      .values(values)
      .onConflictDoNothing({ target: chromeSessions.id })
      .returning({ id: chromeSessions.id });

    const [run] = await db
      .update(chromeSyncRuns)
      .set({
        rowsInserted: inserted.length,
        finishedAt: new Date(),
      })
      .where(sql`${chromeSyncRuns.id} = ${runId}`)
      .returning();

    return {
      run: toChromeSyncRun({
        id: run?.id ?? runId,
        status: run?.status ?? "completed",
        rowsReceived: run?.rowsReceived ?? payload.sessions.length,
        rowsInserted: run?.rowsInserted ?? inserted.length,
        errorMessage: run?.errorMessage ?? null,
        createdAt: run?.createdAt ?? createdAt,
        finishedAt: run?.finishedAt ?? new Date(),
      }),
      receivedCount: payload.sessions.length,
      insertedCount: inserted.length,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Chrome sync failed";

    await db
      .update(chromeSyncRuns)
      .set({
        status: "failed",
        errorMessage: message,
        finishedAt: new Date(),
      })
      .where(sql`${chromeSyncRuns.id} = ${runId}`);

    throw new AppError(500, "CHROME_SYNC_FAILED", message);
  }
}

export async function getChromeHealth(): Promise<ChromeHealthResponse> {
  const pool = getPool();
  const [sessionCount, privacyRules, lastSync] = await Promise.all([
    pool.query<{ value: number }>(
      "SELECT COUNT(*)::int AS value FROM chrome_sessions",
    ),
    pool.query<{ value: number }>(
      "SELECT COUNT(*)::int AS value FROM chrome_privacy_rules WHERE enabled = TRUE",
    ),
    pool.query<{ value: Date | null }>(
      "SELECT MAX(created_at) AS value FROM chrome_sync_runs",
    ),
  ]);

  return {
    status: "ok",
    database: "ok",
    timestamp: new Date().toISOString(),
    totalSessions: Number(sessionCount.rows[0]?.value ?? 0),
    lastSyncAt: lastSync.rows[0]?.value?.toISOString() ?? null,
    privacyRuleCount: Number(privacyRules.rows[0]?.value ?? 0),
  };
}

export async function getChromeOverview(
  range: ChromeRange,
): Promise<ChromeOverviewResponse> {
  const rows = await fetchChromeRows(range);
  const sessions = rows.map(rowToFocusSession).reverse();
  const dailyMetrics = getDailyFocusMetrics(sessions);
  const burnout = getBurnoutAssessment(dailyMetrics);
  const trackedSeconds = sessions.reduce(
    (total, session) => total + session.durationSeconds,
    0,
  );
  const productiveSeconds = sessions
    .filter((session) => session.intent === "productive")
    .reduce((total, session) => total + session.durationSeconds, 0);
  const distractingSeconds = sessions
    .filter((session) => session.intent === "distracting")
    .reduce((total, session) => total + session.durationSeconds, 0);
  const switchCount = dailyMetrics.reduce(
    (total: number, metric: DailyFocusMetrics) => total + metric.categorySwitches,
    0,
  );
  const switchTax = Number(calculateContextSwitchTax(sessions).toFixed(2));
  const lastSync = await getChromeSyncStatus();

  return {
    range,
    metrics: {
      trackedHours: Number((trackedSeconds / 3600).toFixed(2)),
      productiveRatio:
        trackedSeconds === 0
          ? 0
          : Number((productiveSeconds / trackedSeconds).toFixed(2)),
      distractingRatio:
        trackedSeconds === 0
          ? 0
          : Number((distractingSeconds / trackedSeconds).toFixed(2)),
      switchCount,
      switchTax,
      activeDays: dailyMetrics.filter(
        (metric: DailyFocusMetrics) => metric.activeMinutes > 0,
      ).length,
      syncedSessionCount: sessions.length,
      burnoutLevel: burnout.warmingUp ? "Warming up" : burnout.level,
    },
    daily: dailyMetrics.map((metric: DailyFocusMetrics) => {
      const daySessions = clipSessionsForDate(sessions, metric.date);
      const distractingMinutes = Number(
        (
          daySessions
            .filter((session) => session.intent === "distracting")
            .reduce((total, session) => total + session.durationSeconds, 0) / 60
        ).toFixed(2),
      );

      return {
        date: metric.date,
        trackedMinutes: metric.activeMinutes,
        productiveMinutes: metric.productiveMinutes,
        distractingMinutes,
        switchCount: metric.categorySwitches,
        switchTax: Number(calculateContextSwitchTax(daySessions).toFixed(2)),
      };
    }),
    lastSyncAt: lastSync.items[0]?.createdAt ?? null,
  };
}

export async function getChromeSessions(
  range: ChromeRange,
  limit: number,
): Promise<ChromeSessionsResponse> {
  const rows = await fetchChromeRows(range, limit);

  return {
    range,
    items: rows.map(rowToChromeRecord),
  };
}

export async function getChromeTimeline(date: string): Promise<ChromeTimelineResponse> {
  const pool = getPool();
  const start = new Date(`${date}T00:00:00`);
  const end = new Date(start.getTime() + dayMs);
  const { rows } = await pool.query<ChromeSessionRowShape>(
    `
      SELECT
        id,
        tab_id,
        window_id,
        origin,
        path,
        hostname,
        document_title,
        category,
        intent,
        event_reason,
        is_path_masked,
        start_time,
        end_time,
        duration_seconds,
        created_at
      FROM chrome_sessions
      WHERE start_time < $2 AND end_time > $1
      ORDER BY start_time ASC
    `,
    [start, end],
  );
  const sessions = rows.map(rowToFocusSession);
  const daySessions = clipSessionsForDate(sessions, date);

  return {
    date,
    switchCount: getDailyFocusMetrics(daySessions, {
      startDate: date,
      endDate: date,
    })[0]?.categorySwitches ?? 0,
    switchTax: Number(calculateContextSwitchTax(daySessions).toFixed(2)),
    focusBlocks: getDeepWorkBlocks(daySessions, date),
    items: serializeRows(rows.map(rowToChromeRecord)),
  };
}

export async function getChromeHosts(
  range: ChromeRange,
): Promise<ChromeHostsResponse> {
  const pool = getPool();
  const { start, end } = getChromeRangeWindow(range);
  const { rows } = await pool.query<{
    hostname: string;
    duration_minutes: number;
    session_count: number;
    distracting_minutes: number;
    masked_count: number;
    total_count: number;
  }>(
    `
      SELECT
        hostname,
        SUM(duration_seconds)::float8 / 60 AS duration_minutes,
        COUNT(*)::int AS session_count,
        SUM(CASE WHEN intent = 'distracting' THEN duration_seconds ELSE 0 END)::float8 / 60 AS distracting_minutes,
        SUM(CASE WHEN is_path_masked THEN 1 ELSE 0 END)::int AS masked_count,
        COUNT(*)::int AS total_count
      FROM chrome_sessions
      WHERE start_time >= $1 AND start_time < $2
      GROUP BY hostname
      ORDER BY duration_minutes DESC
      LIMIT 12
    `,
    [start, end],
  );

  return {
    range,
    items: rows.map((row) => ({
      hostname: row.hostname,
      durationMinutes: Number((row.duration_minutes ?? 0).toFixed(2)),
      sessionCount: row.session_count,
      distractingMinutes: Number((row.distracting_minutes ?? 0).toFixed(2)),
      isMostlyMasked: Number(row.masked_count ?? 0) >= Number(row.total_count ?? 0) / 2,
    })),
  };
}

export async function getChromeCategories(
  range: ChromeRange,
): Promise<ChromeCategoriesResponse> {
  const pool = getPool();
  const { start, end } = getChromeRangeWindow(range);
  const { rows } = await pool.query<{
    category: string;
    duration_minutes: number;
    session_count: number;
  }>(
    `
      SELECT
        category,
        SUM(duration_seconds)::float8 / 60 AS duration_minutes,
        COUNT(*)::int AS session_count
      FROM chrome_sessions
      WHERE start_time >= $1 AND start_time < $2
      GROUP BY category
      ORDER BY duration_minutes DESC
    `,
    [start, end],
  );

  return {
    range,
    items: rows.map((row) => ({
      category: row.category,
      durationMinutes: Number((row.duration_minutes ?? 0).toFixed(2)),
      sessionCount: row.session_count,
    })),
  };
}

export async function getChromeContextSwitching(
  range: ChromeRange,
): Promise<ChromeContextSwitchingResponse> {
  const rows = await fetchChromeRows(range);
  const sessions = rows.map(rowToFocusSession).reverse();
  const dailyMetrics = getDailyFocusMetrics(sessions);
  const burnout = getBurnoutAssessment(dailyMetrics);

  return {
    range,
    burnoutLevel: burnout.warmingUp ? "Warming up" : burnout.level,
    items: dailyMetrics.map((metric: DailyFocusMetrics) => {
      const daySessions = clipSessionsForDate(sessions, metric.date);

      return {
        date: metric.date,
        switchCount: metric.categorySwitches,
        switchTax: Number(calculateContextSwitchTax(daySessions).toFixed(2)),
        fragmentationScore: metric.fragmentationScore,
      };
    }),
  };
}

export async function getChromeCanvasReport(
  range: ChromeRange,
): Promise<ChromeCanvasCourseReport> {
  const rows = await fetchChromeRows(range);
  const sessions = rows.map(rowToFocusSession).reverse();
  const snapshot = createFocusSnapshot(sessions, {
    timezone: env.APP_TIMEZONE,
    exportedAt: new Date().toISOString(),
  });

  return getCanvasCourseReport(snapshot);
}

export async function getChromeSyncStatus(): Promise<ChromeSyncStatusResponse> {
  const db = getDb();
  const rows = await db
    .select()
    .from(chromeSyncRuns)
    .orderBy(desc(chromeSyncRuns.createdAt))
    .limit(20);

  return {
    items: rows.map((row) =>
      toChromeSyncRun({
        id: row.id,
        status: row.status,
        rowsReceived: row.rowsReceived,
        rowsInserted: row.rowsInserted,
        errorMessage: row.errorMessage,
        createdAt: row.createdAt,
        finishedAt: row.finishedAt,
      }),
    ),
  };
}

export async function getChromePrivacyRulesCount() {
  const db = getDb();
  const rows = await db.select().from(chromePrivacyRules);

  return rows.length;
}
