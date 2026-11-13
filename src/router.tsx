import { createBrowserRouter, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { AppLayout } from '@/components/layout/AppLayout'
import { PortalLayout } from '@/components/layout/PortalLayout'
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
import { ClientTasksPage } from '@/pages/client/ClientTasksPage'
import { AuditPage } from '@/pages/AuditPage'
import { OnboardingPage } from '@/pages/onboarding/OnboardingPage'
import { RegisterCompanyPage } from '@/pages/onboarding/RegisterCompanyPage'
import { DocumentsPage } from '@/pages/DocumentsPage'
import { ClientDocumentsPage } from '@/pages/client/ClientDocumentsPage'
import { CompaniesPage } from '@/pages/CompaniesPage'
import { ProfilesPage } from '@/pages/ProfilesPage'
import { RolesPage } from '@/pages/RolesPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { RequestsPage } from '@/pages/RequestsPage'
import { ClientRequestsPage } from '@/pages/client/ClientRequestsPage'
import { AccountingPage } from '@/pages/accounting/AccountingPage'
import { ParticipationsPage } from '@/pages/participations/ParticipationsPage'
import { SiigoConsultationPage } from '@/pages/siigo/SiigoConsultationPage'
import { SiigoCollectionsPage, SiigoLayout, SIIGO_INTERNAL_ROLES } from '@/pages/siigo/SiigoLayout'
import { SiigoTrialBalancePage } from '@/pages/siigo/SiigoTrialBalancePage'
import { SiigoChartsPage } from '@/pages/siigo/SiigoChartsPage'
import { SiigoReceivablesPage } from '@/pages/siigo/SiigoReceivablesPage'
import { HubspotDealsPage } from '@/pages/siigo/HubspotDealsPage'
import { TaxProfilesPage } from '@/pages/tax/TaxProfilesPage'
import { ThirdPartiesPage } from '@/pages/tax/ThirdPartiesPage'
import { TaskTemplatesPage } from '@/pages/TaskTemplatesPage'
import { BlogAdminPage } from '@/pages/admin/BlogAdminPage'
import { ServicesAdminPage } from '@/pages/admin/ServicesAdminPage'
import { LeadsPage }     from '@/pages/LeadsPage'
import { DataPolicyPage } from '@/pages/DataPolicyPage'
import { TermsPage }     from '@/pages/TermsPage'
import { CookiePolicyPage } from '@/pages/CookiePolicyPage'
import { NotFoundPage }  from '@/pages/NotFoundPage'

const INTERNAL_ROLES = ['admin', 'rs_admin', 'rs_staff']

function RequireAuth({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore(s => !!s.user)
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

/** Clientes usan el layout del portal (estética Finto); el personal interno, el back-office. */
function RoleLayout() {
  const role = useAuthStore(s => s.user?.role ?? '')
  return INTERNAL_ROLES.includes(role) ? <AppLayout /> : <PortalLayout />
}

function SmartDashboard() {
  const role = useAuthStore(s => s.user?.role ?? '')
  // El contador aterriza directo en su dashboard contable
  if (role === 'contador') return <Navigate to="/app/accounting" replace />
  return INTERNAL_ROLES.includes(role) ? <DashboardPage /> : <ClientDashboard />
}

/** Los clientes tienen estas gráficas en las pestañas de su Dashboard */
function SmartSiigoCharts() {
  const role = useAuthStore(s => s.user?.role ?? '')
  return SIIGO_INTERNAL_ROLES.includes(role) ? <SiigoChartsPage /> : <Navigate to="/app/dashboard" replace />
}

/** Facturación Siigo está oculta para el cliente: solo equipo interno y contador */
function SmartSiigo() {
  const role = useAuthStore(s => s.user?.role ?? '')
  return SIIGO_INTERNAL_ROLES.includes(role) ? <SiigoLayout /> : <Navigate to="/app/dashboard" replace />
}

function SmartTasks() {
  const role = useAuthStore(s => s.user?.role ?? '')
  return INTERNAL_ROLES.includes(role) ? <TasksPage /> : <ClientTasksPage />
}

function SmartDocuments() {
  const role = useAuthStore(s => s.user?.role ?? '')
  return INTERNAL_ROLES.includes(role) ? <DocumentsPage /> : <ClientDocumentsPage />
}

function SmartRequests() {
  const role = useAuthStore(s => s.user?.role ?? '')
  return INTERNAL_ROLES.includes(role) ? <RequestsPage /> : <ClientRequestsPage />
}

export const router = createBrowserRouter([
  { path: '/',                           element: <LandingPage /> },
  { path: '/login',                      element: <LoginPage /> },
  { path: '/forgot-password',            element: <ForgotPasswordPage /> },
  { path: '/register',                   element: <RegisterCompanyPage /> },
  { path: '/politica-tratamiento-datos', element: <DataPolicyPage /> },
  { path: '/politica-privacidad',        element: <Navigate to="/politica-tratamiento-datos" replace /> },
  { path: '/terminos-y-condiciones',     element: <TermsPage /> },
  { path: '/politica-cookies',           element: <CookiePolicyPage /> },
  { path: '/invitations/accept',        element: <AcceptInvitationPage /> },
  { path: '/reset-password',             element: <ResetPasswordPage /> },
  {
    path: '/app',
    element: <RequireAuth><RoleLayout /></RequireAuth>,
    children: [
      { index: true,          element: <Navigate to="/app/dashboard" replace /> },
      { path: 'dashboard',    element: <SmartDashboard /> },
      { path: 'my-company',   element: <MyCompanyPage /> },
      { path: 'collection',   element: <CollectionPage /> },
      { path: 'accounting',   element: <AccountingPage /> },
      { path: 'participations', element: <ParticipationsPage /> },
      {
        path: 'siigo',
        element: <SmartSiigo />,
        children: [
          { index: true,         element: <Navigate to="facturacion" replace /> },
          { path: 'facturacion', element: <SiigoConsultationPage /> },
          // Clientes y equipo: cada uno ve los libros que le corresponden (el backend aplica el alcance)
          { path: 'recaudo',     element: <SiigoCollectionsPage /> },
          { path: 'cartera',     element: <SiigoReceivablesPage /> },
          { path: 'balance',     element: <SiigoTrialBalancePage /> },
          { path: 'crm',         element: <HubspotDealsPage /> },
        ],
      },
      { path: 'siigo-graficas', element: <SmartSiigoCharts /> },
      { path: 'tax-profiles', element: <TaxProfilesPage /> },
      { path: 'third-parties', element: <ThirdPartiesPage /> },
      { path: 'onboarding',   element: <OnboardingPage /> },
      { path: 'tasks',        element: <SmartTasks /> },
      { path: 'documents',    element: <SmartDocuments /> },
      { path: 'companies',    element: <CompaniesPage /> },
      { path: 'requests',     element: <SmartRequests /> },
      { path: 'services',     element: <ServicesAdminPage /> },
      { path: 'task-templates', element: <TaskTemplatesPage /> },
      { path: 'profiles',     element: <ProfilesPage /> },
      { path: 'roles',        element: <RolesPage /> },
      { path: 'blog',         element: <BlogAdminPage /> },
      { path: 'leads',        element: <LeadsPage /> },
      { path: 'audit',        element: <AuditPage /> },
      { path: 'settings',     element: <SettingsPage /> },
      { path: '*',            element: <NotFoundPage /> },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
])
