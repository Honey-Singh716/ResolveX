import React from 'react'
import { AlertCircle, X } from 'lucide-react'

interface ErrorAlertProps {
  message: string | null
  onDismiss?: () => void
}

export const ErrorAlert: React.FC<ErrorAlertProps> = ({ message, onDismiss }) => {
  if (!message) return null

  return (
    <div className="alert-banner alert-error" role="alert">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
        <AlertCircle size={18} style={{ flexShrink: 0 }} />
        <span style={{ fontSize: '0.875rem' }}>{message}</span>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="btn-icon btn-ghost"
          style={{ padding: '0.2rem', color: 'inherit' }}
          aria-label="Dismiss error"
        >
          <X size={16} />
        </button>
      )}
    </div>
  )
}
