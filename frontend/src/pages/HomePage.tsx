import React, { useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  Bell,
  Building2,
  CheckCircle2,
  Clock3,
  FolderOpen,
  KeyRound,
  LifeBuoy,
  ShieldCheck,
  Sparkles,
  Ticket,
  Users,
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'
import { ErrorAlert } from '../components/ErrorAlert'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { RoleBadge, VerificationBadge } from '../components/StatusBadge'
import { useAuth } from '../context/AuthContext'
import { useOrg } from '../context/OrgContext'
import { api } from '../services/api'
import type { Issue } from '../types/issue'
import type { AppNotification } from '../types/notification'
import type { MembershipRequest } from '../types/organization'

export const HomePage: React.FC = () => {
  const { user } = useAuth()
  const { organizations } = useOrg()
  const navigate = useNavigate()
  const [issues, setIssues] = useState<Issue[]>([])
  const [requests, setRequests] = useState<MembershipRequest[]>([])
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const approvedOrganizations = useMemo(
    () => organizations.filter((organization) => organization.verification_status === 'approved'),
    [organizations]
  )
  const pendingRequests = requests.filter((request) => request.status === 'pending')
  const hasStaffWorkspace = approvedOrganizations.some((organization) =>
    ['owner', 'admin', 'manager', 'staff'].includes(organization.role)
  )

  const loadHome = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const [issueResult, requestResult, notificationResult] = await Promise.all([
        api.issues.listMine({ page: 1, page_size: 5 }),
        api.organizations.getMyMembershipRequests(),
        api.notifications.list(1, 5),
      ])
      setIssues(issueResult.issues || [])
      setRequests(requestResult.requests || [])
      setNotifications(notificationResult.notifications || [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to load your ResolveX home.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadHome()
  }, [])

  if (isLoading) {
    return <LoadingSpinner fullPage label="Preparing your ResolveX home..." />
  }

  const openIssues = issues.filter((issue) => issue.status === 'open').length
  const activeIssues = issues.filter((issue) => issue.status === 'in_progress').length
  const resolvedIssues = issues.filter((issue) => ['resolved', 'closed'].includes(issue.status)).length

  return (
    <div className="home-page">
      <ErrorAlert message={error} onDismiss={() => setError(null)} />

      <section className="home-hero home-enter">
        <div className="home-hero-orb home-hero-orb-one" />
        <div className="home-hero-orb home-hero-orb-two" />
        <div className="home-hero-content">
          <div className="home-eyebrow"><Sparkles size={15} /> Your ResolveX command center</div>
          <h1>Welcome, {user?.full_name?.split(' ')[0] || 'there'}.</h1>
          <p>One place to report issues, track progress and manage service requests.</p>
          <div className="home-hero-actions">
            <button className="btn btn-primary" onClick={() => navigate('/organizations', { state: { open: 'join' } })}>
              <KeyRound size={16} /> Join an Organization <ArrowRight size={15} />
            </button>
            <button className="btn btn-secondary" onClick={() => navigate('/organizations', { state: { open: 'create' } })}>
              <Building2 size={16} /> Create an Organization
            </button>
          </div>
          <div className="home-hero-points">
            <span><Ticket size={15} /> Track every request</span>
            <span><Bell size={15} /> Stay updated</span>
            <span><LifeBuoy size={15} /> Get better support</span>
          </div>
        </div>
        <div className="home-hero-illustration" aria-hidden="true">
          <div className="home-illustration-window">
            <div className="home-window-dot" />
            <div className="home-window-dot" />
            <div className="home-window-dot" />
            <div className="home-window-line wide" />
            <div className="home-window-line" />
            <div className="home-window-card"><CheckCircle2 size={24} /></div>
          </div>
        </div>
      </section>

      <section className="home-progress home-enter" aria-label="Getting started progress">
        <div>
          <span className="home-section-kicker">Getting started</span>
          <h2>Make ResolveX work for you</h2>
          <p>Join an organization to start raising requests, or create one for your team.</p>
        </div>
        <div className="home-progress-track">
          <div className="home-progress-fill" style={{ width: `${approvedOrganizations.length || pendingRequests.length ? '66%' : '33%'}` }} />
        </div>
        <div className="home-progress-steps">
          <span className="complete"><CheckCircle2 size={15} /> Account ready</span>
          <span className={approvedOrganizations.length ? 'complete' : ''}><Building2 size={15} /> Organization access</span>
          <span className={issues.length ? 'complete' : ''}><Ticket size={15} /> First request</span>
        </div>
      </section>

      <section className="home-action-grid home-enter">
        <button className="home-action-card home-action-blue" onClick={() => navigate('/organizations', { state: { open: 'join' } })}>
          <span className="home-action-icon"><Users size={25} /></span>
          <span>
            <strong>Join an Organization</strong>
            <small>Use a shared code to request access. An organization admin approves your membership and role.</small>
          </span>
          <ArrowRight size={18} />
        </button>
        <button className="home-action-card home-action-purple" onClick={() => navigate('/organizations', { state: { open: 'create' } })}>
          <span className="home-action-icon"><Building2 size={25} /></span>
          <span>
            <strong>Create an Organization</strong>
            <small>Submit verification details for platform review. Workspace owner access starts only after approval.</small>
          </span>
          <ArrowRight size={18} />
        </button>
      </section>

      <section className="home-column-grid">
        <div className="home-panel">
          <div className="home-panel-header">
            <div><span className="home-section-kicker">Workspace access</span><h2>My Organizations</h2></div>
            <Link to="/organizations" className="home-link">View all <ArrowRight size={14} /></Link>
          </div>
          {organizations.length === 0 && requests.length === 0 ? (
            <EmptyState icon={<Building2 size={26} />} title="No organizations yet" description="Join a workspace or submit an organization request to get started." />
          ) : (
            <div className="home-org-list">
              {organizations.slice(0, 4).map((organization) => {
                const staffAccess = organization.verification_status === 'approved' && ['owner', 'admin', 'manager', 'staff'].includes(organization.role)
                return (
                  <div className="home-org-row" key={organization.id}>
                    <div className="home-org-avatar"><Building2 size={17} /></div>
                    <div className="home-org-details">
                      <strong>{organization.name}</strong>
                      <span>{organization.verification_status === 'approved' ? 'Membership approved' : organization.rejection_reason || 'Awaiting platform approval'}</span>
                    </div>
                    {organization.verification_status === 'approved' ? <RoleBadge role={organization.role} /> : <VerificationBadge status={organization.verification_status} />}
                    {staffAccess && <Link to={`/org/${organization.id}/issues`} className="home-row-arrow" aria-label={`Open ${organization.name} workspace`}><ArrowRight size={16} /></Link>}
                  </div>
                )
              })}
              {pendingRequests.slice(0, 2).map((request) => (
                <div className="home-org-row" key={request.id}>
                  <div className="home-org-avatar pending"><Clock3 size={17} /></div>
                  <div className="home-org-details"><strong>{request.organization_name || 'Organization request'}</strong><span>Membership request pending approval</span></div>
                  <span className="home-status-pending">Pending</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {issues.length > 0 && (
          <div className="home-panel">
            <div className="home-panel-header">
              <div><span className="home-section-kicker">Personal activity</span><h2>My Issue Summary</h2></div>
              <Link to="/client/dashboard" className="home-link">View all <ArrowRight size={14} /></Link>
            </div>
            <div className="home-stat-grid">
              <div className="home-stat blue"><FolderOpen size={19} /><span>Open</span><strong>{openIssues}</strong></div>
              <div className="home-stat amber"><Clock3 size={19} /><span>In progress</span><strong>{activeIssues}</strong></div>
              <div className="home-stat green"><CheckCircle2 size={19} /><span>Resolved</span><strong>{resolvedIssues}</strong></div>
              <div className="home-stat red"><ShieldCheck size={19} /><span>Urgent</span><strong>{issues.filter((issue) => issue.priority === 'urgent').length}</strong></div>
            </div>
          </div>
        )}
      </section>

      <section className="home-column-grid home-lower-grid">
        <div className="home-panel">
          <div className="home-panel-header">
            <div><span className="home-section-kicker">Latest updates</span><h2>Recent Activity</h2></div>
            <Link to="/notifications" className="home-link">View all <ArrowRight size={14} /></Link>
          </div>
          {notifications.length === 0 ? (
            <p className="home-muted">Notifications about your requests and tickets will appear here.</p>
          ) : (
            <div className="home-activity-list">
              {notifications.map((notification) => (
                <Link to={notification.target_path || '/notifications'} className="home-activity-row" key={notification.id}>
                  <span className="home-activity-icon"><Bell size={15} /></span>
                  <span><strong>{notification.title}</strong><small>{notification.message}</small></span>
                  <time>{new Date(notification.created_at).toLocaleDateString()}</time>
                </Link>
              ))}
            </div>
          )}
        </div>
        <div className="home-panel home-help-panel">
          <span className="home-section-kicker">Need a hand?</span>
          <h2>Start with one simple step</h2>
          <p>{hasStaffWorkspace ? 'You have an approved organization workspace. Use it for team operations while keeping your personal tickets in the Client Portal.' : 'Join an organization with a code, then raise your first issue once your membership is approved.'}</p>
          <Link to={hasStaffWorkspace ? '/client/dashboard' : '/organizations'} className="btn btn-secondary btn-sm">
            {hasStaffWorkspace ? 'Open Client Portal' : 'Explore Organizations'} <ArrowRight size={14} />
          </Link>
        </div>
      </section>
    </div>
  )
}
