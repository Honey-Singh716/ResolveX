import React from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ClientLayout } from './components/ClientLayout'
import { LoadingSpinner } from './components/LoadingSpinner'
import { OrgLayout } from './components/OrgLayout'
import { PlatformAdminLayout } from './components/PlatformAdminLayout'
import { ClientGuard, OrgGuard, PlatformAdminGuard } from './components/RoleGuard'
import { AuthProvider, useAuth } from './context/AuthContext'
import { OrgProvider } from './context/OrgContext'
import { ClientDashboardPage } from './pages/ClientDashboardPage'
import { ClientTicketDetailsPage } from './pages/ClientTicketDetailsPage'
import { CreateIssuePage } from './pages/CreateIssuePage'
import { IssueDashboardPage } from './pages/IssueDashboardPage'
import { IssueDetailPage } from './pages/IssueDetailPage'
import { LoginPage } from './pages/LoginPage'
import { MembersPage } from './pages/MembersPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { NotificationsPage } from './pages/NotificationsPage'
import { OrgDashboardPage } from './pages/OrgDashboardPage'
import { OrganizationsPage } from './pages/OrganizationsPage'
import { PlatformAdminLoginPage } from './pages/PlatformAdminLoginPage'
import { PlatformAdminPage } from './pages/PlatformAdminPage'
import { HomePage } from './pages/HomePage'
import { ProfilePage } from './pages/ProfilePage'
import { RegisterPage } from './pages/RegisterPage'

/**
 * Smart redirect according to verified server-side roles.
 */
const RootRedirect: React.FC = () => {
  const { user, isLoading } = useAuth()
  if (isLoading) {
    return <LoadingSpinner fullPage label="Authenticating ResolveX session..." />
  }
  if (!user) {
    return <Navigate to="/login" replace />
  }
  if (user.is_platform_admin) {
    return <Navigate to="/platform-admin/dashboard" replace />
  }
  return <Navigate to="/home" replace />
}

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <OrgProvider>
          <Routes>
            {/* Public Authentication Routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/platform-admin/login" element={<PlatformAdminLoginPage />} />

            {/* Smart Root Entry */}
            <Route path="/" element={<RootRedirect />} />

            {/* 1. Client Portal Area (ClientLayout + ClientGuard) */}
            <Route
              path="/client"
              element={
                <ClientGuard>
                  <ClientLayout />
                </ClientGuard>
              }
            >
              <Route index element={<Navigate to="/client/dashboard" replace />} />
              <Route path="dashboard" element={<ClientDashboardPage />} />
              <Route path="tickets/:issueId" element={<ClientTicketDetailsPage />} />
            </Route>

            {/* Global In-App Notifications & Org Directory under Client Shell */}
            <Route
              element={
                <ClientGuard>
                  <ClientLayout />
                </ClientGuard>
              }
            >
              <Route path="/home" element={<HomePage />} />
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route path="/organizations" element={<OrganizationsPage />} />
              <Route path="/profile" element={<ProfilePage />} />
            </Route>

            {/* 2. Organization Owner/Admin/Staff Workspace (OrgLayout + OrgGuard) */}
            <Route
              path="/organization"
              element={
                <OrgGuard>
                  <OrgLayout />
                </OrgGuard>
              }
            >
              <Route index element={<Navigate to="/organization/dashboard" replace />} />
              <Route path="dashboard" element={<OrgDashboardPage />} />
            </Route>

            {/* Specific Org Workspaces: /org/:orgId/* */}
            <Route
              path="/org/:orgId"
              element={
                <OrgGuard>
                  <OrgLayout />
                </OrgGuard>
              }
            >
              <Route index element={<Navigate to="issues" replace />} />
              <Route path="issues" element={<IssueDashboardPage />} />
              <Route path="issues/new" element={<CreateIssuePage />} />
              <Route path="issues/:issueId" element={<IssueDetailPage />} />
              <Route path="members" element={<MembersPage />} />
            </Route>

            {/* 3. Platform Administration Portal (PlatformAdminLayout + PlatformAdminGuard) */}
            <Route
              path="/platform-admin"
              element={
                <PlatformAdminGuard>
                  <PlatformAdminLayout />
                </PlatformAdminGuard>
              }
            >
              <Route index element={<Navigate to="/platform-admin/dashboard" replace />} />
              <Route path="dashboard" element={<PlatformAdminPage />} />
            </Route>

            {/* Backward-compatibility redirect for /platform */}
            <Route
              path="/platform"
              element={<Navigate to="/platform-admin/dashboard" replace />}
            />

            {/* 404 Fallback */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </OrgProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
