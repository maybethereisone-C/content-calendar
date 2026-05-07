import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { ChevronLeft, FileText } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function PostDetailPage({
  params,
}: {
  params: Promise<{ token: string; id: string }>
}) {
  const t = await getTranslations('post')
  const { token } = await params

  return (
    <>
      <Link
        href={`/c/${token}/calendar`}
        className="flex items-center"
        style={{
          gap: 4,
          color: 'var(--text-mut)',
          fontSize: 14,
          minHeight: 44,
          marginBottom: 12,
          textDecoration: 'none',
        }}
      >
        <ChevronLeft size={16} aria-hidden />
        <span>{t('backLink')}</span>
      </Link>
      <section
        className="flex flex-col items-center justify-center text-center"
        style={{
          minHeight: 'calc(100dvh - 56px - 44px)',
          gap: 16,
          padding: '0 24px',
        }}
      >
        <FileText size={40} aria-hidden style={{ color: 'var(--text-mut)' }} />
        <p
          style={{
            fontSize: 16,
            color: 'var(--text-mut)',
            lineHeight: 1.5,
            maxWidth: 240,
          }}
        >
          {t('placeholder')}
        </p>
      </section>
    </>
  )
}
