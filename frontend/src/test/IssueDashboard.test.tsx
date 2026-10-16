import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../context/AuthContext'
import { OrgProvider } from '../context/OrgContext'
import { IssueDashboardPage } from '../pages/IssueDashboardPage'
import { api } from '../services/api'
import type { Issue } from '../types/issue'

describe('IssueDashboardPage', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('renders issue dashboard table with fetched issues', async () => {
    const mockIssues: Issue[] = [
      {
        id: 'issue-1',
        organization_id: 'org-1',
        issue_key: 'ACME-1',
        title: 'Projector faulty in Room 101',
        description: 'Bulb flickering',
        category: 'Hardware',
        priority: 'high',
        status: 'open',
        reporter_id: 'user-1',
        assignee_id: null,
        resolution_note: null,
        version: 1,
        created_at: '2026-10-16T10:00:00Z',
        updated_at: '2026-10-16T10:00:00Z',
      },
    ]

    vi.spyOn(api.issues, 'list').mockResolvedValue({
      issues: mockIssues,
      total: 1,
      page: 1,
      page_size: 15,
    })

    render(
      <MemoryRouter initialEntries={['/org/org-1/issues']}>
        <AuthProvider>
          <OrgProvider>
            <Routes>
              <Route path="/org/:orgId/issues" element={<IssueDashboardPage />} />
            </Routes>
          </OrgProvider>
        </AuthProvider>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('ACME-1')).toBeInTheDocument()
      expect(screen.getByText('Projector faulty in Room 101')).toBeInTheDocument()
      expect(screen.getByText('Hardware')).toBeInTheDocument()
    })
  })

  it('renders empty state when no issues exist', async () => {
    vi.spyOn(api.issues, 'list').mockResolvedValue({
      issues: [],
      total: 0,
      page: 1,
      page_size: 15,
    })

    render(
      <MemoryRouter initialEntries={['/org/org-1/issues']}>
        <AuthProvider>
          <OrgProvider>
            <Routes>
              <Route path="/org/:orgId/issues" element={<IssueDashboardPage />} />
            </Routes>
          </OrgProvider>
        </AuthProvider>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/no issues found/i)).toBeInTheDocument()
    })
  })
})
