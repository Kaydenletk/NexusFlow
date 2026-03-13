import { z } from "zod";

export const datasetValues = [
  "coding_activity",
  "listening_history",
  "health_metrics",
] as const;
export const sourceValues = [
  "manual",
  "csv",
  "wakatime",
  "spotify",
  "apple_health",
  "ai",
] as const;
export const importStatusValues = ["completed", "failed"] as const;
export const integrationProviderValues = ["wakatime"] as const;
export const syncRunStatusValues = ["running", "completed", "failed"] as const;
export const rangeValues = ["7d", "30d", "90d"] as const;
export const bucketValues = ["day", "week"] as const;
export const goalPeriodValues = ["day", "week"] as const;
export const chromeRangeValues = ["1d", "7d", "30d"] as const;
export const chromeEventReasonValues = [
  "activated",
  "updated",
  "window_blur",
  "removed",
  "heartbeat",
] as const;
export const chromeSyncRunStatusValues = ["completed", "failed"] as const;
export const chromePrivacyModeValues = ["allow", "mask"] as const;
export const goalMetricCatalog = {
  coding_activity: ["coding_hours", "coding_sessions"],
  listening_history: ["listening_hours", "track_count"],
  health_metrics: ["steps_total", "health_entry_count", "heart_rate_avg"],
} as const;
export const goalMetricValues = Object.values(goalMetricCatalog).flatMap(
  (metrics) => metrics,
) as [
  "coding_hours",
  "coding_sessions",
  "listening_hours",
  "track_count",
  "steps_total",
  "health_entry_count",
  "heart_rate_avg",
];

export const datasetSchema = z.enum(datasetValues);
export const sourceSchema = z.enum(sourceValues);
export const importStatusSchema = z.enum(importStatusValues);
export const integrationProviderSchema = z.enum(integrationProviderValues);
export const syncRunStatusSchema = z.enum(syncRunStatusValues);
export const rangeSchema = z.enum(rangeValues);
export const bucketSchema = z.enum(bucketValues);
export const goalPeriodSchema = z.enum(goalPeriodValues);
export const goalMetricSchema = z.enum(goalMetricValues);
export const chromeRangeSchema = z.enum(chromeRangeValues);
export const chromeEventReasonSchema = z.enum(chromeEventReasonValues);
export const chromeSyncRunStatusSchema = z.enum(chromeSyncRunStatusValues);
export const chromePrivacyModeSchema = z.enum(chromePrivacyModeValues);

export const timestampStringSchema = z
  .string()
  .min(1)
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "Invalid timestamp",
  });

export const codingActivityManualSchema = z.object({
  time: timestampStringSchema,
  project: z.string().trim().min(1).max(200),
  language: z.string().trim().min(1).max(100),
  durationSeconds: z.int().positive().max(86400),
});

export const listeningHistoryManualSchema = z.object({
  time: timestampStringSchema,
  trackName: z.string().trim().min(1).max(255),
  artist: z.string().trim().min(1).max(255),
  durationMs: z.int().positive().max(86_400_000),
});

export const healthMetricManualSchema = z.object({
  time: timestampStringSchema,
  metricType: z.string().trim().min(1).max(100),
  value: z.number().finite(),
});

export const summaryQuerySchema = z.object({
  range: rangeSchema.default("30d"),
});

export const codingActivityQuerySchema = z.object({
  range: rangeSchema.default("30d"),
  bucket: bucketSchema.default("day"),
});

export const listeningHistoryQuerySchema = z.object({
  range: rangeSchema.default("30d"),
  bucket: bucketSchema.default("day"),
});

export const healthMetricQuerySchema = z.object({
  range: rangeSchema.default("30d"),
  bucket: bucketSchema.default("day"),
  metricType: z.string().trim().min(1).max(100),
});

