const MAX_CONFIG_LENGTH = 12000;
const ALLOWED_SCHEMES = new Set([
  "vless:", "vmess:", "trojan:", "ss:", "hysteria2:", "hy2:", "tuic:", "wireguard:", "socks:", "http:"
]);

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=30",
      "x-content-type-options": "nosniff"
    }
  });
}

function isAdmin(env, userId) {
  const allowed = String(env.ADMIN_TELEGRAM_IDS || "")
    .split(",").map((id) => id.trim()).filter(Boolean);
  return allowed.includes(String(userId));
}

function validConfig(value) {
  if (typeof value !== "string") return false;
  const config = value.trim();
  if (!config || config.length > MAX_CONFIG_LENGTH || /[\r\n]/.test(config)) return false;
  const colon = config.indexOf(":");
  if (colon < 1) return false;
  return ALLOWED_SCHEMES.has(config.slice(0, colon + 1).toLowerCase());
}

async function telegram(env, method, payload) {
  if (!env.TELEGRAM_BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  const response = await fetch(
    "https://api.telegram.org/bot" + env.TELEGRAM_BOT_TOKEN + "/" + method,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    }
  );
  if (!response.ok) throw new Error("Telegram API returned " + response.status);
  const result = await response.json();
  if (!result.ok) throw new Error("Telegram API rejected the request");
  return result.result;
}

async function sendMessage(env, chatId, text, replyMarkup) {
  return telegram(env, "sendMessage", {
    chat_id: chatId,
    text,
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    disable_web_page_preview: true
  });
}

function panelKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "➕ افزودن کانفیگ", callback_data: "cfg:add" }],
      [{ text: "📋 فهرست کانفیگ‌ها", callback_data: "cfg:list" }]
    ]
  };
}

async function showConfigs(env, chatId) {
  const { results = [] } = await env.DB.prepare(
    "SELECT id, name, protocol, is_active FROM configs ORDER BY created_at DESC LIMIT 30"
  ).all();
  if (!results.length) {
    await sendMessage(env, chatId, "هنوز کانفیگی ثبت نشده است.", panelKeyboard());
    return;
  }
  for (const item of results) {
    const active = Number(item.is_active) === 1;
    await sendMessage(env, chatId,
      (active ? "🟢 فعال" : "⚪ غیرفعال") + "\n" +
      "#" + item.id + " · " + item.name + " · " + item.protocol,
      {
        inline_keyboard: [[
          { text: active ? "غیرفعال‌کردن" : "فعال‌کردن", callback_data: "cfg:toggle:" + item.id },
          { text: "🗑 حذف", callback_data: "cfg:delete:" + item.id }
        ]]
      }
    );
  }
  await sendMessage(env, chatId, "مدیریت کانفیگ‌ها", panelKeyboard());
}

async function handleCallback(env, callback) {
  const userId = callback.from?.id;
  const chatId = callback.message?.chat?.id;
  const data = String(callback.data || "");
  if (!isAdmin(env, userId)) {
    if (chatId) await sendMessage(env, chatId, "⛔ دسترسی مدیریت برای شما فعال نیست.");
    return;
  }
  await telegram(env, "answerCallbackQuery", { callback_query_id: callback.id });
  if (!chatId) return;

  if (data === "cfg:add") {
    await env.DB.prepare(
      "INSERT INTO admin_sessions (telegram_user_id, action, created_at) VALUES (?, 'add_config', datetime('now')) ON CONFLICT(telegram_user_id) DO UPDATE SET action='add_config', created_at=datetime('now')"
    ).bind(String(userId)).run();
    await sendMessage(env, chatId,
      "اطلاعات را در یک خط بفرست:\nنام | پروتکل | لینک کانفیگ\n\nنمونه:\nسرور آزمایشی | VLESS | vless://...\n\nفقط کانفیگ‌هایی را منتشر کن که اجازهٔ اشتراک‌گذاری آن‌ها را داری. برای لغو /cancel را بفرست."
    );
    return;
  }
  if (data === "cfg:list") {
    await showConfigs(env, chatId);
    return;
  }
  const toggleMatch = data.match(/^cfg:toggle:(\d+)$/);
  if (toggleMatch) {
    await env.DB.prepare(
      "UPDATE configs SET is_active = CASE WHEN is_active = 1 THEN 0 ELSE 1 END, updated_at = datetime('now') WHERE id = ?"
    ).bind(Number(toggleMatch[1])).run();
    await sendMessage(env, chatId, "وضعیت کانفیگ به‌روزرسانی شد.", panelKeyboard());
    return;
  }
  const deleteMatch = data.match(/^cfg:delete:(\d+)$/);
  if (deleteMatch) {
    await env.DB.prepare("DELETE FROM configs WHERE id = ?").bind(Number(deleteMatch[1])).run();
    await sendMessage(env, chatId, "کانفیگ حذف شد.", panelKeyboard());
  }
}

