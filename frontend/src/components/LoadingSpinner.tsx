import React from 'react'
import { Loader2 } from 'lucide-react'

interface LoadingSpinnerProps {
  label?: string
  size?: number
  fullPage?: boolean
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  label = 'Loading...',
  size = 24,
  fullPage = false,
}) => {
  const content = (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.75rem',
        color: 'var(--text-secondary)',
        padding: '2rem',
      }}
    >
      <Loader2 size={size} className="spin" style={{ color: 'var(--primary)' }} />
      {label && <span style={{ fontSize: '0.875rem' }}>{label}</span>}
    </div>
  )

  if (fullPage) {
    return (
      <div
        style={{
          minHeight: '70vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {content}
      </div>
    )
  }

  return content
}
