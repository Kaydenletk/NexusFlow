import { describe, expect, it } from "vitest";

import {
  codingStreaksResponseSchema,
  codingActivityManualSchema,
  healthMetricQuerySchema,
  heatmapResponseSchema,
  importBatchSchema,
  recentQuerySchema,
  sourceSchema,
  syncRunSchema,
} from "../src/index.js";

describe("contracts", () => {
  it("validates coding manual payloads", () => {
    const parsed = codingActivityManualSchema.parse({
      time: "2026-03-10T08:00:00Z",
      project: "NexusFlow pivot",
      language: "TypeScript",
      durationSeconds: 5400,
    });

    expect(parsed.durationSeconds).toBe(5400);
  });

  it("rejects empty health metric type", () => {
    const result = healthMetricQuerySchema.safeParse({
      range: "30d",
      bucket: "day",
      metricType: "",
    });

    expect(result.success).toBe(false);
  });

  it("parses recent query defaults", () => {
    const parsed = recentQuerySchema.parse({
      dataset: "health_metrics",
    });

    expect(parsed.limit).toBe(20);
  });

  it("requires import batch ids to be uuids", () => {
    const result = importBatchSchema.safeParse({
      id: "not-a-uuid",
      dataset: "coding_activity",
      source: "csv",
      filename: "coding.csv",
      status: "completed",
      rowsReceived: 5,
      rowsInserted: 5,
      rowsSkipped: 0,
      errorSummary: null,
      createdAt: "2026-03-10T08:00:00Z",
    });

    expect(result.success).toBe(false);
  });

  it("accepts new integration-backed sources", () => {
    const parsed = sourceSchema.parse("wakatime");

    expect(parsed).toBe("wakatime");
  });

  it("validates heatmap payload shape", () => {
    const parsed = heatmapResponseSchema.parse({
      range: "365d",
      items: Array.from({ length: 365 }, (_, index) => ({
        date: `2026-01-${String((index % 28) + 1).padStart(2, "0")}`,
        valueSeconds: index,
        intensity: Math.min(index % 5, 4),
      })),
    });

    expect(parsed.items).toHaveLength(365);
  });

  it("validates coding streak payloads", () => {
    const parsed = codingStreaksResponseSchema.parse({
      currentStreak: 3,
      longestStreak: 12,
      lastActiveDate: "2026-03-10",
    });

    expect(parsed.longestStreak).toBe(12);
  });

  it("requires sync runs to use known statuses", () => {
    const result = syncRunSchema.safeParse({
      id: "550e8400-e29b-41d4-a716-446655440000",
      provider: "wakatime",
      status: "queued",
      importBatchId: null,
      rowsFetched: 0,
      rowsInserted: 0,
      errorMessage: null,
      startedAt: "2026-03-10T08:00:00Z",
      finishedAt: null,
      createdAt: "2026-03-10T08:00:00Z",
    });

    expect(result.success).toBe(false);
  });
});
