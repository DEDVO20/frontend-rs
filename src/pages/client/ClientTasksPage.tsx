import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { PortalTopBar } from '@/components/layout/PortalTopBar'
import { PageLoader } from '@/components/ui/Spinner'
import { FintoIcon } from '@/components/ui/FintoIcon'
import { TaskDrawer } from '@/pages/TasksPage'
import { useAuthStore } from '@/stores/authStore'
import { cn } from '@/lib/utils'
import { Search, ChevronLeft, ChevronRight } from 'lucide-react'

function fmtDate(d?: string) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

type StatusKey = 'overdue' | 'in_progress' | 'done'
const STATUS: Record<StatusKey, { label: string; text: string; dot: string }> = {
  overdue:     { label: 'Vencida',    text: 'text-red-500',                        dot: 'bg-red-500' },
  in_progress: { label: 'En proceso', text: 'text-gold-600 dark:text-gold-400',    dot: 'bg-gold-500' },
  done:        { label: 'Completada', text: 'text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500' },
}

function statusOf(t: any, today: string): StatusKey {
  if (t.status === 'done') return 'done'
  if (t.due_date && t.due_date < today) return 'overdue'
  return 'in_progress'
}

// ── Medidor semicircular ────────────────────────────────────────────────────
function Gauge({ value }: { value: number }) {
  const semi = Math.PI * 42
  const dash = Math.max(0, Math.min(100, value)) / 100 * semi
  return (
    <svg viewBox="0 0 100 58" className="w-40">
      <path d="M8 50 A42 42 0 0 1 92 50" fill="none" strokeWidth="10" strokeLinecap="round" className="stroke-sand-300 dark:stroke-white/10" />
      <path d="M8 50 A42 42 0 0 1 92 50" fill="none" strokeWidth="10" strokeLinecap="round" className="stroke-gold-500" strokeDasharray={`${dash} ${semi}`} />
      <text x="50" y="46" textAnchor="middle" className="fill-navy-900 dark:fill-cream-100 font-display font-bold" fontSize="20">{Math.round(value)}%</text>
    </svg>
  )
}

function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('rounded-2xl bg-cream-100 dark:bg-navy-900 ring-1 ring-navy-900/5 dark:ring-white/5', className)}>{children}</div>
}

const PAGE_SIZE = 8

