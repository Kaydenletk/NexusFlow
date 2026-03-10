import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";

import type { IntegrationConfigRow } from "@quantified-self/db";
import type {
  ImportBatch,
  ManualSyncResult,
  SyncRun,
} from "@quantified-self/contracts";
import {
  buildDedupeKey,
  codingActivity,
  getDb,
  importBatches,
  integrationConfigs,
  syncRuns,
} from "@quantified-self/db";
import { and, eq } from "drizzle-orm";

import { AppError } from "../lib/errors.js";
import { addDays, expandRefreshEnd, formatDateKey, startOfUtcDay } from "../lib/time.js";
import {
  persistBatch,
  refreshDatasetAggregateSafely,
  updateBatchCounts,
} from "./import-service.js";

type WakaTimeProjectSummary = {
  name?: string;
  text?: string;
  total_seconds?: number;
  seconds?: number;
};

type WakaTimeDaySummary = {
  grand_total?: {
    total_seconds?: number;
  };
  projects?: WakaTimeProjectSummary[];
  range?: {
    date?: string;
  };
};

function getApiKey(config: IntegrationConfigRow) {
  const apiKey = config.credentialsJson?.apiKey;

  if (typeof apiKey !== "string" || apiKey.trim().length === 0) {
    throw new AppError(
      400,
      "WAKATIME_API_KEY_MISSING",
      "WakaTime API key is required before syncing",
    );
  }

  return apiKey.trim();
}

function toImportBatch(batch: ImportBatch) {
  return {
    id: batch.id,
    dataset: batch.dataset,
    source: batch.source,
    filename: batch.filename,
    status: batch.status,
    rowsReceived: batch.rowsReceived,
    rowsInserted: batch.rowsInserted,
    rowsSkipped: batch.rowsSkipped,
    errorSummary: batch.errorSummary,
    createdAt: batch.createdAt,
  };
}

