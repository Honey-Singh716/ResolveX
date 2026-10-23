import React, { useEffect, useState } from 'react'
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Clock,
  RefreshCw,
  ShieldCheck,
  Slash,
  Trash2,
  UserPlus,
} from 'lucide-react'
import { EmptyState } from '../components/EmptyState'
import { ErrorAlert } from '../components/ErrorAlert'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { VerificationBadge } from '../components/StatusBadge'
import { useAuth } from '../context/AuthContext'
import { api } from '../services/api'
import type {
  OrganizationPlatformResponse,
  PlatformAdminUser,
  PlatformStatsResponse,
} from '../types/organization'

export const PlatformAdminPage: React.FC = () => {
  const { user } = useAuth()

  // Tabs: 'overview' | 'queue' | 'admins'
  const [activeTab, setActiveTab] = useState<'overview' | 'queue' | 'admins'>('overview')

  // Stats State
  const [stats, setStats] = useState<PlatformStatsResponse | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [statsError, setStatsError] = useState<string | null>(null)

  // Verification Queue State
  const [orgs, setOrgs] = useState<OrganizationPlatformResponse[]>([])
  const [totalOrgs, setTotalOrgs] = useState(0)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [orgsLoading, setOrgsLoading] = useState(true)

  // Admins State
  const [admins, setAdmins] = useState<PlatformAdminUser[]>([])
  const [adminsLoading, setAdminsLoading] = useState(true)
  const [promoteEmail, setPromoteEmail] = useState('')
  const [isPromoting, setIsPromoting] = useState(false)
  const [isPromoteModalOpen, setIsPromoteModalOpen] = useState(false)

  // Reject / Suspend Modal State
  const [actionOrg, setActionOrg] = useState<{ id: string; name: string; type: 'reject' | 'suspend' } | null>(null)
  const [actionReason, setActionReason] = useState('')

  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [actionInProgress, setActionInProgress] = useState<string | null>(null)

  // Load Platform Stats
  const loadStats = async () => {
    try {
      setStatsLoading(true)
      setStatsError(null)
      const data = await api.platform.getStats()
      setStats(data)
    } catch (err: unknown) {
      setStatsError(err instanceof Error ? err.message : 'Failed to load platform aggregate statistics.')
    } finally {
      setStatsLoading(false)
    }
  }

  // Load Organizations Queue
  const loadOrganizations = async () => {
    try {
      setOrgsLoading(true)
      const res = await api.platform.listOrganizations(statusFilter || undefined, 1, 100)
      setOrgs(res.organizations || [])
      setTotalOrgs(res.total)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load platform organizations.')
    } finally {
      setOrgsLoading(false)
    }
  }

  // Load Admins
  const loadAdmins = async () => {
    try {
      setAdminsLoading(true)
      const res = await api.platform.listAdmins()
      setAdmins(res.admins || [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load platform administrators.')
    } finally {
      setAdminsLoading(false)
    }
  }

  useEffect(() => {
    loadStats()
    loadOrganizations()
    loadAdmins()
  }, [])

  useEffect(() => {
    loadOrganizations()
  }, [statusFilter])

  // Approve Organization
  const handleApprove = async (orgId: string, orgName: string) => {
    try {
      setActionInProgress(orgId)
      setError(null)
      await api.platform.approveOrg(orgId)
      setSuccessMsg(`Organization "${orgName}" approved successfully! Requester now has owner access.`)
      await loadOrganizations()
      await loadStats()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to approve organization.')
    } finally {
      setActionInProgress(null)
    }
  }

  // Submit Reject or Suspend with Reason
  const handleConfirmAction = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!actionOrg) return

    if (!actionReason.trim()) {
      setError('A detailed reason is required.')
      return
    }

    try {
      setActionInProgress(actionOrg.id)
      setError(null)
      if (actionOrg.type === 'reject') {
        await api.platform.rejectOrg(actionOrg.id, actionReason.trim())
        setSuccessMsg(`Organization "${actionOrg.name}" rejected.`)
      } else {
        await api.platform.suspendOrg(actionOrg.id, actionReason.trim())
        setSuccessMsg(`Organization "${actionOrg.name}" suspended.`)
      }
      setActionOrg(null)
      setActionReason('')
      await loadOrganizations()
      await loadStats()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : `Failed to ${actionOrg.type} organization.`)
    } finally {
      setActionInProgress(null)
    }
  }

  // Promote Admin
  const handlePromoteAdmin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!promoteEmail.trim()) return

    try {
      setIsPromoting(true)
      setError(null)
      const promoted = await api.platform.promoteAdmin(promoteEmail.trim())
      setSuccessMsg(`User ${promoted.full_name} (${promoted.email}) granted platform administrator privileges!`)
      setPromoteEmail('')
      setIsPromoteModalOpen(false)
      await loadAdmins()
      await loadStats()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to promote administrator.')
    } finally {
      setIsPromoting(false)
    }
  }

  // Revoke Admin
  const handleRevokeAdmin = async (targetId: string, targetName: string) => {
    if (!window.confirm(`Are you sure you want to revoke platform administrator privileges for "${targetName}"?`)) {
      return
    }

    try {
      setActionInProgress(targetId)
      setError(null)
      await api.platform.revokeAdmin(targetId)
      setSuccessMsg(`Platform administrator privileges revoked for "${targetName}".`)
      await loadAdmins()
      await loadStats()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to revoke administrator privileges.')
    } finally {
      setActionInProgress(null)
    }
  }

  return (
    <div style={{ maxWidth: '1150px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Platform Banner */}
      <div
        style={{
          background: 'radial-gradient(ellipse at 80% 20%, rgba(168, 85, 247, 0.2), transparent 70%), var(--bg-surface)',
          border: '1px solid rgba(168, 85, 247, 0.35)',
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
                background: 'rgba(168, 85, 247, 0.2)',
                color: '#d8b4fe',
                padding: '0.2rem 0.65rem',
                borderRadius: 'var(--radius-full)',
                fontSize: '0.75rem',
                fontWeight: 700,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              Platform Administration
            </span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>• Superadmin Console</span>
          </div>
          <h1 style={{ fontSize: '1.85rem', letterSpacing: '-0.02em' }}>Platform Governance Dashboard</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.35rem', fontSize: '0.95rem' }}>
            Manage organization lifecycle verifications, monitor global metrics, and administer platform staff.
          </p>
        </div>

        {/* Global actions */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => {
              loadStats()
              loadOrganizations()
              loadAdmins()
            }}
            className="btn btn-secondary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <RefreshCw size={14} /> Refresh All
          </button>
          <button
            onClick={() => setIsPromoteModalOpen(true)}
            className="btn btn-primary btn-sm"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              background: 'linear-gradient(135deg, #a855f7, #6366f1)',
              borderColor: 'transparent',
            }}
          >
            <UserPlus size={14} /> Promote Admin
          </button>
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

      {/* Navigation Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          borderBottom: '1px solid var(--border-medium)',
          paddingBottom: '0.5rem',
        }}
      >
        <button
          onClick={() => setActiveTab('overview')}
          className={`btn-ghost btn-sm ${activeTab === 'overview' ? 'active' : ''}`}
          style={{
            fontWeight: 600,
            padding: '0.5rem 1rem',
            borderRadius: 'var(--radius-md)',
            background: activeTab === 'overview' ? 'var(--bg-surface-elevated)' : 'transparent',
            color: activeTab === 'overview' ? '#d8b4fe' : 'var(--text-secondary)',
            border: activeTab === 'overview' ? '1px solid rgba(168, 85, 247, 0.3)' : '1px solid transparent',
          }}
        >
          System Overview & Metrics
        </button>

        <button
          onClick={() => setActiveTab('queue')}
          className={`btn-ghost btn-sm ${activeTab === 'queue' ? 'active' : ''}`}
          style={{
            fontWeight: 600,
            padding: '0.5rem 1rem',
            borderRadius: 'var(--radius-md)',
            background: activeTab === 'queue' ? 'var(--bg-surface-elevated)' : 'transparent',
            color: activeTab === 'queue' ? '#d8b4fe' : 'var(--text-secondary)',
            border: activeTab === 'queue' ? '1px solid rgba(168, 85, 247, 0.3)' : '1px solid transparent',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
          }}
        >
          Organization Verification Queue
          {stats && stats.pending_organizations > 0 && (
            <span
              style={{
                background: '#fbbf24',
                color: '#000',
                fontSize: '0.7rem',
                fontWeight: 800,
                padding: '0.1rem 0.4rem',
                borderRadius: 'var(--radius-full)',
              }}
            >
              {stats.pending_organizations}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('admins')}
          className={`btn-ghost btn-sm ${activeTab === 'admins' ? 'active' : ''}`}
          style={{
            fontWeight: 600,
            padding: '0.5rem 1rem',
            borderRadius: 'var(--radius-md)',
            background: activeTab === 'admins' ? 'var(--bg-surface-elevated)' : 'transparent',
            color: activeTab === 'admins' ? '#d8b4fe' : 'var(--text-secondary)',
            border: activeTab === 'admins' ? '1px solid rgba(168, 85, 247, 0.3)' : '1px solid transparent',
          }}
        >
          Platform Administrators ({admins.length})
        </button>
      </div>

      {/* TAB 1: System Overview */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {statsLoading ? (
            <LoadingSpinner label="Loading platform aggregate statistics..." />
          ) : stats ? (
            <>
              <div className="stat-cards-grid">
                <div className="stat-card">
                  <div className="stat-card-label">Total Organizations</div>
                  <div className="stat-card-value" style={{ color: 'var(--text-main)' }}>
                    {stats.total_organizations}
                  </div>
                </div>

                <div className="stat-card" style={{ borderColor: 'rgba(245, 158, 11, 0.3)' }}>
                  <div className="stat-card-label">Pending Verification</div>
                  <div className="stat-card-value" style={{ color: '#fbbf24' }}>
                    {stats.pending_organizations}
                  </div>
                </div>

                <div className="stat-card" style={{ borderColor: 'rgba(16, 185, 129, 0.3)' }}>
                  <div className="stat-card-label">Approved & Active</div>
                  <div className="stat-card-value" style={{ color: '#34d399' }}>
                    {stats.approved_organizations}
                  </div>
                </div>

                <div className="stat-card" style={{ borderColor: 'rgba(239, 68, 68, 0.3)' }}>
                  <div className="stat-card-label">Suspended / Rejected</div>
                  <div className="stat-card-value" style={{ color: '#f87171' }}>
                    {stats.suspended_organizations + stats.rejected_organizations}
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-card-label">Registered Platform Users</div>
                  <div className="stat-card-value" style={{ color: '#818cf8' }}>
                    {stats.total_users}
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-card-label">Platform-Wide Issues</div>
                  <div className="stat-card-value" style={{ color: '#60a5fa' }}>
                    {stats.total_issues}
                  </div>
                </div>
              </div>

              {/* Quick Queue Summary Card */}
              <div className="card" style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                  <div>
                    {stats.pending_organizations > 0 ? (
                      <>
                        <h3 style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Clock size={18} style={{ color: '#fbbf24' }} /> {stats.pending_organizations} Pending Organization Verification Request{stats.pending_organizations > 1 ? 's' : ''}
                        </h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.2rem' }}>
                          Organizations requesting activation on ResolveX require platform review.
                        </p>
                      </>
                    ) : (
                      <>
                        <h3 style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#34d399' }}>
                          <CheckCircle2 size={18} style={{ color: '#34d399' }} /> Verification Queue All Caught Up
                        </h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.2rem' }}>
                          All organization verification requests have been reviewed and approved.
                        </p>
                      </>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      setStatusFilter(stats.pending_organizations > 0 ? 'pending' : '')
                      setActiveTab('queue')
                    }}
                    className="btn btn-secondary btn-sm"
                  >
                    {stats.pending_organizations > 0 ? 'Review Pending Queue →' : 'View All Organizations →'}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <ErrorAlert
                message={statsError || 'Could not load platform statistics.'}
                onDismiss={() => setStatsError(null)}
              />
              <EmptyState
                title="Stats unavailable"
                description={statsError || 'Could not load platform statistics.'}
                action={
                  <button
                    onClick={loadStats}
                    className="btn btn-secondary btn-sm"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                  >
                    <RefreshCw size={14} /> Retry Loading Statistics
                  </button>
                }
              />
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Organization Verification Queue */}
      {activeTab === 'queue' && (
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
                <Building2 size={20} style={{ color: '#a855f7' }} /> Organization Verification Queue
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.2rem' }}>
                Approve valid tenant workspaces, reject invalid submissions with reason, or suspend policy violators.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <select
                className="form-input"
                style={{ width: 'auto', fontSize: '0.85rem' }}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">All Statuses ({totalOrgs})</option>
                <option value="pending">Pending Only</option>
                <option value="approved">Approved Only</option>
                <option value="suspended">Suspended Only</option>
                <option value="rejected">Rejected Only</option>
              </select>

              <button onClick={loadOrganizations} className="btn btn-secondary btn-sm" title="Refresh">
                <RefreshCw size={14} />
              </button>
            </div>
          </div>

          {orgsLoading ? (
            <LoadingSpinner label="Loading organization queue..." />
          ) : orgs.length === 0 ? (
            <EmptyState
              title="No organizations found"
              description={
                statusFilter ? `No organizations with status "${statusFilter}".` : 'No organizations have been created yet.'
              }
            />
          ) : (
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Organization</th>
                    <th>Status</th>
                    <th>Owner / Requester</th>
                    <th>Registered</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orgs.map((org) => {
                    const isPending = org.verification_status === 'pending'
                    const isApproved = org.verification_status === 'approved'
                    const isSuspended = org.verification_status === 'suspended'
                    const isBusy = actionInProgress === org.id

                    return (
                      <tr key={org.id}>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-main)' }}>
                            {org.name}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            Slug: {org.slug} {org.industry && `• ${org.industry}`}
                          </div>
                          {org.rejection_reason && (
                            <div style={{ fontSize: '0.72rem', color: '#f87171', marginTop: '0.2rem' }}>
                              Reason: {org.rejection_reason}
                            </div>
                          )}
                        </td>
                        <td>
                          <VerificationBadge status={org.verification_status} />
                        </td>
                        <td>
                          <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>
                            {org.owner_name || org.owner_email || '—'}
                          </div>
                          {org.owner_name && (
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{org.owner_email}</div>
                          )}
                        </td>
                        <td>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            {new Date(org.created_at).toLocaleDateString()}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                            {isPending && (
                              <>
                                <button
                                  onClick={() => handleApprove(org.id, org.name)}
                                  className="btn btn-secondary btn-sm"
                                  style={{
                                    fontSize: '0.75rem',
                                    color: '#34d399',
                                    borderColor: 'rgba(16, 185, 129, 0.4)',
                                  }}
                                  disabled={isBusy}
                                >
                                  <CheckCircle2 size={13} /> Approve
                                </button>
                                <button
                                  onClick={() => setActionOrg({ id: org.id, name: org.name, type: 'reject' })}
                                  className="btn btn-secondary btn-sm"
                                  style={{
                                    fontSize: '0.75rem',
                                    color: '#f87171',
                                    borderColor: 'rgba(239, 68, 68, 0.4)',
                                  }}
                                  disabled={isBusy}
                                >
                                  <Slash size={13} /> Reject
                                </button>
                              </>
                            )}

                            {isApproved && (
                              <button
                                onClick={() => setActionOrg({ id: org.id, name: org.name, type: 'suspend' })}
                                className="btn btn-secondary btn-sm"
                                style={{
                                  fontSize: '0.75rem',
                                  color: '#fbbf24',
                                  borderColor: 'rgba(245, 158, 11, 0.4)',
                                }}
                                disabled={isBusy}
                              >
                                <AlertTriangle size={13} /> Suspend
                              </button>
                            )}

                            {isSuspended && (
                              <button
                                onClick={() => handleApprove(org.id, org.name)}
                                className="btn btn-secondary btn-sm"
                                style={{
                                  fontSize: '0.75rem',
                                  color: '#34d399',
                                  borderColor: 'rgba(16, 185, 129, 0.4)',
                                }}
                                disabled={isBusy}
                              >
                                <CheckCircle2 size={13} /> Reinstate
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Platform Administrators */}
      {activeTab === 'admins' && (
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
                <ShieldCheck size={20} style={{ color: '#a855f7' }} /> Platform Administrator Roster
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.2rem' }}>
                Users authorized with server-side platform governance privileges.
              </p>
            </div>

            <button
              onClick={() => setIsPromoteModalOpen(true)}
              className="btn btn-primary btn-sm"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                background: 'linear-gradient(135deg, #a855f7, #6366f1)',
                borderColor: 'transparent',
              }}
            >
              <UserPlus size={14} /> Promote Admin
            </button>
          </div>

          {adminsLoading ? (
            <LoadingSpinner label="Loading administrator roster..." />
          ) : (
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Administrator</th>
                    <th>Email Address</th>
                    <th>Account Status</th>
                    <th>Member Since</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {admins.map((adm) => {
                    const isSelf = adm.id === user?.id
                    const isOnlyAdmin = admins.length === 1
                    const isBusy = actionInProgress === adm.id

                    return (
                      <tr key={adm.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <div
                              style={{
                                width: '30px',
                                height: '30px',
                                borderRadius: '50%',
                                background: 'rgba(168, 85, 247, 0.2)',
                                color: '#c084fc',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 700,
                                fontSize: '0.85rem',
                              }}
                            >
                              {adm.full_name?.charAt(0) || 'A'}
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{adm.full_name}</div>
                              {isSelf && (
                                <span style={{ fontSize: '0.72rem', color: '#c084fc', fontWeight: 600 }}>
                                  (Current Session)
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td>
                          <span style={{ fontSize: '0.85rem', fontFamily: 'var(--font-mono)' }}>{adm.email}</span>
                        </td>
                        <td>
                          <span
                            style={{
                              background: 'rgba(168, 85, 247, 0.15)',
                              border: '1px solid rgba(168, 85, 247, 0.35)',
                              color: '#d8b4fe',
                              padding: '0.15rem 0.5rem',
                              borderRadius: 'var(--radius-full)',
                              fontSize: '0.72rem',
                              fontWeight: 600,
                            }}
                          >
                            Platform Admin
                          </span>
                        </td>
                        <td>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            {new Date(adm.created_at).toLocaleDateString()}
                          </span>
                        </td>
                        <td>
                          {!isSelf && !isOnlyAdmin ? (
                            <button
                              onClick={() => handleRevokeAdmin(adm.id, adm.full_name)}
                              className="btn btn-secondary btn-sm"
                              style={{ color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.3)', fontSize: '0.75rem' }}
                              disabled={isBusy}
                            >
                              <Trash2 size={12} /> Revoke
                            </button>
                          ) : (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {isSelf ? 'Cannot revoke self' : 'Last admin protected'}
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MODAL: Reject or Suspend with Reason */}
      {actionOrg && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: '480px' }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>
              {actionOrg.type === 'reject' ? 'Reject Organization Verification' : 'Suspend Organization'}
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
              State the reason for {actionOrg.type === 'reject' ? 'rejecting' : 'suspending'} "
              <strong>{actionOrg.name}</strong>". This explanation will be logged and communicated to the organization
              owner.
            </p>

            <form onSubmit={handleConfirmAction}>
              <div className="form-group">
                <label className="form-label" htmlFor="action-reason">
                  Reason *
                </label>
                <textarea
                  id="action-reason"
                  className="form-input"
                  style={{ minHeight: '90px' }}
                  placeholder="e.g. Incomplete business documentation, policy violation, or duplicate request..."
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    setActionOrg(null)
                    setActionReason('')
                  }}
                  className="btn btn-secondary"
                  disabled={actionInProgress !== null}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{
                    background: actionOrg.type === 'reject' ? '#ef4444' : '#f59e0b',
                    borderColor: 'transparent',
                  }}
                  disabled={actionInProgress !== null}
                >
                  Confirm {actionOrg.type === 'reject' ? 'Rejection' : 'Suspension'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Promote Admin */}
      {isPromoteModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: '460px' }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Promote Platform Administrator</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
              Grant platform superadmin privileges to an existing registered user. The user will be able to verify
              organizations, suspend tenants, and manage platform staff.
            </p>

            <form onSubmit={handlePromoteAdmin}>
              <div className="form-group">
                <label className="form-label" htmlFor="promote-email">
                  User Email Address *
                </label>
                <input
                  id="promote-email"
                  type="email"
                  placeholder="user@resolvex.internal"
                  className="form-input"
                  value={promoteEmail}
                  onChange={(e) => setPromoteEmail(e.target.value)}
                  required
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem', display: 'block' }}>
                  Note: If a platform admin domain restriction is configured, the user's email must match the allowed domain.
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button
                  type="button"
                  onClick={() => setIsPromoteModalOpen(false)}
                  className="btn btn-secondary"
                  disabled={isPromoting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ background: 'linear-gradient(135deg, #a855f7, #6366f1)', borderColor: 'transparent' }}
                  disabled={isPromoting}
                >
                  {isPromoting ? 'Promoting...' : 'Confirm Promotion'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
