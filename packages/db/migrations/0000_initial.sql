CREATE EXTENSION IF NOT EXISTS timescaledb;

CREATE TABLE IF NOT EXISTS import_batches (
  id UUID PRIMARY KEY,
  dataset TEXT NOT NULL,
  source TEXT NOT NULL,
  filename TEXT NULL,
  status TEXT NOT NULL,
  rows_received INT NOT NULL,
  rows_inserted INT NOT NULL,
  rows_skipped INT NOT NULL,
  error_summary TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT import_batches_dataset_check
    CHECK (dataset IN ('coding_activity', 'listening_history', 'health_metrics')),
  CONSTRAINT import_batches_source_check
    CHECK (source IN ('manual', 'csv')),
  CONSTRAINT import_batches_status_check
    CHECK (status IN ('completed', 'failed'))
);

CREATE TABLE IF NOT EXISTS coding_activity (
  id BIGSERIAL NOT NULL,
  time TIMESTAMPTZ NOT NULL,
  project TEXT NOT NULL,
  language TEXT NOT NULL,
  duration_seconds INT NOT NULL CHECK (duration_seconds > 0),
  source TEXT NOT NULL CHECK (source IN ('manual', 'csv')),
  import_batch_id UUID NULL REFERENCES import_batches(id) ON DELETE SET NULL,
  dedupe_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, time),
  UNIQUE (dedupe_key, time)
);

CREATE INDEX IF NOT EXISTS coding_activity_time_idx ON coding_activity (time DESC);
CREATE INDEX IF NOT EXISTS coding_activity_project_idx ON coding_activity (project);
CREATE INDEX IF NOT EXISTS coding_activity_language_idx ON coding_activity (language);

CREATE TABLE IF NOT EXISTS listening_history (
  id BIGSERIAL NOT NULL,
  time TIMESTAMPTZ NOT NULL,
  track_name TEXT NOT NULL,
  artist TEXT NOT NULL,
  duration_ms INT NOT NULL CHECK (duration_ms > 0),
  source TEXT NOT NULL CHECK (source IN ('manual', 'csv')),
  import_batch_id UUID NULL REFERENCES import_batches(id) ON DELETE SET NULL,
  dedupe_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, time),
  UNIQUE (dedupe_key, time)
);

CREATE INDEX IF NOT EXISTS listening_history_time_idx ON listening_history (time DESC);
CREATE INDEX IF NOT EXISTS listening_history_artist_idx ON listening_history (artist);

CREATE TABLE IF NOT EXISTS health_metrics (
  id BIGSERIAL NOT NULL,
  time TIMESTAMPTZ NOT NULL,
  metric_type TEXT NOT NULL,
  value DOUBLE PRECISION NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('manual', 'csv')),
  import_batch_id UUID NULL REFERENCES import_batches(id) ON DELETE SET NULL,
  dedupe_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, time),
  UNIQUE (dedupe_key, time)
);

CREATE INDEX IF NOT EXISTS health_metrics_time_idx ON health_metrics (time DESC);
CREATE INDEX IF NOT EXISTS health_metrics_metric_type_idx ON health_metrics (metric_type);

SELECT create_hypertable(
  'coding_activity',
  'time',
  chunk_time_interval => INTERVAL '7 days',
  if_not_exists => TRUE
);

SELECT create_hypertable(
  'listening_history',
  'time',
  chunk_time_interval => INTERVAL '7 days',
  if_not_exists => TRUE
);

SELECT create_hypertable(
  'health_metrics',
  'time',
  chunk_time_interval => INTERVAL '7 days',
  if_not_exists => TRUE
);

CREATE MATERIALIZED VIEW IF NOT EXISTS coding_activity_daily
WITH (timescaledb.continuous) AS
SELECT
  time_bucket(INTERVAL '1 day', time, timezone => 'America/New_York') AS bucket,
  project,
  language,
  COUNT(*)::INT AS session_count,
  SUM(duration_seconds)::BIGINT AS total_duration_seconds
FROM coding_activity
GROUP BY bucket, project, language
WITH NO DATA;

CREATE MATERIALIZED VIEW IF NOT EXISTS listening_history_daily
WITH (timescaledb.continuous) AS
SELECT
  time_bucket(INTERVAL '1 day', time, timezone => 'America/New_York') AS bucket,
  artist,
  COUNT(*)::INT AS play_count,
  SUM(duration_ms)::BIGINT AS total_duration_ms
FROM listening_history
GROUP BY bucket, artist
WITH NO DATA;

CREATE MATERIALIZED VIEW IF NOT EXISTS health_metrics_daily
WITH (timescaledb.continuous) AS
SELECT
  time_bucket(INTERVAL '1 day', time, timezone => 'America/New_York') AS bucket,
  metric_type,
  COUNT(*)::INT AS entry_count,
  AVG(value)::DOUBLE PRECISION AS average_value,
  SUM(value)::DOUBLE PRECISION AS total_value,
  MIN(value)::DOUBLE PRECISION AS min_value,
  MAX(value)::DOUBLE PRECISION AS max_value
FROM health_metrics
GROUP BY bucket, metric_type
WITH NO DATA;

SELECT add_continuous_aggregate_policy(
  'coding_activity_daily',
  start_offset => INTERVAL '90 days',
  end_offset => INTERVAL '1 hour',
  schedule_interval => INTERVAL '15 minutes',
  if_not_exists => TRUE
);

SELECT add_continuous_aggregate_policy(
  'listening_history_daily',
  start_offset => INTERVAL '90 days',
  end_offset => INTERVAL '1 hour',
  schedule_interval => INTERVAL '15 minutes',
  if_not_exists => TRUE
);

SELECT add_continuous_aggregate_policy(
  'health_metrics_daily',
  start_offset => INTERVAL '90 days',
  end_offset => INTERVAL '1 hour',
  schedule_interval => INTERVAL '15 minutes',
  if_not_exists => TRUE
);