function toSyncRun(row: {
  id: string;
  provider: string;
  status: string;
  importBatchId: string | null;
  rowsFetched: number;
  rowsInserted: number;
  errorMessage: string | null;
  startedAt: Date;
  finishedAt: Date | null;
  createdAt: Date;
}): SyncRun {
  return {
    id: row.id,
    provider: "wakatime",
    status: row.status as SyncRun["status"],
    importBatchId: row.importBatchId,
    rowsFetched: row.rowsFetched,
    rowsInserted: row.rowsInserted,
    errorMessage: row.errorMessage,
    startedAt: row.startedAt.toISOString(),
    finishedAt: row.finishedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

function assertDefined<T>(value: T | undefined, message: string): T {
  if (value === undefined) {
    throw new AppError(500, "INTERNAL_ERROR", message);
  }

  return value;
}

function getSyncWindow(syncCursor: Date | null) {
  const today = startOfUtcDay(new Date());
  const end = today;
  const start = syncCursor
    ? startOfUtcDay(addDays(syncCursor, 1))
    : addDays(today, -13);

  if (start > end) {
    return { start: end, end };
  }

  return { start, end };
}

async function fetchWakaTimeSummaries(
  apiKey: string,
  start: Date,
  end: Date,
): Promise<WakaTimeDaySummary[]> {
  const auth = Buffer.from(`${apiKey}:`).toString("base64");
  const params = new URLSearchParams({
    start: formatDateKey(start, "UTC"),
    end: formatDateKey(end, "UTC"),
  });
  const response = await fetch(
    `https://wakatime.com/api/v1/users/current/summaries?${params.toString()}`,
    {
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: "application/json",
      },
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new AppError(
      502,
      "WAKATIME_SYNC_FAILED",
      `WakaTime sync failed with status ${response.status}`,
      body,
    );
  }

  const payload = (await response.json()) as { data?: WakaTimeDaySummary[] };
  return payload.data ?? [];
}

function mapSummariesToRows(summaries: WakaTimeDaySummary[]) {
  return summaries.flatMap((summary) => {
    const date = summary.range?.date;
    if (!date) {
      return [];
    }

    const time = new Date(`${date}T00:00:00.000Z`);

    return (summary.projects ?? []).flatMap((project) => {
      const name = project.name?.trim();
      const durationSeconds = Math.round(
        project.total_seconds ?? project.seconds ?? 0,
      );

      if (!name || durationSeconds <= 0) {
        return [];
      }

      return [
        {
          time,
          project: name,
          language: "mixed",
          durationSeconds,
          source: "wakatime" as const,
          dedupeKey: buildDedupeKey([
            "wakatime",
            date,
            name,
            durationSeconds,
          ]),
        },
      ];
    });
  });
}

async function markSyncFailure(
  runId: string,
  batchId: string,
  provider: "wakatime",
  message: string,
) {
  const db = getDb();
  const now = new Date();

  await db
    .update(importBatches)
    .set({
      status: "failed",
      rowsInserted: 0,
      rowsSkipped: 0,
      errorSummary: message,
    })
    .where(eq(importBatches.id, batchId));

  await db
    .update(syncRuns)
    .set({
      status: "failed",
      errorMessage: message,
      finishedAt: now,
    })
    .where(eq(syncRuns.id, runId));

  await db
    .update(integrationConfigs)
    .set({
      lastError: message,
      updatedAt: now,
    })
    .where(eq(integrationConfigs.provider, provider));
}

export async function runWakaTimeSync(
  config: IntegrationConfigRow,
): Promise<ManualSyncResult> {
  const db = getDb();
  const provider = "wakatime" as const;
  const startedAt = new Date();
  const apiKey = getApiKey(config);
  const { start, end } = getSyncWindow(config.syncCursor ?? null);
  const batch = await persistBatch({
    dataset: "coding_activity",
    source: "wakatime",
    status: "completed",
    rowsReceived: 0,
    rowsInserted: 0,
    rowsSkipped: 0,
    filename: null,
  });

  const [insertedRun] = await db
    .insert(syncRuns)
    .values({
      id: randomUUID(),
      provider,
      status: "running",
      importBatchId: batch.id,
      rowsFetched: 0,
      rowsInserted: 0,
      startedAt,
    })
    .returning();
  const run = assertDefined(insertedRun, "Failed to create sync run");

  try {
    const summaries = await fetchWakaTimeSummaries(apiKey, start, end);
    const values = mapSummariesToRows(summaries);
    const fetchedRows = values.length;

    const result = fetchedRows
      ? await db
          .insert(codingActivity)
          .values(values.map((value) => ({ ...value, importBatchId: batch.id })))
          .onConflictDoNothing({
            target: [codingActivity.dedupeKey, codingActivity.time],
          })
          .returning({ time: codingActivity.time })
      : [];

    await db
      .update(importBatches)
      .set({
        rowsReceived: fetchedRows,
      })
      .where(eq(importBatches.id, batch.id));

    await updateBatchCounts(batch.id, result.length, fetchedRows - result.length);

    if (result.length > 0) {
      const times = result.map((row) => row.time).sort((a, b) => +a - +b);
      const minTime = times[0] ?? start;
      const maxTime = times[times.length - 1] ?? end;
      await refreshDatasetAggregateSafely(
        "coding_activity",
        minTime,
        expandRefreshEnd(maxTime),
      );
    }

    const finishedAt = new Date();

    await db
      .update(syncRuns)
      .set({
        status: "completed",
        rowsFetched: fetchedRows,
        rowsInserted: result.length,
        finishedAt,
      })
      .where(eq(syncRuns.id, run.id));

    await db
      .update(integrationConfigs)
      .set({
        syncCursor: end,
        lastSyncedAt: finishedAt,
        lastError: null,
        updatedAt: finishedAt,
      })
      .where(and(eq(integrationConfigs.provider, provider), eq(integrationConfigs.enabled, true)));

    return {
      run: toSyncRun({
        ...run,
        status: "completed",
        rowsFetched: fetchedRows,
        rowsInserted: result.length,
        errorMessage: null,
        finishedAt,
      }),
      batch: {
        ...batch,
        rowsReceived: fetchedRows,
        rowsInserted: result.length,
        rowsSkipped: fetchedRows - result.length,
      },
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown WakaTime sync error";
    await markSyncFailure(run.id, batch.id, provider, message);
    throw error;
  }
}
