export type NotificationType =
  | 'issue_assigned'
  | 'issue_unassigned'
  | 'issue_status_changed'
  | 'comment_added'

export interface AppNotification {
  id: string
  organization_id: string
  issue_id?: string | null
  target_path?: string | null
  type: NotificationType | string
  title: string
  message: string
  is_read: boolean
  created_at: string
}

export interface NotificationListResponse {
  notifications: AppNotification[]
  total: number
  page: number
  page_size: number
}

export interface UnreadCountResponse {
  unread_count: number
}
