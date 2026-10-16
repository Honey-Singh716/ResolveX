import React, { useState } from 'react'
import {
  Briefcase,
  ChevronDown,
  Bell,
  Home,
  Inbox,
  LogOut,
  ShieldCheck,
  User as UserIcon,
} from 'lucide-react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { NotificationDropdown } from './NotificationDropdown'

export const ClientLayout: React.FC = () => {
  const { user, logout } = useAuth()
  const [userDropdownOpen, setUserDropdownOpen] = useState(false)
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="app-shell">
      <header className="navbar" style={{ borderBottom: '1px solid rgba(99, 102, 241, 0.2)' }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <Link
            to="/home"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
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
                background: 'linear-gradient(135deg, #10b981, #059669)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                boxShadow: '0 2px 8px rgba(16, 185, 129, 0.4)',
              }}
            >
              <Inbox size={18} />
            </div>
            <span>ResolveX <span style={{ fontSize: '0.8rem', color: '#34d399', fontWeight: 600 }}>Client Portal</span></span>
          </Link>
        </div>

        {/* Center Nav Links */}
        <nav className="navbar-nav" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <NavLink
            to="/home"
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Home size={16} /> Home
          </NavLink>

          <NavLink
            to="/client/dashboard"
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Inbox size={16} /> My Dashboard
          </NavLink>

          <NavLink
            to="/organizations"
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Briefcase size={16} /> Organizations
          </NavLink>

          <NavLink
            to="/notifications"
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Bell size={16} /> Notifications
          </NavLink>

          {user?.is_platform_admin && (
            <NavLink
              to="/platform-admin/dashboard"
              className="nav-link"
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#818cf8' }}
            >
              <ShieldCheck size={16} /> Platform Admin
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
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div
                style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '50%',
                  background: 'var(--bg-surface-elevated)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#10b981',
                }}
              >
                <UserIcon size={15} />
              </div>
              <span
                style={{
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  maxWidth: '120px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {user?.full_name || 'Client'}
              </span>
              <ChevronDown size={13} style={{ opacity: 0.6 }} />
            </button>

            {userDropdownOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  right: 0,
                  width: '230px',
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
                  <span className="badge badge-verification-approved" style={{ marginTop: '0.35rem', fontSize: '0.7rem' }}>
                    Client Account
                  </span>
                </div>

                {user?.is_platform_admin && (
                  <button
                    onClick={() => {
                      setUserDropdownOpen(false)
                      navigate('/platform-admin/dashboard')
                    }}
                    className="btn-ghost btn-sm"
                    style={{ width: '100%', justifyContent: 'flex-start', padding: '0.6rem 1rem', color: '#a5b4fc' }}
                  >
                    <ShieldCheck size={15} /> Platform Admin
                  </button>
                )}

                <button
                  onClick={() => {
                    setUserDropdownOpen(false)
                    navigate('/notifications')
                  }}
                  className="btn-ghost btn-sm"
                  style={{ width: '100%', justifyContent: 'flex-start', padding: '0.6rem 1rem' }}
                >
                  <Inbox size={15} /> Notifications
                </button>

                <button
                  onClick={() => {
                    setUserDropdownOpen(false)
                    navigate('/profile')
                  }}
                  className="btn-ghost btn-sm"
                  style={{ width: '100%', justifyContent: 'flex-start', padding: '0.6rem 1rem' }}
                >
                  <UserIcon size={15} /> Profile
                </button>

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
