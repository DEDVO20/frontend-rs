import { NavLink } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'
import { FintoLogo } from '@/components/ui/FintoLogo'
import { FintoIcon, type FintoIconName } from '@/components/ui/FintoIcon'
import { LogOut, X } from 'lucide-react'

type Item = {
  to: string
  label: string
  icon: FintoIconName
  external?: boolean
  module?: string
  badgeKey?: string
}

type Group = { title: string; items: Item[] }

const GROUPS: Group[] = [
  {
    title: 'Principal',
    items: [
      { to: '/app/dashboard',   label: 'Dashboard',      icon: 'dashboard' },
      { to: '/app/my-company',  label: 'Perfil empresa', icon: 'perfil-empresa' },
      { to: '/app/tasks',       label: 'Tareas',         icon: 'tareas',      badgeKey: 'overdueTasks' },
      { to: '/app/documents',   label: 'Documentos',     icon: 'documentos' },
      { to: '/app/requests',    label: 'Solicitudes',    icon: 'solicitudes', badgeKey: 'openRequests' },
    ],
  },
]

// Módulos opcionales del cliente (solo si están habilitados en su empresa)
const MODULE_ITEMS: Item[] = [
  { to: '/app/accounting',     label: 'Contabilidad',   icon: 'doc-money', module: 'accounting' },
  { to: '/app/participations', label: 'Participaciones', icon: 'briefcase', module: 'participations' },
  { to: '/app/dashboards-bi',  label: 'Dashboards BI',  icon: 'analytics' },
]

const SYSTEM: Group = {
  title: 'Sistema',
  items: [{ to: '/', label: 'Finto Web', icon: 'finto-web', external: true }],
}

interface Props { onClose?: () => void }

export function PortalSidebar({ onClose }: Props) {
  const { user, logout } = useAuthStore()

  const { data: badges } = useQuery({
    queryKey: ['portal-badges'],
    queryFn: async () => {
      const [tasks, requests] = await Promise.allSettled([
        api.get('/api/tasks?limit=100'),
        api.get('/api/requests?limit=100'),
      ])
      const allTasks: any[] = tasks.status === 'fulfilled'
        ? (Array.isArray(tasks.value.data) ? tasks.value.data : (tasks.value.data.data ?? []))
        : []
      const today = new Date().toISOString().split('T')[0]!
      const overdue = allTasks.filter((t: any) => t.status !== 'done' && t.status !== 'completed' && t.due_date && t.due_date < today)

      const allReqs: any[] = requests.status === 'fulfilled'
        ? (Array.isArray(requests.value.data) ? requests.value.data : (requests.value.data.data ?? []))
        : []
      const open = allReqs.filter((r: any) => r.status === 'open' || r.status === 'pending')

      return {
        overdueTasks: overdue.length || undefined,
        openRequests: open.length || undefined,
      } as Record<string, number | undefined>
    },
    staleTime: 120_000,
    refetchInterval: 120_000,
  })

  const moduleItems = MODULE_ITEMS.filter(i => !i.module || user?.modules?.includes(i.module))
  const groups: Group[] = [
    ...GROUPS,
    ...(moduleItems.length ? [{ title: 'Módulos', items: moduleItems }] : []),
    SYSTEM,
  ]

  return (
    <aside className="flex flex-col w-64 h-full shrink-0 bg-cream-100 dark:bg-navy-950
                      border-r border-gold-500/30 dark:border-white/5">
      {/* Logo */}
      <div className="flex items-center justify-between px-5 py-6">
        <FintoLogo height={30} />
        {onClose && (
          <button onClick={onClose} className="text-navy-900/60 dark:text-cream-100/60 hover:opacity-100 lg:hidden p-1">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Grupos de navegación */}
      <nav className="flex-1 px-3 space-y-4 overflow-y-auto">
        {groups.map(group => (
          <div key={group.title} className="rounded-2xl bg-navy-900 dark:bg-navy-800 px-2.5 py-3">
            <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.15em] text-gold-400">
              {group.title}
            </p>
            <div className="space-y-1">
              {group.items.map(item => {
                const count = item.badgeKey ? badges?.[item.badgeKey] : undefined

                if (item.external) {
                  return (
                    <a
                      key={item.to + item.label}
                      href={item.to}
                      target="_blank"
                      rel="noopener"
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
                                 text-cream-100/80 hover:bg-white/10 hover:text-white transition-colors"
                    >
                      <FintoIcon name={item.icon} variant="white" size={22} />
                      <span className="flex-1">{item.label}</span>
                    </a>
                  )
                }

                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={onClose}
                    className={({ isActive }) => cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-cream-100 text-navy-900 shadow-sm'
                        : 'text-cream-100/80 hover:bg-white/10 hover:text-white',
                    )}
                  >
                    {({ isActive }) => (
                      <>
                        <FintoIcon name={item.icon} variant={isActive ? 'navy' : 'white'} size={22} />
                        <span className="flex-1">{item.label}</span>
                        {count !== undefined && count > 0 && (
                          <span className="text-[10px] font-bold text-white bg-red-500 px-1.5 py-0.5 rounded-full min-w-[20px] text-center leading-none">
                            {count}
                          </span>
                        )}
                      </>
                    )}
                  </NavLink>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Pie: Usuario */}
      <div className="px-4 py-4 mt-2 border-t border-gold-500/25 dark:border-white/5">
        <div className="flex items-center gap-3">
          <FintoIcon name="usuario" size={30} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-navy-900 dark:text-cream-100 truncate">
              {user?.full_name ?? 'Usuario'}
            </p>
            <p className="text-xs text-navy-900/50 dark:text-cream-100/50 truncate">{user?.email}</p>
          </div>
          <button
            onClick={logout}
            className="text-navy-900/40 dark:text-cream-100/40 hover:text-red-500 transition-colors"
            title="Cerrar sesión"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}
