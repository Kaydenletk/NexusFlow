import { randomUUID } from "node:crypto";

import type {
  CodingActivityManualInput,
  Dataset,
  HealthMetricManualInput,
  ImportBatch,
  ImportResult,
  ListeningHistoryManualInput,
  Source,
} from "@quantified-self/contracts";
import {
  codingActivityManualSchema,
  healthMetricManualSchema,
  listeningHistoryManualSchema,
} from "@quantified-self/contracts";
import {
  buildDedupeKey,
  codingActivity,
  getDb,
  healthMetrics,
  importBatches,
  listeningHistory,
  refreshDatasetAggregate,
} from "@quantified-self/db";
import { eq } from "drizzle-orm";

import { parseCsv } from "../lib/csv.js";
import { AppError } from "../lib/errors.js";
import { expandRefreshEnd } from "../lib/time.js";

const dayMs = 86_400_000;

type ManualPayloadMap = {
  coding_activity: CodingActivityManualInput;
  listening_history: ListeningHistoryManualInput;
  health_metrics: HealthMetricManualInput;
};

type CsvValidationError = {
  rowNumber: number;
  message: string;
};

export type BatchRecordArgs = {
  id?: string;
  dataset: Dataset;
  source: Source;
  filename?: string | null;
  status: "completed" | "failed";
  rowsReceived: number;
  rowsInserted: number;
  rowsSkipped: number;
  errorSummary?: string | null;
};

function normalizeCodingCsv(row: Record<string, string>) {
  return codingActivityManualSchema.parse({
    time: row.time,
    project: row.project,
    language: row.language,
    durationSeconds: Number.parseInt(row.duration_seconds ?? "", 10),
  });
}

function normalizeListeningCsv(row: Record<string, string>) {
  return listeningHistoryManualSchema.parse({
    time: row.time,
    trackName: row.track_name,
    artist: row.artist,
    durationMs: Number.parseInt(row.duration_ms ?? "", 10),
  });
}

function normalizeHealthCsv(row: Record<string, string>) {
  return healthMetricManualSchema.parse({
    time: row.time,
    metricType: row.metric_type,
    value: Number.parseFloat(row.value ?? ""),
  });
}

function toImportBatch(args: BatchRecordArgs): ImportBatch {
  return {
    id: args.id ?? randomUUID(),
    dataset: args.dataset,
    source: args.source,
    filename: args.filename ?? null,
    status: args.status,
    rowsReceived: args.rowsReceived,
    rowsInserted: args.rowsInserted,
    rowsSkipped: args.rowsSkipped,
    errorSummary: args.errorSummary ?? null,
    createdAt: new Date().toISOString(),
  };
}

export async function persistBatch(args: BatchRecordArgs) {
  const db = getDb();
  const batch = toImportBatch(args);

  await db.insert(importBatches).values({
    id: batch.id,
    dataset: batch.dataset,
    source: batch.source,
    filename: batch.filename,
    status: batch.status,
    rowsReceived: batch.rowsReceived,
    rowsInserted: batch.rowsInserted,
    rowsSkipped: batch.rowsSkipped,
    errorSummary: batch.errorSummary,
    createdAt: new Date(batch.createdAt),
  });

  return batch;
}

export async function updateBatchCounts(
  batchId: string,
  rowsInserted: number,
  rowsSkipped: number,
) {
  const db = getDb();

  await db
    .update(importBatches)
    .set({
      rowsInserted,
      rowsSkipped,
    })
    .where(eq(importBatches.id, batchId));
}

export async function refreshDatasetAggregateSafely(
  dataset: Dataset,
  rangeStart: Date,
  rangeEnd: Date,
) {
  try {
    await refreshDatasetAggregate(
      dataset,
      new Date(rangeStart.getTime() - dayMs),
      new Date(rangeEnd.getTime() + dayMs),
    );
  } catch (error) {
    console.warn(`Aggregate refresh failed for ${dataset}`, error);
  }
}

function getValidationMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown validation error";
}

export async function importCodingActivityManual(
  payload: CodingActivityManualInput,
): Promise<ImportResult> {
  const db = getDb();
  const batch = await persistBatch({
    dataset: "coding_activity",
    source: "manual",
    status: "completed",
    rowsReceived: 1,
    rowsInserted: 0,
    rowsSkipped: 0,
  });

  const normalizedTime = new Date(payload.time);
  const result = await db
    .insert(codingActivity)
    .values({
      time: normalizedTime,
      project: payload.project,
      language: payload.language,
      durationSeconds: payload.durationSeconds,
      source: "manual",
      importBatchId: batch.id,
      dedupeKey: buildDedupeKey([
        normalizedTime.toISOString(),
        payload.project,
        payload.language,
        payload.durationSeconds,
      ]),
    })
    .onConflictDoNothing({ target: [codingActivity.dedupeKey, codingActivity.time] })
    .returning({ time: codingActivity.time });

  await updateBatchCounts(batch.id, result.length, result.length === 0 ? 1 : 0);

  if (result.length > 0) {
    await refreshDatasetAggregateSafely(
      "coding_activity",
      normalizedTime,
      expandRefreshEnd(normalizedTime),
    );
  }

  return {
    batch: {
      ...batch,
      rowsInserted: result.length,
      rowsSkipped: result.length === 0 ? 1 : 0,
    },
    validationErrors: [],
  };
}

export async function importListeningHistoryManual(
  payload: ListeningHistoryManualInput,
): Promise<ImportResult> {
  const db = getDb();
  const batch = await persistBatch({
    dataset: "listening_history",
    source: "manual",
    status: "completed",
    rowsReceived: 1,
    rowsInserted: 0,
    rowsSkipped: 0,
  });

  const normalizedTime = new Date(payload.time);
  const result = await db
    .insert(listeningHistory)
    .values({
      time: normalizedTime,
      trackName: payload.trackName,
      artist: payload.artist,
      durationMs: payload.durationMs,
      source: "manual",
      importBatchId: batch.id,
      dedupeKey: buildDedupeKey([
        normalizedTime.toISOString(),
        payload.trackName,
        payload.artist,
        payload.durationMs,
      ]),
    })
    .onConflictDoNothing({
      target: [listeningHistory.dedupeKey, listeningHistory.time],
    })
    .returning({ time: listeningHistory.time });

  await updateBatchCounts(batch.id, result.length, result.length === 0 ? 1 : 0);

  if (result.length > 0) {
    await refreshDatasetAggregateSafely(
      "listening_history",
      normalizedTime,
      expandRefreshEnd(normalizedTime),
    );
  }

  return {
    batch: {
      ...batch,
      rowsInserted: result.length,
      rowsSkipped: result.length === 0 ? 1 : 0,
    },
    validationErrors: [],
  };
}

export async function importHealthMetricManual(
  payload: HealthMetricManualInput,
): Promise<ImportResult> {
  const db = getDb();
  const batch = await persistBatch({
    dataset: "health_metrics",
    source: "manual",
    status: "completed",
    rowsReceived: 1,
    rowsInserted: 0,
    rowsSkipped: 0,
  });

  const normalizedTime = new Date(payload.time);
  const result = await db
    .insert(healthMetrics)
    .values({
      time: normalizedTime,
      metricType: payload.metricType,
      value: payload.value,
      source: "manual",
      importBatchId: batch.id,
      dedupeKey: buildDedupeKey([
        normalizedTime.toISOString(),
        payload.metricType,
        payload.value,
      ]),
    })
    .onConflictDoNothing({ target: [healthMetrics.dedupeKey, healthMetrics.time] })
    .returning({ time: healthMetrics.time });

  await updateBatchCounts(batch.id, result.length, result.length === 0 ? 1 : 0);

  if (result.length > 0) {
    await refreshDatasetAggregateSafely(
      "health_metrics",
      normalizedTime,
      expandRefreshEnd(normalizedTime),
    );
  }

  return {
    batch: {
      ...batch,
      rowsInserted: result.length,
      rowsSkipped: result.length === 0 ? 1 : 0,
    },
    validationErrors: [],
  };
}

