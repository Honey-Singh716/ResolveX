import React, { createContext, useContext, useEffect, useState } from 'react'
import { api } from '../services/api'
import type { OrganizationWithRole, OrgRole } from '../types/organization'
import { useAuth } from './AuthContext'

interface OrgContextType {
  organizations: OrganizationWithRole[]
  currentOrg: OrganizationWithRole | null
  userRole: OrgRole | null
  isLoading: boolean
  selectOrg: (orgId: string) => void
  refreshOrgs: () => Promise<OrganizationWithRole[]>
  isOwner: boolean
  isAdmin: boolean
  isManager: boolean
  canManageMembers: boolean
  canManageIssues: boolean
}

const ACTIVE_ORG_KEY = 'resolvex_active_org_id'

const OrgContext = createContext<OrgContextType | undefined>(undefined)

export const OrgProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth()
  const [organizations, setOrganizations] = useState<OrganizationWithRole[]>([])
  const [currentOrg, setCurrentOrg] = useState<OrganizationWithRole | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)

  const refreshOrgs = async (): Promise<OrganizationWithRole[]> => {
    if (!isAuthenticated) {
      setOrganizations([])
      setCurrentOrg(null)
      setIsLoading(false)
      return []
    }

    try {
      setIsLoading(true)
      const res = await api.organizations.list(1, 100)
      const orgList = res.organizations || []
      setOrganizations(orgList)

      const savedOrgId = localStorage.getItem(ACTIVE_ORG_KEY)
      let active = orgList.find((o) => o.id === savedOrgId)
      if (!active && orgList.length > 0) {
        active = orgList[0]
      }

      if (active) {
        setCurrentOrg(active)
        localStorage.setItem(ACTIVE_ORG_KEY, active.id)
      } else {
        setCurrentOrg(null)
        localStorage.removeItem(ACTIVE_ORG_KEY)
      }

      return orgList
    } catch {
      setOrganizations([])
      setCurrentOrg(null)
      return []
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (isAuthenticated) {
      refreshOrgs()
    } else {
      setOrganizations([])
      setCurrentOrg(null)
      setIsLoading(false)
    }
  }, [isAuthenticated])

  const selectOrg = (orgId: string) => {
    const found = organizations.find((o) => o.id === orgId)
    if (found) {
      setCurrentOrg(found)
      localStorage.setItem(ACTIVE_ORG_KEY, found.id)
    }
  }

  const role = currentOrg?.role || null
  const isOwner = role === 'owner'
  const isAdmin = role === 'admin' || isOwner
  const isManager = role === 'manager' || isAdmin
  const canManageMembers = isAdmin || role === 'manager' || role === 'staff'
  const canManageIssues = isManager || role === 'staff'

  return (
    <OrgContext.Provider
      value={{
        organizations,
        currentOrg,
        userRole: role,
        isLoading,
        selectOrg,
        refreshOrgs,
        isOwner,
        isAdmin,
        isManager,
        canManageMembers,
        canManageIssues,
      }}
    >
      {children}
    </OrgContext.Provider>
  )
}

export const useOrg = (): OrgContextType => {
  const context = useContext(OrgContext)
  if (!context) {
    throw new Error('useOrg must be used within an OrgProvider')
  }
  return context
}
