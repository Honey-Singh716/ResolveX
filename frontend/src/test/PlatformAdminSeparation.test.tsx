import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { PlatformAdminLayout } from '../components/PlatformAdminLayout'
import { PlatformAdminGuard } from '../components/RoleGuard'
import { AuthProvider, useAuth } from '../context/AuthContext'
import { OrgProvider } from '../context/OrgContext'
import type { User } from '../types/auth'

vi.mock('../context/AuthContext', async () => {
  const actual = await vi.importActual<typeof import('../context/AuthContext')>('../context/AuthContext')
  return {
    ...actual,
    useAuth: vi.fn(),
  }
})

describe('Platform Admin Separation and Security', () => {
  it('does NOT contain Client Portal navigation in PlatformAdminLayout', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: {
        id: 'admin-1',
        email: 'admin@resolvex.internal',
        full_name: 'Super Admin',
        is_active: true,
        is_platform_admin: true,
        created_at: '2026-10-18T00:00:00Z',
      } as User,
      token: 'admin-token',
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      platformAdminLogin: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
    })

    render(
      <MemoryRouter initialEntries={['/platform-admin/dashboard']}>
        <OrgProvider>
          <PlatformAdminLayout />
        </OrgProvider>
      </MemoryRouter>
    )

    // Ensure Client Portal is nowhere in PlatformAdminLayout navigation
    expect(screen.queryByText(/client portal/i)).not.toBeInTheDocument()
    expect(screen.getByText(/governance dashboard/i)).toBeInTheDocument()
  })

  it('denies authenticated client user access to platform admin route and redirects to /home', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: {
        id: 'client-1',
        email: 'client@company.com',
        full_name: 'Client User',
        is_active: true,
        is_platform_admin: false,
        created_at: '2026-10-18T00:00:00Z',
      } as User,
      token: 'client-token',
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      platformAdminLogin: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
    })

    render(
      <MemoryRouter initialEntries={['/platform-admin/dashboard']}>
        <Routes>
          <Route
            path="/platform-admin/dashboard"
            element={
              <PlatformAdminGuard>
                <div>Admin Secret Content</div>
              </PlatformAdminGuard>
            }
          />
          <Route path="/home" element={<div>Client Landing Home</div>} />
        </Routes>
      </MemoryRouter>
    )

    expect(screen.queryByText('Admin Secret Content')).not.toBeInTheDocument()
    expect(screen.getByText('Client Landing Home')).toBeInTheDocument()
  })

  it('redirects unauthenticated visitor attempting admin route to /platform-admin/login', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      login: vi.fn(),
      platformAdminLogin: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
    })

    render(
      <MemoryRouter initialEntries={['/platform-admin/dashboard']}>
        <Routes>
          <Route
            path="/platform-admin/dashboard"
            element={
              <PlatformAdminGuard>
                <div>Admin Secret Content</div>
              </PlatformAdminGuard>
            }
          />
          <Route path="/platform-admin/login" element={<div>Admin Login Required</div>} />
        </Routes>
      </MemoryRouter>
    )

    expect(screen.queryByText('Admin Secret Content')).not.toBeInTheDocument()
    expect(screen.getByText('Admin Login Required')).toBeInTheDocument()
  })
})
