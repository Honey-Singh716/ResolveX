import React, { useEffect, useState } from 'react'
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Key,
  Layers,
  Plus,
  RefreshCw,
  Search,
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'
import { ErrorAlert } from '../components/ErrorAlert'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { PriorityBadge, StatusBadge } from '../components/StatusBadge'
import { useAuth } from '../context/AuthContext'
import { useOrg } from '../context/OrgContext'
import { api } from '../services/api'
import type { Issue, IssuePriority } from '../types/issue'

export const ClientDashboardPage: React.FC = () => {
  const { user } = useAuth()
  const { organizations } = useOrg()
  const navigate = useNavigate()

  const [tickets, setTickets] = useState<Issue[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Status Filter for my tickets
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [organizationFilter, setOrganizationFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const [isRaiseTicketModalOpen, setIsRaiseTicketModalOpen] = useState(false)

  // Raise Ticket State
  const [ticketOrgId, setTicketOrgId] = useState('')
  const [ticketTitle, setTicketTitle] = useState('')
  const [ticketDesc, setTicketDesc] = useState('')
  const [ticketPriority, setTicketPriority] = useState('medium')
  const [ticketCategory, setTicketCategory] = useState('')
  const [isSubmittingTicket, setIsSubmittingTicket] = useState(false)

  const approvedOrgs = organizations.filter(
    (o) => o.verification_status === 'approved'
  )

  const loadData = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const ticketList = await api.issues.listMine()

      setTickets(ticketList?.issues || [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load your client dashboard data.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Handle Raise Ticket
  const handleRaiseTicket = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ticketOrgId) {
      setError('Please select an organization for this ticket.')
      return
    }
    if (!ticketTitle.trim() || !ticketDesc.trim()) {
      setError('Please provide a title and detailed description.')
      return
    }

    try {
      setIsSubmittingTicket(true)
      setError(null)
      await api.issues.create(ticketOrgId, {
        title: ticketTitle.trim(),
        description: ticketDesc.trim(),
        priority: ticketPriority as IssuePriority,
        category: ticketCategory.trim() || undefined,
      })
      setSuccessMsg('Ticket submitted successfully!')
      setTicketTitle('')
      setTicketDesc('')
      setTicketCategory('')
      setIsRaiseTicketModalOpen(false)
      await loadData()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to raise ticket.')
    } finally {
      setIsSubmittingTicket(false)
    }
  }

  // Filtered tickets
  const filteredTickets = tickets.filter((t) => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false
    if (organizationFilter !== 'all' && t.organization_id !== organizationFilter) return false
    if (
      searchQuery &&
      !t.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !t.description?.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false
    }
    return true
  })

  // Ticket stats
  const totalTickets = tickets.length
  const openCount = tickets.filter((t) => t.status === 'open').length
  const inProgressCount = tickets.filter((t) => t.status === 'in_progress').length
  const resolvedCount = tickets.filter((t) => ['resolved', 'closed'].includes(t.status)).length

  if (isLoading) {
    return <LoadingSpinner fullPage label="Loading your client workspace..." />
  }

  if (approvedOrgs.length === 0) {
    return (
      <div style={{ maxWidth: '760px', margin: '2rem auto' }}>
        <div
          className="card"
          style={{
            padding: '3rem 2rem',
            textAlign: 'center',
            background:
              'radial-gradient(ellipse at 50% 0%, rgba(16, 185, 129, 0.14), transparent 70%), var(--bg-surface)',
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              margin: '0 auto 1.25rem',
              borderRadius: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#34d399',
              background: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
            }}
          >
            <Building2 size={30} />
          </div>
          <h1 style={{ fontSize: '1.65rem' }}>Choose an organization to get started</h1>
          <p
            style={{
              maxWidth: '560px',
              margin: '0.75rem auto 1.75rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.6,
            }}
          >
            Join an existing organization with a code, or submit a new organization
            request for platform administrator verification. Your ticket dashboard
            will appear after you join an approved organization.
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => navigate('/organizations', { state: { open: 'join' } })}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <Key size={16} /> Join Organization by Code
            </button>
            <button
              onClick={() => navigate('/organizations', { state: { open: 'create' } })}
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <Building2 size={16} /> Request New Organization
            </button>
          </div>

          {organizations.length > 0 && (
            <p style={{ marginTop: '1.5rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
              Your organization request or membership is waiting for approval.
              You can submit another join request or review all organizations.
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Header Banner */}
      <div
        style={{
          background: 'radial-gradient(ellipse at 80% 20%, rgba(16, 185, 129, 0.15), transparent 70%), var(--bg-surface)',
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
                background: 'rgba(16, 185, 129, 0.15)',
                color: '#34d399',
                padding: '0.2rem 0.6rem',
                borderRadius: 'var(--radius-full)',
                fontSize: '0.75rem',
                fontWeight: 700,
                letterSpacing: '0.03em',
                textTransform: 'uppercase',
              }}
            >
              Client Portal
            </span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>• Authenticated User</span>
          </div>
          <h1 style={{ fontSize: '1.85rem', letterSpacing: '-0.02em' }}>Welcome back, {user?.full_name}</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.35rem', fontSize: '0.95rem' }}>
            Track your service requests, raise new tickets, or manage your organization memberships.
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {approvedOrgs.length > 0 && (
            <button
              onClick={() => {
                if (approvedOrgs.length > 0) {
                  setTicketOrgId(approvedOrgs[0].id)
                }
                setIsRaiseTicketModalOpen(true)
              }}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#10b981', borderColor: '#059669' }}
            >
              <Plus size={16} /> Raise Ticket
            </button>
          )}

          <button
            onClick={() => navigate('/organizations', { state: { open: 'join' } })}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <Key size={15} style={{ color: '#fbbf24' }} /> Join via Code
          </button>

          <button
            onClick={() => navigate('/organizations', { state: { open: 'create' } })}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <Building2 size={15} style={{ color: '#818cf8' }} /> Request New Org
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

      {/* Metrics Grid */}
      <div className="stat-cards-grid">
        <div className="stat-card">
          <div className="stat-card-label">My Raised Tickets</div>
          <div className="stat-card-value" style={{ color: 'var(--text-main)' }}>
            {totalTickets}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-label">Open / Unresolved</div>
          <div className="stat-card-value" style={{ color: '#60a5fa' }}>
            {openCount}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-label">In Progress</div>
          <div className="stat-card-value" style={{ color: '#fbbf24' }}>
            {inProgressCount}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-label">Resolved / Closed</div>
          <div className="stat-card-value" style={{ color: '#34d399' }}>
            {resolvedCount}
          </div>
        </div>
      </div>

      {/* Section: My Submitted Tickets */}
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
              <Layers size={20} style={{ color: '#10b981' }} /> My Submitted Tickets
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.2rem' }}>
              Only you and authorized organization staff can view your reported issues.
            </p>
          </div>

          {/* Search & Filter */}
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="Search my tickets..."
                className="form-input"
                style={{ paddingLeft: '2.2rem', paddingRight: '0.75rem', fontSize: '0.85rem', width: '200px' }}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <Search
                size={14}
                style={{
                  position: 'absolute',
                  left: '0.75rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                }}
              />
            </div>

            <select
              className="form-input"
              style={{ width: 'auto', fontSize: '0.85rem' }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>

            <select
              className="form-input"
              style={{ width: 'auto', fontSize: '0.85rem', maxWidth: '220px' }}
              value={organizationFilter}
              onChange={(e) => setOrganizationFilter(e.target.value)}
              aria-label="Filter tickets by organization"
            >
              <option value="all">All Organizations</option>
              {approvedOrgs.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>

            <button onClick={loadData} className="btn btn-secondary btn-sm" title="Refresh Tickets">
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {/* Tickets Table or Empty State */}
        {filteredTickets.length === 0 ? (
          <EmptyState
            title="No tickets found"
            description={
              searchQuery || statusFilter !== 'all' || organizationFilter !== 'all'
                ? 'No tickets match your search criteria.'
                : approvedOrgs.length > 0
                ? "You haven't submitted any tickets yet. Raise your first ticket to get support."
                : 'Join an organization using a join code or request a new organization to start submitting tickets.'
            }
            action={
              approvedOrgs.length > 0 ? (
                <button
                  onClick={() => {
                    setTicketOrgId(approvedOrgs[0].id)
                    setIsRaiseTicketModalOpen(true)
                  }}
                  className="btn btn-primary btn-sm"
                >
                  <Plus size={14} /> Raise Ticket
                </button>
              ) : undefined
            }
          />
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Ticket</th>
                  <th>Organization</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Created</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredTickets.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-main)' }}>{t.title}</div>
                      {t.description && (
                        <div
                          style={{
                            fontSize: '0.78rem',
                            color: 'var(--text-muted)',
                            maxWidth: '320px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            marginTop: '0.15rem',
                          }}
                        >
                          {t.description}
                        </div>
                      )}
                    </td>
                    <td>
                      <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>
                        {organizations.find((o) => o.id === t.organization_id)?.name || 'Organization'}
                      </div>
                    </td>
                    <td>
                      <StatusBadge status={t.status} />
                    </td>
                    <td>
                      <PriorityBadge priority={t.priority} />
                    </td>
                    <td>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {new Date(t.created_at).toLocaleDateString()}
                      </span>
                    </td>
                    <td>
                      <Link
                        to={`/client/tickets/${t.id}`}
                        className="btn btn-secondary btn-sm"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem' }}
                      >
                        View Details <ArrowRight size={13} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL: Raise Ticket */}
      {isRaiseTicketModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: '520px' }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Raise a New Ticket</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
              Submit a support or service issue directly to your organization team.
            </p>

            <form onSubmit={handleRaiseTicket}>
              <div className="form-group">
                <label className="form-label" htmlFor="ticket-org-select">
                  Organization *
                </label>
                <select
                  id="ticket-org-select"
                  className="form-input"
                  value={ticketOrgId}
                  onChange={(e) => setTicketOrgId(e.target.value)}
                  required
                >
                  {approvedOrgs.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name} ({org.role})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="ticket-title">
                  Issue Title *
                </label>
                <input
                  id="ticket-title"
                  type="text"
                  placeholder="Brief summary of the problem"
                  className="form-input"
                  value={ticketTitle}
                  onChange={(e) => setTicketTitle(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="ticket-desc">
                  Detailed Description *
                </label>
                <textarea
                  id="ticket-desc"
                  placeholder="Explain the issue in detail, steps to reproduce, or requested assistance..."
                  className="form-input"
                  style={{ minHeight: '90px' }}
                  value={ticketDesc}
                  onChange={(e) => setTicketDesc(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="ticket-priority">
                    Priority
                  </label>
                  <select
                    id="ticket-priority"
                    className="form-input"
                    value={ticketPriority}
                    onChange={(e) => setTicketPriority(e.target.value)}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="ticket-category">
                    Category (Optional)
                  </label>
                  <input
                    id="ticket-category"
                    type="text"
                    placeholder="e.g. IT, Billing"
                    className="form-input"
                    value={ticketCategory}
                    onChange={(e) => setTicketCategory(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button
                  type="button"
                  onClick={() => setIsRaiseTicketModalOpen(false)}
                  className="btn btn-secondary"
                  disabled={isSubmittingTicket}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ background: '#10b981', borderColor: '#059669' }}
                  disabled={isSubmittingTicket}
                >
                  {isSubmittingTicket ? 'Submitting...' : 'Submit Ticket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
