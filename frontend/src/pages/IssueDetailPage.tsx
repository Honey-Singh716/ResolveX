import React, { useEffect, useState } from 'react'
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle,
  Clock,
  History,
  MessageSquare,
  Play,
  RotateCcw,
  Send,
  UserCheck,
  XCircle,
} from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'
import { ErrorAlert } from '../components/ErrorAlert'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { PriorityBadge, StatusBadge } from '../components/StatusBadge'
import { useAuth } from '../context/AuthContext'
import { useOrg } from '../context/OrgContext'
import { api } from '../services/api'
import type { Issue, IssueActivity, IssueComment, IssueStatus } from '../types/issue'
import type { Member } from '../types/organization'

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

  // Comment state
  const [commentText, setCommentText] = useState('')
  const [isSubmittingComment, setIsSubmittingComment] = useState(false)

  // Resolve Modal state
  const [isResolveModalOpen, setIsResolveModalOpen] = useState(false)
  const [resolutionNote, setResolutionNote] = useState('')

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

  useEffect(() => {
    loadData()
  }, [orgId, issueId])

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
      // Refresh audit activities
      const acts = await api.issues.listActivities(orgId, issueId, 1, 100)
      setActivities(acts.activities || [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Status update failed.')
      if (err instanceof Error && err.message.includes('modified by another user')) {
        loadData()
      }
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

  if (isLoading) {
    return <LoadingSpinner fullPage label="Loading issue details..." />
  }

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

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
      {/* Top Navigation */}
      <div style={{ marginBottom: '1.25rem' }}>
        <Link
          to={`/org/${orgId}/issues`}
          className="btn-ghost btn-sm"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.75rem' }}
        >
          <ArrowLeft size={15} /> Back to Issues
        </Link>
      </div>

      <ErrorAlert message={error} onDismiss={() => setError(null)} />

      {/* Main Header Card */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1.75rem' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
            marginBottom: '1rem',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '1rem',
                  fontWeight: 700,
                  color: 'var(--primary)',
                }}
              >
                {issue.issue_key}
              </span>
              <StatusBadge status={issue.status} />
              <PriorityBadge priority={issue.priority} />
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                v{issue.version}
              </span>
            </div>
            <h1 style={{ fontSize: '1.65rem' }}>{issue.title}</h1>
          </div>

          {/* Workflow Action Buttons */}
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
            {issue.status === 'open' && (
              <button
                onClick={() => handleTransition('in_progress')}
                disabled={isUpdating}
                className="btn btn-primary btn-sm"
              >
                <Play size={14} /> Start Progress
              </button>
            )}

            {issue.status === 'in_progress' && (
              <button
                onClick={() => setIsResolveModalOpen(true)}
                disabled={isUpdating}
                className="btn btn-primary btn-sm"
                style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
              >
                <CheckCircle size={14} /> Resolve Issue
              </button>
            )}

            {issue.status === 'resolved' && (
              <>
                {canManageIssues && (
                  <button
                    onClick={() => handleTransition('closed')}
                    disabled={isUpdating}
                    className="btn btn-secondary btn-sm"
                  >
                    <Check size={14} /> Close Ticket
                  </button>
                )}
                {canReopen && (
                  <button
                    onClick={() => handleTransition('in_progress')}
                    disabled={isUpdating}
                    className="btn btn-ghost btn-sm"
                  >
                    <RotateCcw size={14} /> Reopen
                  </button>
                )}
              </>
            )}

            {issue.status === 'closed' && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  color: 'var(--text-muted)',
                  fontSize: '0.85rem',
                }}
              >
                <XCircle size={16} /> Ticket is closed
              </div>
            )}
          </div>
        </div>

        {/* Resolution Note Alert if Resolved or Closed */}
        {issue.resolution_note && (
          <div
            style={{
              padding: '0.85rem 1rem',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              color: '#34d399',
              fontSize: '0.875rem',
              marginTop: '1rem',
            }}
          >
            <strong>Resolution Note:</strong> {issue.resolution_note}
          </div>
        )}

        {/* Metadata Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '1rem',
            marginTop: '1.5rem',
            paddingTop: '1.25rem',
            borderTop: '1px solid var(--border-subtle)',
            fontSize: '0.85rem',
          }}
        >
          <div>
            <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem' }}>
              Category
            </span>
            <span style={{ fontWeight: 500 }}>{issue.category || 'General'}</span>
          </div>

          <div>
            <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem' }}>
              Assignee
            </span>
            {canManageIssues ? (
              <select
                className="form-select"
                style={{ height: '32px', padding: '0.2rem 0.5rem', fontSize: '0.8rem' }}
                value={issue.assignee_id || ''}
                onChange={(e) => handleAssigneeChange(e.target.value || null)}
                disabled={isUpdating}
              >
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.full_name} ({m.role})
                  </option>
                ))}
              </select>
            ) : (
              <span style={{ fontWeight: 500 }}>
                {assigneeMember ? assigneeMember.full_name : 'Unassigned'}
              </span>
            )}
          </div>

          <div>
            <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem' }}>
              Reported On
            </span>
            <span style={{ fontWeight: 500 }}>
              {new Date(issue.created_at).toLocaleString()}
            </span>
          </div>

          <div>
            <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem' }}>
              Last Updated
            </span>
            <span style={{ fontWeight: 500 }}>
              {new Date(issue.updated_at).toLocaleString()}
            </span>
          </div>
        </div>

        {/* Issue Description */}
        {issue.description && (
          <div style={{ marginTop: '1.5rem' }}>
            <h4 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
              Description
            </h4>
            <div
              style={{
                background: 'var(--bg-surface-elevated)',
                padding: '1rem 1.25rem',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-main)',
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
                fontSize: '0.9rem',
              }}
            >
              {issue.description}
            </div>
          </div>
        )}
      </div>

      {/* Tabs: Discussion (Comments) vs Audit Log */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div
          style={{
            display: 'flex',
            gap: '1rem',
            borderBottom: '1px solid var(--border-subtle)',
            paddingBottom: '0.5rem',
          }}
        >
          <button
            onClick={() => setActiveTab('comments')}
            className={`btn-ghost ${activeTab === 'comments' ? 'active' : ''}`}
            style={{
              gap: '0.4rem',
              fontWeight: 600,
              color: activeTab === 'comments' ? 'var(--primary)' : 'var(--text-muted)',
              borderBottom: activeTab === 'comments' ? '2px solid var(--primary)' : 'none',
              borderRadius: 0,
              paddingBottom: '0.5rem',
            }}
          >
            <MessageSquare size={16} /> Comments ({comments.length})
          </button>
          <button
            onClick={() => setActiveTab('activities')}
            className={`btn-ghost ${activeTab === 'activities' ? 'active' : ''}`}
            style={{
              gap: '0.4rem',
              fontWeight: 600,
              color: activeTab === 'activities' ? 'var(--primary)' : 'var(--text-muted)',
              borderBottom: activeTab === 'activities' ? '2px solid var(--primary)' : 'none',
              borderRadius: 0,
              paddingBottom: '0.5rem',
            }}
          >
            <History size={16} /> Activity Audit Trail ({activities.length})
          </button>
        </div>
      </div>

      {/* Comments Tab Content */}
      {activeTab === 'comments' && (
        <div>
          {/* Comment list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
            {comments.length === 0 ? (
              <div
                style={{
                  padding: '2.5rem',
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                  background: 'var(--bg-surface)',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                No comments yet. Start the conversation below.
              </div>
            ) : (
              comments.map((c) => {
                const author = c.author
                return (
                  <div
                    key={c.id}
                    className="card"
                    style={{ padding: '1.1rem 1.25rem', background: 'var(--bg-surface)' }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '0.5rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div
                          style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            background: 'var(--primary-subtle)',
                            color: 'var(--primary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                          }}
                        >
                          {author ? author.full_name[0] : 'U'}
                        </div>
                        <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                          {author ? author.full_name : 'Team Member'}
                        </span>
                        {author && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            ({author.role})
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {new Date(c.created_at).toLocaleString()}
                      </span>
                    </div>
                    <div style={{ color: 'var(--text-main)', fontSize: '0.9rem', lineHeight: 1.5 }}>
                      {c.content}
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* New comment input */}
          <form onSubmit={handleCommentSubmit} className="card" style={{ padding: '1.25rem' }}>
            <h4 style={{ fontSize: '0.9rem', marginBottom: '0.75rem' }}>Leave a comment or update</h4>
            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <textarea
                className="form-textarea"
                rows={3}
                placeholder="Share resolution notes, instructions, or ask for details..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                required
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="submit"
                className="btn btn-primary btn-sm"
                disabled={isSubmittingComment || !commentText.trim()}
              >
                <Send size={14} /> {isSubmittingComment ? 'Posting...' : 'Post Comment'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Activity History Tab Content */}
      {activeTab === 'activities' && (
        <div className="card" style={{ padding: '1.5rem' }}>
          {activities.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
              No audit activities recorded.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {activities.map((act) => {
                const actor = members.find((m) => m.user_id === act.actor_id)
                return (
                  <div
                    key={act.id}
                    style={{
                      display: 'flex',
                      gap: '0.85rem',
                      alignItems: 'flex-start',
                      paddingBottom: '1rem',
                      borderBottom: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div
                      style={{
                        width: '30px',
                        height: '30px',
                        borderRadius: '50%',
                        background: 'var(--bg-surface-elevated)',
                        border: '1px solid var(--border-medium)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--primary)',
                        flexShrink: 0,
                        marginTop: '0.2rem',
                      }}
                    >
                      {act.action === 'status_change' && <Clock size={15} />}
                      {act.action === 'assignment_change' && <UserCheck size={15} />}
                      {act.action === 'priority_change' && <AlertCircle size={15} />}
                    </div>

                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-main)' }}>
                        <strong>{actor ? actor.full_name : 'User'}</strong>{' '}
                        <span style={{ color: 'var(--text-secondary)' }}>
                          {act.action.replace('_', ' ')}
                        </span>
                      </div>

                      <div
                        style={{
                          fontSize: '0.8rem',
                          color: 'var(--text-muted)',
                          marginTop: '0.25rem',
                          fontFamily: 'var(--font-mono)',
                        }}
                      >
                        {act.old_value || 'None'} →{' '}
                        <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>
                          {act.new_value || 'None'}
                        </span>
                      </div>

                      {act.details && (
                        <div
                          style={{
                            fontSize: '0.8rem',
                            color: 'var(--text-secondary)',
                            marginTop: '0.25rem',
                            fontStyle: 'italic',
                          }}
                        >
                          "{act.details}"
                        </div>
                      )}

                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                        {new Date(act.created_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Resolve Issue Modal */}
      {isResolveModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsResolveModalOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginBottom: '0.5rem' }}>Resolve Issue</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
              Please provide a resolution note detailing the root cause and the fix applied. This note is mandatory.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (resolutionNote.trim()) {
                  handleTransition('resolved', resolutionNote.trim())
                }
              }}
            >
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label className="form-label" htmlFor="resolutionNote">
                  Resolution Note *
                </label>
                <textarea
                  id="resolutionNote"
                  className="form-textarea"
                  rows={4}
                  placeholder="e.g. Replaced HDMI splitter, calibrated projector lamp, verified working with team."
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setIsResolveModalOpen(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={!resolutionNote.trim() || isUpdating}
                  style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
                >
                  {isUpdating ? 'Resolving...' : 'Confirm Resolution'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
