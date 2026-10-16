export type OrgRole = 'owner' | 'admin' | 'manager' | 'staff' | 'member' | 'client'

export type OrgVerificationStatus = 'pending' | 'approved' | 'rejected' | 'suspended'

export interface Organization {
  id: string
  name: string
  slug: string
  industry?: string | null
  verification_status: OrgVerificationStatus
  rejection_reason?: string | null
  created_at: string
  organization_code?: string | null
  domain_verification_status?: 'pending' | 'verified' | 'rejected'
  deletion_requested_at?: string | null
  deletion_scheduled_for?: string | null
  ownership_transfer_target_id?: string | null
  archived_at?: string | null
}

export interface OrganizationDeletionResponse {
  requested_at?: string | null
  scheduled_for?: string | null
  archived_at?: string | null
}

export interface OrganizationWithRole extends Organization {
  role: OrgRole
}

export interface OrganizationListResponse {
  organizations: OrganizationWithRole[]
  total: number
  page: number
  page_size: number
}

export interface Member {
  id: string
  user_id: string
  email: string
  full_name: string
  role: OrgRole
  created_at: string
}

export interface MemberListResponse {
  members: Member[]
  total: number
  page: number
  page_size: number
}

export interface CreateOrgData {
  name: string
  slug?: string
  industry?: string
  official_email_domain: string
  official_website: string
  proof_document_reference: string
  contact_phone: string
}

export interface AddMemberData {
  email: string
  role: OrgRole
}

export interface JoinCodeResponse {
  join_code: string
  created_at: string
}

export interface JoinByCodeRequest {
  join_code: string
}

export interface MembershipRequest {
  id: string
  organization_id: string
  organization_name?: string | null
  user_id: string
  user_email?: string | null
  user_name?: string | null
  status: 'pending' | 'approved' | 'rejected'
  role: OrgRole
  rejection_reason?: string | null
  created_at: string
}

export interface MembershipRequestListResponse {
  requests: MembershipRequest[]
  total: number
  page: number
  page_size: number
}

export interface OrganizationPlatformResponse extends Organization {
  official_email_domain: string
  official_website: string
  proof_document_reference: string
  contact_phone: string
  owner_name?: string | null
  owner_email?: string | null
  verified_at?: string | null
  verified_by?: string | null
  member_count: number
  issue_count: number
}

export interface OrganizationPlatformListResponse {
  organizations: OrganizationPlatformResponse[]
  total: number
  page: number
  page_size: number
}

export interface PlatformStatsResponse {
  total_organizations: number
  pending_organizations: number
  approved_organizations: number
  suspended_organizations: number
  rejected_organizations: number
  total_users: number
  total_issues: number
}

export interface PlatformAdminUser {
  id: string
  email: string
  full_name: string
  is_active: boolean
  created_at: string
}

export interface PlatformAdminListResponse {
  admins: PlatformAdminUser[]
  total: number
}
