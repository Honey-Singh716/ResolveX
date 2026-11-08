import React, { useEffect, useState } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  ExternalLink,
  Inbox,
  MoreHorizontal,
  RefreshCw,
  Search,
  User,
} from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { ErrorAlert } from '../components/ErrorAlert'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { useOrg } from '../context/OrgContext'
import { api } from '../services/api'
import type { Issue, IssueFilterParams } from '../types/issue'

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
// Badge pill
// ---------------------------------------------------------------------------
const STATUS_S: Record<string, { bg: string; color: string; border: string }> = {
  open:        { bg: '#EAF4FF', color: '#1A6FAE', border: '#B3D9F5' },
  in_progress: { bg: '#FFF8E6', color: '#9A6300', border: '#F5D87A' },
  resolved:    { bg: '#E8F7EF', color: '#1A7A45', border: '#8FD4AF' },
  closed:      { bg: '#F0EDE9', color: '#6B5B4E', border: '#D4C5B8' },
}
const PRI_S: Record<string, { bg: string; color: string; border: string; icon: string }> = {
  urgent: { bg: '#FDECEA', color: '#B91C1C', border: '#F5A0A0', icon: '⚠' },
  high:   { bg: '#FFF3E8', color: '#9A3412', border: '#F5B88A', icon: '↑' },
  medium: { bg: '#FFF8E6', color: '#9A6300', border: '#F5D87A', icon: '⚡' },
  low:    { bg: '#EDFAF3', color: '#1A7A45', border: '#8FD4AF', icon: '↓' },
}

