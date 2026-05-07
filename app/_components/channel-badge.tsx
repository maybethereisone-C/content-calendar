/**
 * ChannelBadge — RSC 24×24 surface-2 square containing a 14×14 lucide icon.
 *
 * Per UI-SPEC Q4=1 (icon-only square, no label) + §Components ChannelBadge:
 *   - 24×24 px container, border-radius 6
 *   - background var(--surface-2)
 *   - centered 14×14 lucide icon, color var(--text-mut)
 *   - aria-label = platform name (so screen readers announce the channel)
 *
 * Icon mapping (Rule 3 deviation, executor 02-02):
 *   lucide-react@1.14.0 ships `X`, `Music`, `MessageCircle` brand icons but does
 *   NOT ship `Instagram` or `Facebook` brand icons (verified via grep of
 *   node_modules/lucide-react/dist/lucide-react.d.ts at install time). Plan
 *   action item explicitly authorises a fallback per UI-SPEC's neutral-icon
 *   rule. Substitutions chosen for semantic neutrality:
 *     - instagram → Camera   (photo-sharing platform)
 *     - facebook  → MessageSquare (general social messaging)
 *     - tiktok    → Music    (per plan)
 *     - x         → X        (per plan, exists)
 *     - line      → MessageCircle (per plan, fallback)
 *   Brand icons can be swapped in v1.1 if/when lucide-react ships them or the
 *   project moves to react-simple-icons.
 */
import {
  Camera,
  MessageSquare,
  Music,
  X,
  MessageCircle,
  type LucideIcon,
} from 'lucide-react'

type Platform = 'instagram' | 'facebook' | 'tiktok' | 'x' | 'line'

const ICON: Record<Platform, LucideIcon> = {
  instagram: Camera,
  facebook: MessageSquare,
  tiktok: Music,
  x: X,
  line: MessageCircle,
}

export function ChannelBadge({
  platform,
  ariaLabel,
}: {
  platform: Platform
  /** Localized "Posts to {platform}" string from the parent RSC. Defaults to platform name. */
  ariaLabel?: string
}) {
  const Icon = ICON[platform]
  return (
    <span
      aria-label={ariaLabel ?? platform}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 24,
        height: 24,
        borderRadius: 6,
        background: 'var(--surface-2)',
      }}
    >
      <Icon size={14} color="var(--text-mut)" aria-hidden="true" />
    </span>
  )
}
