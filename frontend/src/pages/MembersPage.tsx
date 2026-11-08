import React, { useEffect, useState } from 'react'
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Shield,
  UserCheck,
  UserPlus,
  UserX,
  Users,
  X,
} from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { ErrorAlert } from '../components/ErrorAlert'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { useAuth } from '../context/AuthContext'
import { useOrg } from '../context/OrgContext'
import { api } from '../services/api'
import type { AddMemberData, Member, MembershipRequest, OrgRole } from '../types/organization'

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
// Role display helper
// ---------------------------------------------------------------------------
function roleLabel(role: string): string {
  if (role === 'owner' || role === 'manager') return 'Manager'
  if (role === 'admin')  return 'Admin'
  if (role === 'staff')  return 'Staff'
  if (role === 'client') return 'Client'
  return role.charAt(0).toUpperCase() + role.slice(1)
}

const ROLE_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  owner:   { bg: '#fef3c7', color: '#92400e', border: '#fcd34d' },
  manager: { bg: '#fef3c7', color: '#92400e', border: '#fcd34d' },
  admin:   { bg: '#e7f1fb', color: '#24598a', border: '#93c5fd' },
  staff:   { bg: '#f7eee4', color: '#87502C', border: '#eedfcc' },
  client:  { bg: '#f3ede8', color: '#78675C', border: '#d4c5b8' },
}
function RolePill({ role }: { role: string }) {
  const s = ROLE_STYLE[role] ?? ROLE_STYLE.client
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '0.2rem 0.7rem', fontSize: '0.72rem', fontWeight: 700, borderRadius: 99, background: s.bg, color: s.color, border: `1px solid ${s.border}`, whiteSpace: 'nowrap' }}>
      {roleLabel(role)}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Avatar
// ---------------------------------------------------------------------------
function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  const initials = name.split(' ').slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('')
  const hue = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: size, height: size, borderRadius: '50%', background: `hsl(${hue},42%,82%)`, color: `hsl(${hue},42%,28%)`, fontSize: size * 0.38, fontWeight: 700, flexShrink: 0 }}>
      {initials}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Warm modal
// ---------------------------------------------------------------------------
function WarmModal({ title, subtitle, onClose, children }: { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(56,37,28,0.42)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: '1.5rem' }} onClick={onClose}>
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 20, maxWidth: 500, width: '100%', padding: '1.75rem 2rem', boxShadow: '0 24px 56px rgba(56,37,28,0.18)', maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: T.espresso }}>{title}</h2>
            {subtitle && <p style={{ color: T.secondary, fontSize: '0.82rem', marginTop: '0.25rem' }}>{subtitle}</p>}
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: T.secondary, padding: '0.15rem' }}><X size={17} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

