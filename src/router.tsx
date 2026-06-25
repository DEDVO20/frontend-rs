import { createBrowserRouter, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { AppLayout } from '@/components/layout/AppLayout'
import { LandingPage } from '@/pages/LandingPage'
import { LoginPage } from '@/pages/auth/LoginPage'
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage'
import { AcceptInvitationPage } from '@/pages/auth/AcceptInvitationPage'
import { ResetPasswordPage } from '@/pages/auth/ResetPasswordPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { ClientDashboard } from '@/pages/client/ClientDashboard'
import { MyCompanyPage } from '@/pages/client/MyCompanyPage'
import { CollectionPage } from '@/pages/collection/CollectionPage'
import { TasksPage } from '@/pages/TasksPage'
import { AuditPage } from '@/pages/AuditPage'
import { OnboardingPage } from '@/pages/onboarding/OnboardingPage'
import { RegisterCompanyPage } from '@/pages/onboarding/RegisterCompanyPage'
import { DocumentsPage } from '@/pages/DocumentsPage'
import { CompaniesPage } from '@/pages/CompaniesPage'
import { ProfilesPage } from '@/pages/ProfilesPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { RequestsPage } from '@/pages/RequestsPage'
import { DashboardsBIPage } from '@/pages/DashboardsBIPage'
import { TaskTemplatesPage } from '@/pages/TaskTemplatesPage'
import { NotFoundPage } from '@/pages/NotFoundPage'

const INTERNAL_ROLES = ['admin', 'rs_admin', 'rs_staff']

function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = useAuthStore(s => s.accessToken)
  if (!token) return <Navigate to="/login" replace />
  return <>{children}</>
}

function SmartDashboard() {
  const role = useAuthStore(s => s.user?.role ?? '')
  return INTERNAL_ROLES.includes(role) ? <DashboardPage /> : <ClientDashboard />
}

export const router = createBrowserRouter([
  { path: '/',                           element: <LandingPage /> },
  { path: '/login',                      element: <LoginPage /> },
  { path: '/forgot-password',            element: <ForgotPasswordPage /> },
  { path: '/register',                   element: <RegisterCompanyPage /> },
  { path: '/invitations/accept',         element: <AcceptInvitationPage /> },
  { path: '/reset-password',             element: <ResetPasswordPage /> },
  {
    path: '/app',
    element: <RequireAuth><AppLayout /></RequireAuth>,
    children: [
      { index: true,          element: <Navigate to="/app/dashboard" replace /> },
      { path: 'dashboard',    element: <SmartDashboard /> },
      { path: 'my-company',   element: <MyCompanyPage /> },
      { path: 'collection',   element: <CollectionPage /> },
      { path: 'onboarding',   element: <OnboardingPage /> },
      { path: 'tasks',        element: <TasksPage /> },
      { path: 'documents',    element: <DocumentsPage /> },
      { path: 'companies',    element: <CompaniesPage /> },
      { path: 'requests',     element: <RequestsPage /> },
      { path: 'dashboards-bi', element: <DashboardsBIPage /> },
      { path: 'task-templates', element: <TaskTemplatesPage /> },
      { path: 'profiles',     element: <ProfilesPage /> },
      { path: 'audit',        element: <AuditPage /> },
      { path: 'settings',     element: <SettingsPage /> },
      { path: '*',            element: <NotFoundPage /> },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
])
