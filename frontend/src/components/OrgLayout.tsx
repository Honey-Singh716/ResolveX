import React, { useState, useEffect } from 'react'
import {
  ArrowUpRight,
  Building2,
  CalendarX2,
  ChevronDown,
  Inbox,
  LayoutDashboard,
  Layers,
  LogOut,
  ShieldCheck,
  User as UserIcon,
  UserPlus,
  Users,
} from 'lucide-react'
import { NavLink, Outlet, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useOrg } from '../context/OrgContext'
import { NotificationDropdown } from './NotificationDropdown'

// ---------------------------------------------------------------------------
// Sidebar design tokens
// ---------------------------------------------------------------------------
const S = {
  bg:       '#3D1F0F',   // dark warm brown
  bgHover:  '#522A14',
  bgActive: '#6B3520',
  accent:   '#C38B5E',
  text:     '#F5E8DA',
  muted:    '#A88060',
  border:   'rgba(195,139,94,0.2)',
  logo:     '#E8C09A',
} as const

export const OrgLayout: React.FC = () => {
  const { user, logout } = useAuth()
  const { currentOrg, organizations, selectOrg, isLoading } = useOrg()
  const [orgDropdownOpen, setOrgDropdownOpen] = useState(false)
  const [userDropdownOpen, setUserDropdownOpen] = useState(false)
  const navigate = useNavigate()
  const { orgId: routeOrgId } = useParams<{ orgId: string }>()

  const approvedOrgs = organizations.filter(
    (o) => o.verification_status === 'approved' && ['owner', 'admin', 'manager', 'staff'].includes(o.role)
  )

  useEffect(() => {
    if (!isLoading && approvedOrgs.length > 0) {
      const routeOrg = routeOrgId ? approvedOrgs.find((o) => o.id === routeOrgId) : null
      if (routeOrg && currentOrg?.id !== routeOrg.id) {
        selectOrg(routeOrg.id)
      } else if (!routeOrgId && (!currentOrg || !approvedOrgs.some((o) => o.id === currentOrg.id))) {
        selectOrg(approvedOrgs[0].id)
      }
    }
  }, [currentOrg, approvedOrgs, isLoading, routeOrgId, selectOrg])

  const handleLogout = () => { logout(); navigate('/login') }

  const navLinkStyle = (isActive: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: '0.65rem',
    padding: '0.6rem 1rem',
    borderRadius: 10,
    fontSize: '0.88rem', fontWeight: 500,
    color: isActive ? S.text : S.muted,
    background: isActive ? S.bgActive : 'transparent',
    textDecoration: 'none',
    transition: 'background 0.15s, color 0.15s',
  })

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#FAF6F0' }}>

      {/* ── Sidebar ── */}
      <aside style={{
        width: 200,
        minWidth: 200,
        background: S.bg,
        display: 'flex',
        flexDirection: 'column',
        padding: '1rem 0.75rem',
        gap: '0.25rem',
        position: 'sticky',
        top: 0,
        height: '100vh',
        overflowY: 'auto',
      }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.25rem 0.25rem 1rem', borderBottom: `1px solid ${S.border}`, marginBottom: '0.5rem' }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: S.bgActive, display: 'flex', alignItems: 'center', justifyContent: 'center', color: S.logo, flexShrink: 0 }}>
            <svg viewBox="0 0 16 16" style={{ width: 16, height: 16, fill: 'currentColor' }}>
              <rect x="1" y="1" width="6" height="6" rx="1.4" />
              <rect x="9" y="1" width="6" height="6" rx="1.4" opacity="0.55" />
              <rect x="1" y="9" width="6" height="6" rx="1.4" opacity="0.55" />
              <rect x="9" y="9" width="6" height="6" rx="1.4" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: '0.88rem', fontWeight: 750, color: S.text, letterSpacing: '-0.01em' }}>ResolveX</div>
            <div style={{ fontSize: '0.62rem', color: S.muted, fontWeight: 500 }}>Staff Workspace</div>
          </div>
        </div>

        {/* Navigation */}
        {currentOrg && (
          <>
            <NavLink to="/organization/dashboard" style={({ isActive }) => navLinkStyle(isActive)}
              onMouseEnter={(e) => { if (!(e.currentTarget as HTMLElement).className.includes('active')) (e.currentTarget as HTMLElement).style.background = S.bgHover }}
              onMouseLeave={(e) => { if (!(e.currentTarget as HTMLElement).className.includes('active')) (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
              <LayoutDashboard size={16} /> Org Dashboard
            </NavLink>
            <NavLink to={`/org/${currentOrg.id}/issues`} style={({ isActive }) => navLinkStyle(isActive)}
              onMouseEnter={(e) => { if (!(e.currentTarget as HTMLElement).className.includes('active')) (e.currentTarget as HTMLElement).style.background = S.bgHover }}
              onMouseLeave={(e) => { if (!(e.currentTarget as HTMLElement).className.includes('active')) (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
              <Layers size={16} /> Issues Queue
            </NavLink>
            <NavLink to={`/org/${currentOrg.id}/members`} style={({ isActive }) => navLinkStyle(isActive)}
              onMouseEnter={(e) => { if (!(e.currentTarget as HTMLElement).className.includes('active')) (e.currentTarget as HTMLElement).style.background = S.bgHover }}
              onMouseLeave={(e) => { if (!(e.currentTarget as HTMLElement).className.includes('active')) (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
              <Users size={16} /> Team & Join Requests
            </NavLink>

            <div style={{ height: 1, background: S.border, margin: '0.5rem 0.25rem' }} />

            <NavLink to={`/org/${currentOrg.id}/members`} style={({ isActive }) => navLinkStyle(isActive)}
              onMouseEnter={(e) => { if (!(e.currentTarget as HTMLElement).className.includes('active')) (e.currentTarget as HTMLElement).style.background = S.bgHover }}
              onMouseLeave={(e) => { if (!(e.currentTarget as HTMLElement).className.includes('active')) (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
              <UserPlus size={16} /> Team Roster
            </NavLink>

            {/* Transfer Ownership & Schedule Archival — sidebar shortcuts */}
            <button
              onClick={() => navigate(`/organization/dashboard`)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', padding: '0.6rem 1rem', borderRadius: 10, fontSize: '0.88rem', fontWeight: 500, color: S.muted, background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', width: '100%', transition: 'background 0.15s' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = S.bgHover)}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <UserPlus size={16} /> Transfer Ownership
            </button>
            <button
              onClick={() => navigate(`/organization/dashboard`)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', padding: '0.6rem 1rem', borderRadius: 10, fontSize: '0.88rem', fontWeight: 500, color: S.muted, background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', width: '100%', transition: 'background 0.15s' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = S.bgHover)}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <CalendarX2 size={16} /> Schedule Archival
            </button>
          </>
        )}

        {/* Sidebar building illustration at bottom */}
        <div style={{ marginTop: 'auto', padding: '1rem 0.5rem 0', borderRadius: 12, overflow: 'hidden' }}>
          <img
            src="/portal/org-building-sidebar.png"
            alt=""
            aria-hidden="true"
            style={{ width: '100%', display: 'block', borderRadius: 10, opacity: 0.85 }}
          />
        </div>
      </aside>

      {/* ── Right side: navbar + content ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh', minWidth: 0 }}>

        {/* Top navbar */}
        <header style={{
          height: 64,
          background: '#FFFDF9',
          borderBottom: '1px solid #EAE1D7',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 1.5rem',
          position: 'sticky',
          top: 0,
          zIndex: 40,
        }}>
          {/* Org switcher */}
          <div style={{ position: 'relative' }}>
            {currentOrg && (
              <button
                onClick={() => setOrgDropdownOpen((p) => !p)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.35rem 0.85rem',
                  background: '#F7EEE4', border: '1px solid #EAE1D7',
                  borderRadius: 99, color: '#38251C',
                  fontWeight: 600, fontSize: '0.88rem',
                  cursor: 'pointer', fontFamily: 'inherit',
                  maxWidth: 280,
                }}
              >
                <Building2 size={15} color="#87502C" />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {currentOrg.name}
                </span>
                <ChevronDown size={13} color="#87502C" />
              </button>
            )}

            {orgDropdownOpen && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 8px)', left: 0,
                width: 280, background: '#FFFDF9',
                border: '1px solid #EAE1D7', borderRadius: 14,
                boxShadow: '0 8px 28px rgba(56,37,28,0.12)',
                zIndex: 60, overflow: 'hidden',
              }}
                onMouseLeave={() => setOrgDropdownOpen(false)}
              >
                <div style={{ padding: '0.5rem 0.8rem', fontSize: '0.7rem', color: '#A09080', fontWeight: 700, textTransform: 'uppercase', borderBottom: '1px solid #EAE1D7' }}>
                  Approved Workspaces
                </div>
                {approvedOrgs.map((org) => (
                  <div key={org.id} onClick={() => { selectOrg(org.id); setOrgDropdownOpen(false); navigate('/organization/dashboard') }}
                    style={{
                      padding: '0.65rem 0.85rem', display: 'flex', alignItems: 'center', gap: '0.6rem',
                      cursor: 'pointer',
                      background: org.id === currentOrg?.id ? '#F7EEE4' : 'transparent',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#F7EEE4')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = org.id === currentOrg?.id ? '#F7EEE4' : 'transparent')}
                  >
                    <Building2 size={14} color="#87502C" />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: '0.85rem', fontWeight: 600, color: '#38251C', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{org.name}</p>
                      <p style={{ fontSize: '0.7rem', color: '#A09080' }}>{org.role}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right tools */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            {/* Client Portal switch */}
            <button
              onClick={() => navigate('/client/dashboard')}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.38rem 0.85rem',
                background: '#FFFDF9', border: '1.5px solid #EAE1D7',
                borderRadius: 99, color: '#38251C',
                fontWeight: 600, fontSize: '0.82rem',
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Client Portal <ArrowUpRight size={13} />
            </button>

            <NotificationDropdown />

            {/* User dropdown */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setUserDropdownOpen((p) => !p)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.4rem',
                  padding: '0.28rem 0.55rem 0.28rem 0.28rem',
                  border: '1px solid #EAE1D7', borderRadius: 99,
                  background: '#FFFDF9', color: '#38251C',
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                <span style={{ width: 28, height: 28, borderRadius: '50%', background: '#F4EBE3', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#87502C' }}>
                  <UserIcon size={14} />
                </span>
                <span style={{ fontSize: '0.84rem', fontWeight: 600, maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.full_name}</span>
                <ChevronDown size={12} color="#87502C" />
              </button>

              {userDropdownOpen && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                  width: 220, background: '#FFFDF9',
                  border: '1px solid #EAE1D7', borderRadius: 12,
                  boxShadow: '0 8px 24px rgba(56,37,28,0.1)',
                  zIndex: 60, padding: '0.4rem 0',
                }}>
                  <div style={{ padding: '0.5rem 0.85rem 0.65rem', borderBottom: '1px solid #EAE1D7' }}>
                    <p style={{ fontWeight: 600, fontSize: '0.86rem', color: '#38251C' }}>{user?.full_name}</p>
                    <p style={{ fontSize: '0.74rem', color: '#A09080' }}>{user?.email}</p>
                  </div>
                  {[
                    { label: 'Client Portal', icon: <Inbox size={14} />, action: () => navigate('/client/dashboard'), color: '#38251C' },
                    ...(user?.is_platform_admin ? [{ label: 'Platform Admin', icon: <ShieldCheck size={14} />, action: () => navigate('/platform-admin/dashboard'), color: '#38251C' }] : []),
                    { label: 'Sign Out', icon: <LogOut size={14} />, action: handleLogout, color: '#8d3b34' },
                  ].map((item, i) => (
                    <button key={i} onClick={() => { setUserDropdownOpen(false); item.action() }}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', width: '100%', padding: '0.55rem 0.85rem', background: 'transparent', border: 'none', color: item.color, fontSize: '0.84rem', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#F4EBE3')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      {item.icon} {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, padding: '1.75rem 1.5rem', background: '#FAF6F0', overflowY: 'auto' }}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
