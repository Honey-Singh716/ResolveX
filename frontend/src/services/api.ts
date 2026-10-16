import type { LoginCredentials, RegisterData, TokenResponse, User } from '../types/auth'
import type {
  ActivityListResponse,
  AssignIssueData,
  CommentListResponse,
  CreateIssueData,
  Issue,
  IssueComment,
  IssueFilterParams,
  IssueListResponse,
  UpdateIssueData,
} from '../types/issue'
import type { AppNotification, NotificationListResponse, UnreadCountResponse } from '../types/notification'
import type {
  AddMemberData,
  CreateOrgData,
  JoinCodeResponse,
  Member,
  MemberListResponse,
  MembershipRequest,
  MembershipRequestListResponse,
  Organization,
  OrganizationListResponse,
  OrganizationWithRole,
  OrganizationPlatformListResponse,
  OrganizationPlatformResponse,
  OrganizationDeletionResponse,
  OrgRole,
  PlatformAdminListResponse,
  PlatformAdminUser,
  PlatformStatsResponse,
} from '../types/organization'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1'
const TOKEN_KEY = 'resolvex_token'

export class ApiError extends Error {
  status: number
  details?: unknown

  constructor(status: number, message: string, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.details = details
  }
}

class ApiClient {
  private token: string | null = null

  constructor() {
    this.token = localStorage.getItem(TOKEN_KEY)
  }

  public getToken(): string | null {
    if (!this.token) {
      this.token = localStorage.getItem(TOKEN_KEY)
    }
    return this.token
  }

  public setToken(token: string): void {
    this.token = token
    localStorage.setItem(TOKEN_KEY, token)
    window.dispatchEvent(new Event('resolvex:auth-change'))
  }

  public clearToken(): void {
    this.token = null
    localStorage.removeItem(TOKEN_KEY)
    window.dispatchEvent(new Event('resolvex:auth-change'))
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    }

    const token = this.getToken()
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    let response: Response
    try {
      response = await fetch(url, {
        ...options,
        headers,
      })
    } catch {
      throw new ApiError(0, 'Unable to connect to ResolveX server. Please check your network or server status.')
    }

    if (response.status === 401) {
      this.clearToken()
      window.dispatchEvent(new Event('resolvex:unauthorized'))
    }

    if (response.status === 204) {
      return undefined as T
    }

    let data: unknown
    try {
      data = await response.json()
    } catch {
      data = null
    }

    if (!response.ok) {
      let message = 'An unexpected error occurred.'
      if (data && typeof data === 'object' && 'detail' in data) {
        const detail = (data as { detail: unknown }).detail
        if (typeof detail === 'string') {
          message = detail
        } else if (Array.isArray(detail)) {
          message = detail.map((err) => (err && typeof err === 'object' && 'msg' in err ? String(err.msg) : JSON.stringify(err))).join(', ')
        } else {
          message = JSON.stringify(detail)
        }
      } else if (response.statusText) {
        message = response.statusText
      }
      throw new ApiError(response.status, message, data)
    }

