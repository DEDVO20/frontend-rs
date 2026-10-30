import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Filter, Layers, RefreshCw, Scale, Search, X } from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { PageLoader } from '@/components/ui/Spinner'
import { useAuthStore } from '@/stores/authStore'
import { useSiigoSyncStore } from '@/stores/siigoSyncStore'
import { SiigoNotConnected, useSiigoBooks, type SiigoBooksInfo } from './siigoBooks'

interface TrialBalanceLine {
  id: string
  account_code: string
  account_name: string
  level: string
  class_label: string
  account_label: string
  identification: string
  branch: string
  third_party_name: string
  initial_balance: number
  debit: number
  credit: number
  final_balance: number
}

interface PeriodControl {
  period: string
  status: 'OK' | 'ERROR'
  rows_count: number
  cut_date: string | null
  last_attempt_at: string
  last_success_at: string | null
  detail: string
}

interface Totals {
  initialBalance: number
  debit: number
  credit: number
  finalBalance: number
  accounts: number
  thirdParties: number
}

interface TrialBalanceResponse {
  period: string | null
  periods: PeriodControl[]
  isSyncRunning: boolean
  books: SiigoBooksInfo | null
  notConnected: boolean
  lastSync: { started_at: string; status: string; mode: string; months_ok: number; months_failed: number; error_message?: string | null } | null
  data: TrialBalanceLine[]
  total: number
  totals: Totals | null
  byClass: { code: string; label: string; initialBalance: number; debit: number; credit: number; finalBalance: number }[]
}

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const periodLabel = (p: string) => `${MESES[Number(p.slice(5, 7)) - 1] ?? p} ${p.slice(0, 4)}`

