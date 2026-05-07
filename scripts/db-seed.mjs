#!/usr/bin/env node
// app/scripts/db-seed.mjs
//
// Seeds the Thai Sea client row into Supabase. Idempotent — safe to re-run.
// Replaces the psql-based seed.sql workflow (psql isn't installed on stock macOS).
//
// Usage (from app/):
//   npm run db:seed
//
// Or directly:
//   node --env-file=.env.local scripts/db-seed.mjs

import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
const token = process.env.TEST_TOKEN;

if (!url || !key) {
  console.error('FAIL: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local');
  process.exit(1);
}
if (url.endsWith('/rest/v1/') || url.endsWith('/rest/v1')) {
  console.error('FAIL: NEXT_PUBLIC_SUPABASE_URL has /rest/v1/ appended. Use the bare URL — the SDK adds /rest/v1 automatically.');
  console.error('       Should look like: https://<project-ref>.supabase.co');
  process.exit(1);
}
if (!token || token.length !== 32) {
  console.error(`FAIL: Missing or invalid TEST_TOKEN (must be 32 chars, got ${token?.length ?? 0})`);
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

console.log('→ Upserting Thai Sea client...');
const { error: insertError } = await supabase
  .from('clients')
  .upsert(
    {
      slug: 'thai-sea',
      name: 'Thai Sea Restaurant',
      secret_url_token: token,
    },
    { onConflict: 'slug', ignoreDuplicates: true }
  );

if (insertError) {
  console.error('FAIL on upsert:', insertError.message);
  if (insertError.details) console.error('  details:', insertError.details);
  if (insertError.hint) console.error('  hint:', insertError.hint);
  process.exit(1);
}

const { data, error: selectError } = await supabase
  .from('clients')
  .select('slug, name, secret_url_token, created_at')
  .eq('slug', 'thai-sea')
  .single();

if (selectError) {
  console.error('FAIL on verify select:', selectError.message);
  process.exit(1);
}

console.log('✓ Thai Sea client seeded:');
console.log(`  slug:        ${data.slug}`);
console.log(`  name:        ${data.name}`);
console.log(`  token len:   ${data.secret_url_token.length} (expected 32)`);
console.log(`  created at:  ${data.created_at}`);
console.log('');
console.log(`Test URL (local):  http://localhost:3000/c/${data.secret_url_token}/calendar`);
console.log(`Test URL (prod):   https://dashboard.omnicai.online/c/${data.secret_url_token}/calendar`);
