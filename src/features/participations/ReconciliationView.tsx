import { useState, Fragment } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

import { Button } from '@/components/ui/Button'
import { PageLoader } from '@/components/ui/Spinner'
import { useAuthStore } from '@/stores/authStore'
import { toast } from 'sonner'
import { X, ChevronDown, Search, ChevronsUpDown, RotateCcw, Receipt, Unlink } from 'lucide-react'
import { fmtMoney, INV_STATUS, DOC_BADGE, normNit, DOC_TONE } from './format'
import { DocTypeFilter } from './shared'

export function SuggestFifoModal({ period, onClose }: { period: string; onClose: () => void }) {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['participations', 'suggest', period],
    queryFn: async () => {
      const p = new URLSearchParams()
      if (period) p.set('period', period)
      const { data } = await api.get(`/api/participations/allocations/suggest?${p}`)
      return data
    },
  })
  const proposals: any[] = data?.proposals ?? []
  const total = proposals.reduce((a, p) => a + Number(p.amount ?? 0), 0)

  const applyMut = useMutation({
    mutationFn: async () => {
      const items = proposals.map(p => ({
        source_doc_type: p.source_doc_type, source_comprobante: p.source_comprobante,
        invoice_participation_id: p.invoice_participation_id, amount: Number(p.amount), source_nit: p.source_nit,
      }))
      const { data } = await api.post('/api/participations/allocations/apply', { items })
      return data
    },
    onSuccess: (res: any) => {
      toast.success(`Se aplicaron ${res.created} de ${res.total} sugerencias`)
      qc.invalidateQueries({ queryKey: ['participations'] })
      onClose()
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Error al aplicar las sugerencias'),
  })

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-xs" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="text-base font-bold text-slate-900">Sugerencia FIFO — revisa y aplica</h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-slim px-6 py-4">
          <p className="text-xs text-slate-500 mb-3">Estas asignaciones se proponen automáticamente (más antiguas primero). Puedes aplicarlas todas y luego ajustar lo que quieras en la rejilla.</p>
          {isLoading ? <div className="py-10"><PageLoader /></div> : !proposals.length ? (
            <div className="py-10 text-center text-slate-400 text-sm">No hay sugerencias con saldo disponible.</div>
          ) : (
            <table className="w-full text-xs">
              <thead className="text-[10px] font-bold text-slate-400 uppercase border-b border-slate-100">
                <tr><th className="text-left px-2 py-1.5">Tipo</th><th className="text-left px-2 py-1.5">Documento</th><th className="text-left px-2 py-1.5">OC / Factura</th><th className="text-left px-2 py-1.5">Cliente / Tercero</th><th className="text-right px-2 py-1.5">Monto</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {proposals.map((p, i) => (
                  <tr key={i}>
                    <td className="px-2 py-1.5"><span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${DOC_TONE[p.source_doc_type]?.badge}`}>{p.source_doc_type}</span></td>
                    <td className="px-2 py-1.5 font-mono text-slate-700">{p.source_comprobante}</td>
                    <td className="px-2 py-1.5 text-slate-600">{p.oc_label}</td>
                    <td className="px-2 py-1.5 text-slate-500">{p.source_doc_type === 'RC' ? p.client_name : p.tercero_name}</td>
                    <td className="px-2 py-1.5 text-right font-semibold text-slate-800 whitespace-nowrap">{fmtMoney(Number(p.amount))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 px-6 py-3 border-t border-slate-100">
          <span className="text-xs text-slate-500">{proposals.length} sugerencia{proposals.length === 1 ? '' : 's'} · Total {fmtMoney(total)}</span>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
            <Button size="sm" loading={applyMut.isPending} disabled={!proposals.length} onClick={() => applyMut.mutate()}>Aplicar todas</Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function ReconciliationView({ period }: { period: string }) {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [assignType, setAssignType] = useState<'RC' | 'FC' | 'RP'>('RC')
  const [amounts, setAmounts] = useState<Record<string, number>>({})
  const [suggestOpen, setSuggestOpen] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['participations', 'reconciliation', period, search],
    queryFn: async () => {
      const p = new URLSearchParams()
      if (period) p.set('period', period)
      if (search.trim()) p.set('search', search.trim())
      const { data } = await api.get(`/api/participations/reconciliation?${p}`)
      return data
    },
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  })
  const ocs: any[] = data?.ocs ?? []
  const available = data?.available ?? { RC: [], FC: [], RP: [] }

  const assignMut = useMutation({
    mutationFn: async (payload: any) => {
      const { data } = await api.post('/api/participations/allocations', payload)
      return data
    },
    onSuccess: () => {
      toast.success('Documento asignado')
      qc.invalidateQueries({ queryKey: ['participations'] })
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Error al asignar'),
  })

  const unlinkMut = useMutation({
    mutationFn: async (id: string) => { await api.delete(`/api/participations/allocations/${id}`) },
    onSuccess: () => {
      toast.success('Asignación eliminada')
      qc.invalidateQueries({ queryKey: ['participations'] })
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Error al desvincular'),
  })

  // Documentos disponibles que aplican a una OC según el tipo (por NIT)
  const docsForOc = (oc: any, type: 'RC' | 'FC' | 'RP') => {
    const targetNit = normNit(type === 'RC' ? oc.client_nit : oc.tercero_nit)
    return (available[type] ?? []).filter((d: any) => targetNit && normNit(d.tercero_nit) === targetNit)
  }
  const gapFor = (oc: any, type: 'RC' | 'FC' | 'RP') =>
    type === 'RC' ? Math.max(0, oc.finto_invoice_value - oc.collected)
    : type === 'FC' ? Math.max(0, oc.participation_value - oc.third_party_invoice_value)
    : Math.max(0, oc.participation_value - oc.egress_voucher_value)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px]">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar OC, FV, cliente, tercero…"
            className="w-full text-xs pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" />
        </div>
        <Button size="sm" variant="secondary" onClick={() => setSuggestOpen(true)}>
          <ChevronsUpDown className="w-3.5 h-3.5" /> Sugerir FIFO
        </Button>
        <span className="ml-auto text-xs text-slate-400">{ocs.length} OC · el import solo registra los documentos; aquí asignas el dinero.</span>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>{['OC / Periodo', 'Cliente', 'Tercero', 'Factura (FV)', 'Causado', 'Recaudo (RC)', 'Fact. tercero (FC)', 'Pago (RP)', 'Estado', ''].map(h => (
                <th key={h} className="text-left px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {isLoading ? (
                <tr><td colSpan={10} className="px-4 py-12 text-center"><PageLoader /></td></tr>
              ) : !ocs.length ? (
                <tr><td colSpan={10} className="px-4 py-12 text-center text-slate-400 text-sm">No hay OC con participación causada para estos filtros.</td></tr>
              ) : ocs.map((oc: any) => {
                const st = INV_STATUS[oc.status] ?? INV_STATUS.pending_third_invoice
                const isOpen = expanded === oc.id
                return (
                  <Fragment key={oc.id}>
                    <tr className="hover:bg-slate-50/70 cursor-pointer" onClick={() => setExpanded(isOpen ? null : oc.id)}>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isOpen ? '' : '-rotate-90'}`} />
                          <div>
                            <div className="font-mono text-[11px] font-semibold text-slate-700">{oc.purchase_order}</div>
                            <div className="text-[10px] text-slate-400">{oc.period ?? '—'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-slate-700">{oc.client_name}</td>
                      <td className="px-3 py-2 text-slate-500">{oc.tercero_name}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <div className="font-semibold text-slate-700">{oc.finto_invoice || '—'}</div>
                        <div className="text-[10px] text-slate-400">{fmtMoney(oc.finto_invoice_value)}</div>
                      </td>
                      <td className="px-3 py-2 font-semibold text-slate-900 whitespace-nowrap">{fmtMoney(oc.participation_value)}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-blue-700">{fmtMoney(oc.collected)}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-violet-700">
                        {fmtMoney(oc.third_party_invoice_value)}
                        {oc.payment_order && <div className="text-[10px] text-slate-400 font-mono">{oc.payment_order}</div>}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-emerald-700">{fmtMoney(oc.egress_voucher_value)}</td>
                      <td className="px-3 py-2 whitespace-nowrap"><span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span></td>
                      <td className="px-3 py-2 text-right text-[11px] text-primary-600 font-semibold whitespace-nowrap">{isOpen ? 'Cerrar' : 'Conciliar'}</td>
                    </tr>
                    {isOpen && (
                      <tr>
                        <td colSpan={10} className="bg-slate-50/60 px-4 py-3">
                          <div className="grid md:grid-cols-2 gap-4">
                            {/* Asignaciones actuales */}
                            <div>
                              <h4 className="text-[11px] font-bold text-slate-500 uppercase mb-2">Asignado a esta OC</h4>
                              {oc.allocations.length ? (
                                <div className="space-y-1">
                                  {oc.allocations.map((a: any) => (
                                    <div key={a.id} className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs">
                                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${DOC_TONE[a.source_doc_type]?.badge}`}>{a.source_doc_type}</span>
                                      <span className="font-mono text-slate-700">{a.source_comprobante}</span>
                                      {a.origin === 'auto' && <span className="text-[9px] text-slate-400 uppercase">auto</span>}
                                      <span className="ml-auto font-semibold text-slate-800">{fmtMoney(a.amount)}</span>
                                      <button onClick={() => unlinkMut.mutate(a.id)} title="Desvincular" className="text-rose-500 hover:text-rose-700"><Unlink className="w-3.5 h-3.5" /></button>
                                    </div>
                                  ))}
                                </div>
                              ) : <p className="text-xs text-slate-400">Sin documentos asignados aún.</p>}
                            </div>
                            {/* Asignar documentos disponibles */}
                            <div>
                              <div className="flex items-center gap-1 mb-2">
                                {(['RC', 'FC', 'RP'] as const).map(t => (
                                  <button key={t} onClick={() => setAssignType(t)}
                                    className={`text-[11px] font-semibold px-2 py-0.5 rounded ${assignType === t ? DOC_TONE[t].badge : 'text-slate-500 hover:bg-slate-100'}`}>
                                    {t} <span className="hidden sm:inline">· {DOC_TONE[t].label}</span>
                                  </button>
                                ))}
                                <span className="ml-auto text-[10px] text-slate-400">Hueco: {fmtMoney(gapFor(oc, assignType))}</span>
                              </div>
                              {(() => {
                                const docs = docsForOc(oc, assignType)
                                if (!docs.length) return <p className="text-xs text-slate-400">No hay {assignType} disponibles para este {assignType === 'RC' ? 'cliente' : 'tercero'}.</p>
                                return (
                                  <div className="space-y-1 max-h-48 overflow-y-auto scrollbar-slim">
                                    {docs.map((d: any) => {
                                      const key = `${oc.id}:${assignType}:${d.comprobante}`
                                      const suggested = Math.min(d.available, gapFor(oc, assignType)) || d.available
                                      const val = amounts[key] ?? Math.round(suggested * 100) / 100
                                      return (
                                        <div key={key} className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs">
                                          <span className="font-mono text-slate-700">{d.comprobante}</span>
                                          <span className="text-[10px] text-slate-400">{d.doc_date || d.period || ''}</span>
                                          <span className="text-[10px] text-slate-500">disp. {fmtMoney(d.available)}</span>
                                          <input type="number" step="any" value={val}
                                            onChange={e => setAmounts(m => ({ ...m, [key]: Number(e.target.value) || 0 }))}
                                            className="ml-auto w-24 text-right text-xs px-1.5 py-1 border border-slate-200 rounded" />
                                          <button
                                            disabled={assignMut.isPending || val <= 0}
                                            onClick={() => assignMut.mutate({ source_doc_type: assignType, source_comprobante: d.comprobante, purchase_order: oc.purchase_order, amount: val, source_nit: d.tercero_nit })}
                                            className="text-[11px] font-bold text-primary-600 hover:text-primary-700 bg-primary-50 hover:bg-primary-100 px-2 py-1 rounded">
                                            Asignar
                                          </button>
                                        </div>
                                      )
                                    })}
                                  </div>
                                )
                              })()}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {suggestOpen && <SuggestFifoModal period={period} onClose={() => setSuggestOpen(false)} />}
    </div>
  )
}

export function CruceView({ period, onApplyPayment }: { period: string; onApplyPayment?: (data: any) => void }) {
  const [docType, setDocType] = useState('')
  const [nit, setNit] = useState('')
  const { data, isLoading } = useQuery({
    queryKey: ['participations', 'cruce', period, docType, nit],
    queryFn: async () => {
      const p = new URLSearchParams()
      if (period) p.set('period', period)
      if (docType) p.set('doc_type', docType)
      if (nit.trim()) p.set('nit', nit.trim())
      const { data } = await api.get(`/api/participations/cruce?${p}`)
      return data
    },
  })
  const alerts: any[] = data?.alerts ?? []
  const by = data?.summary?.by_type ?? {}

  // Reparar saldos de RC/FC/RP: primero vista previa, luego confirmar
  const qc = useQueryClient()
  const canRepair = ['admin', 'rs_admin'].includes(useAuthStore(s => s.user?.role ?? ''))
  const repairMut = useMutation({
    mutationFn: async (apply: boolean) => (await api.post('/api/participations/repair-money-docs', { apply })).data,
    onSuccess: (res: any, apply) => {
      const n = (res?.changes?.length ?? 0) + (res?.adopted?.length ?? 0)
      if (!apply) {
        if (!n) { toast.success('Los saldos de RC/FC/RP ya cuadran con sus asignaciones'); return }
        const lines = [
          ...(res.adopted ?? []).slice(0, 8).map((a: any) => `• ${a.purchase_order}: ${a.doc_type} ${a.comprobante} ${fmtMoney(a.amount)} (registro manual → asignación)`),
          ...(res.changes ?? []).slice(0, 8).map((c: any) => `• ${c.doc_type} ${c.comprobante}: aplicado ${fmtMoney(c.applied_before)} → ${fmtMoney(c.applied_after)}`),
        ]
        if (window.confirm(`Se corregirán ${n} registro(s):\n\n${lines.join('\n')}${n > 16 ? '\n…' : ''}\n\n¿Aplicar?`)) repairMut.mutate(true)
        return
      }
      toast.success(`Saldos reparados: ${res.changes?.length ?? 0} documento(s), ${res.adopted?.length ?? 0} registro(s) manual(es) convertidos`)
      qc.invalidateQueries({ queryKey: ['participations'] })
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'No se pudieron reparar los saldos'),
  })

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <DocTypeFilter value={docType} onChange={setDocType} options={['FV', 'RC', 'ND', 'FC', 'RP']} />
        {canRepair && (
          <Button size="sm" variant="secondary" loading={repairMut.isPending} onClick={() => repairMut.mutate(false)}
            title="Recalcula lo aplicado de cada RC/FC/RP desde sus asignaciones y libera saldos sin OC">
            <RotateCcw className="w-3 h-3" /> Reparar saldos
          </Button>
        )}
        <input value={nit} onChange={e => setNit(e.target.value)} placeholder="NIT cliente/tercero…"
          className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500" />
        <span className="ml-auto text-xs text-slate-400">
          {data?.summary?.total ?? 0} no cruzados{Object.keys(by).length ? ' · ' + Object.entries(by).map(([k, v]) => `${k}:${v}`).join(' ') : ''}
        </span>
      </div>
      <p className="text-[11px] text-slate-400">Documentos del último import que no cruzaron con una participación. El Cruce nunca genera OC.</p>
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>{['Tipo', 'Comprobante', 'FV', 'NIT', 'Nombre', 'Mes', 'Valor', 'Motivo', 'Acción'].map(h => (
                <th key={h} className="text-left px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {isLoading ? (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-slate-400 text-sm">Cargando…</td></tr>
              ) : !alerts.length ? (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-slate-400 text-sm">Sin documentos no cruzados 🎉</td></tr>
              ) : alerts.map((a: any) => (
                <tr key={a.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2"><span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${DOC_BADGE[a.doc_type] ?? 'bg-slate-100 text-slate-600'}`}>{a.doc_type}</span></td>
                  <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{a.comprobante}</td>
                  <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{a.fv_ref || '—'}</td>
                  <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{a.tercero_nit || '—'}</td>
                  <td className="px-3 py-2 text-slate-600">{a.tercero_name || '—'}</td>
                  <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{a.period || '—'}</td>
                  <td className="px-3 py-2 text-slate-700 font-medium whitespace-nowrap text-right">{fmtMoney(Number(a.amount ?? 0))}</td>
                  <td className="px-3 py-2 text-[11px] text-amber-600">{a.note || '—'}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    {a.doc_type === 'RC' && onApplyPayment && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => onApplyPayment({
                          comprobante: a.comprobante,
                          clientNit: a.tercero_nit,
                          clientName: a.tercero_name,
                          amount: Number(a.amount ?? 0),
                          fvRef: a.fv_ref,
                        })}
                      >
                        <Receipt className="w-3 h-3" /> Aplicar pago
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
