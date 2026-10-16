import React, { useState, useEffect } from 'react'
import {
  Building2,
  ChevronDown,
  Layers,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  User as UserIcon,
  Users,
  Inbox,
  Briefcase,
} from 'lucide-react'
import { Link, NavLink, Outlet, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useOrg } from '../context/OrgContext'
import { NotificationDropdown } from './NotificationDropdown'
import { RoleBadge } from './StatusBadge'

export const OrgLayout: React.FC = () => {
  const { user, logout } = useAuth()
  const { currentOrg, organizations, selectOrg, isLoading } = useOrg()
  const [orgDropdownOpen, setOrgDropdownOpen] = useState(false)
  const [userDropdownOpen, setUserDropdownOpen] = useState(false)
  const navigate = useNavigate()
  const { orgId: routeOrgId } = useParams<{ orgId: string }>()

  // Filter approved organizations where user is staff/manager/admin/owner
  const approvedOrgs = organizations.filter(
    (o) => o.verification_status === 'approved' && ['owner', 'admin', 'manager', 'staff'].includes(o.role)
  )

  useEffect(() => {
    // Direct tenant URLs must update the selected tenant before rendering its shell.
    if (!isLoading && approvedOrgs.length > 0) {
      const routeOrg = routeOrgId ? approvedOrgs.find((org) => org.id === routeOrgId) : null
      if (routeOrg && currentOrg?.id !== routeOrg.id) {
        selectOrg(routeOrg.id)
      } else if (!routeOrgId && (!currentOrg || currentOrg.verification_status !== 'approved' || !approvedOrgs.some((org) => org.id === currentOrg.id))) {
        selectOrg(approvedOrgs[0].id)
      }
    }
  }, [currentOrg, approvedOrgs, isLoading, routeOrgId, selectOrg])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const handleOrgSwitch = (orgId: string) => {
    selectOrg(orgId)
    setOrgDropdownOpen(false)
    navigate('/organization/dashboard')
  }

  return (
    <div className="app-shell">
      <header className="navbar" style={{ borderBottom: '1px solid rgba(99, 102, 241, 0.25)' }}>
        {/* Brand & Org Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <Link
            to="/organization/dashboard"
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
              <Briefcase size={17} />
            </div>
            <span>
              ResolveX <span style={{ fontSize: '0.8rem', color: '#818cf8', fontWeight: 600 }}>Staff Workspace</span>
            </span>
          </Link>

          {/* Org Selector Dropdown */}
          {currentOrg && (
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setOrgDropdownOpen((prev) => !prev)}
                className="btn btn-secondary btn-sm"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  maxWidth: '220px',
                  fontWeight: 600,
                  border: '1px solid var(--border-medium)',
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
                    width: '270px',
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
                    Approved Workspaces
                  </div>
                  <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                    {approvedOrgs.map((org) => (
                      <div
                        key={org.id}
                        onClick={() => handleOrgSwitch(org.id)}
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
                        navigate('/client/dashboard')
                      }}
                      className="btn-ghost btn-sm"
                      style={{ width: '100%', justifyContent: 'flex-start', gap: '0.5rem', color: '#34d399' }}
                    >
                      <Inbox size={14} /> Back to Client Portal
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Center Nav Links (Desktop) */}
        {currentOrg && (
          <nav className="navbar-nav" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <NavLink
              to="/organization/dashboard"
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <LayoutDashboard size={16} /> Org Dashboard
            </NavLink>
            <NavLink
              to={`/org/${currentOrg.id}/issues`}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <Layers size={16} /> Issues Queue
            </NavLink>
            <NavLink
              to={`/org/${currentOrg.id}/members`}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <Users size={16} /> Team & Join Requests
            </NavLink>
          </nav>
        )}

        {/* Right Tools */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {/* Quick Switch to Client Portal */}
          <button
            onClick={() => navigate('/client/dashboard')}
            className="btn btn-secondary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', border: '1px solid rgba(16, 185, 129, 0.4)' }}
            title="Switch back to Client Portal"
          >
            <Inbox size={14} style={{ color: '#34d399' }} /> Client Portal
          </button>

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
                {user?.full_name}
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
                  {currentOrg && (
                    <div style={{ marginTop: '0.35rem' }}>
                      <RoleBadge role={currentOrg.role} />
                    </div>
                  )}
                </div>

                <button
                  onClick={() => {
                    setUserDropdownOpen(false)
                    navigate('/client/dashboard')
                  }}
                  className="btn-ghost btn-sm"
                  style={{ width: '100%', justifyContent: 'flex-start', padding: '0.6rem 1rem', color: '#34d399' }}
                >
                  <Inbox size={15} /> Client Portal
                </button>

                {user?.is_platform_admin && (
                  <button
                    onClick={() => {
                      setUserDropdownOpen(false)
                      navigate('/platform-admin/dashboard')
                    }}
                    className="btn-ghost btn-sm"
                    style={{ width: '100%', justifyContent: 'flex-start', padding: '0.6rem 1rem', color: '#818cf8' }}
                  >
                    <ShieldCheck size={15} /> Platform Admin
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
