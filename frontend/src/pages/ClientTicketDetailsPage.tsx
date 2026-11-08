import React, { useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle2,
  Circle,
  Clock,
  Layers,
  MessageSquare,
  Paperclip,
  RefreshCw,
  Send,
  Tag,
  User,
} from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'
import { ErrorAlert } from '../components/ErrorAlert'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { useOrg } from '../context/OrgContext'
import { api } from '../services/api'
import type { Issue, IssueActivity, IssueComment, IssueStatus } from '../types/issue'

// ---------------------------------------------------------------------------
// Design tokens
// ---------------------------------------------------------------------------
const T = {
  bgCard: '#FFFDF9',
  bgCream: '#F7EEE4',
  bgBeige: '#EEDFCC',
  caramel: '#C38B5E',
  brown: '#87502C',
  espresso: '#38251C',
  textSecondary: '#78675C',
  border: '#EAE1D7',
  borderFocus: '#C38B5E',
  green: '#2f7d4a',
  greenBg: '#e5f6ea',
  greenBorder: '#b3dfc1',
  greenStep: '#22c55e',
  greyStep: '#d1c4b8',
  shadow: '0 4px 24px rgba(56,39,31,0.07)',
  shadowSm: '0 2px 10px rgba(56,39,31,0.05)',
} as const

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function fmt(iso: string) {
  return new Date(iso).toLocaleString()
}
function capitalise(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ')
}
function activityLabel(a: IssueActivity): string {
  if (a.details) return a.details
  const action = a.action.replace(/_/g, ' ')
  if (a.new_value) {
    const val = /^[0-9a-f]{8}-[0-9a-f]{4}/i.test(a.new_value)
      ? 'a team member'
      : a.new_value
    return `${capitalise(action)}: ${val}`
  }
  return capitalise(action)
}

// ---------------------------------------------------------------------------
// Badges
// ---------------------------------------------------------------------------
const STATUS_STYLES: Record<string, { bg: string; color: string; border: string }> = {
  open:        { bg: '#e7f1fb', color: '#24598a', border: '#b3d4f5' },
  in_progress: { bg: '#fef3c7', color: '#92400e', border: '#fcd34d' },
  resolved:    { bg: '#e5f6ea', color: '#2f7d4a', border: '#b3dfc1' },
  closed:      { bg: '#f3ede8', color: '#78675C', border: '#d4c5b8' },
}
const PRIORITY_STYLES: Record<string, { bg: string; color: string; border: string }> = {
  urgent: { bg: '#fde8e8', color: '#b91c1c', border: '#fca5a5' },
  high:   { bg: '#fff0e6', color: '#9a3412', border: '#fdba74' },
  medium: { bg: '#e7f1fb', color: '#24598a', border: '#93c5fd' },
  low:    { bg: '#f3ede8', color: '#78675C', border: '#d4c5b8' },
}

const badgeBase: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center',
  padding: '0.15rem 0.6rem', fontSize: '0.7rem', fontWeight: 700,
  letterSpacing: '0.04em', textTransform: 'capitalize', borderRadius: 999,
  border: '1px solid transparent', whiteSpace: 'nowrap',
}
function WarmStatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.closed
  return <span style={{ ...badgeBase, background: s.bg, color: s.color, borderColor: s.border }}>{status.replace(/_/g, ' ')}</span>
}
function WarmPriorityBadge({ priority }: { priority: string }) {
  const p = PRIORITY_STYLES[priority] ?? PRIORITY_STYLES.low
  return <span style={{ ...badgeBase, background: p.bg, color: p.color, borderColor: p.border }}>{priority}</span>
}

// ---------------------------------------------------------------------------
// Progress timeline — compact inline version
// ---------------------------------------------------------------------------
const STEPS = [
  { key: 'raised',      label: 'Raised'      },
  { key: 'open',        label: 'Assigned'    },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'resolved',    label: 'Resolved'    },
  { key: 'closed',      label: 'Closed'      },
]
function completedCount(status: IssueStatus) {
  return { open: 2, in_progress: 3, resolved: 4, closed: 5 }[status] ?? 1
}

