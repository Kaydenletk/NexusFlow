import {
  bigserial,
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const importBatches = pgTable("import_batches", {
  id: uuid("id").primaryKey(),
  dataset: text("dataset").notNull(),
  source: text("source").notNull(),
  filename: text("filename"),
  status: text("status").notNull(),
  rowsReceived: integer("rows_received").notNull(),
  rowsInserted: integer("rows_inserted").notNull(),
  rowsSkipped: integer("rows_skipped").notNull(),
  errorSummary: text("error_summary"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const codingActivity = pgTable(
  "coding_activity",
  {
    id: bigserial("id", { mode: "number" }).notNull(),
    time: timestamp("time", { withTimezone: true }).notNull(),
    project: text("project").notNull(),
    language: text("language").notNull(),
    durationSeconds: integer("duration_seconds").notNull(),
    source: text("source").notNull(),
    importBatchId: uuid("import_batch_id").references(() => importBatches.id, {
      onDelete: "set null",
    }),
    dedupeKey: text("dedupe_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.id, table.time] }),
    uniqueIndex("coding_activity_dedupe_time_idx").on(
      table.dedupeKey,
      table.time,
    ),
    index("coding_activity_time_idx").on(table.time),
    index("coding_activity_project_idx").on(table.project),
    index("coding_activity_language_idx").on(table.language),
  ],
);

export const listeningHistory = pgTable(
  "listening_history",
  {
    id: bigserial("id", { mode: "number" }).notNull(),
    time: timestamp("time", { withTimezone: true }).notNull(),
    trackName: text("track_name").notNull(),
    artist: text("artist").notNull(),
    durationMs: integer("duration_ms").notNull(),
    source: text("source").notNull(),
    importBatchId: uuid("import_batch_id").references(() => importBatches.id, {
      onDelete: "set null",
    }),
    dedupeKey: text("dedupe_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.id, table.time] }),
    uniqueIndex("listening_history_dedupe_time_idx").on(
      table.dedupeKey,
      table.time,
    ),
    index("listening_history_time_idx").on(table.time),
    index("listening_history_artist_idx").on(table.artist),
  ],
);

export const healthMetrics = pgTable(
  "health_metrics",
  {
    id: bigserial("id", { mode: "number" }).notNull(),
    time: timestamp("time", { withTimezone: true }).notNull(),
    metricType: text("metric_type").notNull(),
    value: doublePrecision("value").notNull(),
    source: text("source").notNull(),
    importBatchId: uuid("import_batch_id").references(() => importBatches.id, {
      onDelete: "set null",
    }),
    dedupeKey: text("dedupe_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.id, table.time] }),
    uniqueIndex("health_metrics_dedupe_time_idx").on(
      table.dedupeKey,
      table.time,
    ),
    index("health_metrics_time_idx").on(table.time),
    index("health_metrics_metric_type_idx").on(table.metricType),
  ],
);

export const integrationConfigs = pgTable(
  "integration_configs",
  {
    provider: text("provider").primaryKey(),
    enabled: boolean("enabled").notNull().default(false),
    credentialsJson: jsonb("credentials_json").$type<Record<string, unknown>>().notNull(),
    syncCursor: timestamp("sync_cursor", { withTimezone: true }),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("integration_configs_provider_idx").on(table.provider)],
);

export const syncRuns = pgTable(
  "sync_runs",
  {
    id: uuid("id").primaryKey(),
    provider: text("provider")
      .notNull()
      .references(() => integrationConfigs.provider, {
        onDelete: "cascade",
      }),
    status: text("status").notNull(),
    importBatchId: uuid("import_batch_id").references(() => importBatches.id, {
      onDelete: "set null",
    }),
    rowsFetched: integer("rows_fetched").notNull().default(0),
    rowsInserted: integer("rows_inserted").notNull().default(0),
    errorMessage: text("error_message"),
    startedAt: timestamp("started_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("sync_runs_provider_created_at_idx").on(
      table.provider,
      table.createdAt,
    ),
  ],
);

export const goals = pgTable(
  "goals",
  {
    id: uuid("id").primaryKey(),
    dataset: text("dataset").notNull(),
    metric: text("metric").notNull(),
    targetValue: doublePrecision("target_value").notNull(),
    period: text("period").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("goals_dataset_metric_idx").on(table.dataset, table.metric)],
);

export type ImportBatchRow = typeof importBatches.$inferSelect;
export type CodingActivityRow = typeof codingActivity.$inferSelect;
export type CodingActivityInsert = typeof codingActivity.$inferInsert;
export type ListeningHistoryRow = typeof listeningHistory.$inferSelect;
export type ListeningHistoryInsert = typeof listeningHistory.$inferInsert;
export type HealthMetricRow = typeof healthMetrics.$inferSelect;
export type HealthMetricInsert = typeof healthMetrics.$inferInsert;
export type IntegrationConfigRow = typeof integrationConfigs.$inferSelect;
export type IntegrationConfigInsert = typeof integrationConfigs.$inferInsert;
export type SyncRunRow = typeof syncRuns.$inferSelect;
export type SyncRunInsert = typeof syncRuns.$inferInsert;
export type GoalRow = typeof goals.$inferSelect;
export type GoalInsert = typeof goals.$inferInsert;
