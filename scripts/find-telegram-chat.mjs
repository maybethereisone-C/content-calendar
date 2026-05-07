#!/usr/bin/env node
// app/scripts/find-telegram-chat.mjs
//
// Calls Telegram's getUpdates to find recent chats the bot has seen.
// Use this once after creating the bot + adding it to the group, to discover
// the chat_id (and message_thread_id if it's a forum supergroup with topics).
//
// PREREQUISITES:
//   1. The bot must be a MEMBER of the group.
//   2. For non-admin bots, "privacy mode" is ON by default — the bot only sees
//      messages addressed to it (mentions, replies, commands). To see EVERY
//      message, either: (a) make the bot a group admin, OR (b) message
//      @BotFather, /setprivacy, pick the bot, choose "Disable".
//   3. Send at least one message in the group AFTER adding the bot.
//   4. The bot must NOT have a webhook set (webhooks consume updates).
//      If you've previously set one, run: node scripts/find-telegram-chat.mjs --reset-webhook
//
// Usage:
//   npm run telegram:find-chat
//
// Or directly:
//   node --env-file=.env.local scripts/find-telegram-chat.mjs

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error('FAIL: Missing TELEGRAM_BOT_TOKEN in .env.local');
  process.exit(1);
}

const args = process.argv.slice(2);

// --reset-webhook flag: clear webhook so getUpdates works
if (args.includes('--reset-webhook')) {
  const r = await fetch(`https://api.telegram.org/bot${token}/deleteWebhook`).then((r) => r.json());
  console.log(r.ok ? '✓ Webhook cleared' : `✗ deleteWebhook failed: ${JSON.stringify(r)}`);
  process.exit(r.ok ? 0 : 1);
}

// Verify token + show bot identity
const me = await fetch(`https://api.telegram.org/bot${token}/getMe`).then((r) => r.json());
if (!me.ok) {
  console.error('FAIL: Bot token rejected by Telegram:', me.description);
  process.exit(1);
}
console.log(`✓ Bot: @${me.result.username} (${me.result.first_name})`);
console.log('');

// getUpdates
const updates = await fetch(`https://api.telegram.org/bot${token}/getUpdates`).then((r) => r.json());
if (!updates.ok) {
  console.error('FAIL: getUpdates rejected:', updates.description);
  if (updates.error_code === 409) {
    console.error('  → A webhook is set on this bot. Run with --reset-webhook to clear it.');
  }
  process.exit(1);
}

if (updates.result.length === 0) {
  console.log('No updates.');
  console.log('');
  console.log('Possible reasons:');
  console.log('  • Bot privacy mode is ON (default). It only sees @mentions / replies / commands.');
  console.log('    → Talk to @BotFather → /setprivacy → pick the bot → "Disable".');
  console.log('  • OR make the bot an admin of the group (admins always see all messages).');
  console.log('  • Then send a NEW message in the group and re-run this script.');
  console.log('  • A previous getUpdates already consumed the buffer — send another test message.');
  process.exit(0);
}

// Group by unique chat
const chats = new Map();
for (const u of updates.result) {
  const msg = u.message ?? u.edited_message ?? u.channel_post ?? u.edited_channel_post;
  if (!msg) continue;
  const key = msg.chat.id;
  if (!chats.has(key)) {
    chats.set(key, {
      id: msg.chat.id,
      type: msg.chat.type,
      title: msg.chat.title ?? msg.chat.username ?? msg.chat.first_name ?? '(unnamed)',
      isForum: !!msg.chat.is_forum,
      threads: new Map(),
      sample: msg.text ?? msg.caption ?? '(non-text message)',
    });
  }
  const chat = chats.get(key);
  if (msg.message_thread_id) {
    if (!chat.threads.has(msg.message_thread_id)) {
      chat.threads.set(msg.message_thread_id, {
        id: msg.message_thread_id,
        sample: msg.text ?? msg.caption ?? '(non-text)',
      });
    }
  }
}

console.log(`Found ${chats.size} chat(s):\n`);
for (const c of chats.values()) {
  console.log(`  ${c.type.toUpperCase()} — "${c.title}"`);
  console.log(`    chat_id: ${c.id}`);
  if (c.isForum) console.log('    forum:   yes (uses topics)');
  console.log(`    sample:  ${JSON.stringify(c.sample.slice(0, 60))}`);
  if (c.threads.size > 0) {
    console.log('    topics seen:');
    for (const t of c.threads.values()) {
      console.log(`      message_thread_id: ${t.id}  — ${JSON.stringify(t.sample.slice(0, 60))}`);
    }
  } else if (c.isForum) {
    console.log('    (no message_thread_id seen — message was in General topic, or topic ID not exposed in this update)');
  }
  console.log('');
}

console.log('Next: copy the chat_id you want into .env.local as TELEGRAM_GROUP_CHAT_ID.');
console.log('For supergroup topic IDs, see references/telegram-bot-api.md (open Telegram → copy link to topic → t.me/c/<chat>/<topic>).');
