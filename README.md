# VØRZEX Config API

Cloudflare Worker + D1 API and Telegram bot webhook for publishing VPN configurations from an administrator-only Telegram panel.

## API

- \`GET /health\` — health check, no device data required.
- \`GET /v1/public/configs\` — returns active published entries as \`{ ok, configs: [{ id, name, protocol, config, updated_at }] }\`.
- \`POST /telegram/webhook\` — Telegram webhook; requires the configured Telegram secret header.

The public endpoint returns only active entries. It does not collect device IDs, app versions, IPs, connection history, or VPN traffic.

## Deploy

1. Create a Cloudflare D1 database named \`vorzex-configs\`.
2. Put its actual database ID into \`wrangler.toml\`; never use the placeholder value for deployment.
3. Install Wrangler and authenticate with Cloudflare.
4. Run \`npx wrangler d1 migrations apply vorzex-configs --remote\`.
5. Set Worker secrets:
   - \`npx wrangler secret put TELEGRAM_BOT_TOKEN\`
   - \`npx wrangler secret put TELEGRAM_WEBHOOK_SECRET\` (use a long random value)
   - \`npx wrangler secret put ADMIN_TELEGRAM_IDS\` (comma-separated numeric Telegram user IDs allowed to administer configs)
6. Deploy with \`npx wrangler deploy\`.
7. Set the Telegram webhook using your bot token and deployed Worker URL, substituting the same secret:
   \`https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<WORKER_HOST>/telegram/webhook&secret_token=<URL_ENCODED_SECRET>\`
8. In Telegram, send \`/panel\` to the bot from an allowlisted admin account.

## Telegram admin panel

- Add config: tap **افزودن کانفیگ** and send one line: \`Name | Protocol | vless://...\`
- List configs: tap **فهرست کانفیگ‌ها**.
- Activate/deactivate or delete entries from their inline buttons.
- \`/cancel\` cancels an in-progress add operation.

Accepted single-line URI schemes: VLESS, VMess, Trojan, Shadowsocks, Hysteria2, HY2, TUIC, WireGuard, SOCKS and HTTP. Only publish configurations you are authorized to share. Public configs may be unreliable and can be withdrawn at any time.

## Security notes

- Keep the bot token and webhook secret in Worker secrets, not Git.
- Use numeric Telegram user IDs in \`ADMIN_TELEGRAM_IDS\`, not usernames.
- A newly created D1 database is empty until migrations are applied.
- The API code being committed does not deploy the Worker or set secrets/webhook automatically.
