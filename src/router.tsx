/* eslint-disable react-refresh/only-export-components -- The router instance owns its route components. */
import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom'
import { ErrorScreen } from '@/components/ErrorScreen'
import { PageLoader } from '@/components/ui/Spinner'
import { SIIGO_INTERNAL_ROLES } from '@/pages/siigo/siigoBooks'
import { useAuthStore } from '@/stores/authStore'

const AppLayout = lazy(() => import('@/components/layout/AppLayout').then(module => ({ default: module.AppLayout })))
const PortalLayout = lazy(() => import('@/components/layout/PortalLayout').then(module => ({ default: module.PortalLayout })))
const LandingPage = lazy(() => import('@/pages/LandingPage').then(module => ({ default: module.LandingPage })))
const LoginPage = lazy(() => import('@/pages/auth/LoginPage').then(module => ({ default: module.LoginPage })))
const ForgotPasswordPage = lazy(() => import('@/pages/auth/ForgotPasswordPage').then(module => ({ default: module.ForgotPasswordPage })))
const AcceptInvitationPage = lazy(() => import('@/pages/auth/AcceptInvitationPage').then(module => ({ default: module.AcceptInvitationPage })))
const ResetPasswordPage = lazy(() => import('@/pages/auth/ResetPasswordPage').then(module => ({ default: module.ResetPasswordPage })))
const DashboardPage = lazy(() => import('@/pages/DashboardPage').then(module => ({ default: module.DashboardPage })))
const ClientDashboard = lazy(() => import('@/pages/client/ClientDashboard').then(module => ({ default: module.ClientDashboard })))
const MyCompanyPage = lazy(() => import('@/pages/client/MyCompanyPage').then(module => ({ default: module.MyCompanyPage })))
const CollectionPage = lazy(() => import('@/pages/collection/CollectionPage').then(module => ({ default: module.CollectionPage })))
const TasksPage = lazy(() => import('@/pages/TasksPage').then(module => ({ default: module.TasksPage })))
const ClientTasksPage = lazy(() => import('@/pages/client/ClientTasksPage').then(module => ({ default: module.ClientTasksPage })))
const AuditPage = lazy(() => import('@/pages/AuditPage').then(module => ({ default: module.AuditPage })))
const OnboardingPage = lazy(() => import('@/pages/onboarding/OnboardingPage').then(module => ({ default: module.OnboardingPage })))
const RegisterCompanyPage = lazy(() => import('@/pages/onboarding/RegisterCompanyPage').then(module => ({ default: module.RegisterCompanyPage })))
const DocumentsPage = lazy(() => import('@/pages/DocumentsPage').then(module => ({ default: module.DocumentsPage })))
const ClientDocumentsPage = lazy(() => import('@/pages/client/ClientDocumentsPage').then(module => ({ default: module.ClientDocumentsPage })))
const CompaniesPage = lazy(() => import('@/pages/CompaniesPage').then(module => ({ default: module.CompaniesPage })))
const ProfilesPage = lazy(() => import('@/pages/ProfilesPage').then(module => ({ default: module.ProfilesPage })))
const RolesPage = lazy(() => import('@/pages/RolesPage').then(module => ({ default: module.RolesPage })))
const SettingsPage = lazy(() => import('@/pages/SettingsPage').then(module => ({ default: module.SettingsPage })))
const RequestsPage = lazy(() => import('@/pages/RequestsPage').then(module => ({ default: module.RequestsPage })))
const ClientRequestsPage = lazy(() => import('@/pages/client/ClientRequestsPage').then(module => ({ default: module.ClientRequestsPage })))
const AccountingPage = lazy(() => import('@/pages/accounting/AccountingPage').then(module => ({ default: module.AccountingPage })))
const ParticipationsPage = lazy(() => import('@/pages/participations/ParticipationsPage').then(module => ({ default: module.ParticipationsPage })))
const SiigoConsultationPage = lazy(() => import('@/pages/siigo/SiigoConsultationPage').then(module => ({ default: module.SiigoConsultationPage })))
const SiigoCollectionsPage = lazy(() => import('@/pages/siigo/SiigoLayout').then(module => ({ default: module.SiigoCollectionsPage })))
const SiigoLayout = lazy(() => import('@/pages/siigo/SiigoLayout').then(module => ({ default: module.SiigoLayout })))
const SiigoTrialBalancePage = lazy(() => import('@/pages/siigo/SiigoTrialBalancePage').then(module => ({ default: module.SiigoTrialBalancePage })))
const SiigoChartsPage = lazy(() => import('@/pages/siigo/SiigoChartsPage').then(module => ({ default: module.SiigoChartsPage })))
const SiigoReceivablesPage = lazy(() => import('@/pages/siigo/SiigoReceivablesPage').then(module => ({ default: module.SiigoReceivablesPage })))
const HubspotDealsPage = lazy(() => import('@/pages/siigo/HubspotDealsPage').then(module => ({ default: module.HubspotDealsPage })))
const TaxProfilesPage = lazy(() => import('@/pages/tax/TaxProfilesPage').then(module => ({ default: module.TaxProfilesPage })))
const ThirdPartiesPage = lazy(() => import('@/pages/tax/ThirdPartiesPage').then(module => ({ default: module.ThirdPartiesPage })))
const TaskTemplatesPage = lazy(() => import('@/pages/TaskTemplatesPage').then(module => ({ default: module.TaskTemplatesPage })))
const BlogAdminPage = lazy(() => import('@/pages/admin/BlogAdminPage').then(module => ({ default: module.BlogAdminPage })))
const ServicesAdminPage = lazy(() => import('@/pages/admin/ServicesAdminPage').then(module => ({ default: module.ServicesAdminPage })))
const LeadsPage = lazy(() => import('@/pages/LeadsPage').then(module => ({ default: module.LeadsPage })))
const DataPolicyPage = lazy(() => import('@/pages/DataPolicyPage').then(module => ({ default: module.DataPolicyPage })))
const TermsPage = lazy(() => import('@/pages/TermsPage').then(module => ({ default: module.TermsPage })))
const CookiePolicyPage = lazy(() => import('@/pages/CookiePolicyPage').then(module => ({ default: module.CookiePolicyPage })))
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage').then(module => ({ default: module.NotFoundPage })))

function LoadingOutlet() {
  return <Suspense fallback={<PageLoader />}><Outlet /></Suspense>
}

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

const routes = [
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
    children: [{
      element: <LoadingOutlet />,
      errorElement: <ErrorScreen />,
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
    }],
  },
  { path: '*', element: <NotFoundPage /> },
]

export const router = createBrowserRouter([
  { element: <LoadingOutlet />, errorElement: <ErrorScreen />, children: routes },
])