function ProgressTimeline({ status }: { status: IssueStatus }) {
  const done = completedCount(status)
  return (
    <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
      {STEPS.map((step, idx) => {
        const isDone = idx < done
        const isLast = idx === STEPS.length - 1
        return (
          <React.Fragment key={step.key}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem', flexShrink: 0, minWidth: 52 }}>
              <div style={{
                width: 24, height: 24, borderRadius: '50%',
                background: isDone ? T.greenBg : '#f3ede8',
                border: `2px solid ${isDone ? T.greenStep : T.greyStep}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {isDone
                  ? <CheckCircle2 size={13} color={T.greenStep} strokeWidth={2.5} />
                  : <Circle size={10} color={T.greyStep} strokeWidth={2} />}
              </div>
              <span style={{ fontSize: '0.62rem', fontWeight: 600, color: isDone ? T.green : T.textSecondary, whiteSpace: 'nowrap' }}>
                {step.label}
              </span>
            </div>
            {!isLast && (
              <div style={{ flex: 1, height: 2, minWidth: 12, marginBottom: 14, background: idx < done - 1 ? T.greenStep : T.greyStep }} />
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Comment bubble
// ---------------------------------------------------------------------------
function CommentBubble({ comment, currentUserId }: { comment: IssueComment; currentUserId?: string }) {
  const isOwn = comment.author.id === currentUserId
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: isOwn ? 'flex-end' : 'flex-start', gap: '0.2rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.72rem', color: T.textSecondary, flexDirection: isOwn ? 'row-reverse' : 'row' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: '50%', background: isOwn ? T.bgBeige : T.bgCream, color: T.brown }}>
          <User size={10} />
        </span>
        <strong style={{ color: T.espresso, fontWeight: 600 }}>{comment.author.full_name}</strong>
        {comment.author.role && (
          <span style={{
            fontSize: '0.67rem', fontWeight: 700, padding: '0.1rem 0.45rem',
            borderRadius: 99, background: T.cream, color: T.brown,
            border: `1px solid ${T.beige}`, textTransform: 'capitalize', whiteSpace: 'nowrap',
          }}>
            {comment.author.role === 'owner' ? 'Manager' : comment.author.role}
          </span>
        )}
        <span>·</span>
        <time style={{ fontSize: '0.68rem' }}>{fmt(comment.created_at)}</time>
      </div>
      <div style={{
        maxWidth: '85%', padding: '0.5rem 0.75rem',
        background: isOwn ? T.bgCream : T.bgCard,
        border: `1px solid ${T.border}`,
        borderRadius: isOwn ? '14px 3px 14px 14px' : '3px 14px 14px 14px',
        color: T.espresso, fontSize: '0.83rem', lineHeight: 1.5, whiteSpace: 'pre-wrap',
        boxShadow: T.shadowSm,
      }}>
        {comment.content}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Detail row
// ---------------------------------------------------------------------------
function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0', borderBottom: `1px solid ${T.border}` }}>
      <span style={{ color: T.caramel, flexShrink: 0, display: 'flex', alignItems: 'center' }}>{icon}</span>
      <span style={{ fontSize: '0.76rem', color: T.textSecondary, minWidth: 80, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: '0.78rem', color: T.espresso, fontWeight: 500, flex: 1, textAlign: 'right' }}>{value}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Card wrapper
// ---------------------------------------------------------------------------
function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 16, boxShadow: T.shadow, ...style }}>
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export const ClientTicketDetailsPage: React.FC = () => {
  const { issueId } = useParams<{ issueId: string }>()
  const { organizations } = useOrg()
  const [issue, setIssue] = useState<Issue | null>(null)
  const [comments, setComments] = useState<IssueComment[]>([])
  const [activities, setActivities] = useState<IssueActivity[]>([])
  const [commentText, setCommentText] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const conversationEndRef = useRef<HTMLDivElement>(null)

  const loadData = async () => {
    if (!issueId) return
    try {
      setIsLoading(true); setError(null)
      const [issueRes, commentsRes, activitiesRes] = await Promise.all([
        api.issues.getMine(issueId),
        api.issues.listMineComments(issueId),
        api.issues.listMineActivities(issueId),
      ])
      setIssue(issueRes)
      setComments(commentsRes.comments || [])
      setActivities(activitiesRes.activities || [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load ticket details.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { loadData() }, [issueId])
  useEffect(() => { conversationEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [comments.length])

  const handleCommentSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!issueId || !commentText.trim()) return
    try {
      setIsSubmitting(true); setError(null)
      const comment = await api.issues.addMineComment(issueId, commentText.trim())
      setComments((prev) => [...prev, comment])
      setCommentText('')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add comment.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) return <LoadingSpinner fullPage label="Loading your ticket…" />
  if (!issue) {
    return (
      <EmptyState
        title="Ticket Not Found"
        description="This ticket does not exist or is not owned by your account."
        action={<Link to="/client/dashboard" className="btn btn-primary">Back to My Dashboard</Link>}
      />
    )
  }

  const organizationName = organizations.find((o) => o.id === issue.organization_id)?.name || 'Organization'
  const isClosed = issue.status === 'closed' || issue.status === 'resolved'

  return (
    /*
     * ticket-page class → rx-client:has(.ticket-page) in index.css
     * sets warm background on the full app-shell (no dark sidebars).
     *
     * Layout: fills exactly the viewport height below the navbar.
     * Navbar = ~68px, main-content padding-top = 2rem (32px).
     * We cancel that padding with negative margin so we own the full height.
     */
    <div
      className="ticket-page"
      style={{
        margin: '-2rem -1.5rem 0',
        padding: '0.85rem 1.25rem 0.75rem',
        height: 'calc(100vh - 68px)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.6rem',
        overflow: 'hidden',     /* page itself never scrolls */
        boxSizing: 'border-box',
      }}
    >
      {/* ── Back nav + error ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexShrink: 0 }}>
        <Link
          to="/client/dashboard"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: T.textSecondary, fontSize: '0.82rem', fontWeight: 500, textDecoration: 'none' }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = T.espresso)}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = T.textSecondary)}
        >
          <ArrowLeft size={14} />
          Back to My Tickets
        </Link>
        {error && (
          <div style={{ flex: 1 }}>
            <ErrorAlert message={error} onDismiss={() => setError(null)} />
          </div>
        )}
      </div>

      {/* ── HERO CARD ── */}
      <Card style={{ flexShrink: 0, display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 240px', overflow: 'hidden', borderRadius: 18 }}>
        {/* Left: info */}
        <div style={{ padding: '1rem 1.2rem 0.9rem' }}>
          {/* Badges */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', color: T.brown, fontWeight: 700, fontSize: '0.78rem', background: T.bgCream, padding: '0.1rem 0.5rem', borderRadius: 7, border: `1px solid ${T.bgBeige}` }}>
              {issue.issue_key}
            </span>
            <WarmStatusBadge status={issue.status} />
            <WarmPriorityBadge priority={issue.priority} />
          </div>

          {/* Title */}
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: T.espresso, lineHeight: 1.2, letterSpacing: '-0.02em', marginBottom: '0.25rem' }}>
            {issue.title}
          </h1>

          {/* Org */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: T.brown, fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.5rem' }}>
            <Building2 size={12} />
            {organizationName}
          </div>

          {/* Description — clamped to 2 lines */}
          <p style={{ color: T.textSecondary, fontSize: '0.82rem', lineHeight: 1.5, marginBottom: '0.6rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {issue.description || 'No description provided.'}
          </p>

          {/* Timestamps + inline progress */}
          <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: '0.55rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color: T.textSecondary, fontSize: '0.72rem' }}>
              <Calendar size={11} /> Created {fmt(issue.created_at)}
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color: T.textSecondary, fontSize: '0.72rem', paddingLeft: '1rem', borderLeft: `1px solid ${T.border}` }}>
              <RefreshCw size={11} /> Updated {fmt(issue.updated_at)}
            </span>
          </div>
        </div>

        {/* Right: photo */}
        <div style={{ position: 'relative', overflow: 'hidden' }}>
          <img
            src="/portal/issue-hero.png"
            alt="Issue workspace"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }}
          />
          <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: `linear-gradient(90deg, ${T.bgCard} 0%, rgba(255,253,249,0.4) 20%, rgba(255,253,249,0) 45%)` }} />
        </div>
      </Card>

      {/* ── PROGRESS (inside its own small card) ── */}
      <Card style={{ flexShrink: 0, padding: '0.7rem 1.2rem 0.65rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <Layers size={14} color={T.brown} />
          <span style={{ fontWeight: 700, fontSize: '0.82rem', color: T.espresso }}>Ticket Progress</span>
        </div>
        <ProgressTimeline status={issue.status} />
      </Card>

      {/* ── BOTTOM TWO-COLUMN — fills remaining height ── */}
      <div
        style={{
          flex: 1,
          minHeight: 0,           /* allow flex child to shrink below content size */
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 62fr) minmax(220px, 38fr)',
          gap: '0.6rem',
        }}
        className="ticket-bottom-cols"
      >
        {/* LEFT: Conversation */}
        <Card style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0 }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', padding: '0.8rem 1.1rem 0.65rem', borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
            <MessageSquare size={15} color={T.brown} />
            <span style={{ fontWeight: 700, fontSize: '0.9rem', color: T.espresso }}>Conversation</span>
            <span style={{ minWidth: 20, height: 20, borderRadius: 99, background: T.bgCream, color: T.brown, fontSize: '0.68rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${T.border}`, padding: '0 4px' }}>
              {comments.length}
            </span>
          </div>

          {/* Scrollable comment area */}
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0.75rem 1.1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {comments.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '0.45rem', color: T.textSecondary }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: T.bgCream, border: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <MessageSquare size={20} color={T.caramel} />
                </div>
                <p style={{ fontWeight: 600, fontSize: '0.88rem', color: T.espresso }}>No comments yet.</p>
                <p style={{ fontSize: '0.78rem', color: T.textSecondary }}>Add information or reply to the organization team.</p>
              </div>
            ) : (
              comments.map((c) => <CommentBubble key={c.id} comment={c} currentUserId={issue.reporter_id} />)
            )}
            <div ref={conversationEndRef} />
          </div>

          {/* Composer — pinned to bottom */}
          <div style={{ flexShrink: 0, borderTop: `1px solid ${T.border}`, padding: '0.65rem 1.1rem' }}>
            {isClosed ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: T.textSecondary, fontSize: '0.78rem', padding: '0.4rem 0.7rem', background: T.bgCream, borderRadius: 10, border: `1px solid ${T.border}` }}>
                <MessageSquare size={13} />
                This ticket is {issue.status} — replies are no longer accepted.
              </div>
            ) : (
              <form onSubmit={handleCommentSubmit} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
                <div style={{ flex: 1, position: 'relative' }}>
                  <textarea
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Add information or reply to the organization team…"
                    rows={2}
                    disabled={isSubmitting}
                    style={{ width: '100%', padding: '0.55rem 2.2rem 0.55rem 0.75rem', background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 10, color: T.espresso, fontSize: '0.82rem', lineHeight: 1.45, outline: 'none', resize: 'none', fontFamily: 'inherit', transition: 'border-color 0.15s', boxSizing: 'border-box' }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = T.borderFocus)}
                    onBlur={(e) => (e.currentTarget.style.borderColor = T.border)}
                  />
                  <button type="button" disabled title="Attachments not supported" style={{ position: 'absolute', bottom: 7, left: 7, background: 'transparent', border: 'none', cursor: 'not-allowed', color: T.greyStep, opacity: 0.45, display: 'flex', alignItems: 'center', padding: 0 }}>
                    <Paperclip size={13} />
                  </button>
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting || !commentText.trim()}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.52rem 0.9rem', background: T.brown, color: '#fffdf9', border: 'none', borderRadius: 9, fontWeight: 650, fontSize: '0.82rem', cursor: isSubmitting || !commentText.trim() ? 'not-allowed' : 'pointer', opacity: isSubmitting || !commentText.trim() ? 0.5 : 1, fontFamily: 'inherit', flexShrink: 0 }}
                >
                  <Send size={13} />
                  {isSubmitting ? 'Sending…' : 'Send'}
                </button>
              </form>
            )}
          </div>
        </Card>

        {/* RIGHT column: Details + Activity stacked, both scrollable */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', minHeight: 0, overflow: 'hidden' }}>

          {/* Ticket Details */}
          <Card style={{ padding: '0.8rem 1rem', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.55rem' }}>
              <Tag size={13} color={T.brown} />
              <span style={{ fontWeight: 700, fontSize: '0.85rem', color: T.espresso }}>Ticket Details</span>
            </div>
            <DetailRow icon={<Building2 size={13} />} label="Organization" value={organizationName} />
            <DetailRow icon={<Layers size={13} />}   label="Status"       value={<WarmStatusBadge status={issue.status} />} />
            <DetailRow icon={<Tag size={13} />}       label="Priority"     value={<WarmPriorityBadge priority={issue.priority} />} />
            <DetailRow icon={<Calendar size={13} />}  label="Created"      value={fmt(issue.created_at)} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0' }}>
              <span style={{ color: T.caramel, flexShrink: 0, display: 'flex', alignItems: 'center' }}><RefreshCw size={13} /></span>
              <span style={{ fontSize: '0.76rem', color: T.textSecondary, minWidth: 80, flexShrink: 0 }}>Last Updated</span>
              <span style={{ fontSize: '0.78rem', color: T.espresso, fontWeight: 500, flex: 1, textAlign: 'right' }}>{fmt(issue.updated_at)}</span>
            </div>
          </Card>

          {/* Activity History — takes remaining right-column height */}
          <Card style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.75rem 1rem 0.55rem', borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
              <Clock size={13} color={T.brown} />
              <span style={{ fontWeight: 700, fontSize: '0.85rem', color: T.espresso }}>Permitted Activity History</span>
            </div>

            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0.65rem 1rem' }}>
              {activities.length === 0 ? (
                <p style={{ color: T.textSecondary, fontSize: '0.78rem' }}>No activity history available.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {activities.map((a, idx) => (
                    <div key={a.id} style={{ display: 'flex', gap: '0.55rem', paddingBottom: idx < activities.length - 1 ? '0.7rem' : 0 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, width: 14 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: T.caramel, border: `2px solid ${T.bgBeige}`, marginTop: 3, flexShrink: 0 }} />
                        {idx < activities.length - 1 && <div style={{ flex: 1, width: 1.5, background: T.border, marginTop: 2 }} />}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: '0.76rem', color: T.espresso, fontWeight: 500, lineHeight: 1.35, wordBreak: 'break-word' }}>
                          {activityLabel(a)}
                        </p>
                        <time style={{ fontSize: '0.68rem', color: T.textSecondary, display: 'block', marginTop: '0.1rem' }}>
                          {fmt(a.created_at)}
                        </time>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Responsive */}
      <style>{`
        @media (max-width: 780px) {
          .ticket-bottom-cols { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
