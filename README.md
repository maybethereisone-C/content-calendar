# Content Calendar / ตารางคอนเทนต์

Mobile-first PWA for content approval and social-media scheduling. Built for Thai-market SMB owners running a "concierge content" service — clients open the dashboard on their phone, approve a month of posts with one tap each.

**Live:** https://dashboard.omnicai.online

## Stack

- **Framework:** Next.js 15.5 (App Router, RSC, standalone output) + React 19 + TypeScript
- **UI:** Tailwind CSS v4 (CSS-variable theme layer) + shadcn/ui + lucide-react
- **PWA:** Serwist 9 service worker, A2HS overlay (iOS Safari), per-token web manifest
- **i18n:** next-intl, EN ↔ TH runtime toggle (cookie + Server Action)
- **Backend:** Supabase (Postgres + Storage), token-gated `/c/[token]/*` routes via Node-runtime middleware
- **Logging:** pino structured JSON, 4-char token prefix redaction (LOG-02)
- **Tests:** Vitest (unit) + Playwright + axe-core (a11y / WCAG AA)

## Deploy

This app runs on a self-hosted Contabo VPS. **Vercel is not used and is not supported** for this project — the stack assumes Node-runtime middleware, persistent service worker storage, server-side image processing, and a long-running Supabase keep-alive cron, none of which fit Vercel's serverless model cleanly.

The production deploy uses:

- **Reverse proxy + auto-TLS:** Caddy 2 (Let's Encrypt)
- **Process manager:** PM2 (fork mode, systemd-enabled for boot persistence)
- **Build pattern:** Pattern A — `npm ci && next build` runs on the VPS itself, then PM2 reloads the standalone server zero-downtime
- **Keep-alive:** daily cron pinging `/healthz` to prevent free-tier Supabase pause

Deploy scripts and Caddyfile snapshot live in the private planning repo (`/scripts`).

## Local development

```bash
# Install deps (uses the lockfile)
npm ci

# Run the dev server (NODE_ENV=development)
npm run dev
# → open http://localhost:3000/c/<TEST_TOKEN>/calendar
```

You'll need a `.env.local` with valid Supabase keys and a 32-char `TEST_TOKEN` matching a row in the `clients.secret_url_token` column. See `.env.example` for the full list.

## Scripts

```bash
npm run dev             # next dev
npm run build           # next build (production)
npm run lint            # next lint
npm run typecheck       # tsc --noEmit
npm run test            # vitest run --passWithNoTests
npm run test:watch      # vitest
npm run test:e2e        # playwright test (axe-core a11y suite)
npm run db:seed         # node scripts/db-seed.mjs (Supabase seed)
npm run telegram:find-chat   # discover Telegram chat IDs via getUpdates
npm run generate:a2hs        # regenerate A2HS placeholder images
```

## Conventions

- Token-gated routes live under `/c/[token]/*` and are protected by `middleware.ts` (Node runtime).
- Bad tokens return a **byte-identical 404** with no body — no info leak (ACCESS-04).
- `BUFFER_CLIENT=mock` and `TELEGRAM_CLIENT=mock` are valid only in development; production refuses to boot with mock clients (OPS-05).
- The dashboard surface is **client-only**; an operator dashboard at `admin.omnicai.online` is reserved for v1.1.

## License

UNLICENSED — private project, all rights reserved.
