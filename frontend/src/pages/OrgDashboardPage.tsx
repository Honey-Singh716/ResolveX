import React, { useEffect, useState } from 'react'
import {
  ArrowRight,
  CheckCircle2,
  Copy,
  ExternalLink,
  Key,
  Layers,
  Plus,
  Trash2,
  UserPlus,
  UserX,
  Users,
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'
import { ErrorAlert } from '../components/ErrorAlert'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { PriorityBadge, RoleBadge, StatusBadge } from '../components/StatusBadge'
import { useOrg } from '../context/OrgContext'
import { api } from '../services/api'
import type { IssueResponse } from '../types/issue'
import type { MembershipRequest, OrgRole } from '../types/organization'

export const OrgDashboardPage: React.FC = () => {
  const { currentOrg, isAdmin, userRole } = useOrg()
  const navigate = useNavigate()

  const [issues, setIssues] = useState<IssueResponse[]>([])
  const [membershipRequests, setMembershipRequests] = useState<MembershipRequest[]>([])
  const [activeJoinCode, setActiveJoinCode] = useState<string | null>(null)
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
      setIsLoading(true)
      setError(null)

      const issuesRes = await api.issues.list(orgId, { page: 1, page_size: 50 })
      setIssues(issuesRes.issues || [])

      if (userRole === 'staff') {
        try {
          const codeRes = await api.organizations.getJoinCode(orgId)
          setActiveJoinCode(codeRes.join_code)
        } catch {
          setActiveJoinCode(null)
        }
        try {
          const reqsRes = await api.organizations.listMembershipRequests(orgId)
          setMembershipRequests(reqsRes.requests || [])
        } catch {
          setMembershipRequests([])
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load organization workspace data.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadOrgData()
  }, [orgId, isAdmin, userRole])

  // Copy Code to Clipboard
  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code)
    setCopiedCode(true)
    setTimeout(() => setCopiedCode(false), 2000)
  }

  const handleOwnershipTransfer = async () => {
    if (!orgId) return
    const targetUserId = window.prompt('Enter the eligible member user ID to offer ownership:')
    if (!targetUserId) return
    try {
      setActionInProgress('ownership')
      await api.organizations.requestOwnershipTransfer(orgId, targetUserId.trim())
      setSuccessMsg('Ownership transfer offered. The member must accept it before you leave.')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to offer ownership transfer.')
    } finally {
      setActionInProgress(null)
    }
  }

  const handleDeletionRequest = async () => {
    if (!orgId) return
    if (!window.confirm('Schedule this organization for archival after a 7-day grace period?')) return
    try {
      setActionInProgress('deletion')
      const response = await api.organizations.requestDeletion(orgId)
      setSuccessMsg(`Archival scheduled for ${response.scheduled_for ? new Date(response.scheduled_for).toLocaleString() : 'seven days from now'}.`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to schedule archival.')
    } finally {
      setActionInProgress(null)
    }
  }

  const handleDeletionCancellation = async () => {
    if (!orgId) return
    try {
      setActionInProgress('deletion')
      await api.organizations.cancelDeletion(orgId)
      setSuccessMsg('Organization archival cancelled.')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to cancel archival.')
    } finally {
      setActionInProgress(null)
    }
  }

  // Approve Membership Request
  const handleApproveRequest = async (requestId: string, role: OrgRole) => {
    if (!orgId) return
    try {
      setActionInProgress(requestId)
      setError(null)
      await api.organizations.approveMembershipRequest(orgId, requestId, role)
      setSuccessMsg(`Membership request approved with role '${role}'.`)
      await loadOrgData()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to approve request.')
    } finally {
      setActionInProgress(null)
    }
  }

  // Reject Membership Request
  const handleRejectRequest = async (requestId: string) => {
    if (!orgId) return
    try {
      setActionInProgress(requestId)
      setError(null)
      await api.organizations.rejectMembershipRequest(orgId, requestId)
      setSuccessMsg('Membership request rejected.')
      await loadOrgData()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to reject request.')
    } finally {
      setActionInProgress(null)
    }
  }

  if (isLoading) {
    return <LoadingSpinner fullPage label="Loading organization dashboard..." />
  }

  if (!currentOrg) {
    return (
      <EmptyState
        title="No organization selected"
        description="Select an active approved organization from your client portal."
        action={
          <button onClick={() => navigate('/client/dashboard')} className="btn btn-primary">
            Back to Client Portal
          </button>
        }
      />
    )
  }

  // Calculate metrics
  const totalIssues = issues.length
  const openIssues = issues.filter((i) => i.status === 'open').length
  const inProgressIssues = issues.filter((i) => i.status === 'in_progress').length
  const resolvedIssues = issues.filter((i) => ['resolved', 'closed'].includes(i.status)).length
  const urgentIssues = issues.filter((i) => i.priority === 'urgent').length

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Workspace Header */}
      <div
        style={{
          background: 'radial-gradient(ellipse at 80% 20%, rgba(99, 102, 241, 0.15), transparent 70%), var(--bg-surface)',
          border: '1px solid var(--border-medium)',
          borderRadius: 'var(--radius-lg)',
          padding: '2rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1.5rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
            <span
              style={{
                background: 'rgba(99, 102, 241, 0.15)',
                color: '#818cf8',
                padding: '0.2rem 0.6rem',
                borderRadius: 'var(--radius-full)',
                fontSize: '0.75rem',
                fontWeight: 700,
                letterSpacing: '0.03em',
                textTransform: 'uppercase',
              }}
            >
              Organization Workspace
            </span>
            <RoleBadge role={currentOrg.role} />
          </div>
          <h1 style={{ fontSize: '1.85rem', letterSpacing: '-0.02em' }}>{currentOrg.name}</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.35rem', fontSize: '0.95rem' }}>
            Slug: <span style={{ fontFamily: 'var(--font-mono)' }}>{currentOrg.slug}</span>
            {currentOrg.industry && ` • Industry: ${currentOrg.industry}`}
          </p>
        </div>

        {/* Quick Actions */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <Link
            to={`/org/${currentOrg.id}/issues`}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Layers size={16} /> Issues Queue
          </Link>
          <Link
            to={`/org/${currentOrg.id}/members`}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Users size={16} /> Team Roster
          </Link>
          {isOwner && (
            <>
              <button
                onClick={handleOwnershipTransfer}
                className="btn btn-secondary"
                disabled={actionInProgress === 'ownership'}
              >
                <UserPlus size={16} /> Transfer Ownership
              </button>
              <button
                onClick={currentOrg.deletion_scheduled_for ? handleDeletionCancellation : handleDeletionRequest}
                className="btn btn-secondary"
                disabled={actionInProgress === 'deletion'}
              >
                <Trash2 size={16} /> {currentOrg.deletion_scheduled_for ? 'Cancel Archival' : 'Schedule Archival'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Alerts */}
      <ErrorAlert message={error} onDismiss={() => setError(null)} />
      {successMsg && (
        <div
          style={{
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.35)',
            color: '#34d399',
            padding: '0.85rem 1.25rem',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.9rem' }}>
            <CheckCircle2 size={18} />
            <span>{successMsg}</span>
          </div>
          <button
            onClick={() => setSuccessMsg(null)}
            className="btn-ghost btn-sm"
            style={{ color: '#34d399', padding: '0.2rem 0.5rem' }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Metrics Grid */}
      <div className="stat-cards-grid">
        <div className="stat-card">
          <div className="stat-card-label">Total Org Issues</div>
          <div className="stat-card-value" style={{ color: 'var(--text-main)' }}>
            {totalIssues}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-label">Open / Triage</div>
          <div className="stat-card-value" style={{ color: '#60a5fa' }}>
            {openIssues}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-label">In Progress</div>
          <div className="stat-card-value" style={{ color: '#fbbf24' }}>
            {inProgressIssues}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-label">Resolved / Closed</div>
          <div className="stat-card-value" style={{ color: '#34d399' }}>
            {resolvedIssues}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-label">Urgent Priority</div>
          <div className="stat-card-value" style={{ color: '#f87171' }}>
            {urgentIssues}
          </div>
        </div>
      </div>

      {/* Organization identity and membership administration */}
      {isAdmin && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
          {/* Organization Identity Card */}
          <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <Key size={18} style={{ color: '#818cf8' }} />
                <h3 style={{ fontSize: '1.1rem' }}>Organization Identity</h3>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.5 }}>
                Share the invitation code with students so they can request membership. Requests remain pending
                until an organization administrator approves the appropriate role.
              </p>

              <div style={{ marginTop: '1.25rem', display: 'grid', gap: '0.65rem' }}>
                <div style={{ background: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-md)', padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Permanent Organization Code</div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#818cf8' }}>
                      {currentOrg.organization_code || 'Provisioning...'}
                    </div>
                  </div>
                  {currentOrg.organization_code && (
                    <button
                      onClick={() => {
                        if (currentOrg.organization_code) handleCopyCode(currentOrg.organization_code)
                      }}
                      className="btn btn-secondary btn-sm"
                      style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                    >
                      <Copy size={13} /> {copiedCode ? 'Copied!' : 'Copy'}
                    </button>
                  )}
                </div>
              {activeJoinCode ? (
                <div
                  style={{
                    marginTop: '1.25rem',
                    background: 'var(--bg-surface-elevated)',
                    border: '1px solid rgba(251, 191, 36, 0.4)',
                    borderRadius: 'var(--radius-md)',
                    padding: '0.85rem 1rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      Active Code
                    </div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#fbbf24' }}>
                      {activeJoinCode}
                    </div>
                  </div>
                  <button
                    onClick={() => handleCopyCode(activeJoinCode)}
                    className="btn btn-secondary btn-sm"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                  >
                    <Copy size={13} /> {copiedCode ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              ) : (
                <div
                  style={{
                    marginTop: '1.25rem',
                    padding: '0.75rem',
                    background: 'var(--bg-surface-elevated)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px dashed var(--border-medium)',
                    color: 'var(--text-muted)',
                    fontSize: '0.85rem',
                    textAlign: 'center',
                  }}
                >
                  No active invitation code is available. Refresh this dashboard after approval.
                </div>
              )}
              </div>
            </div>

            <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: '1.5rem' }}>
              The invitation code is provisioned automatically when platform administration approves this organization.
            </p>
          </div>

          {/* Pending Membership Requests Card */}
          <div className="card" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <UserPlus size={18} style={{ color: '#818cf8' }} />
                <h3 style={{ fontSize: '1.1rem' }}>Pending Join Requests</h3>
              </div>
              <span className="badge badge-verification-pending" style={{ fontSize: '0.72rem' }}>
                {membershipRequests.length} Pending
              </span>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.5, marginBottom: '1rem' }}>
              Clients who submitted this organization's join code. Review identity and grant appropriate role.
            </p>

            {membershipRequests.length === 0 ? (
              <div
                style={{
                  padding: '1.5rem',
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                  fontSize: '0.85rem',
                  border: '1px dashed var(--border-medium)',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                No pending membership requests at this time.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '240px', overflowY: 'auto' }}>
                {membershipRequests.map((req) => (
                  <div
                    key={req.id}
                    style={{
                      background: 'var(--bg-surface-elevated)',
                      border: '1px solid var(--border-medium)',
                      borderRadius: 'var(--radius-md)',
                      padding: '0.75rem 1rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '0.5rem',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{req.user_name || req.user_email}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{req.user_email}</div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                      <button
                        onClick={() => handleApproveRequest(req.id, 'client')}
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '0.72rem', padding: '0.25rem 0.5rem' }}
                        disabled={actionInProgress === req.id}
                        title="Approve as Client reporter"
                      >
                        + Client
                      </button>
                      {userRole !== 'staff' && <button
                        onClick={() => handleApproveRequest(req.id, 'staff')}
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '0.72rem', padding: '0.25rem 0.5rem', color: '#818cf8' }}
                        disabled={actionInProgress === req.id}
                        title="Approve as Staff member"
                      >
                        + Staff
                      </button>}
                      <button
                        onClick={() => handleRejectRequest(req.id)}
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '0.72rem', padding: '0.25rem 0.5rem', color: '#f87171' }}
                        disabled={actionInProgress === req.id}
                        title="Reject request"
                      >
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

      {/* Recent Organization Issues Queue */}
      <div className="card" style={{ padding: '1.75rem' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1.25rem',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div>
            <h2 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Layers size={20} style={{ color: '#818cf8' }} /> Recent Organization Issues
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.2rem' }}>
              Real-time issues queue for triage, assignment, and status updates.
            </p>
          </div>

          <Link
            to={`/org/${currentOrg.id}/issues`}
            className="btn btn-secondary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          >
            View All Issues <ExternalLink size={14} />
          </Link>
        </div>

        {issues.length === 0 ? (
          <EmptyState
            title="No issues reported yet"
            description="When clients or team members report issues to this organization, they will appear here."
            action={
              <Link to={`/org/${currentOrg.id}/issues/new`} className="btn btn-primary btn-sm">
                <Plus size={14} /> Create Issue
              </Link>
            }
          />
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Issue</th>
                  <th>Reporter</th>
                  <th>Assignee</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {issues.slice(0, 10).map((issue) => (
                  <tr key={issue.id}>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-main)' }}>
                        {issue.title}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Created {new Date(issue.created_at).toLocaleDateString()}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>
                        {issue.reporter?.full_name || 'Anonymous Client'}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {issue.reporter?.email}
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.85rem', color: issue.assignee ? 'var(--text-main)' : 'var(--text-muted)' }}>
                        {issue.assignee?.full_name || 'Unassigned'}
                      </span>
                    </td>
                    <td>
                      <StatusBadge status={issue.status} />
                    </td>
                    <td>
                      <PriorityBadge priority={issue.priority} />
                    </td>
                    <td>
                      <Link
                        to={`/org/${currentOrg.id}/issues/${issue.id}`}
                        className="btn btn-secondary btn-sm"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem' }}
                      >
                        Triage <ArrowRight size={13} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
