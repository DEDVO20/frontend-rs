import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight, Filter, HandCoins, Layers, RefreshCw, Search, X } from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { PageLoader } from '@/components/ui/Spinner'
import { useSiigoSyncStore } from '@/stores/siigoSyncStore'
import { SiigoNotConnected, useSiigoBooks, type SiigoBooksInfo } from './siigoBooks'

interface CollectionLine {
  voucher_id: string
  line_index: number
  collection_date: string
  receipt: string
  customer_nit: string
  customer_name: string
  invoice: string
  product_code: string
  product_description: string
  installment: string
  due_date: string | null
  applied_value: number
  movement_class: 'ITEM' | 'ANTICIPO' | 'OTRO_INGRESO' | 'PAGO_SIN_ITEMS'
  observations: string
}

interface CollectionSyncLog {
  started_at: string
  finished_at: string | null
  status: 'running' | 'completed' | 'failed'
  start_date: string
  end_date: string
  vouchers_count: number
  lines_count: number
  total_applied: number
  duration_sec: number
  error_message?: string | null
}

interface CollectionsResponse {
  data: CollectionLine[]
  total: number
  page: number
  limit: number
  isSyncRunning: boolean
  books: SiigoBooksInfo | null
  notConnected: boolean
  lastSync: CollectionSyncLog | null
  summary: { totalRecaudado: number; recibos: number; movimientos: number; facturas: number; anticipos: number; clientes: number }
}

const CLASS_LABEL: Record<CollectionLine['movement_class'], string> = {
  ITEM:           '',
  ANTICIPO:       'Anticipo',
  OTRO_INGRESO:   'Otro ingreso',
  PAGO_SIN_ITEMS: 'Pago sin detalle',
}

const fmtMoney = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0)

const fmtDate = (d: string | null) => {
  if (!d) return '—'
  const [y, m, day] = d.slice(0, 10).split('-')
  return `${day}/${m}/${y}`
}

/**
 * Recaudo (recibos de caja de Siigo) de los libros consultados: detalle por movimiento aplicado.
 * Internos: la cuenta elegida en «Libros de»; clientes: la de su propia empresa.
 */
