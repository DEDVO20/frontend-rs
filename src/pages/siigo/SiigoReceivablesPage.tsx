import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight, Filter, Layers, RefreshCw, Search, Wallet, X } from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { PageLoader } from '@/components/ui/Spinner'
import { useAuthStore } from '@/stores/authStore'
import { useSiigoSyncStore } from '@/stores/siigoSyncStore'
import { SIIGO_INTERNAL_ROLES, SiigoNotConnected, useSiigoBooks, type SiigoBooksInfo } from './siigoBooks'

type Bucket = 'No vencido' | '1-30' | '31-60' | '61-90' | '91+' | 'Sin vencimiento'

interface ReceivableLine {
  id: string
  invoice_name: string
  invoice_date: string | null
  due_date: string | null
  days_overdue: number | null
  aging_bucket: Bucket
  identification: string
  branch: number
  customer_name: string
  seller_name: string
  currency: string
  total: number
  balance_api: number
  control_reduction: number
  balance: number
}

interface SyncLog {
  started_at: string
  status: 'running' | 'completed' | 'failed'
  cut_date: string
  invoices_count: number
  customers_count: number
  error_message?: string | null
}

interface ReceivablesResponse {
  books: SiigoBooksInfo | null
  notConnected: boolean
  isSyncRunning: boolean
  lastSync: SyncLog | null
  lastSuccess: SyncLog | null
  data: ReceivableLine[]
  total: number
}

interface ReceivablesSummary {
  cutDate: string | null
  summary: { total: number; vencido: number; porVencer: number; facturas: number; clientes: number; diasPromedioMora: number } | null
  byBucket: { bucket: Bucket; total: number; facturas: number }[]
}

