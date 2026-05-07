import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Content Calendar',
    short_name: 'Content Calendar',
    description: 'ระบบอนุมัติโพสต์โซเชียลมีเดีย',
    display: 'standalone',
    start_url: '/',
    scope: '/',
    theme_color: '#2563EB', // Light accent — always static; not runtime-switched (D-17)
    background_color: '#F8F9FA', // Light --bg
    orientation: 'portrait',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
