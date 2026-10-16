import React, { useEffect, useState } from 'react'
import {
  AlertTriangle,
  ArrowUpDown,
  CheckCircle2,
  Clock,
  Filter,
  Inbox,
  Plus,
  RefreshCw,
  Search,
} from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'
import { ErrorAlert } from '../components/ErrorAlert'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { PriorityBadge, StatusBadge } from '../components/StatusBadge'
import { useOrg } from '../context/OrgContext'
import { api } from '../services/api'
import type { Issue, IssueFilterParams } from '../types/issue'

export const IssueDashboardPage: React.FC = () => {
  const { orgId } = useParams<{ orgId: string }>()
  const { currentOrg, selectOrg } = useOrg()
  const navigate = useNavigate()

  const activeOrgId = orgId || currentOrg?.id

  // State
  const [issues, setIssues] = useState<Issue[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(15)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [priorityFilter, setPriorityFilter] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [sortBy, setSortBy] = useState<'created_at' | 'updated_at' | 'priority' | 'status' | 'issue_key'>('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Metrics (computed from current query or fast counters)
  const [openCount, setOpenCount] = useState(0)
  const [inProgressCount, setInProgressCount] = useState(0)
  const [resolvedCount, setResolvedCount] = useState(0)
  const [urgentCount, setUrgentCount] = useState(0)

  useEffect(() => {
    if (orgId && currentOrg?.id !== orgId) {
      selectOrg(orgId)
    }
  }, [orgId, currentOrg?.id])

  const loadIssues = async () => {
    if (!activeOrgId) {
      setIssues([])
      setTotal(0)
      setError('Select an approved organization to view its issue queue.')
      setIsLoading(false)
      return
    }
    try {
      setIsLoading(true)
      setError(null)
      const params: IssueFilterParams = {
        page,
        page_size: pageSize,
        sort_by: sortBy,
        sort_order: sortOrder,
      }
      if (statusFilter) params.status = statusFilter
      if (priorityFilter) params.priority = priorityFilter
      if (searchQuery.trim()) params.search = searchQuery.trim()

      const res = await api.issues.list(activeOrgId, params)
      setIssues(res.issues || [])
      setTotal(res.total)

      // Fetch summary counters once or on fresh load
      const [allOpen, allProg, allRes, allUrg] = await Promise.all([
        api.issues.list(activeOrgId, { status: 'open', page_size: 1 }),
        api.issues.list(activeOrgId, { status: 'in_progress', page_size: 1 }),
        api.issues.list(activeOrgId, { status: 'resolved', page_size: 1 }),
        api.issues.list(activeOrgId, { priority: 'urgent', page_size: 1 }),
      ])
      setOpenCount(allOpen.total)
      setInProgressCount(allProg.total)
      setResolvedCount(allRes.total)
      setUrgentCount(allUrg.total)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch issues.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadIssues()
  }, [activeOrgId, page, statusFilter, priorityFilter, sortBy, sortOrder])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    loadIssues()
  }

  const handleResetFilters = () => {
    setStatusFilter('')
    setPriorityFilter('')
    setSearchQuery('')
    setSortBy('created_at')
    setSortOrder('desc')
    setPage(1)
  }

  const isClient = currentOrg?.role === 'client'

  return (
    <div>
      {/* Header and Quick Action */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1.5rem',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <h1>{isClient ? 'My Reported Tickets' : 'Issue Tracker & Service Desk'}</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
            {isClient
              ? 'Track status and resolution progress for tickets you submitted'
              : 'Manage complaints, maintenance tickets, and service workflows'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={loadIssues}
            className="btn btn-secondary btn-icon"
            title="Refresh issues"
          >
            <RefreshCw size={16} />
          </button>
          {isClient && (
            <Link to={`/org/${activeOrgId}/issues/new`} className="btn btn-primary">
              <Plus size={16} /> New Issue
            </Link>
          )}
        </div>
      </div>

      <ErrorAlert message={error} onDismiss={() => setError(null)} />

      {/* KPI Stats Grid */}
      <div className="stat-grid">
        <div className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="stat-card-label">Open Issues</span>
            <Inbox size={18} style={{ color: 'var(--status-open-text)' }} />
          </div>
          <div className="stat-card-value" style={{ color: 'var(--status-open-text)' }}>
            {openCount}
          </div>
        </div>

        <div className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="stat-card-label">In Progress</span>
            <Clock size={18} style={{ color: 'var(--status-progress-text)' }} />
          </div>
          <div className="stat-card-value" style={{ color: 'var(--status-progress-text)' }}>
            {inProgressCount}
          </div>
        </div>

        <div className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="stat-card-label">Resolved</span>
            <CheckCircle2 size={18} style={{ color: 'var(--status-resolved-text)' }} />
          </div>
          <div className="stat-card-value" style={{ color: 'var(--status-resolved-text)' }}>
            {resolvedCount}
          </div>
        </div>

        <div className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="stat-card-label">Urgent Priority</span>
            <AlertTriangle size={18} style={{ color: 'var(--priority-urgent-text)' }} />
          </div>
          <div className="stat-card-value" style={{ color: 'var(--priority-urgent-text)' }}>
            {urgentCount}
          </div>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div
        className="card"
        style={{
          marginBottom: '1.25rem',
          padding: '1rem',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.75rem',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <form
          onSubmit={handleSearchSubmit}
          style={{ display: 'flex', gap: '0.5rem', flex: '1 1 280px', maxWidth: '420px' }}
        >
          <div style={{ position: 'relative', width: '100%' }}>
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: '2.3rem', paddingRight: '0.5rem', height: '38px' }}
              placeholder="Search title or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Search
              size={15}
              style={{
                position: 'absolute',
                left: '0.8rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
              }}
            />
          </div>
          <button type="submit" className="btn btn-secondary btn-sm" style={{ height: '38px' }}>
            Search
          </button>
        </form>

        <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Status Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Filter size={14} style={{ color: 'var(--text-muted)' }} />
            <select
              className="form-select"
              style={{ height: '38px', padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value)
                setPage(1)
              }}
            >
              <option value="">All Statuses</option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
          </div>

          {/* Priority Filter */}
          <select
            className="form-select"
            style={{ height: '38px', padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}
            value={priorityFilter}
            onChange={(e) => {
              setPriorityFilter(e.target.value)
              setPage(1)
            }}
          >
            <option value="">All Priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          {/* Sorting */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <ArrowUpDown size={14} style={{ color: 'var(--text-muted)' }} />
            <select
              className="form-select"
              style={{ height: '38px', padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}
              value={sortBy}
              onChange={(e) =>
                setSortBy(
                  e.target.value as 'created_at' | 'updated_at' | 'priority' | 'status' | 'issue_key'
                )
              }
            >
              <option value="created_at">Date Created</option>
              <option value="updated_at">Date Updated</option>
              <option value="priority">Priority</option>
              <option value="status">Status</option>
              <option value="issue_key">Key</option>
            </select>

            <button
              onClick={() => setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
              className="btn btn-secondary btn-sm"
              style={{ height: '38px', padding: '0 0.6rem' }}
              title={`Sort ${sortOrder === 'asc' ? 'Descending' : 'Ascending'}`}
            >
              {sortOrder.toUpperCase()}
            </button>
          </div>

          {(statusFilter || priorityFilter || searchQuery) && (
            <button
              onClick={handleResetFilters}
              className="btn btn-ghost btn-sm"
              style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Issues Table */}
      {isLoading ? (
        <LoadingSpinner label="Loading tickets..." />
      ) : issues.length === 0 ? (
        <EmptyState
          title="No issues found"
          description={
            statusFilter || priorityFilter || searchQuery
              ? 'No issues match your current filter criteria. Try resetting filters.'
              : 'There are no service tickets or complaints reported in this organization yet.'
          }
          action={
            <Link to={`/org/${activeOrgId}/issues/new`} className="btn btn-primary">
              <Plus size={16} /> Create Issue
            </Link>
          }
        />
      ) : (
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: '110px' }}>Key</th>
                <th>Title</th>
                <th style={{ width: '130px' }}>Status</th>
                <th style={{ width: '110px' }}>Priority</th>
                <th style={{ width: '140px' }}>Category</th>
                <th style={{ width: '140px' }}>Created</th>
              </tr>
            </thead>
            <tbody>
              {issues.map((issue) => (
                <tr
                  key={issue.id}
                  className="table-row-hover"
                  onClick={() => navigate(`/org/${activeOrgId}/issues/${issue.id}`)}
                >
                  <td>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 600,
                        color: 'var(--primary)',
                        fontSize: '0.85rem',
                      }}
                    >
                      {issue.issue_key}
                    </span>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{issue.title}</div>
                    {issue.description && (
                      <div
                        style={{
                          fontSize: '0.8rem',
                          color: 'var(--text-muted)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          maxWidth: '480px',
                        }}
                      >
                        {issue.description}
                      </div>
                    )}
                  </td>
                  <td>
                    <StatusBadge status={issue.status} />
                  </td>
                  <td>
                    <PriorityBadge priority={issue.priority} />
                  </td>
                  <td>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      {issue.category || 'General'}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {new Date(issue.created_at).toLocaleDateString()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination Bar */}
      {total > pageSize && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: '1.25rem',
            padding: '0.5rem 0',
            color: 'var(--text-muted)',
            fontSize: '0.85rem',
          }}
        >
          <div>
            Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of {total} issues
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="btn btn-secondary btn-sm"
            >
              Previous
            </button>
            <span style={{ display: 'flex', alignItems: 'center', padding: '0 0.5rem' }}>
              Page {page} of {Math.ceil(total / pageSize)}
            </span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page * pageSize >= total}
              className="btn btn-secondary btn-sm"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
