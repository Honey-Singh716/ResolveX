import React, { useEffect, useState } from 'react'
import {
  AlertCircle,
  ArrowRight,
  Building2,
  Clock,
  Key,
  Layers,
  Plus,
  Search,
  Sparkles,
  X,
} from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ErrorAlert } from '../components/ErrorAlert'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { useOrg } from '../context/OrgContext'
import { api } from '../services/api'
import type { CreateOrgData, MembershipRequest, OrganizationWithRole } from '../types/organization'

// ---------------------------------------------------------------------------
// Design tokens — warm cream palette
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
// Pill badge helper
// ---------------------------------------------------------------------------
function Pill({ bg, color, border, children }: { bg: string; color: string; border: string; children: React.ReactNode }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '0.18rem 0.65rem', fontSize: '0.72rem', fontWeight: 700,
      letterSpacing: '0.02em', textTransform: 'capitalize', borderRadius: 999,
      background: bg, color, border: `1px solid ${border}`, whiteSpace: 'nowrap',
    }}>
      {children}
    </span>
  )
}

const VSTATUS: Record<string, { bg: string; color: string; border: string; label: string }> = {
  approved:  { bg: '#e6f4ec', color: '#1e6e3e', border: '#a8d9b8', label: 'Approved'  },
  pending:   { bg: '#fef3c7', color: '#92400e', border: '#fcd34d', label: 'Pending'   },
  rejected:  { bg: '#fde8e8', color: '#b91c1c', border: '#fca5a5', label: 'Rejected'  },
  suspended: { bg: '#f3ede8', color: '#78675C', border: '#d4c5b8', label: 'Suspended' },
}
const RSTATUS: Record<string, { bg: string; color: string; border: string }> = {
  owner:   { bg: '#fef3c7', color: '#92400e', border: '#fcd34d' },
  admin:   { bg: '#e7f1fb', color: '#24598a', border: '#93c5fd' },
  manager: { bg: '#f0e8df', color: '#6b4226', border: '#d4b896' },
  staff:   { bg: '#f3ede8', color: '#78675C', border: '#d4c5b8' },
  member:  { bg: '#f3ede8', color: '#78675C', border: '#d4c5b8' },
  client:  { bg: '#f3ede8', color: '#78675C', border: '#d4c5b8' },
}

