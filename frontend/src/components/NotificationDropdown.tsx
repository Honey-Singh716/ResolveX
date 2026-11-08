import React, { useEffect, useRef, useState } from 'react'
import {
  Bell,
  Building2,
  Calendar,
  Check,
  ExternalLink,
  Layers,
  MessageSquare,
  UserCheck,
  UserPlus,
  UserX,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { api } from '../services/api'
import type { AppNotification } from '../types/notification'
import { useOrg } from '../context/OrgContext'

// ---------------------------------------------------------------------------
// Design tokens
// ---------------------------------------------------------------------------
const D = {
  bg:       '#FFFCF8',
  surface:  '#F7F0E8',
  espresso: '#38251B',
  brown:    '#9A5B2E',
  caramel:  '#B77B45',
  border:   '#E9D9C9',
  muted:    '#A09080',
  shadow:   '0 8px 32px rgba(56,37,27,0.14), 0 2px 8px rgba(56,37,27,0.08)',
} as const

// ---------------------------------------------------------------------------
// Icon resolver — same title-first logic as NotificationsPage
// ---------------------------------------------------------------------------
type IconCfg = { icon: React.ReactNode; bg: string; color: string }

function resolveIcon(type: string, title: string): IconCfg {
  const t = title.toLowerCase()
  const ty = type.toLowerCase()
  if (t.includes('membership') || t.includes('join') || t.includes('member'))
    return { icon: <UserPlus size={18} />, bg: '#FBF0E8', color: '#8B4513' }
  if (t.includes('approved'))
    return { icon: <Building2 size={18} />, bg: '#E6F4EC', color: '#1e6e3e' }
  if (t.includes('rejected') || t.includes('suspended'))
    return { icon: <Building2 size={18} />, bg: '#FDE8E8', color: '#b91c1c' }
  if (t.includes('comment') || ty === 'comment_added')
    return { icon: <MessageSquare size={18} />, bg: '#F0EAF6', color: '#6d28d9' }
  if (ty === 'issue_assigned' || t.includes('assigned'))
    return { icon: <UserCheck size={18} />, bg: '#EAF3FB', color: '#24598a' }
  if (ty === 'issue_unassigned' || t.includes('unassigned'))
    return { icon: <UserX size={18} />, bg: '#FDE8E8', color: '#b91c1c' }
  if (ty === 'issue_status_changed' || t.includes('status') || t.includes('progress') || t.includes('resolved') || t.includes('closed'))
    return { icon: <Layers size={18} />, bg: '#FEF3C7', color: '#92400e' }
  return { icon: <Bell size={18} />, bg: '#F7EEE4', color: D.caramel }
}

// ---------------------------------------------------------------------------
// Escape-key hook
// ---------------------------------------------------------------------------
function useEscapeKey(callback: () => void) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') callback() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [callback])
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export const NotificationDropdown: React.FC = () => {
  const [isOpen, setIsOpen]           = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [isLoading, setIsLoading]     = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const navigate    = useNavigate()
  const { currentOrg } = useOrg()

  // Poll unread count every 30 s
  const loadUnreadCount = async () => {
    try {
      const res = await api.notifications.getUnreadCount()
      setUnreadCount(res.unread_count)
    } catch { /* silent */ }
  }

  const loadNotifications = async () => {
    try {
      setIsLoading(true)
      const res = await api.notifications.list(1, 5)
      setNotifications(res.notifications || [])
    } catch { /* silent */ }
    finally { setIsLoading(false) }
  }

  useEffect(() => {
    loadUnreadCount()
    const iv = setInterval(loadUnreadCount, 30_000)
    return () => clearInterval(iv)
  }, [])

  useEffect(() => {
    if (isOpen) { loadNotifications(); loadUnreadCount() }
  }, [isOpen])

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node))
        setIsOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Close on Escape
  useEscapeKey(() => setIsOpen(false))

  const handleItemClick = async (n: AppNotification) => {
    if (!n.is_read) {
      try {
        await api.notifications.markRead(n.id)
        setUnreadCount((c) => Math.max(0, c - 1))
        setNotifications((prev) => prev.map((x) => x.id === n.id ? { ...x, is_read: true } : x))
      } catch { /* continue navigation anyway */ }
    }
    setIsOpen(false)
    if (n.target_path)             navigate(n.target_path)
    else if (n.issue_id && currentOrg) navigate(`/org/${currentOrg.id}/issues/${n.issue_id}`)
    else                           navigate('/notifications')
  }

  const handleViewAll = () => { setIsOpen(false); navigate('/notifications') }

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      {/* ── Bell button ── */}
      <button
        onClick={() => setIsOpen((p) => !p)}
        aria-label="View notifications"
        aria-expanded={isOpen}
        style={{
          position: 'relative',
          background: isOpen ? D.surface : 'transparent',
          border: `1.5px solid ${isOpen ? D.border : 'transparent'}`,
          borderRadius: 99,
          width: 38, height: 38,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: D.espresso,
          transition: 'background 0.15s, border-color 0.15s',
        }}
        onMouseEnter={(e) => { if (!isOpen) (e.currentTarget as HTMLButtonElement).style.background = D.surface }}
        onMouseLeave={(e) => { if (!isOpen) (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
      >
        <Bell size={19} strokeWidth={2} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: 2, right: 2,
            minWidth: 16, height: 16, borderRadius: 99,
            background: '#D4622A', color: '#fff',
            fontSize: '0.6rem', fontWeight: 800,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 3px', lineHeight: 1, border: `2px solid ${D.bg}`,
          }}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* ── Dropdown panel ── */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Notifications"
          style={{
            position: 'absolute',
            top: 'calc(100% + 10px)',
            right: 0,
            width: 380,
            maxWidth: 'calc(100vw - 1.5rem)',
            background: D.bg,
            border: `1px solid ${D.border}`,
            borderRadius: 20,
            boxShadow: D.shadow,
            zIndex: 200,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            /* Caret arrow pointing up toward the bell */
            marginTop: 0,
          }}
        >
          {/* Small caret */}
          <div aria-hidden="true" style={{
            position: 'absolute', top: -7, right: 14,
            width: 14, height: 7,
            overflow: 'hidden',
          }}>
            <div style={{
              width: 14, height: 14,
              background: D.bg,
              border: `1px solid ${D.border}`,
              transform: 'rotate(45deg)',
              transformOrigin: 'bottom left',
              marginTop: 7,
              boxShadow: `-1px -1px 3px rgba(56,37,27,0.06)`,
            }} />
          </div>

          {/* ── Header ── */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '1rem 1.1rem 0.85rem',
            borderBottom: `1px solid ${D.border}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
              <Bell size={20} color={D.espresso} strokeWidth={2} />
              <span style={{ fontWeight: 700, fontSize: '1rem', color: D.espresso }}>
                Notifications
              </span>
            </div>
            {unreadCount > 0 && (
              <span style={{
                fontSize: '0.75rem', fontWeight: 700,
                padding: '0.2rem 0.7rem', borderRadius: 99,
                background: '#F7EEE4', color: D.brown,
                border: `1px solid #E8D0B4`,
              }}>
                {unreadCount} New
              </span>
            )}
          </div>

          {/* ── List ── */}
          <div style={{ overflowY: 'auto', maxHeight: 360 }}>
            {isLoading ? (
              <div style={{ padding: '2rem 1rem', textAlign: 'center', color: D.muted, fontSize: '0.85rem' }}>
                Loading…
              </div>
            ) : notifications.length === 0 ? (
              <div style={{ padding: '2.5rem 1rem', textAlign: 'center' }}>
                <div style={{
                  width: 48, height: 48, borderRadius: '50%',
                  background: '#F7EEE4', border: `1px solid ${D.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 0.75rem',
                }}>
                  <Bell size={22} color={D.caramel} />
                </div>
                <p style={{ fontWeight: 600, fontSize: '0.88rem', color: D.espresso, marginBottom: '0.25rem' }}>
                  No notifications yet
                </p>
                <p style={{ fontSize: '0.78rem', color: D.muted }}>
                  You're all caught up.
                </p>
              </div>
            ) : (
              notifications.map((n, idx) => {
                const cfg = resolveIcon(n.type, n.title)
                return (
                  <div
                    key={n.id}
                    onClick={() => handleItemClick(n)}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
                      padding: '0.9rem 1.1rem',
                      background: n.is_read ? 'transparent' : '#FFF8F2',
                      borderBottom: idx < notifications.length - 1 ? `1px solid ${D.border}` : 'none',
                      cursor: 'pointer',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#F7F0E8')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = n.is_read ? 'transparent' : '#FFF8F2')}
                  >
                    {/* Icon */}
                    <div style={{
                      width: 42, height: 42, borderRadius: 13, flexShrink: 0,
                      background: cfg.bg, color: cfg.color,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {cfg.icon}
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.875rem', color: D.espresso, marginBottom: '0.2rem' }}>
                        {n.title}
                      </div>
                      <div style={{
                        fontSize: '0.8rem', color: '#6B5548', lineHeight: 1.45,
                        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}>
                        {n.message}
                      </div>
                      <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                        fontSize: '0.72rem', color: D.muted, marginTop: '0.35rem',
                      }}>
                        <Calendar size={11} />
                        {new Date(n.created_at).toLocaleString()}
                      </div>
                    </div>

                    {/* Read indicator */}
                    <div style={{ flexShrink: 0, paddingTop: '0.15rem' }}>
                      {n.is_read ? (
                        <Check size={15} color={D.muted} strokeWidth={2} />
                      ) : (
                        <span style={{
                          width: 9, height: 9, borderRadius: '50%',
                          background: D.caramel, display: 'block',
                          boxShadow: `0 0 0 2px #FDECD8`,
                        }} />
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* ── Footer ── */}
          <div style={{ padding: '0.75rem 0.85rem', borderTop: `1px solid ${D.border}` }}>
            <button
              onClick={handleViewAll}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: '0.5rem', padding: '0.7rem',
                background: D.brown, color: '#FFFCF8',
                border: 'none', borderRadius: 12,
                fontWeight: 700, fontSize: '0.88rem',
                cursor: 'pointer', fontFamily: 'inherit',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = '#7A4520')}
              onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = D.brown)}
            >
              View all notifications <ExternalLink size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
