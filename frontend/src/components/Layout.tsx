import React, { useState } from 'react'
import { Building2, ChevronDown, Layers, LogOut, Menu, Plus, ShieldCheck, User as UserIcon, Users, X } from 'lucide-react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useOrg } from '../context/OrgContext'
import { NotificationDropdown } from './NotificationDropdown'
import { RoleBadge } from './StatusBadge'

export const Layout: React.FC = () => {
  const { user, logout } = useAuth()
  const { currentOrg, organizations, selectOrg } = useOrg()
  const [orgDropdownOpen, setOrgDropdownOpen] = useState(false)
  const [userDropdownOpen, setUserDropdownOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="app-shell">
      <header className="navbar">
        {/* Brand & Org Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <Link to={currentOrg ? `/org/${currentOrg.id}/issues` : '/organizations'} className="navbar-brand">
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontWeight: 800,
                fontSize: '1.1rem',
                boxShadow: '0 2px 10px rgba(99, 102, 241, 0.4)',
              }}
            >
              R
            </div>
            <span>ResolveX</span>
          </Link>

          {/* Org Selector Dropdown */}
          {currentOrg && (
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setOrgDropdownOpen((prev) => !prev)}
                className="btn-secondary btn-sm"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  maxWidth: '220px',
                  fontWeight: 600,
                }}
              >
                <Building2 size={15} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                <span
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {currentOrg.name}
                </span>
                <ChevronDown size={14} style={{ opacity: 0.7 }} />
              </button>

              {orgDropdownOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 6px)',
                    left: 0,
                    width: '260px',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-medium)',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: 'var(--shadow-lg)',
                    zIndex: 60,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      padding: '0.6rem 0.8rem',
                      fontSize: '0.75rem',
                      color: 'var(--text-muted)',
                      textTransform: 'uppercase',
                      fontWeight: 600,
                      borderBottom: '1px solid var(--border-subtle)',
                    }}
                  >
                    Your Organizations
                  </div>
                  <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                    {organizations.map((org) => (
                      <div
                        key={org.id}
                        onClick={() => {
                          selectOrg(org.id)
                          setOrgDropdownOpen(false)
                          navigate(`/org/${org.id}/issues`)
                        }}
                        style={{
                          padding: '0.65rem 0.85rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          cursor: 'pointer',
                          background:
                            org.id === currentOrg.id ? 'var(--primary-subtle)' : 'transparent',
                          transition: 'background var(--transition-fast)',
                        }}
                        onMouseEnter={(e) => {
                          if (org.id !== currentOrg.id) {
                            e.currentTarget.style.background = 'var(--bg-surface-hover)'
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (org.id !== currentOrg.id) {
                            e.currentTarget.style.background = 'transparent'
                          }
                        }}
                      >
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>{org.name}</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            {org.slug}
                          </div>
                        </div>
                        <RoleBadge role={org.role} />
                      </div>
                    ))}
                  </div>
                  <div
                    style={{
                      borderTop: '1px solid var(--border-subtle)',
                      padding: '0.4rem',
                    }}
                  >
                    <button
                      onClick={() => {
                        setOrgDropdownOpen(false)
                        navigate('/organizations')
                      }}
                      className="btn-ghost btn-sm"
                      style={{ width: '100%', justifyContent: 'flex-start', gap: '0.5rem' }}
                    >
                      <Plus size={14} /> New / Manage Orgs
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Center Nav Links (Desktop) */}
        {currentOrg && (
          <nav className="navbar-nav" style={{ display: 'flex' }}>
            <NavLink
              to={`/org/${currentOrg.id}/issues`}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <Layers size={16} /> Issues
            </NavLink>
            <NavLink
              to={`/org/${currentOrg.id}/members`}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <Users size={16} /> Members
            </NavLink>
            {user?.is_platform_admin && (
              <NavLink
                to="/platform"
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#818cf8' }}
              >
                <ShieldCheck size={16} /> Platform Admin
              </NavLink>
            )}
          </nav>
        )}

        {/* Right Tools (Notifications, User Profile, Mobile Menu) */}
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
              aria-label="User menu"
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
                  color: 'var(--primary)',
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
                {user?.full_name || 'Account'}
              </span>
              <ChevronDown size={13} style={{ opacity: 0.6 }} />
            </button>

            {userDropdownOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  right: 0,
                  width: '220px',
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
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {user?.email}
                  </div>
                </div>
                <button
                  onClick={() => {
                    setUserDropdownOpen(false)
                    navigate('/organizations')
                  }}
                  className="btn-ghost btn-sm"
                  style={{ width: '100%', justifyContent: 'flex-start', padding: '0.6rem 1rem' }}
                >
                  <Building2 size={15} /> Switch Organization
                </button>
                <button
                  onClick={() => {
                    setUserDropdownOpen(false)
                    navigate('/notifications')
                  }}
                  className="btn-ghost btn-sm"
                  style={{ width: '100%', justifyContent: 'flex-start', padding: '0.6rem 1rem' }}
                >
                  <NotificationDropdown /> All Notifications
                </button>
                {user?.is_platform_admin && (
                  <button
                    onClick={() => {
                      setUserDropdownOpen(false)
                      navigate('/platform')
                    }}
                    className="btn-ghost btn-sm"
                    style={{
                      width: '100%',
                      justifyContent: 'flex-start',
                      padding: '0.6rem 1rem',
                      color: '#818cf8',
                      fontWeight: 600,
                    }}
                  >
                    <ShieldCheck size={15} /> Platform Admin
                  </button>
                )}
                <div style={{ borderTop: '1px solid var(--border-subtle)', margin: '0.25rem 0' }} />
                <button
                  onClick={handleLogout}
                  className="btn-ghost btn-sm"
                  style={{
                    width: '100%',
                    justifyContent: 'flex-start',
                    padding: '0.6rem 1rem',
                    color: '#f87171',
                  }}
                >
                  <LogOut size={15} /> Sign Out
                </button>
              </div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="btn-icon btn-ghost"
            style={{ display: 'none' }}
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  )
}
