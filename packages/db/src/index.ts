import { createHash } from "node:crypto";

export * from "./client.js";
export * from "./schema.js";

export const aggregateViewByDataset = {
  coding_activity: "coding_activity_daily",
  listening_history: "listening_history_daily",
  health_metrics: "health_metrics_daily",
} as const;

export function buildDedupeKey(parts: Array<string | number>) {
  return createHash("sha256").update(parts.join("|")).digest("hex");
}

export function toUtcIso(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString();
}

export async function refreshDatasetAggregate(
  dataset: keyof typeof aggregateViewByDataset,
  rangeStart: Date,
  rangeEnd: Date,
) {
  const { getPool } = await import("./client.js");
  const pool = getPool();
  const viewName = aggregateViewByDataset[dataset];
  const startIso = toUtcIso(rangeStart);
  const endIso = toUtcIso(rangeEnd);

  await pool.query(
    `CALL refresh_continuous_aggregate($1, $2::timestamptz, $3::timestamptz)`,
    [viewName, startIso, endIso],
  );
}