async function recordFailedCsvBatch(
  dataset: Dataset,
  filename: string | undefined,
  rowsReceived: number,
  errorSummary: string,
) {
  return persistBatch({
    dataset,
    source: "csv",
    filename: filename ?? null,
    status: "failed",
    rowsReceived,
    rowsInserted: 0,
    rowsSkipped: rowsReceived,
    errorSummary,
  });
}

export async function importCodingActivityCsv(
  fileBuffer: Buffer,
  filename?: string,
): Promise<ImportResult> {
  const db = getDb();
  const rows = parseCsv(fileBuffer);
  const validationErrors: CsvValidationError[] = [];

  const values = rows.flatMap((row, index) => {
    try {
      const parsed = normalizeCodingCsv(row);
      const normalizedTime = new Date(parsed.time);

      return [
        {
          time: normalizedTime,
          project: parsed.project,
          language: parsed.language,
          durationSeconds: parsed.durationSeconds,
          source: "csv" as const,
          dedupeKey: buildDedupeKey([
            normalizedTime.toISOString(),
            parsed.project,
            parsed.language,
            parsed.durationSeconds,
          ]),
        },
      ];
    } catch (error) {
      validationErrors.push({
        rowNumber: index + 1,
        message: getValidationMessage(error),
      });
      return [];
    }
  });

  if (validationErrors.length > 0) {
    const batch = await recordFailedCsvBatch(
      "coding_activity",
      filename,
      rows.length,
      validationErrors[0]?.message ?? "CSV validation failed",
    );
    throw new AppError(400, "CSV_VALIDATION_ERROR", "CSV validation failed", {
      batch,
      validationErrors,
    });
  }

  const batch = await persistBatch({
    dataset: "coding_activity",
    source: "csv",
    filename: filename ?? null,
    status: "completed",
    rowsReceived: rows.length,
    rowsInserted: 0,
    rowsSkipped: 0,
  });

  const result = await db
    .insert(codingActivity)
    .values(values.map((value) => ({ ...value, importBatchId: batch.id })))
    .onConflictDoNothing({
      target: [codingActivity.dedupeKey, codingActivity.time],
    })
    .returning({ time: codingActivity.time });

  if (result.length > 0) {
    const times = result.map((row) => row.time).sort((a, b) => +a - +b);
    const start = times[0] ?? new Date();
    const end = times[times.length - 1] ?? new Date();
    await refreshDatasetAggregateSafely(
      "coding_activity",
      start,
      expandRefreshEnd(end),
    );
  }

  await updateBatchCounts(batch.id, result.length, rows.length - result.length);

  return {
    batch: {
      ...batch,
      rowsInserted: result.length,
      rowsSkipped: rows.length - result.length,
    },
    validationErrors: [],
  };
}

