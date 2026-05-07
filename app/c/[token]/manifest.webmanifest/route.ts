import { NextResponse } from 'next/server'
import { getClientByToken } from '@/lib/supabase/clients'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const client = await getClientByToken(token)
  if (!client) {
    return new NextResponse(null, { status: 404 })
  }

  const manifest = {
    name: 'Content Calendar',
    short_name: 'Content Calendar',
    description: 'ระบบอนุมัติโพสต์โซเชียลมีเดีย',
    display: 'standalone',
    start_url: `/c/${token}/calendar`,
    scope: `/c/${token}/`,
    theme_color: '#2563EB',
    background_color: '#F8F9FA',
    orientation: 'portrait',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }

  return NextResponse.json(manifest, {
    headers: {
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
    },
  })
}
