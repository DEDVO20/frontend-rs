import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight, Filter, Handshake, Layers, RefreshCw, Search, X } from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { PageLoader } from '@/components/ui/Spinner'
import { useAuthStore } from '@/stores/authStore'
import { useSiigoSyncStore } from '@/stores/siigoSyncStore'
import { SIIGO_INTERNAL_ROLES, useSiigoBooks } from './siigoBooks'

type Kind = 'open' | 'sent' | 'won' | 'lost'

interface Deal {
  id: string
  deal_id: string
  name: string
  amount: number
  pipeline_label: string
  stage_label: string
  stage_kind: Kind
  owner_name: string
  close_date: string | null
  create_date: string | null
}

interface DealsResponse {
  connection: { id: string; label: string } | null
  notConnected: boolean
  isSyncRunning: boolean
  lastSync: { started_at: string; status: string; deals_count: number; error_message?: string | null } | null
  data: Deal[]
  total: number
  stages: string[]
  owners: string[]
}

interface CrmSummary {
  summary: { deals: number; amount: number; enviadas: number; ganadas: number; valorGanado: number } | null
}

const KINDS: { id: Kind; label: string; cls: string }[] = [
  { id: 'open', label: 'Sin propuesta', cls: 'bg-slate-100 text-slate-600' },
  { id: 'sent', label: 'Propuesta enviada', cls: 'bg-blue-50 text-blue-700' },
  { id: 'won', label: 'Ganada', cls: 'bg-emerald-50 text-emerald-700' },
  { id: 'lost', label: 'Perdida', cls: 'bg-red-50 text-red-600' },
]
const kindOf = (k: Kind) => KINDS.find(x => x.id === k)!