    return data as T
  }

  // -------------------------------------------------------------------------
  // Auth
  // -------------------------------------------------------------------------
  public auth = {
    register: (data: RegisterData): Promise<User> => {
      return this.request<User>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(data),
      })
    },

    login: (credentials: LoginCredentials): Promise<TokenResponse> => {
      return this.request<TokenResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
      })
    },

    platformAdminLogin: (credentials: LoginCredentials): Promise<TokenResponse> => {
      return this.request<TokenResponse>('/auth/platform-admin/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
      })
    },

    getMe: (): Promise<User> => {
      return this.request<User>('/auth/me', {
        method: 'GET',
      })
    },
  }

  // -------------------------------------------------------------------------
  // Organizations & Memberships
  // -------------------------------------------------------------------------
  public organizations = {
    list: (page = 1, pageSize = 20): Promise<OrganizationListResponse> => {
      return this.request<OrganizationListResponse>(
        `/organizations?page=${page}&page_size=${pageSize}`,
        { method: 'GET' }
      )
    },

    discover: (): Promise<OrganizationWithRole[]> => {
      return this.request<OrganizationWithRole[]>('/organizations/discover', { method: 'GET' })
    },

    get: (orgId: string): Promise<Organization> => {
      return this.request<Organization>(`/organizations/${orgId}`, {
        method: 'GET',
      })
    },

    create: (data: CreateOrgData): Promise<Organization> => {
      return this.request<Organization>('/organizations', {
        method: 'POST',
        body: JSON.stringify(data),
      })
    },

    listMembers: (
      orgId: string,
      page = 1,
      pageSize = 20
    ): Promise<MemberListResponse> => {
      return this.request<MemberListResponse>(
        `/organizations/${orgId}/members?page=${page}&page_size=${pageSize}`,
        { method: 'GET' }
      )
    },

    addMember: (orgId: string, data: AddMemberData): Promise<Member> => {
      return this.request<Member>(`/organizations/${orgId}/members`, {
        method: 'POST',
        body: JSON.stringify(data),
      })
    },

    updateMemberRole: (
      orgId: string,
      userId: string,
      role: OrgRole
    ): Promise<Member> => {
      return this.request<Member>(
        `/organizations/${orgId}/members/${userId}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ role }),
        }
      )
    },

    removeMember: (orgId: string, userId: string): Promise<void> => {
      return this.request<void>(
        `/organizations/${orgId}/members/${userId}`,
        { method: 'DELETE' }
      )
    },

    joinByCode: (joinCode: string): Promise<MembershipRequest> => {
      return this.request<MembershipRequest>('/organizations/join', {
        method: 'POST',
        body: JSON.stringify({ join_code: joinCode }),
      })
    },

    getMyMembershipRequests: (): Promise<MembershipRequestListResponse> => {
      return this.request<MembershipRequestListResponse>(
        '/organizations/membership-requests/mine',
        { method: 'GET' }
      )
    },

    getJoinCode: (orgId: string): Promise<JoinCodeResponse> => {
      return this.request<JoinCodeResponse>(`/organizations/${orgId}/join-code`, {
        method: 'GET',
      })
    },

    generateJoinCode: (orgId: string): Promise<JoinCodeResponse> => {
      return this.request<JoinCodeResponse>(`/organizations/${orgId}/join-code`, {
        method: 'POST',
      })
    },

    revokeJoinCode: (orgId: string): Promise<void> => {
      return this.request<void>(`/organizations/${orgId}/join-code`, {
        method: 'DELETE',
      })
    },

    requestOwnershipTransfer: (orgId: string, targetUserId: string): Promise<Organization> => {
      return this.request<Organization>(`/organizations/${orgId}/ownership-transfer`, {
        method: 'POST',
        body: JSON.stringify({ target_user_id: targetUserId }),
      })
    },

    acceptOwnershipTransfer: (orgId: string): Promise<Organization> => {
      return this.request<Organization>(`/organizations/${orgId}/ownership-transfer/accept`, {
        method: 'POST',
      })
    },

    requestDeletion: (orgId: string): Promise<OrganizationDeletionResponse> => {
      return this.request<OrganizationDeletionResponse>(`/organizations/${orgId}/deletion-request`, {
        method: 'POST',
      })
    },

    cancelDeletion: (orgId: string): Promise<OrganizationDeletionResponse> => {
      return this.request<OrganizationDeletionResponse>(`/organizations/${orgId}/deletion-request`, {
        method: 'DELETE',
      })
    },

    archive: (orgId: string): Promise<OrganizationDeletionResponse> => {
      return this.request<OrganizationDeletionResponse>(`/organizations/${orgId}/archive`, {
        method: 'POST',
      })
    },

    listMembershipRequests: (
      orgId: string,
      status?: string,
      page = 1,
      pageSize = 50
    ): Promise<MembershipRequestListResponse> => {
      const searchParams = new URLSearchParams()
      searchParams.set('page', String(page))
      searchParams.set('page_size', String(pageSize))
      if (status) searchParams.set('status', status)
      return this.request<MembershipRequestListResponse>(
        `/organizations/${orgId}/membership-requests?${searchParams.toString()}`,
        { method: 'GET' }
      )
    },

    approveMembershipRequest: (
      orgId: string,
      requestId: string,
      role: OrgRole = 'client'
    ): Promise<MembershipRequest> => {
      return this.request<MembershipRequest>(
        `/organizations/${orgId}/membership-requests/${requestId}/approve`,
        {
          method: 'POST',
          body: JSON.stringify({ role }),
        }
      )
    },

    rejectMembershipRequest: (
      orgId: string,
      requestId: string,
      reason?: string
    ): Promise<MembershipRequest> => {
      return this.request<MembershipRequest>(
        `/organizations/${orgId}/membership-requests/${requestId}/reject`,
        {
          method: 'POST',
          body: JSON.stringify({ reason }),
        }
      )
    },
  }

  // -------------------------------------------------------------------------
  // Platform Administration (Superadmin only)
  // -------------------------------------------------------------------------
  public platform = {
    listOrganizations: (
      status?: string,
      page = 1,
      pageSize = 20
    ): Promise<OrganizationPlatformListResponse> => {
      const searchParams = new URLSearchParams()
      searchParams.set('page', String(page))
      searchParams.set('page_size', String(pageSize))
      if (status) searchParams.set('status', status)
      return this.request<OrganizationPlatformListResponse>(
        `/platform/organizations?${searchParams.toString()}`,
        { method: 'GET' }
      )
    },

    approveOrg: (orgId: string): Promise<OrganizationPlatformResponse> => {
      return this.request<OrganizationPlatformResponse>(
        `/platform/organizations/${orgId}/approve`,
        { method: 'POST' }
      )
    },

    rejectOrg: (
      orgId: string,
      reason?: string
    ): Promise<OrganizationPlatformResponse> => {
      return this.request<OrganizationPlatformResponse>(
        `/platform/organizations/${orgId}/reject`,
        {
          method: 'POST',
          body: JSON.stringify({ reason }),
        }
      )
    },

    suspendOrg: (
      orgId: string,
      reason?: string
    ): Promise<OrganizationPlatformResponse> => {
      return this.request<OrganizationPlatformResponse>(
        `/platform/organizations/${orgId}/suspend`,
        {
          method: 'POST',
          body: JSON.stringify({ reason }),
        }
      )
    },

    getStats: (): Promise<PlatformStatsResponse> => {
      return this.request<PlatformStatsResponse>('/platform/stats', {
        method: 'GET',
      })
    },

    listAdmins: (): Promise<PlatformAdminListResponse> => {
      return this.request<PlatformAdminListResponse>('/platform/admins', {
        method: 'GET',
      })
    },

    promoteAdmin: (email: string): Promise<PlatformAdminUser> => {
      return this.request<PlatformAdminUser>('/platform/admins', {
        method: 'POST',
        body: JSON.stringify({ email }),
      })
    },

    revokeAdmin: (userId: string): Promise<void> => {
      return this.request<void>(`/platform/admins/${userId}`, {
        method: 'DELETE',
      })
    },
  }

  // -------------------------------------------------------------------------
  // Issues & Comments & Activities
  // -------------------------------------------------------------------------
  public issues = {
    listMine: (
      params: {
        status?: string
        priority?: string
        search?: string
        page?: number
        page_size?: number
      } = {}
    ): Promise<IssueListResponse> => {
      const searchParams = new URLSearchParams()
      if (params.status) searchParams.set('status', params.status)
      if (params.priority) searchParams.set('priority', params.priority)
      if (params.search) searchParams.set('search', params.search)
      if (params.page) searchParams.set('page', String(params.page))
      if (params.page_size) searchParams.set('page_size', String(params.page_size))

      const query = searchParams.toString()
      return this.request<IssueListResponse>(
        `/issues/mine${query ? `?${query}` : ''}`,
        { method: 'GET' }
      )
    },

    getMine: (issueId: string): Promise<Issue> => {
      return this.request<Issue>(`/issues/mine/${issueId}`, { method: 'GET' })
    },

    listMineComments: (issueId: string, page = 1, pageSize = 100): Promise<CommentListResponse> => {
      return this.request<CommentListResponse>(
        `/issues/mine/${issueId}/comments?page=${page}&page_size=${pageSize}`,
        { method: 'GET' }
      )
    },

    addMineComment: (issueId: string, content: string): Promise<IssueComment> => {
      return this.request<IssueComment>(`/issues/mine/${issueId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ content }),
      })
    },

    listMineActivities: (issueId: string, page = 1, pageSize = 100): Promise<ActivityListResponse> => {
      return this.request<ActivityListResponse>(
        `/issues/mine/${issueId}/activities?page=${page}&page_size=${pageSize}`,
        { method: 'GET' }
      )
    },
    list: (
      orgId: string,
      params: IssueFilterParams = {}
    ): Promise<IssueListResponse> => {
      const searchParams = new URLSearchParams()
      if (params.status) searchParams.set('status', params.status)
      if (params.priority) searchParams.set('priority', params.priority)
      if (params.assignee_id) searchParams.set('assignee_id', params.assignee_id)
      if (params.reporter_id) searchParams.set('reporter_id', params.reporter_id)
      if (params.category) searchParams.set('category', params.category)
      if (params.search) searchParams.set('search', params.search)
      if (params.sort_by) searchParams.set('sort_by', params.sort_by)
      if (params.sort_order) searchParams.set('sort_order', params.sort_order)
      if (params.page) searchParams.set('page', String(params.page))
      if (params.page_size) searchParams.set('page_size', String(params.page_size))

      const query = searchParams.toString()
      return this.request<IssueListResponse>(
        `/organizations/${orgId}/issues${query ? `?${query}` : ''}`,
        { method: 'GET' }
      )
    },

    get: (orgId: string, issueId: string): Promise<Issue> => {
      return this.request<Issue>(
        `/organizations/${orgId}/issues/${issueId}`,
        { method: 'GET' }
      )
    },

    create: (orgId: string, data: CreateIssueData): Promise<Issue> => {
      return this.request<Issue>(`/organizations/${orgId}/issues`, {
        method: 'POST',
        body: JSON.stringify(data),
      })
    },

    update: (
      orgId: string,
      issueId: string,
      data: UpdateIssueData
    ): Promise<Issue> => {
      return this.request<Issue>(
        `/organizations/${orgId}/issues/${issueId}`,
        {
          method: 'PATCH',
          body: JSON.stringify(data),
        }
      )
    },

    assign: (
      orgId: string,
      issueId: string,
      data: AssignIssueData
    ): Promise<Issue> => {
      return this.request<Issue>(
        `/organizations/${orgId}/issues/${issueId}/assign`,
        {
          method: 'POST',
          body: JSON.stringify(data),
        }
      )
    },

    listComments: (
      orgId: string,
      issueId: string,
      page = 1,
      pageSize = 50
    ): Promise<CommentListResponse> => {
      return this.request<CommentListResponse>(
        `/organizations/${orgId}/issues/${issueId}/comments?page=${page}&page_size=${pageSize}`,
        { method: 'GET' }
      )
    },

    addComment: (
      orgId: string,
      issueId: string,
      body: string
    ): Promise<IssueComment> => {
      return this.request<IssueComment>(
        `/organizations/${orgId}/issues/${issueId}/comments`,
        {
          method: 'POST',
          body: JSON.stringify({ content: body }),
        }
      )
    },

    listActivities: (
      orgId: string,
      issueId: string,
      page = 1,
      pageSize = 50
    ): Promise<ActivityListResponse> => {
      return this.request<ActivityListResponse>(
        `/organizations/${orgId}/issues/${issueId}/activities?page=${page}&page_size=${pageSize}`,
        { method: 'GET' }
      )
    },
  }

  // -------------------------------------------------------------------------
  // Notifications
  // -------------------------------------------------------------------------
  public notifications = {
    list: (
      page = 1,
      pageSize = 20,
      isRead?: boolean
    ): Promise<NotificationListResponse> => {
      const searchParams = new URLSearchParams()
      searchParams.set('page', String(page))
      searchParams.set('page_size', String(pageSize))
      if (typeof isRead === 'boolean') {
        searchParams.set('is_read', String(isRead))
      }
      return this.request<NotificationListResponse>(
        `/notifications?${searchParams.toString()}`,
        { method: 'GET' }
      )
    },

    getUnreadCount: (): Promise<UnreadCountResponse> => {
      return this.request<UnreadCountResponse>('/notifications/unread-count', {
        method: 'GET',
      })
    },

    markRead: (notificationId: string): Promise<AppNotification> => {
      return this.request<AppNotification>(
        `/notifications/${notificationId}/read`,
        { method: 'PATCH' }
      )
    },

    markAllRead: (): Promise<void> => {
      return this.request<void>('/notifications/read-all', {
        method: 'PATCH',
      })
    },
  }
}

export const api = new ApiClient()
