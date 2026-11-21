import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

import { Button } from '@/components/ui/Button'
import { PageLoader } from '@/components/ui/Spinner'

import { X, Download, CheckCircle2, ChevronDown, Search, RotateCcw, Wallet, Receipt, CreditCard } from 'lucide-react'
import { fmtMoney } from './format'

// ── Vista de Pagos: Saldos de RC y RP no cruzados con filtros por Tercero, Cliente y Mes ──
export function PaymentsView({
  defaultPeriod,
  appliedPayments = [],
  appliedLoading = false,
  onApplyPayment,
}: {
  defaultPeriod: string
  appliedPayments?: any[]
  appliedLoading?: boolean
  onApplyPayment?: (data: any) => void
}) {
  const [subTab, setSubTab] = useState<'uncrossed' | 'applied'>('uncrossed')
  const [period, setPeriod] = useState<string>(defaultPeriod || '')
  const [docType, setDocType] = useState<string>('')
  const [client, setClient] = useState<string>('')
  const [thirdParty, setThirdParty] = useState<string>('')
  const [search, setSearch] = useState<string>('')
  const [openAccordion, setOpenAccordion] = useState<Record<string, boolean>>({})

  // Sincronizar si cambia el periodo general en la barra superior y no se ha modificado manualmente
  useEffect(() => {
    if (defaultPeriod) {
      setPeriod(defaultPeriod)
    }
  }, [defaultPeriod])

  const { data, isLoading } = useQuery({
    queryKey: ['participations', 'pagos', period, docType, client, thirdParty, search],
    queryFn: async () => {
      const p = new URLSearchParams()
      if (period) p.set('period', period)
      if (docType) p.set('doc_type', docType)
      if (client.trim()) p.set('client', client.trim())
      if (thirdParty.trim()) p.set('third_party', thirdParty.trim())
      if (search.trim()) p.set('search', search.trim())
      const { data } = await api.get(`/api/participations/pagos?${p}`)
      return data
    },
  })

  const items: any[] = data?.items ?? []
  const s = data?.summary ?? {
    count: 0,
    fv_count: 0, fc_count: 0, rc_count: 0, rp_count: 0,
    fv_saldo: 0, fc_saldo: 0, rc_saldo: 0, rp_saldo: 0,
    client_saldo: 0, third_party_saldo: 0, total_saldo: 0,
  }
  const options = data?.filter_options ?? { clients: [], third_parties: [], periods: [] }

  // FV/RC son del lado del cliente (nos deben); FC/RP del lado del tercero (debemos).
  const isClientSide = (t: string) => t === 'FV' || t === 'RC'
  const TYPE_META: Record<string, { sub: string; badge: string; text: string }> = {
    FV: { sub: 'Cartera',       badge: 'bg-indigo-100 text-indigo-800',   text: 'text-indigo-700' },
    RC: { sub: 'Recaudo',       badge: 'bg-blue-100 text-blue-800',       text: 'text-blue-700' },
    FC: { sub: 'Fact. tercero', badge: 'bg-violet-100 text-violet-800',   text: 'text-violet-700' },
    RP: { sub: 'Egreso',        badge: 'bg-emerald-100 text-emerald-800', text: 'text-emerald-700' },
  }

  const hasFilters = Boolean(period || docType || client || thirdParty || search)

  const clearAllFilters = () => {
    setPeriod('')
    setDocType('')
    setClient('')
    setThirdParty('')
    setSearch('')
  }

  const exportCsv = () => {
    if (!items.length) return
    const headers = ['Tipo', 'Comprobante', 'Factura_Ref', 'Tipo_Entidad', 'NIT', 'Nombre', 'Periodo', 'Fecha_Documento', 'Valor_Total', 'Aplicado', 'Saldo_Pendiente', 'Nota']
    const rows = items.map(r => [
      r.doc_type,
      `"${(r.comprobante || '').replace(/"/g, '""')}"`,
      `"${(r.fv_ref || '').replace(/"/g, '""')}"`,
      isClientSide(r.doc_type) ? 'Cliente' : 'Tercero',
      `"${(r.tercero_nit || '').replace(/"/g, '""')}"`,
      `"${(r.tercero_name || '').replace(/"/g, '""')}"`,
      r.period || '',
      r.doc_date || '',
      r.amount ?? 0,
      r.applied ?? 0,
      r.saldo ?? 0,
      `"${(r.note || '').replace(/"/g, '""')}"`,
    ])
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(';'), ...rows.map(e => e.join(';'))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `saldos_no_cruzados_${period || 'todos'}_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Componente de grupo histórico aplicado
  const AppliedGroup = ({ g }: { g: any }) => {
    const key = `${g.kind}:${g.voucher}`
    const isOpen = !!openAccordion[key]
    const isRC = g.kind === 'RC'
    const totalLabel = isRC ? 'Recaudado' : 'Pagado'
    const totalValue = isRC ? g.collected_total : g.paid_total
    return (
      <div className="border-b border-slate-100 last:border-0">
        <button onClick={() => setOpenAccordion(o => ({ ...o, [key]: !isOpen }))}
          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 text-left">
          <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${isOpen ? '' : '-rotate-90'}`} />
          <span className="font-mono text-[12px] text-slate-700 whitespace-nowrap">{g.voucher}</span>
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isRC ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>{g.kind}</span>
          <span className="text-xs text-slate-400 whitespace-nowrap">{g.date ?? '—'}</span>
          <span className={`text-xs font-medium whitespace-nowrap ${g.count > 1 ? 'text-primary-600' : 'text-slate-400'}`}>
            {g.count} factura{g.count === 1 ? '' : 's'}
          </span>
          <span className="ml-auto text-sm font-semibold text-slate-800 whitespace-nowrap">{fmtMoney(totalValue)}</span>
        </button>
        {isOpen && (
          <div className="px-4 pb-3">
            <table className="w-full text-sm bg-slate-50/60 rounded-lg overflow-hidden">
              <thead>
                <tr className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="px-3 py-1.5">Factura</th>
                  <th className="px-3 py-1.5">Cliente</th>
                  <th className="px-3 py-1.5">Tercero</th>
                  <th className="px-3 py-1.5">Participación</th>
                  <th className="px-3 py-1.5">{totalLabel}</th>
                </tr>
              </thead>
              <tbody>
                {g.invoices.map((inv: any, i: number) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="px-3 py-1.5 text-slate-700 whitespace-nowrap">{inv.finto_invoice ?? '—'}</td>
                    <td className="px-3 py-1.5 text-slate-600">{inv.company ?? '—'}</td>
                    <td className="px-3 py-1.5 text-slate-500">{inv.third_party ?? '—'}</td>
                    <td className="px-3 py-1.5 text-slate-600 whitespace-nowrap">{fmtMoney(inv.participation_value)}</td>
                    <td className="px-3 py-1.5 text-slate-700 whitespace-nowrap">{fmtMoney(isRC ? inv.collected : inv.egress_voucher_value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    )
  }

  const AppliedSection = ({ title, kind }: { title: string; kind: 'RC' | 'RP' }) => {
    const groupItems = appliedPayments.filter(p => p.kind === kind)
    return (
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">{title}</h3>
          <span className="text-xs text-slate-400">{groupItems.length} comprobante{groupItems.length === 1 ? '' : 's'}</span>
        </div>
        {groupItems.length ? groupItems.map((g: any) => <AppliedGroup key={`${g.kind}:${g.voucher}`} g={g} />)
          : <p className="px-4 py-8 text-center text-slate-400 text-sm">Sin comprobantes aplicados en este periodo.</p>}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Sub-selector de vista dentro de Pagos */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSubTab('uncrossed')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              subTab === 'uncrossed'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Wallet className="w-3.5 h-3.5" />
            Saldos No Cruzados (FV / FC / RC / RP)
            <span className={`text-[11px] px-1.5 py-0.2 rounded-full font-bold ${
              subTab === 'uncrossed' ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-600'
            }`}>
              {s.count}
            </span>
          </button>

          <button
            onClick={() => setSubTab('applied')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              subTab === 'applied'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            Comprobantes Aplicados a Facturas
            <span className={`text-[11px] px-1.5 py-0.2 rounded-full font-bold ${
              subTab === 'applied' ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-600'
            }`}>
              {appliedPayments.length}
            </span>
          </button>
        </div>

        {subTab === 'uncrossed' && (
          <div className="flex items-center gap-2 ml-auto">
            <Button size="sm" variant="secondary" onClick={exportCsv} disabled={!items.length}>
              <Download className="w-3.5 h-3.5" /> Exportar saldos CSV
            </Button>
          </div>
        )}
      </div>

      {subTab === 'applied' ? (
        appliedLoading ? <div className="py-10"><PageLoader /></div> : (
          <div className="space-y-4">
            <p className="text-xs text-slate-400">Un pago puede cubrir varias facturas (reparto FIFO). Despliega un comprobante para ver a qué facturas se aplicó.</p>
            <AppliedSection title="Recaudos del cliente (pagos a Finto · RC)" kind="RC" />
            <AppliedSection title="Pagos al tercero (RP)" kind="RP" />
          </div>
        )
      ) : (
        <>
          {/* Tarjetas KPI de Saldos */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Total Saldo */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between shadow-xs">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Saldo No Cruzado</span>
                <span className="p-1.5 rounded-lg bg-slate-100 text-slate-600">
                  <Wallet className="w-4 h-4" />
                </span>
              </div>
              <div className="text-xl font-bold text-slate-900">{fmtMoney(s.total_saldo)}</div>
              <p className="text-[11px] text-slate-500 mt-1">
                <b className="text-slate-800">{s.count}</b> documento{s.count === 1 ? '' : 's'} con saldo pendiente
              </p>
            </div>

            {/* Lado cliente: FV (cartera) + RC (recaudo) → nos deben */}
            <div className="bg-blue-50/50 border border-blue-200/70 rounded-xl p-4 flex flex-col justify-between shadow-xs">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700">Cliente · Nos deben (FV + RC)</span>
                <span className="p-1.5 rounded-lg bg-blue-100 text-blue-700">
                  <Receipt className="w-4 h-4" />
                </span>
              </div>
              <div className="text-xl font-bold text-blue-900">{fmtMoney(s.client_saldo)}</div>
              <p className="text-[11px] text-blue-600/90 mt-1">
                <b className="text-indigo-900">{s.fv_count}</b> FV (cartera) · <b className="text-blue-900">{s.rc_count}</b> RC sin aplicar
              </p>
            </div>

            {/* Lado tercero: FC (factura) + RP (egreso) → debemos */}
            <div className="bg-emerald-50/50 border border-emerald-200/70 rounded-xl p-4 flex flex-col justify-between shadow-xs">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Tercero · Debemos (FC + RP)</span>
                <span className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700">
                  <CreditCard className="w-4 h-4" />
                </span>
              </div>
              <div className="text-xl font-bold text-emerald-900">{fmtMoney(s.third_party_saldo)}</div>
              <p className="text-[11px] text-emerald-600/90 mt-1">
                <b className="text-violet-900">{s.fc_count}</b> FC sin conciliar · <b className="text-emerald-900">{s.rp_count}</b> RP sin aplicar
              </p>
            </div>
          </div>

          {/* Barra de Filtros: Tercero, Cliente, Mes y Tipo */}
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-3 shadow-xs">
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Filtro por Tipo */}
              <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-xs font-medium">
                <button
                  onClick={() => setDocType('')}
                  className={`px-3 py-1 rounded-md transition-all ${
                    docType === '' ? 'bg-white text-slate-900 font-semibold shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Todos ({s.count})
                </button>
                <button
                  onClick={() => setDocType('FV')}
                  className={`px-3 py-1 rounded-md transition-all ${
                    docType === 'FV' ? 'bg-white text-indigo-700 font-semibold shadow-xs' : 'text-slate-500 hover:text-indigo-700'
                  }`}
                >
                  FV Cartera ({s.fv_count})
                </button>
                <button
                  onClick={() => setDocType('RC')}
                  className={`px-3 py-1 rounded-md transition-all ${
                    docType === 'RC' ? 'bg-white text-blue-700 font-semibold shadow-xs' : 'text-slate-500 hover:text-blue-700'
                  }`}
                >
                  RC Clientes ({s.rc_count})
                </button>
                <button
                  onClick={() => setDocType('FC')}
                  className={`px-3 py-1 rounded-md transition-all ${
                    docType === 'FC' ? 'bg-white text-violet-700 font-semibold shadow-xs' : 'text-slate-500 hover:text-violet-700'
                  }`}
                >
                  FC Terceros ({s.fc_count})
                </button>
                <button
                  onClick={() => setDocType('RP')}
                  className={`px-3 py-1 rounded-md transition-all ${
                    docType === 'RP' ? 'bg-white text-emerald-700 font-semibold shadow-xs' : 'text-slate-500 hover:text-emerald-700'
                  }`}
                >
                  RP Terceros ({s.rp_count})
                </button>
              </div>

              {/* Filtro por Mes */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-slate-500">Mes:</span>
                <select
                  value={period}
                  onChange={e => setPeriod(e.target.value)}
                  className={`text-xs border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white ${
                    period ? 'border-primary-400 text-primary-800 font-medium' : 'border-slate-200 text-slate-600'
                  }`}
                >
                  <option value="">Todos los meses</option>
                  {options.periods.map((m: string) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                  {period && !options.periods.includes(period) && (
                    <option value={period}>{period}</option>
                  )}
                </select>
              </div>

              {/* Filtro por Cliente (visible para Todos, FV o RC) */}
              {docType !== 'RP' && docType !== 'FC' && (
                <div className="flex items-center gap-1.5 min-w-[200px] flex-1 sm:flex-initial">
                  <span className="text-xs font-semibold text-blue-700">Cliente:</span>
                  <select
                    value={client}
                    onChange={e => setClient(e.target.value)}
                    className={`w-full text-xs border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white ${
                      client ? 'border-blue-400 text-blue-800 font-medium' : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    <option value="">Todos los clientes (FV / RC)</option>
                    {options.clients.map((c: any) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Filtro por Tercero (visible para Todos, FC o RP) */}
              {docType !== 'RC' && docType !== 'FV' && (
                <div className="flex items-center gap-1.5 min-w-[200px] flex-1 sm:flex-initial">
                  <span className="text-xs font-semibold text-emerald-700">Tercero:</span>
                  <select
                    value={thirdParty}
                    onChange={e => setThirdParty(e.target.value)}
                    className={`w-full text-xs border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white ${
                      thirdParty ? 'border-emerald-400 text-emerald-800 font-medium' : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    <option value="">Todos los terceros (FC / RP)</option>
                    {options.third_parties.map((tp: any) => (
                      <option key={tp.value} value={tp.value}>{tp.label}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Búsqueda libre */}
              <div className="relative min-w-[180px] flex-1 sm:flex-initial ml-auto">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar comprobante, FV, NIT..."
                  className="w-full text-xs pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                {search && (
                  <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Limpiar filtros */}
              {hasFilters && (
                <button
                  onClick={clearAllFilters}
                  className="flex items-center gap-1 text-xs text-rose-600 hover:text-rose-700 font-medium px-2 py-1 hover:bg-rose-50 rounded-lg transition-colors"
                  title="Restablecer todos los filtros"
                >
                  <RotateCcw className="w-3 h-3" /> Limpiar
                </button>
              )}
            </div>
          </div>

          {/* Tabla de Saldos Pendientes */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="text-left px-3.5 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Tipo</th>
                    <th className="text-left px-3.5 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Comprobante</th>
                    <th className="text-left px-3.5 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Factura Ref.</th>
                    <th className="text-left px-3.5 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cliente / Tercero</th>
                    <th className="text-left px-3.5 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Mes / Fecha</th>
                    <th className="text-right px-3.5 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Valor Total</th>
                    <th className="text-right px-3.5 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Aplicado</th>
                    <th className="text-right px-3.5 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Saldo Pendiente</th>
                    <th className="text-center px-3.5 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Estado</th>
                    <th className="text-left px-3.5 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Nota</th>
                    <th className="text-right px-3.5 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoading ? (
                    <tr>
                      <td colSpan={11} className="px-4 py-12 text-center text-slate-400 text-sm">
                        <PageLoader />
                      </td>
                    </tr>
                  ) : !items.length ? (
                    <tr>
                      <td colSpan={11} className="px-4 py-12 text-center text-slate-400 text-sm">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                          <p className="font-semibold text-slate-700">No hay saldos de FV, FC, RC o RP pendientes con los filtros seleccionados</p>
                          <p className="text-xs text-slate-400">Todos los comprobantes correspondientes se encuentran debidamente cruzados.</p>
                          {hasFilters && (
                            <Button size="sm" variant="secondary" onClick={clearAllFilters} className="mt-2">
                              Restablecer filtros
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    items.map((r: any) => {
                      const clientSide = isClientSide(r.doc_type)
                      const meta = TYPE_META[r.doc_type] ?? { sub: '', badge: 'bg-slate-100 text-slate-700', text: 'text-slate-700' }
                      const pctUncrossed = r.amount > 0 ? Math.round(((r.saldo ?? 0) / r.amount) * 100) : 100
                      const isPartial = (Number(r.applied ?? 0) > 0)
                      return (
                        <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-3.5 py-2.5 whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md ${meta.badge}`}>
                              {r.doc_type}
                              <span className="text-[9px] font-normal opacity-75">
                                {meta.sub}
                              </span>
                            </span>
                          </td>
                          <td className="px-3.5 py-2.5 font-mono text-xs font-semibold text-slate-800 whitespace-nowrap">
                            {r.comprobante}
                          </td>
                          <td className="px-3.5 py-2.5 text-xs text-slate-600 whitespace-nowrap">
                            {r.fv_ref ? (
                              <span className="font-medium text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">{r.fv_ref}</span>
                            ) : (
                              <span className="text-slate-400 italic text-[11px]">Sin FV</span>
                            )}
                          </td>
                          <td className="px-3.5 py-2.5 min-w-[220px]">
                            <div className="flex flex-col">
                              <span className="font-semibold text-slate-800 text-xs leading-tight">
                                {r.tercero_name || '—'}
                              </span>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className={`text-[10px] font-bold uppercase ${meta.text}`}>
                                  {clientSide ? 'Cliente' : 'Tercero'}:
                                </span>
                                <span className="text-[11px] font-mono text-slate-400">
                                  {r.tercero_nit || 'Sin NIT'}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="px-3.5 py-2.5 text-xs text-slate-600 whitespace-nowrap">
                            <div className="flex flex-col">
                              <span className="font-medium text-slate-700">{r.period || '—'}</span>
                              <span className="text-[11px] text-slate-400">{r.doc_date ?? ''}</span>
                            </div>
                          </td>
                          <td className="px-3.5 py-2.5 text-right font-medium text-slate-700 whitespace-nowrap text-xs">
                            {fmtMoney(Number(r.amount ?? 0))}
                          </td>
                          <td className="px-3.5 py-2.5 text-right text-slate-500 whitespace-nowrap text-xs">
                            {fmtMoney(Number(r.applied ?? 0))}
                          </td>
                          <td className="px-3.5 py-2.5 text-right whitespace-nowrap">
                            <div className="flex flex-col items-end">
                              <span className={`text-xs font-bold ${meta.text}`}>
                                {fmtMoney(Number(r.saldo ?? 0))}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {pctUncrossed}% pendiente
                              </span>
                            </div>
                          </td>
                          <td className="px-3.5 py-2.5 text-center whitespace-nowrap">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              isPartial
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : 'bg-slate-100 text-slate-600 border border-slate-200'
                            }`}>
                              {isPartial ? 'Cruce parcial' : 'Sin cruzar'}
                            </span>
                          </td>
                          <td className="px-3.5 py-2.5 text-xs text-slate-500 max-w-[200px] truncate" title={r.note || ''}>
                            {r.note || '—'}
                          </td>
                          <td className="px-3.5 py-2.5 text-right whitespace-nowrap">
                            {r.doc_type === 'RC' && onApplyPayment && (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => onApplyPayment({
                                  comprobante: r.comprobante,
                                  clientNit: r.tercero_nit,
                                  clientName: r.tercero_name,
                                  amount: Number(r.saldo ?? r.amount ?? 0),
                                  fvRef: r.fv_ref,
                                })}
                              >
                                <Receipt className="w-3 h-3" /> Aplicar
                              </Button>
                            )}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
            {items.length > 0 && (
              <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>Mostrando <b>{items.length}</b> comprobante{items.length === 1 ? '' : 's'}</span>
                <span>
                  Saldo pendiente acumulado: <b className="text-slate-900">{fmtMoney(s.total_saldo)}</b>
                </span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
