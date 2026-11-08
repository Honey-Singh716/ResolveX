import React, { useEffect, useRef, useState } from 'react'
import {
  Activity,
  BarChart3,
  Bell,
  Briefcase,
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  ShieldCheck,
  Users,
  User as UserIcon,
  AlertTriangle,
  X,
} from 'lucide-react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useOrg } from '../context/OrgContext'
import { NotificationDropdown } from './NotificationDropdown'
import { api } from '../services/api'

// ─── Admin design tokens ───────────────────────────────────────────────────
const A = {
  sidebar: '#2C1810',        // very dark warm brown sidebar
  sidebarHover: '#3D2215',   // slightly lighter on hover
  sidebarActive: '#5C2E14',  // active item highlight
  sidebarBorder: 'rgba(255,220,190,0.08)',
  sidebarText: '#F2E0CC',    // warm ivory text
  sidebarMuted: '#B08060',   // muted warm text
  sidebarAccent: '#E8A068',  // warm amber accent for badges/active
  topBar: '#FFFDF9',         // warm ivory top bar
  topBorder: '#E9DCCF',
  badge: '#89502E',
  badgeText: '#FFFDF9',
  heading: '#38251C',
  body: '#FAF6F0',
}

interface NavItem {
  icon: React.ReactNode
  label: string
  to: string
  badgeCount?: number
}

const navItems: NavItem[] = [
  { icon: <LayoutDashboard size={17} />, label: 'Governance Dashboard', to: '/platform-admin/dashboard' },
  { icon: <Building2 size={17} />, label: 'Organization Verification', to: '/platform-admin/dashboard?tab=queue' },
  { icon: <ShieldCheck size={17} />, label: 'Platform Administrators', to: '/platform-admin/dashboard?tab=admins' },
  { icon: <Building2 size={17} />, label: 'Organizations', to: '/platform-admin/dashboard?tab=orgs' },
  { icon: <Users size={17} />, label: 'Platform Users', to: '/platform-admin/dashboard?tab=users' },
  { icon: <AlertTriangle size={17} />, label: 'Platform Issues', to: '/platform-admin/dashboard?tab=issues' },
  { icon: <Activity size={17} />, label: 'Audit & Activity Logs', to: '/platform-admin/dashboard?tab=activity' },
  { icon: <Settings size={17} />, label: 'System Settings', to: '/platform-admin/dashboard?tab=settings' },
  { icon: <BarChart3 size={17} />, label: 'Platform Reports', to: '/platform-admin/dashboard?tab=reports' },
]