async function handleAdminMessage(env, message) {
  const userId = message.from?.id;
  const chatId = message.chat?.id;
  const text = String(message.text || "").trim();
  if (!chatId || !userId || !text) return;
  if (!isAdmin(env, userId)) {
    if (text === "/panel" || text.startsWith("/panel@")) {
      await sendMessage(env, chatId, "⛔ دسترسی مدیریت برای شما فعال نیست.");
    }
    return;
  }
  if (text === "/start" || text === "/panel" || text.startsWith("/panel@")) {
    await sendMessage(env, chatId, "پنل مدیریت کانفیگ‌های VØRZEX VPN", panelKeyboard());
    return;
  }
  if (text === "/cancel") {
    await env.DB.prepare("DELETE FROM admin_sessions WHERE telegram_user_id = ?").bind(String(userId)).run();
    await sendMessage(env, chatId, "عملیات لغو شد.", panelKeyboard());
    return;
  }
  const session = await env.DB.prepare(
    "SELECT action FROM admin_sessions WHERE telegram_user_id = ?"
  ).bind(String(userId)).first();
  if (!session || session.action !== "add_config") return;

  const parts = text.split("|").map((part) => part.trim());
  if (parts.length !== 3 || !parts[0] || !parts[1] || !validConfig(parts[2])) {
    await sendMessage(env, chatId,
      "قالب یا لینک معتبر نیست. دوباره با قالب «نام | پروتکل | لینک» بفرست یا /cancel را بزن."
    );
    return;
  }
  const [name, protocol, config] = parts;
  if (name.length > 80 || protocol.length > 24) {
    await sendMessage(env, chatId, "نام حداکثر ۸۰ و پروتکل حداکثر ۲۴ نویسه باشد.");
    return;
  }
  await env.DB.prepare(
    "INSERT INTO configs (name, protocol, config, is_active, created_by, created_at, updated_at) VALUES (?, ?, ?, 1, ?, datetime('now'), datetime('now'))"
  ).bind(name, protocol, config, String(userId)).run();
  await env.DB.prepare("DELETE FROM admin_sessions WHERE telegram_user_id = ?").bind(String(userId)).run();
  await sendMessage(env, chatId, "✅ کانفیگ ثبت شد و پس از به‌روزرسانی فهرست در صفحهٔ اصلی برنامه نمایش داده می‌شود.", panelKeyboard());
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/health")) {
      return json({ ok: true, service: "vorzex-config-api", version: "1.0.0" });
    }
    if (request.method === "GET" && url.pathname === "/v1/public/configs") {
      try {
        const { results = [] } = await env.DB.prepare(
          "SELECT id, name, protocol, config, updated_at FROM configs WHERE is_active = 1 ORDER BY created_at DESC LIMIT 100"
        ).all();
        return json({ ok: true, configs: results });
      } catch {
        return json({ ok: false, error: "database_unavailable" }, 503);
      }
    }
    if (request.method === "POST" && url.pathname === "/telegram/webhook") {
      const expected = String(env.TELEGRAM_WEBHOOK_SECRET || "");
      const supplied = request.headers.get("X-Telegram-Bot-Api-Secret-Token") || "";
      if (!expected || supplied !== expected) return json({ ok: false }, 401);
      try {
        const update = await request.json();
        if (update.callback_query) await handleCallback(env, update.callback_query);
        else if (update.message) await handleAdminMessage(env, update.message);
        return json({ ok: true }, 200);
      } catch (error) {
        console.error("Telegram update processing failed:", error?.message || "unknown");
        return json({ ok: false }, 500);
      }
    }
    return json({ ok: false, error: "not_found" }, 404);
  }
};
