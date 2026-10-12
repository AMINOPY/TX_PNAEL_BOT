CREATE TABLE IF NOT EXISTS published_configs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  protocol TEXT NOT NULL,
  config TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_published_configs_active_created
  ON published_configs (is_active, created_at DESC);
CREATE TABLE IF NOT EXISTS telegram_admin_sessions (
  telegram_user_id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  created_at TEXT NOT NULL
);