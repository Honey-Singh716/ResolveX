import React, { useEffect, useState } from 'react'
import { ArrowLeft, Send } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ErrorAlert } from '../components/ErrorAlert'
import { useOrg } from '../context/OrgContext'
import { api } from '../services/api'
import type { CreateIssueData, IssuePriority } from '../types/issue'
import type { Member } from '../types/organization'

export const CreateIssuePage: React.FC = () => {
  const { orgId } = useParams<{ orgId: string }>()
  const { currentOrg } = useOrg()
  const navigate = useNavigate()

  const activeOrgId = orgId || currentOrg?.id

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('IT Support')
  const [priority, setPriority] = useState<IssuePriority>('medium')
  const [assigneeId, setAssigneeId] = useState<string>('')
  const [members, setMembers] = useState<Member[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (activeOrgId) {
      api.organizations
        .listMembers(activeOrgId, 1, 100)
        .then((res) => setMembers(res.members || []))
        .catch(() => {})
    }
  }, [activeOrgId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeOrgId) return
    setError(null)

    if (title.trim().length < 3) {
      setError('Title must be at least 3 characters long.')
      return
    }

    try {
      setIsSubmitting(true)
      const data: CreateIssueData = {
        title: title.trim(),
        description: description.trim() || undefined,
        category: category.trim() || undefined,
        priority,
        assignee_id: assigneeId || null,
      }
      const newIssue = await api.issues.create(activeOrgId, data)
      navigate(`/org/${activeOrgId}/issues/${newIssue.id}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create issue.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div style={{ maxWidth: '780px', margin: '0 auto' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <Link
          to={`/org/${activeOrgId}/issues`}
          className="btn-ghost btn-sm"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.75rem' }}
        >
          <ArrowLeft size={15} /> Back to Issues
        </Link>
        <h1>Submit New Service Request</h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
          File a complaint, IT ticket, maintenance request, or operational task
        </p>
      </div>

      <ErrorAlert message={error} onDismiss={() => setError(null)} />

      <div className="card">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="issueTitle">
              Summary / Title *
            </label>
            <input
              id="issueTitle"
              type="text"
              className="form-input"
              placeholder="e.g. Broken projector in Room 302 or Network latency in Wing B"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '1rem',
              marginBottom: '1rem',
            }}
          >
            {/* Category */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="issueCategory">
                Category
              </label>
              <select
                id="issueCategory"
                className="form-select"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="IT Support">IT Support</option>
                <option value="Facilities & Repairs">Facilities &amp; Repairs</option>
                <option value="Hardware & Devices">Hardware &amp; Devices</option>
                <option value="Library Services">Library Services</option>
                <option value="Security & Access">Security &amp; Access</option>
                <option value="Billing & Operations">Billing &amp; Operations</option>
                <option value="General Inquiry">General Inquiry</option>
              </select>
            </div>

            {/* Priority */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="issuePriority">
                Priority
              </label>
              <select
                id="issuePriority"
                className="form-select"
                value={priority}
                onChange={(e) => setPriority(e.target.value as IssuePriority)}
              >
                <option value="low">Low — Routine request</option>
                <option value="medium">Medium — Standard operational</option>
                <option value="high">High — Impairs workflow</option>
                <option value="urgent">Urgent — Critical blocker</option>
              </select>
            </div>

            {/* Assignee */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="issueAssignee">
                Assignee (Optional)
              </label>
              <select
                id="issueAssignee"
                className="form-select"
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
              >
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.full_name} ({m.role})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Description */}
          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label className="form-label" htmlFor="issueDescription">
              Detailed Description
            </label>
            <textarea
              id="issueDescription"
              className="form-textarea"
              placeholder="Describe the issue, location, error messages, and reproduction details..."
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <Link to={`/org/${activeOrgId}/issues`} className="btn btn-secondary">
              Cancel
            </Link>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              <Send size={16} /> {isSubmitting ? 'Submitting...' : 'Submit Issue'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