// ---------------------------------------------------------------------------
// Building SVG illustration — architectural line-art style, warm tones
// ---------------------------------------------------------------------------
function BuildingSVG() {
  return (
    <svg viewBox="0 0 110 96" xmlns="http://www.w3.org/2000/svg" style={{ width: 110, height: 96 }} aria-hidden="true">
      {/* Ground */}
      <rect x="0" y="80" width="110" height="16" fill="#F0E4D4" rx="2" />
      {/* Main building body */}
      <rect x="12" y="34" width="58" height="48" fill="#FFFDF9" stroke="#D4B896" strokeWidth="1.2" rx="2" />
      {/* Roof / pediment */}
      <polygon points="10,36 41,14 72,36" fill="#DBBF9E" stroke="#C9A87C" strokeWidth="0.8" />
      {/* Roof ridge line */}
      <line x1="10" y1="36" x2="72" y2="36" stroke="#C9A87C" strokeWidth="0.8" />
      {/* Door */}
      <rect x="31" y="58" width="20" height="24" fill="#C38B5E" rx="2" stroke="#A06B3C" strokeWidth="0.8" />
      <circle cx="48" cy="70" r="1.8" fill="#7A4B2A" />
      {/* Door arch */}
      <path d="M31,60 Q41,52 51,60" fill="none" stroke="#A06B3C" strokeWidth="0.8" />
      {/* Windows row 1 */}
      <rect x="16" y="42" width="13" height="12" fill="#D4EAFF" stroke="#D4B896" strokeWidth="0.8" rx="1" />
      <rect x="53" y="42" width="13" height="12" fill="#D4EAFF" stroke="#D4B896" strokeWidth="0.8" rx="1" />
      {/* Window cross bars */}
      <line x1="22" y1="42" x2="22" y2="54" stroke="#D4B896" strokeWidth="0.6" />
      <line x1="16" y1="48" x2="29" y2="48" stroke="#D4B896" strokeWidth="0.6" />
      <line x1="59" y1="42" x2="59" y2="54" stroke="#D4B896" strokeWidth="0.6" />
      <line x1="53" y1="48" x2="66" y2="48" stroke="#D4B896" strokeWidth="0.6" />
      {/* Side wing */}
      <rect x="70" y="52" width="28" height="30" fill="#FBF5EE" stroke="#D4B896" strokeWidth="1" rx="2" />
      <rect x="74" y="58" width="9" height="9" fill="#D4EAFF" stroke="#D4B896" strokeWidth="0.7" rx="1" />
      <rect x="85" y="58" width="9" height="9" fill="#D4EAFF" stroke="#D4B896" strokeWidth="0.7" rx="1" />
      {/* Path to door */}
      <rect x="37" y="80" width="8" height="16" fill="#DEC4A6" />
      {/* Small decorative steps */}
      <rect x="27" y="80" width="28" height="3" fill="#D4B896" rx="1" />
      <rect x="29" y="77" width="24" height="3" fill="#DBBF9E" rx="1" />
      {/* Flagpole */}
      <line x1="41" y1="6" x2="41" y2="14" stroke="#C9A87C" strokeWidth="1" />
      <polygon points="41,6 50,9 41,12" fill="#C38B5E" opacity="0.7" />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Modal wrapper — warm cream style
// ---------------------------------------------------------------------------
function WarmModal({ title, subtitle, onClose, children }: {
  title: string; subtitle?: string; onClose: () => void; children: React.ReactNode
}) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(56,37,28,0.42)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: '1.5rem' }}
      onClick={onClose}
    >
      <div
        style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 20, maxWidth: 520, width: '100%', padding: '1.8rem 2rem', boxShadow: '0 24px 56px rgba(56,37,28,0.18)', maxHeight: '90vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.18rem', fontWeight: 700, color: T.espresso, marginBottom: subtitle ? '0.3rem' : 0 }}>{title}</h2>
            {subtitle && <p style={{ color: T.secondary, fontSize: '0.82rem', lineHeight: 1.5, maxWidth: '90%' }}>{subtitle}</p>}
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: T.secondary, padding: '0.15rem', display: 'flex', flexShrink: 0 }}>
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

