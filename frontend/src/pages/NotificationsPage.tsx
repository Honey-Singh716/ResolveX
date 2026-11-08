import React, { useEffect, useState } from 'react'
import {
  Bell,
  Building2,
  Check,
  CheckCheck,
  ChevronRight,
  Layers,
  MessageSquare,
  UserCheck,
  UserPlus,
  UserX,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { ErrorAlert } from '../components/ErrorAlert'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { useOrg } from '../context/OrgContext'
import { api } from '../services/api'
import type { AppNotification } from '../types/notification'

// ---------------------------------------------------------------------------
// Design tokens
// ---------------------------------------------------------------------------
const T = {
  bg:       '#FAF6F0',
  surface:  '#FFFCF8',
  cream:    '#F7EEE4',
  beige:    '#EEDFCC',
  primary:  '#754323',
  caramel:  '#B77B45',
  espresso: '#302018',
  secondary:'#78675C',
  border:   '#E8D9CA',
  shadow:   '0 2px 16px rgba(48,32,24,0.07)',
  shadowSm: '0 1px 6px rgba(48,32,24,0.05)',
} as const

// ---------------------------------------------------------------------------
// Notification type + title → icon + colour config
// ---------------------------------------------------------------------------
type IconConfig = { icon: React.ReactNode; bg: string; color: string }

function getIconConfig(type: string, title: string): IconConfig {
  const t = title.toLowerCase()
  const ty = type.toLowerCase()

  if (t.includes('membership') || t.includes('join') || t.includes('member request'))
    return { icon: <UserPlus size={20} />, bg: '#FBF0E8', color: '#8B4513' }
  if (t.includes('approved') || t.includes('organization approved'))
    return { icon: <Building2 size={20} />, bg: '#E6F4EC', color: '#1e6e3e' }
  if (t.includes('rejected') || t.includes('suspended'))
    return { icon: <Building2 size={20} />, bg: '#FDE8E8', color: '#b91c1c' }
  if (t.includes('comment') || ty === 'comment_added')
    return { icon: <MessageSquare size={20} />, bg: '#F0EAF6', color: '#6d28d9' }
  if (ty === 'issue_assigned' || t.includes('assigned'))
    return { icon: <UserCheck size={20} />, bg: '#EAF3FB', color: '#24598a' }
  if (ty === 'issue_unassigned' || t.includes('unassigned'))
    return { icon: <UserX size={20} />, bg: '#FDE8E8', color: '#b91c1c' }
  if (ty === 'issue_status_changed' || t.includes('status') || t.includes('progress') || t.includes('resolved') || t.includes('closed'))
    return { icon: <Layers size={20} />, bg: '#F7EEE4', color: '#92400e' }
  return { icon: <Bell size={20} />, bg: '#F7EEE4', color: T.caramel }
}

function getCategoryLabel(type: string, title: string): string {
  const t = title.toLowerCase()
  const ty = type.toLowerCase()

  if (t.includes('membership') || t.includes('join') || t.includes('member'))  return 'Membership'
  if (t.includes('approved'))                                                    return 'Organization'
  if (t.includes('rejected') || t.includes('suspended'))                        return 'Organization'
  if (t.includes('comment') || ty === 'comment_added')                          return 'Comment'
  if (ty === 'issue_assigned' || t.includes('assigned'))                        return 'Assignment'
  if (ty === 'issue_unassigned')                                                 return 'Assignment'
  if (ty === 'issue_status_changed')                                             return 'Status Update'
  return 'Notification'
}

function getCategoryStyle(type: string, title: string): { bg: string; color: string; border: string } {
  const label = getCategoryLabel(type, title)
  if (label === 'Membership')    return { bg: '#FBF0E8', color: '#8B4513',  border: '#E8C898' }
  if (label === 'Organization') {
    const t = title.toLowerCase()
    return t.includes('approved')
      ? { bg: '#E6F4EC', color: '#1e6e3e', border: '#a8d9b8' }
      : { bg: '#FDE8E8', color: '#b91c1c', border: '#fca5a5' }
  }
  if (label === 'Comment')       return { bg: '#F0EAF6', color: '#6d28d9',  border: '#d8b4fe' }
  if (label === 'Assignment')    return { bg: '#EAF3FB', color: '#24598a',  border: '#b3d4f5' }
  if (label === 'Status Update') return { bg: '#FEF3C7', color: '#92400e',  border: '#fcd34d' }
  return { bg: T.cream, color: T.caramel, border: T.beige }
}

// ---------------------------------------------------------------------------
// Hero bell + envelope + checklist illustration (inline SVG)
// ---------------------------------------------------------------------------
function NotifIllustration() {
  return (
    <svg viewBox="0 0 320 200" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', maxWidth: 320, height: 'auto' }} aria-hidden="true">
      {/* Envelope */}
      <rect x="178" y="60" width="120" height="84" rx="8" fill="#F5E6D0" stroke="#D4A870" strokeWidth="1.5" />
      <polyline points="178,64 238,112 298,64" fill="none" stroke="#D4A870" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* Envelope shadow */}
      <rect x="184" y="150" width="108" height="6" rx="3" fill="rgba(180,120,60,0.15)" />

      {/* Checklist paper */}
      <rect x="200" y="40" width="88" height="108" rx="6" fill="#FFFCF8" stroke="#E8D9CA" strokeWidth="1.2" />
      <rect x="200" y="40" width="88" height="14" rx="6" fill="#F0E4D4" />
      <rect x="200" y="48" width="88" height="6" rx="0" fill="#F0E4D4" />
      {/* Check lines */}
      {[0,1,2,3].map((i) => (
        <React.Fragment key={i}>
          <circle cx="214" cy={72 + i*20} r="4" fill="#E8D9CA" />
          <polyline points={`211,${72+i*20} 213,${74+i*20} 217,${70+i*20}`} fill="none" stroke="#754323" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="222" cy={72+i*20-3} y={69+i*20} width="52" height="6" rx="3" fill="#F0E4D0" />
        </React.Fragment>
      ))}

      {/* Bell body */}
      <ellipse cx="118" cy="145" rx="52" ry="10" fill="rgba(180,120,60,0.2)" />
      {/* Bell dome */}
      <path d="M82,138 Q82,88 118,82 Q154,88 154,138 Z" fill="#D4902A" />
      <path d="M86,138 Q86,96 118,90 Q150,96 150,138 Z" fill="#E8A840" />
      {/* Bell shine */}
      <ellipse cx="104" cy="104" rx="8" ry="14" fill="rgba(255,255,255,0.18)" transform="rotate(-20 104 104)" />
      {/* Bell top knob */}
      <rect x="113" y="74" width="10" height="10" rx="5" fill="#C07820" />
      <rect x="115" y="66" width="6" height="10" rx="3" fill="#C07820" />
      {/* Bell clapper */}
      <line x1="118" y1="138" x2="118" y2="150" stroke="#C07820" strokeWidth="3" strokeLinecap="round" />
      <circle cx="118" cy="152" r="6" fill="#C07820" />
      {/* Bell base bar */}
      <rect x="80" y="136" width="76" height="6" rx="3" fill="#C07820" />
      {/* Vibration lines */}
      <path d="M68,105 Q62,115 68,125" fill="none" stroke="#D4A050" strokeWidth="2.5" strokeLinecap="round" opacity="0.7" />
      <path d="M60,98 Q52,114 60,130" fill="none" stroke="#D4A050" strokeWidth="2" strokeLinecap="round" opacity="0.45" />
      <path d="M168,105 Q174,115 168,125" fill="none" stroke="#D4A050" strokeWidth="2.5" strokeLinecap="round" opacity="0.7" />
      <path d="M176,98 Q184,114 176,130" fill="none" stroke="#D4A050" strokeWidth="2" strokeLinecap="round" opacity="0.45" />

      {/* Notification dot on bell */}
      <circle cx="148" cy="86" r="10" fill="#E53E3E" />
      <text x="148" y="90" textAnchor="middle" fontSize="10" fontWeight="bold" fill="white">!</text>
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export const NotificationsPage: React.FC = () => {
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all')
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 20
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const navigate = useNavigate()
  const { currentOrg } = useOrg()

  const filterRead = filter === 'unread' ? false : filter === 'read' ? true : undefined

  const loadData = async () => {
    try {
      setIsLoading(true); setError(null)
      const [listRes, countRes] = await Promise.all([
        api.notifications.list(page, PAGE_SIZE, filterRead),
        api.notifications.getUnreadCount(),
      ])
      setNotifications(listRes.notifications || [])
      setTotal(listRes.total)
      setUnreadCount(countRes.unread_count)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load notifications.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { loadData() }, [page, filter])

  const handleMarkRead = async (id: string) => {
    try {
      await api.notifications.markRead(id)
      setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n))
      setUnreadCount((c) => Math.max(0, c - 1))
    } catch { /* ignore */ }
  }

  const handleMarkAllRead = async () => {
    try {
      await api.notifications.markAllRead()
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
      setUnreadCount(0)
    } catch { /* ignore */ }
  }

  const handleNavigate = (n: AppNotification) => {
    if (!n.is_read) handleMarkRead(n.id)
    if (n.target_path) navigate(n.target_path)
    else if (n.issue_id && currentOrg) navigate(`/org/${currentOrg.id}/issues/${n.issue_id}`)
  }

  // Counts for filter pills
  const allCount = total
  const unreadTotal = unreadCount
  const readTotal = Math.max(0, total - unreadCount)

  const filterOptions = [
    { key: 'all'    as const, icon: <Layers size={14} />, label: 'All',         count: allCount    },
    { key: 'unread' as const, icon: <Bell   size={14} />, label: 'Unread Only', count: unreadTotal },
    { key: 'read'   as const, icon: <Check  size={14} />, label: 'Read',        count: readTotal   },
  ]

  return (
    <div
      className="notif-page"
      style={{ background: T.bg, margin: '-2rem -1.5rem', padding: '0 1.5rem 4rem', minHeight: 'calc(100vh - 68px)', boxSizing: 'border-box' }}
    >
      <div style={{ maxWidth: 900, margin: '0 auto' }}>

        {/* ================================================================
            HERO
        ================================================================ */}
        <div style={{
          position: 'relative', overflow: 'hidden', borderRadius: 20,
          background: 'linear-gradient(115deg, #F7EEE4 0%, #F0E2CF 45%, #EDD4B4 100%)',
          border: `1px solid ${T.border}`,
          margin: '1.75rem 0 1.75rem',
          boxShadow: T.shadow,
          display: 'grid',
          gridTemplateColumns: 'minmax(0,1fr) minmax(180px,320px)',
          minHeight: 200,
        }} className="notif-hero-grid">
          {/* Left */}
          <div style={{ padding: '2rem 2rem 1.75rem', display: 'flex', flexDirection: 'column', justifyContent: 'center', position: 'relative', zIndex: 2 }}>
            <span style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.primary, marginBottom: '0.65rem', display: 'block' }}>
              NOTIFICATIONS
            </span>
            <h1 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.2rem)', fontWeight: 800, color: T.espresso, lineHeight: 1.15, letterSpacing: '-0.025em', marginBottom: '0.5rem', fontFamily: 'Georgia, serif' }}>
              Notification Center
            </h1>
            <p style={{ color: T.secondary, fontSize: '0.88rem', lineHeight: 1.55, marginBottom: '1.5rem', maxWidth: '32rem' }}>
              In-app alerts for assignments, status progressions, and comment discussions.
            </p>

            {/* Filter pills */}
            <div style={{ display: 'flex', gap: '0.55rem', flexWrap: 'wrap' }}>
              {filterOptions.map((f) => {
                const isActive = filter === f.key
                return (
                  <button
                    key={f.key}
                    onClick={() => { setFilter(f.key); setPage(1) }}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                      padding: '0.45rem 1rem',
                      background: isActive ? T.primary : T.surface,
                      color: isActive ? '#FFFCF8' : T.espresso,
                      border: isActive ? `1px solid ${T.primary}` : `1.5px solid ${T.border}`,
                      borderRadius: 99, fontWeight: 700, fontSize: '0.83rem',
                      cursor: 'pointer', fontFamily: 'inherit',
                      boxShadow: isActive ? '0 2px 8px rgba(117,67,35,0.25)' : T.shadowSm,
                      transition: 'all 0.15s',
                    }}
                  >
                    {f.icon}
                    {f.label}
                    {f.count > 0 && (
                      <span style={{
                        minWidth: 18, height: 18, borderRadius: 99, padding: '0 4px',
                        background: isActive ? 'rgba(255,252,248,0.25)' : T.cream,
                        color: isActive ? '#FFFCF8' : T.primary,
                        fontSize: '0.68rem', fontWeight: 800,
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {f.count}
                      </span>
                    )}
                  </button>
                )
              })}

              {/* Mark all read */}
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                    padding: '0.45rem 1rem',
                    background: 'transparent', color: T.secondary,
                    border: `1.5px solid ${T.border}`, borderRadius: 99,
                    fontWeight: 600, fontSize: '0.82rem',
                    cursor: 'pointer', fontFamily: 'inherit',
                    marginLeft: '0.25rem',
                  }}
                >
                  <CheckCheck size={13} /> Mark All Read
                </button>
              )}
            </div>
          </div>

          {/* Right: illustration */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem 1.25rem 0', position: 'relative', zIndex: 2 }} className="notif-hero-illo">
            <NotifIllustration />
          </div>

          {/* Curved wave background shape */}
          <svg viewBox="0 0 600 200" xmlns="http://www.w3.org/2000/svg" style={{ position: 'absolute', right: 0, bottom: 0, width: '65%', height: '100%', opacity: 0.35, pointerEvents: 'none', zIndex: 1 }} aria-hidden="true">
            <path d="M600,0 Q400,100 600,200 Z" fill="#E8C898" />
            <path d="M600,40 Q450,110 600,180 Z" fill="#DDB870" opacity="0.5" />
          </svg>
        </div>

        <ErrorAlert message={error} onDismiss={() => setError(null)} />

        {/* ================================================================
            NOTIFICATION LIST
        ================================================================ */}
        {isLoading ? (
          <LoadingSpinner label="Loading notifications…" />
        ) : notifications.length === 0 ? (
          /* Empty state */
          <div style={{ textAlign: 'center', padding: '4rem 2rem', background: T.surface, border: `1px solid ${T.border}`, borderRadius: 20, boxShadow: T.shadowSm }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: T.cream, border: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.1rem' }}>
              <Bell size={28} color={T.caramel} />
            </div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: T.espresso, marginBottom: '0.4rem' }}>No notifications yet</h3>
            <p style={{ color: T.secondary, fontSize: '0.85rem', maxWidth: 340, margin: '0 auto' }}>
              {filter === 'unread'
                ? "You're all caught up — no unread notifications."
                : filter === 'read'
                ? 'No read notifications found.'
                : "You're all caught up. New updates will appear here."}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {notifications.map((n) => {
              const cfg = getIconConfig(n.type, n.title)
              const cat = getCategoryLabel(n.type, n.title)
              const catStyle = getCategoryStyle(n.type, n.title)
              const isNavigable = !!(n.target_path || n.issue_id)

              return (
                <div
                  key={n.id}
                  onClick={() => isNavigable && handleNavigate(n)}
                  style={{
                    background: n.is_read ? T.surface : '#FFF9F5',
                    border: `1px solid ${n.is_read ? T.border : '#F0D4B8'}`,
                    borderLeft: n.is_read ? `1px solid ${T.border}` : `4px solid #D4956A`,
                    borderRadius: 16,
                    padding: '1rem 1.1rem',
                    display: 'flex', alignItems: 'center', gap: '1rem',
                    cursor: isNavigable ? 'pointer' : 'default',
                    boxShadow: T.shadowSm,
                    transition: 'box-shadow 0.18s, transform 0.18s',
                  }}
                  onMouseEnter={(e) => { if (isNavigable) { const el = e.currentTarget as HTMLElement; el.style.boxShadow = '0 4px 18px rgba(48,32,24,0.1)'; el.style.transform = 'translateY(-1px)' } }}
                  onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.boxShadow = T.shadowSm; el.style.transform = 'none' }}
                >
                  {/* Icon */}
                  <div style={{ width: 46, height: 46, borderRadius: 13, background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: cfg.color, flexShrink: 0 }}>
                    {cfg.icon}
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.92rem', color: T.espresso }}>
                        {n.title}
                      </span>
                      <span style={{
                        fontSize: '0.68rem', fontWeight: 700, padding: '0.12rem 0.55rem',
                        borderRadius: 99, background: catStyle.bg, color: catStyle.color,
                        border: `1px solid ${catStyle.border}`, whiteSpace: 'nowrap',
                      }}>
                        {cat}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.83rem', color: T.secondary, lineHeight: 1.5, marginBottom: '0.3rem', wordBreak: 'break-word' }}>
                      {n.message}
                    </p>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.73rem', color: '#A09080' }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                      {new Date(n.created_at).toLocaleString()}
                    </div>
                  </div>

                  {/* Right: read status + chevron */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexShrink: 0 }}>
                    {/* Read/Unread badge — matches screenshot */}
                    {n.is_read ? (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                        padding: '0.28rem 0.75rem', borderRadius: 99,
                        fontSize: '0.75rem', fontWeight: 600,
                        background: '#EDEBE8', color: '#78675C',
                        border: '1px solid #DDD5CC',
                      }}>
                        <Check size={11} strokeWidth={2.5} /> Read
                      </span>
                    ) : (
                      <span
                        onClick={(e) => { e.stopPropagation(); handleMarkRead(n.id) }}
                        title="Click to mark as read"
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                          padding: '0.28rem 0.75rem', borderRadius: 99,
                          fontSize: '0.75rem', fontWeight: 600,
                          background: '#FFF0E8', color: '#B77B45',
                          border: '1px solid #F0CEAA',
                          cursor: 'pointer',
                        }}
                      >
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#C38B5E', display: 'inline-block', flexShrink: 0 }} />
                        Unread
                      </span>
                    )}

                    {isNavigable && (
                      <ChevronRight size={18} color="#C4A882" strokeWidth={2} />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Pagination */}
        {total > PAGE_SIZE && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '1.5rem', color: T.secondary, fontSize: '0.83rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <span>Showing {notifications.length} of {total}</span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} style={{ padding: '0.42rem 0.85rem', background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: 9, color: T.espresso, fontWeight: 600, fontSize: '0.82rem', cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.5 : 1, fontFamily: 'inherit' }}>← Previous</button>
              <span style={{ display: 'flex', alignItems: 'center', padding: '0 0.5rem', fontSize: '0.82rem', color: T.secondary }}>Page {page} of {Math.ceil(total / PAGE_SIZE)}</span>
              <button onClick={() => setPage((p) => p + 1)} disabled={page * PAGE_SIZE >= total} style={{ padding: '0.42rem 0.85rem', background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: 9, color: T.espresso, fontWeight: 600, fontSize: '0.82rem', cursor: page * PAGE_SIZE >= total ? 'not-allowed' : 'pointer', opacity: page * PAGE_SIZE >= total ? 0.5 : 1, fontFamily: 'inherit' }}>Next →</button>
            </div>
          </div>
        )}

        {/* Bottom wave */}
        <div style={{ marginTop: '3rem', marginLeft: '-1.5rem', marginRight: '-1.5rem', overflow: 'hidden', lineHeight: 0, pointerEvents: 'none' }} aria-hidden="true">
          <svg viewBox="0 0 1440 100" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', display: 'block' }}>
            <path d="M0,50 C240,90 480,10 720,55 C960,100 1200,15 1440,50 L1440,100 L0,100 Z" fill="#EEDFCC" opacity="0.45" />
            <path d="M0,70 C360,30 720,95 1080,45 C1260,20 1380,75 1440,65 L1440,100 L0,100 Z" fill="#F7EEE4" opacity="0.55" />
          </svg>
        </div>
      </div>

      {/* Responsive */}
      <style>{`
        @media (max-width: 640px) {
          .notif-hero-grid { grid-template-columns: 1fr !important; }
          .notif-hero-illo { display: none; }
        }
      `}</style>
    </div>
  )
}
