import React, { useEffect, useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CalendarCheck,
  CalendarX2,
  CheckCircle2,
  ClipboardList,
  Copy,
  ExternalLink,
  Key,
  Layers,
  RefreshCw,
  Trash2,
  UserCheck,
  UserPlus,
  UserX,
  Users,
  X,
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'
import { ErrorAlert } from '../components/ErrorAlert'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { useOrg } from '../context/OrgContext'
import { api } from '../services/api'
import type { IssueResponse } from '../types/issue'
import type { MembershipRequest, OrgRole } from '../types/organization'

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
// Status / Priority pill helpers
// ---------------------------------------------------------------------------
const STATUS_S: Record<string, { bg: string; color: string; border: string }> = {
  open:        { bg: '#e7f1fb', color: '#24598a', border: '#b3d4f5' },
  in_progress: { bg: '#fef3c7', color: '#92400e', border: '#fcd34d' },
  resolved:    { bg: '#e5f6ea', color: '#2f7d4a', border: '#b3dfc1' },
  closed:      { bg: '#f3ede8', color: '#78675C', border: '#d4c5b8' },
}
const PRI_S: Record<string, { bg: string; color: string; border: string }> = {
  urgent: { bg: '#fde8e8', color: '#b91c1c', border: '#fca5a5' },
  high:   { bg: '#fff0e6', color: '#9a3412', border: '#fdba74' },
  medium: { bg: '#e7f1fb', color: '#24598a', border: '#93c5fd' },
  low:    { bg: '#f3ede8', color: '#78675C', border: '#d4c5b8' },
}
function Pill({ s, children }: { s: { bg: string; color: string; border: string }; children: React.ReactNode }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '0.18rem 0.6rem', fontSize: '0.7rem', fontWeight: 700, textTransform: 'capitalize', borderRadius: 99, background: s.bg, color: s.color, border: `1px solid ${s.border}`, whiteSpace: 'nowrap' }}>
      {children}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------
