import { randomUUID } from "node:crypto";

import { getDb, closePool, refreshDatasetAggregate } from "./index.js";
import {
  codingActivity,
  healthMetrics,
  importBatches,
  listeningHistory,
} from "./schema.js";

async function run() {
  const db = getDb();
  const now = new Date();
  const batchId = randomUUID();

  await db.insert(importBatches).values({
    id: batchId,
    dataset: "coding_activity",
    source: "manual",
    filename: null,
    status: "completed",
    rowsReceived: 3,
    rowsInserted: 3,
    rowsSkipped: 0,
    errorSummary: null,
  });

  await db.insert(codingActivity).values([
    {
      time: new Date(now.getTime() - 3 * 86_400_000),
      project: "Quantified Self",
      language: "TypeScript",
      durationSeconds: 5400,
      source: "manual",
      importBatchId: batchId,
      dedupeKey: `seed-coding-1-${batchId}`,
    },
    {
      time: new Date(now.getTime() - 2 * 86_400_000),
      project: "Quantified Self",
      language: "SQL",
      durationSeconds: 3600,
      source: "manual",
      importBatchId: batchId,
      dedupeKey: `seed-coding-2-${batchId}`,
    },
    {
      time: new Date(now.getTime() - 86_400_000),
      project: "Data Cleanup",
      language: "Python",
      durationSeconds: 2700,
      source: "manual",
      importBatchId: batchId,
      dedupeKey: `seed-coding-3-${batchId}`,
    },
  ]);

  await db.insert(listeningHistory).values([
    {
      time: new Date(now.getTime() - 2 * 86_400_000),
      trackName: "Sundial",
      artist: "Tycho",
      durationMs: 244000,
      source: "manual",
      importBatchId: batchId,
      dedupeKey: `seed-listening-1-${batchId}`,
    },
    {
      time: new Date(now.getTime() - 86_400_000),
      trackName: "Window Seat",
      artist: "Erykah Badu",
      durationMs: 229000,
      source: "manual",
      importBatchId: batchId,
      dedupeKey: `seed-listening-2-${batchId}`,
    },
  ]);

  await db.insert(healthMetrics).values([
    {
      time: new Date(now.getTime() - 2 * 86_400_000),
      metricType: "steps",
      value: 8421,
      source: "manual",
      importBatchId: batchId,
      dedupeKey: `seed-health-1-${batchId}`,
    },
    {
      time: new Date(now.getTime() - 86_400_000),
      metricType: "heart_rate",
      value: 62,
      source: "manual",
      importBatchId: batchId,
      dedupeKey: `seed-health-2-${batchId}`,
    },
  ]);

  const start = new Date(now.getTime() - 7 * 86_400_000);
  const end = new Date(now.getTime() + 86_400_000);
  await refreshDatasetAggregate("coding_activity", start, end);
  await refreshDatasetAggregate("listening_history", start, end);
  await refreshDatasetAggregate("health_metrics", start, end);

  await closePool();
}

run().catch(async (error) => {
  console.error(error);
  await closePool();
  process.exit(1);
});
