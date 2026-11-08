import React, { useEffect, useRef, useState } from 'react'
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  Calendar,
  Check,
  CheckCircle,
  CheckCircle2,
  Circle,
  Clock,
  History,
  Layers,
  MessageSquare,
  Paperclip,
  Play,
  RefreshCw,
  RotateCcw,
  Send,
  Tag,
  User,
  UserCheck,
  XCircle,
} from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'
import { ErrorAlert } from '../components/ErrorAlert'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { useAuth } from '../context/AuthContext'
import { useOrg } from '../context/OrgContext'
import { api } from '../services/api'
import type { Issue, IssueActivity, IssueComment, IssueStatus } from '../types/issue'
import type { Member } from '../types/organization'

// ---------------------------------------------------------------------------
// Warm-palette design tokens (same as ClientTicketDetailsPage)
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

function activityLabel(a: IssueActivity, members: Member[]): string {
  if (a.details) return a.details
  const actor = members.find((m) => m.user_id === a.actor_id)
  const name = actor ? actor.full_name : 'Team member'
  const action = a.action.replace(/_/g, ' ')
  if (a.old_value && a.new_value) {
    return `${name} changed ${action}: ${a.old_value} → ${a.new_value}`
  }
  if (a.new_value) {
    const val = /^[0-9a-f]{8}-[0-9a-f]{4}/i.test(a.new_value)
      ? 'a team member'
      : a.new_value
    return `${name} — ${capitalise(action)}: ${val}`
  }
  return `${name} — ${capitalise(action)}`
}

// ---------------------------------------------------------------------------
// Warm badge components
// ---------------------------------------------------------------------------

const STATUS_STYLES: Record<string, { bg: string; color: string; border: string }> = {
  open: { bg: '#e7f1fb', color: '#24598a', border: '#b3d4f5' },
  in_progress: { bg: '#fef3c7', color: '#92400e', border: '#fcd34d' },
  resolved: { bg: '#e5f6ea', color: '#2f7d4a', border: '#b3dfc1' },
  closed: { bg: '#f3ede8', color: '#78675C', border: '#d4c5b8' },
}

const PRIORITY_STYLES: Record<string, { bg: string; color: string; border: string }> = {
  urgent: { bg: '#fde8e8', color: '#b91c1c', border: '#fca5a5' },
  high: { bg: '#fff0e6', color: '#9a3412', border: '#fdba74' },
  medium: { bg: '#e7f1fb', color: '#24598a', border: '#93c5fd' },
  low: { bg: '#f3ede8', color: '#78675C', border: '#d4c5b8' },
}

function WarmStatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.closed
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '0.2rem 0.7rem',
        fontSize: '0.72rem',
        fontWeight: 700,
        letterSpacing: '0.04em',
        textTransform: 'capitalize',
        borderRadius: 999,
        background: s.bg,
        color: s.color,
        border: `1px solid ${s.border}`,
        whiteSpace: 'nowrap',
      }}
    >
      {status.replace(/_/g, ' ')}
    </span>
  )
}

function WarmPriorityBadge({ priority }: { priority: string }) {
  const p = PRIORITY_STYLES[priority] ?? PRIORITY_STYLES.low
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '0.2rem 0.7rem',
        fontSize: '0.72rem',
        fontWeight: 700,
        letterSpacing: '0.04em',
        textTransform: 'capitalize',
        borderRadius: 999,
        background: p.bg,
        color: p.color,
        border: `1px solid ${p.border}`,
        whiteSpace: 'nowrap',
      }}
    >
      {priority}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Progress timeline — identical logic to client page
// ---------------------------------------------------------------------------

type ProgressStep = { key: string; label: string }

const PROGRESS_STEPS: ProgressStep[] = [
  { key: 'raised', label: 'Raised' },
  { key: 'open', label: 'Assigned' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'resolved', label: 'Resolved' },
  { key: 'closed', label: 'Closed' },
]

function getCompletedSteps(status: IssueStatus): number {
  switch (status) {
    case 'open': return 2
    case 'in_progress': return 3
    case 'resolved': return 4
    case 'closed': return 5
    default: return 1
  }
}

