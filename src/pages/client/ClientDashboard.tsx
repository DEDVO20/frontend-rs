import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { api } from '@/lib/api'
import { PortalTopBar } from '@/components/layout/PortalTopBar'
import { PageLoader } from '@/components/ui/Spinner'
import { FintoIcon, type FintoIconName } from '@/components/ui/FintoIcon'
import { useAuthStore } from '@/stores/authStore'
import { cn } from '@/lib/utils'

// ── Pestañas ────────────────────────────────────────────────────────────────
type TabId = 'general' | 'facturacion' | 'recaudo' | 'cartera' | 'comercial'
const TABS: { id: TabId; label: string; icon: FintoIconName }[] = [
  { id: 'general',     label: 'General',     icon: 'general' },
  { id: 'facturacion', label: 'Facturación', icon: 'facturacion' },
  { id: 'recaudo',     label: 'Recaudo',     icon: 'recaudo' },
  { id: 'cartera',     label: 'Cartera',     icon: 'cartera' },
  { id: 'comercial',   label: 'Comercial',   icon: 'comercial' },
]

function fmtMonth(d?: string) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })
    .replace(/^\w/, c => c.toUpperCase())
}

// ── Medidor semicircular (perfil completado) ────────────────────────────────
function Gauge({ value }: { value: number }) {
  const semi = Math.PI * 42 // longitud del semicírculo r=42
  const dash = Math.max(0, Math.min(100, value)) / 100 * semi
  return (
    <svg viewBox="0 0 100 58" className="w-28">
      <path d="M8 50 A42 42 0 0 1 92 50" fill="none" strokeWidth="10" strokeLinecap="round"
        className="stroke-sand-300 dark:stroke-white/10" />
      <path d="M8 50 A42 42 0 0 1 92 50" fill="none" strokeWidth="10" strokeLinecap="round"
        className="stroke-gold-500" strokeDasharray={`${dash} ${semi}`} />
      <text x="50" y="46" textAnchor="middle" className="fill-navy-900 dark:fill-cream-100 font-display font-bold"
        fontSize="20">{Math.round(value)}%</text>
    </svg>
  )
}

// ── Tarjeta base ────────────────────────────────────────────────────────────
function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('rounded-2xl bg-cream-100 dark:bg-navy-900 ring-1 ring-navy-900/5 dark:ring-white/5 p-5', className)}>
      {children}
    </div>
  )
}

function StatusDot({ tone }: { tone: 'red' | 'amber' | 'green' | 'slate' }) {
  const c = { red: 'bg-red-500', amber: 'bg-gold-500', green: 'bg-emerald-500', slate: 'bg-slate-400' }[tone]
  return <span className={cn('inline-block w-2 h-2 rounded-full shrink-0', c)} />
}

