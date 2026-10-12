-- Additive, consent-gated network metadata for devices that explicitly submit a device report.
-- No existing user, installation, event, policy, token, or configuration rows are deleted.
CREATE TABLE IF NOT EXISTS device_network_observations (
  installation_row_id TEXT PRIMARY KEY,
  public_ip TEXT,
  last_seen_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_device_network_last_seen
  ON device_network_observations(last_seen_at DESC);
