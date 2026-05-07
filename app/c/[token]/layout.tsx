import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getClientByToken } from '@/lib/supabase/clients'
import { AppBar } from '@/app/_components/app-bar'
import { OfflineToast } from '@/app/_components/offline-toast'
import { A2HSOverlay } from '@/app/_components/a2hs-overlay'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>
}): Promise<Metadata> {
  const { token } = await params
  return {
    manifest: `/c/${token}/manifest.webmanifest`,
  }
}

export default async function ClientTokenLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  // Defense-in-depth: middleware already validated, but we also check at the
  // page level so a misconfigured matcher can't accidentally bypass (ACCESS-01).
  const client = await getClientByToken(token)
  if (!client) notFound() // Renders app/not-found.tsx (HTTP 404)

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100dvh' }}>
      <AppBar />
      <OfflineToast />
      <main className="max-w-screen-sm mx-auto" style={{ paddingInline: 16 }}>
        {children}
      </main>
      <A2HSOverlay />
    </div>
  )
}
