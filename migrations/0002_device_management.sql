-- Additive VØRZEX device-management tables. Existing users/configs/events are untouched.
CREATE TABLE IF NOT EXISTS device_reports (
  installation_row_id TEXT PRIMARY KEY,
  device_code TEXT NOT NULL DEFAULT '',
  device_name TEXT NOT NULL,
  android_version TEXT NOT NULL,
  local_ips TEXT NOT NULL DEFAULT '',
  reported_at TEXT NOT NULL,
  FOREIGN KEY (installation_row_id) REFERENCES installations(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_device_reports_reported_at
  ON device_reports (reported_at DESC);

CREATE TABLE IF NOT EXISTS remote_commands (
  id TEXT PRIMARY KEY,
  installation_row_id TEXT NOT NULL,
  command_type TEXT NOT NULL CHECK (command_type IN ('disconnect', 'clear_cache')),
  message TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'acknowledged', 'failed')),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  delivered_at TEXT,
  acknowledged_at TEXT,
  FOREIGN KEY (installation_row_id) REFERENCES installations(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_remote_commands_pending
  ON remote_commands (installation_row_id, status, created_at);
