'use client'
import { useEffect, useState } from 'react'

type Lang = 'th' | 'en'

// A2HS strings are stored as constants in this file — NOT in messages/*.json.
// Language is detected from navigator.language (device language), independent
// of the UI language toggle (per D-21, UI-SPEC §6 Voice rules).
const A2HS = {
  th: {
    heading: 'ติดตั้งแอปบนหน้าจอหลัก',
    sub: 'ทำตามขั้นตอนง่าย ๆ ด้านล่าง',
    step1: 'แตะปุ่มแชร์',
    step2: "เลื่อนลงแล้วแตะ 'เพิ่มไปที่หน้าจอโฮม'",
    step3: "แตะ 'เพิ่ม' ที่มุมขวาบน",
    dontShow: 'ไม่ต้องแสดงอีก',
    dismiss: 'เข้าใจแล้ว',
  },
  en: {
    heading: 'Install app on your Home Screen',
    sub: 'Follow the simple steps below',
    step1: 'Tap the Share button',
    step2: "Scroll down and tap 'Add to Home Screen'",
    step3: "Tap 'Add' at the top right",
    dontShow: "Don't show again",
    dismiss: 'Got it',
  },
} as const

function detectLang(): Lang {
  try {
    return (navigator.language ?? '').toLowerCase().startsWith('th') ? 'th' : 'en'
  } catch {
    return 'en'
  }
}

function isIOSSafari(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  return (
    (ua.includes('iPhone') || ua.includes('iPad')) &&
    ua.includes('Safari') &&
    !ua.includes('CriOS') &&
    !ua.includes('FxiOS')
  )
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in navigator && (navigator as { standalone?: boolean }).standalone === true)
  )
}

export function A2HSOverlay() {
  const [visible, setVisible] = useState(false)
  const [lang, setLang] = useState<Lang>('en')
  const [dontShow, setDontShow] = useState(false)

  useEffect(() => {
    if (!isIOSSafari()) return
    if (isStandalone()) return
    try {
      if (localStorage.getItem('a2hs_dismissed')) return
    } catch {
      // localStorage unavailable — show overlay
    }
    setLang(detectLang())
    setVisible(true)
  }, [])

  if (!visible) return null

  const c = A2HS[lang]

  function dismiss(persist: boolean) {
    if (persist) {
      try {
        localStorage.setItem('a2hs_dismissed', '1')
      } catch {}
    }
    setVisible(false)
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="a2hs-title"
      onClick={() => dismiss(false)}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'flex-end',
      }}
    >
      <div
        className="a2hs-panel"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          background: 'var(--surface)',
          borderRadius: '16px 16px 0 0',
          padding: 24,
          maxHeight: '85dvh',
          overflowY: 'auto',
          boxShadow: 'var(--shadow-lg)',
          fontFamily:
            lang === 'th'
              ? 'var(--font-thai), sans-serif'
              : 'var(--font-sans), sans-serif',
        }}
      >
        {/* drag handle */}
        <div
          style={{
            width: 40,
            height: 4,
            background: 'var(--border)',
            borderRadius: 9999,
            margin: '0 auto 16px',
          }}
        />

        <h2
          id="a2hs-title"
          style={{
            fontSize: 20,
            fontWeight: 600,
            textAlign: 'center',
            color: 'var(--text)',
          }}
        >
          {c.heading}
        </h2>

        <p
          style={{
            fontSize: 14,
            textAlign: 'center',
            color: 'var(--text-mut)',
            marginTop: 8,
          }}
        >
          {c.sub}
        </p>

        <div
          style={{
            display: 'flex',
            gap: 12,
            overflowX: 'auto',
            marginTop: 20,
          }}
        >
          {[c.step1, c.step2, c.step3].map((label, i) => (
            <div key={i} style={{ flex: '0 0 100px', textAlign: 'center' }}>
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 9999,
                  background: 'var(--accent)',
                  color: 'var(--accent-fg)',
                  fontSize: 13,
                  fontWeight: 600,
                  margin: '0 auto 8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {i + 1}
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/a2hs/${lang}/step-${i + 1}.png`}
                alt={label}
                width={100}
                height={160}
                style={{
                  width: 100,
                  height: 160,
                  borderRadius: 10,
                  border: '1px solid var(--border)',
                  objectFit: 'cover',
                }}
              />
              <p
                style={{
                  fontSize: 12,
                  color: 'var(--text-mut)',
                  lineHeight: 1.3,
                  marginTop: 6,
                }}
              >
                {label}
              </p>
            </div>
          ))}
        </div>

        <label
          style={{
            marginTop: 14,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            minHeight: 40,
            color: 'var(--text)',
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={dontShow}
            onChange={(e) => setDontShow(e.target.checked)}
            style={{ width: 20, height: 20 }}
          />
          {c.dontShow}
        </label>

        <button
          type="button"
          onClick={() => dismiss(dontShow)}
          style={{
            width: '100%',
            height: 48,
            marginTop: 14,
            background: 'var(--accent)',
            color: 'var(--accent-fg)',
            border: 'none',
            borderRadius: 12,
            fontSize: 16,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {c.dismiss}
        </button>
      </div>
    </div>
  )
}
