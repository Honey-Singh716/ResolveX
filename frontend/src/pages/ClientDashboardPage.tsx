import React, { useEffect, useState } from 'react'
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock3,
  FolderOpen,
  Key,
  Layers,
  Plus,
  RefreshCw,
  Search,
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'
import './client-dashboard.css'
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
      <div className="rx-dash">
        <div className="rx-dash-gate">
          <Building2 size={30} aria-hidden="true" />
          <h1>Choose an organization to get started</h1>
          <p>
            Join an existing organization with a code, or submit a new organization
            request for platform administrator verification. Your ticket dashboard
            will appear after you join an approved organization.
          </p>
          <div className="rx-dash-actions">
            <button className="rx-dash-btn rx-dash-btn-primary" onClick={() => navigate('/organizations', { state: { open: 'join' } })}>
              <Key size={16} /> Join Organization by Code
            </button>
            <button className="rx-dash-btn rx-dash-btn-secondary" onClick={() => navigate('/organizations', { state: { open: 'create' } })}>
              <Building2 size={16} /> Request New Organization
            </button>
          </div>
          {organizations.length > 0 && (
            <p className="rx-dash-note">
              Your organization request or membership is waiting for approval.
              You can submit another join request or review all organizations.
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="rx-dash">
      <section className="rx-dash-hero">
        <div className="rx-dash-hero-copy">
          <p className="rx-dash-kicker">CLIENT DASHBOARD</p>
          <h1>Welcome back, {user?.full_name}</h1>
          <p>Track your service requests, raise new tickets, or manage your organization memberships.</p>
          <div className="rx-dash-actions">
            <button
              className="rx-dash-btn rx-dash-btn-primary"
              onClick={() => {
                setTicketOrgId(approvedOrgs[0].id)
                setIsRaiseTicketModalOpen(true)
              }}
            >
              <Plus size={16} /> Raise Ticket
            </button>
            <button className="rx-dash-btn rx-dash-btn-secondary" onClick={() => navigate('/organizations', { state: { open: 'join' } })}>
              <Key size={15} /> Join via Code
            </button>
            <button className="rx-dash-btn rx-dash-btn-secondary" onClick={() => navigate('/organizations', { state: { open: 'create' } })}>
              <Building2 size={15} /> Request New Org
            </button>
          </div>
        </div>
        <div className="rx-dash-hero-photo" aria-hidden="true">
          <img src="/portal/dash-hero.png" alt="" />
        </div>
      </section>

      {/* Alerts */}
      <ErrorAlert message={error} onDismiss={() => setError(null)} />
      {successMsg && (
        <div className="rx-dash-success">
          <span><CheckCircle2 size={18} /> {successMsg}</span>
          <button type="button" className="rx-dash-btn rx-dash-btn-secondary" onClick={() => setSuccessMsg(null)}>
            Dismiss
          </button>
        </div>
      )}

      <section className="rx-dash-stats" aria-label="Ticket summary">
        <div className="rx-dash-stat rx-dash-stat-beige">
          <i><Layers size={18} /></i>
          <span>My Raised Tickets</span>
          <strong>{totalTickets}</strong>
        </div>
        <div className="rx-dash-stat rx-dash-stat-blue">
          <i><FolderOpen size={18} /></i>
          <span>Open / Unresolved</span>
          <strong>{openCount}</strong>
        </div>
        <div className="rx-dash-stat rx-dash-stat-amber">
          <i><Clock3 size={18} /></i>
          <span>In Progress</span>
          <strong>{inProgressCount}</strong>
        </div>
        <div className="rx-dash-stat rx-dash-stat-green">
          <i><CheckCircle2 size={18} /></i>
          <span>Resolved / Closed</span>
          <strong>{resolvedCount}</strong>
        </div>
      </section>

      {/* Section: My Submitted Tickets */}
      <section className="rx-dash-panel">
        <svg className="rx-dash-plane" width="92" height="46" viewBox="0 0 92 46" fill="none" aria-hidden="true">
          <path d="M4 34c18-2 28-16 40-22" stroke="currentColor" strokeWidth="1.4" strokeDasharray="3 4" />
          <path d="M48 8l28 6-18 8 4 10-8-8-6 4 0-20z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
        </svg>
        <div className="rx-dash-head">
          <h2><Layers size={18} /> My Submitted Tickets</h2>
          <p>Only you and authorized organization staff can view your reported issues.</p>
        </div>
        <div className="rx-dash-toolbar">
            <div className="rx-dash-search">
              <Search size={14} aria-hidden="true" />
              <input
                type="text"
                placeholder="Search my tickets..."
                className="form-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search my tickets"
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

            <button type="button" onClick={loadData} className="rx-dash-btn rx-dash-btn-secondary rx-dash-refresh" title="Refresh Tickets" aria-label="Refresh tickets">
              <RefreshCw size={14} />
            </button>
        </div>

        {/* Tickets Table or Empty State */}
        {filteredTickets.length === 0 ? (
          <div className="rx-dash-empty">
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
                  className="rx-dash-btn rx-dash-btn-primary"
                >
                  <Plus size={14} /> Raise Ticket
                </button>
              ) : undefined
            }
          />
          </div>
        ) : (
          <div className="rx-dash-table-wrap">
            <table className="rx-dash-table">
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
                      <div className="rx-dash-title">
                        {t.title}
                        {t.description && <small>{t.description}</small>}
                      </div>
                    </td>
                    <td>{organizations.find((o) => o.id === t.organization_id)?.name || 'Organization'}</td>
                    <td><StatusBadge status={t.status} /></td>
                    <td><PriorityBadge priority={t.priority} /></td>
                    <td>{new Date(t.created_at).toLocaleDateString()}</td>
                    <td>
                      <Link to={`/client/tickets/${t.id}`} className="rx-dash-btn rx-dash-btn-secondary">
                        View Details <ArrowRight size={13} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* MODAL: Raise Ticket */}
      {isRaiseTicketModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: '520px' }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Raise a New Ticket</h2>
            <p style={{ fontSize: '0.85rem', marginBottom: '1.25rem' }}>
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
                  className="rx-dash-btn rx-dash-btn-secondary"
                  disabled={isSubmittingTicket}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rx-dash-btn rx-dash-btn-primary"
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
