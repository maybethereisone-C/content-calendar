/**
 * PhotoSourceBadge — subtle dark pill rendered top-left of every gallery photo.
 *
 * Per UI-SPEC §"<PostDetailGallery>" + Q7=1 (single label per photo): both
 * roles share the same color treatment; distinguished by text only.
 *
 *   - role='tew_prepared' → "Tew" (Latin, default font stack)
 *   - role='client_added' → "คุณ" (Thai, --font-thai stack)
 *
 * RSC by design (no client interactivity); imported by PostDetailGallery
 * which is itself a Client Component (the gallery hosts scroll observers and
 * delete dialogs — children can safely be plain server-rendered JSX).
 */
export function PhotoSourceBadge({
  role,
}: {
  role: 'tew_prepared' | 'client_added'
}) {
  const label = role === 'tew_prepared' ? 'Tew' : 'คุณ'
  return (
    <span
      aria-label={role === 'tew_prepared' ? 'ภาพจากทิว' : 'ภาพจากคุณ'}
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
          role === 'client_added' ? 'var(--font-thai, inherit)' : 'inherit',
        pointerEvents: 'none',
      }}
    >
      {label}
    </span>
  )
}
