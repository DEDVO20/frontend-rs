import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BarChart3, Coins, Users, type LucideIcon } from 'lucide-react'
import { api } from '@/lib/api'
import { PortalTopBar } from '@/components/layout/PortalTopBar'
import { useAuthStore } from '@/stores/authStore'
import { cn } from '@/lib/utils'
import { usePeriodFilter } from '@/pages/siigo/SiigoChartsPage'
import { GestionNegociosTab } from './BusinessDashboard'
import { GestionFinancieraTab } from './FinanceDashboard'

// ── Pestañas ────────────────────────────────────────────────────────────────
type TabId = 'negocios' | 'financiera' | 'personal'
const TABS: { id: TabId; label: string; icon: LucideIcon; title: string; subtitle: string }[] = [
  { id: 'negocios',   label: 'Gestión de Negocios', icon: BarChart3, title: 'Dashboard de negocios', subtitle: 'Control comercial, facturación, recaudo y cartera' },
  { id: 'financiera', label: 'Gestión Financiera',  icon: Coins,     title: 'Dashboard financiero',  subtitle: 'Control financiero y contable' },
  { id: 'personal',   label: 'Gestión de Personal', icon: Users,     title: 'Dashboard de personal', subtitle: 'Gestión del equipo de trabajo' },
]

function ComingSoon({ title, icon: Icon }: { title: string; icon: LucideIcon }) {
  return (
    <div className="rounded-2xl bg-cream-100 dark:bg-navy-900 ring-1 ring-navy-900/5 dark:ring-white/5 py-20 text-center space-y-3">
      <Icon className="w-12 h-12 mx-auto text-gold-500" strokeWidth={1.5} />
      <p className="font-display text-xl font-bold text-navy-900 dark:text-cream-100">{title}</p>
      <p className="text-sm text-navy-900/55 dark:text-cream-100/55">Próximamente: estamos preparando esta vista para tu empresa.</p>
    </div>
  )
}

/**
 * Dashboard de negocios del cliente. Tareas, documentos y solicitudes siguen en su propio menú.
 * El filtro de periodo se conserva al cambiar de pestaña.
 */
export function ClientDashboard() {
  const { user } = useAuthStore()
  const [tab, setTab] = useState<TabId>('negocios')
  const period = usePeriodFilter()

  const { data: company } = useQuery({
    queryKey: ['my-company', user?.companyId],
    queryFn: async () => (await api.get(`/api/companies/${user?.companyId}`)).data,
    enabled: !!user?.companyId,
    staleTime: 60_000,
  })
  const companyName = company?.name ?? 'Mi empresa'
  const current = TABS.find(t => t.id === tab)!

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PortalTopBar title={current.title} subtitle={current.subtitle} companyName={company?.name ?? 'Logo de la empresa'} />

      <div className="flex-1 overflow-y-auto px-5 md:px-8 pb-8 space-y-5">
        {/* Pestañas */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {TABS.map(({ id, label, icon: Icon }) => {
            const active = id === tab
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={cn(
                  'flex items-center justify-center gap-3 py-4 px-4 rounded-2xl text-base font-semibold font-display transition-colors',
                  active
                    ? 'bg-gold-500 text-cream-100 shadow-sm'
                    : 'bg-sand-300/40 text-navy-900 hover:bg-sand-300/70 dark:bg-navy-800 dark:text-cream-100/80 dark:hover:bg-navy-700',
                )}
              >
                <Icon className={cn('w-6 h-6', active ? 'text-cream-100' : 'text-brand-600 dark:text-brand-300')} strokeWidth={1.5} />
                {label}
              </button>
            )
          })}
        </div>

        {tab === 'negocios' && <GestionNegociosTab period={period} companyName={companyName} />}
        {tab === 'financiera' && <GestionFinancieraTab period={period} />}
        {tab === 'personal' && <ComingSoon title="Gestión de Personal" icon={Users} />}
      </div>
    </div>
  )
}
