import React, { useEffect, useState } from 'react'
import { ArrowRight, Building2, Clock, Key, Plus, Sparkles, AlertCircle } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'
import { ErrorAlert } from '../components/ErrorAlert'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { RoleBadge, VerificationBadge } from '../components/StatusBadge'
import { useOrg } from '../context/OrgContext'
import { api } from '../services/api'
import type { CreateOrgData, MembershipRequest } from '../types/organization'

export const OrganizationsPage: React.FC = () => {
  const { organizations, isLoading, selectOrg, refreshOrgs } = useOrg()
  const navigate = useNavigate()
  const location = useLocation()

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [industry, setIndustry] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [officialEmailDomain, setOfficialEmailDomain] = useState('')
  const [officialWebsite, setOfficialWebsite] = useState('')
  const [proofDocumentReference, setProofDocumentReference] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [joinSuccess, setJoinSuccess] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [myRequests, setMyRequests] = useState<MembershipRequest[]>([])

  const loadMyRequests = async () => {
    try {
      const res = await api.organizations.getMyMembershipRequests()
      setMyRequests(res.requests || [])
    } catch {
      // Non-blocking
    }
  }

  useEffect(() => {
    loadMyRequests()
  }, [])

  useEffect(() => {
    const openModal = (location.state as { open?: 'join' | 'create' } | null)?.open
    if (openModal === 'join') {
      setIsJoinModalOpen(true)
    } else if (openModal === 'create') {
      setIsModalOpen(true)
    } else {
      return
    }
    navigate(location.pathname, { replace: true, state: null })
  }, [location, navigate])

  const handleSelect = (orgId: string) => {
    selectOrg(orgId)
    navigate(`/org/${orgId}/issues`)
  }

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (name.trim().length < 3) {
      setError('Organization name must be at least 3 characters.')
      return
    }
    if (!officialEmailDomain.trim() || !officialWebsite.trim() || !proofDocumentReference.trim() || !contactPhone.trim()) {
      setError('All organization verification details are required.')
      return
    }

    try {
      setIsSubmitting(true)
      const data: CreateOrgData = {
        name: name.trim(),
        industry: industry.trim() || undefined,
        slug: slug.trim() || undefined,
        official_email_domain: officialEmailDomain.trim().toLowerCase(),
        official_website: officialWebsite.trim(),
        proof_document_reference: proofDocumentReference.trim(),
        contact_phone: contactPhone.trim(),
      }
      const newOrg = await api.organizations.create(data)
      await refreshOrgs()
      selectOrg(newOrg.id)
      setIsModalOpen(false)
      navigate(`/org/${newOrg.id}/issues`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create organization.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleJoinByCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setJoinSuccess(null)

    if (!joinCode.trim()) {
      setError('Please provide a valid join code.')
      return
    }

    try {
      setIsSubmitting(true)
      const req = await api.organizations.joinByCode(joinCode.trim())
      setJoinSuccess(`Join request submitted for ${req.organization_name || 'organization'}! It is pending review by organization administrators.`)
      setJoinCode('')
      setIsJoinModalOpen(false)
      await loadMyRequests()
      await refreshOrgs()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to submit join code.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return <LoadingSpinner fullPage label="Loading your organizations..." />
  }

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '2rem',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <h1>Organization Workspaces</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            Select an organization, join via invite code, or create a new workspace
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button onClick={() => setIsJoinModalOpen(true)} className="btn btn-secondary">
            <Key size={16} /> Join with Code
          </button>
          <button onClick={() => setIsModalOpen(true)} className="btn btn-primary">
            <Plus size={16} /> New Organization
          </button>
        </div>
      </div>

      <ErrorAlert message={error} onDismiss={() => setError(null)} />

      {joinSuccess && (
        <div
          style={{
            background: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: 'var(--radius-md)',
            padding: '1rem 1.25rem',
            marginBottom: '1.5rem',
            color: '#34d399',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>{joinSuccess}</span>
          <button
            onClick={() => setJoinSuccess(null)}
            className="btn btn-ghost btn-sm"
            style={{ color: '#34d399', padding: '0.25rem 0.5rem' }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Org Cards Grid */}
      {organizations.length === 0 ? (
        <EmptyState
          icon={<Building2 size={36} />}
          title="No organizations found"
          description="You haven't joined or created any organizations yet. Join with an invite code from your team or create your first workspace."
          action={
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
              <button onClick={() => setIsJoinModalOpen(true)} className="btn btn-secondary">
                <Key size={16} /> Join with Code
              </button>
              <button onClick={() => setIsModalOpen(true)} className="btn btn-primary">
                <Sparkles size={16} /> Create Organization
              </button>
            </div>
          }
        />
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '1.25rem',
            marginBottom: '2.5rem',
          }}
        >
          {organizations.map((org) => (
            <div
              key={org.id}
              className="card card-hover"
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                cursor: 'pointer',
              }}
              onClick={() => handleSelect(org.id)}
            >
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '1rem',
                  }}
                >
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '10px',
                      background: 'var(--bg-surface-elevated)',
                      border: '1px solid var(--border-medium)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--primary)',
                    }}
                  >
                    <Building2 size={20} />
                  </div>
                  <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                    <VerificationBadge status={org.verification_status || 'approved'} />
                    <RoleBadge role={org.role} />
                  </div>
                </div>

                <h3 style={{ fontSize: '1.15rem', marginBottom: '0.35rem' }}>{org.name}</h3>
                <div
                  style={{
                    fontSize: '0.8rem',
                    color: 'var(--text-muted)',
                    fontFamily: 'var(--font-mono)',
                    marginBottom: '0.75rem',
                  }}
                >
                  slug: {org.slug}
                </div>

                {org.industry && (
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Industry: <strong style={{ color: 'var(--text-main)' }}>{org.industry}</strong>
                  </div>
                )}

                {org.verification_status === 'pending' && (
                  <div
                    style={{
                      marginTop: '0.75rem',
                      fontSize: '0.75rem',
                      background: 'rgba(245, 158, 11, 0.1)',
                      color: '#fbbf24',
                      padding: '0.4rem 0.6rem',
                      borderRadius: 'var(--radius-sm)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                    }}
                  >
                    <Clock size={12} /> Pending verification by platform administrators
                  </div>
                )}

                {org.verification_status === 'rejected' && (
                  <div
                    style={{
                      marginTop: '0.75rem',
                      fontSize: '0.75rem',
                      background: 'rgba(239, 68, 68, 0.1)',
                      color: '#f87171',
                      padding: '0.4rem 0.6rem',
                      borderRadius: 'var(--radius-sm)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                    }}
                  >
                    <AlertCircle size={12} /> Rejected: {org.rejection_reason || 'Verification denied'}
                  </div>
                )}
              </div>

              <div
                style={{
                  marginTop: '1.5rem',
                  paddingTop: '1rem',
                  borderTop: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  color: 'var(--primary)',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                }}
              >
                <span>Enter Workspace</span>
                <ArrowRight size={16} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pending Membership Requests Section */}
      {myRequests.length > 0 && (
        <div style={{ marginTop: '2.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <Clock size={18} style={{ color: 'var(--primary)' }} />
            <h2 style={{ fontSize: '1.25rem' }}>Your Join Requests</h2>
          </div>
          <div className="card" style={{ padding: '0.5rem' }}>
            <table className="table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Organization</th>
                  <th>Status</th>
                  <th>Requested Role</th>
                  <th>Submitted At</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {myRequests.map((req) => (
                  <tr key={req.id}>
                    <td>
                      <strong>{req.organization_name || 'Organization'}</strong>
                    </td>
                    <td>
                      <span className={`badge badge-verification-${req.status}`}>{req.status}</span>
                    </td>
                    <td>
                      <RoleBadge role={req.role} />
                    </td>
                    <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      {new Date(req.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ fontSize: '0.85rem', color: req.rejection_reason ? '#f87171' : 'var(--text-muted)' }}>
                      {req.rejection_reason || (req.status === 'pending' ? 'Awaiting admin review' : 'Approved')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Organization Modal */}
      {isModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsModalOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginBottom: '0.5rem' }}>Create New Organization</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
              Set up a multi-tenant issue and service workspace. New organizations require platform administrator verification.
            </p>

            <form onSubmit={handleCreateOrg}>
              <div className="form-group">
                <label className="form-label" htmlFor="orgName">
                  Organization Name *
                </label>
                <input
                  id="orgName"
                  type="text"
                  className="form-input"
                  placeholder="e.g. Stanford University IT or Acme Logistics"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="orgEmailDomain">Official Email Domain *</label>
                <input id="orgEmailDomain" type="text" className="form-input" placeholder="example.org" value={officialEmailDomain} onChange={(e) => setOfficialEmailDomain(e.target.value)} required />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="orgWebsite">Official Website *</label>
                <input id="orgWebsite" type="url" className="form-input" placeholder="https://example.org" value={officialWebsite} onChange={(e) => setOfficialWebsite(e.target.value)} required />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="orgProof">Proof Document Reference *</label>
                <input id="orgProof" type="text" className="form-input" placeholder="Secure document URL or storage reference" value={proofDocumentReference} onChange={(e) => setProofDocumentReference(e.target.value)} required />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="orgPhone">Contact Phone *</label>
                <input id="orgPhone" type="tel" className="form-input" placeholder="+1 555 123 4567" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} required />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="orgIndustry">
                  Industry / Domain (Optional)
                </label>
                <select
                  id="orgIndustry"
                  className="form-select"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                >
                  <option value="">Select industry category...</option>
                  <option value="Education">Education & Academic</option>
                  <option value="Healthcare">Healthcare & Medicine</option>
                  <option value="Finance">Finance & Banking</option>
                  <option value="Technology">Technology & Software</option>
                  <option value="Government">Government & Public Sector</option>
                  <option value="Retail">Retail & E-commerce</option>
                  <option value="Manufacturing">Manufacturing & Supply Chain</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="orgSlug">
                  Custom Workspace Slug (Optional)
                </label>
                <input
                  id="orgSlug"
                  type="text"
                  className="form-input"
                  placeholder="e.g. stanford-it (auto-generated if empty)"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '2rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Creating...' : 'Create Workspace'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Join Organization with Code Modal */}
      {isJoinModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsJoinModalOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginBottom: '0.5rem' }}>Join Organization with Code</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
              Enter the invite or join code provided by your organization administrators.
            </p>

            <form onSubmit={handleJoinByCode}>
              <div className="form-group">
                <label className="form-label" htmlFor="joinCode">
                  Organization Join Code *
                </label>
                <input
                  id="joinCode"
                  type="text"
                  className="form-input"
                  placeholder="e.g. RX-D31ABFEE"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '2rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsJoinModalOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Submitting...' : 'Request to Join'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
