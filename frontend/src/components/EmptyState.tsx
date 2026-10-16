import React from 'react'
import { Inbox } from 'lucide-react'

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
}) => {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">
        {icon || <Inbox size={28} />}
      </div>
      <h3 style={{ fontSize: '1.1rem', color: 'var(--text-main)' }}>{title}</h3>
      {description && (
        <p style={{ maxWidth: '420px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
          {description}
        </p>
      )}
      {action && <div style={{ marginTop: '0.75rem' }}>{action}</div>}
    </div>
  )
}
