CREATE TABLE IF NOT EXISTS chrome_sync_runs (
  id UUID PRIMARY KEY,
  status TEXT NOT NULL,
  rows_received INT NOT NULL DEFAULT 0,
  rows_inserted INT NOT NULL DEFAULT 0,
  error_message TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ NULL,
  CONSTRAINT chrome_sync_runs_status_check
    CHECK (status IN ('completed', 'failed'))
);

CREATE TABLE IF NOT EXISTS chrome_privacy_rules (
  id UUID PRIMARY KEY,
  hostname_pattern TEXT NOT NULL,
  mask_mode TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  description TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chrome_privacy_rules_mask_mode_check
    CHECK (mask_mode IN ('allow', 'mask'))
);

CREATE UNIQUE INDEX IF NOT EXISTS chrome_privacy_rules_hostname_pattern_idx
  ON chrome_privacy_rules (hostname_pattern);

CREATE TABLE IF NOT EXISTS chrome_sessions (
  id TEXT PRIMARY KEY,
  tab_id INT NULL,
  window_id INT NULL,
  origin TEXT NOT NULL,
  path TEXT NOT NULL,
  hostname TEXT NOT NULL,
  document_title TEXT NULL,
  category TEXT NOT NULL,
  intent TEXT NOT NULL,
  event_reason TEXT NOT NULL,
  is_path_masked BOOLEAN NOT NULL DEFAULT FALSE,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  duration_seconds INT NOT NULL CHECK (duration_seconds > 0),
  source TEXT NOT NULL DEFAULT 'chrome_extension',
  sync_run_id UUID NULL REFERENCES chrome_sync_runs(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS chrome_sessions_start_time_idx
  ON chrome_sessions (start_time DESC);

CREATE INDEX IF NOT EXISTS chrome_sessions_hostname_idx
  ON chrome_sessions (hostname);

CREATE INDEX IF NOT EXISTS chrome_sessions_category_idx
  ON chrome_sessions (category);

CREATE INDEX IF NOT EXISTS chrome_sessions_intent_idx
  ON chrome_sessions (intent);

CREATE INDEX IF NOT EXISTS chrome_sessions_sync_run_idx
  ON chrome_sessions (sync_run_id);

INSERT INTO chrome_privacy_rules (id, hostname_pattern, mask_mode, enabled, description)
VALUES
  ('00000000-0000-0000-0000-000000000201', 'mail.google.com', 'mask', TRUE, 'Mask Gmail paths'),
  ('00000000-0000-0000-0000-000000000202', 'accounts.google.com', 'mask', TRUE, 'Mask auth pages'),
  ('00000000-0000-0000-0000-000000000203', 'drive.google.com', 'mask', TRUE, 'Mask Drive paths'),
  ('00000000-0000-0000-0000-000000000204', 'docs.google.com', 'mask', TRUE, 'Mask Google Docs paths'),
  ('00000000-0000-0000-0000-000000000205', 'calendar.google.com', 'mask', TRUE, 'Mask calendar paths'),
  ('00000000-0000-0000-0000-000000000206', 'localhost', 'mask', TRUE, 'Mask localhost paths'),
  ('00000000-0000-0000-0000-000000000207', 'github.com', 'allow', TRUE, 'Allow GitHub paths'),
  ('00000000-0000-0000-0000-000000000208', 'canvas.instructure.com', 'allow', TRUE, 'Allow Canvas paths')
ON CONFLICT (hostname_pattern) DO NOTHING;
