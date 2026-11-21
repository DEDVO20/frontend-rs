import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

import { Button } from '@/components/ui/Button'
import { PageLoader } from '@/components/ui/Spinner'

import { ChevronDown, Search, ChevronsUpDown, AlertCircle } from 'lucide-react'
import { fmtMoney, INV_STATUS } from './format'
import { RcTaxesLine } from './shared'

export function ThirdPartiesView({
  period, year, from, to, onSelectInvoice,
}: {
  period: string
  year: string
  from: string
  to: string
  onSelectInvoice: (item: any) => void
}) {
  const [search, setSearch] = useState('')
  const [filterOwed, setFilterOwed] = useState<'all' | 'owed' | 'settled'>('all')
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const { data, isLoading } = useQuery({
    queryKey: ['participations', 'by-third-party', period, year, from, to, search],
    queryFn: async () => {
      const p = new URLSearchParams()
      if (period) p.set('period', period)
      else if (year) p.set('year', year)
      if (from) p.set('from', from)
      if (to) p.set('to', to)
      if (search.trim()) p.set('q', search.trim())
      const { data } = await api.get(`/api/participations/by-third-party?${p}`)
      return data
    },
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  })

  const summary = data?.summary ?? {}
  const rawList: any[] = data?.third_parties ?? []

  const thirdParties = rawList.filter(tp => {
    if (filterOwed === 'owed') return tp.balance_owed > 0
    if (filterOwed === 'settled') return tp.balance_owed <= 0
    return true
  })

  const allExpanded = thirdParties.length > 0 && thirdParties.every(tp => !!expanded[tp.id])
  const toggleAll = () => {
    if (allExpanded) {
      setExpanded({})
    } else {
      const next: Record<string, boolean> = {}
      thirdParties.forEach(tp => { next[tp.id] = true })
      setExpanded(next)
    }
  }

  if (isLoading) return <div className="py-12"><PageLoader /></div>

  return (
    <div className="space-y-4">
      {/* Tarjetas resumen superiores */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Terceros', value: summary.third_parties_count ?? 0, cls: 'text-slate-800', sub: `${summary.invoices_count ?? 0} facturas/OC` },
          { label: 'Participación Bruta', value: fmtMoney(summary.participation_total ?? 0), cls: 'text-slate-700', sub: 'comisión causada' },
          { label: 'Giro Neto (Impuestos)', value: fmtMoney(summary.net_payable_total ?? 0), cls: 'text-emerald-700', sub: 'tras retenciones e IVA' },
          { label: 'Facturado Tercero', value: fmtMoney(summary.third_party_invoiced_total ?? 0), cls: 'text-violet-700', sub: 'facturas compra (FC)' },
          { label: 'Pagado al Tercero', value: fmtMoney(summary.paid_total ?? 0), cls: 'text-slate-700', sub: 'egresos (RP)' },
          { label: 'Saldo Neto por Pagar', value: fmtMoney(summary.net_balance_owed_total ?? 0), cls: 'text-rose-600', sub: 'neto disponible pendiente' },
        ].map(k => (
          <div key={k.label} className="bg-white border border-slate-200 rounded-xl p-3">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{k.label}</p>
            <p className={`text-lg font-bold mt-0.5 ${k.cls}`}>{k.value}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Barra de búsqueda y filtros */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl p-3">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar tercero por nombre, NIT, factura o cliente…"
              className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Filtro de estado de saldo */}
          <div className="flex gap-1">
            {([
              ['all', 'Todos'],
              ['owed', 'Con saldo por pagar'],
              ['settled', 'Al día'],
            ] as const).map(([k, l]) => (
              <button
                key={k}
                onClick={() => setFilterOwed(k)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                  filterOwed === k
                    ? 'border-primary-300 bg-primary-50 text-primary-700'
                    : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        {thirdParties.length > 0 && (
          <Button size="sm" variant="secondary" onClick={toggleAll}>
            <ChevronsUpDown className="w-3.5 h-3.5" />
            {allExpanded ? 'Colapsar todos' : 'Expandir todos'}
          </Button>
        )}
      </div>

      {/* Lista de terceros con facturas */}
      {!thirdParties.length ? (
        <div className="bg-white border border-slate-200 rounded-xl px-4 py-12 text-center text-slate-400 text-sm">
          No se encontraron terceros con facturas registradas para los filtros aplicados.
        </div>
      ) : (
        <div className="space-y-3">
          {thirdParties.map((tp: any) => {
            const isOpen = !!expanded[tp.id]
            const invs: any[] = [...(tp.invoices ?? [])].sort((a: any, b: any) => {
              const pComp = String(a.period || '').localeCompare(String(b.period || ''))
              if (pComp !== 0) return pComp
              return String(a.purchase_order || '').localeCompare(String(b.purchase_order || ''))
            })
            return (
              <div key={tp.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:border-slate-300 transition-colors">
                {/* Cabecera del tercero */}
                <div
                  onClick={() => setExpanded(prev => ({ ...prev, [tp.id]: !isOpen }))}
                  className="px-4 py-3.5 flex flex-wrap items-center justify-between gap-3 cursor-pointer bg-slate-50/50 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-[240px]">
                    <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${isOpen ? '' : '-rotate-90'}`} />
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-sm font-bold text-slate-800">{tp.name}</h4>
                        {tp.identification && (
                          <span className="font-mono text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                            NIT {tp.identification}
                          </span>
                        )}
                        {tp.has_tax_profile ? (
                          <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded" title="Perfil tributario asignado">
                            {tp.tax_profile_name}
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded" title="Sin perfil asignado. Cálculo neutro (sin retenciones ni IVA).">
                            Sin perfil (neutro)
                          </span>
                        )}
                        <span className="text-[11px] font-semibold text-primary-700 bg-primary-50 px-2 py-0.5 rounded-full">
                          {tp.invoices_count} {tp.invoices_count === 1 ? 'factura' : 'facturas'}
                        </span>
                        {tp.unmatched_fc_count > 0 && (
                          <span
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full"
                            title={`${tp.unmatched_fc_count} factura(s) de compra en Siigo pendientes de asociar por valor de ${fmtMoney(tp.unmatched_fc_total)}`}
                          >
                            <AlertCircle className="w-3 h-3 text-amber-500" />
                            {tp.unmatched_fc_count} FC en Siigo sin cruzar
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Métricas consolidadas en el encabezado */}
                  <div className="flex flex-wrap items-center gap-4 text-xs">
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block uppercase font-medium">Part. Bruta</span>
                      <span className="font-semibold text-slate-700">{fmtMoney(tp.participation_total)}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-emerald-700 block uppercase font-bold">Giro Neto</span>
                      <span className="font-bold text-emerald-700">{fmtMoney(tp.net_payable_total ?? tp.available_total)}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block uppercase font-medium">Facturado FC</span>
                      <span className="font-semibold text-slate-700">{fmtMoney(tp.third_party_invoiced_total)}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block uppercase font-medium">Pagado RP</span>
                      <span className="font-semibold text-slate-700">{fmtMoney(tp.paid_total)}</span>
                    </div>
                    <div className="text-right pl-2 border-l border-slate-200">
                      <span className="text-[10px] text-slate-400 block uppercase font-medium">Saldo Neto</span>
                      <span className={`font-bold ${(tp.net_balance_owed ?? tp.balance_owed) > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                        {fmtMoney(tp.net_balance_owed ?? tp.balance_owed)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Detalle de facturas del tercero */}
                {isOpen && (
                  <div className="border-t border-slate-100">
                    <div className="overflow-x-auto scrollbar-slim">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-100/60 border-b border-slate-200/80">
                          <tr>
                            {['OC / Periodo', 'Cliente', 'Factura Finto (FV)', 'Factura Tercero (FC)', 'Part. Bruta', 'Recaudado (RC)', 'Giro Neto (Impuestos)', 'Pago (RP)', 'Saldo Neto', 'Estado', ''].map(h => (
                              <th key={h} className="text-left px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {invs.map((inv: any) => {
                            const st = INV_STATUS[inv.status] ?? INV_STATUS.pending_third_invoice
                            const fintoVal = Number(inv.finto_invoice_value ?? 0)
                            const coll = Number(inv.collected ?? 0)
                            const collPct = fintoVal > 0 ? Math.min(100, Math.round((coll / fintoVal) * 100)) : 0
                            const thirdVal = inv.third_party_invoice_value != null ? Number(inv.third_party_invoice_value) : null
                            const paidVal = Number(inv.egress_voucher_value ?? 0)
                            const netPay = Number(inv.net_payable ?? inv.available_for_payment ?? 0)
                            const netOwed = Number(inv.net_balance_owed ?? inv.balance_owed ?? 0)

                            return (
                              <tr
                                key={inv.id}
                                onClick={() => onSelectInvoice(inv._raw ? { ...inv._raw, id: inv.id || inv._raw.id } : inv)}
                                className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                              >
                                <td className="px-3 py-2 whitespace-nowrap">
                                  <div className="font-mono text-[11px] font-semibold text-slate-700">{inv.purchase_order}</div>
                                  <div className="text-[10px] text-slate-400">{inv.period ?? '—'}</div>
                                </td>

                                <td className="px-3 py-2">
                                  <div className="text-xs font-medium text-slate-800">{inv.client_name}</div>
                                  {inv.client_nit && <div className="text-[10px] text-slate-400">NIT {inv.client_nit}</div>}
                                </td>

                                <td className="px-3 py-2 whitespace-nowrap">
                                  <div className="text-xs font-semibold text-slate-700">{inv.finto_invoice || '—'}</div>
                                  <div className="text-[10px] text-slate-400">{inv.finto_invoice_date || '—'} · {fmtMoney(fintoVal)}</div>
                                </td>

                                <td className="px-3 py-2 whitespace-nowrap">
                                  {inv.third_party_invoice ? (
                                    <>
                                      <div className="text-xs font-medium text-violet-700">{inv.third_party_invoice}</div>
                                      <div className="text-[10px] text-slate-400">{inv.third_party_invoice_date || '—'} · {thirdVal != null ? fmtMoney(thirdVal) : '—'}</div>
                                    </>
                                  ) : (
                                    <span className="text-xs text-slate-400 italic">Pendiente</span>
                                  )}
                                </td>

                                <td className="px-3 py-2 whitespace-nowrap">
                                  <div className="text-xs font-semibold text-slate-800">{fmtMoney(Number(inv.participation_value ?? 0))}</div>
                                  <div className="text-[10px] text-slate-400">{inv.contract_type === 'mandato' ? 'Mandato' : 'Servicio'}</div>
                                </td>

                                <td className="px-3 py-2 whitespace-nowrap">
                                  <div className="text-xs text-slate-700 font-medium">{fmtMoney(coll)} <span className="text-[10px] text-slate-400">({collPct}%)</span></div>
                                  {inv.cash_receipts && (
                                    <div className="text-[10px] text-blue-700 font-medium">
                                      RC: {inv.cash_receipts}
                                      {inv.cash_receipt_date && <span className="text-slate-500 font-normal"> ({inv.cash_receipt_date})</span>}
                                    </div>
                                  )}
                                  <RcTaxesLine taxes={inv.collection_taxes} />
                                  <div className="text-[10px] text-slate-500">Disp. bruto {fmtMoney(Number(inv.available_for_payment ?? 0))}</div>
                                </td>

                                <td className="px-3 py-2 whitespace-nowrap">
                                  <div className="text-xs font-bold text-emerald-700">{fmtMoney(netPay)}</div>
                                  <div className="text-[10px]">
                                    {inv.has_tax_profile ? (
                                      <span className="text-emerald-600 font-medium">Liquidado</span>
                                    ) : (
                                      <span className="text-amber-600 font-medium">Neutro</span>
                                    )}
                                  </div>
                                </td>

                                <td className="px-3 py-2 whitespace-nowrap">
                                  {inv.egress_voucher ? (
                                    <>
                                      <div className="text-xs font-medium text-emerald-700">{inv.egress_voucher}</div>
                                      <div className="text-[10px] text-slate-400">{inv.egress_voucher_date || '—'} · {fmtMoney(paidVal)}</div>
                                    </>
                                  ) : (
                                    <span className="text-xs text-slate-400 italic">Sin egreso</span>
                                  )}
                                </td>

                                <td className="px-3 py-2 whitespace-nowrap font-semibold">
                                  <span className={netOwed > 0 ? 'text-red-600' : 'text-slate-400'}>
                                    {fmtMoney(netOwed)}
                                  </span>
                                </td>

                                <td className="px-3 py-2 whitespace-nowrap">
                                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${st.cls}`}>
                                    {st.label}
                                  </span>
                                </td>

                                <td className="px-3 py-2 whitespace-nowrap text-right">
                                  <span className="text-xs text-primary-600 hover:text-primary-700 font-medium">
                                    Ver detalle
                                  </span>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