export function SiigoCollectionsPanel({ canSync }: { canSync: boolean }) {
  const qc = useQueryClient()
  const startWatching = useSiigoSyncStore(s => s.start)
  const { isInternal, booksParam, selected } = useSiigoBooks()
  const [companyId, setCompanyId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const limit = 50

  const params = {
    ...booksParam,
    ...(isInternal && companyId ? { companyId } : {}),
    ...(startDate ? { startDate } : {}),
    ...(endDate ? { endDate } : {}),
    ...(search.trim() ? { search: search.trim() } : {}),
    page,
    limit,
  }

  const { data: companiesRes } = useQuery({
    queryKey: ['companies-siigo-selector'],
    queryFn: async () => (await api.get('/api/companies?limit=100')).data,
    enabled: isInternal,
    staleTime: 120_000,
  })
  const companies: any[] = Array.isArray(companiesRes) ? companiesRes : (companiesRes?.data ?? [])

  const { data, isLoading, isFetching } = useQuery<CollectionsResponse>({
    queryKey: ['siigo-collections', params],
    queryFn: async () => (await api.get('/api/siigo/collections', { params })).data,
    staleTime: 30_000,
    // Mientras corre una sincronización en segundo plano se consulta su estado
    refetchInterval: q => (q.state.data?.isSyncRunning ? 5000 : false),
  })

  const syncMut = useMutation({
    mutationFn: async () => (await api.post('/api/siigo/collections/sync', { connectionId: selected?.id })).data,
    onSuccess: (res) => {
      // La sincronización sigue en el servidor; SiigoSyncWatcher avisa cuando termine
      startWatching('collections', res.connectionId, selected?.label ?? 'Finto')
      toast.info('Sincronización de recaudo iniciada en segundo plano. Puedes seguir trabajando: te avisaremos cuando termine.')
      qc.invalidateQueries({ queryKey: ['siigo-collections'] })
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'No se pudo iniciar la sincronización de recaudo'),
  })

  const hasFilters = Boolean(companyId || startDate || endDate || search)
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / limit))
  const s = data?.summary
  const last = data?.lastSync
  const inputCls = 'w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-primary-500'

  if (data?.notConnected) return <SiigoNotConnected dark={false} />

  return (
    <div className="space-y-5">
      {/* Estado y acciones */}
      <div className="rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 border bg-white border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-primary-50 text-primary-600">
            <HandCoins className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-base text-slate-900">
              Recaudo · recibos de caja{data?.books ? ` · ${data.books.label}` : ''}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {data?.isSyncRunning
                ? 'Sincronización en curso…'
                : last
                  ? last.status === 'failed'
                    ? `La última sincronización falló: ${last.error_message ?? 'error desconocido'}`
                    : `Última sincronización: ${new Date(last.started_at).toLocaleString('es-CO')} · periodo ${last.start_date} a ${last.end_date} · ${last.vouchers_count} recibos`
                  : 'Aún no se ha sincronizado el recaudo. Se actualiza automáticamente todos los días a las 2:30 AM.'}
            </p>
          </div>
        </div>
        {canSync && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => syncMut.mutate()}
            loading={syncMut.isPending}
            disabled={data?.isSyncRunning}
          >
            <RefreshCw className={cn('w-4 h-4 text-primary-600', data?.isSyncRunning && 'animate-spin')} />
            {data?.isSyncRunning ? 'Sincronizando…' : 'Sincronizar recaudo'}
          </Button>
        )}
      </div>

      {/* Cifras */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total recaudado', value: fmtMoney(s?.totalRecaudado ?? 0) },
          { label: 'Recibos de caja', value: String(s?.recibos ?? 0) },
          { label: 'Facturas pagadas', value: String(s?.facturas ?? 0) },
          { label: 'Anticipos y otros ingresos', value: fmtMoney(s?.anticipos ?? 0) },
        ].map(k => (
          <div key={k.label} className="rounded-2xl p-4 border bg-white border-slate-200">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{k.label}</p>
            <p className="text-xl font-bold mt-1.5 font-mono truncate text-slate-900">{k.value}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="rounded-2xl p-4 border space-y-3 bg-white border-slate-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
            <Filter className="w-3.5 h-3.5" /> Filtros de recaudo
          </div>
          {hasFilters && (
            <button
              onClick={() => { setCompanyId(''); setStartDate(''); setEndDate(''); setSearch(''); setPage(1) }}
              className="text-xs font-semibold text-primary-600 hover:underline flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" /> Limpiar filtros
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="lg:col-span-2">
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Buscar recibo, factura, cliente u observación</label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1) }}
                placeholder="Ej: RC-1-45, FV-2-43, 901655..."
                className={cn(inputCls, 'pl-9')}
              />
            </div>
          </div>
          {isInternal && (
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">Cliente (empresa de la plataforma)</label>
              <select value={companyId} onChange={e => { setCompanyId(e.target.value); setPage(1) }} className={inputCls}>
                <option value="">Todos los clientes…</option>
                {companies.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Fecha desde</label>
            <input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setPage(1) }} className={inputCls} />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Fecha hasta</label>
            <input type="date" value={endDate} onChange={e => { setEndDate(e.target.value); setPage(1) }} className={inputCls} />
          </div>
        </div>
      </div>

      {/* Detalle */}
      {isLoading ? (
        <PageLoader />
      ) : (
        <div className="rounded-2xl border overflow-hidden bg-white border-slate-200">
          {(data?.data?.length ?? 0) === 0 ? (
            <div className="p-12 text-center space-y-3">
              <Layers className="w-12 h-12 text-slate-300 mx-auto" />
              <p className="text-base font-semibold text-slate-700">No hay recaudo para los filtros seleccionados</p>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Ajusta los filtros o sincroniza el recaudo desde Siigo.
              </p>
            </div>
          ) : (
            <>
              <div className={cn('overflow-x-auto', isFetching && 'opacity-70')}>
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-900 text-white text-[11px] font-semibold uppercase tracking-wider">
                      <th className="py-3 px-3 whitespace-nowrap">Fecha recaudo</th>
                      <th className="py-3 px-3 whitespace-nowrap">Recibo</th>
                      <th className="py-3 px-3 whitespace-nowrap">Identificación</th>
                      <th className="py-3 px-3 whitespace-nowrap">Cliente</th>
                      <th className="py-3 px-3 whitespace-nowrap">Factura</th>
                      <th className="py-3 px-3 whitespace-nowrap">Cód.</th>
                      <th className="py-3 px-3 whitespace-nowrap">Producto facturado</th>
                      <th className="py-3 px-3 whitespace-nowrap text-center">Cuota</th>
                      <th className="py-3 px-3 whitespace-nowrap">Vencimiento</th>
                      <th className="py-3 px-3 whitespace-nowrap text-right">Valor aplicado</th>
                      <th className="py-3 px-3 whitespace-nowrap">Observaciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {data!.data.map(row => (
                      <tr key={`${row.voucher_id}-${row.receipt}-${row.line_index}`} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-3 whitespace-nowrap text-slate-600">{fmtDate(row.collection_date)}</td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {row.receipt}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap font-mono text-slate-600">{row.customer_nit || '—'}</td>
                        <td className="py-2.5 px-3 max-w-[200px] truncate font-medium text-slate-800" title={row.customer_name}>
                          {row.customer_name || '—'}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap font-mono text-slate-700">
                          {row.invoice || '—'}
                          {CLASS_LABEL[row.movement_class] && (
                            <span className="ml-1.5 text-[10px] font-sans font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">
                              {CLASS_LABEL[row.movement_class]}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap font-mono text-slate-500">{row.product_code || '—'}</td>
                        <td className="py-2.5 px-3 max-w-[220px] truncate text-slate-800" title={row.product_description}>
                          {row.product_description || '—'}
                        </td>
                        <td className="py-2.5 px-3 text-center text-slate-600">{row.installment || '—'}</td>
                        <td className="py-2.5 px-3 whitespace-nowrap text-slate-600">{fmtDate(row.due_date)}</td>
                        <td className="py-2.5 px-3 text-right whitespace-nowrap font-mono font-bold text-slate-900">{fmtMoney(row.applied_value)}</td>
                        <td className="py-2.5 px-3 max-w-[260px] truncate text-slate-500" title={row.observations}>{row.observations || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100 font-bold text-xs border-t-2 border-slate-300">
                      <td colSpan={9} className="py-3 px-3 text-right uppercase text-slate-600">
                        Total recaudado filtrado ({s?.movimientos ?? 0} movimientos):
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-primary-700">{fmtMoney(s?.totalRecaudado ?? 0)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-slate-100 bg-slate-50/50">
                <p className="text-xs text-slate-500">
                  Página <span className="font-semibold">{page}</span> de <span className="font-semibold">{totalPages}</span> ({data?.total ?? 0} movimientos)
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
      )}
    </div>
  )
}