const money = new Intl.NumberFormat('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmt = (n: number) => (n ? money.format(n) : '—')
const fmtDateTime = (d: string | null) => (d ? new Date(d).toLocaleString('es-CO') : '—')

/**
 * Pestaña Balance de prueba por tercero (Siigo) de los libros consultados.
 * Internos: la cuenta elegida en «Libros de»; clientes: la de su propia empresa.
 */
export function SiigoTrialBalancePage() {
  const qc = useQueryClient()
  const role = useAuthStore(s => s.user?.role ?? '')
  const canSync = ['admin', 'rs_admin', 'contador'].includes(role)
  const startWatching = useSiigoSyncStore(s => s.start)
  const { booksParam, selected, connectionId } = useSiigoBooks()

  const [period, setPeriod] = useState('')
  const [account, setAccount] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const limit = 100

  // Otra cuenta = otros periodos importados: se vuelve al último mes disponible
  useEffect(() => { setPeriod(''); setPage(1) }, [connectionId])

  const params = {
    ...booksParam,
    ...(period ? { period } : {}),
    ...(account.trim() ? { account: account.trim() } : {}),
    ...(search.trim() ? { search: search.trim() } : {}),
    page,
    limit,
  }

  const { data, isLoading, isFetching } = useQuery<TrialBalanceResponse>({
    queryKey: ['siigo-trial-balance', params],
    queryFn: async () => (await api.get('/api/siigo/trial-balance', { params })).data,
    staleTime: 30_000,
    refetchInterval: q => (q.state.data?.isSyncRunning ? 10_000 : false),
  })

  const syncMut = useMutation({
    mutationFn: async (mode: 'current' | 'year') =>
      (await api.post('/api/siigo/trial-balance/sync', { mode, connectionId: selected?.id })).data,
    onSuccess: (res, mode) => {
      startWatching('trialBalance', res.connectionId, selected?.label ?? 'Finto')
      toast.info(
        mode === 'year'
          ? 'Importación del año iniciada en segundo plano (un mes tras otro). Te avisaremos cuando termine.'
          : 'Actualización del mes actual iniciada en segundo plano. Te avisaremos cuando termine.',
      )
      qc.invalidateQueries({ queryKey: ['siigo-trial-balance'] })
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'No se pudo iniciar la importación del balance'),
  })

  const current = data?.period ?? ''
  const totals = data?.totals
  const diff = totals ? Math.round((totals.debit - totals.credit) * 100) / 100 : 0
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / limit))
  const hasFilters = Boolean(account || search)
  const control = data?.periods.find(p => p.period === current)
  const inputCls = 'w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-primary-500'

  if (data?.notConnected) {
    return <div className="flex-1 overflow-y-auto p-4 md:p-6"><SiigoNotConnected /></div>
  }

  return (
    // El detalle contable usa el estilo claro del back-office también en el portal
    <div data-theme="light" style={{ colorScheme: 'light' }} className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5">
      {/* Estado y acciones */}
      <div className="rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 border bg-white border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-primary-50 text-primary-600">
            <Scale className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-base text-slate-900">
              Balance de prueba por tercero{data?.books ? ` · ${data.books.label}` : ''}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {data?.isSyncRunning
                ? 'Importación en curso (segundo plano)…'
                : data?.lastSync
                  ? `Última importación: ${fmtDateTime(data.lastSync.started_at)} · ${data.lastSync.months_ok} mes(es) OK` +
                    (data.lastSync.months_failed ? ` · ${data.lastSync.months_failed} con error` : '')
                  : 'Aún no se ha importado. El mes actual se actualiza automáticamente todos los días a las 6:00 AM.'}
            </p>
          </div>
        </div>
        {canSync && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => syncMut.mutate('current')}
              disabled={data?.isSyncRunning || syncMut.isPending}
            >
              <RefreshCw className={cn('w-4 h-4 text-primary-600', data?.isSyncRunning && 'animate-spin')} />
              Actualizar mes actual
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => syncMut.mutate('year')}
              disabled={data?.isSyncRunning || syncMut.isPending}
            >
              Importar año completo
            </Button>
          </div>
        )}
      </div>

      {/* Control de periodos: un chip por mes con su estado */}
      {(data?.periods.length ?? 0) > 0 && (
        <div className="rounded-2xl p-4 border bg-white border-slate-200 space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Periodos importados</p>
          <div className="flex flex-wrap gap-2">
            {[...(data?.periods ?? [])].sort((a, b) => a.period.localeCompare(b.period)).map(p => {
              const ok = p.status === 'OK'
              const active = p.period === current
              return (
                <button
                  key={p.period}
                  onClick={() => { setPeriod(p.period); setPage(1) }}
                  disabled={!p.last_success_at}
                  title={`${p.detail}\nÚltimo intento: ${fmtDateTime(p.last_attempt_at)}`}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed',
                    active ? 'bg-primary-600 text-white border-primary-600' : 'border-slate-200 text-slate-700 hover:bg-slate-50',
                  )}
                >
                  {ok
                    ? <CheckCircle2 className={cn('w-3.5 h-3.5', active ? 'text-white' : 'text-emerald-600')} />
                    : <AlertTriangle className={cn('w-3.5 h-3.5', active ? 'text-white' : 'text-amber-600')} />}
                  {periodLabel(p.period)}
                  {!ok && <span className="font-normal">· error</span>}
                </button>
              )
            })}
          </div>
          {control && control.status === 'ERROR' && (
            <p className="text-xs text-amber-700">
              La última importación de {periodLabel(control.period)} falló ({control.detail}). Se muestran los datos de la importación correcta anterior.
            </p>
          )}
        </div>
      )}

      {isLoading ? (
        <PageLoader />
      ) : !current ? (
        <div className="rounded-2xl border bg-white border-slate-200 p-12 text-center space-y-3">
          <Layers className="w-12 h-12 text-slate-300 mx-auto" />
          <p className="text-base font-semibold text-slate-700">Todavía no hay balance de prueba importado</p>
          <p className="text-xs text-slate-400">Usa «Importar año completo» para traer de enero al mes actual.</p>
        </div>
      ) : (
        <>
          {/* Totales y cuadre */}
          {totals && (
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              {[
                { label: 'Saldo inicial', value: fmt(totals.initialBalance) },
                { label: 'Movimiento débito', value: fmt(totals.debit) },
                { label: 'Movimiento crédito', value: fmt(totals.credit) },
                { label: 'Saldo final', value: fmt(totals.finalBalance) },
              ].map(k => (
                <div key={k.label} className="rounded-2xl p-4 border bg-white border-slate-200">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{k.label}</p>
                  <p className="text-lg font-bold mt-1.5 font-mono truncate text-slate-900">{k.value}</p>
                </div>
              ))}
              <div className={cn('rounded-2xl p-4 border', diff === 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200')}>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-600">Cuadre débito / crédito</p>
                <p className={cn('flex items-center gap-1.5 text-sm font-bold mt-2', diff === 0 ? 'text-emerald-700' : 'text-amber-700')}>
                  {diff === 0 ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                  {diff === 0 ? 'Cuadrado' : `Diferencia ${money.format(diff)}`}
                </p>
                {hasFilters && <p className="text-[11px] text-slate-500 mt-1">Con filtros aplicados</p>}
              </div>
            </div>
          )}

          {/* Totales por clase */}
          {(data?.byClass.length ?? 0) > 0 && (
            <div className="rounded-2xl border overflow-hidden bg-white border-slate-200">
              <div className="px-5 py-3 border-b border-slate-100">
                <h3 className="font-bold text-sm text-slate-900">Resumen por clase · {periodLabel(current)}</h3>
                <p className="text-xs text-slate-400">
                  Corte {control?.cut_date ?? '—'} · {totals?.accounts ?? 0} cuentas · {totals?.thirdParties ?? 0} terceros
                </p>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-wider">
                    <th className="py-2 px-4 text-left">Clase</th>
                    <th className="py-2 px-4 text-right">Saldo inicial</th>
                    <th className="py-2 px-4 text-right">Débito</th>
                    <th className="py-2 px-4 text-right">Crédito</th>
                    <th className="py-2 px-4 text-right">Saldo final</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data!.byClass.map(c => (
                    <tr
                      key={c.code}
                      onClick={() => { setAccount(c.code); setPage(1) }}
                      className="hover:bg-primary-50/60 cursor-pointer"
                      title="Filtrar por esta clase"
                    >
                      <td className="py-2 px-4 font-medium text-slate-800">{c.label}</td>
                      <td className="py-2 px-4 text-right font-mono text-slate-700">{fmt(c.initialBalance)}</td>
                      <td className="py-2 px-4 text-right font-mono text-slate-700">{fmt(c.debit)}</td>
                      <td className="py-2 px-4 text-right font-mono text-slate-700">{fmt(c.credit)}</td>
                      <td className="py-2 px-4 text-right font-mono font-semibold text-slate-900">{fmt(c.finalBalance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
                  onClick={() => { setAccount(''); setSearch(''); setPage(1) }}
                  className="text-xs font-semibold text-primary-600 hover:underline flex items-center gap-1"
                >
                  <X className="w-3.5 h-3.5" /> Limpiar filtros
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">Cuenta (código o prefijo)</label>
                <input
                  value={account}
                  onChange={e => { setAccount(e.target.value); setPage(1) }}
                  placeholder="Ej: 13, 1305, 41556001"
                  className={inputCls}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-medium text-slate-500 mb-1">Buscar tercero, NIT o nombre de cuenta</label>
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    value={search}
                    onChange={e => { setSearch(e.target.value); setPage(1) }}
                    placeholder="Ej: 901655024, ANL CORP, Clientes nacionales"
                    className={cn(inputCls, 'pl-9')}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Detalle */}
          <div className="rounded-2xl border overflow-hidden bg-white border-slate-200">
            {(data?.data.length ?? 0) === 0 ? (
              <div className="p-12 text-center text-sm text-slate-500">No hay cuentas para los filtros seleccionados</div>
            ) : (
              <>
                <div className={cn('overflow-x-auto', isFetching && 'opacity-70')}>
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-900 text-white text-[11px] font-semibold uppercase tracking-wider">
                        <th className="py-3 px-3 whitespace-nowrap">Código</th>
                        <th className="py-3 px-3 whitespace-nowrap">Cuenta contable</th>
                        <th className="py-3 px-3 whitespace-nowrap">Identificación</th>
                        <th className="py-3 px-3 whitespace-nowrap">Suc.</th>
                        <th className="py-3 px-3 whitespace-nowrap">Tercero</th>
                        <th className="py-3 px-3 whitespace-nowrap text-right">Saldo inicial</th>
                        <th className="py-3 px-3 whitespace-nowrap text-right">Débito</th>
                        <th className="py-3 px-3 whitespace-nowrap text-right">Crédito</th>
                        <th className="py-3 px-3 whitespace-nowrap text-right">Saldo final</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {data!.data.map(r => (
                        <tr key={r.id} className="hover:bg-slate-50/80">
                          <td className="py-2 px-3 font-mono text-slate-700 whitespace-nowrap">{r.account_code}</td>
                          <td className="py-2 px-3 max-w-[240px] truncate text-slate-800" title={[r.account_label, r.account_name].filter(Boolean).join(' · ')}>
                            {r.account_name || '—'}
                          </td>
                          <td className="py-2 px-3 font-mono text-slate-600 whitespace-nowrap">{r.identification || '—'}</td>
                          <td className="py-2 px-3 text-slate-500">{r.branch || '—'}</td>
                          <td className="py-2 px-3 max-w-[220px] truncate font-medium text-slate-800" title={r.third_party_name}>
                            {r.third_party_name || '—'}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-slate-700 whitespace-nowrap">{fmt(r.initial_balance)}</td>
                          <td className="py-2 px-3 text-right font-mono text-slate-700 whitespace-nowrap">{fmt(r.debit)}</td>
                          <td className="py-2 px-3 text-right font-mono text-slate-700 whitespace-nowrap">{fmt(r.credit)}</td>
                          <td className={cn('py-2 px-3 text-right font-mono font-semibold whitespace-nowrap', r.final_balance < 0 ? 'text-red-600' : 'text-slate-900')}>
                            {fmt(r.final_balance)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-slate-100 bg-slate-50/50">
                  <p className="text-xs text-slate-500">
                    {periodLabel(current)} · página <span className="font-semibold">{page}</span> de{' '}
                    <span className="font-semibold">{totalPages}</span> ({data?.total ?? 0} filas)
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