const money = new Intl.NumberFormat('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmt = (n: number) => (n ? money.format(n) : '—')
const fmtDate = (d: string | null) => (d ? new Date(`${d.slice(0, 10)}T00:00:00`).toLocaleDateString('es-CO') : '—')
const fmtDateTime = (d: string | null) => (d ? new Date(d).toLocaleString('es-CO') : '—')
const bucketLabel = (b: Bucket) => (b === 'No vencido' ? 'Por vencer' : b === 'Sin vencimiento' ? b : `${b} días`)

const BUCKET_CLS: Record<Bucket, string> = {
  'No vencido':      'bg-emerald-50 text-emerald-700',
  '1-30':            'bg-amber-50 text-amber-700',
  '31-60':           'bg-orange-50 text-orange-700',
  '61-90':           'bg-red-50 text-red-600',
  '91+':             'bg-red-100 text-red-700',
  'Sin vencimiento': 'bg-slate-100 text-slate-600',
}

/**
 * Pestaña Cartera: facturas de Siigo con saldo a la fecha de corte, con el saldo de cada cliente
 * limitado a su saldo contable (130505 + 13051001). Independiente del módulo de cobro.
 */
export function SiigoReceivablesPage() {
  const qc = useQueryClient()
  const role = useAuthStore(s => s.user?.role ?? '')
  const canSync = ['admin', 'rs_admin', 'contador'].includes(role)
  const isInternal = SIIGO_INTERNAL_ROLES.includes(role)
  const startWatching = useSiigoSyncStore(s => s.start)
  const { booksParam, selected, connectionId } = useSiigoBooks()

  const [companyId, setCompanyId] = useState('')
  const [bucket, setBucket] = useState<Bucket | ''>('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const limit = 100

  useEffect(() => { setPage(1) }, [connectionId])

  const scopeParams = { ...booksParam, ...(isInternal && companyId ? { companyId } : {}) }
  const params = {
    ...scopeParams,
    ...(bucket ? { bucket } : {}),
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

  const { data, isLoading, isFetching } = useQuery<ReceivablesResponse>({
    queryKey: ['siigo-receivables', params],
    queryFn: async () => (await api.get('/api/siigo/receivables', { params })).data,
    staleTime: 30_000,
    refetchInterval: q => (q.state.data?.isSyncRunning ? 10_000 : false),
  })

  // Totales y edades: mismo informe que la pestaña Cartera de las gráficas
  const { data: report } = useQuery<ReceivablesSummary>({
    queryKey: ['siigo-receivables-report', scopeParams],
    queryFn: async () => (await api.get('/api/siigo/receivables/report', { params: scopeParams })).data,
    staleTime: 30_000,
  })

  const syncMut = useMutation({
    mutationFn: async () => (await api.post('/api/siigo/receivables/sync', { connectionId: selected?.id })).data,
    onSuccess: (res) => {
      startWatching('receivables', res.connectionId, selected?.label ?? 'Finto')
      toast.info('Cálculo de cartera iniciado en segundo plano. Te avisaremos cuando termine.')
      qc.invalidateQueries({ queryKey: ['siigo-receivables'] })
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'No se pudo iniciar la sincronización de cartera'),
  })

  const s = report?.summary
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / limit))
  const hasFilters = Boolean(companyId || bucket || search)
  const last = data?.lastSync
  const inputCls = 'w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-primary-500'

  if (data?.notConnected) {
    return <div className="flex-1 overflow-y-auto p-4 md:p-6"><SiigoNotConnected /></div>
  }

  return (
    // El detalle usa el estilo claro del back-office también en el portal
    <div data-theme="light" style={{ colorScheme: 'light' }} className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5">
      {/* Estado y acciones */}
      <div className="rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 border bg-white border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-primary-50 text-primary-600">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-base text-slate-900">
              Cartera{data?.books ? ` · ${data.books.label}` : ''}{report?.cutDate ? ` · corte ${fmtDate(report.cutDate)}` : ''}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {data?.isSyncRunning
                ? 'Cálculo en curso (segundo plano)…'
                : last
                  ? `Último cálculo: ${fmtDateTime(last.started_at)}` +
                    (last.status === 'completed' ? ` · ${last.invoices_count} facturas de ${last.customers_count} clientes` : ' · falló')
                  : 'Aún no se ha calculado. Se actualiza automáticamente todos los días a las 3:00 AM.'}
            </p>
            {last?.status === 'failed' && (
              <p className="text-xs text-amber-700 mt-1">
                {last.error_message} {data?.lastSuccess ? `Se muestra la cartera del ${fmtDate(data.lastSuccess.cut_date)}.` : ''}
              </p>
            )}
          </div>
        </div>
        {canSync && (
          <Button variant="secondary" size="sm" onClick={() => syncMut.mutate()} disabled={data?.isSyncRunning || syncMut.isPending}>
            <RefreshCw className={cn('w-4 h-4 text-primary-600', data?.isSyncRunning && 'animate-spin')} />
            Actualizar cartera desde Siigo
          </Button>
        )}
      </div>

      {isLoading ? (
        <PageLoader />
      ) : !s?.facturas && !hasFilters ? (
        <div className="rounded-2xl border bg-white border-slate-200 p-12 text-center space-y-3">
          <Layers className="w-12 h-12 text-slate-300 mx-auto" />
          <p className="text-base font-semibold text-slate-700">Todavía no hay cartera calculada</p>
          <p className="text-xs text-slate-400">Usa «Actualizar cartera desde Siigo» para calcularla a hoy.</p>
        </div>
      ) : (
        <>
          {/* Totales */}
          {s && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Cartera total', value: fmt(s.total) },
                { label: 'Vencida', value: fmt(s.vencido) },
                { label: 'Por vencer', value: fmt(s.porVencer) },
                { label: 'Facturas / clientes', value: `${s.facturas} / ${s.clientes}` },
              ].map(k => (
                <div key={k.label} className="rounded-2xl p-4 border bg-white border-slate-200">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{k.label}</p>
                  <p className="text-lg font-bold mt-1.5 font-mono truncate text-slate-900">{k.value}</p>
                </div>
              ))}
            </div>
          )}

          {/* Edades: cada chip filtra el detalle */}
          {(report?.byBucket.length ?? 0) > 0 && (
            <div className="rounded-2xl p-4 border bg-white border-slate-200 space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Por edad</p>
              <div className="flex flex-wrap gap-2">
                {report!.byBucket.filter(b => b.facturas > 0).map(b => (
                  <button
                    key={b.bucket}
                    onClick={() => { setBucket(bucket === b.bucket ? '' : b.bucket); setPage(1) }}
                    className={cn(
                      'flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors',
                      bucket === b.bucket ? 'bg-primary-600 text-white border-primary-600' : 'border-slate-200 text-slate-700 hover:bg-slate-50',
                    )}
                  >
                    {bucketLabel(b.bucket)}
                    <span className={cn('font-mono font-normal', bucket === b.bucket ? 'text-white/80' : 'text-slate-500')}>
                      {fmt(Number(b.total))} · {b.facturas}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Filtros */}
          <div className="rounded-2xl p-4 border space-y-3 bg-white border-slate-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                <Filter className="w-3.5 h-3.5" /> Filtros
              </div>
              {hasFilters && (
                <button
                  onClick={() => { setCompanyId(''); setBucket(''); setSearch(''); setPage(1) }}
                  className="text-xs font-semibold text-primary-600 hover:underline flex items-center gap-1"
                >
                  <X className="w-3.5 h-3.5" /> Limpiar filtros
                </button>
              )}
            </div>
            <div className={cn('grid grid-cols-1 gap-3', isInternal ? 'sm:grid-cols-3' : 'sm:grid-cols-2')}>
              {isInternal && (
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">Cliente dentro de los libros</label>
                  <select value={companyId} onChange={e => { setCompanyId(e.target.value); setPage(1) }} className={inputCls}>
                    <option value="">Todos los clientes</option>
                    {companies.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">Edad</label>
                <select value={bucket} onChange={e => { setBucket(e.target.value as Bucket | ''); setPage(1) }} className={inputCls}>
                  <option value="">Todas</option>
                  {(['No vencido', '1-30', '31-60', '61-90', '91+', 'Sin vencimiento'] as Bucket[]).map(b => (
                    <option key={b} value={b}>{bucketLabel(b)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">Buscar cliente, NIT, factura o vendedor</label>
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    value={search}
                    onChange={e => { setSearch(e.target.value); setPage(1) }}
                    placeholder="Ej: 901655024, FV-2-106"
                    className={cn(inputCls, 'pl-9')}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Detalle */}
          <div className="rounded-2xl border overflow-hidden bg-white border-slate-200">
            {(data?.data.length ?? 0) === 0 ? (
              <div className="p-12 text-center text-sm text-slate-500">No hay facturas para los filtros seleccionados</div>
            ) : (
              <>
                <div className={cn('overflow-x-auto', isFetching && 'opacity-70')}>
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-900 text-white text-[11px] font-semibold uppercase tracking-wider">
                        <th className="py-3 px-3 whitespace-nowrap">Factura</th>
                        <th className="py-3 px-3 whitespace-nowrap">Cliente</th>
                        <th className="py-3 px-3 whitespace-nowrap">Identificación</th>
                        <th className="py-3 px-3 whitespace-nowrap">Fecha</th>
                        <th className="py-3 px-3 whitespace-nowrap">Vence</th>
                        <th className="py-3 px-3 whitespace-nowrap text-right">Días</th>
                        <th className="py-3 px-3 whitespace-nowrap">Edad</th>
                        <th className="py-3 px-3 whitespace-nowrap">Vendedor</th>
                        <th className="py-3 px-3 whitespace-nowrap text-right">Total factura</th>
                        <th className="py-3 px-3 whitespace-nowrap text-right">Saldo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {data!.data.map(r => (
                        <tr key={r.id} className="hover:bg-slate-50/80">
                          <td className="py-2 px-3 font-mono text-slate-700 whitespace-nowrap">{r.invoice_name}</td>
                          <td className="py-2 px-3 max-w-[220px] truncate font-medium text-slate-800" title={r.customer_name}>{r.customer_name || '—'}</td>
                          <td className="py-2 px-3 font-mono text-slate-600 whitespace-nowrap">
                            {r.identification}{r.branch ? <span className="text-slate-400"> · suc. {r.branch}</span> : null}
                          </td>
                          <td className="py-2 px-3 text-slate-600 whitespace-nowrap">{fmtDate(r.invoice_date)}</td>
                          <td className="py-2 px-3 text-slate-600 whitespace-nowrap">{fmtDate(r.due_date)}</td>
                          <td className={cn('py-2 px-3 text-right font-mono whitespace-nowrap', (r.days_overdue ?? 0) > 0 ? 'text-red-600 font-semibold' : 'text-slate-500')}>
                            {r.days_overdue ?? '—'}
                          </td>
                          <td className="py-2 px-3 whitespace-nowrap">
                            <span className={cn('px-2 py-0.5 rounded-full text-[11px] font-semibold', BUCKET_CLS[r.aging_bucket])}>{bucketLabel(r.aging_bucket)}</span>
                          </td>
                          <td className="py-2 px-3 max-w-[160px] truncate text-slate-600" title={r.seller_name}>{r.seller_name || '—'}</td>
                          <td className="py-2 px-3 text-right font-mono text-slate-700 whitespace-nowrap">
                            {fmt(r.total)}{r.currency !== 'COP' && <span className="text-slate-400"> ({r.currency})</span>}
                          </td>
                          <td
                            className="py-2 px-3 text-right font-mono font-semibold text-slate-900 whitespace-nowrap"
                            title={r.control_reduction > 0
                              ? `Saldo API ${fmt(r.balance_api)} − ${fmt(r.control_reduction)} por control contable (130505 + 13051001)`
                              : undefined}
                          >
                            {fmt(r.balance)}{r.control_reduction > 0 && <span className="text-amber-600">*</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-slate-100 bg-slate-50/50">
                  <p className="text-xs text-slate-500">
                    Página <span className="font-semibold">{page}</span> de <span className="font-semibold">{totalPages}</span> ({data?.total ?? 0} facturas)
                    <span className="text-amber-600"> · *</span> saldo ajustado al saldo contable del cliente
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
