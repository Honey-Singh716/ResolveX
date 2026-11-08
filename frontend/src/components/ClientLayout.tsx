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
    <div className="app-shell rx-client">
      <header className="navbar">
        <Link to="/home" className="rx-client-brand">
          <span className="rx-client-mark" aria-hidden="true">
            <svg viewBox="0 0 16 16">
              <rect x="1" y="1" width="6" height="6" rx="1.4" />
              <rect x="9" y="1" width="6" height="6" rx="1.4" opacity="0.55" />
              <rect x="1" y="9" width="6" height="6" rx="1.4" opacity="0.55" />
              <rect x="9" y="9" width="6" height="6" rx="1.4" />
            </svg>
          </span>
          ResolveX <span className="rx-client-label">Client Portal</span>
        </Link>

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
            >
              <ShieldCheck size={16} /> Platform Admin
            </NavLink>
          )}
        </nav>

        <div className="rx-client-tools">
          <NotificationDropdown />

          {/* User Menu */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setUserDropdownOpen((prev) => !prev)}
              className="rx-user-btn"
              aria-expanded={userDropdownOpen}
              aria-haspopup="menu"
            >
              <span className="rx-user-avatar">
                <UserIcon size={15} />
              </span>
              <span className="rx-user-name">{user?.full_name || 'Client'}</span>
              <ChevronDown size={13} aria-hidden="true" />
            </button>

            {userDropdownOpen && (
              <div className="rx-user-menu" role="menu">
                <div className="rx-user-meta">
                  <strong>{user?.full_name}</strong>
                  <span>{user?.email}</span>
                </div>

                {user?.is_platform_admin && (
                  <button
                    type="button"
                    onClick={() => {
                      setUserDropdownOpen(false)
                      navigate('/platform-admin/dashboard')
                    }}
                  >
                    <ShieldCheck size={15} /> Platform Admin
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setUserDropdownOpen(false)
                    navigate('/notifications')
                  }}
                >
                  <Inbox size={15} /> Notifications
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setUserDropdownOpen(false)
                    navigate('/profile')
                  }}
                >
                  <UserIcon size={15} /> Profile
                </button>

                <button type="button" className="rx-signout" onClick={handleLogout}>
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
