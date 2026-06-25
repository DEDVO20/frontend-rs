import { NavLink } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'
import {
  LayoutDashboard, Building2, UserCheck, ClipboardList,
  FileText, MessageSquareMore, Landmark, BarChart3,
  Users, Settings, Globe, LogOut, X,
} from 'lucide-react'

type NavItem = {
  to: string
  label: string
  icon: any
  module?: string
  badgeKey?: string
  badgeColor?: string
  adminOnly?: boolean
  clientOnly?: boolean
}

const INTERNAL_ROLES = ['admin', 'rs_admin', 'rs_staff']

const SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: 'Principal',
    items: [
      { to: '/app/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/app/companies', label: 'Empresas', icon: Building2, adminOnly: true, badgeKey: 'companies', badgeColor: 'bg-slate-600' },
      { to: '/app/my-company', label: 'Mi empresa', icon: Building2, clientOnly: true },
      { to: '/app/onboarding', label: 'Onboarding', icon: UserCheck, adminOnly: true, module: 'onboarding' },
      { to: '/app/tasks', label: 'Tareas', icon: ClipboardList, badgeKey: 'overdueTasks', badgeColor: 'bg-red-500' },
      { to: '/app/documents', label: 'Documentos', icon: FileText, badgeKey: 'documents', badgeColor: 'bg-slate-600' },
      { to: '/app/requests', label: 'Solicitudes', icon: MessageSquareMore, badgeKey: 'openRequests', badgeColor: 'bg-red-500' },
    ],
  },
  {
    title: 'Módulos',
    items: [
      { to: '/app/collection', label: 'Cartera', icon: Landmark, adminOnly: true, module: 'collection' },
      { to: '/app/dashboards-bi', label: 'Dashboards BI', icon: BarChart3 },
    ],
  },
  {
    title: 'Sistema',
    items: [
      { to: '/app/profiles', label: 'Usuarios', icon: Users, adminOnly: true },
      { to: '/app/settings', label: 'Configuración', icon: Settings, adminOnly: true },
      { to: '/', label: 'Ver sitio web', icon: Globe },
    ],
  },
]

interface Props { onClose?: () => void }

export function Sidebar({ onClose }: Props) {
  const { user, logout } = useAuthStore()
  const isAdmin = INTERNAL_ROLES.includes(user?.role ?? '')

  const { data: badges } = useQuery({
    queryKey: ['sidebar-badges', isAdmin],
    queryFn: async () => {
      const calls = [
        isAdmin ? api.get('/api/companies?limit=1') : Promise.reject(),
        api.get('/api/tasks?limit=100'),
        api.get('/api/documents?limit=1'),
        api.get('/api/requests?limit=100'),
      ]
      const [companies, tasks, documents, requests] = await Promise.allSettled(calls)

      const totalCompanies = companies.status === 'fulfilled' ? (companies.value.data.total ?? 0) : 0

      const allTasks: any[] = tasks.status === 'fulfilled'
        ? (Array.isArray(tasks.value.data) ? tasks.value.data : (tasks.value.data.data ?? []))
        : []
      const today = new Date().toISOString().split('T')[0]!
      const overdue = allTasks.filter((t: any) => t.status !== 'done' && t.status !== 'completed' && t.due_date && t.due_date < today)

      const totalDocs = documents.status === 'fulfilled' ? (documents.value.data.total ?? 0) : 0

      const allReqs: any[] = requests.status === 'fulfilled'
        ? (Array.isArray(requests.value.data) ? requests.value.data : (requests.value.data.data ?? []))
        : []
      const open = allReqs.filter((r: any) => r.status === 'open' || r.status === 'pending')

      return {
        companies: totalCompanies || undefined,
        overdueTasks: overdue.length || undefined,
        documents: totalDocs || undefined,
        openRequests: open.length || undefined,
      } as Record<string, number | undefined>
    },
    staleTime: 120_000,
    refetchInterval: 120_000,
  })

  return (
    <aside className="flex flex-col w-64 bg-slate-900 text-white shrink-0 h-full">
      {/* Logo */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary-500 flex items-center justify-center shrink-0">
            <span className="text-white font-bold text-sm">F</span>
          </div>
          <div>
            <p className="font-semibold text-sm leading-tight">Finto</p>
            <p className="text-xs text-slate-400 leading-tight">Gestión Empresarial</p>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-slate-400 hover:text-white lg:hidden p-1">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Nav sections */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-5">
        {SECTIONS.map(section => {
          const visibleItems = section.items.filter(item => {
            if (item.adminOnly && !isAdmin) return false
            if (item.clientOnly && isAdmin) return false
            if (item.module && !user?.modules?.includes(item.module)) return false
            return true
          })
          if (!visibleItems.length) return null

          return (
            <div key={section.title}>
              <p className="px-3 pb-2 text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
                {section.title}
              </p>
              <div className="space-y-0.5">
                {visibleItems.map(({ to, label, icon: Icon, badgeKey, badgeColor }) => {
                  const count = badgeKey ? badges?.[badgeKey] : undefined
                  const isExternal = to === '/'

                  if (isExternal) {
                    return (
                      <a
                        key={to + label}
                        href="/"
                        target="_blank"
                        rel="noopener"
                        className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        <span className="flex-1">{label}</span>
                      </a>
                    )
                  }

                  return (
                    <NavLink
                      key={to}
                      to={to}
                      onClick={onClose}
                      className={({ isActive }) => cn(
                        'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                        isActive
                          ? 'bg-primary-600 text-white'
                          : 'text-slate-400 hover:bg-slate-800 hover:text-white',
                      )}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="flex-1">{label}</span>
                      {count !== undefined && count > 0 && (
                        <span className={`text-[10px] font-bold text-white px-1.5 py-0.5 rounded-full min-w-[20px] text-center leading-none ${badgeColor ?? 'bg-slate-600'}`}>
                          {count}
                        </span>
                      )}
                    </NavLink>
                  )
                })}
              </div>
            </div>
          )
        })}
      </nav>

      {/* User footer */}
      <div className="px-3 py-4 border-t border-slate-800">
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg">
          <div className="w-8 h-8 rounded-full bg-primary-700 flex items-center justify-center shrink-0">
            <span className="text-xs font-semibold text-primary-200">
              {user?.email?.[0]?.toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-white truncate">{user?.email}</p>
            <p className="text-xs text-slate-400 capitalize">{user?.role?.replace('_', ' ')}</p>
          </div>
          <button
            onClick={logout}
            className="text-slate-500 hover:text-red-400 transition-colors"
            title="Cerrar sesión"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}