export const recentQuerySchema = z.object({
  dataset: datasetSchema,
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const importsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const integrationsQuerySchema = z.object({
  provider: integrationProviderSchema.optional(),
});

export const syncRunsQuerySchema = z.object({
  provider: integrationProviderSchema.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const integrationConfigUpsertSchema = z.object({
  enabled: z.boolean(),
  credentials: z.object({
    apiKey: z.string().trim().max(255).optional().default(""),
  }),
});

export const goalCreateSchema = z.object({
  dataset: datasetSchema,
  metric: goalMetricSchema,
  targetValue: z.number().positive(),
  period: goalPeriodSchema,
});

export const goalUpdateSchema = goalCreateSchema;

export const goalsProgressQuerySchema = z.object({
  dataset: datasetSchema.optional(),
});

export const heatmapQuerySchema = z.object({
  range: z.literal("365d").default("365d"),
});

export const chromeBulkSessionsSchema = z.object({
  sessions: z
    .array(
      z.object({
        id: z.string().min(1),
        tabId: z.number().int().nullable().optional(),
        windowId: z.number().int().nullable().optional(),
        origin: z.string().min(1),
        path: z.string().min(1),
        hostname: z.string().min(1),
        documentTitle: z.string().min(1).nullable().optional(),
        category: z.string().min(1),
        intent: z.enum(["productive", "neutral", "distracting"]),
        eventReason: chromeEventReasonSchema,
        isPathMasked: z.boolean().default(false),
        startTime: timestampStringSchema,
        endTime: timestampStringSchema,
        durationSeconds: z.number().int().positive(),
      }),
    )
    .min(1)
    .max(500),
});

export const chromeOverviewQuerySchema = z.object({
  range: chromeRangeSchema.default("7d"),
});

export const chromeSessionsQuerySchema = z.object({
  range: chromeRangeSchema.default("7d"),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

export const chromeTimelineQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const importBatchSchema = z.object({
  id: z.string().uuid(),
  dataset: datasetSchema,
  source: sourceSchema,
  filename: z.string().nullable(),
  status: importStatusSchema,
  rowsReceived: z.int().nonnegative(),
  rowsInserted: z.int().nonnegative(),
  rowsSkipped: z.int().nonnegative(),
  errorSummary: z.string().nullable(),
  createdAt: z.string(),
});

export const importValidationErrorSchema = z.object({
  rowNumber: z.int().positive(),
  message: z.string(),
});

export const importResultSchema = z.object({
  batch: importBatchSchema,
  validationErrors: z.array(importValidationErrorSchema).default([]),
});

export const codingActivityRecordSchema = z.object({
  id: z.number().int().nonnegative(),
  time: z.string(),
  project: z.string(),
  language: z.string(),
  durationSeconds: z.number().int().nonnegative(),
  source: sourceSchema,
  importBatchId: z.string().uuid().nullable(),
  createdAt: z.string(),
});

export const listeningHistoryRecordSchema = z.object({
  id: z.number().int().nonnegative(),
  time: z.string(),
  trackName: z.string(),
  artist: z.string(),
  durationMs: z.number().int().nonnegative(),
  source: sourceSchema,
  importBatchId: z.string().uuid().nullable(),
  createdAt: z.string(),
});

export const healthMetricRecordSchema = z.object({
  id: z.number().int().nonnegative(),
  time: z.string(),
  metricType: z.string(),
  value: z.number(),
  source: sourceSchema,
  importBatchId: z.string().uuid().nullable(),
  createdAt: z.string(),
});

export const summaryCardSchema = z.object({
  label: z.string(),
  value: z.number(),
  unit: z.string(),
  changePct: z.number().nullable(),
});

export const breakdownItemSchema = z.object({
  name: z.string(),
  value: z.number(),
});

export const summaryResponseSchema = z.object({
  range: rangeSchema,
  cards: z.object({
    codingDurationHours: summaryCardSchema,
    listeningHours: summaryCardSchema,
    healthEntries: summaryCardSchema,
  }),
  coding: z.object({
    sessionCount: z.number().int().nonnegative(),
    topProjects: z.array(breakdownItemSchema),
    topLanguages: z.array(breakdownItemSchema),
  }),
  listening: z.object({
    trackCount: z.number().int().nonnegative(),
    topArtists: z.array(breakdownItemSchema),
  }),
  health: z.object({
    metricTypes: z.array(breakdownItemSchema),
    latestByMetric: z.array(
      z.object({
        metricType: z.string(),
        value: z.number(),
        time: z.string(),
      }),
    ),
  }),
});

export const seriesPointSchema = z.object({
  bucket: z.string(),
  value: z.number(),
});

export const categorizedSeriesSchema = z.object({
  name: z.string(),
  points: z.array(seriesPointSchema),
});

export const codingActivitySeriesResponseSchema = z.object({
  range: rangeSchema,
  bucket: bucketSchema,
  totals: z.array(seriesPointSchema),
  topLanguages: z.array(categorizedSeriesSchema),
  topProjects: z.array(categorizedSeriesSchema),
});

export const listeningHistorySeriesResponseSchema = z.object({
  range: rangeSchema,
  bucket: bucketSchema,
  totals: z.array(seriesPointSchema),
  topArtists: z.array(categorizedSeriesSchema),
});

export const healthMetricSeriesResponseSchema = z.object({
  range: rangeSchema,
  bucket: bucketSchema,
  metricType: z.string(),
  points: z.array(seriesPointSchema),
  latest: z
    .object({
      metricType: z.string(),
      value: z.number(),
      time: z.string(),
    })
    .nullable(),
});

export const recentResponseSchema = z.object({
  dataset: datasetSchema,
  items: z.array(
    z.union([
      codingActivityRecordSchema,
      listeningHistoryRecordSchema,
      healthMetricRecordSchema,
    ]),
  ),
});

export const importsResponseSchema = z.object({
  items: z.array(importBatchSchema),
});

export const integrationConfigSchema = z.object({
  provider: integrationProviderSchema,
  enabled: z.boolean(),
  credentials: z.object({
    apiKeyPreview: z.string(),
    hasApiKey: z.boolean(),
  }),
  syncCursor: z.string().nullable(),
  lastSyncedAt: z.string().nullable(),
  lastError: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const integrationsResponseSchema = z.object({
  items: z.array(integrationConfigSchema),
});

export const syncRunSchema = z.object({
  id: z.string().uuid(),
  provider: integrationProviderSchema,
  status: syncRunStatusSchema,
  importBatchId: z.string().uuid().nullable(),
  rowsFetched: z.int().nonnegative(),
  rowsInserted: z.int().nonnegative(),
  errorMessage: z.string().nullable(),
  startedAt: z.string(),
  finishedAt: z.string().nullable(),
  createdAt: z.string(),
});

export const syncRunsResponseSchema = z.object({
  items: z.array(syncRunSchema),
});

export const manualSyncResultSchema = z.object({
  run: syncRunSchema,
  batch: importBatchSchema,
});

export const goalSchema = z.object({
  id: z.string().uuid(),
  dataset: datasetSchema,
  metric: goalMetricSchema,
  targetValue: z.number().positive(),
  period: goalPeriodSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const goalsResponseSchema = z.object({
  items: z.array(goalSchema),
});

export const goalProgressSchema = z.object({
  goal: goalSchema,
  actualValue: z.number().nonnegative(),
  remainingValue: z.number().nonnegative(),
  percentComplete: z.number().nonnegative(),
  isComplete: z.boolean(),
});

export const goalsProgressResponseSchema = z.object({
  items: z.array(goalProgressSchema),
});

export const heatmapCellSchema = z.object({
  date: z.string(),
  valueSeconds: z.number().nonnegative(),
  intensity: z.number().int().min(0).max(4),
});

export const heatmapResponseSchema = z.object({
  range: z.literal("365d"),
  items: z.array(heatmapCellSchema).length(365),
});

export const codingStreaksResponseSchema = z.object({
  currentStreak: z.number().int().nonnegative(),
  longestStreak: z.number().int().nonnegative(),
  lastActiveDate: z.string().nullable(),
});

export const chromeSyncRunSchema = z.object({
  id: z.string().uuid(),
  status: chromeSyncRunStatusSchema,
  rowsReceived: z.number().int().nonnegative(),
  rowsInserted: z.number().int().nonnegative(),
  errorMessage: z.string().nullable(),
  createdAt: z.string(),
  finishedAt: z.string().nullable(),
});

export const chromeBulkIngestResponseSchema = z.object({
  run: chromeSyncRunSchema,
  receivedCount: z.number().int().nonnegative(),
  insertedCount: z.number().int().nonnegative(),
});

export const chromePrivacyRuleSchema = z.object({
  id: z.string().uuid(),
  hostnamePattern: z.string(),
  maskMode: chromePrivacyModeSchema,
  enabled: z.boolean(),
  description: z.string().nullable(),
  createdAt: z.string(),
});

export const chromeHealthResponseSchema = z.object({
  status: z.literal("ok"),
  database: z.literal("ok"),
  timestamp: z.string(),
  totalSessions: z.number().int().nonnegative(),
  lastSyncAt: z.string().nullable(),
  privacyRuleCount: z.number().int().nonnegative(),
});

export const chromeActivityPointSchema = z.object({
  date: z.string(),
  trackedMinutes: z.number().nonnegative(),
  productiveMinutes: z.number().nonnegative(),
  distractingMinutes: z.number().nonnegative(),
  switchCount: z.number().int().nonnegative(),
  switchTax: z.number().nonnegative(),
});

export const chromeOverviewResponseSchema = z.object({
  range: chromeRangeSchema,
  metrics: z.object({
    trackedHours: z.number().nonnegative(),
    productiveRatio: z.number().min(0).max(1),
    distractingRatio: z.number().min(0).max(1),
    switchCount: z.number().int().nonnegative(),
    switchTax: z.number().nonnegative(),
    activeDays: z.number().int().nonnegative(),
    syncedSessionCount: z.number().int().nonnegative(),
    burnoutLevel: z.enum(["Safe", "Warning", "Critical", "Warming up"]),
  }),
  daily: z.array(chromeActivityPointSchema),
  lastSyncAt: z.string().nullable(),
});

export const chromeSessionRecordSchema = z.object({
  id: z.string(),
  tabId: z.number().int().nullable(),
  windowId: z.number().int().nullable(),
  origin: z.string(),
  path: z.string(),
  hostname: z.string(),
  documentTitle: z.string().nullable(),
  category: z.string(),
  intent: z.enum(["productive", "neutral", "distracting"]),
  eventReason: chromeEventReasonSchema,
  isPathMasked: z.boolean(),
  startTime: z.string(),
  endTime: z.string(),
  durationSeconds: z.number().int().nonnegative(),
  createdAt: z.string(),
});

export const chromeSessionsResponseSchema = z.object({
  range: chromeRangeSchema,
  items: z.array(chromeSessionRecordSchema),
});

export const chromeTimelineResponseSchema = z.object({
  date: z.string(),
  switchCount: z.number().int().nonnegative(),
  switchTax: z.number().nonnegative(),
  focusBlocks: z.array(
    z.object({
      startTime: z.string(),
      endTime: z.string(),
      durationMinutes: z.number().nonnegative(),
      categories: z.array(z.string()),
    }),
  ),
  items: z.array(chromeSessionRecordSchema),
});

export const chromeHostsResponseSchema = z.object({
  range: chromeRangeSchema,
  items: z.array(
    z.object({
      hostname: z.string(),
      durationMinutes: z.number().nonnegative(),
      sessionCount: z.number().int().nonnegative(),
      distractingMinutes: z.number().nonnegative(),
      isMostlyMasked: z.boolean(),
    }),
  ),
});

export const chromeCategoriesResponseSchema = z.object({
  range: chromeRangeSchema,
  items: z.array(
    z.object({
      category: z.string(),
      durationMinutes: z.number().nonnegative(),
      sessionCount: z.number().int().nonnegative(),
    }),
  ),
});

export const chromeContextSwitchingResponseSchema = z.object({
  range: chromeRangeSchema,
  burnoutLevel: z.enum(["Safe", "Warning", "Critical", "Warming up"]),
  items: z.array(
    z.object({
      date: z.string(),
      switchCount: z.number().int().nonnegative(),
      switchTax: z.number().nonnegative(),
      fragmentationScore: z.number().nonnegative(),
    }),
  ),
});

export const chromeCanvasCourseReportSchema = z.object({
  fastSwitchThresholdSeconds: z.number().int().positive(),
  totalCanvasMinutes: z.number().nonnegative(),
  totalCourseCount: z.number().int().nonnegative(),
  courses: z.array(
    z.object({
      courseId: z.string(),
      totalMinutes: z.number().nonnegative(),
      sessionCount: z.number().int().nonnegative(),
      switchOutCount: z.number().int().nonnegative(),
      distractingSwitchCount: z.number().int().nonnegative(),
      fastSwitchCount: z.number().int().nonnegative(),
      returnToCourseCount: z.number().int().nonnegative(),
      returnRate: z.number().nonnegative(),
      daily: z.array(
        z.object({
          date: z.string(),
          durationMinutes: z.number().nonnegative(),
          sessionCount: z.number().int().nonnegative(),
          switchOutCount: z.number().int().nonnegative(),
          distractingSwitchCount: z.number().int().nonnegative(),
        }),
      ),
      topDistractionHosts: z.array(
        z.object({
          hostname: z.string(),
          durationMinutes: z.number().nonnegative(),
        }),
      ),
      interruptions: z.array(
        z.object({
          at: z.string(),
          hostname: z.string(),
          path: z.string(),
          intent: z.enum(["productive", "neutral", "distracting"]),
          durationSeconds: z.number().int().nonnegative(),
          returnedToCourse: z.boolean(),
          returnAt: z.string().nullable(),
          fastSwitch: z.boolean(),
        }),
      ),
    }),
  ),
});

export const chromeSyncStatusResponseSchema = z.object({
  items: z.array(chromeSyncRunSchema),
});

export const errorEnvelopeSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});

export type Dataset = z.infer<typeof datasetSchema>;
export type Source = z.infer<typeof sourceSchema>;
export type ImportStatus = z.infer<typeof importStatusSchema>;
export type IntegrationProvider = z.infer<typeof integrationProviderSchema>;
export type SyncRunStatus = z.infer<typeof syncRunStatusSchema>;
export type Range = z.infer<typeof rangeSchema>;
export type Bucket = z.infer<typeof bucketSchema>;
export type GoalPeriod = z.infer<typeof goalPeriodSchema>;
export type GoalMetric = z.infer<typeof goalMetricSchema>;
export type ChromeRange = z.infer<typeof chromeRangeSchema>;
export type ChromeEventReason = z.infer<typeof chromeEventReasonSchema>;
export type ChromeSyncRunStatus = z.infer<typeof chromeSyncRunStatusSchema>;
export type ChromePrivacyMode = z.infer<typeof chromePrivacyModeSchema>;
export type CodingActivityManualInput = z.infer<
  typeof codingActivityManualSchema
>;
export type ListeningHistoryManualInput = z.infer<
  typeof listeningHistoryManualSchema
>;
export type HealthMetricManualInput = z.infer<typeof healthMetricManualSchema>;
export type ImportBatch = z.infer<typeof importBatchSchema>;
export type ImportResult = z.infer<typeof importResultSchema>;
export type SummaryResponse = z.infer<typeof summaryResponseSchema>;
export type CodingActivitySeriesResponse = z.infer<
  typeof codingActivitySeriesResponseSchema
>;
export type ListeningHistorySeriesResponse = z.infer<
  typeof listeningHistorySeriesResponseSchema
>;
export type HealthMetricSeriesResponse = z.infer<
  typeof healthMetricSeriesResponseSchema
>;
export type RecentResponse = z.infer<typeof recentResponseSchema>;
export type ImportsResponse = z.infer<typeof importsResponseSchema>;
export type IntegrationConfig = z.infer<typeof integrationConfigSchema>;
export type IntegrationsResponse = z.infer<typeof integrationsResponseSchema>;
export type SyncRun = z.infer<typeof syncRunSchema>;
export type SyncRunsResponse = z.infer<typeof syncRunsResponseSchema>;
export type ManualSyncResult = z.infer<typeof manualSyncResultSchema>;
export type Goal = z.infer<typeof goalSchema>;
export type GoalsResponse = z.infer<typeof goalsResponseSchema>;
export type GoalProgress = z.infer<typeof goalProgressSchema>;
export type GoalsProgressResponse = z.infer<
  typeof goalsProgressResponseSchema
>;
export type HeatmapResponse = z.infer<typeof heatmapResponseSchema>;
export type CodingStreaksResponse = z.infer<
  typeof codingStreaksResponseSchema
>;
export type ChromeBulkSessionsInput = z.infer<typeof chromeBulkSessionsSchema>;
export type ChromeSyncRun = z.infer<typeof chromeSyncRunSchema>;
export type ChromeBulkIngestResponse = z.infer<
  typeof chromeBulkIngestResponseSchema
>;
export type ChromePrivacyRule = z.infer<typeof chromePrivacyRuleSchema>;
export type ChromeHealthResponse = z.infer<typeof chromeHealthResponseSchema>;
export type ChromeOverviewResponse = z.infer<typeof chromeOverviewResponseSchema>;
export type ChromeSessionRecord = z.infer<typeof chromeSessionRecordSchema>;
export type ChromeSessionsResponse = z.infer<typeof chromeSessionsResponseSchema>;
export type ChromeTimelineResponse = z.infer<typeof chromeTimelineResponseSchema>;
export type ChromeHostsResponse = z.infer<typeof chromeHostsResponseSchema>;
export type ChromeCategoriesResponse = z.infer<
  typeof chromeCategoriesResponseSchema
>;
export type ChromeContextSwitchingResponse = z.infer<
  typeof chromeContextSwitchingResponseSchema
>;
export type ChromeCanvasCourseReport = z.infer<
  typeof chromeCanvasCourseReportSchema
>;
export type ChromeSyncStatusResponse = z.infer<
  typeof chromeSyncStatusResponseSchema
>;
export type ErrorEnvelope = z.infer<typeof errorEnvelopeSchema>;

export const defaultHealthMetricType = "steps";
