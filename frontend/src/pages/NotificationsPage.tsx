import React, { useEffect, useState } from 'react'
import { Bell, CheckCheck, ExternalLink } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'
import { ErrorAlert } from '../components/ErrorAlert'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { useOrg } from '../context/OrgContext'
import { api } from '../services/api'
import type { AppNotification } from '../types/notification'

export const NotificationsPage: React.FC = () => {
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [filterRead, setFilterRead] = useState<boolean | undefined>(undefined)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const navigate = useNavigate()
  const { currentOrg } = useOrg()

  const loadData = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const [listRes, countRes] = await Promise.all([
        api.notifications.list(page, pageSize, filterRead),
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

  useEffect(() => {
    loadData()
  }, [page, filterRead])

  const handleMarkRead = async (notificationId: string) => {
    try {
      await api.notifications.markRead(notificationId)
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n))
      )
      setUnreadCount((c) => Math.max(0, c - 1))
    } catch {
      // Ignore
    }
  }

  const handleMarkAllRead = async () => {
    try {
      await api.notifications.markAllRead()
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
      setUnreadCount(0)
    } catch {
      // Ignore
    }
  }

  const handleNavigateIssue = (notification: AppNotification) => {
    if (!notification.is_read) {
      handleMarkRead(notification.id)
    }
    if (notification.target_path) {
      navigate(notification.target_path)
    } else if (notification.issue_id && currentOrg) {
      navigate(`/org/${currentOrg.id}/issues/${notification.issue_id}`)
    }
  }

  return (
    <div style={{ maxWidth: '850px', margin: '0 auto' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1.5rem',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <h1>Notification Center</h1>
            {unreadCount > 0 && (
              <span
                style={{
                  fontSize: '0.8rem',
                  padding: '0.15rem 0.6rem',
                  borderRadius: 'var(--radius-full)',
                  background: 'var(--primary-subtle)',
                  color: 'var(--primary)',
                  fontWeight: 700,
                }}
              >
                {unreadCount} unread
              </span>
            )}
          </div>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
            In-app alerts for assignments, status progressions, and comment discussions
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {unreadCount > 0 && (
            <button onClick={handleMarkAllRead} className="btn btn-secondary btn-sm">
              <CheckCheck size={15} /> Mark All as Read
            </button>
          )}
        </div>
      </div>

      <ErrorAlert message={error} onDismiss={() => setError(null)} />

      {/* Filter Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          marginBottom: '1.25rem',
          borderBottom: '1px solid var(--border-subtle)',
          paddingBottom: '0.5rem',
        }}
      >
        <button
          onClick={() => {
            setFilterRead(undefined)
            setPage(1)
          }}
          className={`btn-ghost btn-sm ${filterRead === undefined ? 'active' : ''}`}
          style={{
            fontWeight: 600,
            color: filterRead === undefined ? 'var(--primary)' : 'var(--text-muted)',
          }}
        >
          All
        </button>
        <button
          onClick={() => {
            setFilterRead(false)
            setPage(1)
          }}
          className={`btn-ghost btn-sm ${filterRead === false ? 'active' : ''}`}
          style={{
            fontWeight: 600,
            color: filterRead === false ? 'var(--primary)' : 'var(--text-muted)',
          }}
        >
          Unread Only
        </button>
        <button
          onClick={() => {
            setFilterRead(true)
            setPage(1)
          }}
          className={`btn-ghost btn-sm ${filterRead === true ? 'active' : ''}`}
          style={{
            fontWeight: 600,
            color: filterRead === true ? 'var(--primary)' : 'var(--text-muted)',
          }}
        >
          Read
        </button>
      </div>

      {/* Notifications List */}
      {isLoading ? (
        <LoadingSpinner label="Loading alerts..." />
      ) : notifications.length === 0 ? (
        <EmptyState
          icon={<Bell size={36} />}
          title="No notifications"
          description={
            filterRead === false
              ? "You're all caught up! No unread notifications found."
              : 'You do not have any notifications in your inbox yet.'
          }
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {notifications.map((n) => (
            <div
              key={n.id}
              className="card"
              style={{
                padding: '1.1rem 1.25rem',
                background: n.is_read ? 'var(--bg-surface)' : 'rgba(99, 102, 241, 0.05)',
                border: n.is_read
                  ? '1px solid var(--border-subtle)'
                  : '1px solid rgba(99, 102, 241, 0.25)',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: '1rem',
              }}
            >
              <div style={{ display: 'flex', gap: '0.85rem', flex: 1 }}>
                {!n.is_read && (
                  <div
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: 'var(--primary)',
                      marginTop: '0.45rem',
                      flexShrink: 0,
                    }}
                  />
                )}
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '0.2rem' }}>
                    {n.title}
                  </div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.5 }}>
                    {n.message}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                    {new Date(n.created_at).toLocaleString()}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                {n.issue_id && (
                  <button
                    onClick={() => handleNavigateIssue(n)}
                    className="btn btn-secondary btn-sm"
                  >
                    View Ticket <ExternalLink size={13} />
                  </button>
                )}
                {!n.is_read && (
                  <button
                    onClick={() => handleMarkRead(n.id)}
                    className="btn btn-ghost btn-sm"
                    title="Mark as read"
                  >
                    <CheckCheck size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {total > pageSize && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: '1.5rem',
            color: 'var(--text-muted)',
            fontSize: '0.85rem',
          }}
        >
          <div>Total: {total} alerts</div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="btn btn-secondary btn-sm"
            >
              Previous
            </button>
            <span style={{ display: 'flex', alignItems: 'center', padding: '0 0.5rem' }}>
              Page {page} of {Math.ceil(total / pageSize)}
            </span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page * pageSize >= total}
              className="btn btn-secondary btn-sm"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
