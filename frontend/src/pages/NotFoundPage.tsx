import React from 'react'
import { ArrowLeft, FileQuestion } from 'lucide-react'
import { Link } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'

export const NotFoundPage: React.FC = () => {
  return (
    <div style={{ padding: '4rem 1rem' }}>
      <EmptyState
        icon={<FileQuestion size={48} style={{ color: 'var(--primary)' }} />}
        title="404 — Page Not Found"
        description="The page or resource you requested does not exist in ResolveX."
        action={
          <Link to="/organizations" className="btn btn-primary">
            <ArrowLeft size={16} /> Return to Workspaces
          </Link>
        }
      />
    </div>
  )
}
