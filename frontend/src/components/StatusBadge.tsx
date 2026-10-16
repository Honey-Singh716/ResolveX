import React from 'react'
import type { IssuePriority, IssueStatus } from '../types/issue'
import type { OrgRole } from '../types/organization'

export const StatusBadge: React.FC<{ status: IssueStatus | string }> = ({ status }) => {
  const label = status.replace('_', ' ')
  return <span className={`badge badge-status-${status}`}>{label}</span>
}

export const PriorityBadge: React.FC<{ priority: IssuePriority | string }> = ({ priority }) => {
  return <span className={`badge badge-priority-${priority}`}>{priority}</span>
}

export const RoleBadge: React.FC<{ role: OrgRole | string }> = ({ role }) => {
  return <span className="badge badge-role">{role}</span>
}

export const VerificationBadge: React.FC<{ status: string }> = ({ status }) => {
  const label = status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Pending'
  return <span className={`badge badge-verification-${status}`}>{label}</span>
}
