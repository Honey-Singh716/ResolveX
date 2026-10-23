import React, { useEffect, useState } from 'react'
import { ArrowLeft, UserCheck, UserPlus, UserX, Clock } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'
import { ErrorAlert } from '../components/ErrorAlert'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { RoleBadge } from '../components/StatusBadge'
import { useAuth } from '../context/AuthContext'
import { useOrg } from '../context/OrgContext'
import { api } from '../services/api'
import type { AddMemberData, Member, MembershipRequest, OrgRole } from '../types/organization'

export const MembersPage: React.FC = () => {
  const { orgId } = useParams<{ orgId: string }>()
  const { currentOrg, isAdmin, isOwner, userRole } = useOrg()
  const { user } = useAuth()

  const activeOrgId = orgId || currentOrg?.id
  const canAddMembers = userRole === 'owner' || userRole === 'manager' || userRole === 'staff'

  const [activeTab, setActiveTab] = useState<'members' | 'requests'>('members')
  const [members, setMembers] = useState<Member[]>([])
  const [requests, setRequests] = useState<MembershipRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Invite modal state
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<OrgRole>(
    userRole === 'staff' ? 'client' : 'staff'
  )
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Request approval roles state
  const [approvalRoles, setApprovalRoles] = useState<Record<string, OrgRole>>({})

  const loadData = async () => {
    if (!activeOrgId) return
    try {
      setIsLoading(true)
      setError(null)
      const [membersRes, requestsRes] = await Promise.all([
        api.organizations.listMembers(activeOrgId, 1, 100),
        userRole === 'staff'
          ? api.organizations.listMembershipRequests(activeOrgId, 'pending')
          : Promise.resolve({ requests: [] }),
      ])
      setMembers(membersRes.members || [])
      setRequests(requestsRes.requests || [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load organization members.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [activeOrgId, isAdmin, userRole])

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeOrgId || !inviteEmail.trim()) return

    try {
      setIsSubmitting(true)
      setError(null)
      const data: AddMemberData = {
        email: inviteEmail.trim().toLowerCase(),
        role: inviteRole,
      }
      await api.organizations.addMember(activeOrgId, data)
      setIsInviteModalOpen(false)
      setInviteEmail('')
      setInviteRole(userRole === 'staff' ? 'client' : 'staff')
      setSuccessMsg(`Member ${data.email} added successfully!`)
      loadData()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add member.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleApproveRequest = async (requestId: string) => {
    if (!activeOrgId) return
    const roleToAssign = approvalRoles[requestId] || 'client'
    try {
      setError(null)
      await api.organizations.approveMembershipRequest(activeOrgId, requestId, roleToAssign)
      setSuccessMsg(`Membership request approved with role "${roleToAssign}"!`)
      loadData()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to approve request.')
    }
  }

  const handleRejectRequest = async (requestId: string) => {
    if (!activeOrgId) return
    const reason = window.prompt('Optional reason for rejection:') || undefined
    try {
      setError(null)
      await api.organizations.rejectMembershipRequest(activeOrgId, requestId, reason)
      setSuccessMsg('Membership request rejected.')
      loadData()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to reject request.')
    }
  }

  const handleRoleChange = async (targetUserId: string, newRole: OrgRole) => {
    if (!activeOrgId) return
    try {
      setError(null)
      await api.organizations.updateMemberRole(activeOrgId, targetUserId, newRole)
      setMembers((prev) =>
        prev.map((m) => (m.user_id === targetUserId ? { ...m, role: newRole } : m))
      )
      setSuccessMsg('Member role updated.')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update member role.')
    }
  }

  const handleRemoveMember = async (targetUserId: string, isSelf: boolean) => {
    if (!activeOrgId) return
    const confirmMsg = isSelf
      ? 'Are you sure you want to leave this organization?'
      : 'Are you sure you want to remove this member from the organization?'
    if (!window.confirm(confirmMsg)) return

    try {
      setError(null)
      await api.organizations.removeMember(activeOrgId, targetUserId)
      if (isSelf) {
        window.location.href = '/organizations'
      } else {
        setMembers((prev) => prev.filter((m) => m.user_id !== targetUserId))
        setSuccessMsg('Member removed.')
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to remove member.')
    }
  }

  if (isLoading) {
    return <LoadingSpinner fullPage label="Loading members and requests..." />
  }

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ marginBottom: '1.25rem' }}>
        <Link
          to={`/org/${activeOrgId}/issues`}
          className="btn-ghost btn-sm"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.75rem' }}
        >
          <ArrowLeft size={15} /> Back to Issues
        </Link>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div>
            <h1>Team &amp; Memberships</h1>
            <p style={{ color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
              Manage organization members and issue resolution access
            </p>
          </div>
          {canAddMembers && (
            <button onClick={() => setIsInviteModalOpen(true)} className="btn btn-primary">
              <UserPlus size={16} /> Add Member
            </button>
          )}
        </div>
      </div>

      <ErrorAlert message={error} onDismiss={() => setError(null)} />

      {successMsg && (
        <div
          style={{
            background: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: 'var(--radius-md)',
            padding: '0.75rem 1rem',
            marginBottom: '1rem',
            color: '#34d399',
            fontSize: '0.875rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>{successMsg}</span>
          <button
            onClick={() => setSuccessMsg(null)}
            className="btn btn-ghost btn-sm"
            style={{ color: '#34d399', padding: '0.2rem 0.4rem' }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Tabs */}
      {userRole === 'staff' && (
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-subtle)' }}>
          <button
            onClick={() => setActiveTab('members')}
            className="btn btn-ghost"
            style={{
              padding: '0.6rem 0.5rem',
              borderRadius: 0,
              fontWeight: activeTab === 'members' ? 600 : 400,
              color: activeTab === 'members' ? 'var(--primary)' : 'var(--text-secondary)',
              borderBottom: activeTab === 'members' ? '2px solid var(--primary)' : '2px solid transparent',
            }}
          >
            Active Members ({members.length})
          </button>
          <button
            onClick={() => setActiveTab('requests')}
            className="btn btn-ghost"
            style={{
              padding: '0.6rem 0.5rem',
              borderRadius: 0,
              fontWeight: activeTab === 'requests' ? 600 : 400,
              color: activeTab === 'requests' ? 'var(--primary)' : 'var(--text-secondary)',
              borderBottom: activeTab === 'requests' ? '2px solid var(--primary)' : '2px solid transparent',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            Pending Requests
            {requests.length > 0 && (
              <span
                style={{
                  background: 'var(--primary)',
                  color: '#fff',
                  borderRadius: '10px',
                  padding: '0.1rem 0.5rem',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                }}
              >
                {requests.length}
              </span>
            )}
          </button>
        </div>
      )}

      {/* Tab 1: Active Members Table */}
      {activeTab === 'members' && (
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Email</th>
                <th style={{ width: '150px' }}>Role</th>
                <th style={{ width: '140px' }}>Joined</th>
                <th style={{ width: '120px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => {
                const isSelf = member.user_id === user?.id
                const canEditThisMember = isOwner || (isAdmin && member.role !== 'owner' && member.role !== 'admin')
                return (
                  <tr key={member.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        <div
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            background: 'var(--bg-surface-elevated)',
                            border: '1px solid var(--border-medium)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--primary)',
                            fontWeight: 700,
                            fontSize: '0.85rem',
                          }}
                        >
                          {member.full_name ? member.full_name[0] : 'U'}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                            {member.full_name} {isSelf && <span style={{ color: 'var(--text-muted)' }}>(You)</span>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span style={{ color: 'var(--text-secondary)' }}>{member.email}</span>
                    </td>
                    <td>
                      {canEditThisMember && !isSelf ? (
                        <select
                          className="form-select"
                          style={{ height: '32px', padding: '0.2rem 0.5rem', fontSize: '0.8rem' }}
                          value={member.role}
                          onChange={(e) => handleRoleChange(member.user_id, e.target.value as OrgRole)}
                        >
                          <option value="manager">Manager</option>
                          <option value="staff">Staff</option>
                        </select>
                      ) : (
                        <RoleBadge role={member.role} />
                      )}
                    </td>
                    <td>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {new Date(member.created_at).toLocaleDateString()}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {isSelf ? (
                        <button
                          onClick={() => handleRemoveMember(member.user_id, true)}
                          className="btn btn-ghost btn-sm"
                          style={{ color: '#f87171' }}
                          title="Leave this organization"
                        >
                          Leave
                        </button>
                      ) : (
                        canEditThisMember && (
                          <button
                            onClick={() => handleRemoveMember(member.user_id, false)}
                            className="btn btn-ghost btn-sm"
                            style={{ color: '#f87171' }}
                            title="Remove member"
                          >
                            Remove
                          </button>
                        )
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 2: Pending Membership Requests */}
      {activeTab === 'requests' && userRole === 'staff' && (
        <div>
          {requests.length === 0 ? (
            <EmptyState
              icon={<Clock size={36} />}
              title="No pending join requests"
              description="When prospective clients or staff submit your organization join code, their requests will appear here for review."
            />
          ) : (
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Applicant</th>
                    <th>Email</th>
                    <th>Submitted</th>
                    <th style={{ width: '160px' }}>Assign Role</th>
                    <th style={{ width: '160px', textAlign: 'right' }}>Decision</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((req) => (
                    <tr key={req.id}>
                      <td>
                        <strong>{req.user_name || 'ResolveX User'}</strong>
                      </td>
                      <td>
                        <span style={{ color: 'var(--text-secondary)' }}>{req.user_email || '—'}</span>
                      </td>
                      <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        {new Date(req.created_at).toLocaleDateString()}
                      </td>
                      <td>
                        <select
                          className="form-select"
                          style={{ height: '32px', padding: '0.2rem 0.5rem', fontSize: '0.8rem' }}
                          value={approvalRoles[req.id] || 'client'}
                          onChange={(e) =>
                            setApprovalRoles((prev) => ({
                              ...prev,
                              [req.id]: e.target.value as OrgRole,
                            }))
                          }
                        >
                          <option value="client">Client / Reporter</option>
                          {userRole !== 'staff' && <option value="staff">Staff</option>}
                          {userRole !== 'staff' && <option value="manager">Manager</option>}
                          {userRole !== 'staff' && isOwner && <option value="admin">Admin</option>}
                        </select>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
                          <button
                            onClick={() => handleApproveRequest(req.id)}
                            className="btn btn-primary btn-sm"
                            title="Approve request"
                          >
                            <UserCheck size={14} /> Approve
                          </button>
                          <button
                            onClick={() => handleRejectRequest(req.id)}
                            className="btn btn-danger btn-sm"
                            title="Reject request"
                          >
                            <UserX size={14} /> Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Add Member Modal */}
      {isInviteModalOpen && canAddMembers && (
        <div className="modal-backdrop" onClick={() => setIsInviteModalOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginBottom: '0.5rem' }}>Add Organization Member</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
              Add a registered ResolveX user to this organization by email.
            </p>

            <form onSubmit={handleAddMember}>
              <div className="form-group">
                <label className="form-label" htmlFor="memberEmail">
                  User Email *
                </label>
                <input
                  id="memberEmail"
                  type="email"
                  className="form-input"
                  placeholder="e.g. colleague@university.edu"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label className="form-label" htmlFor="memberRole">
                  Initial Role
                </label>
                <select
                  id="memberRole"
                  className="form-select"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as OrgRole)}
                >
                  {userRole === 'owner' || userRole === 'manager' ? (
                    <>
                      <option value="staff">Staff — Resolve issues and handle operations</option>
                      <option value="manager">Manager — Assign issues and triage tickets</option>
                    </>
                  ) : (
                    <option value="client">Client — Report issues and view updates</option>
                  )}
                </select>
                {userRole === 'owner' || userRole === 'manager' ? (
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                    Organization managers can add Staff or Manager members to handle organization issues.
                  </p>
                ) : userRole === 'staff' ? (
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                    Staff can add Clients who need to report an issue directly to this organization.
                  </p>
                ) : null}
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setIsInviteModalOpen(false)}
                  className="btn btn-secondary"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Adding...' : 'Add Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
