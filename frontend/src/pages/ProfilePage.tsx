import React from 'react'
import { Mail, ShieldCheck, User, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { RoleBadge } from '../components/StatusBadge'
import { useAuth } from '../context/AuthContext'
import { useOrg } from '../context/OrgContext'

export const ProfilePage: React.FC = () => {
  const { user } = useAuth()
  const { organizations } = useOrg()

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <span className="home-section-kicker">Account</span>
        <h1>Your Profile</h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '0.3rem' }}>
          Review your account details and organization memberships.
        </p>
      </div>
      <div className="profile-grid">
        <section className="card profile-card">
          <div className="profile-avatar"><User size={26} /></div>
          <h2>{user?.full_name || 'ResolveX user'}</h2>
          <p className="profile-email"><Mail size={15} /> {user?.email}</p>
          <div className="profile-note">
            <ShieldCheck size={16} />
            <span>Roles and permissions are managed by verified organization membership and cannot be changed from your profile.</span>
          </div>
        </section>
        <section className="card profile-card">
          <div className="home-panel-header"><div><span className="home-section-kicker">Memberships</span><h2>Your Organizations</h2></div><Users size={20} /></div>
          {organizations.length === 0 ? (
            <p className="home-muted">You are not connected to an organization yet.</p>
          ) : (
            <div className="home-org-list">
              {organizations.map((organization) => (
                <div className="home-org-row" key={organization.id}>
                  <div className="home-org-avatar"><Users size={16} /></div>
                  <div className="home-org-details"><strong>{organization.name}</strong><span>{organization.verification_status}</span></div>
                  <RoleBadge role={organization.role} />
                </div>
              ))}
            </div>
          )}
          <Link to="/organizations" className="btn btn-secondary btn-sm profile-action">Manage organizations</Link>
        </section>
      </div>
      <div className="profile-security card">
        <ShieldCheck size={20} />
        <div><h3>Security settings</h3><p>Password and profile editing are not exposed by the current backend API. Contact an administrator if your account details need to be changed.</p></div>
      </div>
    </div>
  )
}
