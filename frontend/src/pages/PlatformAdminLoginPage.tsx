import React, { useState } from 'react'
import {
  ArrowRight,
  BarChart3,
  Building2,
  Eye,
  EyeOff,
  Lock,
  Mail,
  ShieldAlert,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// ─── Warm brand tokens (matches Client Portal / Org Workspace) ───────────────
const T = {
  bg: '#FAF6F0',
  bgCard: '#FFFDF9',
  bgCream: '#F7EEE4',
  bgBeige: '#F1E5D8',
  bgBeigeDeep: '#E9DCCF',
  border: '#E9DCCF',
  borderFocus: '#C38B5E',
  brown: '#89502E',
  brownDark: '#432719',
  muted: '#987D6C',
  text: '#38251C',
  textSecondary: '#78675C',
  red: '#B91C1C',
  redBg: '#FEE2E2',
  redBorder: '#FCA5A5',
  shadow: '0 4px 24px rgba(56,37,28,0.10)',
  shadowLg: '0 12px 48px rgba(56,37,28,0.14)',
}

// ─── Feature highlight item ──────────────────────────────────────────────────
const Feature: React.FC<{ icon: React.ReactNode; label: string; sub: string }> = ({
  icon, label, sub,
}) => (
  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.7rem' }}>
    <div
      style={{
        width: 36,
        height: 36,
        borderRadius: 10,
        background: 'rgba(137,80,46,0.14)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: T.brown,
        flexShrink: 0,
        marginTop: 2,
      }}
    >
      {icon}
    </div>
    <div>
      <div style={{ fontWeight: 700, fontSize: '0.85rem', color: T.brownDark }}>{label}</div>
      <div style={{ fontSize: '0.75rem', color: T.muted, marginTop: 1 }}>{sub}</div>
    </div>
  </div>
)

// ─── Governance building illustration ────────────────────────────────────────
const BuildingIllustration: React.FC = () => (
  <svg
    width="100%"
    viewBox="0 0 440 220"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    style={{ display: 'block', maxWidth: 440 }}
  >
    <defs>
      <linearGradient id="lg-sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#FDF6EE" />
        <stop offset="100%" stopColor="#F5E8D6" />
      </linearGradient>
      <linearGradient id="lg-hill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#E8D5BF" />
        <stop offset="100%" stopColor="#D9C0A0" />
      </linearGradient>
      <linearGradient id="lg-shield" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#E8A87C" />
        <stop offset="100%" stopColor="#C97848" />
      </linearGradient>
      {/* Soft abstract arc curves — background */}
      <radialGradient id="rg-arc1" cx="30%" cy="40%" r="60%">
        <stop offset="0%" stopColor="#E8C8A8" stopOpacity="0.35" />
        <stop offset="100%" stopColor="#E8C8A8" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="rg-arc2" cx="75%" cy="70%" r="50%">
        <stop offset="0%" stopColor="#D9B090" stopOpacity="0.22" />
        <stop offset="100%" stopColor="#D9B090" stopOpacity="0" />
      </radialGradient>
    </defs>

    {/* Sky */}
    <rect width="440" height="220" fill="url(#lg-sky)" />

    {/* Abstract architectural arc curves */}
    <ellipse cx="80"  cy="110" rx="140" ry="100" fill="url(#rg-arc1)" />
    <ellipse cx="360" cy="150" rx="120" ry="90"  fill="url(#rg-arc2)" />
    <path d="M0 160 Q110 100 220 150 Q330 200 440 130 L440 220 L0 220 Z"
          fill="#E8D0B0" opacity="0.28" />

    {/* Ground / hill */}
    <ellipse cx="220" cy="218" rx="260" ry="44" fill="url(#lg-hill)" />
    <rect x="0" y="210" width="440" height="10" fill="#D9C0A0" />

    {/* ── Building shadow ── */}
    <rect x="96" y="68" width="248" height="152" rx="4" fill="#C8906A" opacity="0.18" />

    {/* ── Main body ── */}
    <rect x="94"  y="66"  width="252" height="150" rx="3" fill="#F0C9A0" />

    {/* Upper darker band */}
    <rect x="94"  y="66"  width="252" height="52"  rx="3" fill="#E8B988" />
    <rect x="94"  y="114" width="252" height="5"   fill="#D9A878" />

    {/* Roof cap — three stepped layers */}
    <rect x="88"  y="60"  width="264" height="10" rx="3" fill="#E0A870" />
    <rect x="92"  y="54"  width="256" height="8"  rx="2" fill="#EBB980" />
    <rect x="98"  y="48"  width="244" height="8"  rx="2" fill="#F0C9A0" />

    {/* ── Grand columns (classic portico look) ── */}
    {[106, 124, 142, 160, 280, 298, 316, 334].map((x) => (
      <rect key={x} x={x} y="120" width="11" height="96" rx="3" fill="#D9A878" />
    ))}

    {/* ── Windows — upper row left ── */}
    {[104, 130].map((x) => (
      <g key={`wul-${x}`}>
        <rect x={x} y="74" width="20" height="28" rx="2" fill="#E8C8A0" opacity="0.75" />
        <rect x={x} y="74" width="20" height="28" rx="2" fill="none" stroke="#D9A878" strokeWidth="1" />
        <line x1={x+10} y1="74" x2={x+10} y2="102" stroke="#D9A878" strokeWidth="0.7" opacity="0.6" />
      </g>
    ))}

    {/* ── Windows — upper row right ── */}
    {[286, 312].map((x) => (
      <g key={`wur-${x}`}>
        <rect x={x} y="74" width="20" height="28" rx="2" fill="#E8C8A0" opacity="0.75" />
        <rect x={x} y="74" width="20" height="28" rx="2" fill="none" stroke="#D9A878" strokeWidth="1" />
        <line x1={x+10} y1="74" x2={x+10} y2="102" stroke="#D9A878" strokeWidth="0.7" opacity="0.6" />
      </g>
    ))}

    {/* ── Windows — lower row left ── */}
    {[104, 130].map((x) => (
      <g key={`wll-${x}`}>
        <rect x={x} y="122" width="20" height="26" rx="2" fill="#E0B890" opacity="0.65" />
        <rect x={x} y="122" width="20" height="26" rx="2" fill="none" stroke="#D9A878" strokeWidth="1" />
        <line x1={x+10} y1="122" x2={x+10} y2="148" stroke="#D9A878" strokeWidth="0.7" opacity="0.5" />
      </g>
    ))}

    {/* ── Windows — lower row right ── */}
    {[286, 312].map((x) => (
      <g key={`wlr-${x}`}>
        <rect x={x} y="122" width="20" height="26" rx="2" fill="#E0B890" opacity="0.65" />
        <rect x={x} y="122" width="20" height="26" rx="2" fill="none" stroke="#D9A878" strokeWidth="1" />
        <line x1={x+10} y1="122" x2={x+10} y2="148" stroke="#D9A878" strokeWidth="0.7" opacity="0.5" />
      </g>
    ))}

    {/* ── Centre recess panel ── */}
    <rect x="170" y="66" width="100" height="150" rx="2" fill="#E8A870" opacity="0.25" />

    {/* ── Shield / emblem ── */}
    <path d="M220 76 L237 83 L237 98 Q237 112 220 120 Q203 112 203 98 L203 83 Z"
          fill="url(#lg-shield)" />
    <path d="M220 80 L234 87 L234 98 Q234 110 220 117 Q206 110 206 98 L206 87 Z"
          fill="#F5C898" opacity="0.55" />
    {/* Checkmark */}
    <polyline points="212,99 218,107 229,90"
              stroke="#C97848" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />

    {/* ── Entrance door with arch ── */}
    <rect x="206" y="166" width="28" height="50" rx="2" fill="#C8845A" />
    <path d="M206 176 Q220 158 234 176" fill="#C8845A" />
    <path d="M206 176 Q220 159 234 176" fill="none" stroke="#B87048" strokeWidth="1.2" />
    <line x1="220" y1="166" x2="220" y2="216" stroke="#B87048" strokeWidth="0.9" opacity="0.65" />

    {/* Door handle */}
    <circle cx="224" cy="192" r="2" fill="#B87048" />

    {/* ── Steps ── */}
    <rect x="190" y="212" width="60" height="5" rx="1" fill="#D9A878" />
    <rect x="196" y="207" width="48" height="6" rx="1" fill="#E0B888" />

    {/* ══════════════════════
        LEFT LARGE TREE
        ══════════════════════ */}
    <rect x="48" y="172" width="8" height="42" rx="3" fill="#A07848" />
    {/* Foliage layers */}
    <ellipse cx="52" cy="156" rx="32" ry="28" fill="#8DB86A" />
    <ellipse cx="46" cy="146" rx="18" ry="16" fill="#A0CC78" opacity="0.72" />
    <ellipse cx="62" cy="166" rx="15" ry="12" fill="#709050" opacity="0.5" />
    <ellipse cx="52" cy="148" rx="10" ry="10" fill="#B4D888" opacity="0.5" />

    {/* ══════════════════════
        RIGHT LARGE TREE
        ══════════════════════ */}
    <rect x="386" y="174" width="7" height="38" rx="3" fill="#A07848" />
    <ellipse cx="389" cy="160" rx="28" ry="24" fill="#8DB86A" />
    <ellipse cx="383" cy="151" rx="16" ry="14" fill="#A0CC78" opacity="0.72" />
    <ellipse cx="398" cy="169" rx="12" ry="10" fill="#709050" opacity="0.5" />

    {/* Small shrubs far left */}
    <rect x="12"  y="192" width="5" height="22" rx="2" fill="#B08848" />
    <ellipse cx="14"  cy="184" rx="14" ry="14" fill="#7FAA58" />
    <ellipse cx="10"  cy="179" rx="8"  ry="8"  fill="#96C068" opacity="0.65" />

    {/* Small shrubs far right */}
    <rect x="422" y="194" width="5" height="20" rx="2" fill="#B08848" />
    <ellipse cx="424" cy="186" rx="12" ry="13" fill="#7FAA58" />
    <ellipse cx="421" cy="181" rx="7"  ry="7"  fill="#96C068" opacity="0.65" />
  </svg>
)

// ─── Main page component ─────────────────────────────────────────────────────
export const PlatformAdminLoginPage: React.FC = () => {
  // ── All existing auth logic preserved exactly ──
  const { platformAdminLogin } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail]           = useState('')
  const [password, setPassword]     = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!email.trim() || !password) {
      setError('Please provide both administrative email and password.')
      return
    }

    try {
      setIsSubmitting(true)
      await platformAdminLogin({ email: email.trim(), password })
      navigate('/platform-admin/dashboard', { replace: true })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Administrative authentication failed.'
      setError(msg)
    } finally {
      setIsSubmitting(false)
    }
  }
  // ── End of preserved auth logic ──

  return (
    <div
      style={{
        minHeight: '100vh',
        background: T.bg,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'Inter, -apple-system, sans-serif',
      }}
    >
      {/* ── Top bar ── */}
      <header
        style={{
          padding: '1rem 2rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          borderBottom: `1px solid ${T.border}`,
          background: T.bgCard,
        }}
      >
        {/* Logo mark */}
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 9,
            background: T.brown,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFFDF9',
            fontWeight: 900,
            fontSize: '1rem',
            letterSpacing: '-0.03em',
            flexShrink: 0,
          }}
        >
          R
        </div>
        <span
          style={{
            fontWeight: 800,
            fontSize: '1.05rem',
            color: T.brownDark,
            letterSpacing: '-0.02em',
          }}
        >
          ResolveX
        </span>
        <span style={{ width: 1, height: 18, background: T.border, margin: '0 0.25rem' }} />
        <span style={{ fontSize: '0.82rem', color: T.muted, fontWeight: 500 }}>
          Platform Governance
        </span>
      </header>

      {/* ── Main two-column body ── */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'stretch',
          minHeight: 0,
        }}
        className="admin-login-grid"
      >
        {/* ══════════════════════════════
            LEFT COLUMN — branding
            ══════════════════════════════ */}
        <div
          style={{
            flex: '1 1 0',
            padding: 'clamp(2rem, 5vw, 4rem) clamp(1.5rem, 4vw, 3.5rem)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Background arc curves */}
          <svg
            aria-hidden="true"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
            viewBox="0 0 600 700"
            preserveAspectRatio="xMidYMid slice"
          >
            <defs>
              <radialGradient id="arc-bg1" cx="20%" cy="30%" r="60%">
                <stop offset="0%" stopColor="#E8C8A0" stopOpacity="0.38" />
                <stop offset="100%" stopColor="#E8C8A0" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="arc-bg2" cx="80%" cy="80%" r="55%">
                <stop offset="0%" stopColor="#D9A878" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#D9A878" stopOpacity="0" />
              </radialGradient>
            </defs>
            <ellipse cx="100" cy="200" rx="380" ry="320" fill="url(#arc-bg1)" />
            <ellipse cx="500" cy="550" rx="300" ry="280" fill="url(#arc-bg2)" />
            {/* Subtle arc lines */}
            <path d="M-40 350 Q200 180 500 340" stroke="#D9A878" strokeWidth="1.5" fill="none" opacity="0.2" />
            <path d="M-40 420 Q220 250 520 400" stroke="#D9A878" strokeWidth="1"   fill="none" opacity="0.14" />
          </svg>

          {/* Content */}
          <div style={{ position: 'relative' }}>
            {/* Platform Administration badge */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                background: T.bgBeige,
                border: `1px solid ${T.border}`,
                color: T.brown,
                fontSize: '0.75rem',
                fontWeight: 700,
                padding: '0.3rem 0.8rem',
                borderRadius: 99,
                letterSpacing: '0.04em',
                marginBottom: '1.25rem',
              }}
            >
              <ShieldCheck size={13} />
              Platform Administration
            </div>

            {/* Main heading */}
            <h1
              style={{
                fontSize: 'clamp(2rem, 4vw, 2.8rem)',
                fontWeight: 900,
                color: T.brownDark,
                lineHeight: 1.1,
                letterSpacing: '-0.03em',
                marginBottom: '0.85rem',
              }}
            >
              ResolveX<br />Admin Console
            </h1>

            {/* Supporting text */}
            <p
              style={{
                fontSize: '0.95rem',
                color: T.textSecondary,
                lineHeight: 1.6,
                maxWidth: 360,
                marginBottom: '2.25rem',
              }}
            >
              Govern, verify, and manage the ResolveX platform with superadmin access.
            </p>

            {/* Feature highlights */}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '1.25rem 2rem',
              }}
            >
              <Feature
                icon={<Building2 size={17} />}
                label="Manage Organizations"
                sub="Verify & lifecycle control"
              />
              <Feature
                icon={<ShieldCheck size={17} />}
                label="Verification Control"
                sub="Approve or reject orgs"
              />
              <Feature
                icon={<BarChart3 size={17} />}
                label="Platform Oversight"
                sub="Stats, reports & admins"
              />
            </div>
          </div>

          {/* Building illustration — pinned to bottom */}
          <div
            style={{
              position: 'relative',
              marginTop: '2.5rem',
              width: '100%',
            }}
          >
            <BuildingIllustration />
          </div>
        </div>

        {/* ══════════════════════════════
            RIGHT COLUMN — auth card
            ══════════════════════════════ */}
        <div
          style={{
            flex: '0 0 auto',
            width: 'clamp(360px, 44%, 520px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'clamp(1.5rem, 4vw, 3rem)',
            borderLeft: `1px solid ${T.border}`,
            background: T.bgCard,
          }}
          className="admin-login-card-col"
        >
          <div style={{ width: '100%', maxWidth: 400 }}>

            {/* ── Card ── */}
            <div
              style={{
                background: T.bgCard,
                border: `1px solid ${T.bgBeigeDeep}`,
                borderRadius: 20,
                padding: 'clamp(1.75rem, 4vw, 2.25rem)',
                boxShadow: T.shadowLg,
              }}
            >
              {/* Shield icon */}
              <div style={{ textAlign: 'center', marginBottom: '1.35rem' }}>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 62,
                    height: 62,
                    borderRadius: 16,
                    background: T.brown,
                    color: '#FFFDF9',
                    marginBottom: '1rem',
                    boxShadow: `0 6px 20px rgba(137,80,46,0.28)`,
                  }}
                >
                  <ShieldCheck size={30} />
                </div>

                <h2
                  style={{
                    fontSize: '1.45rem',
                    fontWeight: 800,
                    color: T.brownDark,
                    letterSpacing: '-0.025em',
                    marginBottom: '0.5rem',
                  }}
                >
                  Platform Administration
                </h2>

                {/* Restricted badge */}
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    background: '#FEF3C7',
                    border: '1px solid #FCD34D',
                    color: '#92400E',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '0.25rem 0.7rem',
                    borderRadius: 99,
                    letterSpacing: '0.03em',
                    textTransform: 'uppercase',
                  }}
                >
                  <Lock size={10} /> Restricted Access Only
                </span>

                <p
                  style={{
                    fontSize: '0.83rem',
                    color: T.textSecondary,
                    marginTop: '0.75rem',
                    lineHeight: 1.55,
                    maxWidth: 300,
                    marginLeft: 'auto',
                    marginRight: 'auto',
                  }}
                >
                  Authenticate with verified platform-level superadministrator credentials.
                </p>
              </div>

              {/* ── Error alert ── */}
              {error && (
                <div
                  role="alert"
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.6rem',
                    background: '#FEE2E2',
                    border: '1px solid #FCA5A5',
                    color: '#B91C1C',
                    padding: '0.75rem 0.9rem',
                    borderRadius: 10,
                    fontSize: '0.83rem',
                    marginBottom: '1.1rem',
                    lineHeight: 1.45,
                  }}
                >
                  <ShieldAlert size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span style={{ flex: 1 }}>{error}</span>
                  <button
                    onClick={() => setError(null)}
                    aria-label="Dismiss error"
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#B91C1C',
                      padding: '0.1rem',
                      flexShrink: 0,
                      fontSize: '1rem',
                      lineHeight: 1,
                    }}
                  >
                    ×
                  </button>
                </div>
              )}

              {/* ── Form ── */}
              <form onSubmit={handleSubmit} noValidate>

                {/* Email field */}
                <div style={{ marginBottom: '1rem' }}>
                  <label
                    htmlFor="admin-email"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      color: T.text,
                      marginBottom: '0.45rem',
                    }}
                  >
                    <Mail size={13} color={T.brown} />
                    Platform Admin Email
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Mail
                      size={15}
                      style={{
                        position: 'absolute',
                        left: '0.85rem',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: T.muted,
                        pointerEvents: 'none',
                      }}
                    />
                    <input
                      id="admin-email"
                      type="email"
                      autoComplete="email"
                      required
                      placeholder="admin@resolvex.internal"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.65rem 0.85rem 0.65rem 2.5rem',
                        borderRadius: 10,
                        border: `1.5px solid ${T.border}`,
                        background: T.bgCream,
                        color: T.text,
                        fontSize: '0.88rem',
                        fontFamily: 'inherit',
                        outline: 'none',
                        boxSizing: 'border-box',
                        transition: 'border-color 0.15s',
                      }}
                      onFocus={(e) => (e.currentTarget.style.borderColor = T.borderFocus)}
                      onBlur={(e)  => (e.currentTarget.style.borderColor = T.border)}
                    />
                  </div>
                </div>

                {/* Password field */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <label
                    htmlFor="admin-password"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      color: T.text,
                      marginBottom: '0.45rem',
                    }}
                  >
                    <Lock size={13} color={T.brown} />
                    Admin Password
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Lock
                      size={15}
                      style={{
                        position: 'absolute',
                        left: '0.85rem',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: T.muted,
                        pointerEvents: 'none',
                      }}
                    />
                    <input
                      id="admin-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      required
                      placeholder="••••••••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.65rem 2.75rem 0.65rem 2.5rem',
                        borderRadius: 10,
                        border: `1.5px solid ${T.border}`,
                        background: T.bgCream,
                        color: T.text,
                        fontSize: '0.88rem',
                        fontFamily: 'inherit',
                        outline: 'none',
                        boxSizing: 'border-box',
                        transition: 'border-color 0.15s',
                      }}
                      onFocus={(e) => (e.currentTarget.style.borderColor = T.borderFocus)}
                      onBlur={(e)  => (e.currentTarget.style.borderColor = T.border)}
                    />
                    {/* Visibility toggle */}
                    <button
                      type="button"
                      onClick={() => setShowPassword((p) => !p)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      style={{
                        position: 'absolute',
                        right: '0.75rem',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: T.muted,
                        padding: '0.2rem',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    padding: '0.78rem 1.25rem',
                    borderRadius: 11,
                    border: 'none',
                    background: isSubmitting ? '#B8845E' : T.brown,
                    color: '#FFFDF9',
                    fontSize: '0.92rem',
                    fontWeight: 700,
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    letterSpacing: '0.01em',
                    boxShadow: isSubmitting ? 'none' : `0 4px 14px rgba(137,80,46,0.35)`,
                    transition: 'background 0.15s, box-shadow 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSubmitting)
                      (e.currentTarget as HTMLButtonElement).style.background = '#432719'
                  }}
                  onMouseLeave={(e) => {
                    if (!isSubmitting)
                      (e.currentTarget as HTMLButtonElement).style.background = T.brown
                  }}
                >
                  {isSubmitting ? (
                    <>
                      <svg
                        width="16" height="16" viewBox="0 0 16 16" fill="none"
                        style={{ animation: 'spin 0.9s linear infinite', flexShrink: 0 }}
                        aria-hidden="true"
                      >
                        <circle cx="8" cy="8" r="6" stroke="rgba(255,253,249,0.35)" strokeWidth="2.5" />
                        <path d="M8 2 A6 6 0 0 1 14 8" stroke="#FFFDF9" strokeWidth="2.5" strokeLinecap="round" />
                      </svg>
                      Verifying Credentials…
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={16} />
                      Authenticate Superadmin
                      <ArrowRight size={15} />
                    </>
                  )}
                </button>
              </form>

              {/* Divider */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  margin: '1.25rem 0',
                }}
              >
                <div style={{ flex: 1, height: 1, background: T.bgBeigeDeep }} />
                <span style={{ fontSize: '0.78rem', color: T.muted, flexShrink: 0 }}>or</span>
                <div style={{ flex: 1, height: 1, background: T.bgBeigeDeep }} />
              </div>

              {/* Return to client login */}
              <Link
                to="/login"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  width: '100%',
                  padding: '0.72rem 1.25rem',
                  borderRadius: 11,
                  border: `1.5px solid ${T.border}`,
                  background: T.bgCard,
                  color: T.text,
                  fontSize: '0.88rem',
                  fontWeight: 600,
                  textDecoration: 'none',
                  textAlign: 'center',
                  boxSizing: 'border-box',
                  transition: 'background 0.15s, border-color 0.15s',
                }}
                onMouseEnter={(e) => {
                  ;(e.currentTarget as HTMLAnchorElement).style.background = T.bgBeige
                  ;(e.currentTarget as HTMLAnchorElement).style.borderColor = T.borderFocus
                }}
                onMouseLeave={(e) => {
                  ;(e.currentTarget as HTMLAnchorElement).style.background = T.bgCard
                  ;(e.currentTarget as HTMLAnchorElement).style.borderColor = T.border
                }}
              >
                <Users size={15} color={T.muted} />
                Return to Client Login
              </Link>
            </div>
            {/* ── end card ── */}

          </div>
        </div>
        {/* ── end right column ── */}
      </div>

      {/* Responsive styles via <style> tag */}
      <style>{`
        @media (max-width: 820px) {
          .admin-login-grid {
            flex-direction: column !important;
          }
          .admin-login-card-col {
            width: 100% !important;
            border-left: none !important;
            border-top: 1px solid ${T.border} !important;
          }
        }
        @media (max-width: 520px) {
          .admin-login-card-col {
            padding: 1.25rem !important;
          }
        }
      `}</style>
    </div>
  )
}
