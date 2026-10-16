import React from 'react'
import { Navigate, useLocation, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useOrg } from '../context/OrgContext'
import { LoadingSpinner } from './LoadingSpinner'

/**
 * Route guard requiring authenticated standard user / client.
 */
export const ClientGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return <LoadingSpinner fullPage label="Authenticating..." />
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}

/**
 * Route guard requiring active approved organization membership (owner, admin, manager, staff).
 */
export const OrgGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading: authLoading } = useAuth()
  const { organizations, isLoading: orgLoading } = useOrg()
  const location = useLocation()
  const { orgId } = useParams<{ orgId: string }>()

  if (authLoading || orgLoading) {
    return <LoadingSpinner fullPage label="Loading organization workspace..." />
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // A tenant route must be authorized for that exact organization. Do not
  // let a membership in another organization satisfy a direct URL check.
  const approvedOrgs = organizations.filter(
    (o) => o.verification_status === 'approved' && ['owner', 'admin', 'manager', 'staff'].includes(o.role)
  )

  const selectedOrg = orgId
    ? approvedOrgs.find((organization) => organization.id === orgId)
    : approvedOrgs[0]

  if (!selectedOrg) {
    return <Navigate to="/client/dashboard" replace />
  }

  return <>{children}</>
}

/**
 * Route guard strictly requiring verified platform administrator status.
 */
export const PlatformAdminGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return <LoadingSpinner fullPage label="Verifying platform administrator credentials..." />
  }

  if (!user || !user.is_platform_admin) {
    return <Navigate to="/platform-admin/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}
