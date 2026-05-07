import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'
import withSerwistInit from '@serwist/next'

const withNextIntl = createNextIntlPlugin('./i18n/request.ts')

const withSerwist = withSerwistInit({
  swSrc: 'app/sw.ts',
  swDest: 'public/sw.js',
  disable: process.env.NODE_ENV === 'development',
})

const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      // Dev seed only (scripts/seed-calendar.ts uses Unsplash sample URLs).
      // Real production posts upload through Supabase Storage and resolve to
      // *.supabase.co. Keeping this in the allow-list is harmless for prod
      // since middleware token-gates the calendar route (T-02-02-05 mitigated:
      // attacker can't choose Unsplash URLs without already controlling
      // post_assets rows server-side).
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
}

export default withNextIntl(withSerwist(nextConfig))