// Shared form field styles
const inp: React.CSSProperties = {
  width: '100%', padding: '0.58rem 0.85rem',
  background: T.cream, border: `1px solid ${T.border}`,
  borderRadius: 10, color: T.espresso, fontSize: '0.85rem',
  outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
  transition: 'border-color 0.15s',
}
const lbl: React.CSSProperties = { display: 'block', fontSize: '0.8rem', fontWeight: 600, color: T.espresso, marginBottom: '0.3rem' }
const fg: React.CSSProperties = { marginBottom: '0.9rem' }

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export const OrganizationsPage: React.FC = () => {
  const { organizations, isLoading, selectOrg, refreshOrgs } = useOrg()
  const navigate = useNavigate()
  const location = useLocation()

  const [search, setSearch] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false)

  // Create org
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [industry, setIndustry] = useState('')
  const [officialEmailDomain, setOfficialEmailDomain] = useState('')
  const [officialWebsite, setOfficialWebsite] = useState('')
  const [proofDocumentReference, setProofDocumentReference] = useState('')
  const [contactPhone, setContactPhone] = useState('')

  // Join
  const [joinCode, setJoinCode] = useState('')

  const [error, setError] = useState<string | null>(null)
  const [joinSuccess, setJoinSuccess] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [myRequests, setMyRequests] = useState<MembershipRequest[]>([])

  const loadMyRequests = async () => {
    try {
      const res = await api.organizations.getMyMembershipRequests()
      setMyRequests(res.requests || [])
    } catch { /* non-blocking */ }
  }

  useEffect(() => { loadMyRequests() }, [])

  useEffect(() => {
    const openModal = (location.state as { open?: 'join' | 'create' } | null)?.open
    if (openModal === 'join') setIsJoinModalOpen(true)
    else if (openModal === 'create') setIsModalOpen(true)
    else return
    navigate(location.pathname, { replace: true, state: null })
  }, [location, navigate])

  const handleSelect = (org: OrganizationWithRole) => {
    if (org.verification_status !== 'approved') return
    selectOrg(org.id)
    navigate(`/org/${org.id}/issues`)
  }

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null)
    if (name.trim().length < 3) { setError('Organization name must be at least 3 characters.'); return }
    if (!officialEmailDomain.trim() || !officialWebsite.trim() || !proofDocumentReference.trim() || !contactPhone.trim()) {
      setError('All organization verification details are required.'); return
    }
    try {
      setIsSubmitting(true)
      const data: CreateOrgData = {
        name: name.trim(), industry: industry.trim() || undefined,
        slug: slug.trim() || undefined,
        official_email_domain: officialEmailDomain.trim().toLowerCase(),
        official_website: officialWebsite.trim(),
        proof_document_reference: proofDocumentReference.trim(),
        contact_phone: contactPhone.trim(),
      }
      const newOrg = await api.organizations.create(data)
      await refreshOrgs(); selectOrg(newOrg.id)
      setIsModalOpen(false); navigate(`/org/${newOrg.id}/issues`)
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed to create organization.') }
    finally { setIsSubmitting(false) }
  }

  const handleJoinByCode = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null); setJoinSuccess(null)
    if (!joinCode.trim()) { setError('Please provide a valid join code.'); return }
    try {
      setIsSubmitting(true)
      const req = await api.organizations.joinByCode(joinCode.trim())
      setJoinSuccess(`Join request submitted for ${req.organization_name || 'the organization'}! Pending admin review.`)
      setJoinCode(''); setIsJoinModalOpen(false)
      await loadMyRequests(); await refreshOrgs()
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed to submit join code.') }
    finally { setIsSubmitting(false) }
  }

  const filtered = organizations.filter((o) =>
    !search.trim() ||
    o.name.toLowerCase().includes(search.toLowerCase()) ||
    o.slug.toLowerCase().includes(search.toLowerCase()) ||
    (o.industry || '').toLowerCase().includes(search.toLowerCase())
  )

  if (isLoading) return <LoadingSpinner fullPage label="Loading your organizations…" />

  return (
    /* Warm off-white page background */
    <div className="org-page" style={{ background: '#FAF6F0', margin: '-2rem -1.5rem', padding: '1.75rem 1.5rem 4rem', minHeight: 'calc(100vh - 68px)', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>

        {/* ==============================================================
            HERO BANNER
        ============================================================== */}
        <div
          style={{
            position: 'relative', overflow: 'hidden', borderRadius: 18,
            border: `1px solid ${T.border}`, marginBottom: '2rem',
            boxShadow: T.shadow,
            /* Warm horizontal gradient matching screenshot */
            background: `linear-gradient(110deg, #F5EAD8 0%, #F2E0C8 40%, #EDD4B4 70%, #E8CAA0 100%)`,
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) minmax(220px, 420px)',
            minHeight: 210,
          }}
          className="org-hero-grid"
        >
          {/* Left text */}
          <div style={{ padding: '2rem 2.2rem 2rem', display: 'flex', flexDirection: 'column', justifyContent: 'center', position: 'relative', zIndex: 2 }}>
            {/* Eyebrow pill */}
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
              fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.12em',
              textTransform: 'uppercase', color: T.brown,
              background: 'rgba(255,253,249,0.85)', border: `1px solid ${T.beige}`,
              borderRadius: 99, padding: '0.22rem 0.7rem',
              alignSelf: 'flex-start', marginBottom: '0.8rem',
            }}>
              ORGANIZATIONS
            </span>

            <h1 style={{ fontSize: 'clamp(1.55rem, 3vw, 2.1rem)', fontWeight: 800, color: T.espresso, lineHeight: 1.15, letterSpacing: '-0.025em', marginBottom: '0.45rem' }}>
              Organization Workspaces
            </h1>
            <p style={{ color: T.secondary, fontSize: '0.88rem', lineHeight: 1.55, marginBottom: '1.4rem' }}>
              Select an organization, join via invite code, or create a new workspace.
            </p>

            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              {/* Primary — dark brown */}
              <button
                onClick={() => { setError(null); setIsJoinModalOpen(true) }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.25rem', background: T.espresso, color: '#FFFDF9', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}
              >
                <Key size={15} /> Join with Code
              </button>
              {/* Secondary — white */}
              <button
                onClick={() => { setError(null); setIsModalOpen(true) }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.25rem', background: T.surface, color: T.espresso, border: `1.5px solid ${T.border}`, borderRadius: 10, fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}
              >
                <Plus size={15} /> New Organization
              </button>
            </div>
          </div>

          {/* Right: org-hero.png photo */}
          <div style={{ position: 'relative', overflow: 'hidden' }} className="org-hero-photo">
            <img
              src="/portal/org-hero.png"
              alt="Organization workspace"
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center left' }}
            />
            {/* Left-side fade blending into the gradient */}
            <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, #F2E0C8 0%, rgba(242,224,200,0.55) 18%, rgba(242,224,200,0) 42%)' }} />
          </div>
        </div>

        {/* Error / success */}
        <ErrorAlert message={error} onDismiss={() => setError(null)} />
        {joinSuccess && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '0.75rem 1rem', background: '#e6f4ec', border: '1px solid #a8d9b8', borderRadius: 12, marginBottom: '1.1rem', color: '#1e6e3e', fontSize: '0.84rem' }}>
            <span>{joinSuccess}</span>
            <button onClick={() => setJoinSuccess(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#1e6e3e', display: 'flex' }}><X size={15} /></button>
          </div>
        )}

        {/* ==============================================================
            MY ORGANIZATIONS heading + search
        ============================================================== */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
            <Building2 size={20} color={T.espresso} strokeWidth={1.8} />
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: T.espresso, letterSpacing: '-0.01em' }}>My Organizations</h2>
          </div>

          {/* Search — pill shape matching screenshot */}
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: T.caramel, pointerEvents: 'none' }} />
            <input
              type="search"
              placeholder="Search organizations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                paddingLeft: 34, paddingRight: 14, paddingTop: '0.52rem', paddingBottom: '0.52rem',
                background: T.surface, border: `1.5px solid ${T.border}`,
                borderRadius: 99, color: T.espresso, fontSize: '0.84rem',
                outline: 'none', width: 260, fontFamily: 'inherit',
                boxShadow: T.shadowSm,
              }}
            />
          </div>
        </div>

        {/* ==============================================================
            ORGANIZATION CARDS
        ============================================================== */}
        {filtered.length === 0 && organizations.length === 0 ? (
          /* Empty state */
          <div style={{ textAlign: 'center', padding: '3.5rem 2rem', background: T.surface, border: `1px solid ${T.border}`, borderRadius: 20, boxShadow: T.shadowSm }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: T.cream, border: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
              <Building2 size={26} color={T.caramel} />
            </div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: T.espresso, marginBottom: '0.4rem' }}>No organizations yet</h3>
            <p style={{ color: T.secondary, fontSize: '0.84rem', marginBottom: '1.4rem', maxWidth: 380, margin: '0 auto 1.4rem' }}>
              Join an existing organization using an invitation code or request a new workspace.
            </p>
            <div style={{ display: 'flex', gap: '0.65rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button onClick={() => setIsJoinModalOpen(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', padding: '0.58rem 1.15rem', background: T.espresso, color: '#fffdf9', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: '0.87rem', cursor: 'pointer', fontFamily: 'inherit' }}><Key size={14} /> Join with Code</button>
              <button onClick={() => setIsModalOpen(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', padding: '0.58rem 1.15rem', background: T.surface, color: T.espresso, border: `1.5px solid ${T.border}`, borderRadius: 10, fontWeight: 700, fontSize: '0.87rem', cursor: 'pointer', fontFamily: 'inherit' }}><Sparkles size={14} /> New Organization</button>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <p style={{ color: T.secondary, fontSize: '0.88rem', padding: '1rem 0' }}>No organizations match "{search}".</p>
        ) : (
          <div
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: '1rem' }}
            className="org-cards-grid"
          >
            {filtered.map((org) => {
              const vs = VSTATUS[org.verification_status] ?? VSTATUS.pending
              const rs = RSTATUS[org.role] ?? RSTATUS.client
              const canEnter = org.verification_status === 'approved'
              const roleLabel = org.role === 'owner' ? 'Manager' : org.role.charAt(0).toUpperCase() + org.role.slice(1)

              return (
                <div
                  key={org.id}
                  style={{
                    background: T.surface,
                    border: `1px solid ${T.border}`,
                    borderRadius: 18,
                    boxShadow: T.shadowSm,
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    transition: 'box-shadow 0.2s, transform 0.2s',
                  }}
                  onMouseEnter={(e) => { if (canEnter) { const el = e.currentTarget as HTMLElement; el.style.boxShadow = '0 8px 32px rgba(56,37,28,0.13)'; el.style.transform = 'translateY(-2px)' } }}
                  onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.boxShadow = T.shadowSm; el.style.transform = 'none' }}
                >
                  {/* Card body */}
                  <div style={{ padding: '1.1rem 1.15rem 0.9rem', flex: 1, display: 'flex', gap: '0', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* Icon + badges row */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                        <div style={{ width: 40, height: 40, borderRadius: 12, background: T.cream, border: `1px solid ${T.beige}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.brown, flexShrink: 0 }}>
                          <Building2 size={19} strokeWidth={1.8} />
                        </div>
                        <Pill bg={vs.bg} color={vs.color} border={vs.border}>{vs.label}</Pill>
                        <Pill bg={rs.bg} color={rs.color} border={rs.border}>{roleLabel}</Pill>
                      </div>

                      {/* Name */}
                      <h3 style={{ fontSize: '1rem', fontWeight: 700, color: T.espresso, lineHeight: 1.3, marginBottom: '0.22rem', wordBreak: 'break-word' }}>
                        {org.name}
                      </h3>

                      {/* Slug */}
                      <p style={{ fontSize: '0.74rem', color: T.secondary, marginBottom: '0.55rem', wordBreak: 'break-all' }}>
                        Slug: {org.slug}
                      </p>

                      {/* Industry */}
                      {org.industry && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', color: T.secondary }}>
                          <Layers size={13} color={T.caramel} strokeWidth={2} />
                          Industry: <strong style={{ color: T.espresso, fontWeight: 600, marginLeft: 2 }}>{org.industry}</strong>
                        </div>
                      )}

                      {/* Status notices */}
                      {org.verification_status === 'pending' && (
                        <div style={{ marginTop: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.74rem', color: '#92400e', background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 8, padding: '0.28rem 0.6rem' }}>
                          <Clock size={11} /> Awaiting platform verification
                        </div>
                      )}
                      {org.verification_status === 'rejected' && (
                        <div style={{ marginTop: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.74rem', color: '#b91c1c', background: '#fde8e8', border: '1px solid #fca5a5', borderRadius: 8, padding: '0.28rem 0.6rem' }}>
                          <AlertCircle size={11} /> {org.rejection_reason || 'Verification rejected'}
                        </div>
                      )}
                      {org.verification_status === 'suspended' && (
                        <div style={{ marginTop: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.74rem', color: '#78675C', background: '#f3ede8', border: '1px solid #d4c5b8', borderRadius: 8, padding: '0.28rem 0.6rem' }}>
                          <AlertCircle size={11} /> Organization is suspended
                        </div>
                      )}
                    </div>


                  </div>

                  {/* Card footer: Enter Workspace */}
                  <div
                    style={{
                      borderTop: `1px solid ${T.border}`,
                      padding: '0.65rem 1.15rem',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      cursor: canEnter ? 'pointer' : 'default',
                      background: canEnter ? 'transparent' : T.bg,
                    }}
                    onClick={() => canEnter && handleSelect(org)}
                  >
                    <span style={{ fontSize: '0.87rem', fontWeight: 700, color: canEnter ? T.brown : T.secondary }}>
                      {canEnter ? 'Enter Workspace' : org.verification_status === 'pending' ? 'Pending approval' : 'Unavailable'}
                    </span>
                    {canEnter && <ArrowRight size={17} color={T.brown} strokeWidth={2.2} />}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Pending join requests */}
        {myRequests.length > 0 && (
          <div style={{ marginTop: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem' }}>
              <Clock size={16} color={T.caramel} />
              <h2 style={{ fontSize: '1rem', fontWeight: 700, color: T.espresso }}>Your Join Requests</h2>
            </div>
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, overflow: 'hidden', boxShadow: T.shadowSm }}>
              {myRequests.map((req, idx) => (
                <div key={req.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.8rem 1.1rem', borderBottom: idx < myRequests.length - 1 ? `1px solid ${T.border}` : 'none', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 600, fontSize: '0.85rem', color: T.espresso }}>{req.organization_name || 'Organization'}</p>
                    <p style={{ fontSize: '0.73rem', color: T.secondary, marginTop: '0.1rem' }}>{new Date(req.created_at).toLocaleDateString()}</p>
                  </div>
                  {(() => { const s = VSTATUS[req.status] ?? VSTATUS.pending; return <Pill bg={s.bg} color={s.color} border={s.border}>{req.status}</Pill> })()}
                  {(() => { const r = RSTATUS[req.role] ?? RSTATUS.client; return <Pill bg={r.bg} color={r.color} border={r.border}>{req.role}</Pill> })()}
                  {req.rejection_reason && <span style={{ fontSize: '0.74rem', color: '#b91c1c' }}>{req.rejection_reason}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bottom organic wave decoration */}
        <div style={{ marginTop: '3rem', marginLeft: '-1.5rem', marginRight: '-1.5rem', overflow: 'hidden', lineHeight: 0, pointerEvents: 'none' }} aria-hidden="true">
          <svg viewBox="0 0 1440 130" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', display: 'block' }}>
            <path d="M0,65 C200,110 400,20 640,70 C880,120 1100,15 1440,65 L1440,130 L0,130 Z" fill="#EDD4B4" opacity="0.5" />
            <path d="M0,90 C300,40 600,120 900,65 C1150,20 1320,95 1440,85 L1440,130 L0,130 Z" fill="#F5E4CC" opacity="0.6" />
          </svg>
        </div>
      </div>

      {/* Responsive */}
      <style>{`
        @media (max-width: 680px) {
          .org-hero-grid  { grid-template-columns: 1fr !important; }
          .org-hero-photo { display: none; }
          .org-cards-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 900px) {
          .org-hero-grid { grid-template-columns: minmax(0,1fr) minmax(160px,280px) !important; }
        }
      `}</style>

      {/* ================================================================
          JOIN MODAL
      ================================================================ */}
      {isJoinModalOpen && (
        <WarmModal
          title="Join Organization with Code"
          subtitle="Enter the join code shared by your organization admin. Your request will be reviewed before approval."
          onClose={() => { setIsJoinModalOpen(false); setError(null) }}
        >
          <div style={{ background: T.cream, border: `1px solid ${T.border}`, borderRadius: 10, padding: '0.6rem 0.85rem', marginBottom: '1rem', fontSize: '0.78rem', color: T.secondary, lineHeight: 1.55 }}>
            <strong style={{ color: T.brown }}>How it works: </strong>
            Submit code → Admin reviews & approves → You become a Client member → Post issues.
          </div>
          <ErrorAlert message={error} onDismiss={() => setError(null)} />
          <form onSubmit={handleJoinByCode}>
            <div style={fg}>
              <label style={lbl} htmlFor="joinCode">Organization Join Code *</label>
              <input id="joinCode" type="text" placeholder="e.g. RX-D31ABFEE" value={joinCode} onChange={(e) => setJoinCode(e.target.value)} required autoFocus style={inp} onFocus={(e) => (e.currentTarget.style.borderColor = T.caramel)} onBlur={(e) => (e.currentTarget.style.borderColor = T.border)} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '1.1rem' }}>
              <button type="button" onClick={() => { setIsJoinModalOpen(false); setError(null) }} disabled={isSubmitting} style={{ display: 'inline-flex', alignItems: 'center', padding: '0.55rem 1rem', background: T.surface, color: T.espresso, border: `1.5px solid ${T.border}`, borderRadius: 9, fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
              <button type="submit" disabled={isSubmitting} style={{ display: 'inline-flex', alignItems: 'center', padding: '0.55rem 1.1rem', background: T.espresso, color: '#fffdf9', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: '0.85rem', cursor: isSubmitting ? 'not-allowed' : 'pointer', opacity: isSubmitting ? 0.6 : 1, fontFamily: 'inherit' }}>
                {isSubmitting ? 'Submitting…' : 'Request to Join'}
              </button>
            </div>
          </form>
        </WarmModal>
      )}

      {/* ================================================================
          CREATE ORG MODAL
      ================================================================ */}
      {isModalOpen && (
        <WarmModal
          title="Create New Organization"
          subtitle="New organizations require platform administrator verification before going live."
          onClose={() => { setIsModalOpen(false); setError(null) }}
        >
          <ErrorAlert message={error} onDismiss={() => setError(null)} />
          <form onSubmit={handleCreateOrg}>
            <div style={fg}><label style={lbl} htmlFor="orgName">Organization Name *</label><input id="orgName" type="text" placeholder="e.g. Stanford University IT" value={name} onChange={(e) => setName(e.target.value)} required style={inp} onFocus={(e) => (e.currentTarget.style.borderColor = T.caramel)} onBlur={(e) => (e.currentTarget.style.borderColor = T.border)} /></div>
            <div style={fg}><label style={lbl} htmlFor="orgDomain">Official Email Domain *</label><input id="orgDomain" type="text" placeholder="example.org" value={officialEmailDomain} onChange={(e) => setOfficialEmailDomain(e.target.value)} required style={inp} onFocus={(e) => (e.currentTarget.style.borderColor = T.caramel)} onBlur={(e) => (e.currentTarget.style.borderColor = T.border)} /></div>
            <div style={fg}><label style={lbl} htmlFor="orgWebsite">Official Website *</label><input id="orgWebsite" type="url" placeholder="https://example.org" value={officialWebsite} onChange={(e) => setOfficialWebsite(e.target.value)} required style={inp} onFocus={(e) => (e.currentTarget.style.borderColor = T.caramel)} onBlur={(e) => (e.currentTarget.style.borderColor = T.border)} /></div>
            <div style={fg}><label style={lbl} htmlFor="orgProof">Proof Document Reference *</label><input id="orgProof" type="text" placeholder="Secure document URL or storage reference" value={proofDocumentReference} onChange={(e) => setProofDocumentReference(e.target.value)} required style={inp} onFocus={(e) => (e.currentTarget.style.borderColor = T.caramel)} onBlur={(e) => (e.currentTarget.style.borderColor = T.border)} /></div>
            <div style={fg}><label style={lbl} htmlFor="orgPhone">Contact Phone *</label><input id="orgPhone" type="tel" placeholder="+1 555 123 4567" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} required style={inp} onFocus={(e) => (e.currentTarget.style.borderColor = T.caramel)} onBlur={(e) => (e.currentTarget.style.borderColor = T.border)} /></div>
            <div style={fg}>
              <label style={lbl} htmlFor="orgIndustry">Industry / Domain (Optional)</label>
              <select id="orgIndustry" value={industry} onChange={(e) => setIndustry(e.target.value)} style={{ ...inp, cursor: 'pointer' }}>
                <option value="">Select industry…</option>
                <option value="Education">Education &amp; Academic</option>
                <option value="Healthcare">Healthcare &amp; Medicine</option>
                <option value="Finance">Finance &amp; Banking</option>
                <option value="Technology">Technology &amp; Software</option>
                <option value="Government">Government &amp; Public Sector</option>
                <option value="Retail">Retail &amp; E-commerce</option>
                <option value="Manufacturing">Manufacturing &amp; Supply Chain</option>
                <option value="Property Management">Property Management</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div style={fg}><label style={lbl} htmlFor="orgSlug">Custom Workspace Slug (Optional)</label><input id="orgSlug" type="text" placeholder="auto-generated if empty" value={slug} onChange={(e) => setSlug(e.target.value)} style={inp} onFocus={(e) => (e.currentTarget.style.borderColor = T.caramel)} onBlur={(e) => (e.currentTarget.style.borderColor = T.border)} /></div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '1.1rem' }}>
              <button type="button" onClick={() => { setIsModalOpen(false); setError(null) }} disabled={isSubmitting} style={{ display: 'inline-flex', alignItems: 'center', padding: '0.55rem 1rem', background: T.surface, color: T.espresso, border: `1.5px solid ${T.border}`, borderRadius: 9, fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
              <button type="submit" disabled={isSubmitting} style={{ display: 'inline-flex', alignItems: 'center', padding: '0.55rem 1.1rem', background: T.espresso, color: '#fffdf9', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: '0.85rem', cursor: isSubmitting ? 'not-allowed' : 'pointer', opacity: isSubmitting ? 0.6 : 1, fontFamily: 'inherit' }}>
                {isSubmitting ? 'Creating…' : 'Create Workspace'}
              </button>
            </div>
          </form>
        </WarmModal>
      )}
    </div>
  )
}
