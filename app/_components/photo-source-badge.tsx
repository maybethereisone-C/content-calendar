'use client'

/**
 * PhotoSourceBadge — subtle dark pill rendered top-left of every gallery photo.
 *
 * Per UI-SPEC §"<PostDetailGallery>" + Q7=1 (single label per photo): both
 * roles share the same color treatment; distinguished by text only.
 *
 *   - role='team_prepared' → t('photo.fromTeam')   ("Team" / "ทีมงาน")
 *   - role='client_added'  → t('photo.fromYou')    ("You" / "คุณ")
 *
 * Client component because it consumes `useTranslations`. Parent gallery is
 * already a client component, so the boundary is unchanged.
 */
import { useTranslations, useLocale } from 'next-intl'

export type PhotoSourceRole = 'team_prepared' | 'client_added'

export function PhotoSourceBadge({ role }: { role: PhotoSourceRole }) {
  const t = useTranslations('photo')
  const locale = useLocale()
  const isTeam = role === 'team_prepared'
  const label = isTeam ? t('fromTeam') : t('fromYou')
  const ariaLabel = isTeam ? t('fromTeamAria') : t('fromYouAria')
  return (
    <span
      aria-label={ariaLabel}
      style={{
        position: 'absolute',
        top: 8,
        left: 8,
        padding: '3px 8px',
        borderRadius: 999,
        background: 'rgba(0,0,0,0.45)',
        color: '#fff',
        fontSize: 10,
        fontWeight: 600,
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        fontFamily:
          locale === 'th' ? 'var(--font-thai, inherit)' : 'inherit',
        pointerEvents: 'none',
      }}
    >
      {label}
    </span>
  )
}
