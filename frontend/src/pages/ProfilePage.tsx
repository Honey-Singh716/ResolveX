import React from 'react'
import {
  ArrowRight,
  Building2,
  CheckCircle,
  Mail,
  ShieldCheck,
  User,
  Users,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useOrg } from '../context/OrgContext'

// ---------------------------------------------------------------------------
// Design tokens
// ---------------------------------------------------------------------------
const T = {
  bg:       '#FAF6F0',
  surface:  '#FFFDF9',
  cream:    '#F7EEE4',
  beige:    '#EEDFCC',
  caramel:  '#C38B5E',
  brown:    '#87502C',
  espresso: '#38251C',
  secondary:'#78675C',
  border:   '#EAE1D7',
  shadow:   '0 4px 20px rgba(56,37,28,0.07)',
  shadowSm: '0 2px 8px rgba(56,37,28,0.05)',
} as const

// ---------------------------------------------------------------------------
// Status pills
// ---------------------------------------------------------------------------
const VSTATUS: Record<string, { bg: string; color: string; border: string }> = {
  approved:  { bg: '#e6f4ec', color: '#1e6e3e', border: '#a8d9b8' },
  pending:   { bg: '#fef3c7', color: '#92400e', border: '#fcd34d' },
  rejected:  { bg: '#fde8e8', color: '#b91c1c', border: '#fca5a5' },
  suspended: { bg: '#f3ede8', color: '#78675C', border: '#d4c5b8' },
}
const RSTATUS: Record<string, { bg: string; color: string; border: string }> = {
  owner:   { bg: '#fef3c7', color: '#92400e', border: '#fcd34d' },
  admin:   { bg: '#e7f1fb', color: '#24598a', border: '#93c5fd' },
  manager: { bg: '#f7eee4', color: '#87502C', border: '#eedfcc' },
  staff:   { bg: '#f3ede8', color: '#78675C', border: '#d4c5b8' },
  member:  { bg: '#f3ede8', color: '#78675C', border: '#d4c5b8' },
  client:  { bg: '#f3ede8', color: '#78675C', border: '#d4c5b8' },
}
function Pill({ s, children }: { s: { bg: string; color: string; border: string }; children: React.ReactNode }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', padding: '0.15rem 0.55rem', fontSize: '0.68rem', fontWeight: 700, textTransform: 'capitalize', borderRadius: 999, background: s.bg, color: s.color, border: `1px solid ${s.border}`, whiteSpace: 'nowrap' }}>
      {children}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Hero illustration — support headset + ticket checklist + gear (no books)
// ---------------------------------------------------------------------------
function SupportIllustration() {
  return (
    <svg viewBox="0 0 380 175" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', maxWidth: 380, height: 'auto' }} aria-hidden="true">
      {/* Desk */}
      <rect x="0" y="148" width="380" height="10" fill="#D4A870" rx="2" />
      <rect x="0" y="157" width="380" height="18" fill="#C49060" />

      {/* Laptop */}
      <rect x="72" y="122" width="148" height="8"  fill="#B8B0A8" rx="3" />
      <rect x="78" y="125" width="136" height="5"  fill="#A8A098" rx="2" />
      <rect x="78" y="46"  width="136" height="78" fill="#2C2620" rx="5" />
      <rect x="82" y="50"  width="128" height="70" fill="#1E1A18" rx="3" />
      <rect x="85" y="53"  width="122" height="64" fill="#FFFCF8" rx="2" />
      {/* Screen header */}
      <rect x="90" y="57" width="112" height="8" fill="#F7EEE4" rx="1.5" />
      <rect x="93" y="60" width="35" height="3" fill="#C38B5E" rx="1.5" />
      {/* Ticket rows */}
      {[0,1,2].map((i) => (
        <React.Fragment key={i}>
          <rect x="90" y={70+i*15} width="112" height="11" fill={i%2===0 ? '#F0E8DC' : '#F7EEE4'} rx="1.5" />
          <rect x="93" y={73+i*15} width="5" height="5" rx="1" fill={i<2 ? '#22c55e' : '#F59E0B'} opacity="0.9" />
          <rect x="101" y={74+i*15} width={40+i*5} height="2.5" fill="#C38B5E" rx="1.5" opacity="0.8" />
          <rect x="101" y={78+i*15} width={28+i*4} height="2" fill="#D4B896" rx="1.5" opacity="0.5" />
        </React.Fragment>
      ))}

      {/* Headset */}
      <path d="M 32 100 Q 32 58 62 52 Q 92 46 92 96" fill="none" stroke="#C38B5E" strokeWidth="6" strokeLinecap="round" />
      <ellipse cx="32"  cy="106" rx="10" ry="13" fill="#B07040" />
      <ellipse cx="32"  cy="106" rx="6"  ry="8"  fill="#C38B5E" />
      <ellipse cx="92"  cy="100" rx="10" ry="13" fill="#B07040" />
      <ellipse cx="92"  cy="100" rx="6"  ry="8"  fill="#C38B5E" />
      <path d="M 32 116 Q 28 128 38 140" fill="none" stroke="#C38B5E" strokeWidth="3.5" strokeLinecap="round" />
      <ellipse cx="40" cy="143" rx="6" ry="4" fill="#B07040" />
      <ellipse cx="40" cy="143" rx="3.5" ry="2.5" fill="#D4956A" />

      {/* Service ticket */}
      <rect x="254" y="80" width="98" height="56" rx="7" fill="#FFFDF9" stroke="#E8D0B4" strokeWidth="1.5" />
      <line x1="254" y1="99" x2="352" y2="99" stroke="#F0E0CA" strokeWidth="1" />
      <circle cx="254" cy="108" r="6" fill="#EDD4B4" />
      <circle cx="352" cy="108" r="6" fill="#EDD4B4" />
      <rect x="267" y="105" width="52" height="3.5" rx="1.5" fill="#D4B896" opacity="0.7" />
      <rect x="267" y="111" width="38" height="3"   rx="1.5" fill="#D4B896" opacity="0.5" />
      <rect x="267" y="117" width="44" height="3"   rx="1.5" fill="#D4B896" opacity="0.45" />
      {/* Verified badge */}
      <circle cx="336" cy="91" r="11" fill="#22c55e" opacity="0.15" />
      <circle cx="336" cy="91" r="8"  fill="#22c55e" />
      <polyline points="332,91 335,94 341,86" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

      {/* Gear (large) */}
      <g transform="translate(310,34)" opacity="0.7">
        <circle cx="0" cy="0" r="24" fill="none" stroke="#D4A870" strokeWidth="4.5" />
        <circle cx="0" cy="0" r="12" fill="none" stroke="#D4A870" strokeWidth="2.5" />
        {[0,45,90,135,180,225,270,315].map((a,i) => (
          <rect key={i} x="-4.5" y="-29" width="9" height="7" rx="1.5" fill="#D4A870" transform={`rotate(${a})`} />
        ))}
      </g>
      {/* Gear (small) */}
      <g transform="translate(272,52)" opacity="0.5">
        <circle cx="0" cy="0" r="14" fill="none" stroke="#C38B5E" strokeWidth="3" />
        <circle cx="0" cy="0" r="7"  fill="none" stroke="#C38B5E" strokeWidth="2" />
        {[0,60,120,180,240,300].map((a,i) => (
          <rect key={i} x="-3" y="-18" width="6" height="5" rx="1.2" fill="#C38B5E" transform={`rotate(${a})`} />
        ))}
      </g>

      <ellipse cx="190" cy="152" rx="155" ry="4" fill="rgba(100,60,20,0.1)" />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Main component — single viewport, no scroll
// ---------------------------------------------------------------------------
export const ProfilePage: React.FC = () => {
  const { user } = useAuth()
  const { organizations } = useOrg()
  const navigate = useNavigate()

  return (
    /*
     * .profile-page-warm → .rx-client:has(.profile-page-warm) in index.css
     * sets background-color: #FAF6F0 on the entire app-shell, killing the dark sidebars.
     * negative margin cancels main-content padding so we own the full width.
     */
    <div
      className="profile-page-warm"
      style={{
        margin: '-2rem -1.5rem 0',
        padding: '1rem 1.25rem 0.75rem',
        height: 'calc(100vh - 68px)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.65rem',
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ maxWidth: 1000, margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: '0.65rem', flex: 1, minHeight: 0 }}>

        {/* ============================================================
            HERO CARD
        ============================================================ */}
        <div style={{
          flexShrink: 0,
          position: 'relative', overflow: 'hidden', borderRadius: 18,
          background: 'linear-gradient(115deg, #F5EAD8 0%, #F0E0C8 45%, #EDD4B4 75%, #E8CAA0 100%)',
          border: `1px solid ${T.border}`,
          boxShadow: T.shadow,
          display: 'grid',
          gridTemplateColumns: 'minmax(0,1fr) minmax(160px,340px)',
          minHeight: 0,
        }} className="profile-hero-grid">
          {/* Left */}
          <div style={{ padding: '1.1rem 1.5rem 1rem', display: 'flex', flexDirection: 'column', justifyContent: 'center', zIndex: 2 }}>
            <span style={{ fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.brown, marginBottom: '0.4rem', display: 'block' }}>
              ACCOUNT
            </span>
            <h1 style={{ fontSize: 'clamp(1.3rem, 2.5vw, 1.85rem)', fontWeight: 800, color: T.espresso, lineHeight: 1.15, letterSpacing: '-0.02em', marginBottom: '0.3rem' }}>
              Your Profile
            </h1>
            <p style={{ color: T.secondary, fontSize: '0.84rem', lineHeight: 1.5 }}>
              Review your account details and organization memberships.
            </p>
          </div>
          {/* Right: illustration */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: '0.5rem 0.75rem 0', zIndex: 2 }} className="profile-hero-illo">
            <SupportIllustration />
          </div>
          {/* Decorative wave */}
          <svg viewBox="0 0 600 200" xmlns="http://www.w3.org/2000/svg" style={{ position: 'absolute', right: 0, bottom: 0, width: '60%', height: '100%', opacity: 0.28, pointerEvents: 'none', zIndex: 1 }} aria-hidden="true">
            <path d="M600,0 Q380,100 600,200 Z" fill="#D4A050" />
            <path d="M600,50 Q440,110 600,170 Z" fill="#C89040" opacity="0.5" />
          </svg>
        </div>

        {/* ============================================================
            INFO ROW — user card + organizations card side by side
        ============================================================ */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.35fr)', gap: '0.65rem', flex: 1, minHeight: 0 }} className="profile-info-grid">

          {/* User info */}
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: '1.1rem 1.25rem', boxShadow: T.shadowSm, display: 'flex', flexDirection: 'column', gap: '0.65rem', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: T.cream, border: `1px solid ${T.beige}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.caramel, flexShrink: 0 }}>
                <User size={21} />
              </div>
              <div>
                <h2 style={{ fontSize: '1rem', fontWeight: 700, color: T.espresso }}>{user?.full_name || 'ResolveX User'}</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: T.secondary, fontSize: '0.8rem', marginTop: '0.15rem' }}>
                  <Mail size={12} color={T.caramel} /> {user?.email}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', padding: '0.6rem 0.75rem', background: T.cream, border: `1px solid ${T.beige}`, borderRadius: 10, fontSize: '0.76rem', color: T.secondary, lineHeight: 1.5 }}>
              <ShieldCheck size={13} color={T.caramel} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>Roles and permissions are managed by verified organization membership and cannot be changed from your profile.</span>
            </div>
          </div>

          {/* Organizations */}
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: '1.1rem 1.25rem', boxShadow: T.shadowSm, display: 'flex', flexDirection: 'column', gap: '0.55rem', overflow: 'hidden', minHeight: 0 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexShrink: 0 }}>
              <div>
                <span style={{ fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.caramel, display: 'block', marginBottom: '0.15rem' }}>MEMBERSHIPS</span>
                <h2 style={{ fontSize: '0.97rem', fontWeight: 700, color: T.espresso }}>Your Organizations</h2>
              </div>
              <Users size={18} color={T.caramel} />
            </div>

            {/* Org list — scrollable if many */}
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {organizations.length === 0 ? (
                <p style={{ color: T.secondary, fontSize: '0.82rem' }}>You are not connected to an organization yet.</p>
              ) : (
                organizations.map((org) => {
                  const vs = VSTATUS[org.verification_status] ?? VSTATUS.pending
                  const rs = RSTATUS[org.role] ?? RSTATUS.client
                  const roleLabel = org.role === 'owner' ? 'Manager' : org.role.charAt(0).toUpperCase() + org.role.slice(1)
                  return (
                    <div key={org.id} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.5rem 0.65rem', background: T.cream, border: `1px solid ${T.border}`, borderRadius: 10 }}>
                      <div style={{ width: 30, height: 30, borderRadius: 8, background: T.surface, border: `1px solid ${T.beige}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.brown, flexShrink: 0 }}>
                        <Building2 size={14} strokeWidth={1.8} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontWeight: 600, fontSize: '0.82rem', color: T.espresso, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{org.name}</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.15rem' }}>
                          {org.verification_status === 'approved' && <CheckCircle size={10} color="#1e6e3e" />}
                          <Pill s={vs}>{org.verification_status.charAt(0).toUpperCase() + org.verification_status.slice(1)}</Pill>
                        </div>
                      </div>
                      <Pill s={rs}>{roleLabel}</Pill>
                    </div>
                  )
                })
              )}
            </div>

            {/* Manage button */}
            <button
              onClick={() => navigate('/organizations')}
              style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.45rem', padding: '0.55rem 1rem', background: T.brown, color: '#FFFDF9', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: '0.83rem', cursor: 'pointer', fontFamily: 'inherit' }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = T.espresso)}
              onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = T.brown)}
            >
              <Users size={14} /> Manage organizations <ArrowRight size={13} />
            </button>
          </div>
        </div>

        {/* ============================================================
            SECURITY ROW
        ============================================================ */}
        <div style={{ flexShrink: 0, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: '0.9rem 1.25rem', boxShadow: T.shadowSm, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: T.cream, border: `1px solid ${T.beige}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.caramel, flexShrink: 0 }}>
            <ShieldCheck size={16} />
          </div>
          <div>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: T.espresso, marginBottom: '0.15rem' }}>Security Settings</h3>
            <p style={{ fontSize: '0.78rem', color: T.secondary, lineHeight: 1.5 }}>
              Password and profile editing are not exposed by the current backend API. Contact an administrator if your account details need to be changed.
            </p>
          </div>
        </div>

      </div>

      {/* Responsive */}
      <style>{`
        @media (max-width: 680px) {
          .profile-hero-grid { grid-template-columns: 1fr !important; }
          .profile-hero-illo { display: none; }
          .profile-info-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
