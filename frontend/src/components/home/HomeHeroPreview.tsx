import React from 'react'
import {
  BarChart3,
  Building2,
  Calendar,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  LayoutDashboard,
  Settings,
  Ticket,
  Timer,
  TrendingUp,
  Users,
} from 'lucide-react'

const NAV = [
  { label: 'Dashboard', icon: LayoutDashboard, active: true },
  { label: 'Issues', icon: Ticket, active: false },
  { label: 'Organizations', icon: Building2, active: false },
  { label: 'Clients', icon: Users, active: false },
  { label: 'Reports', icon: BarChart3, active: false },
  { label: 'Settings', icon: Settings, active: false },
] as const

const STATS = [
  { label: 'Total Issues', value: '128', tone: 'neutral', icon: TrendingUp },
  { label: 'Open', value: '36', tone: 'open', icon: CircleAlert },
  { label: 'In Progress', value: '54', tone: 'progress', icon: Timer },
  { label: 'Resolved', value: '38', tone: 'resolved', icon: CircleCheck },
] as const

const ISSUES = [
  { key: 'RES-101', title: 'Login not working for client portal', priority: 'High', status: 'In Progress', assignee: 'AK' },
  { key: 'RES-102', title: 'Organization user invitation issue', priority: 'Medium', status: 'Open', assignee: 'PS' },
  { key: 'RES-103', title: 'File upload limit exceeded', priority: 'High', status: 'Open', assignee: 'RD' },
  { key: 'RES-104', title: 'Dashboard metrics mismatch', priority: 'Low', status: 'Resolved', assignee: 'HS' },
] as const

const toneClass = (value: string) => `rx-tone-${value.toLowerCase().replace(/\s+/g, '-')}`

/**
 * Static product mock. Counts, names, and tickets are design content only.
 */
export const HomeHeroPreview: React.FC = () => {
  return (
    <div className="rx-preview" inert aria-hidden="true">
      <aside className="rx-preview-side">
        <div className="rx-preview-brand">
          <span className="rx-mark rx-mark-light">
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <rect x="1" y="1" width="6" height="6" rx="1.5" />
              <rect x="9" y="1" width="6" height="6" rx="1.5" opacity="0.55" />
              <rect x="1" y="9" width="6" height="6" rx="1.5" opacity="0.55" />
              <rect x="9" y="9" width="6" height="6" rx="1.5" />
            </svg>
          </span>
          <span className="rx-preview-brand-name">ResolveX</span>
        </div>

        <ul className="rx-preview-nav">
          {NAV.map((item) => {
            const Icon = item.icon
            return (
              <li key={item.label}>
                <span className={item.active ? 'is-active' : undefined}>
                  <Icon size={15} strokeWidth={1.75} aria-hidden="true" />
                  <span className="rx-preview-side-label">{item.label}</span>
                </span>
              </li>
            )
          })}
        </ul>

        <div className="rx-preview-user">
          <span className="rx-avatar rx-avatar-hs">HS</span>
          <span className="rx-preview-user-meta">
            <strong>Honey Singh</strong>
            <small>Admin</small>
          </span>
          <ChevronDown size={14} className="rx-preview-user-chevron" aria-hidden="true" />
        </div>
      </aside>

      <div className="rx-preview-main">
        <header className="rx-preview-header">
          <div>
            <h3>Dashboard</h3>
            <p>Overview of issues and team activity</p>
          </div>
          <span className="rx-preview-range">
            <Calendar size={13} aria-hidden="true" />
            Last 7 days
            <ChevronDown size={13} aria-hidden="true" />
          </span>
        </header>

        <div className="rx-preview-stats">
          {STATS.map((stat) => {
            const Icon = stat.icon
            return (
              <div className={`rx-stat rx-stat-${stat.tone}`} key={stat.label}>
                <span className="rx-stat-label">
                  {stat.label}
                  <Icon size={13} aria-hidden="true" />
                </span>
                <strong>{stat.value}</strong>
              </div>
            )
          })}
        </div>

        <div className="rx-preview-table-block">
          <div className="rx-preview-table-head">
            <h4>Recent Issues</h4>
            <span>View all</span>
          </div>
          <table>
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">Title</th>
                <th className="rx-col-priority" scope="col">Priority</th>
                <th scope="col">Status</th>
                <th className="rx-col-assignee" scope="col">Assignee</th>
                <th className="rx-col-chevron" scope="col" />
              </tr>
            </thead>
            <tbody>
              {ISSUES.map((issue) => (
                <tr key={issue.key}>
                  <td className="rx-issue-key">{issue.key}</td>
                  <td className="rx-issue-title">{issue.title}</td>
                  <td className="rx-col-priority">
                    <span className={`rx-pill ${toneClass(issue.priority)}`}>{issue.priority}</span>
                  </td>
                  <td>
                    <span className={`rx-pill ${toneClass(issue.status)}`}>{issue.status}</span>
                  </td>
                  <td className="rx-col-assignee">
                    <span className={`rx-avatar rx-avatar-${issue.assignee.toLowerCase()}`}>{issue.assignee}</span>
                  </td>
                  <td className="rx-col-chevron">
                    <ChevronRight size={14} aria-hidden="true" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