function StatusPill({ status }: { status: string }) {
  const s = STATUS_S[status] ?? STATUS_S.closed
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '0.22rem 0.75rem', fontSize: '0.75rem', fontWeight: 700, borderRadius: 99, background: s.bg, color: s.color, border: `1px solid ${s.border}`, whiteSpace: 'nowrap' }}>
      {status.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
    </span>
  )
}
function PriorityPill({ priority }: { priority: string }) {
  const p = PRI_S[priority] ?? PRI_S.low
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.22rem 0.65rem', fontSize: '0.75rem', fontWeight: 700, borderRadius: 99, background: p.bg, color: p.color, border: `1px solid ${p.border}`, whiteSpace: 'nowrap' }}>
      <span style={{ fontSize: '0.7rem' }}>{p.icon}</span>
      {priority.charAt(0).toUpperCase() + priority.slice(1)}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------
function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.85rem', boxShadow: T.shadowSm, flex: 1 }}>
      <div style={{ width: 40, height: 40, borderRadius: 11, background: T.cream, border: `1px solid ${T.beige}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.caramel, flexShrink: 0 }}>
        {icon}
      </div>
      <div>
        <p style={{ fontSize: '0.7rem', color: T.secondary, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
        <p style={{ fontSize: '1.55rem', fontWeight: 800, color, lineHeight: 1.1 }}>{value}</p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Avatar circle with initials
// ---------------------------------------------------------------------------
function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  const initials = name.split(' ').slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('')
  const hue = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: size, height: size, borderRadius: '50%',
      background: `hsl(${hue},45%,80%)`, color: `hsl(${hue},45%,30%)`,
      fontSize: size * 0.36, fontWeight: 700, flexShrink: 0, letterSpacing: '-0.01em',
    }}>{initials || <User size={size * 0.5} />}</span>
  )
}

// ---------------------------------------------------------------------------
// Skeleton row
// ---------------------------------------------------------------------------
function SkeletonRow() {
  return (
    <tr>
      {[40, 200, 120, 120, 100, 100, 120, 110, 80].map((w, i) => (
        <td key={i} style={{ padding: '0.85rem 0.75rem' }}>
          <div style={{ height: 14, width: w, background: T.beige, borderRadius: 6, opacity: 0.6, animation: 'pulse 1.5s ease-in-out infinite' }} />
        </td>
      ))}
    </tr>
  )
}

// ---------------------------------------------------------------------------
// Pagination component
// ---------------------------------------------------------------------------
function Pagination({ page, total, pageSize, onChange }: { page: number; total: number; pageSize: number; onChange: (p: number) => void }) {
  const totalPages = Math.ceil(total / pageSize)
  if (totalPages <= 1) return null

  const pages: (number | '...')[] = []
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i)
  } else {
    pages.push(1)
    if (page > 3) pages.push('...')
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i)
    if (page < totalPages - 2) pages.push('...')
    pages.push(totalPages)
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', borderTop: `1px solid ${T.border}` }}>
      <span style={{ fontSize: '0.8rem', color: T.secondary }}>
        Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total} issues
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
        <button onClick={() => onChange(Math.max(1, page - 1))} disabled={page === 1}
          style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.4 : 1, color: T.espresso }}>
          <ChevronLeft size={15} />
        </button>
        {pages.map((p, i) => (
          p === '...'
            ? <span key={i} style={{ padding: '0 4px', color: T.secondary, fontSize: '0.82rem' }}>…</span>
            : <button key={i} onClick={() => onChange(p as number)}
                style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', background: p === page ? T.brown : T.surface, color: p === page ? '#FFFDF9' : T.espresso, border: `1px solid ${p === page ? T.brown : T.border}`, borderRadius: 8, cursor: 'pointer', fontWeight: p === page ? 700 : 500, fontSize: '0.82rem', fontFamily: 'inherit' }}>
                {p}
              </button>
        ))}
        <button onClick={() => onChange(Math.min(totalPages, page + 1))} disabled={page === totalPages}
          style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, cursor: page === totalPages ? 'not-allowed' : 'pointer', opacity: page === totalPages ? 0.4 : 1, color: T.espresso }}>
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export const IssueDashboardPage: React.FC = () => {
  const { orgId } = useParams<{ orgId: string }>()
  const { currentOrg, selectOrg } = useOrg()
  const navigate = useNavigate()

  const activeOrgId = orgId || currentOrg?.id

  const [issues, setIssues]           = useState<Issue[]>([])
  const [total, setTotal]             = useState(0)
  const [page, setPage]               = useState(1)
  const [pageSize]                    = useState(5)
  const [statusFilter, setStatusFilter]   = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [searchQuery, setSearchQuery]     = useState('')
  const [searchInput, setSearchInput]     = useState('')
  const [sortBy, setSortBy]           = useState<'created_at' | 'updated_at' | 'priority' | 'status' | 'issue_key'>('created_at')
  const [sortOrder, setSortOrder]     = useState<'asc' | 'desc'>('desc')
  const [isLoading, setIsLoading]     = useState(true)
  const [error, setError]             = useState<string | null>(null)
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null)

  const [totalCount, setTotalCount]       = useState(0)
  const [openCount, setOpenCount]         = useState(0)
  const [inProgressCount, setInProgressCount] = useState(0)
  const [resolvedCount, setResolvedCount] = useState(0)
  const [urgentCount, setUrgentCount]     = useState(0)

  useEffect(() => {
    if (orgId && currentOrg?.id !== orgId) selectOrg(orgId)
  }, [orgId, currentOrg?.id])

  const loadIssues = async () => {
    if (!activeOrgId) { setIssues([]); setTotal(0); setIsLoading(false); return }
    try {
      setIsLoading(true); setError(null)
      const params: IssueFilterParams = { page, page_size: pageSize, sort_by: sortBy, sort_order: sortOrder }
      if (statusFilter)   params.status   = statusFilter
      if (priorityFilter) params.priority = priorityFilter
      if (categoryFilter) params.category = categoryFilter
      if (searchQuery.trim()) params.search = searchQuery.trim()

      const [res, allOpen, allProg, allRes, allUrg, allTotal] = await Promise.all([
        api.issues.list(activeOrgId, params),
        api.issues.list(activeOrgId, { status: 'open',       page_size: 1 }),
        api.issues.list(activeOrgId, { status: 'in_progress',page_size: 1 }),
        api.issues.list(activeOrgId, { status: 'resolved',   page_size: 1 }),
        api.issues.list(activeOrgId, { priority: 'urgent',   page_size: 1 }),
        api.issues.list(activeOrgId, { page_size: 1 }),
      ])
      setIssues(res.issues || [])
      setTotal(res.total)
      setTotalCount(allTotal.total)
      setOpenCount(allOpen.total)
      setInProgressCount(allProg.total)
      setResolvedCount(allRes.total)
      setUrgentCount(allUrg.total)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch issues.')
    } finally { setIsLoading(false) }
  }

  useEffect(() => { loadIssues() }, [activeOrgId, page, statusFilter, priorityFilter, categoryFilter, searchQuery, sortBy, sortOrder])

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); setPage(1); setSearchQuery(searchInput) }
  const handleReset  = () => { setStatusFilter(''); setPriorityFilter(''); setCategoryFilter(''); setSearchInput(''); setSearchQuery(''); setSortBy('created_at'); setSortOrder('desc'); setPage(1) }

  const selectStyle: React.CSSProperties = {
    padding: '0.45rem 0.75rem', background: T.surface, border: `1.5px solid ${T.border}`,
    borderRadius: 9, color: T.espresso, fontSize: '0.83rem', cursor: 'pointer',
    fontFamily: 'inherit', outline: 'none',
  }

  const sortLabel: Record<string, string> = {
    created_at: 'Date Created (Newest)', updated_at: 'Date Updated', priority: 'Priority', status: 'Status', issue_key: 'Issue Key',
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

      {/* ── Page hero ── */}
      <div style={{
        position: 'relative', overflow: 'hidden', borderRadius: 20,
        background: 'linear-gradient(115deg, #F5EAD8 0%, #F0E0C8 45%, #EDD4B4 75%, #E8CAA0 100%)',
        border: `1px solid ${T.border}`, boxShadow: T.shadow,
        display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(130px,220px)',
        minHeight: 140,
      }} className="iq-hero-grid">
        <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'center', zIndex: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.brown, background: 'rgba(255,253,249,0.9)', border: `1px solid ${T.beige}`, borderRadius: 99, padding: '0.15rem 0.6rem' }}>
              ORGANIZATION WORKSPACE
            </span>
            <span style={{ fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.05em', color: T.brown }}>›</span>
            <span style={{ fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.brown }}>Issue Management</span>
          </div>
          <h1 style={{ fontSize: 'clamp(1.4rem, 2.5vw, 1.8rem)', fontWeight: 800, color: T.espresso, lineHeight: 1.15, letterSpacing: '-0.02em', marginBottom: '0.3rem' }}>
            Issues Queue
          </h1>
          <p style={{ color: T.secondary, fontSize: '0.85rem' }}>Manage, assign, track, and resolve all issues for your organization.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: '0.5rem 0.5rem 0', zIndex: 2 }} className="iq-hero-illo">
          <img src="/portal/org-building-hero.png" alt="" aria-hidden="true" style={{ width: '100%', maxHeight: 140, objectFit: 'contain', objectPosition: 'bottom' }} />
        </div>
        <svg viewBox="0 0 400 140" xmlns="http://www.w3.org/2000/svg" style={{ position: 'absolute', right: 0, bottom: 0, width: '55%', height: '100%', opacity: 0.22, pointerEvents: 'none', zIndex: 1 }} aria-hidden="true">
          <path d="M400,0 Q250,70 400,140 Z" fill="#C07840" />
        </svg>
      </div>

      <ErrorAlert message={error} onDismiss={() => setError(null)} />

      {/* ── Stat cards ── */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <StatCard icon={<ClipboardList size={18} />} label="Total Issues" value={totalCount}       color={T.espresso}  />
        <StatCard icon={<Inbox size={18} />}         label="Open / Triage" value={openCount}       color="#1A6FAE"     />
        <StatCard icon={<Clock size={18} />}         label="In Progress"  value={inProgressCount}  color="#9A6300"     />
        <StatCard icon={<CheckCircle2 size={18} />}  label="Resolved"     value={resolvedCount}    color="#1A7A45"     />
        <StatCard icon={<AlertTriangle size={18} />} label="Urgent"       value={urgentCount}      color="#B91C1C"     />
      </div>

      {/* ── Filters + table card ── */}
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 18, boxShadow: T.shadow, overflow: 'hidden' }}>

        {/* Filter bar */}
        <div style={{ padding: '0.85rem 1rem', borderBottom: `1px solid ${T.border}`, display: 'flex', gap: '0.65rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Search */}
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.4rem', flex: '1 1 240px', maxWidth: 360 }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: T.caramel, pointerEvents: 'none' }} />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search by title, description, or issue key..."
                style={{ width: '100%', paddingLeft: 30, paddingRight: 10, paddingTop: '0.45rem', paddingBottom: '0.45rem', background: T.cream, border: `1.5px solid ${T.border}`, borderRadius: 9, color: T.espresso, fontSize: '0.83rem', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
              />
            </div>
            <button type="submit" style={{ padding: '0.45rem 1rem', background: T.brown, color: '#FFFDF9', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: '0.83rem', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
              Search
            </button>
          </form>

          {/* Status */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
            <label style={{ fontSize: '0.65rem', fontWeight: 700, color: T.secondary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Status</label>
            <select style={selectStyle} value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}>
              <option value="">All Statuses</option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
          </div>

          {/* Priority */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
            <label style={{ fontSize: '0.65rem', fontWeight: 700, color: T.secondary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Priority</label>
            <select style={selectStyle} value={priorityFilter} onChange={(e) => { setPriorityFilter(e.target.value); setPage(1) }}>
              <option value="">All Priorities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          {/* Category */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
            <label style={{ fontSize: '0.65rem', fontWeight: 700, color: T.secondary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Category</label>
            <select style={selectStyle} value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setPage(1) }}>
              <option value="">All Categories</option>
              <option value="IT & Network">IT &amp; Network</option>
              <option value="Facilities">Facilities</option>
              <option value="Infrastructure">Infrastructure</option>
              <option value="Books">Books</option>
              <option value="General">General</option>
            </select>
          </div>

          {/* Sort */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
            <label style={{ fontSize: '0.65rem', fontWeight: 700, color: T.secondary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Sort By</label>
            <select style={selectStyle} value={`${sortBy}:${sortOrder}`} onChange={(e) => { const [sb, so] = e.target.value.split(':'); setSortBy(sb as typeof sortBy); setSortOrder(so as 'asc' | 'desc'); setPage(1) }}>
              <option value="created_at:desc">Date Created (Newest)</option>
              <option value="created_at:asc">Date Created (Oldest)</option>
              <option value="updated_at:desc">Date Updated</option>
              <option value="priority:desc">Priority (High first)</option>
              <option value="status:asc">Status</option>
              <option value="issue_key:asc">Issue Key</option>
            </select>
          </div>

          {/* Reset */}
          {(statusFilter || priorityFilter || categoryFilter || searchQuery) && (
            <button onClick={handleReset} style={{ padding: '0.45rem 0.75rem', background: 'transparent', border: `1.5px solid ${T.border}`, borderRadius: 9, color: T.secondary, fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'inherit', marginTop: 'auto' }}>
              Clear
            </button>
          )}

          {/* Refresh */}
          <button onClick={loadIssues} title="Refresh" style={{ padding: '0.45rem', background: T.cream, border: `1.5px solid ${T.border}`, borderRadius: 9, color: T.brown, cursor: 'pointer', display: 'flex', alignItems: 'center', marginTop: 'auto' }}>
            <RefreshCw size={14} />
          </button>
        </div>

        {/* Table */}
        {isLoading ? (
          <div style={{ overflowX: 'auto' }}>
            <style>{`@keyframes pulse { 0%,100%{opacity:.6} 50%{opacity:1} }`}</style>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                  {['','Key','Title','Reporter','Assignee','Status','Priority','Category','Created On','Actions'].map((h, i) => (
                    <th key={i} style={{ padding: '0.65rem 0.75rem', textAlign: 'left', fontSize: '0.68rem', fontWeight: 700, color: T.caramel, textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>{[...Array(5)].map((_, i) => <SkeletonRow key={i} />)}</tbody>
            </table>
          </div>
        ) : issues.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.65rem' }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: T.cream, border: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ClipboardList size={22} color={T.caramel} />
            </div>
            <p style={{ fontWeight: 600, color: T.espresso }}>
              {statusFilter || priorityFilter || categoryFilter || searchQuery ? 'No issues match your filters.' : 'No issues reported yet.'}
            </p>
            <p style={{ fontSize: '0.82rem', color: T.secondary }}>
              {statusFilter || priorityFilter || categoryFilter || searchQuery ? 'Try clearing filters to see all issues.' : 'When clients report issues, they will appear here.'}
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${T.border}`, background: T.cream }}>
                  {['','Key','Title','Reporter','Assignee','Status','Priority','Category','Created On','Actions'].map((h, i) => (
                    <th key={i} style={{ padding: '0.65rem 0.75rem', textAlign: 'left', fontSize: '0.68rem', fontWeight: 700, color: T.caramel, textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {issues.map((issue, idx) => (
                  <tr
                    key={issue.id}
                    style={{ borderBottom: idx < issues.length - 1 ? `1px solid ${T.border}` : 'none', transition: 'background 0.12s', cursor: 'pointer' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = T.cream)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    onClick={() => navigate(`/org/${activeOrgId}/issues/${issue.id}`)}
                  >
                    {/* Checkbox */}
                    <td style={{ padding: '0.75rem 0.5rem 0.75rem 0.85rem', width: 32 }} onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" style={{ accentColor: T.brown, cursor: 'pointer' }} />
                    </td>
                    {/* Key */}
                    <td style={{ padding: '0.75rem 0.75rem', width: 100 }}>
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8rem', fontWeight: 700, color: T.brown }}>{issue.issue_key}</span>
                    </td>
                    {/* Title */}
                    <td style={{ padding: '0.75rem 0.75rem', maxWidth: 260 }}>
                      <p style={{ fontWeight: 600, fontSize: '0.87rem', color: T.espresso, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{issue.title}</p>
                      {issue.description && (
                        <p style={{ fontSize: '0.75rem', color: T.secondary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 240 }}>{issue.description}</p>
                      )}
                    </td>
                    {/* Reporter */}
                    <td style={{ padding: '0.75rem 0.75rem' }}>
                      {issue.reporter ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <Avatar name={issue.reporter.full_name} size={26} />
                          <span style={{ fontSize: '0.82rem', color: T.espresso, whiteSpace: 'nowrap' }}>{issue.reporter.full_name}</span>
                        </div>
                      ) : <span style={{ color: T.secondary, fontSize: '0.8rem' }}>—</span>}
                    </td>
                    {/* Assignee */}
                    <td style={{ padding: '0.75rem 0.75rem' }}>
                      {issue.assignee ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <Avatar name={issue.assignee.full_name} size={26} />
                          <span style={{ fontSize: '0.82rem', color: T.espresso, whiteSpace: 'nowrap' }}>{issue.assignee.full_name}</span>
                        </div>
                      ) : <span style={{ color: T.secondary, fontSize: '0.8rem' }}>—</span>}
                    </td>
                    {/* Status */}
                    <td style={{ padding: '0.75rem 0.75rem' }}><StatusPill status={issue.status} /></td>
                    {/* Priority */}
                    <td style={{ padding: '0.75rem 0.75rem' }}><PriorityPill priority={issue.priority} /></td>
                    {/* Category */}
                    <td style={{ padding: '0.75rem 0.75rem' }}>
                      <span style={{ fontSize: '0.8rem', color: T.espresso, background: T.cream, border: `1px solid ${T.beige}`, borderRadius: 6, padding: '0.15rem 0.5rem', whiteSpace: 'nowrap' }}>
                        {issue.category || 'General'}
                      </span>
                    </td>
                    {/* Created */}
                    <td style={{ padding: '0.75rem 0.75rem', whiteSpace: 'nowrap' }}>
                      <p style={{ fontSize: '0.8rem', color: T.espresso }}>{new Date(issue.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                      <p style={{ fontSize: '0.72rem', color: T.secondary }}>{new Date(issue.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</p>
                    </td>
                    {/* Actions */}
                    <td style={{ padding: '0.75rem 0.75rem' }} onClick={(e) => e.stopPropagation()}>
                      <div style={{ position: 'relative' }}>
                        <button
                          onClick={() => setActionMenuOpen(actionMenuOpen === issue.id ? null : issue.id)}
                          style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: `1.5px solid ${T.border}`, borderRadius: 8, cursor: 'pointer', color: T.secondary }}
                        >
                          <MoreHorizontal size={14} />
                        </button>
                        {actionMenuOpen === issue.id && (
                          <div style={{
                            position: 'absolute', right: 0, top: '110%', zIndex: 50,
                            background: T.surface, border: `1px solid ${T.border}`,
                            borderRadius: 12, boxShadow: T.shadow, width: 160,
                            padding: '0.3rem 0', overflow: 'hidden',
                          }}>
                            {[
                              { label: 'View Details', icon: <ExternalLink size={13} />, action: () => navigate(`/org/${activeOrgId}/issues/${issue.id}`) },
                              { label: 'Assign / Reassign', icon: <User size={13} />, action: () => navigate(`/org/${activeOrgId}/issues/${issue.id}`) },
                            ].map((item, i) => (
                              <button key={i} onClick={() => { setActionMenuOpen(null); item.action() }}
                                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', padding: '0.55rem 0.85rem', background: 'transparent', border: 'none', color: T.espresso, fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = T.cream)}
                                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                              >
                                {item.icon} {item.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <Pagination page={page} total={total} pageSize={pageSize} onChange={(p) => setPage(p)} />
      </div>

      {/* Responsive */}
      <style>{`
        @media (max-width: 640px) {
          .iq-hero-grid { grid-template-columns: 1fr !important; }
          .iq-hero-illo { display: none; }
        }
        @keyframes pulse { 0%,100%{opacity:.55} 50%{opacity:.9} }
      `}</style>
    </div>
  )
}
