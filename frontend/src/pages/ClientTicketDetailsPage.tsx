import React, { useEffect, useState } from 'react'
import { ArrowLeft, Clock, MessageSquare, Send } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'
import { ErrorAlert } from '../components/ErrorAlert'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { PriorityBadge, StatusBadge } from '../components/StatusBadge'
import { useOrg } from '../context/OrgContext'
import { api } from '../services/api'
import type { Issue, IssueActivity, IssueComment } from '../types/issue'

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

  const loadData = async () => {
    if (!issueId) return
    try {
      setIsLoading(true)
      setError(null)
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

  useEffect(() => {
    loadData()
  }, [issueId])

  const handleCommentSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!issueId || !commentText.trim()) return
    try {
      setIsSubmitting(true)
      setError(null)
      const comment = await api.issues.addMineComment(issueId, commentText.trim())
      setComments((previous) => [...previous, comment])
      setCommentText('')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add additional information.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) return <LoadingSpinner fullPage label="Loading your ticket..." />
  if (!issue) {
    return (
      <EmptyState
        title="Ticket Not Found"
        description="This ticket does not exist or is not owned by your account."
        action={<Link to="/client/dashboard" className="btn btn-primary">Back to My Dashboard</Link>}
      />
    )
  }

  const organizationName =
    organizations.find((organization) => organization.id === issue.organization_id)?.name || 'Organization'

  return (
    <div style={{ maxWidth: '950px', margin: '0 auto' }}>
      <Link to="/client/dashboard" className="btn-ghost btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', marginBottom: '1rem' }}>
        <ArrowLeft size={15} /> Back to My Tickets
      </Link>
      <ErrorAlert message={error} onDismiss={() => setError(null)} />

      <div className="card" style={{ padding: '1.75rem', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.6rem' }}>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--primary)', fontWeight: 700 }}>{issue.issue_key}</span>
              <StatusBadge status={issue.status} />
              <PriorityBadge priority={issue.priority} />
            </div>
            <h1 style={{ fontSize: '1.65rem' }}>{issue.title}</h1>
            <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>{organizationName}</p>
          </div>
        </div>
        <div style={{ marginTop: '1.25rem', color: 'var(--text-secondary)', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
          {issue.description || 'No description provided.'}
        </div>
        <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', marginTop: '1.25rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          <span><Clock size={13} style={{ verticalAlign: 'middle' }} /> Created {new Date(issue.created_at).toLocaleString()}</span>
          <span><Clock size={13} style={{ verticalAlign: 'middle' }} /> Updated {new Date(issue.updated_at).toLocaleString()}</span>
        </div>
      </div>

      <div className="card" style={{ padding: '1.5rem', marginBottom: '1.25rem' }}>
        <h2 style={{ fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '1rem' }}>
          <MessageSquare size={18} /> Conversation
        </h2>
        {comments.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>No comments yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
            {comments.map((comment) => (
              <div key={comment.id} style={{ padding: '0.8rem', background: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{comment.author.full_name}</div>
                <div style={{ marginTop: '0.35rem', whiteSpace: 'pre-wrap', color: 'var(--text-secondary)' }}>{comment.content}</div>
                <div style={{ marginTop: '0.35rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(comment.created_at).toLocaleString()}</div>
              </div>
            ))}
          </div>
        )}
        <form onSubmit={handleCommentSubmit} style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-end' }}>
          <textarea
            className="form-input"
            value={commentText}
            onChange={(event) => setCommentText(event.target.value)}
            placeholder="Add information or reply to the organization team..."
            rows={3}
            required
          />
          <button type="submit" className="btn btn-primary" disabled={isSubmitting || !commentText.trim()}>
            <Send size={15} /> {isSubmitting ? 'Sending...' : 'Send'}
          </button>
        </form>
      </div>

      <div className="card" style={{ padding: '1.5rem' }}>
        <h2 style={{ fontSize: '1.15rem', marginBottom: '1rem' }}>Permitted Activity History</h2>
        {activities.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No activity history available.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {activities.map((activity) => (
              <div key={activity.id} style={{ display: 'flex', gap: '0.6rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                <Clock size={14} style={{ marginTop: '0.15rem', color: 'var(--primary)', flexShrink: 0 }} />
                <span>{activity.details || `${activity.action.replaceAll('_', ' ')}${activity.new_value ? `: ${activity.new_value}` : ''}`} · {new Date(activity.created_at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