export const PlatformAdminLayout: React.FC = () => {
  const { user, logout } = useAuth()
  const { organizations } = useOrg()
  const [userDropdownOpen, setUserDropdownOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [pendingCount, setPendingCount] = useState<number>(0)
  const navigate = useNavigate()
  const dropdownRef = useRef<HTMLDivElement>(null)

  const approvedOrgs = organizations.filter(
    (o) => o.verification_status === 'approved' && ['owner', 'admin', 'manager', 'staff'].includes(o.role)
  )

  // Load pending org count for badge
  useEffect(() => {
    api.platform.getStats().then((s) => setPendingCount(s.pending_organizations)).catch(() => {})
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setUserDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/platform-admin/login')
  }

  const SIDEBAR_W = sidebarCollapsed ? 64 : 240

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: A.body, fontFamily: 'Inter, sans-serif' }}>

      {/* ── Mobile overlay ── */}
      {mobileSidebarOpen && (
        <div
          onClick={() => setMobileSidebarOpen(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(56,37,28,0.5)', zIndex: 99,
            display: 'none',
          }}
          className="mobile-overlay"
        />
      )}

      {/* ── Left Sidebar ── */}
      <aside
        style={{
          width: SIDEBAR_W,
          minWidth: SIDEBAR_W,
          background: A.sidebar,
          display: 'flex',
          flexDirection: 'column',
          transition: 'width 0.2s ease, min-width 0.2s ease',
          position: 'sticky',
          top: 0,
          height: '100vh',
          overflowY: 'auto',
          overflowX: 'hidden',
          zIndex: 50,
          flexShrink: 0,
        }}
      >
        {/* Brand */}
        <div
          style={{
            padding: sidebarCollapsed ? '1.25rem 0' : '1.25rem 1rem',
            borderBottom: `1px solid ${A.sidebarBorder}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: sidebarCollapsed ? 'center' : 'space-between',
            gap: '0.6rem',
            minHeight: 60,
          }}
        >
          {!sidebarCollapsed && (
            <Link
              to="/platform-admin/dashboard"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.55rem',
                textDecoration: 'none',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  background: '#89502E',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#FFFDF9',
                  flexShrink: 0,
                }}
              >
                <ShieldCheck size={16} />
              </div>
              <span
                style={{
                  fontWeight: 800,
                  fontSize: '0.95rem',
                  color: A.sidebarText,
                  letterSpacing: '-0.02em',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                ResolveX
              </span>
            </Link>
          )}
          {sidebarCollapsed && (
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: 8,
                background: '#89502E',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFFDF9',
              }}
            >
              <ShieldCheck size={16} />
            </div>
          )}
          <button
            onClick={() => setSidebarCollapsed((c) => !c)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: A.sidebarMuted,
              padding: '0.2rem',
              display: 'flex',
              alignItems: 'center',
              borderRadius: 6,
              flexShrink: 0,
            }}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
          </button>
        </div>

        {/* Section Label */}
        {!sidebarCollapsed && (
          <div
            style={{
              padding: '0.85rem 1rem 0.35rem',
              fontSize: '0.65rem',
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: A.sidebarMuted,
            }}
          >
            Platform Administration
          </div>
        )}

        {/* Nav Items */}
        <nav style={{ padding: sidebarCollapsed ? '0.5rem 0.5rem' : '0.35rem 0.6rem', flex: 1 }}>
          {navItems.map((item) => {
            const badge = item.label === 'Organization Verification' ? pendingCount : undefined
            return (
              <SidebarNavItem
                key={item.to}
                item={item}
                badge={badge}
                collapsed={sidebarCollapsed}
              />
            )
          })}
        </nav>

        {/* Divider + Staff Workspace */}
        {approvedOrgs.length > 0 && (
          <div style={{ padding: sidebarCollapsed ? '0.5rem' : '0.5rem 0.6rem', borderTop: `1px solid ${A.sidebarBorder}` }}>
            <button
              onClick={() => navigate('/organization/dashboard')}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: sidebarCollapsed ? 0 : '0.6rem',
                justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                padding: sidebarCollapsed ? '0.5rem' : '0.55rem 0.65rem',
                borderRadius: 8,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: A.sidebarMuted,
                fontSize: '0.82rem',
                fontWeight: 500,
                transition: 'background 0.15s, color 0.15s',
              }}
              title="Staff Workspace"
              onMouseEnter={(e) => {
                ;(e.currentTarget as HTMLButtonElement).style.background = A.sidebarHover
                ;(e.currentTarget as HTMLButtonElement).style.color = A.sidebarText
              }}
              onMouseLeave={(e) => {
                ;(e.currentTarget as HTMLButtonElement).style.background = 'none'
                ;(e.currentTarget as HTMLButtonElement).style.color = A.sidebarMuted
              }}
            >
              <Briefcase size={16} />
              {!sidebarCollapsed && <span>Staff Workspace</span>}
            </button>
          </div>
        )}

        {/* Institutional building illustration at bottom */}
        {!sidebarCollapsed && (
          <div
            style={{
              padding: '1rem',
              marginTop: 'auto',
              borderTop: `1px solid ${A.sidebarBorder}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <GovernanceIllustration />
          </div>
        )}
      </aside>

      {/* ── Right Column (Topbar + Content) ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'auto' }}>

        {/* ── Top Navigation Bar ── */}
        <header
          style={{
            background: A.topBar,
            borderBottom: `1px solid ${A.topBorder}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 1.5rem',
            height: 60,
            position: 'sticky',
            top: 0,
            zIndex: 40,
            gap: '1rem',
          }}
        >
          {/* Left: Mobile menu + breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              onClick={() => setMobileSidebarOpen((o) => !o)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: A.heading,
                padding: '0.25rem',
                display: 'none',
              }}
              className="mobile-menu-btn"
            >
              <Menu size={20} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span
                style={{
                  background: '#F1E5D8',
                  color: A.badge,
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  padding: '0.2rem 0.6rem',
                  borderRadius: 99,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                }}
              >
                Platform Governance
              </span>
            </div>
          </div>

          {/* Right: Notifications + Profile */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {/* Notification bell using existing component */}
            <NotificationDropdown />

            {/* SUPERADMIN badge */}
            <span
              style={{
                background: A.badge,
                color: '#FFFDF9',
                fontSize: '0.68rem',
                fontWeight: 800,
                padding: '0.22rem 0.65rem',
                borderRadius: 99,
                letterSpacing: '0.07em',
                textTransform: 'uppercase',
                display: 'none',
              }}
              className="superadmin-badge"
            >
              Superadmin
            </span>

            {/* User Dropdown */}
            <div style={{ position: 'relative' }} ref={dropdownRef}>
              <button
                onClick={() => setUserDropdownOpen((p) => !p)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  padding: '0.3rem 0.65rem 0.3rem 0.4rem',
                  borderRadius: 99,
                  border: `1px solid ${A.topBorder}`,
                  background: '#FAF6F0',
                  cursor: 'pointer',
                  color: A.heading,
                }}
              >
                <div
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: '50%',
                    background: '#F1E5D8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: A.badge,
                  }}
                >
                  <UserIcon size={14} />
                </div>
                <span style={{ fontSize: '0.83rem', fontWeight: 600, maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user?.full_name || 'Administrator'}
                </span>
                <ChevronDown size={13} style={{ opacity: 0.5 }} />
              </button>

              {userDropdownOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 6px)',
                    right: 0,
                    width: 240,
                    background: A.topBar,
                    border: `1px solid ${A.topBorder}`,
                    borderRadius: 12,
                    boxShadow: '0 8px 30px rgba(56,37,28,0.12)',
                    zIndex: 60,
                    overflow: 'hidden',
                    padding: '0.5rem 0',
                  }}
                >
                  <div style={{ padding: '0.6rem 1rem 0.5rem', borderBottom: `1px solid ${A.topBorder}` }}>
                    <div style={{ fontWeight: 700, fontSize: '0.88rem', color: A.heading }}>{user?.full_name}</div>
                    <div style={{ fontSize: '0.75rem', color: '#987D6C' }}>{user?.email}</div>
                    <span
                      style={{
                        display: 'inline-block',
                        marginTop: '0.3rem',
                        background: '#F1E5D8',
                        color: A.badge,
                        padding: '0.15rem 0.5rem',
                        borderRadius: 99,
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        letterSpacing: '0.04em',
                        textTransform: 'uppercase',
                      }}
                    >
                      Platform Administrator
                    </span>
                  </div>

                  {approvedOrgs.length > 0 && (
                    <button
                      onClick={() => { setUserDropdownOpen(false); navigate('/organization/dashboard') }}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.6rem 1rem',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#987D6C',
                        fontSize: '0.84rem',
                        textAlign: 'left',
                      }}
                    >
                      <Briefcase size={14} /> Staff Workspace
                    </button>
                  )}

                  <div style={{ height: 1, background: A.topBorder, margin: '0.25rem 0' }} />
                  <button
                    onClick={handleLogout}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.6rem 1rem',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#C04040',
                      fontSize: '0.84rem',
                      textAlign: 'left',
                    }}
                  >
                    <LogOut size={14} /> Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* ── Page Content ── */}
        <main style={{ flex: 1, padding: '2rem 2rem', background: A.body, maxWidth: '100%', overflow: 'auto' }}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}

// ─── Sidebar Nav Item ──────────────────────────────────────────────────────
interface SidebarNavItemProps {
  item: NavItem
  badge?: number
  collapsed: boolean
}

const SidebarNavItem: React.FC<SidebarNavItemProps> = ({ item, badge, collapsed }) => {
  const [hover, setHover] = useState(false)

  // For tab-based nav items (those with ?tab=), we use a button that updates URL
  const navigate = useNavigate()
  const isTabLink = item.to.includes('?tab=')

  if (isTabLink) {
    const tabValue = item.to.split('?tab=')[1]
    const isActive = typeof window !== 'undefined' && window.location.search.includes(`tab=${tabValue}`)

    return (
      <button
        onClick={() => navigate(item.to)}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        title={collapsed ? item.label : undefined}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: collapsed ? 0 : '0.6rem',
          justifyContent: collapsed ? 'center' : 'flex-start',
          padding: collapsed ? '0.55rem' : '0.55rem 0.65rem',
          borderRadius: 8,
          background: isActive ? A.sidebarActive : hover ? A.sidebarHover : 'none',
          border: 'none',
          cursor: 'pointer',
          color: isActive ? A.sidebarAccent : A.sidebarText,
          fontSize: '0.82rem',
          fontWeight: isActive ? 600 : 400,
          transition: 'background 0.15s, color 0.15s',
          marginBottom: 2,
          position: 'relative',
        }}
      >
        <span style={{ flexShrink: 0, opacity: isActive ? 1 : 0.75 }}>{item.icon}</span>
        {!collapsed && <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>}
        {!collapsed && badge !== undefined && badge > 0 && (
          <span
            style={{
              background: '#D97706',
              color: '#fff',
              fontSize: '0.65rem',
              fontWeight: 800,
              padding: '0.1rem 0.4rem',
              borderRadius: 99,
              flexShrink: 0,
            }}
          >
            {badge}
          </span>
        )}
        {collapsed && badge !== undefined && badge > 0 && (
          <span
            style={{
              position: 'absolute',
              top: 4,
              right: 4,
              background: '#D97706',
              width: 8,
              height: 8,
              borderRadius: '50%',
            }}
          />
        )}
      </button>
    )
  }

  return (
    <NavLink
      to={item.to}
      title={collapsed ? item.label : undefined}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={({ isActive }) => ({
        display: 'flex',
        alignItems: 'center',
        gap: collapsed ? 0 : '0.6rem',
        justifyContent: collapsed ? 'center' : 'flex-start',
        padding: collapsed ? '0.55rem' : '0.55rem 0.65rem',
        borderRadius: 8,
        background: isActive ? A.sidebarActive : hover ? A.sidebarHover : 'none',
        textDecoration: 'none',
        color: isActive ? A.sidebarAccent : A.sidebarText,
        fontSize: '0.82rem',
        fontWeight: isActive ? 600 : 400,
        transition: 'background 0.15s, color 0.15s',
        marginBottom: 2,
        position: 'relative',
      })}
    >
      {({ isActive }) => (
        <>
          <span style={{ flexShrink: 0, opacity: isActive ? 1 : 0.75 }}>{item.icon}</span>
          {!collapsed && (
            <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.label}
            </span>
          )}
          {!collapsed && badge !== undefined && badge > 0 && (
            <span
              style={{
                background: '#D97706',
                color: '#fff',
                fontSize: '0.65rem',
                fontWeight: 800,
                padding: '0.1rem 0.4rem',
                borderRadius: 99,
                flexShrink: 0,
              }}
            >
              {badge}
            </span>
          )}
          {collapsed && badge !== undefined && badge > 0 && (
            <span
              style={{
                position: 'absolute',
                top: 4,
                right: 4,
                background: '#D97706',
                width: 8,
                height: 8,
                borderRadius: '50%',
              }}
            />
          )}
        </>
      )}
    </NavLink>
  )
}

// ─── Governance Building Illustration (SVG) ────────────────────────────────
const GovernanceIllustration: React.FC = () => (
  <svg
    width="140"
    height="100"
    viewBox="0 0 140 100"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    {/* Sky */}
    <rect width="140" height="100" rx="8" fill="#3D2215" />

    {/* Ground */}
    <rect x="0" y="80" width="140" height="20" rx="0" fill="#2C1810" />

    {/* Main building body */}
    <rect x="30" y="35" width="80" height="47" fill="#5C3520" />

    {/* Columns */}
    {[38, 52, 66, 80, 94].map((x) => (
      <rect key={x} x={x} y="42" width="5" height="40" rx="2" fill="#7A4A2A" />
    ))}

    {/* Pediment (roof triangle) */}
    <polygon points="25,38 70,12 115,38" fill="#7A4A2A" />

    {/* Pediment inner */}
    <polygon points="35,38 70,18 105,38" fill="#6B3F28" />

    {/* Shield emblem on pediment */}
    <rect x="64" y="22" width="12" height="10" rx="2" fill="#E8A068" opacity="0.7" />

    {/* Entablature (horizontal beam) */}
    <rect x="25" y="36" width="90" height="6" rx="1" fill="#6B3F28" />

    {/* Door */}
    <rect x="62" y="60" width="16" height="22" rx="2" fill="#2C1810" />

    {/* Windows */}
    <rect x="38" y="50" width="8" height="8" rx="1" fill="#E8A068" opacity="0.45" />
    <rect x="94" y="50" width="8" height="8" rx="1" fill="#E8A068" opacity="0.45" />

    {/* Stars / subtle dots in sky */}
    <circle cx="15" cy="15" r="1" fill="#E8A068" opacity="0.5" />
    <circle cx="125" cy="10" r="1.2" fill="#E8A068" opacity="0.4" />
    <circle cx="120" cy="25" r="0.8" fill="#E8A068" opacity="0.35" />
    <circle cx="20" cy="30" r="0.8" fill="#E8A068" opacity="0.35" />
  </svg>
)