const inp: React.CSSProperties = { width: '100%', padding: '0.55rem 0.85rem', background: T.cream, border: `1px solid ${T.border}`, borderRadius: 10, color: T.espresso, fontSize: '0.85rem', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', transition: 'border-color 0.15s' }
const lbl: React.CSSProperties = { display: 'block', fontSize: '0.8rem', fontWeight: 600, color: T.espresso, marginBottom: '0.3rem' }
const fg: React.CSSProperties  = { marginBottom: '0.9rem' }

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export const MembersPage: React.FC = () => {
  const { orgId } = useParams<{ orgId: string }>()
  const { currentOrg, isAdmin, userRole } = useOrg()
  const { user } = useAuth()

  const activeOrgId = orgId || currentOrg?.id
  const isManager = userRole === 'owner' || userRole === 'manager' || userRole === 'admin'
  const canAddMembers = isManager || userRole === 'staff'

  const [members, setMembers]   = useState<Member[]>([])
  const [requests, setRequests] = useState<MembershipRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [isInviteOpen, setIsInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail]   = useState('')
  const [inviteRole, setInviteRole]     = useState<OrgRole>(isManager ? 'staff' : 'client')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [approvalRoles, setApprovalRoles] = useState<Record<string, OrgRole>>({})

  const loadData = async () => {
    if (!activeOrgId) return
    try {
      setIsLoading(true); setError(null)
      const [membersRes, requestsRes] = await Promise.all([
        api.organizations.listMembers(activeOrgId, 1, 100),
        api.organizations.listMembershipRequests(activeOrgId, 'pending'),
      ])
      setMembers(membersRes.members || [])
      setRequests(requestsRes.requests || [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load members.')
    } finally { setIsLoading(false) }
  }

  useEffect(() => { loadData() }, [activeOrgId, userRole])

  // Separate staff/managers from clients
  const staffMembers   = members.filter((m) => ['owner', 'manager', 'admin', 'staff'].includes(m.role))
  const clientMembers  = members.filter((m) => m.role === 'client' || m.role === 'member')

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeOrgId || !inviteEmail.trim()) return
    try {
      setIsSubmitting(true); setError(null)
      await api.organizations.addMember(activeOrgId, { email: inviteEmail.trim().toLowerCase(), role: inviteRole } as AddMemberData)
      setIsInviteOpen(false); setInviteEmail('')
      setSuccessMsg('Member added successfully.')
      loadData()
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed to add member.') }
    finally { setIsSubmitting(false) }
  }

  const handleRoleChange = async (targetUserId: string, newRole: OrgRole) => {
    if (!activeOrgId) return
    try {
      setError(null)
      await api.organizations.updateMemberRole(activeOrgId, targetUserId, newRole)
      setMembers((prev) => prev.map((m) => m.user_id === targetUserId ? { ...m, role: newRole } : m))
      setSuccessMsg('Role updated.')
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed to update role.') }
  }

  const handleRemove = async (targetUserId: string, isSelf: boolean) => {
    if (!activeOrgId) return
    if (!window.confirm(isSelf ? 'Leave this organization?' : 'Remove this member?')) return
    try {
      setError(null)
      await api.organizations.removeMember(activeOrgId, targetUserId)
      if (isSelf) { window.location.href = '/organizations' }
      else { setMembers((prev) => prev.filter((m) => m.user_id !== targetUserId)); setSuccessMsg('Member removed.') }
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed to remove member.') }
  }

  const handleApprove = async (requestId: string) => {
    if (!activeOrgId) return
    const role = approvalRoles[requestId] || 'client'
    try {
      setError(null)
      await api.organizations.approveMembershipRequest(activeOrgId, requestId, role)
      setSuccessMsg(`Request approved as "${roleLabel(role)}".`)
      loadData()
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed to approve.') }
  }

  const handleReject = async (requestId: string) => {
    if (!activeOrgId) return
    const reason = window.prompt('Reason for rejection (optional):') ?? undefined
    try {
      setError(null)
      await api.organizations.rejectMembershipRequest(activeOrgId, requestId, reason)
      setSuccessMsg('Request rejected.')
      loadData()
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed to reject.') }
  }

  if (isLoading) return <LoadingSpinner fullPage label="Loading team members..." />

  const card: React.CSSProperties = { background: T.surface, border: `1px solid ${T.border}`, borderRadius: 18, boxShadow: T.shadowSm, overflow: 'hidden', marginBottom: '1rem' }
  const thStyle: React.CSSProperties = { padding: '0.6rem 0.85rem', textAlign: 'left', fontSize: '0.67rem', fontWeight: 700, color: T.caramel, textTransform: 'uppercase', letterSpacing: '0.06em', background: T.cream, borderBottom: `1px solid ${T.border}` }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: '1.1rem' }}>
        <Link to={`/org/${activeOrgId}/issues`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: T.secondary, fontSize: '0.82rem', fontWeight: 500, textDecoration: 'none', marginBottom: '0.65rem' }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = T.espresso)}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = T.secondary)}>
          <ArrowLeft size={14} /> Back to Issues
        </Link>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: T.espresso, letterSpacing: '-0.02em', marginBottom: '0.2rem' }}>Team &amp; Memberships</h1>
            <p style={{ color: T.secondary, fontSize: '0.85rem' }}>Manage organization members and issue resolution access.</p>
          </div>
          {canAddMembers && (
            <button onClick={() => setIsInviteOpen(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', padding: '0.55rem 1.1rem', background: T.brown, color: '#FFFDF9', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: '0.87rem', cursor: 'pointer', fontFamily: 'inherit' }}>
              <UserPlus size={15} /> Add Member
            </button>
          )}
        </div>
      </div>

      <ErrorAlert message={error} onDismiss={() => setError(null)} />

      {successMsg && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '0.7rem 1rem', background: '#e6f4ec', border: '1px solid #a8d9b8', borderRadius: 12, marginBottom: '1rem', color: '#1e6e3e', fontSize: '0.84rem' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><CheckCircle2 size={14} />{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#1e6e3e', display: 'flex' }}><X size={13} /></button>
        </div>
      )}

      {/* ── PENDING JOIN REQUESTS ── */}
      {requests.length > 0 && (
        <div style={{ ...card }}>
          <div style={{ padding: '0.85rem 1rem', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Clock size={16} color={T.brown} />
              <span style={{ fontWeight: 700, fontSize: '0.95rem', color: T.espresso }}>Pending Join Requests</span>
            </div>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.18rem 0.65rem', borderRadius: 99, background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d' }}>
              {requests.length} Pending
            </span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Applicant', 'Email', 'Submitted', 'Assign Role', 'Decision'].map((h) => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {requests.map((req, idx) => (
                <tr key={req.id} style={{ borderBottom: idx < requests.length - 1 ? `1px solid ${T.border}` : 'none' }}>
                  <td style={{ padding: '0.8rem 0.85rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Avatar name={req.user_name || req.user_email || 'U'} />
                      <span style={{ fontWeight: 600, fontSize: '0.87rem', color: T.espresso }}>{req.user_name || 'User'}</span>
                    </div>
                  </td>
                  <td style={{ padding: '0.8rem 0.85rem', fontSize: '0.83rem', color: T.secondary }}>{req.user_email || '—'}</td>
                  <td style={{ padding: '0.8rem 0.85rem', fontSize: '0.8rem', color: T.secondary }}>{new Date(req.created_at).toLocaleDateString()}</td>
                  <td style={{ padding: '0.8rem 0.85rem' }}>
                    <select
                      value={approvalRoles[req.id] || 'client'}
                      onChange={(e) => setApprovalRoles((prev) => ({ ...prev, [req.id]: e.target.value as OrgRole }))}
                      style={{ padding: '0.35rem 0.65rem', background: T.cream, border: `1px solid ${T.border}`, borderRadius: 8, color: T.espresso, fontSize: '0.8rem', fontFamily: 'inherit', cursor: 'pointer' }}
                    >
                      <option value="client">Client</option>
                      {isManager && <option value="staff">Staff</option>}
                      {isManager && <option value="manager">Manager</option>}
                    </select>
                  </td>
                  <td style={{ padding: '0.8rem 0.85rem' }}>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <button onClick={() => handleApprove(req.id)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.32rem 0.75rem', background: '#e6f4ec', color: '#1e6e3e', border: '1px solid #a8d9b8', borderRadius: 8, fontWeight: 700, fontSize: '0.77rem', cursor: 'pointer', fontFamily: 'inherit' }}>
                        <UserCheck size={12} /> Approve
                      </button>
                      <button onClick={() => handleReject(req.id)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.32rem 0.75rem', background: '#fde8e8', color: '#b91c1c', border: '1px solid #fca5a5', borderRadius: 8, fontWeight: 700, fontSize: '0.77rem', cursor: 'pointer', fontFamily: 'inherit' }}>
                        <UserX size={12} /> Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── STAFF & MANAGERS SECTION ── */}
      <div style={card}>
        <div style={{ padding: '0.85rem 1rem', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Shield size={16} color={T.brown} />
          <span style={{ fontWeight: 700, fontSize: '0.95rem', color: T.espresso }}>Staff &amp; Managers</span>
          <span style={{ fontSize: '0.72rem', color: T.secondary, marginLeft: '0.35rem' }}>({staffMembers.length})</span>
          <p style={{ fontSize: '0.78rem', color: T.secondary, marginLeft: 'auto' }}>Managers can change staff roles and remove members.</p>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Member', 'Email', 'Role', 'Joined', 'Actions'].map((h) => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {staffMembers.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: '1.5rem', textAlign: 'center', color: T.secondary, fontSize: '0.85rem' }}>No staff or manager members yet.</td></tr>
            ) : (
              staffMembers.map((m, idx) => {
                const isSelf = m.user_id === user?.id
                // Manager can change staff ↔ manager (but not their own role or owner)
                const canChangeRole = isManager && !isSelf && m.role !== 'owner'
                const canRemove = (isManager && !isSelf && m.role !== 'owner') || isSelf
                return (
                  <tr key={m.id} style={{ borderBottom: idx < staffMembers.length - 1 ? `1px solid ${T.border}` : 'none' }}>
                    <td style={{ padding: '0.8rem 0.85rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                        <Avatar name={m.full_name || 'U'} />
                        <div>
                          <p style={{ fontWeight: 600, fontSize: '0.87rem', color: T.espresso }}>
                            {m.full_name}{isSelf && <span style={{ color: T.caramel, fontWeight: 500, fontSize: '0.78rem', marginLeft: '0.35rem' }}>(You)</span>}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '0.8rem 0.85rem', fontSize: '0.83rem', color: T.secondary }}>{m.email}</td>
                    <td style={{ padding: '0.8rem 0.85rem' }}>
                      {canChangeRole ? (
                        <select
                          value={m.role === 'owner' ? 'manager' : m.role}
                          onChange={(e) => handleRoleChange(m.user_id, e.target.value as OrgRole)}
                          style={{ padding: '0.32rem 0.65rem', background: T.cream, border: `1px solid ${T.border}`, borderRadius: 8, color: T.espresso, fontSize: '0.8rem', fontFamily: 'inherit', cursor: 'pointer' }}
                        >
                          <option value="manager">Manager</option>
                          <option value="staff">Staff</option>
                        </select>
                      ) : (
                        <RolePill role={m.role} />
                      )}
                    </td>
                    <td style={{ padding: '0.8rem 0.85rem', fontSize: '0.8rem', color: T.secondary }}>{new Date(m.created_at).toLocaleDateString()}</td>
                    <td style={{ padding: '0.8rem 0.85rem' }}>
                      {canRemove && (
                        <button onClick={() => handleRemove(m.user_id, isSelf)}
                          style={{ padding: '0.3rem 0.7rem', background: isSelf ? T.cream : '#fde8e8', color: isSelf ? T.secondary : '#b91c1c', border: `1px solid ${isSelf ? T.border : '#fca5a5'}`, borderRadius: 8, fontWeight: 600, fontSize: '0.77rem', cursor: 'pointer', fontFamily: 'inherit' }}>
                          {isSelf ? 'Leave' : 'Remove'}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── CLIENTS SECTION (read-only) ── */}
      <div style={card}>
        <div style={{ padding: '0.85rem 1rem', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Users size={16} color={T.caramel} />
          <span style={{ fontWeight: 700, fontSize: '0.95rem', color: T.espresso }}>Clients</span>
          <span style={{ fontSize: '0.72rem', color: T.secondary, marginLeft: '0.35rem' }}>({clientMembers.length})</span>
          <p style={{ fontSize: '0.78rem', color: T.secondary, marginLeft: 'auto' }}>Clients joined via invitation code. Their role cannot be changed.</p>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Member', 'Email', 'Role', 'Joined'].map((h) => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {clientMembers.length === 0 ? (
              <tr><td colSpan={4} style={{ padding: '1.5rem', textAlign: 'center', color: T.secondary, fontSize: '0.85rem' }}>No clients have joined yet. Share the invitation code so clients can request membership.</td></tr>
            ) : (
              clientMembers.map((m, idx) => (
                <tr key={m.id} style={{ borderBottom: idx < clientMembers.length - 1 ? `1px solid ${T.border}` : 'none' }}>
                  <td style={{ padding: '0.8rem 0.85rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                      <Avatar name={m.full_name || 'U'} />
                      <p style={{ fontWeight: 600, fontSize: '0.87rem', color: T.espresso }}>{m.full_name}</p>
                    </div>
                  </td>
                  <td style={{ padding: '0.8rem 0.85rem', fontSize: '0.83rem', color: T.secondary }}>{m.email}</td>
                  <td style={{ padding: '0.8rem 0.85rem' }}><RolePill role={m.role} /></td>
                  <td style={{ padding: '0.8rem 0.85rem', fontSize: '0.8rem', color: T.secondary }}>{new Date(m.created_at).toLocaleDateString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── ADD MEMBER MODAL ── */}
      {isInviteOpen && (
        <WarmModal title="Add Organization Member" subtitle="Add a registered ResolveX user by email." onClose={() => setIsInviteOpen(false)}>
          <ErrorAlert message={error} onDismiss={() => setError(null)} />
          <form onSubmit={handleAddMember}>
            <div style={fg}>
              <label style={lbl} htmlFor="memberEmail">User Email *</label>
              <input id="memberEmail" type="email" placeholder="colleague@example.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} required style={inp} onFocus={(e) => (e.currentTarget.style.borderColor = T.caramel)} onBlur={(e) => (e.currentTarget.style.borderColor = T.border)} />
            </div>
            <div style={fg}>
              <label style={lbl} htmlFor="memberRole">Role</label>
              <select id="memberRole" value={inviteRole} onChange={(e) => setInviteRole(e.target.value as OrgRole)} style={{ ...inp, cursor: 'pointer' }}>
                {isManager && <option value="staff">Staff — Resolve issues and handle operations</option>}
                {isManager && <option value="manager">Manager — Assign issues and triage tickets</option>}
                {!isManager && <option value="client">Client — Report issues and view updates</option>}
              </select>
              <p style={{ fontSize: '0.76rem', color: T.secondary, marginTop: '0.3rem' }}>
                {isManager ? 'Managers can add Staff or Manager members. Clients join via the invitation code.' : 'Staff can only add Client members.'}
              </p>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '1.1rem' }}>
              <button type="button" onClick={() => setIsInviteOpen(false)} disabled={isSubmitting}
                style={{ padding: '0.55rem 1rem', background: T.surface, color: T.espresso, border: `1.5px solid ${T.border}`, borderRadius: 9, fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', fontFamily: 'inherit' }}>
                Cancel
              </button>
              <button type="submit" disabled={isSubmitting}
                style={{ padding: '0.55rem 1.1rem', background: T.brown, color: '#fffdf9', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: '0.85rem', cursor: isSubmitting ? 'not-allowed' : 'pointer', opacity: isSubmitting ? 0.6 : 1, fontFamily: 'inherit' }}>
                {isSubmitting ? 'Adding…' : 'Add Member'}
              </button>
            </div>
          </form>
        </WarmModal>
      )}
    </div>
  )
}
