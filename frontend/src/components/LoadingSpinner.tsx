import React from 'react'

interface LoadingSpinnerProps {
  label?: string
  size?: number
  fullPage?: boolean
}

// ---------------------------------------------------------------------------
// Warm caramel ring spinner — pure CSS, no external icons
// ---------------------------------------------------------------------------
const spinnerStyle = `
  @keyframes rx-spin {
    to { transform: rotate(360deg); }
  }
  @keyframes rx-fade-in {
    from { opacity: 0; transform: translateY(6px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @media (prefers-reduced-motion: reduce) {
    .rx-ring { animation: none !important; }
    .rx-loader-content { animation: none !important; }
  }
`

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  label = 'Loading…',
  size = 24,
  fullPage = false,
}) => {
  // ── Inline variant (unchanged visual weight — used inside cards/tables) ──
  if (!fullPage) {
    return (
      <>
        <style>{spinnerStyle}</style>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.65rem',
            padding: '1.5rem',
            color: '#9A5B2E',
          }}
        >
          {/* Small caramel ring */}
          <div
            className="rx-ring"
            style={{
              width: size,
              height: size,
              borderRadius: '50%',
              border: `2.5px solid #F1E2D2`,
              borderTopColor: '#B77B45',
              animation: 'rx-spin 0.85s linear infinite',
              flexShrink: 0,
            }}
          />
          {label && (
            <span style={{ fontSize: '0.82rem', color: '#A09080', fontWeight: 500 }}>
              {label}
            </span>
          )}
        </div>
      </>
    )
  }

  // ── Full-page variant — warm cream background with wave shapes ──
  return (
    <>
      <style>{spinnerStyle}</style>
      <div
        style={{
          /* Break out of main-content container to fill the full viewport */
          position: 'fixed',
          inset: 0,
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          /* Warm cream base */
          background: 'linear-gradient(160deg, #FAF6F0 0%, #F5EAD8 50%, #F1E2D2 100%)',
        }}
      >
        {/* ── Background SVG waves (matching the reference image) ── */}
        <svg
          viewBox="0 0 1440 600"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            opacity: 0.55,
          }}
        >
          {/* Large background wave 1 */}
          <path
            d="M0,300 C200,180 400,420 700,280 C1000,140 1200,380 1440,260 L1440,600 L0,600 Z"
            fill="#EDD4B4"
            opacity="0.45"
          />
          {/* Wave 2 */}
          <path
            d="M0,400 C300,250 600,500 900,350 C1150,220 1320,420 1440,360 L1440,600 L0,600 Z"
            fill="#E8C898"
            opacity="0.35"
          />
          {/* Wave 3 — lighter foreground */}
          <path
            d="M0,500 C360,360 720,560 1080,440 C1260,380 1380,500 1440,480 L1440,600 L0,600 Z"
            fill="#F5E4CC"
            opacity="0.5"
          />

          {/* Subtle window-light bloom top-right (matching reference) */}
          <ellipse cx="1200" cy="80" rx="320" ry="200" fill="#FFF8EE" opacity="0.3" />
          <ellipse cx="1300" cy="40"  rx="180" ry="120" fill="#FFF4E8" opacity="0.2" />

          {/* Desk surface bottom-right (reference shows wooden desk) */}
          <rect x="680" y="520" width="760" height="80" rx="4" fill="#D4A870" opacity="0.25" />
          <rect x="680" y="540" width="760" height="60" rx="2" fill="#C8944A" opacity="0.15" />

          {/* Books on desk */}
          <rect x="820" y="488" width="90" height="34" rx="3" fill="#C8A870" opacity="0.55" />
          <rect x="822" y="480" width="88" height="14" rx="2" fill="#D4B896" opacity="0.6" />

          {/* Plant pot bottom-right */}
          <ellipse cx="1080" cy="522" rx="36" ry="10" fill="#C8884A" opacity="0.3" />
          <rect x="1052" y="488" width="56" height="36" rx="6" fill="#C8884A" opacity="0.35" />
          {/* Plant leaves */}
          <ellipse cx="1068" cy="468" rx="22" ry="32" fill="#6DBB7A" opacity="0.5" transform="rotate(-18 1068 468)" />
          <ellipse cx="1090" cy="460" rx="22" ry="32" fill="#52A862" opacity="0.45" transform="rotate(15 1090 460)" />
          <ellipse cx="1080" cy="454" rx="16" ry="28" fill="#6DBB7A" opacity="0.55" />

          {/* Left plant (peeking in from edge) */}
          <ellipse cx="40"  cy="380" rx="55" ry="80" fill="#6DBB7A" opacity="0.3" transform="rotate(-20 40 380)" />
          <ellipse cx="0"   cy="420" rx="40" ry="70" fill="#52A862" opacity="0.25" transform="rotate(-10 0 420)" />
        </svg>

        {/* ── Centered loading content ── */}
        <div
          className="rx-loader-content"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1rem',
            position: 'relative',
            zIndex: 2,
            animation: 'rx-fade-in 0.4s ease both',
          }}
        >
          {/* Caramel ring spinner */}
          <div
            className="rx-ring"
            style={{
              width: 42,
              height: 42,
              borderRadius: '50%',
              border: '3px solid #F1E2D2',
              borderTopColor: '#9A5B2E',
              animation: 'rx-spin 0.9s linear infinite',
            }}
          />

          {/* Main label */}
          <p
            style={{
              fontSize: '0.97rem',
              fontWeight: 700,
              color: '#302018',
              letterSpacing: '-0.01em',
              margin: 0,
              textAlign: 'center',
            }}
          >
            {label}
          </p>

          {/* Subtitle */}
          <p
            style={{
              fontSize: '0.83rem',
              color: '#9A7A62',
              margin: 0,
              textAlign: 'center',
            }}
          >
            This won't take long.
          </p>
        </div>
      </div>
    </>
  )
}
