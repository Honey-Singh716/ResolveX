import React, { useState } from 'react'
import {
  Briefcase,
  ChevronDown,
  LogOut,
  ShieldAlert,
  ShieldCheck,
  User as UserIcon,
} from 'lucide-react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useOrg } from '../context/OrgContext'
import { NotificationDropdown } from './NotificationDropdown'

export const PlatformAdminLayout: React.FC = () => {
  const { user, logout } = useAuth()
  const { organizations } = useOrg()
  const [userDropdownOpen, setUserDropdownOpen] = useState(false)
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/platform-admin/login')
  }

  // Check if admin also has an approved staff/owner workspace
  const approvedOrgs = organizations.filter(
    (o) => o.verification_status === 'approved' && ['owner', 'admin', 'manager', 'staff'].includes(o.role)
  )

  return (
    <div className="app-shell">
      <header
        className="navbar"
        style={{
          borderBottom: '1px solid rgba(168, 85, 247, 0.35)',
          background: 'rgba(15, 12, 28, 0.85)',
        }}
      >
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <Link
            to="/platform-admin/dashboard"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              fontWeight: 800,
              fontSize: '1.15rem',
              color: 'var(--text-main)',
              textDecoration: 'none',
              letterSpacing: '-0.02em',
            }}
          >
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #a855f7, #6366f1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                boxShadow: '0 2px 12px rgba(168, 85, 247, 0.45)',
              }}
            >
              <ShieldCheck size={18} />
            </div>
            <span>
              ResolveX <span style={{ fontSize: '0.8rem', color: '#c084fc', fontWeight: 600 }}>Platform Governance</span>
            </span>
          </Link>
          <span
            style={{
              background: 'rgba(168, 85, 247, 0.15)',
              border: '1px solid rgba(168, 85, 247, 0.35)',
              color: '#d8b4fe',
              fontSize: '0.72rem',
              fontWeight: 700,
              padding: '0.2rem 0.55rem',
              borderRadius: 'var(--radius-full)',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            Superadmin
          </span>
        </div>

        {/* Center Nav Links */}
        <nav className="navbar-nav" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <NavLink
            to="/platform-admin/dashboard"
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#e9d5ff' }}
          >
            <ShieldAlert size={16} /> Governance Dashboard
          </NavLink>

          {approvedOrgs.length > 0 && (
            <NavLink
              to="/organization/dashboard"
              className="nav-link"
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#818cf8' }}
            >
              <Briefcase size={16} /> Staff Workspace
            </NavLink>
          )}
        </nav>

        {/* Right Tools */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <NotificationDropdown />

          {/* User Menu */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setUserDropdownOpen((prev) => !prev)}
              className="btn-ghost"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.35rem 0.65rem',
                borderRadius: 'var(--radius-full)',
                border: '1px solid rgba(168, 85, 247, 0.35)',
              }}
            >
              <div
                style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '50%',
                  background: 'rgba(168, 85, 247, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#c084fc',
                }}
              >
                <UserIcon size={15} />
              </div>
              <span
                style={{
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  maxWidth: '130px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {user?.full_name || 'Admin'}
              </span>
              <ChevronDown size={13} style={{ opacity: 0.6 }} />
            </button>

            {userDropdownOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  right: 0,
                  width: '240px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-medium)',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: 'var(--shadow-lg)',
                  zIndex: 60,
                  overflow: 'hidden',
                  padding: '0.5rem 0',
                }}
              >
                <div style={{ padding: '0.5rem 1rem', borderBottom: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{user?.full_name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{user?.email}</div>
                  <span
                    style={{
                      display: 'inline-block',
                      marginTop: '0.35rem',
                      background: 'rgba(168, 85, 247, 0.2)',
                      color: '#d8b4fe',
                      padding: '0.15rem 0.5rem',
                      borderRadius: 'var(--radius-full)',
                      fontSize: '0.7rem',
                      fontWeight: 600,
                    }}
                  >
                    Platform Administrator
                  </span>
                </div>

                {approvedOrgs.length > 0 && (
                  <button
                    onClick={() => {
                      setUserDropdownOpen(false)
                      navigate('/organization/dashboard')
                    }}
                    className="btn-ghost btn-sm"
                    style={{ width: '100%', justifyContent: 'flex-start', padding: '0.6rem 1rem', color: '#818cf8' }}
                  >
                    <Briefcase size={15} /> Staff Workspace
                  </button>
                )}

                <div style={{ borderTop: '1px solid var(--border-subtle)', margin: '0.25rem 0' }} />
                <button
                  onClick={handleLogout}
                  className="btn-ghost btn-sm"
                  style={{ width: '100%', justifyContent: 'flex-start', padding: '0.6rem 1rem', color: '#f87171' }}
                >
                  <LogOut size={15} /> Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  )
}
