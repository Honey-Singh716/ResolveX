import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../context/AuthContext'
import { OrgProvider } from '../context/OrgContext'
import { IssueDetailPage } from '../pages/IssueDetailPage'
import { api } from '../services/api'
import type { Issue } from '../types/issue'

describe('IssueDetailPage', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  const baseIssue: Issue = {
    id: 'issue-100',
    organization_id: 'org-1',
    issue_key: 'ENG-100',
    title: 'Server fan speed excessive',
    description: 'Rack 4 node 2 fan running at 100%',
    category: 'Hardware',
    priority: 'urgent',
    status: 'in_progress',
    reporter_id: 'user-1',
    assignee_id: 'user-2',
    resolution_note: null,
    version: 1,
    created_at: '2026-10-16T12:00:00Z',
    updated_at: '2026-10-16T12:00:00Z',
  }

  it('renders issue details and prompts for mandatory resolution note on resolve', async () => {
    vi.spyOn(api.issues, 'get').mockResolvedValue(baseIssue)
    vi.spyOn(api.organizations, 'listMembers').mockResolvedValue({
      members: [],
      total: 0,
      page: 1,
      page_size: 100,
    })
    vi.spyOn(api.issues, 'listComments').mockResolvedValue({
      comments: [],
      total: 0,
      page: 1,
      page_size: 100,
    })
    vi.spyOn(api.issues, 'listActivities').mockResolvedValue({
      activities: [],
      total: 0,
      page: 1,
      page_size: 100,
    })

    render(
      <MemoryRouter initialEntries={['/org/org-1/issues/issue-100']}>
        <AuthProvider>
          <OrgProvider>
            <Routes>
              <Route path="/org/:orgId/issues/:issueId" element={<IssueDetailPage />} />
            </Routes>
          </OrgProvider>
        </AuthProvider>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('ENG-100')).toBeInTheDocument()
      expect(screen.getByText('Server fan speed excessive')).toBeInTheDocument()
    })

    // Click Resolve Issue
    const resolveBtn = screen.getByRole('button', { name: /resolve issue/i })
    fireEvent.click(resolveBtn)

    // Verify modal appeared
    expect(screen.getByText(/please provide a resolution note/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/resolution note/i)).toBeInTheDocument()

    // Submit with resolution note
    const updateSpy = vi.spyOn(api.issues, 'update').mockResolvedValue({
      ...baseIssue,
      status: 'resolved',
      resolution_note: 'Cleaned intake filter and updated BMC firmware',
      version: 2,
    })

    fireEvent.change(screen.getByLabelText(/resolution note/i), {
      target: { value: 'Cleaned intake filter and updated BMC firmware' },
    })

    fireEvent.click(screen.getByRole('button', { name: /confirm resolution/i }))

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith('org-1', 'issue-100', {
        status: 'resolved',
        resolution_note: 'Cleaned intake filter and updated BMC firmware',
        version: 1,
      })
    })
  })
})
