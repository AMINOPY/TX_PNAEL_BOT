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

The public feed returns only configs explicitly activated by an administrator. It does not request or store device IDs, app versions, IP addresses, connection history, or VPN traffic. The Android app only fetches the public feed; device details remain local to the Device screen.
