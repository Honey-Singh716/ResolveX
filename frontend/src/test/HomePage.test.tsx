import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HomePage } from '../pages/HomePage'
import { api } from '../services/api'

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'user-1',
      email: 'honey@example.com',
      full_name: 'Honey Singh',
      is_active: true,
    },
  }),
}))

vi.mock('../context/OrgContext', () => ({
  useOrg: () => ({
    organizations: [],
    currentOrg: null,
    userRole: null,
    isLoading: false,
    selectOrg: vi.fn(),
    refreshOrgs: vi.fn(),
    isOwner: false,
    isAdmin: false,
    isManager: false,
    canManageMembers: false,
    canManageIssues: false,
  }),
}))

describe('HomePage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(api.issues, 'listMine').mockResolvedValue({
      issues: [],
      total: 0,
      page: 1,
      page_size: 5,
    })
    vi.spyOn(api.organizations, 'getMyMembershipRequests').mockResolvedValue({
      requests: [],
      total: 0,
      page: 1,
      page_size: 50,
    })
    vi.spyOn(api.notifications, 'list').mockResolvedValue({
      notifications: [],
      total: 0,
      page: 1,
      page_size: 5,
    })
  })

  it('shows onboarding actions and a real empty state for a new user', async () => {
    render(
      <BrowserRouter>
        <HomePage />
      </BrowserRouter>
    )

    expect(await screen.findByText(/welcome, honey/i)).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /join an organization/i }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('button', { name: /create an organization/i }).length).toBeGreaterThan(0)
    expect(screen.getByText(/no organizations yet/i)).toBeInTheDocument()
    expect(screen.queryByText(/my issue summary/i)).not.toBeInTheDocument()
  })

  it('shows personal ticket summary only when tickets exist', async () => {
    vi.mocked(api.issues.listMine).mockResolvedValue({
      issues: [{
        id: 'issue-1',
        organization_id: 'org-1',
        issue_key: 'ACME-1',
        title: 'WiFi issue',
        description: 'No connection',
        priority: 'urgent',
        status: 'open',
        version: 1,
        created_at: '2026-10-17T00:00:00Z',
        updated_at: '2026-10-17T00:00:00Z',
      }],
      total: 1,
      page: 1,
      page_size: 5,
    })

    render(
      <BrowserRouter>
        <HomePage />
      </BrowserRouter>
    )

    await waitFor(() => expect(screen.getByText(/my issue summary/i)).toBeInTheDocument())
    expect(screen.getByText('Open')).toBeInTheDocument()
  })
})