export function ClientDashboard() {
  const { user } = useAuthStore()
  const nav = useNavigate()
  const [tab, setTab] = useState<TabId>('general')

  const { data, isLoading } = useQuery({
    queryKey: ['client-dashboard'],
    queryFn: async () => {
      const [company, tasks, documents, requests] = await Promise.allSettled([
        api.get(`/api/companies/${user?.companyId}`),
        api.get('/api/tasks?limit=100'),
        api.get('/api/documents?limit=10'),
        api.get('/api/requests?limit=100'),
      ])

      const companyData = company.status === 'fulfilled' ? company.value.data : null
      const tasksData   = tasks.status === 'fulfilled' ? tasks.value.data : { data: [], total: 0 }
      const docsData    = documents.status === 'fulfilled' ? documents.value.data : { data: [], total: 0 }
      const reqData     = requests.status === 'fulfilled' ? requests.value.data : { data: [], total: 0 }

      const allTasks: any[] = Array.isArray(tasksData) ? tasksData : (tasksData.data ?? [])
      const today = new Date().toISOString().split('T')[0]!
      const pending = allTasks.filter((t: any) => t.status !== 'done' && t.status !== 'completed')
      const overdue = pending.filter((t: any) => t.due_date && t.due_date < today)

      const allDocs: any[] = Array.isArray(docsData) ? docsData : (docsData.data ?? [])
      const allReqs: any[] = Array.isArray(reqData) ? reqData : (reqData.data ?? [])
      const pendingReqs = allReqs.filter((r: any) => r.status === 'open' || r.status === 'pending' || r.status === 'in_progress')

      // Completitud del perfil (heurística sobre campos de empresa)
      const c = companyData ?? {}
      const fields = [c.name, c.nit, c.email, c.phone, c.address, c.city, c.sector, c.website]
      const filled = fields.filter(Boolean).length
      const profilePct = fields.length ? Math.round((filled / fields.length) * 100) : 0

      return {
        company: companyData, pending, overdue, docs: allDocs, requests: pendingReqs, today, profilePct,
      }
    },
    staleTime: 60_000,
  })

  if (isLoading) return <PageLoader />
  const d = data!

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PortalTopBar title="Dashboard" subtitle="Vista general" companyName={d.company?.name ?? 'Logo de la empresa'} />

      <div className="flex-1 overflow-y-auto px-5 md:px-8 pb-8 space-y-5">

        {/* Barra de pestañas */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {TABS.map(t => {
            const active = t.id === tab
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  'flex items-center justify-center gap-2 py-3 px-3 rounded-xl text-sm font-semibold font-display transition-colors',
                  active
                    ? 'bg-gold-500 text-cream-100 shadow-sm'
                    : 'bg-sand-300/40 text-navy-900/60 hover:bg-sand-300/70 dark:bg-navy-800 dark:text-cream-100/60 dark:hover:bg-navy-700',
                )}
              >
                <FintoIcon name={t.icon} variant={active ? 'white' : 'auto'} size={20} />
                <span className="hidden sm:inline">{t.label}</span>
              </button>
            )
          })}
        </div>

        {tab === 'general' ? (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <Card>
                <p className="text-sm font-bold text-navy-900 dark:text-cream-100 mb-3">Empresa</p>
                <p className="font-display text-3xl font-bold text-brand-600 dark:text-brand-300 leading-none">
                  {d.company?.name ?? '—'}
                </p>
                <p className="text-xs text-navy-900/50 dark:text-cream-100/50 mt-3">NIT: {d.company?.nit ?? '—'}</p>
              </Card>

              <Card>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-bold text-navy-900 dark:text-cream-100 mb-3">Tareas pendientes</p>
                    <p className="text-xs text-navy-900/50 dark:text-cream-100/50">{d.overdue.length} Vencida{d.overdue.length !== 1 ? 's' : ''}</p>
                  </div>
                  <p className="font-display text-4xl font-bold text-navy-900 dark:text-cream-100 leading-none">{d.pending.length}</p>
                </div>
              </Card>

              <Card className="flex items-center justify-between">
                <p className="text-sm font-bold text-navy-900 dark:text-cream-100 max-w-[7rem] leading-snug">Perfil empresa</p>
                <Gauge value={d.profilePct} />
              </Card>
            </div>

            {/* Tareas */}
            <Card className="p-0 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4">
                <h3 className="font-display font-bold text-navy-900 dark:text-cream-100">Tareas</h3>
                <button onClick={() => nav('/app/tasks')} className="text-xs font-semibold text-brand-600 dark:text-brand-300 hover:underline">Ver todas →</button>
              </div>
              <div className="divide-y divide-navy-900/5 dark:divide-white/5">
                {d.pending.slice(0, 6).map((t: any) => {
                  const isOverdue = t.due_date && t.due_date < d.today
                  return (
                    <div key={t.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-4 px-5 py-3">
                      <p className="text-sm text-navy-900 dark:text-cream-100 truncate">{t.title}</p>
                      <span className="text-xs text-navy-900/50 dark:text-cream-100/50 whitespace-nowrap">{fmtMonth(t.due_date)}</span>
                      <span className="flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap">
                        {isOverdue
                          ? <><StatusDot tone="red" /><span className="text-red-500">Vencida</span></>
                          : <><StatusDot tone="amber" /><span className="text-gold-600 dark:text-gold-400">En proceso</span></>}
                      </span>
                    </div>
                  )
                })}
                {!d.pending.length && <p className="text-center text-sm text-navy-900/40 dark:text-cream-100/40 py-8">Sin tareas pendientes 🎉</p>}
              </div>
            </Card>

            {/* Documentos + Solicitudes */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <Card className="p-0 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4">
                  <h3 className="font-display font-bold text-navy-900 dark:text-cream-100">Documentos recientes</h3>
                  <button onClick={() => nav('/app/documents')} className="text-xs font-semibold text-brand-600 dark:text-brand-300 hover:underline">Ver todos →</button>
                </div>
                <div className="divide-y divide-navy-900/5 dark:divide-white/5">
                  {d.docs.slice(0, 5).map((doc: any, i: number) => (
                    <div key={doc.id ?? i} className="flex items-center gap-3 px-5 py-3">
                      <FintoIcon name="documentos" size={18} />
                      <p className="flex-1 text-sm text-navy-900 dark:text-cream-100 truncate">{doc.title ?? doc.name ?? doc.file_name ?? '—'}</p>
                      <span className="w-16 h-1.5 rounded-full" style={{ background: ['#3D6BC1', '#BC984A', '#DBC59C', '#1A2545'][i % 4] }} />
                    </div>
                  ))}
                  {!d.docs.length && <p className="text-center text-sm text-navy-900/40 dark:text-cream-100/40 py-8">Sin documentos</p>}
                </div>
              </Card>

              <Card className="p-0 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4">
                  <h3 className="font-display font-bold text-navy-900 dark:text-cream-100">Solicitudes pendientes</h3>
                  <button onClick={() => nav('/app/requests')} className="text-xs font-semibold text-brand-600 dark:text-brand-300 hover:underline">Ver todas →</button>
                </div>
                <div className="divide-y divide-navy-900/5 dark:divide-white/5">
                  {d.requests.slice(0, 5).map((r: any, i: number) => (
                    <div key={r.id ?? i} className="flex items-center gap-3 px-5 py-3">
                      <FintoIcon name="solicitudes" size={18} />
                      <p className="flex-1 text-sm text-navy-900 dark:text-cream-100 truncate">{r.title ?? r.subject ?? r.type ?? 'Solicitud'}</p>
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-gold-600 dark:text-gold-400 whitespace-nowrap">
                        <StatusDot tone="amber" /> En proceso
                      </span>
                    </div>
                  ))}
                  {!d.requests.length && <p className="text-center text-sm text-navy-900/40 dark:text-cream-100/40 py-8">Sin solicitudes pendientes</p>}
                </div>
              </Card>
            </div>
          </>
        ) : (
          // Pestañas pendientes de datos (Facturación, Recaudo, Cartera, Comercial)
          <Card className="flex flex-col items-center justify-center text-center py-20">
            <FintoIcon name={TABS.find(t => t.id === tab)!.icon} size={48} className="mb-4 opacity-70" />
            <h3 className="font-display text-xl font-bold text-navy-900 dark:text-cream-100 mb-1">
              {TABS.find(t => t.id === tab)!.label}
            </h3>
            <p className="text-sm text-navy-900/50 dark:text-cream-100/50 max-w-sm">
              Esta sección estará disponible próximamente con sus indicadores y gráficas.
            </p>
          </Card>
        )}
      </div>
    </div>
  )
}
