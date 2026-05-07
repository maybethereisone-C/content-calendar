import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist'
import { Serwist, NetworkFirst, CacheFirst, ExpirationPlugin } from 'serwist'

declare global {
  interface ServiceWorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined
  }
}

declare const self: ServiceWorkerGlobalScope

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      matcher: ({ url }) => /^\/c\/[^/]+\/calendar/.test(url.pathname),
      handler: new NetworkFirst({
        cacheName: 'calendar-pages',
        networkTimeoutSeconds: 3,
        plugins: [new ExpirationPlugin({ maxAgeSeconds: 86400 })],
      }),
    },
    {
      matcher: ({ url }) =>
        url.hostname.endsWith('.supabase.co') &&
        url.pathname.startsWith('/storage/v1/object/public/'),
      handler: new CacheFirst({
        cacheName: 'post-media',
        plugins: [
          new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 7 * 86400 }),
        ],
      }),
    },
  ],
})

serwist.addEventListeners()