function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.85rem', boxShadow: T.shadowSm }}>
      <div style={{ width: 40, height: 40, borderRadius: 11, background: T.cream, border: `1px solid ${T.beige}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.caramel, flexShrink: 0 }}>
        {icon}
      </div>
      <div>
        <p style={{ fontSize: '0.74rem', color: T.secondary, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</p>
        <p style={{ fontSize: '1.55rem', fontWeight: 800, color, lineHeight: 1.1 }}>{value}</p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export const OrgDashboardPage: React.FC = () => {
  const { currentOrg, isAdmin, userRole } = useOrg()
  const navigate = useNavigate()

  const [issues, setIssues] = useState<IssueResponse[]>([])
  const [membershipRequests, setMembershipRequests] = useState<MembershipRequest[]>([])
  const [activeJoinCode, setActiveJoinCode] = useState<string | null>(null)
  const [joinCodeCreatedAt, setJoinCodeCreatedAt] = useState<string | null>(null)
  const [copiedCode, setCopiedCode] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [actionInProgress, setActionInProgress] = useState<string | null>(null)

  const orgId = currentOrg?.id
  const isOwner = currentOrg?.role === 'owner'

  const loadOrgData = async () => {
    if (!orgId) return
    try {
      setIsLoading(true); setError(null)
      const issuesRes = await api.issues.list(orgId, { page: 1, page_size: 50 })
      setIssues(issuesRes.issues || [])
      if (userRole === 'owner' || userRole === 'admin' || userRole === 'staff') {
        try {
          const codeRes = await api.organizations.getJoinCode(orgId)
          setActiveJoinCode(codeRes.join_code)
          setJoinCodeCreatedAt(codeRes.created_at ? String(codeRes.created_at) : null)
        } catch { setActiveJoinCode(null) }
        try {
          const reqsRes = await api.organizations.listMembershipRequests(orgId)
          setMembershipRequests(reqsRes.requests || [])
        } catch { setMembershipRequests([]) }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load organization workspace data.')
    } finally { setIsLoading(false) }
  }

  useEffect(() => { loadOrgData() }, [orgId, isAdmin, userRole])

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code)
    setCopiedCode(true)
    setTimeout(() => setCopiedCode(false), 2000)
  }

  const handleOwnershipTransfer = async () => {
    if (!orgId) return
    const targetUserId = window.prompt('Enter the member user ID to offer ownership:')
    if (!targetUserId) return
    try {
      setActionInProgress('ownership')
      await api.organizations.requestOwnershipTransfer(orgId, targetUserId.trim())
      setSuccessMsg('Ownership transfer offered. The member must accept it.')
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed to offer ownership transfer.') }
    finally { setActionInProgress(null) }
  }

  const handleDeletionRequest = async () => {
    if (!orgId) return
    if (!window.confirm('Schedule this organization for archival after a 7-day grace period?')) return
    try {
      setActionInProgress('deletion')
      const res = await api.organizations.requestDeletion(orgId)
      setSuccessMsg(`Archival scheduled for ${res.scheduled_for ? new Date(res.scheduled_for).toLocaleString() : 'seven days from now'}.`)
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed to schedule archival.') }
    finally { setActionInProgress(null) }
  }

  const handleDeletionCancellation = async () => {
    if (!orgId) return
    try {
      setActionInProgress('deletion')
      await api.organizations.cancelDeletion(orgId)
      setSuccessMsg('Organization archival cancelled.')
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed to cancel archival.') }
    finally { setActionInProgress(null) }
  }

  const handleApproveRequest = async (requestId: string, role: OrgRole) => {
    if (!orgId) return
    try {
      setActionInProgress(requestId); setError(null)
      await api.organizations.approveMembershipRequest(orgId, requestId, role)
      setSuccessMsg(`Membership approved with role '${role}'.`)
      await loadOrgData()
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed to approve request.') }
    finally { setActionInProgress(null) }
  }

  const handleRejectRequest = async (requestId: string) => {
    if (!orgId) return
    try {
      setActionInProgress(requestId); setError(null)
      await api.organizations.rejectMembershipRequest(orgId, requestId)
      setSuccessMsg('Membership request rejected.')
      await loadOrgData()
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed to reject request.') }
    finally { setActionInProgress(null) }
  }

  if (isLoading) return <LoadingSpinner fullPage label="Loading organization dashboard..." />

  if (!currentOrg) {
    return (
      <EmptyState title="No organization selected" description="Select an active approved organization."
        action={<button onClick={() => navigate('/client/dashboard')} className="btn btn-primary">Back to Client Portal</button>} />
    )
  }

  const totalIssues     = issues.length
  const openIssues      = issues.filter((i) => i.status === 'open').length
  const inProgressIssues= issues.filter((i) => i.status === 'in_progress').length
  const resolvedIssues  = issues.filter((i) => ['resolved','closed'].includes(i.status)).length
  const urgentIssues    = issues.filter((i) => i.priority === 'urgent').length

  const isApproved = currentOrg.verification_status === 'approved'

  return (
    <div style={{ maxWidth: 1060, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>

      {/* ================================================================
          HERO CARD
      ================================================================ */}
      <div style={{
        background: 'linear-gradient(115deg, #F5EAD8 0%, #F0E0C8 45%, #EDD4B4 75%, #E8CAA0 100%)',
        border: `1px solid ${T.border}`, borderRadius: 20,
        boxShadow: T.shadow,
        display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(160px,280px)',
        overflow: 'hidden', position: 'relative', minHeight: 200,
      }} className="org-hero-grid">
        {/* Left */}
        <div style={{ padding: '1.5rem 1.75rem', display: 'flex', flexDirection: 'column', justifyContent: 'center', zIndex: 2 }}>
          {/* Badges */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.brown, background: 'rgba(255,253,249,0.85)', border: `1px solid ${T.beige}`, borderRadius: 99, padding: '0.18rem 0.65rem' }}>
              ORGANIZATION WORKSPACE
            </span>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: T.brown, background: T.beige, border: `1px solid ${T.border}`, borderRadius: 99, padding: '0.18rem 0.65rem', textTransform: 'capitalize' }}>
              {currentOrg.role === 'owner' ? 'Manager' : currentOrg.role.charAt(0).toUpperCase() + currentOrg.role.slice(1)}
            </span>
          </div>

          {/* Org name */}
          <h1 style={{ fontSize: 'clamp(1.3rem, 2.5vw, 1.9rem)', fontWeight: 800, color: T.espresso, lineHeight: 1.15, letterSpacing: '-0.02em', marginBottom: '0.3rem' }}>
            {currentOrg.name}
          </h1>
          <p style={{ color: T.secondary, fontSize: '0.85rem', marginBottom: '1.2rem' }}>
            Slug: <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.82rem' }}>{currentOrg.slug}</span>
            {currentOrg.industry && ` • Industry: ${currentOrg.industry}`}
          </p>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
            <Link to={`/org/${currentOrg.id}/issues`}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.48rem 1rem', background: T.espresso, color: '#FFFDF9', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: '0.83rem', textDecoration: 'none', whiteSpace: 'nowrap' }}>
              <Layers size={14} /> Issues Queue
            </Link>
            <Link to={`/org/${currentOrg.id}/members`}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.48rem 1rem', background: T.surface, color: T.espresso, border: `1.5px solid ${T.border}`, borderRadius: 10, fontWeight: 600, fontSize: '0.83rem', textDecoration: 'none', whiteSpace: 'nowrap' }}>
              <Users size={14} /> Team Roster
            </Link>
            {isOwner && (
              <>
                <button onClick={handleOwnershipTransfer} disabled={actionInProgress === 'ownership'}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.48rem 1rem', background: T.surface, color: T.espresso, border: `1.5px solid ${T.border}`, borderRadius: 10, fontWeight: 600, fontSize: '0.83rem', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                  <UserPlus size={14} /> Transfer Ownership
                </button>
                <button onClick={currentOrg.deletion_scheduled_for ? handleDeletionCancellation : handleDeletionRequest} disabled={actionInProgress === 'deletion'}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.48rem 1rem', background: T.surface, color: T.espresso, border: `1.5px solid ${T.border}`, borderRadius: 10, fontWeight: 600, fontSize: '0.83rem', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                  <CalendarX2 size={14} /> {currentOrg.deletion_scheduled_for ? 'Cancel Archival' : 'Schedule Archival'}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Right: building illustration photo */}
        <div style={{ position: 'relative', overflow: 'hidden' }} className="org-hero-illo">
          <img
            src="/portal/org-building-hero.png"
            alt="Organization building"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'right center' }}
          />
          <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, #F0E0C8 0%, rgba(240,224,200,0.5) 20%, rgba(240,224,200,0) 45%)' }} />
        </div>

        {/* Wave */}
        <svg viewBox="0 0 600 200" xmlns="http://www.w3.org/2000/svg" style={{ position: 'absolute', right: 0, bottom: 0, width: '55%', height: '100%', opacity: 0.25, pointerEvents: 'none', zIndex: 1 }} aria-hidden="true">
          <path d="M600,0 Q380,100 600,200 Z" fill="#D4A050" />
        </svg>
      </div>

      {/* Alerts */}
      <ErrorAlert message={error} onDismiss={() => setError(null)} />
      {successMsg && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '0.75rem 1.1rem', background: '#e6f4ec', border: '1px solid #a8d9b8', borderRadius: 12, color: '#1e6e3e', fontSize: '0.85rem' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><CheckCircle2 size={15} />{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#1e6e3e', display: 'flex' }}><X size={14} /></button>
        </div>
      )}

      {/* ================================================================
          STAT CARDS
      ================================================================ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: '0.75rem' }} className="org-stats-grid">
        <StatCard icon={<ClipboardList size={18} />} label="Total Org Issues" value={totalIssues}      color={T.espresso}  />
        <StatCard icon={<Layers size={18} />}        label="Open / Triage"   value={openIssues}        color="#24598a"     />
        <StatCard icon={<RefreshCw size={18} />}     label="In Progress"     value={inProgressIssues}  color="#92400e"     />
        <StatCard icon={<CheckCircle2 size={18} />}  label="Resolved/Closed" value={resolvedIssues}    color="#2f7d4a"     />
        <StatCard icon={<AlertTriangle size={18} />} label="Urgent Priority" value={urgentIssues}      color="#b91c1c"     />
      </div>

      {/* ================================================================
          IDENTITY + PENDING REQUESTS (two columns, admin only)
      ================================================================ */}
      {isAdmin && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: '1rem' }} className="org-identity-grid">

          {/* Organization Identity */}
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 18, padding: '1.25rem 1.4rem', boxShadow: T.shadowSm }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
              <Key size={17} color={T.brown} />
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: T.espresso }}>Organization Identity</h3>
            </div>
            <p style={{ color: T.secondary, fontSize: '0.8rem', lineHeight: 1.5, marginBottom: '1rem' }}>
              Share the invitation code with clients so they can request membership.
            </p>

            {/* Invitation code box */}
            {activeJoinCode ? (
              <>
                <div style={{ background: T.cream, border: `1px solid ${T.beige}`, borderRadius: 12, padding: '0.8rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <div>
                    <p style={{ fontSize: '0.65rem', fontWeight: 700, color: T.caramel, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.2rem' }}>Invitation Code</p>
                    <p style={{ fontSize: '1.3rem', fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: T.espresso, letterSpacing: '0.05em' }}>{activeJoinCode}</p>
                  </div>
                  <button onClick={() => handleCopyCode(activeJoinCode)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.85rem', background: T.surface, color: T.espresso, border: `1.5px solid ${T.border}`, borderRadius: 9, fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'inherit' }}>
                    <Copy size={13} /> {copiedCode ? 'Copied!' : 'Copy'}
                  </button>
                </div>

                {/* Approved pill */}
                {isApproved && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', background: '#e6f4ec', border: '1px solid #a8d9b8', borderRadius: 10, marginBottom: '0.9rem' }}>
                    <CheckCircle2 size={14} color="#1e6e3e" />
                    <div>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1e6e3e' }}>Organization Approved</span>
                      <span style={{ fontSize: '0.75rem', color: '#2f7d4a', marginLeft: '0.5rem' }}>Students can now request to join using this code.</span>
                    </div>
                  </div>
                )}

                {/* Metadata grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                  {[
                    { icon: <CalendarCheck size={13} />, label: 'Created On', value: new Date(currentOrg.created_at || '').toLocaleString() },
                    { icon: <UserCheck size={13} />, label: 'Approved On', value: currentOrg.verified_at ? new Date(currentOrg.verified_at).toLocaleString() : '—' },
                    { icon: <UserPlus size={13} />, label: 'Created By', value: 'Honey Singh' },
                    { icon: <UserCheck size={13} />, label: 'Approved By', value: 'Platform Admin' },
                  ].map((item, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.4rem' }}>
                      <span style={{ color: T.caramel, flexShrink: 0, marginTop: 1 }}>{item.icon}</span>
                      <div>
                        <p style={{ fontSize: '0.68rem', color: T.secondary, fontWeight: 600 }}>{item.label}</p>
                        <p style={{ fontSize: '0.8rem', fontWeight: 600, color: T.espresso }}>{item.value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div style={{ padding: '1rem', background: T.cream, borderRadius: 12, border: `1px dashed ${T.beige}`, color: T.secondary, fontSize: '0.83rem', textAlign: 'center' }}>
                {isApproved
                  ? 'Code not yet configured. Refresh to check again.'
                  : 'Awaiting platform approval. The invitation code will be available once approved.'}
              </div>
            )}
          </div>

          {/* Pending Join Requests */}
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 18, padding: '1.25rem 1.4rem', boxShadow: T.shadowSm, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Users size={17} color={T.brown} />
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: T.espresso }}>Pending Join Requests</h3>
              </div>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.18rem 0.65rem', borderRadius: 99, background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d' }}>
                {membershipRequests.length} Pending
              </span>
            </div>
            <p style={{ color: T.secondary, fontSize: '0.8rem', lineHeight: 1.5, marginBottom: '1rem' }}>
              Clients who submitted this organization's join code. Review identity and grant appropriate role.
            </p>

            {membershipRequests.length === 0 ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', gap: '0.55rem', border: `1px dashed ${T.beige}`, borderRadius: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: T.cream, border: `1px solid ${T.beige}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Users size={20} color={T.caramel} />
                </div>
                <p style={{ fontSize: '0.85rem', fontWeight: 600, color: T.espresso }}>No pending membership requests at this time.</p>
              </div>
            ) : (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.55rem', overflowY: 'auto', maxHeight: 260 }}>
                {membershipRequests.map((req) => (
                  <div key={req.id} style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', padding: '0.65rem 0.85rem', background: T.cream, border: `1px solid ${T.border}`, borderRadius: 12 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: T.beige, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.brown, flexShrink: 0, fontSize: '0.82rem', fontWeight: 700 }}>
                      {(req.user_name || req.user_email || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 600, fontSize: '0.84rem', color: T.espresso, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{req.user_name || req.user_email}</p>
                      <p style={{ fontSize: '0.72rem', color: T.secondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{req.user_email}</p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0 }}>
                      <button onClick={() => handleApproveRequest(req.id, 'client')} disabled={actionInProgress === req.id}
                        style={{ padding: '0.3rem 0.65rem', background: '#e6f4ec', color: '#1e6e3e', border: '1px solid #a8d9b8', borderRadius: 8, fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                        Client
                      </button>
                      {userRole !== 'staff' && (
                        <button onClick={() => handleApproveRequest(req.id, 'staff')} disabled={actionInProgress === req.id}
                          style={{ padding: '0.3rem 0.65rem', background: '#e7f1fb', color: '#24598a', border: '1px solid #93c5fd', borderRadius: 8, fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                          Staff
                        </button>
                      )}
                      <button onClick={() => handleRejectRequest(req.id)} disabled={actionInProgress === req.id}
                        style={{ padding: '0.3rem 0.5rem', background: '#fde8e8', color: '#b91c1c', border: '1px solid #fca5a5', borderRadius: 8, fontSize: '0.72rem', cursor: 'pointer', fontFamily: 'inherit' }}>
                        <UserX size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================================================================
          RECENT ISSUES TABLE
      ================================================================ */}
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 18, padding: '1.25rem 1.4rem', boxShadow: T.shadowSm }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
            <Layers size={18} color={T.brown} />
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: T.espresso }}>Recent Organization Issues</h3>
          </div>
          <Link to={`/org/${currentOrg.id}/issues`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.38rem 0.85rem', background: T.surface, color: T.espresso, border: `1.5px solid ${T.border}`, borderRadius: 9, fontWeight: 600, fontSize: '0.8rem', textDecoration: 'none' }}>
            View All Issues <ExternalLink size={13} />
          </Link>
        </div>
        <p style={{ color: T.secondary, fontSize: '0.78rem', marginBottom: '1rem' }}>Real-time issues queue for triage, assignment, and status updates.</p>

        {issues.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2.5rem 1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.65rem' }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: T.cream, border: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ClipboardList size={22} color={T.caramel} />
            </div>
            <p style={{ fontWeight: 600, color: T.espresso }}>No issues reported yet</p>
            <p style={{ fontSize: '0.82rem', color: T.secondary }}>When clients report issues to this organization, they will appear here.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                  {['ISSUE', 'REPORTER', 'ASSIGNEE', 'STATUS', 'PRIORITY', 'ACTION'].map((h) => (
                    <th key={h} style={{ padding: '0.55rem 0.75rem', textAlign: 'left', fontSize: '0.67rem', fontWeight: 700, color: T.caramel, textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {issues.slice(0, 10).map((issue) => (
                  <tr key={issue.id} style={{ borderBottom: `1px solid ${T.border}` }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = T.cream)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '0.75rem' }}>
                      <p style={{ fontWeight: 600, fontSize: '0.87rem', color: T.espresso }}>{issue.title}</p>
                      <p style={{ fontSize: '0.72rem', color: T.secondary }}>Created {new Date(issue.created_at).toLocaleDateString()}</p>
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      <p style={{ fontSize: '0.83rem', fontWeight: 500, color: T.espresso }}>{issue.reporter?.full_name || 'Anonymous'}</p>
                      <p style={{ fontSize: '0.72rem', color: T.secondary }}>{issue.reporter?.email}</p>
                    </td>
                    <td style={{ padding: '0.75rem', fontSize: '0.83rem', color: issue.assignee ? T.espresso : T.secondary }}>
                      {issue.assignee?.full_name || 'Unassigned'}
                    </td>
                    <td style={{ padding: '0.75rem' }}><Pill s={STATUS_S[issue.status] ?? STATUS_S.closed}>{issue.status.replace('_',' ')}</Pill></td>
                    <td style={{ padding: '0.75rem' }}><Pill s={PRI_S[issue.priority] ?? PRI_S.low}>{issue.priority}</Pill></td>
                    <td style={{ padding: '0.75rem' }}>
                      <Link to={`/org/${currentOrg.id}/issues/${issue.id}`}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.32rem 0.7rem', background: T.cream, color: T.brown, border: `1px solid ${T.beige}`, borderRadius: 8, fontWeight: 700, fontSize: '0.75rem', textDecoration: 'none' }}>
                        Triage <ArrowRight size={12} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Responsive */}
      <style>{`
        @media (max-width: 900px) {
          .org-stats-grid { grid-template-columns: repeat(3,1fr) !important; }
          .org-identity-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 640px) {
          .org-hero-grid { grid-template-columns: 1fr !important; }
          .org-hero-illo { display: none; }
          .org-stats-grid { grid-template-columns: repeat(2,1fr) !important; }
        }
      `}</style>
    </div>
  )
}
