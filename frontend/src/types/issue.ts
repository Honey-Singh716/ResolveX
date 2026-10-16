export type IssueStatus = 'open' | 'in_progress' | 'resolved' | 'closed'
export type IssuePriority = 'low' | 'medium' | 'high' | 'urgent'

export interface UserSummary {
  id: string
  email: string
  full_name: string
  role?: string
}

export interface Issue {
  id: string
  organization_id: string
  issue_key: string
  title: string
  description?: string | null
  category?: string | null
  priority: IssuePriority
  status: IssueStatus
  reporter_id?: string
  assignee_id?: string | null
  reporter?: UserSummary | null
  assignee?: UserSummary | null
  resolution_note?: string | null
  version: number
  created_at: string
  updated_at: string
}

export type IssueResponse = Issue

export interface IssueListResponse {
  issues: Issue[]
  total: number
  page: number
  page_size: number
}

export interface CreateIssueData {
  title: string
  description?: string
  category?: string
  priority?: IssuePriority
  assignee_id?: string | null
}

export interface UpdateIssueData {
  title?: string
  description?: string
  category?: string
  priority?: IssuePriority
  status?: IssueStatus
  resolution_note?: string
  version: number
}

export interface AssignIssueData {
  assignee_id: string | null
  version: number
}

export interface IssueComment {
  id: string
  issue_id: string
  organization_id: string
  author: UserSummary
  content: string
  created_at: string
  updated_at: string
}

export interface CommentListResponse {
  comments: IssueComment[]
  total: number
  page: number
  page_size: number
}

export interface IssueActivity {
  id: string
  organization_id: string
  issue_id: string
  actor_id: string
  action: string
  old_value?: string | null
  new_value?: string | null
  details?: string | null
  created_at: string
}

export interface ActivityListResponse {
  activities: IssueActivity[]
  total: number
  page: number
  page_size: number
}

export interface IssueFilterParams {
  status?: string
  priority?: string
  assignee_id?: string
  reporter_id?: string
  category?: string
  search?: string
  sort_by?: 'created_at' | 'updated_at' | 'priority' | 'status' | 'issue_key'
  sort_order?: 'asc' | 'desc'
  page?: number
  page_size?: number
}