function ProgressTimeline({ status }: { status: IssueStatus }) {
  const completedCount = getCompletedSteps(status)
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 0,
        width: '100%',
        overflowX: 'auto',
        padding: '0.25rem 0',
      }}
    >
      {PROGRESS_STEPS.map((step, idx) => {
        const done = idx < completedCount
        const isLast = idx === PROGRESS_STEPS.length - 1
        return (
          <React.Fragment key={step.key}>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.4rem',
                flexShrink: 0,
                minWidth: 64,
              }}
            >
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: '50%',
                  background: done ? T.greenBg : '#f3ede8',
                  border: `2px solid ${done ? T.greenStep : T.greyStep}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {done ? (
                  <CheckCircle2 size={17} color={T.greenStep} strokeWidth={2.5} />
                ) : (
                  <Circle size={14} color={T.greyStep} strokeWidth={2} />
                )}
              </div>
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  color: done ? T.green : T.textSecondary,
                  whiteSpace: 'nowrap',
                  textAlign: 'center',
                }}
              >
                {step.label}
              </span>
            </div>
            {!isLast && (
              <div
                style={{
                  flex: 1,
                  height: 2,
                  minWidth: 24,
                  maxWidth: 80,
                  marginBottom: 20,
                  background: idx < completedCount - 1 ? T.greenStep : T.greyStep,
                }}
              />
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Section card wrapper
// ---------------------------------------------------------------------------

function SectionCard({
  children,
  style,
}: {
  children: React.ReactNode
  style?: React.CSSProperties
}) {
  return (
    <div
      style={{
        background: T.bgCard,
        border: `1px solid ${T.border}`,
        borderRadius: 18,
        padding: '1.4rem',
        boxShadow: T.shadow,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Detail row (right panel)
// ---------------------------------------------------------------------------

function DetailRow({
  icon,
  label,
  value,
  noBorder,
}: {
  icon: React.ReactNode
  label: string
  value: React.ReactNode
  noBorder?: boolean
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.6rem',
        padding: '0.55rem 0',
        borderBottom: noBorder ? 'none' : `1px solid ${T.border}`,
      }}
    >
      <span style={{ color: T.caramel, marginTop: 2, flexShrink: 0, display: 'flex', alignItems: 'center' }}>
        {icon}
      </span>
      <span style={{ fontSize: '0.8rem', color: T.textSecondary, minWidth: 90, flexShrink: 0 }}>
        {label}
      </span>
      <span style={{ fontSize: '0.82rem', color: T.espresso, fontWeight: 500, flex: 1, textAlign: 'right' }}>
        {value}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Comment bubble
// ---------------------------------------------------------------------------

function CommentBubble({
  comment,
  currentUserId,
}: {
  comment: IssueComment
  currentUserId?: string
}) {
  const isOwn = comment.author.id === currentUserId
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isOwn ? 'flex-end' : 'flex-start',
        gap: '0.25rem',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          fontSize: '0.75rem',
          color: T.textSecondary,
          flexDirection: isOwn ? 'row-reverse' : 'row',
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 24,
            height: 24,
            borderRadius: '50%',
            background: isOwn ? T.bgBeige : T.bgCream,
            color: T.brown,
            fontSize: '0.7rem',
            fontWeight: 700,
          }}
        >
          {comment.author.full_name[0]?.toUpperCase() ?? 'U'}
        </span>
        <strong style={{ color: T.espresso, fontWeight: 600, fontSize: '0.8rem' }}>
          {comment.author.full_name}
        </strong>
        {comment.author.role && (
          <span
            style={{
              fontSize: '0.7rem',
              background: T.bgCream,
              color: T.brown,
              border: `1px solid ${T.border}`,
              borderRadius: 99,
              padding: '0.05rem 0.45rem',
            }}
          >
            {comment.author.role}
          </span>
        )}
        <span>·</span>
        <time>{fmt(comment.created_at)}</time>
      </div>
      <div
        style={{
          maxWidth: '82%',
          padding: '0.65rem 0.9rem',
          background: isOwn ? T.bgCream : T.bgCard,
          border: `1px solid ${T.border}`,
          borderRadius: isOwn ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
          color: T.espresso,
          fontSize: '0.88rem',
          lineHeight: 1.6,
          whiteSpace: 'pre-wrap',
          boxShadow: T.shadowSm,
        }}
      >
        {comment.content}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Warm action button styles
// ---------------------------------------------------------------------------

const btnBase: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.4rem',
  padding: '0.42rem 0.9rem',
  borderRadius: 10,
  fontWeight: 650,
  fontSize: '0.83rem',
  cursor: 'pointer',
  border: 'none',
  fontFamily: 'inherit',
  transition: 'opacity 0.15s, background 0.15s',
  whiteSpace: 'nowrap',
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export const IssueDetailPage: React.FC = () => {
  const { orgId, issueId } = useParams<{ orgId: string; issueId: string }>()
  const { user } = useAuth()
  const { canManageIssues } = useOrg()

  const [issue, setIssue] = useState<Issue | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [comments, setComments] = useState<IssueComment[]>([])
  const [activities, setActivities] = useState<IssueActivity[]>([])
  const [activeTab, setActiveTab] = useState<'comments' | 'activities'>('comments')
  const [isLoading, setIsLoading] = useState(true)
  const [isUpdating, setIsUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [commentText, setCommentText] = useState('')
  const [isSubmittingComment, setIsSubmittingComment] = useState(false)
  const [isResolveModalOpen, setIsResolveModalOpen] = useState(false)
  const [resolutionNote, setResolutionNote] = useState('')
  const conversationEndRef = useRef<HTMLDivElement>(null)

  const loadData = async () => {
    if (!orgId || !issueId) return
    try {
      setIsLoading(true)
      setError(null)
      const [issueRes, membersRes, commentsRes, activitiesRes] = await Promise.all([
        api.issues.get(orgId, issueId),
        api.organizations.listMembers(orgId, 1, 100),
        api.issues.listComments(orgId, issueId, 1, 100),
        api.issues.listActivities(orgId, issueId, 1, 100),
      ])
      setIssue(issueRes)
      setMembers(membersRes.members || [])
      setComments(commentsRes.comments || [])
      setActivities(activitiesRes.activities || [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load issue details.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { loadData() }, [orgId, issueId])

  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [comments.length])

  // Status transitions
  const handleTransition = async (newStatus: IssueStatus, note?: string) => {
    if (!orgId || !issueId || !issue) return
    try {
      setIsUpdating(true)
      setError(null)
      const updated = await api.issues.update(orgId, issueId, {
        status: newStatus,
        resolution_note: note,
        version: issue.version,
      })
      setIssue(updated)
      setIsResolveModalOpen(false)
      setResolutionNote('')
      const acts = await api.issues.listActivities(orgId, issueId, 1, 100)
      setActivities(acts.activities || [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Status update failed.')
      if (err instanceof Error && err.message.includes('modified by another user')) loadData()
    } finally {
      setIsUpdating(false)
    }
  }

  // Assignee change
  const handleAssigneeChange = async (newAssigneeId: string | null) => {
    if (!orgId || !issueId || !issue) return
    try {
      setIsUpdating(true)
      setError(null)
      const updated = await api.issues.assign(orgId, issueId, {
        assignee_id: newAssigneeId,
        version: issue.version,
      })
      setIssue(updated)
      const acts = await api.issues.listActivities(orgId, issueId, 1, 100)
      setActivities(acts.activities || [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Assignment update failed.')
    } finally {
      setIsUpdating(false)
    }
  }

  // Submit comment
  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!orgId || !issueId || !commentText.trim()) return
    try {
      setIsSubmittingComment(true)
      setError(null)
      const newComment = await api.issues.addComment(orgId, issueId, commentText.trim())
      setComments((prev) => [...prev, newComment])
      setCommentText('')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to post comment.')
    } finally {
      setIsSubmittingComment(false)
    }
  }

  // ---- Loading / not found guards ----
  if (isLoading) return <LoadingSpinner fullPage label="Loading issue details…" />

  if (!issue) {
    return (
      <EmptyState
        title="Issue Not Found"
        description="This ticket does not exist or you do not have permission to access it."
        action={
          <Link to={`/org/${orgId}/issues`} className="btn btn-primary">
            Back to Issues
          </Link>
        }
      />
    )
  }

  const assigneeMember = members.find((m) => m.user_id === issue.assignee_id)
  const isReporter = user?.id === issue.reporter_id
  const isAssignee = user?.id === issue.assignee_id
  const canReopen = issue.status === 'resolved' && (isReporter || isAssignee || canManageIssues)
  const isClosed = issue.status === 'closed'

  // ---- Render ----
  return (
    <div className="issue-page" style={{ margin: '-2rem -1.5rem', padding: '2rem 1.5rem 3rem', minHeight: '100vh' }}>
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          maxWidth: 1100,
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.1rem',
        }}
      >
        {/* ── Back navigation ── */}
        <Link
          to={`/org/${orgId}/issues`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            color: T.textSecondary,
            fontSize: '0.85rem',
            fontWeight: 500,
            textDecoration: 'none',
            alignSelf: 'flex-start',
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = T.espresso)}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = T.textSecondary)}
        >
          <ArrowLeft size={15} />
          Back to Issues
        </Link>

        <ErrorAlert message={error} onDismiss={() => setError(null)} />

        {/* ============================================================
            HERO CARD
        ============================================================ */}
        <div
          style={{
            background: T.bgCard,
            border: `1px solid ${T.border}`,
            borderRadius: 20,
            boxShadow: T.shadow,
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) minmax(200px, 300px)',
            overflow: 'hidden',
          }}
          className="issue-hero-grid"
        >
          {/* Left: info */}
          <div style={{ padding: '1.75rem 1.6rem 1.6rem' }}>
            {/* Badges + version */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                flexWrap: 'wrap',
                marginBottom: '0.75rem',
              }}
            >
              <span
                style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  color: T.brown,
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  background: T.bgCream,
                  padding: '0.15rem 0.55rem',
                  borderRadius: 8,
                  border: `1px solid ${T.bgBeige}`,
                }}
              >
                {issue.issue_key}
              </span>
              <WarmStatusBadge status={issue.status} />
              <WarmPriorityBadge priority={issue.priority} />
              <span
                style={{
                  fontSize: '0.72rem',
                  color: T.textSecondary,
                  background: T.bgCream,
                  border: `1px solid ${T.border}`,
                  borderRadius: 99,
                  padding: '0.1rem 0.5rem',
                }}
              >
                v{issue.version}
              </span>
            </div>

            {/* Title */}
            <h1
              style={{
                fontSize: 'clamp(1.25rem, 3vw, 1.7rem)',
                fontWeight: 700,
                color: T.espresso,
                lineHeight: 1.25,
                letterSpacing: '-0.02em',
                marginBottom: '0.35rem',
              }}
            >
              {issue.title}
            </h1>

            {/* Category chip */}
            {issue.category && (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  color: T.textSecondary,
                  fontSize: '0.82rem',
                  marginBottom: '0.8rem',
                }}
              >
                <Tag size={13} color={T.caramel} />
                {issue.category}
              </div>
            )}

            {/* Description */}
            <p
              style={{
                color: T.textSecondary,
                fontSize: '0.91rem',
                lineHeight: 1.65,
                whiteSpace: 'pre-wrap',
                marginBottom: '1.1rem',
              }}
            >
              {issue.description || 'No description provided.'}
            </p>

            {/* Resolution note (if resolved/closed) */}
            {issue.resolution_note && (
              <div
                style={{
                  padding: '0.7rem 0.9rem',
                  borderRadius: 10,
                  background: T.greenBg,
                  border: `1px solid ${T.greenBorder}`,
                  color: T.green,
                  fontSize: '0.82rem',
                  marginBottom: '0.9rem',
                }}
              >
                <strong>Resolution:</strong> {issue.resolution_note}
              </div>
            )}

            {/* Timestamps */}
            <div
              style={{
                display: 'flex',
                gap: '1.5rem',
                flexWrap: 'wrap',
                color: T.textSecondary,
                fontSize: '0.78rem',
                paddingTop: '0.75rem',
                borderTop: `1px solid ${T.border}`,
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                <Calendar size={13} />
                Created {fmt(issue.created_at)}
              </span>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  paddingLeft: '1.5rem',
                  borderLeft: `1px solid ${T.border}`,
                }}
              >
                <RefreshCw size={13} />
                Updated {fmt(issue.updated_at)}
              </span>
            </div>
          </div>

          {/* Right: issue illustration photo */}
          <div style={{ position: 'relative', overflow: 'hidden', minHeight: 200 }}>
            <img
              src="/portal/issue-hero.png"
              alt="Issue workspace illustration"
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition: 'center',
              }}
            />
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                inset: 0,
                background: `linear-gradient(90deg, ${T.bgCard} 0%, rgba(255,253,249,0.5) 22%, rgba(255,253,249,0) 50%)`,
              }}
            />
          </div>
        </div>

        {/* ============================================================
            WORKFLOW ACTION BUTTONS (manager/staff only)
        ============================================================ */}
        {canManageIssues && (
          <div
            style={{
              display: 'flex',
              gap: '0.6rem',
              flexWrap: 'wrap',
              alignItems: 'center',
            }}
          >
            {issue.status === 'open' && (
              <button
                onClick={() => handleTransition('in_progress')}
                disabled={isUpdating}
                style={{
                  ...btnBase,
                  background: T.brown,
                  color: '#fffdf9',
                  opacity: isUpdating ? 0.6 : 1,
                }}
              >
                <Play size={14} />
                Start Progress
              </button>
            )}

            {issue.status === 'in_progress' && (
              <button
                onClick={() => setIsResolveModalOpen(true)}
                disabled={isUpdating}
                style={{
                  ...btnBase,
                  background: '#2f7d4a',
                  color: '#fffdf9',
                  opacity: isUpdating ? 0.6 : 1,
                }}
              >
                <CheckCircle size={14} />
                Resolve Issue
              </button>
            )}

            {issue.status === 'resolved' && (
              <>
                <button
                  onClick={() => handleTransition('closed')}
                  disabled={isUpdating}
                  style={{
                    ...btnBase,
                    background: T.bgBeige,
                    color: T.espresso,
                    border: `1px solid ${T.border}`,
                    opacity: isUpdating ? 0.6 : 1,
                  }}
                >
                  <Check size={14} />
                  Close Ticket
                </button>
                {canReopen && (
                  <button
                    onClick={() => handleTransition('in_progress')}
                    disabled={isUpdating}
                    style={{
                      ...btnBase,
                      background: T.bgCream,
                      color: T.brown,
                      border: `1px solid ${T.border}`,
                      opacity: isUpdating ? 0.6 : 1,
                    }}
                  >
                    <RotateCcw size={14} />
                    Reopen
                  </button>
                )}
              </>
            )}

            {isClosed && (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  color: T.textSecondary,
                  fontSize: '0.83rem',
                  padding: '0.4rem 0.8rem',
                  background: T.bgCream,
                  border: `1px solid ${T.border}`,
                  borderRadius: 10,
                }}
              >
                <XCircle size={15} />
                Ticket is closed
              </div>
            )}
          </div>
        )}

        {/* ============================================================
            PROGRESS CARD
        ============================================================ */}
        <SectionCard>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', marginBottom: '1.1rem' }}>
            <Layers size={17} color={T.brown} />
            <span style={{ fontWeight: 700, fontSize: '1rem', color: T.espresso }}>
              Ticket Progress
            </span>
          </div>
          <ProgressTimeline status={issue.status} />
        </SectionCard>

        {/* ============================================================
            TWO-COLUMN AREA — 65 / 35
        ============================================================ */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 65fr) minmax(240px, 35fr)',
            gap: '1.1rem',
            alignItems: 'start',
          }}
          className="issue-detail-columns"
        >
          {/* ── LEFT: Conversation + Activity tabs ── */}
          <SectionCard>
            {/* Tab header */}
            <div
              style={{
                display: 'flex',
                gap: 0,
                borderBottom: `1px solid ${T.border}`,
                marginBottom: '1.1rem',
              }}
            >
              {(
                [
                  { key: 'comments', icon: <MessageSquare size={15} />, label: 'Conversation', count: comments.length },
                  { key: 'activities', icon: <History size={15} />, label: 'Activity Trail', count: activities.length },
                ] as const
              ).map((tab) => {
                const isActive = activeTab === tab.key
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      padding: '0.55rem 0.85rem',
                      background: 'transparent',
                      border: 'none',
                      borderBottom: isActive ? `2px solid ${T.brown}` : '2px solid transparent',
                      color: isActive ? T.espresso : T.textSecondary,
                      fontWeight: isActive ? 700 : 500,
                      fontSize: '0.88rem',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      transition: 'color 0.15s',
                      marginBottom: -1,
                    }}
                  >
                    {tab.icon}
                    {tab.label}
                    <span
                      style={{
                        minWidth: 22,
                        height: 18,
                        borderRadius: 99,
                        background: isActive ? T.bgBeige : T.bgCream,
                        color: T.brown,
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: `1px solid ${T.border}`,
                        padding: '0 5px',
                      }}
                    >
                      {tab.count}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* ── COMMENTS TAB ── */}
            {activeTab === 'comments' && (
              <>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem',
                    marginBottom: '1.2rem',
                  }}
                >
                  {comments.length === 0 ? (
                    <div
                      style={{
                        textAlign: 'center',
                        padding: '2.5rem 1rem',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '0.55rem',
                        color: T.textSecondary,
                      }}
                    >
                      <div
                        style={{
                          width: 52,
                          height: 52,
                          borderRadius: '50%',
                          background: T.bgCream,
                          border: `1px solid ${T.border}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginBottom: '0.25rem',
                        }}
                      >
                        <MessageSquare size={22} color={T.caramel} />
                      </div>
                      <p style={{ fontWeight: 600, fontSize: '0.95rem', color: T.espresso }}>
                        No comments yet.
                      </p>
                      <p style={{ fontSize: '0.82rem', color: T.textSecondary }}>
                        Share resolution notes, instructions, or ask for details.
                      </p>
                    </div>
                  ) : (
                    comments.map((c) => (
                      <CommentBubble key={c.id} comment={c} currentUserId={user?.id} />
                    ))
                  )}
                  <div ref={conversationEndRef} />
                </div>

                {/* Reply composer */}
                <form
                  onSubmit={handleCommentSubmit}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                    borderTop: `1px solid ${T.border}`,
                    paddingTop: '1rem',
                  }}
                >
                  <textarea
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Share resolution notes, instructions, or ask for details…"
                    rows={3}
                    disabled={isSubmittingComment}
                    style={{
                      width: '100%',
                      padding: '0.7rem 0.9rem',
                      background: T.bgCard,
                      border: `1px solid ${T.border}`,
                      borderRadius: 12,
                      color: T.espresso,
                      fontSize: '0.88rem',
                      lineHeight: 1.55,
                      outline: 'none',
                      resize: 'vertical',
                      minHeight: 80,
                      transition: 'border-color 0.15s',
                      fontFamily: 'inherit',
                    }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = T.borderFocus)}
                    onBlur={(e) => (e.currentTarget.style.borderColor = T.border)}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <button
                      type="button"
                      disabled
                      title="Attachments not yet supported"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: 'not-allowed',
                        color: T.greyStep,
                        display: 'flex',
                        alignItems: 'center',
                        padding: '0.35rem',
                        borderRadius: 8,
                        opacity: 0.4,
                      }}
                    >
                      <Paperclip size={16} />
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingComment || !commentText.trim()}
                      style={{
                        ...btnBase,
                        background: T.brown,
                        color: '#fffdf9',
                        opacity: isSubmittingComment || !commentText.trim() ? 0.5 : 1,
                        cursor: isSubmittingComment || !commentText.trim() ? 'not-allowed' : 'pointer',
                      }}
                    >
                      <Send size={14} />
                      {isSubmittingComment ? 'Posting…' : 'Post Comment'}
                    </button>
                  </div>
                </form>
              </>
            )}

            {/* ── ACTIVITY TRAIL TAB ── */}
            {activeTab === 'activities' && (
              <div>
                {activities.length === 0 ? (
                  <p style={{ color: T.textSecondary, fontSize: '0.82rem', padding: '0.5rem 0' }}>
                    No audit activities recorded.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                    {activities.map((act, idx) => (
                      <div
                        key={act.id}
                        style={{
                          display: 'flex',
                          gap: '0.65rem',
                          position: 'relative',
                          paddingBottom: idx < activities.length - 1 ? '0.9rem' : 0,
                        }}
                      >
                        {/* Dot + line */}
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            flexShrink: 0,
                            width: 16,
                          }}
                        >
                          <div
                            style={{
                              width: 9,
                              height: 9,
                              borderRadius: '50%',
                              background: T.caramel,
                              border: `2px solid ${T.bgBeige}`,
                              marginTop: 3,
                              flexShrink: 0,
                            }}
                          />
                          {idx < activities.length - 1 && (
                            <div
                              style={{
                                flex: 1,
                                width: 1.5,
                                background: T.border,
                                marginTop: 2,
                              }}
                            />
                          )}
                        </div>

                        {/* Text */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p
                            style={{
                              fontSize: '0.82rem',
                              color: T.espresso,
                              fontWeight: 500,
                              lineHeight: 1.4,
                              wordBreak: 'break-word',
                            }}
                          >
                            {activityLabel(act, members)}
                          </p>
                          {act.old_value && act.new_value && (
                            <p
                              style={{
                                fontSize: '0.77rem',
                                color: T.textSecondary,
                                marginTop: '0.15rem',
                                fontFamily: 'JetBrains Mono, monospace',
                              }}
                            >
                              {act.old_value} → {act.new_value}
                            </p>
                          )}
                          <time
                            style={{
                              fontSize: '0.73rem',
                              color: T.textSecondary,
                              display: 'block',
                              marginTop: '0.15rem',
                            }}
                          >
                            {fmt(act.created_at)}
                          </time>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </SectionCard>

          {/* ── RIGHT column ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
            {/* Ticket Details */}
            <SectionCard>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.9rem' }}>
                <Tag size={15} color={T.brown} />
                <span style={{ fontWeight: 700, fontSize: '0.95rem', color: T.espresso }}>
                  Ticket Details
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <DetailRow icon={<Layers size={14} />} label="Status" value={<WarmStatusBadge status={issue.status} />} />
                <DetailRow icon={<Tag size={14} />} label="Priority" value={<WarmPriorityBadge priority={issue.priority} />} />
                <DetailRow icon={<Tag size={14} />} label="Category" value={issue.category || 'General'} />
                <DetailRow
                  icon={<UserCheck size={14} />}
                  label="Assignee"
                  value={
                    canManageIssues ? (
                      <select
                        value={issue.assignee_id || ''}
                        onChange={(e) => handleAssigneeChange(e.target.value || null)}
                        disabled={isUpdating}
                        style={{
                          background: T.bgCream,
                          border: `1px solid ${T.border}`,
                          borderRadius: 8,
                          color: T.espresso,
                          fontSize: '0.78rem',
                          padding: '0.2rem 0.4rem',
                          fontFamily: 'inherit',
                          cursor: 'pointer',
                          maxWidth: 140,
                        }}
                      >
                        <option value="">Unassigned</option>
                        {members
                          .filter((m) => ['owner', 'manager', 'admin', 'staff'].includes(m.role))
                          .map((m) => (
                          <option key={m.user_id} value={m.user_id}>
                            {m.full_name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      assigneeMember ? assigneeMember.full_name : 'Unassigned'
                    )
                  }
                />
                <DetailRow
                  icon={<User size={14} />}
                  label="Reporter"
                  value={issue.reporter?.full_name || '—'}
                />
                <DetailRow icon={<Calendar size={14} />} label="Created" value={fmt(issue.created_at)} />
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.6rem',
                    padding: '0.55rem 0',
                  }}
                >
                  <span style={{ color: T.caramel, marginTop: 2, flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                    <RefreshCw size={14} />
                  </span>
                  <span style={{ fontSize: '0.8rem', color: T.textSecondary, minWidth: 90, flexShrink: 0 }}>
                    Last Updated
                  </span>
                  <span style={{ fontSize: '0.82rem', color: T.espresso, fontWeight: 500, flex: 1, textAlign: 'right' }}>
                    {fmt(issue.updated_at)}
                  </span>
                </div>
              </div>
            </SectionCard>

            {/* Quick Activity History (right panel summary) */}
            <SectionCard>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.9rem' }}>
                <Clock size={15} color={T.brown} />
                <span style={{ fontWeight: 700, fontSize: '0.95rem', color: T.espresso }}>
                  Recent Activity
                </span>
              </div>
              {activities.length === 0 ? (
                <p style={{ color: T.textSecondary, fontSize: '0.82rem' }}>No activity yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {activities.slice(0, 6).map((act, idx) => (
                    <div
                      key={act.id}
                      style={{
                        display: 'flex',
                        gap: '0.65rem',
                        paddingBottom: idx < Math.min(activities.length, 6) - 1 ? '0.85rem' : 0,
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          flexShrink: 0,
                          width: 16,
                        }}
                      >
                        <div
                          style={{
                            width: 9,
                            height: 9,
                            borderRadius: '50%',
                            background: T.caramel,
                            border: `2px solid ${T.bgBeige}`,
                            marginTop: 3,
                            flexShrink: 0,
                          }}
                        />
                        {idx < Math.min(activities.length, 6) - 1 && (
                          <div style={{ flex: 1, width: 1.5, background: T.border, marginTop: 2 }} />
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p
                          style={{
                            fontSize: '0.8rem',
                            color: T.espresso,
                            fontWeight: 500,
                            lineHeight: 1.35,
                            wordBreak: 'break-word',
                          }}
                        >
                          {activityLabel(act, members)}
                        </p>
                        <time style={{ fontSize: '0.72rem', color: T.textSecondary, display: 'block', marginTop: '0.1rem' }}>
                          {fmt(act.created_at)}
                        </time>
                      </div>
                    </div>
                  ))}
                  {activities.length > 6 && (
                    <button
                      type="button"
                      onClick={() => setActiveTab('activities')}
                      style={{
                        marginTop: '0.6rem',
                        background: 'transparent',
                        border: 'none',
                        color: T.brown,
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        padding: 0,
                        textAlign: 'left',
                        fontFamily: 'inherit',
                      }}
                    >
                      View all {activities.length} events →
                    </button>
                  )}
                </div>
              )}
            </SectionCard>
          </div>
        </div>

        {/* Responsive styles */}
        <style>{`
          @media (max-width: 820px) {
            .issue-detail-columns {
              grid-template-columns: 1fr !important;
            }
          }
          @media (max-width: 640px) {
            .issue-hero-grid {
              grid-template-columns: 1fr !important;
            }
          }
        `}</style>
      </div>

      {/* ============================================================
          RESOLVE MODAL
      ============================================================ */}
      {isResolveModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(56,37,28,0.45)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 200,
            padding: '1.5rem',
          }}
          onClick={() => setIsResolveModalOpen(false)}
        >
          <div
            style={{
              background: T.bgCard,
              border: `1px solid ${T.border}`,
              borderRadius: 18,
              maxWidth: 520,
              width: '100%',
              padding: '2rem',
              boxShadow: '0 20px 50px rgba(56,37,28,0.18)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              style={{
                fontSize: '1.25rem',
                color: T.espresso,
                marginBottom: '0.4rem',
                fontWeight: 700,
              }}
            >
              Resolve Issue
            </h2>
            <p
              style={{
                color: T.textSecondary,
                fontSize: '0.85rem',
                marginBottom: '1.25rem',
                lineHeight: 1.55,
              }}
            >
              Provide a resolution note with the root cause and fix applied. This note is mandatory and visible to the reporter.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (resolutionNote.trim()) handleTransition('resolved', resolutionNote.trim())
              }}
            >
              <label
                style={{
                  display: 'block',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  color: T.espresso,
                  marginBottom: '0.4rem',
                }}
              >
                Resolution Note *
              </label>
              <textarea
                rows={4}
                placeholder="e.g. Replaced the faulty component, verified working with affected users."
                value={resolutionNote}
                onChange={(e) => setResolutionNote(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '0.7rem 0.9rem',
                  background: T.bgCream,
                  border: `1px solid ${T.border}`,
                  borderRadius: 12,
                  color: T.espresso,
                  fontSize: '0.88rem',
                  lineHeight: 1.55,
                  outline: 'none',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                  marginBottom: '1.25rem',
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = T.borderFocus)}
                onBlur={(e) => (e.currentTarget.style.borderColor = T.border)}
              />

              <div style={{ display: 'flex', gap: '0.65rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setIsResolveModalOpen(false)}
                  style={{
                    ...btnBase,
                    background: T.bgBeige,
                    color: T.espresso,
                    border: `1px solid ${T.border}`,
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!resolutionNote.trim() || isUpdating}
                  style={{
                    ...btnBase,
                    background: '#2f7d4a',
                    color: '#fffdf9',
                    opacity: !resolutionNote.trim() || isUpdating ? 0.55 : 1,
                    cursor: !resolutionNote.trim() || isUpdating ? 'not-allowed' : 'pointer',
                  }}
                >
                  <CheckCircle size={14} />
                  {isUpdating ? 'Resolving…' : 'Confirm Resolution'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
