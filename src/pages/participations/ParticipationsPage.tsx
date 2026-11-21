import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { TopBar } from '@/components/layout/TopBar'
import { Button } from '@/components/ui/Button'
import { PageLoader } from '@/components/ui/Spinner'
import { useAuthStore } from '@/stores/authStore'
import { toast } from 'sonner'
import { Upload, Download, CalendarPlus, Filter, ChevronDown, SlidersHorizontal } from 'lucide-react'
import { type DateSel, fmtMoney, INV_STATUS, STATUS_FILTERS } from '@/features/participations/format'
import { DateFilter, RcTaxesLine } from '@/features/participations/shared'
import { MovimientoImportModal, AccountSettingsModal } from '@/features/participations/ImportModals'

import { ParticipationDetailModal } from '@/features/participations/ParticipationDetailModal'
import { ManualPaymentModal } from '@/features/participations/ManualPaymentModal'
import { ReconciliationView, CruceView } from '@/features/participations/ReconciliationView'
import { BalancesPanel } from '@/features/participations/BalancesPanel'
import { PaymentsView } from '@/features/participations/PaymentsView'
import { ThirdPartiesView } from '@/features/participations/ThirdPartiesView'

export function ParticipationsPage() {
  const qc = useQueryClient()
  const { user } = useAuthStore()
  const isAdmin = ['admin', 'rs_admin'].includes(user?.role ?? '')

  const [view, setView] = useState<'panel' | 'list' | 'third_parties' | 'payments' | 'cruce' | 'saldos' | 'reconciliation'>('panel')
  const [showFilters, setShowFilters] = useState(false)
  const [statusF, setStatusF] = useState('')
  const [yearF, setYearF] = useState('')
  const [monthF, setMonthF] = useState('')
  const [fromF, setFromF] = useState('')
  const [toF, setToF] = useState('')
  const [page, setPage] = useState(1)
  const [showMovimiento, setShowMovimiento] = useState(false)
  const [showAccounts, setShowAccounts] = useState(false)
  const [detailItem, setDetailItem] = useState<any | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [manualPaymentData, setManualPaymentData] = useState<{ comprobante: string; clientNit?: string; clientName?: string; amount: number; fvRef?: string } | null>(null)

  const dateSel: DateSel = { year: yearF, month: monthF, from: fromF, to: toF }
  const onDateChange = (v: DateSel) => {
    setYearF(v.year); setMonthF(v.month); setFromF(v.from); setToF(v.to); setPage(1)
  }
  const monthPeriod = yearF && monthF ? `${yearF}-${monthF}` : ''
  const yearOnly = yearF && !monthF ? yearF : ''
  const setDateParams = (p: URLSearchParams) => {
    if (monthPeriod) p.set('period', monthPeriod)
    else if (yearOnly) p.set('year', yearOnly)
    if (fromF) p.set('from', fromF)
    if (toF) p.set('to', toF)
  }

  const downloadConciliation = async () => {
    try {
      setDownloading(true)
      const params = new URLSearchParams()
      setDateParams(params)
      const res = await api.get(`/api/participations/conciliation/export?${params}`, { responseType: 'blob' })
      const url = URL.createObjectURL(res.data as Blob)
      const a = document.createElement('a')
      a.href = url
      const suffix = monthPeriod || yearOnly || (fromF || toF ? `${fromF || 'ini'}_${toF || 'fin'}` : '')
      a.download = `conciliacion${suffix ? '-' + suffix : ''}.xlsx`
      document.body.appendChild(a); a.click(); a.remove()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('No se pudo descargar la conciliación')
    } finally {
      setDownloading(false)
    }
  }

  const genMonthlyMut = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/api/participations/generate-monthly', monthPeriod ? { period: monthPeriod } : {})
      return data
    },
    onSuccess: (d: any) => {
      toast.success(`${d.created ?? 0} OC generada(s) para ${d.period}${d.skipped ? ` · ${d.skipped} ya existían` : ''}`)
      qc.invalidateQueries({ queryKey: ['participations'] })
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Error al generar las OC'),
  })

  const { data: stats } = useQuery({
    queryKey: ['participations', 'invoice-stats', monthPeriod, yearOnly, fromF, toF],
    queryFn: async () => {
      const params = new URLSearchParams()
      setDateParams(params)
      const { data } = await api.get(`/api/participations/invoice-stats?${params}`)
      return data
    },
  })

  const { data, isLoading } = useQuery({
    queryKey: ['participations', 'invoices', statusF, monthPeriod, yearOnly, fromF, toF, page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      if (statusF) params.set('status', statusF)
      setDateParams(params)
      const { data } = await api.get(`/api/participations/invoices?${params}`)
      return data
    },
    placeholderData: (prev: any) => prev,
    // Siempre fresco: evita mostrar OC ya inexistentes (ids viejos) por el caché de 5 min.
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  })
  const rows: any[] = [...(data?.data ?? [])].sort((a: any, b: any) => {
    const pComp = String(a.period || '').localeCompare(String(b.period || ''))
    if (pComp !== 0) return pComp
    return String(a.purchase_order || '').localeCompare(String(b.purchase_order || ''))
  })
  const total: number = data?.total ?? 0
  const pages = Math.max(1, Math.ceil(total / 20))

  const { data: paymentsData, isLoading: paymentsLoading } = useQuery({
    queryKey: ['participations', 'payments', monthPeriod, yearOnly, fromF, toF],
    enabled: view === 'payments',
    queryFn: async () => {
      const params = new URLSearchParams()
      setDateParams(params)
      const { data } = await api.get(`/api/participations/payments?${params}`)
      return data
    },
  })

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar title="Participaciones" subtitle="Participación de terceros en la facturación" />

      <div className="flex-1 overflow-y-auto scrollbar-slim p-4 md:p-6 space-y-4">
        {/* Vista: Resumen (panel) / Detalle (lista) */}
        <div className="flex gap-1 border-b border-slate-200">
          {([['panel', 'Resumen'], ['list', 'Detalle'], ['third_parties', 'Terceros'], ['reconciliation', 'Conciliación'], ['payments', 'Pagos'], ['cruce', 'Cruce']] as const).map(([k, l]) => (
            <button key={k} onClick={() => setView(k)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${view === k ? 'border-primary-500 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
              {l}
            </button>
          ))}
        </div>

        {/* Controles */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Selector de fecha unificado (Año/Mes o rango) — ambas vistas */}
          <DateFilter value={dateSel} onChange={onDateChange} />

          {/* Estado — solo Detalle, menú vertical */}
          {view === 'list' && (
            <div className="relative">
              <Button size="sm" variant="secondary" onClick={() => setShowFilters(v => !v)}>
                <Filter className="w-3.5 h-3.5" />
                {statusF ? (STATUS_FILTERS.find(([k]) => k === statusF)?.[1] ?? 'Estado') : 'Estado'}
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
              </Button>
              {showFilters && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowFilters(false)} />
                  <div className="absolute left-0 mt-1 z-20 bg-white border border-slate-200 rounded-xl shadow-lg p-1.5 flex flex-col gap-0.5 min-w-[200px]">
                    {STATUS_FILTERS.map(([k, l]) => (
                      <button key={k} onClick={() => { setStatusF(k); setPage(1); setShowFilters(false) }}
                        className={`text-left text-sm px-3 py-1.5 rounded-lg transition-colors ${statusF === k ? 'bg-primary-50 text-primary-700 font-medium' : 'text-slate-600 hover:bg-slate-50'}`}>
                        {l}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          <Button size="sm" variant="secondary" className="ml-auto" loading={downloading} onClick={downloadConciliation}>
            <Download className="w-3.5 h-3.5" /> Descargar conciliación
          </Button>
          {isAdmin && (
            <Button size="sm" variant="secondary" loading={genMonthlyMut.isPending} onClick={() => genMonthlyMut.mutate()}
              title={monthPeriod ? `Generar OC de ${monthPeriod}` : 'Generar OC del mes actual'}>
              <CalendarPlus className="w-3.5 h-3.5" /> Generar OC del mes
            </Button>
          )}
          {isAdmin && (
            <Button size="sm" onClick={() => setShowMovimiento(true)} title='Reporte "Movimiento por cuenta contable": ventas, recaudo, factura del tercero y pagos en un solo archivo'>
              <Upload className="w-3.5 h-3.5" /> Importar movimiento
            </Button>
          )}
          {isAdmin && (
            <Button size="sm" variant="secondary" onClick={() => setShowAccounts(true)} title="Configurar las cuentas contables que usa el import">
              <SlidersHorizontal className="w-3.5 h-3.5" /> Cuentas
            </Button>
          )}
        </div>

        {view === 'panel' && <BalancesPanel period={monthPeriod} year={yearOnly} from={fromF} to={toF} />}

        {view === 'reconciliation' && (
          <ReconciliationView period={monthPeriod} />
        )}

        {view === 'third_parties' && (
          <ThirdPartiesView
            period={monthPeriod}
            year={yearOnly}
            from={fromF}
            to={toF}
            onSelectInvoice={item => setDetailItem(item)}
          />
        )}

        {view === 'payments' && (
          <PaymentsView
            defaultPeriod={monthPeriod}
            appliedPayments={paymentsData?.payments ?? []}
            appliedLoading={paymentsLoading}
            onApplyPayment={setManualPaymentData}
          />
        )}

        {view === 'cruce' && (
          <CruceView
            period={monthPeriod}
            onApplyPayment={setManualPaymentData}
          />
        )}

        {view === 'saldos' && (
          <PaymentsView
            defaultPeriod={monthPeriod}
            appliedPayments={paymentsData?.payments ?? []}
            appliedLoading={paymentsLoading}
            onApplyPayment={setManualPaymentData}
          />
        )}

        {view === 'list' && (<>
        {/* Mini stats */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            { label: 'Participaciones', value: stats?.total ?? 0, cls: 'text-slate-900' },
            { label: 'Pend. factura tercero', value: stats?.pending_third_invoice ?? 0, cls: 'text-amber-600' },
            { label: 'Diferencia / pend. pago', value: (stats?.value_difference ?? 0) + (stats?.pending_payment ?? 0), cls: 'text-blue-600' },
            { label: 'Valor participaciones', value: fmtMoney(stats?.participation_total ?? 0), cls: 'text-primary-700' },
            { label: 'Disponible para tercero', value: fmtMoney(stats?.available_total ?? 0), cls: 'text-emerald-700' },
          ].map(k => (
            <div key={k.label} className="bg-white border border-slate-200 rounded-xl p-3">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{k.label}</p>
              <p className={`text-xl font-bold mt-0.5 ${k.cls}`}>{k.value}</p>
            </div>
          ))}
        </div>

        {/* Tabla por factura */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {isLoading ? (
            <div className="py-10"><PageLoader /></div>
          ) : (
            <div className="overflow-x-auto scrollbar-slim">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    {['OC', 'Cliente', 'Servicio', 'Tercero', 'Factura (FV)', 'Participación', 'Recaudo (RC)', 'Por cobrar', 'Disponible', 'Pago Tercero (RP)', 'Estado', ''].map((h, i) => (
                      <th key={i} className="text-left px-3 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {rows.map((r: any) => {
                    const p = r.participation ?? {}
                    const st = INV_STATUS[r.status] ?? INV_STATUS.pending_third_invoice
                    const collected = Number(r.collected ?? 0)
                    const inv = Number(r.finto_invoice_value ?? 0)
                    return (
                      <tr key={r.id} onClick={() => setDetailItem(r)} className="hover:bg-slate-50 transition-colors cursor-pointer">
                        <td className="px-3 py-2.5 font-mono text-[11px] text-slate-600 whitespace-nowrap">{r.purchase_order}</td>
                        <td className="px-3 py-2.5 text-slate-700">{r.companies?.name ?? '—'}</td>
                        <td className="px-3 py-2.5 text-slate-500">{p.company_service?.services?.name ?? '—'}</td>
                        <td className="px-3 py-2.5 text-slate-500">{p.third_party?.name ?? '—'}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <div className="font-semibold text-slate-700">{r.finto_invoice || '—'}</div>
                          <div className="text-[10px] text-slate-400">{r.finto_invoice_date || '—'} · {fmtMoney(inv)}</div>
                        </td>
                        <td className="px-3 py-2.5 font-semibold text-slate-900 whitespace-nowrap">{fmtMoney(Number(r.participation_value))}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <div className={`font-semibold ${collected > 0 ? 'text-slate-800' : 'text-slate-400'}`}>
                            {fmtMoney(collected)}{inv > 0 && <span className="text-[10px] font-normal text-slate-400"> · {Math.min(100, Math.round(collected / inv * 100))}%</span>}
                          </div>
                          {r.cash_receipts ? (
                            <div className="text-[10px] text-blue-700 font-medium">
                              RC: {r.cash_receipts}
                              {r.cash_receipt_date && <span className="text-slate-500 font-normal"> ({r.cash_receipt_date})</span>}
                            </div>
                          ) : (
                            <div className="text-[10px] text-slate-400 italic">Sin recaudo</div>
                          )}
                          <RcTaxesLine taxes={r.collection_taxes} />
                        </td>
                        <td className={`px-3 py-2.5 whitespace-nowrap font-semibold ${Math.max(0, inv - collected) > 0 ? 'text-blue-700' : 'text-slate-400'}`}>
                          {fmtMoney(Math.max(0, inv - collected))}
                        </td>
                        <td className={`px-3 py-2.5 whitespace-nowrap font-medium ${Number(r.available_for_payment) > 0 ? 'text-emerald-700' : 'text-slate-400'}`}>
                          {fmtMoney(Number(r.available_for_payment ?? 0))}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          {r.egress_voucher ? (
                            <>
                              <div className="font-semibold text-slate-800">{fmtMoney(Number(r.egress_voucher_value ?? 0))}</div>
                              <div className="text-[10px] text-emerald-700 font-medium">
                                RP: {r.egress_voucher}
                                {r.egress_voucher_date && <span className="text-slate-500 font-normal"> ({r.egress_voucher_date})</span>}
                              </div>
                            </>
                          ) : Number(r.available_for_payment ?? 0) > 0 ? (
                            <span className="text-[11px] text-amber-700 font-medium bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                              Pend. pago
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap"><span className={`text-xs font-medium px-2 py-1 rounded-full ${st.cls}`}>{st.label}</span></td>
                        <td className="px-3 py-2.5 text-right whitespace-nowrap">
                          <span className="text-xs text-primary-600 hover:text-primary-700 font-medium">Ver detalle</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {!rows.length && (
                <p className="px-4 py-12 text-center text-slate-400 text-sm">
                  No hay participaciones por factura. {isAdmin && 'Usa "Importar movimiento" para crearlas desde el reporte de movimiento contable.'}
                </p>
              )}
            </div>
          )}
          {pages > 1 && (
            <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between text-sm text-slate-500">
              <span>Página {page} de {pages}</span>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Anterior</Button>
                <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>Siguiente</Button>
              </div>
            </div>
          )}
        </div>
        </>)}
      </div>

      {showMovimiento && <MovimientoImportModal onClose={() => setShowMovimiento(false)} />}
      {showAccounts && <AccountSettingsModal onClose={() => setShowAccounts(false)} />}
      {detailItem && (
        <ParticipationDetailModal
          item={detailItem}
          onClose={() => setDetailItem(null)}
          onOpenManualPayment={setManualPaymentData}
        />
      )}
      {manualPaymentData && <ManualPaymentModal data={manualPaymentData} onClose={() => setManualPaymentData(null)} />}
    </div>
  )
}