const money = new Intl.NumberFormat('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
const fmt = (n: number) => (n ? `$ ${money.format(n)}` : '—')
const fmtDate = (d: string | null) => (d ? new Date(`${d.slice(0, 10)}T00:00:00`).toLocaleDateString('es-CO') : '—')
const fmtDateTime = (d: string | null) => (d ? new Date(d).toLocaleString('es-CO') : '—')

/**
 * Pestaña CRM: negocios de HubSpot de los libros consultados (empresa de esa cuenta de Siigo, o Finto).
 * La fecha de cada negocio es la de cierre (o la de creación si aún no tiene), como en las gráficas.
 */
export function HubspotDealsPage() {
  const qc = useQueryClient()
  const role = useAuthStore(s => s.user?.role ?? '')
  const canSync = ['admin', 'rs_admin', 'contador'].includes(role)
  const isInternal = SIIGO_INTERNAL_ROLES.includes(role)
  const startWatching = useSiigoSyncStore(s => s.start)
  const { booksParam, connectionId } = useSiigoBooks()

  const [kind, setKind] = useState<Kind | ''>('')
  const [stage, setStage] = useState('')
  const [owner, setOwner] = useState('')
  const [search, setSearch] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [page, setPage] = useState(1)
  const limit = 100

  // Otros libros = otro HubSpot: se limpian los filtros que dependen de sus etapas y socios
  useEffect(() => { setStage(''); setOwner(''); setPage(1) }, [connectionId])

  const scopeParams = {
    ...booksParam,
    ...(startDate ? { startDate } : {}),
    ...(endDate ? { endDate } : {}),
  }
  const params = {
    ...scopeParams,
    ...(kind ? { kind } : {}),
    ...(stage ? { stage } : {}),
    ...(owner ? { owner } : {}),
    ...(search.trim() ? { search: search.trim() } : {}),
    page,
    limit,
  }

  const { data, isLoading, isFetching } = useQuery<DealsResponse>({
    queryKey: ['hubspot-deals', params],
    queryFn: async () => (await api.get('/api/hubspot/deals', { params })).data,
    staleTime: 30_000,
    refetchInterval: q => (q.state.data?.isSyncRunning ? 10_000 : false),
  })

  // Totales del periodo: mismo informe que las gráficas de CRM
  const { data: report } = useQuery<CrmSummary>({
    queryKey: ['hubspot-report', scopeParams],
    queryFn: async () => (await api.get('/api/hubspot/report', { params: scopeParams })).data,
    staleTime: 60_000,
  })

  const syncMut = useMutation({
    mutationFn: async () => (await api.post('/api/hubspot/sync', { connectionId: booksParam.connectionId })).data,
    onSuccess: (res) => {
      startWatching('hubspot', res.connectionId, res.label ?? 'HubSpot')
      toast.info('Sincronización de HubSpot iniciada en segundo plano. Te avisaremos cuando termine.')
      qc.invalidateQueries({ queryKey: ['hubspot-deals'] })
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'No se pudo iniciar la sincronización de HubSpot'),
  })

  const s = report?.summary
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / limit))
  const hasFilters = Boolean(kind || stage || owner || search || startDate || endDate)
  const last = data?.lastSync
  const clearFilters = () => { setKind(''); setStage(''); setOwner(''); setSearch(''); setStartDate(''); setEndDate(''); setPage(1) }
  const inputCls = 'w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-primary-500'

  return (
    // El detalle usa el estilo claro del back-office también en el portal
    <div data-theme="light" style={{ colorScheme: 'light' }} className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5">
      {/* Estado y acciones */}
      <div className="rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 border bg-white border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-primary-50 text-primary-600">
            <Handshake className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-base text-slate-900">
              CRM · HubSpot{data?.connection ? ` · ${data.connection.label}` : ''}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {data?.notConnected
                ? 'Sin HubSpot conectado.'
                : data?.isSyncRunning
                  ? 'Sincronización en curso (segundo plano)…'
                  : last
                    ? `Última sincronización: ${fmtDateTime(last.started_at)} · ${last.status === 'completed' ? `${last.deals_count} negocios` : 'falló'}`
                    : 'Aún no se ha sincronizado. Se actualiza automáticamente todos los días a las 3:30 AM.'}
            </p>
            {last?.status === 'failed' && <p className="text-xs text-amber-700 mt-1">{last.error_message}</p>}
          </div>
        </div>
        {canSync && !data?.notConnected && (
          <Button variant="secondary" size="sm" onClick={() => syncMut.mutate()} disabled={data?.isSyncRunning || syncMut.isPending}>
            <RefreshCw className={cn('w-4 h-4 text-primary-600', data?.isSyncRunning && 'animate-spin')} />
            Actualizar desde HubSpot
          </Button>
        )}
      </div>

      {isLoading ? (
        <PageLoader />
      ) : data?.notConnected ? (
        <div className="rounded-2xl border bg-white border-slate-200 p-12 text-center space-y-3">
          <Layers className="w-12 h-12 text-slate-300 mx-auto" />
          <p className="text-base font-semibold text-slate-700">HubSpot no está conectado para estos libros</p>
          <p className="text-xs text-slate-400">
            {isInternal
              ? 'Conecta el HubSpot de la empresa en Empresas → (empresa) → pestaña Siigo → sección HubSpot.'
              : 'Tu empresa aún no tiene HubSpot conectado. Pídeselo a tu asesor de Finto.'}
          </p>
        </div>
      ) : !data?.total && !hasFilters ? (
        <div className="rounded-2xl border bg-white border-slate-200 p-12 text-center space-y-3">
          <Layers className="w-12 h-12 text-slate-300 mx-auto" />
          <p className="text-base font-semibold text-slate-700">Todavía no hay negocios sincronizados</p>
          <p className="text-xs text-slate-400">Usa «Actualizar desde HubSpot» para traerlos.</p>
        </div>
      ) : (
        <>
          {/* Totales */}
          {s && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Negocios', value: String(s.deals) },
                { label: 'Valor total', value: fmt(Number(s.amount)) },
                { label: 'Valor ganado', value: fmt(Number(s.valorGanado)) },
                { label: 'Conversión (ganadas / enviadas)', value: s.enviadas ? `${Math.round((s.ganadas / s.enviadas) * 100)} % · ${s.ganadas} de ${s.enviadas}` : '—' },
              ].map(k => (
                <div key={k.label} className="rounded-2xl p-4 border bg-white border-slate-200">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{k.label}</p>
                  <p className="text-lg font-bold mt-1.5 font-mono truncate text-slate-900">{k.value}</p>
                </div>
              ))}
            </div>
          )}

          {/* Filtros */}
          <div className="rounded-2xl p-4 border space-y-3 bg-white border-slate-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                <Filter className="w-3.5 h-3.5" /> Filtros
              </div>
              {hasFilters && (
                <button onClick={clearFilters} className="text-xs font-semibold text-primary-600 hover:underline flex items-center gap-1">
                  <X className="w-3.5 h-3.5" /> Limpiar filtros
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {KINDS.map(k => (
                <button
                  key={k.id}
                  onClick={() => { setKind(kind === k.id ? '' : k.id); setPage(1) }}
                  className={cn(
                    'px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors',
                    kind === k.id ? 'bg-primary-600 text-white border-primary-600' : 'border-slate-200 text-slate-700 hover:bg-slate-50',
                  )}
                >
                  {k.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">Etapa</label>
                <select value={stage} onChange={e => { setStage(e.target.value); setPage(1) }} className={inputCls}>
                  <option value="">Todas</option>
                  {(data?.stages ?? []).map(st => <option key={st} value={st}>{st}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">Socio</label>
                <select value={owner} onChange={e => { setOwner(e.target.value); setPage(1) }} className={inputCls}>
                  <option value="">Todos</option>
                  {(data?.owners ?? []).map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">Cierre desde</label>
                <input type="date" value={startDate} max={endDate || undefined} onChange={e => { setStartDate(e.target.value); setPage(1) }} className={inputCls} />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">Cierre hasta</label>
                <input type="date" value={endDate} min={startDate || undefined} onChange={e => { setEndDate(e.target.value); setPage(1) }} className={inputCls} />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">Buscar negocio o socio</label>
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder="Nombre del negocio" className={cn(inputCls, 'pl-9')} />
                </div>
              </div>
            </div>
          </div>

          {/* Detalle */}
          <div className="rounded-2xl border overflow-hidden bg-white border-slate-200">
            {(data?.data.length ?? 0) === 0 ? (
              <div className="p-12 text-center text-sm text-slate-500">No hay negocios para los filtros seleccionados</div>
            ) : (
              <>
                <div className={cn('overflow-x-auto', isFetching && 'opacity-70')}>
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-900 text-white text-[11px] font-semibold uppercase tracking-wider">
                        <th className="py-3 px-3 whitespace-nowrap">Negocio</th>
                        <th className="py-3 px-3 whitespace-nowrap">Etapa</th>
                        <th className="py-3 px-3 whitespace-nowrap">Tipo</th>
                        <th className="py-3 px-3 whitespace-nowrap">Socio</th>
                        <th className="py-3 px-3 whitespace-nowrap">Creado</th>
                        <th className="py-3 px-3 whitespace-nowrap">Cierre</th>
                        <th className="py-3 px-3 whitespace-nowrap text-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {data!.data.map(d => (
                        <tr key={d.id} className="hover:bg-slate-50/80">
                          <td className="py-2 px-3 max-w-[280px] truncate font-medium text-slate-800" title={d.name}>{d.name || '—'}</td>
                          <td className="py-2 px-3 text-slate-700 whitespace-nowrap" title={d.pipeline_label}>{d.stage_label}</td>
                          <td className="py-2 px-3 whitespace-nowrap">
                            <span className={cn('px-2 py-0.5 rounded-full text-[11px] font-semibold', kindOf(d.stage_kind).cls)}>{kindOf(d.stage_kind).label}</span>
                          </td>
                          <td className="py-2 px-3 text-slate-600 whitespace-nowrap">{d.owner_name || 'Sin asignar'}</td>
                          <td className="py-2 px-3 text-slate-600 whitespace-nowrap">{fmtDate(d.create_date)}</td>
                          <td className="py-2 px-3 text-slate-600 whitespace-nowrap">{fmtDate(d.close_date)}</td>
                          <td className="py-2 px-3 text-right font-mono font-semibold text-slate-900 whitespace-nowrap">{fmt(d.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-slate-100 bg-slate-50/50">
                  <p className="text-xs text-slate-500">
                    Página <span className="font-semibold">{page}</span> de <span className="font-semibold">{totalPages}</span> ({data?.total ?? 0} negocios)
                  </p>
                  <div className="flex items-center gap-2">
                    <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
                      <ChevronLeft className="w-4 h-4" /> Anterior
                    </Button>
                    <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>
                      Siguiente <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
