import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

import { Button } from '@/components/ui/Button'
import { PageLoader } from '@/components/ui/Spinner'

import { X } from 'lucide-react'
import { fmtMoney } from './format'

export function BalanceDetailModal({ kind, row, onClose }: { kind: 'cxc' | 'cxp'; row: any; onClose: () => void }) {
  const isCxc = kind === 'cxc'
  const items: any[] = [...(row.items ?? [])].sort((a: any, b: any) => {
    const pComp = String(a.period || '').localeCompare(String(b.period || ''))
    if (pComp !== 0) return pComp
    return String(a.purchase_order || '').localeCompare(String(b.purchase_order || ''))
  })
  const headers = isCxc
    ? ['OC', 'Periodo', 'Factura', 'Facturado', 'Recaudado', 'Saldo']
    : ['OC', 'Periodo', 'Cliente', 'Factura', 'Causado', 'Disponible', 'Pagado', 'Por pagar']

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              {isCxc ? `Nos deben — ${row.client}` : `Debemos — ${row.third_party}`}
            </h3>
            <p className="text-xs text-slate-400">
              {isCxc
                ? `Saldo por cobrar ${fmtMoney(row.outstanding)} · facturado ${fmtMoney(row.invoiced)} − recaudado ${fmtMoney(row.collected)}`
                : `Por pagar ${fmtMoney(row.owed)} · ${row.nit ? `NIT ${row.nit} · ` : ''}pagado ${fmtMoney(row.paid)}`}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-slim px-6 py-5 space-y-3">
          <p className="text-[11px] text-slate-500">
            {isCxc
              ? 'Nos deben porque estas facturas emitidas aún no se recaudan por completo. Saldo = Facturado − Recaudado.'
              : 'Debemos porque estas participaciones ya están recaudadas (disponibles) y aún no se pagan al tercero. Por pagar = Disponible − Pagado.'}
          </p>
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto max-h-96 overflow-y-auto scrollbar-slim">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50">
                  <tr className="border-b border-slate-100">
                    {headers.map(h => (
                      <th key={h} className="text-left px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {items.map((it: any, i: number) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="px-3 py-2 font-mono text-[11px] text-slate-500 whitespace-nowrap">{it.purchase_order}</td>
                      <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{it.period}</td>
                      {isCxc ? (
                        <>
                          <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{it.finto_invoice ?? '—'}</td>
                          <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{fmtMoney(it.invoiced)}</td>
                          <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{fmtMoney(it.collected)}</td>
                          <td className={`px-3 py-2 font-semibold whitespace-nowrap ${it.outstanding > 0 ? 'text-blue-700' : 'text-slate-400'}`}>{fmtMoney(it.outstanding)}</td>
                        </>
                      ) : (
                        <>
                          <td className="px-3 py-2 text-slate-600">{it.client}</td>
                          <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{it.finto_invoice ?? '—'}</td>
                          <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{fmtMoney(it.participation_value)}</td>
                          <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{fmtMoney(it.available)}</td>
                          <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{fmtMoney(it.paid)}</td>
                          <td className={`px-3 py-2 font-semibold whitespace-nowrap ${it.owed > 0 ? 'text-red-600' : 'text-slate-400'}`}>{fmtMoney(it.owed)}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div className="flex justify-end px-6 py-4 border-t border-slate-100 shrink-0">
          <Button variant="secondary" onClick={onClose}>Cerrar</Button>
        </div>
      </div>
    </div>
  )
}

export function BalancesPanel({ period, year, from, to }: { period: string; year: string; from: string; to: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['participations', 'balances', period, year, from, to],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (period) params.set('period', period)
      else if (year) params.set('year', year)
      if (from) params.set('from', from)
      if (to) params.set('to', to)
      const { data } = await api.get(`/api/participations/balances?${params}`)
      return data
    },
  })

  const [detail, setDetail] = useState<{ kind: 'cxc' | 'cxp'; row: any } | null>(null)

  if (isLoading) return <div className="py-10"><PageLoader /></div>
  const s = data?.summary ?? {}
  const receivable: any[] = data?.receivable ?? []
  const payable: any[] = data?.payable ?? []

  return (
    <div className="space-y-4">
      {/* Tarjetas de saldo */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: 'Participación causada', value: fmtMoney(s.participation_total ?? 0), cls: 'text-slate-900', sub: `${s.count ?? 0} OC · total causado` },
          { label: 'Nos deben (clientes)', value: fmtMoney(s.receivable_total ?? 0), cls: 'text-blue-700', sub: 'CxC · facturado sin recaudar' },
          { label: 'Debemos (terceros)', value: fmtMoney(s.payable_total ?? 0), cls: 'text-red-600', sub: 'CxP · disponible sin pagar' },
          { label: 'Disponible para pago', value: fmtMoney(s.available_total ?? 0), cls: 'text-emerald-700', sub: 'recaudado a favor del tercero' },
          { label: 'Pagado a terceros', value: fmtMoney(s.paid_total ?? 0), cls: 'text-slate-700', sub: 'egresos registrados' },
        ].map(k => (
          <div key={k.label} className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{k.label}</p>
            <p className={`text-2xl font-bold mt-1 ${k.cls}`}>{k.value}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">{k.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Lo que nos deben — por cliente */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Lo que nos deben — clientes</h3>
            <span className="text-xs font-semibold text-blue-700">{fmtMoney(s.receivable_total ?? 0)}</span>
          </div>
          <div className="overflow-x-auto scrollbar-slim">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {['Cliente', 'Facturado', 'Recaudado', 'Saldo'].map(h => (
                    <th key={h} className="text-left px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {receivable.map((r: any, i: number) => (
                  <tr key={i} className="hover:bg-blue-50 cursor-pointer" onClick={() => setDetail({ kind: 'cxc', row: r })} title="Ver detalle">
                    <td className="px-3 py-2 text-slate-700">{r.client}</td>
                    <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{fmtMoney(r.invoiced)}</td>
                    <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{fmtMoney(r.collected)}</td>
                    <td className="px-3 py-2 font-semibold text-blue-700 whitespace-nowrap">{fmtMoney(r.outstanding)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!receivable.length && <p className="px-4 py-8 text-center text-slate-400 text-sm">Sin saldos por cobrar.</p>}
          </div>
        </div>

        {/* Lo que debemos — por tercero */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Lo que debemos — terceros</h3>
            <span className="text-xs font-semibold text-red-600">{fmtMoney(s.payable_total ?? 0)}</span>
          </div>
          <div className="overflow-x-auto scrollbar-slim">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {['Tercero', 'NIT', 'Por pagar', 'Pagado'].map(h => (
                    <th key={h} className="text-left px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {payable.map((r: any, i: number) => (
                  <tr key={i} className="hover:bg-red-50 cursor-pointer" onClick={() => setDetail({ kind: 'cxp', row: r })} title="Ver detalle">
                    <td className="px-3 py-2 text-slate-700">{r.third_party}</td>
                    <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{r.nit || '—'}</td>
                    <td className="px-3 py-2 font-semibold text-red-600 whitespace-nowrap">{fmtMoney(r.owed)}</td>
                    <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{fmtMoney(r.paid)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!payable.length && <p className="px-4 py-8 text-center text-slate-400 text-sm">Sin saldos por pagar.</p>}
          </div>
        </div>
      </div>

      {detail && <BalanceDetailModal kind={detail.kind} row={detail.row} onClose={() => setDetail(null)} />}
    </div>
  )
}
