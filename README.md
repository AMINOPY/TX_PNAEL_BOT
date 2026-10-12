# VØRZEX Config API

Cloudflare Worker + D1 API and Telegram webhook for publishing VPN configurations from an administrator-only Telegram panel.

## Current deployment

- Worker: \`tx-pnael-bot\`
- D1 database: \`vorzex\`
- Public app API: \`https://tx-pnael-bot.aminghm-939.workers.dev\`

The config tables are additive to the existing D1 database. Existing user, installation, access-policy, event, and audit data are not dropped or rewritten.

## API

- \`GET /health\` and \`GET /healthz\` — health check.
- \`GET /v1/public/configs\` — active published entries: \`{ ok, configs: [{ id, name, protocol, config, updated_at }] }\`.
- \`GET /v1/admin/configs\` — list all configs (admin authentication required).
- \`POST /v1/admin/configs\` — add a config (admin authentication required).
- \`PUT /v1/admin/configs/:id\` — edit or activate/deactivate a config (admin authentication required).
- \`DELETE /v1/admin/configs/:id\` — delete a config (admin authentication required).
- \`POST /telegram/webhook\` — Telegram inline-button panel; requires the Telegram secret header.

Admin API accepts the existing \`x-admin-token\` header or the configured Telegram-admin token and allowlisted numeric user ID headers. Never put admin tokens in the Android APK or public source.

## Telegram panel setup

The webhook code is deployed, but it will not accept updates until these Worker secrets are configured:

1. \`TELEGRAM_BOT_TOKEN\` — bot token, added only in Cloudflare Worker secrets.
2. \`TELEGRAM_WEBHOOK_SECRET\` — a long random value.
3. \`TELEGRAM_ADMIN_IDS\` — comma-separated numeric Telegram user IDs allowed to manage configs.

Then set the bot webhook to \`https://tx-pnael-bot.aminghm-939.workers.dev/telegram/webhook\` with the same secret as Telegram's \`secret_token\`. Do not send bot tokens in chat or commit them to GitHub.

In Telegram, send \`/panel\` from an allowlisted admin account. The panel can add, list, activate/deactivate, and delete configs. To add one, use the single-line format \`Name | Protocol | vless://...\`.

Accepted URI schemes: VLESS, VMess, Trojan, Shadowsocks, Hysteria2, HY2, TUIC, WireGuard, SOCKS and HTTP. Only publish configurations you are authorized to share. Public configs may be unreliable and can be withdrawn at any time.

## D1 / Wrangler

The repository's \`wrangler.toml\` references the existing \`vorzex\` database ID. Existing Worker secrets are managed in Cloudflare and are not stored in Git. The \`migrations/0001_configs.sql\` migration creates only the two new config-panel tables and can be safely re-applied because it uses \`IF NOT EXISTS\`.

## Privacy

The public feed returns only configs explicitly activated by an administrator. Device reports are sent only after the user confirms the action inside the Device screen. The report contains the displayed 12-digit device code, device model, Android version, and local IPv4 addresses; API registration also stores an opaque high-entropy installation key and app version for authenticated remote commands. The Worker receives ordinary network metadata, including the public source IP, for each request, but connection events and public-IP observations are persisted only after an installation has submitted its device report following the in-app consent step. The app does not send VPN profiles, subscription URLs, private keys, browsing history, or traffic contents. Remote commands are limited to disconnecting the active VPN service and clearing temporary app cache; clearing cache does not remove saved VPN profiles or settings.


## Device management and remote controls

- `POST /v1/device/report` — authenticated report submitted only after a user confirms from the Android Device screen. The report contains the displayed device code, model, Android version, and local IPv4 addresses.
- `GET /v1/admin/devices` — admin-only device list.
- `POST /v1/admin/commands` — queue a disconnect for one 12-digit device code or all opted-in devices.
- `POST /v1/admin/cache/clear` — clear known Worker edge-cache keys and queue cleanup of temporary app cache for opted-in devices.
- `GET /v1/client/commands` and `POST /v1/client/commands/:id/ack` — authenticated command polling and acknowledgement.
- `GET /v1/client/access-status` — access policy for an opted-in installation.

The Telegram `/panel` includes device listing, disconnect, per-device access block/allow, and cache cleanup. Remote disconnect and cache cleanup are delivered when the app's VPN service is running and can reach the API. Android posts a user-visible notification when a remote disconnect or cache cleanup is applied. The app does not upload VPN profiles, subscription URLs, private keys, browsing history, or traffic payloads. Admin credentials must remain in Worker secrets; never embed them in the APK.

## Telegram device administration additions

The `feature/telegram-device-admin` branch adds the following additive behavior:

- Search an existing user UUID, installation UUID, or the existing 12-digit device code. Identifiers are lookup keys and are never rewritten.
- For devices that explicitly submitted the in-app device report, show device model, Android version, app version, access policy, last recorded VPN connection event, approximate online/VPN state, and the public source IP observed on the most recent consented device report.
- Device listing includes the recorded public IP when available.
- The Telegram panel includes read-only API/D1 diagnostics and a safe maintenance action that only clears targeted Worker edge-cache keys. It does not delete D1 records, saved VPN profiles, or settings.
- Migration `0002_device_network_observations.sql` creates a new table only. It does not alter or delete existing rows.

### Telemetry limits and consent

Device details and the public IP are displayed only for installations that have opted in and submitted a device report. The public IP is the source IP observed by Cloudflare for that request; it may change and is not GPS location. VPN status and last connection time are approximate and depend on the app successfully reporting `vpn_connected`, `vpn_disconnected`, or heartbeat events. An offline device cannot receive a queued remote command until it reconnects to the API. Blocking access takes effect when the client next checks its access policy; an already-running tunnel can only be disconnected when the app's running service receives and applies the remote command. Telegram notifications and Android system notifications depend on the app implementation and OS notification permissions.

The safe-maintenance button is intentionally conservative: it does not pretend to repair arbitrary source-code defects or modify production infrastructure automatically. Use the diagnostic output and runtime logs to identify a specific repair before changing code or database structure.