export function ClientTasksPage() {
  const { user } = useAuthStore()
  const [searchQ, setSearchQ] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusKey | ''>('')
  const [serviceFilter, setServiceFilter] = useState('')
  const [page, setPage] = useState(1)
  const [viewId, setViewId] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['client-tasks'],
    queryFn: async () => (await api.get('/api/tasks?limit=100')).data,
    staleTime: 30_000,
  })

  const allTasks: any[] = Array.isArray(data) ? data : (data?.data ?? [])
  const today = new Date().toISOString().split('T')[0]!

  const total = data?.total ?? allTasks.length
  const overdue   = allTasks.filter(t => statusOf(t, today) === 'overdue').length
  const inProcess = allTasks.filter(t => statusOf(t, today) === 'in_progress').length
  const completed = allTasks.filter(t => statusOf(t, today) === 'done').length
  const progress  = allTasks.length ? Math.round((completed / allTasks.length) * 100) : 0

  const serviceNames = useMemo(
    () => Array.from(new Set(allTasks.map(t => t.services?.name).filter(Boolean))) as string[],
    [allTasks],
  )

  const filtered = allTasks.filter(t => {
    if (searchQ && !t.title?.toLowerCase().includes(searchQ.toLowerCase())) return false
    if (statusFilter && statusOf(t, today) !== statusFilter) return false
    if (serviceFilter && t.services?.name !== serviceFilter) return false
    return true
  })

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const encargado = (t: any) => t.owner_type === 'rs_team' ? 'Finto' : (t.companies?.name ?? user?.full_name ?? 'Cliente')

  const STATS = [
    { label: 'Total tareas', value: total,     sub: 'en todas las empresas',        bar: 'bg-navy-900 dark:bg-brand-400', num: 'text-navy-900 dark:text-cream-100' },
    { label: 'Vencidas',     value: overdue,   sub: 'requieren atención inmediata', bar: 'bg-red-500',     num: 'text-red-500' },
    { label: 'En proceso',   value: inProcess, sub: 'por completar',                bar: 'bg-gold-500',    num: 'text-gold-600 dark:text-gold-400' },
    { label: 'Completadas',  value: completed, sub: 'finalizadas',                  bar: 'bg-emerald-500', num: 'text-emerald-600 dark:text-emerald-400' },
  ]

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PortalTopBar title="Tareas" subtitle="Gestión de tareas" companyName={user?.full_name ?? 'Logo de la empresa'} />

      <div className="flex-1 overflow-y-auto px-5 md:px-8 pb-8 space-y-5">

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {STATS.map(s => (
            <Card key={s.label} className="overflow-hidden">
              <div className={cn('h-1.5', s.bar)} />
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <p className="text-sm font-bold text-navy-900 dark:text-cream-100">{s.label}</p>
                  <p className={cn('font-display text-3xl font-bold leading-none', s.num)}>{s.value}</p>
                </div>
                <p className="text-xs text-navy-900/45 dark:text-cream-100/45 mt-3">{s.sub}</p>
              </div>
            </Card>
          ))}
        </div>

        {/* Filtros + progreso */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <Card className="lg:col-span-2 p-5 space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-navy-900/40 dark:text-cream-100/40" />
                <input
                  value={searchQ}
                  onChange={e => { setSearchQ(e.target.value); setPage(1) }}
                  placeholder="Buscar tarea..."
                  className="w-full pl-10 pr-3 py-2.5 text-sm rounded-xl bg-cream-50 dark:bg-navy-800 ring-1 ring-navy-900/10 dark:ring-white/10
                             text-navy-900 dark:text-cream-100 placeholder:text-navy-900/40 dark:placeholder:text-cream-100/40
                             focus:outline-none focus:ring-2 focus:ring-brand-400"
                />
              </div>
              <div className="flex gap-1.5">
                {([['overdue', 'Vencidas'], ['in_progress', 'En proceso'], ['done', 'Completadas']] as const).map(([key, label]) => {
                  const active = statusFilter === key
                  const tone = { overdue: 'bg-red-500', in_progress: 'bg-gold-500', done: 'bg-emerald-500' }[key]
                  return (
                    <button
                      key={key}
                      onClick={() => { setStatusFilter(active ? '' : key); setPage(1) }}
                      className={cn('text-xs font-semibold px-3 py-1.5 rounded-full transition-colors text-cream-100',
                        tone, active ? 'ring-2 ring-offset-1 ring-navy-900/30 dark:ring-offset-navy-900' : 'opacity-80 hover:opacity-100')}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <p className="text-[11px] font-bold text-brand-600 dark:text-brand-300 uppercase tracking-wider mb-2">Por servicio</p>
              <select
                value={serviceFilter}
                onChange={e => { setServiceFilter(e.target.value); setPage(1) }}
                className="w-full px-4 py-2.5 text-sm rounded-xl bg-cream-50 dark:bg-navy-800 ring-1 ring-navy-900/10 dark:ring-white/10
                           text-navy-900 dark:text-cream-100 focus:outline-none focus:ring-2 focus:ring-brand-400 [&>option]:text-navy-900"
              >
                <option value="">Todos los servicios</option>
                {serviceNames.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </Card>

          <Card className="p-5 flex flex-col items-center justify-center">
            <p className="text-sm font-bold text-navy-900 dark:text-cream-100 self-start mb-2">Progreso en tareas</p>
            <Gauge value={progress} />
          </Card>
        </div>

        {/* Tabla */}
        <Card className="overflow-hidden">
          <div className="px-5 py-4">
            <h3 className="font-display font-bold text-navy-900 dark:text-cream-100">Todas las tareas</h3>
          </div>

          {isLoading ? <div className="py-10"><PageLoader /></div> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="bg-sand-300/40 dark:bg-navy-800 text-[10px] font-bold uppercase tracking-wider text-navy-900/50 dark:text-cream-100/50">
                    <th className="text-left px-5 py-2.5">Tarea</th>
                    <th className="text-left px-4 py-2.5">Encargado</th>
                    <th className="text-left px-4 py-2.5">Vencimiento</th>
                    <th className="text-left px-4 py-2.5">Estado</th>
                    <th className="text-left px-4 py-2.5">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-900/5 dark:divide-white/5">
                  {pageRows.map((t: any) => {
                    const s = STATUS[statusOf(t, today)]
                    return (
                      <tr key={t.id} className="hover:bg-sand-300/20 dark:hover:bg-white/5 transition-colors">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2 max-w-[280px]">
                            <FintoIcon name="check-circle" size={16} />
                            <span className="text-brand-700 dark:text-brand-300 font-medium truncate">{t.title}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-navy-900/70 dark:text-cream-100/70">{encargado(t)}</td>
                        <td className="px-4 py-3 text-navy-900/70 dark:text-cream-100/70 whitespace-nowrap">{fmtDate(t.due_date)}</td>
                        <td className="px-4 py-3">
                          <span className={cn('inline-flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap', s.text)}>
                            <span className={cn('w-2 h-2 rounded-full', s.dot)} /> {s.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button onClick={() => setViewId(t.id)} className="text-xs font-medium text-brand-600 dark:text-brand-300 hover:underline whitespace-nowrap">
                            Actualización de docs
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              {!pageRows.length && <p className="px-5 py-12 text-center text-navy-900/40 dark:text-cream-100/40">No hay tareas con esos filtros</p>}

              {/* Paginación */}
              <div className="flex items-center justify-end gap-2 px-5 py-3">
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                  className="p-1.5 rounded-lg text-navy-900/60 dark:text-cream-100/60 hover:bg-sand-300/40 dark:hover:bg-white/10 disabled:opacity-30 transition-colors">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs text-navy-900/50 dark:text-cream-100/50">{page} / {pageCount}</span>
                <button disabled={page >= pageCount} onClick={() => setPage(p => p + 1)}
                  className="p-1.5 rounded-lg text-navy-900/60 dark:text-cream-100/60 hover:bg-sand-300/40 dark:hover:bg-white/10 disabled:opacity-30 transition-colors">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </Card>
      </div>

      {viewId && <TaskDrawer id={viewId} onClose={() => setViewId(null)} companyName={(t) => t?.companies?.name ?? 'Mi empresa'} />}
    </div>
  )
}
