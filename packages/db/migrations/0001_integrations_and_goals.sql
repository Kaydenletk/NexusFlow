ALTER TABLE import_batches
  DROP CONSTRAINT IF EXISTS import_batches_source_check;

ALTER TABLE import_batches
  ADD CONSTRAINT import_batches_source_check
  CHECK (source IN ('manual', 'csv', 'wakatime', 'spotify', 'apple_health', 'ai'));

ALTER TABLE coding_activity
  DROP CONSTRAINT IF EXISTS coding_activity_source_check;

ALTER TABLE coding_activity
  ADD CONSTRAINT coding_activity_source_check
  CHECK (source IN ('manual', 'csv', 'wakatime', 'spotify', 'apple_health', 'ai'));

ALTER TABLE listening_history
  DROP CONSTRAINT IF EXISTS listening_history_source_check;

ALTER TABLE listening_history
  ADD CONSTRAINT listening_history_source_check
  CHECK (source IN ('manual', 'csv', 'wakatime', 'spotify', 'apple_health', 'ai'));

ALTER TABLE health_metrics
  DROP CONSTRAINT IF EXISTS health_metrics_source_check;

ALTER TABLE health_metrics
  ADD CONSTRAINT health_metrics_source_check
  CHECK (source IN ('manual', 'csv', 'wakatime', 'spotify', 'apple_health', 'ai'));

CREATE TABLE IF NOT EXISTS integration_configs (
  provider TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  credentials_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  sync_cursor TIMESTAMPTZ NULL,
  last_synced_at TIMESTAMPTZ NULL,
  last_error TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS goals (
  id UUID PRIMARY KEY,
  dataset TEXT NOT NULL,
  metric TEXT NOT NULL,
  target_value DOUBLE PRECISION NOT NULL CHECK (target_value > 0),
  period TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT goals_dataset_check
    CHECK (dataset IN ('coding_activity', 'listening_history', 'health_metrics')),
  CONSTRAINT goals_period_check
    CHECK (period IN ('day', 'week'))
);

CREATE TABLE IF NOT EXISTS sync_runs (
  id UUID PRIMARY KEY,
  provider TEXT NOT NULL REFERENCES integration_configs(provider) ON DELETE CASCADE,
  status TEXT NOT NULL,
  import_batch_id UUID NULL REFERENCES import_batches(id) ON DELETE SET NULL,
  rows_fetched INT NOT NULL DEFAULT 0,
  rows_inserted INT NOT NULL DEFAULT 0,
  error_message TEXT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT sync_runs_status_check
    CHECK (status IN ('running', 'completed', 'failed'))
);

CREATE INDEX IF NOT EXISTS integration_configs_provider_idx
  ON integration_configs (provider);

CREATE INDEX IF NOT EXISTS sync_runs_provider_created_at_idx
  ON sync_runs (provider, created_at DESC);

CREATE INDEX IF NOT EXISTS goals_dataset_metric_idx
  ON goals (dataset, metric);