export async function importListeningHistoryCsv(
  fileBuffer: Buffer,
  filename?: string,
): Promise<ImportResult> {
  const db = getDb();
  const rows = parseCsv(fileBuffer);
  const validationErrors: CsvValidationError[] = [];

  const values = rows.flatMap((row, index) => {
    try {
      const parsed = normalizeListeningCsv(row);
      const normalizedTime = new Date(parsed.time);

      return [
        {
          time: normalizedTime,
          trackName: parsed.trackName,
          artist: parsed.artist,
          durationMs: parsed.durationMs,
          source: "csv" as const,
          dedupeKey: buildDedupeKey([
            normalizedTime.toISOString(),
            parsed.trackName,
            parsed.artist,
            parsed.durationMs,
          ]),
        },
      ];
    } catch (error) {
      validationErrors.push({
        rowNumber: index + 1,
        message: getValidationMessage(error),
      });
      return [];
    }
  });

  if (validationErrors.length > 0) {
    const batch = await recordFailedCsvBatch(
      "listening_history",
      filename,
      rows.length,
      validationErrors[0]?.message ?? "CSV validation failed",
    );
    throw new AppError(400, "CSV_VALIDATION_ERROR", "CSV validation failed", {
      batch,
      validationErrors,
    });
  }

  const batch = await persistBatch({
    dataset: "listening_history",
    source: "csv",
    filename: filename ?? null,
    status: "completed",
    rowsReceived: rows.length,
    rowsInserted: 0,
    rowsSkipped: 0,
  });

  const result = await db
    .insert(listeningHistory)
    .values(values.map((value) => ({ ...value, importBatchId: batch.id })))
    .onConflictDoNothing({
      target: [listeningHistory.dedupeKey, listeningHistory.time],
    })
    .returning({ time: listeningHistory.time });

  if (result.length > 0) {
    const times = result.map((row) => row.time).sort((a, b) => +a - +b);
    const start = times[0] ?? new Date();
    const end = times[times.length - 1] ?? new Date();
    await refreshDatasetAggregateSafely(
      "listening_history",
      start,
      expandRefreshEnd(end),
    );
  }

  await updateBatchCounts(batch.id, result.length, rows.length - result.length);

  return {
    batch: {
      ...batch,
      rowsInserted: result.length,
      rowsSkipped: rows.length - result.length,
    },
    validationErrors: [],
  };
}

export async function importHealthMetricsCsv(
  fileBuffer: Buffer,
  filename?: string,
): Promise<ImportResult> {
  const db = getDb();
  const rows = parseCsv(fileBuffer);
  const validationErrors: CsvValidationError[] = [];

  const values = rows.flatMap((row, index) => {
    try {
      const parsed = normalizeHealthCsv(row);
      const normalizedTime = new Date(parsed.time);

      return [
        {
          time: normalizedTime,
          metricType: parsed.metricType,
          value: parsed.value,
          source: "csv" as const,
          dedupeKey: buildDedupeKey([
            normalizedTime.toISOString(),
            parsed.metricType,
            parsed.value,
          ]),
        },
      ];
    } catch (error) {
      validationErrors.push({
        rowNumber: index + 1,
        message: getValidationMessage(error),
      });
      return [];
    }
  });

  if (validationErrors.length > 0) {
    const batch = await recordFailedCsvBatch(
      "health_metrics",
      filename,
      rows.length,
      validationErrors[0]?.message ?? "CSV validation failed",
    );
    throw new AppError(400, "CSV_VALIDATION_ERROR", "CSV validation failed", {
      batch,
      validationErrors,
    });
  }

  const batch = await persistBatch({
    dataset: "health_metrics",
    source: "csv",
    filename: filename ?? null,
    status: "completed",
    rowsReceived: rows.length,
    rowsInserted: 0,
    rowsSkipped: 0,
  });

  const result = await db
    .insert(healthMetrics)
    .values(values.map((value) => ({ ...value, importBatchId: batch.id })))
    .onConflictDoNothing({
      target: [healthMetrics.dedupeKey, healthMetrics.time],
    })
    .returning({ time: healthMetrics.time });

  if (result.length > 0) {
    const times = result.map((row) => row.time).sort((a, b) => +a - +b);
    const start = times[0] ?? new Date();
    const end = times[times.length - 1] ?? new Date();
    await refreshDatasetAggregateSafely(
      "health_metrics",
      start,
      expandRefreshEnd(end),
    );
  }

  await updateBatchCounts(batch.id, result.length, rows.length - result.length);

  return {
    batch: {
      ...batch,
      rowsInserted: result.length,
      rowsSkipped: rows.length - result.length,
    },
    validationErrors: [],
  };
}
