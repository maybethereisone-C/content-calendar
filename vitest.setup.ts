import '@testing-library/dom'
// Test env vars: zod schema in lib/env.ts will fail fast otherwise.
process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'https://test.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??= 'test-publishable'
process.env.SUPABASE_SECRET_KEY ??= 'test-secret'
process.env.BUFFER_API_KEY ??= 'test-buffer'
process.env.TELEGRAM_BOT_TOKEN ??= 'test-bot'
process.env.TELEGRAM_GROUP_CHAT_ID ??= '0'
process.env.DASHBOARD_BASE_URL ??= 'http://localhost:3000'
// NODE_ENV is read-only in Node types; vitest sets it to 'test' automatically
