import { useState, useRef, type DragEvent } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

import { Button } from '@/components/ui/Button'

import { toast } from 'sonner'
import { X, Upload } from 'lucide-react'
import { fmtMoney } from './format'

export function MovimientoImportModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [file, setFile] = useState<File | null>(null)
  const [report, setReport] = useState<any | null>(null)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const ACCEPT = ['.xlsx', '.xls', '.csv']
  const pickFile = (f: File | null | undefined) => {
    if (!f) return
    const ok = ACCEPT.some(ext => f.name.toLowerCase().endsWith(ext))
    if (!ok) { toast.error('Formato no válido. Usa un archivo .xlsx, .xls o .csv'); return }
    setFile(f)
    setReport(null)
  }
  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragging(false)
    pickFile(e.dataTransfer.files?.[0])
  }

  const run = async (apply: boolean) => {
    const fd = new FormData()
    fd.append('file', file!)
    fd.append('apply', String(apply))
    const { data } = await api.post('/api/participations/import-movimiento', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
    return data
  }
  const previewMut = useMutation({
    mutationFn: () => run(false),
    onSuccess: (d: any) => setReport(d),
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Error al leer'),
  })
  const applyMut = useMutation({
    mutationFn: () => run(true),
    onSuccess: (d: any) => {
      const s = d.summary ?? {}
      const extra = [
        s.unchanged ? `${s.unchanged} sin cambios` : '',
        s.existing_oc ? `${s.existing_oc} FV registrada(s) sin crear OC (ya había OC ese mes)` : '',
        s.recaudo_updated ? `${s.recaudo_updated} con recaudo` : '',
        s.third_invoice_matched ? `${s.third_invoice_matched} factura tercero` : '',
        s.paid_matched ? `${s.paid_matched} pagada(s)` : '',
      ].filter(Boolean).join(', ')
      toast.success(`${s.created ?? 0} creada(s), ${s.updated ?? 0} actualizada(s)${extra ? ` · ${extra}` : ''} desde el movimiento contable`)
      qc.invalidateQueries({ queryKey: ['participations'] })
      onClose()
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Error al aplicar'),
  })
  const s = report?.summary
  const OUT: Record<string, { label: string; cls: string }> = {
    matched:   { label: 'Con participación', cls: 'bg-emerald-100 text-emerald-700' },
    ambiguous: { label: 'Ambigua',           cls: 'bg-amber-100 text-amber-700' },
    no_amount: { label: 'Sin monto',         cls: 'bg-amber-100 text-amber-700' },
    existing_oc: { label: 'OC ya existe',    cls: 'bg-blue-100 text-blue-700' },
    no_config: { label: 'Sin config',        cls: 'bg-slate-100 text-slate-500' },
  }
  const canApply = !!report && ((s?.matched ?? 0) > 0 || (s?.collections ?? 0) > 0 || (s?.third_invoices ?? 0) > 0 || (s?.payments ?? 0) > 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div>
            <h3 className="text-base font-bold text-slate-900">Importar movimiento contable</h3>
            <p className="text-xs text-slate-400">Reporte "Movimiento por cuenta contable" — la fuente única del ciclo. Cada fila se clasifica por cuenta: <b>ventas</b> (41 → participación), <b>recaudo</b> (13050501), <b>factura del tercero</b> (2335) y <b>pago</b> (banco). Crea participaciones para los clientes con tercero configurado.</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-slim px-6 py-5 space-y-4">
          <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
            onChange={e => { pickFile(e.target.files?.[0]); e.target.value = '' }} />
          <div
            onClick={() => inputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={e => { e.preventDefault(); setDragging(false) }}
            onDrop={onDrop}
            className={`flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-6 py-8 text-center cursor-pointer transition-colors ${
              dragging ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 hover:border-slate-300 bg-slate-50'
            }`}
          >
            <Upload className={`w-6 h-6 ${dragging ? 'text-emerald-500' : 'text-slate-400'}`} />
            {file ? (
              <p className="text-sm font-medium text-slate-700">{file.name}</p>
            ) : (
              <p className="text-sm text-slate-500"><span className="font-semibold text-slate-700">Arrastra el archivo aquí</span> o haz clic para elegirlo</p>
            )}
            <p className="text-[11px] text-slate-400">.xlsx, .xls o .csv</p>
          </div>
          {s && (
            <>
              {report?.already_imported && (
                <div className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  Este mismo archivo ya se aplicó el <b>{new Date(report.already_imported.imported_at).toLocaleString('es-CO')}</b>
                  {report.already_imported.imported_by && <> por <b>{report.already_imported.imported_by}</b></>}.
                  Si lo aplicas de nuevo no se duplica nada: las facturas que no cambiaron se dejan igual (con sus correcciones manuales).
                </div>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { label: 'Ventas', value: s.sales, cls: 'text-slate-700' },
                  { label: 'Con participación', value: s.matched, cls: 'text-emerald-600' },
                  { label: 'Ambiguas', value: s.ambiguous, cls: 'text-amber-600' },
                  { label: 'Sin config', value: s.no_config, cls: 'text-slate-500' },
                ].map(k => (
                  <div key={k.label} className="bg-slate-50 rounded-lg p-2 text-center">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">{k.label}</p>
                    <p className={`text-lg font-bold ${k.cls}`}>{k.value}</p>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-slate-400">
                En el informe: recaudos (RC) <b className="text-slate-600">{s.collections ?? 0}</b>
                {Number(s.collection_taxes?.total ?? 0) > 0 && (
                  <> (impuestos retenidos <b className="text-amber-700">{fmtMoney(s.collection_taxes.total)}</b>: ret. fte {fmtMoney(s.collection_taxes.income)} · reteICA {fmtMoney(s.collection_taxes.ica)} · reteIVA {fmtMoney(s.collection_taxes.iva)})</>
                )} · notas crédito (NC) <b className="text-slate-600">{s.credit_notes ?? 0}</b> · facturas del tercero (FC) <b className="text-slate-600">{s.third_invoices ?? 0}</b> · pagos (RP) <b className="text-slate-600">{s.payments ?? 0}</b>. Se aplican los que cruzan con un cliente/tercero configurado.
              </p>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="overflow-x-auto max-h-72 overflow-y-auto scrollbar-slim">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-slate-50">
                      <tr className="border-b border-slate-100">
                        {['Factura', 'Cliente', 'Tercero', 'Tipo', 'Neto', 'Participación', 'A cobrar', 'Resultado'].map(h => (
                          <th key={h} className="text-left px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {report.results.filter((r: any) => r.outcome !== 'no_config').map((r: any, i: number) => {
                        const o = OUT[r.outcome] ?? OUT.no_config
                        const hasNote = (r.credit_note ?? 0) > 0 || (r.debit_note ?? 0) > 0
                        return (
                          <tr key={i} className="hover:bg-slate-50">
                            <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{r.fv}</td>
                            <td className="px-3 py-2 text-slate-700">{r.client}</td>
                            <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{r.tercero ?? '—'}</td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              {r.contract === 'mandato'
                                ? <span className="text-[11px] font-medium text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-full">Mandato</span>
                                : <span className="text-[11px] text-slate-400">Servicio</span>}
                            </td>
                            <td className="px-3 py-2 text-slate-600 whitespace-nowrap">
                              {r.net != null ? fmtMoney(r.net) : '—'}
                              {hasNote && <span className="text-[10px] text-amber-600"> {(r.credit_note ?? 0) > 0 && `−${fmtMoney(r.credit_note)}`}{(r.debit_note ?? 0) > 0 && ` +${fmtMoney(r.debit_note)}`}</span>}
                            </td>
                            <td className="px-3 py-2 text-slate-700 font-medium whitespace-nowrap">{r.participation_value != null ? fmtMoney(r.participation_value) : '—'}</td>
                            {/* Lo que debe pagar el cliente: base + IVA − retenciones (contra esto se mide el recaudo) */}
                            <td className="px-3 py-2 whitespace-nowrap" title="Base + IVA − retenciones del cliente">
                              <div className="text-slate-700 font-medium">{r.net_receivable ? fmtMoney(r.net_receivable) : '—'}</div>
                              {((r.iva ?? 0) > 0 || (r.withholdings ?? 0) > 0) && (
                                <div className="text-[10px] text-slate-400">
                                  {(r.iva ?? 0) > 0 && <span className="text-emerald-600">+IVA {fmtMoney(r.iva)}</span>}
                                  {(r.iva ?? 0) > 0 && (r.withholdings ?? 0) > 0 && ' '}
                                  {(r.withholdings ?? 0) > 0 && <span className="text-red-500">−Ret. {fmtMoney(r.withholdings)}</span>}
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${o.cls}`}>{o.label}</span>
                              {r.note && <p className="text-[10px] text-amber-600 mt-0.5">{r.note}</p>}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              {([...(report.creditNotes ?? []).map((n: any) => ({ ...n, kind: 'NC' })), ...(report.debitNotes ?? []).map((n: any) => ({ ...n, kind: 'ND' }))]).length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3">
                  <p className="text-[11px] font-bold text-amber-700 uppercase tracking-wider mb-1.5">Notas crédito / débito</p>
                  <p className="text-[11px] text-amber-700 mb-2">Las que traen el FV en la descripción <b>ajustan el neto</b> (NC resta, ND suma); las demás solo se informan para revisión manual.</p>
                  <div className="overflow-x-auto max-h-40 overflow-y-auto scrollbar-slim">
                    <table className="w-full text-sm">
                      <tbody className="divide-y divide-amber-100">
                        {[...(report.creditNotes ?? []).map((n: any) => ({ ...n, kind: 'NC' })), ...(report.debitNotes ?? []).map((n: any) => ({ ...n, kind: 'ND' }))].map((n: any, i: number) => (
                          <tr key={i}>
                            <td className="py-1 pr-2 whitespace-nowrap"><span className={`text-[10px] font-bold ${n.kind === 'NC' ? 'text-rose-600' : 'text-blue-600'}`}>{n.kind}</span></td>
                            <td className="py-1 pr-3 text-slate-600 whitespace-nowrap">{n.comprobante}</td>
                            <td className="py-1 pr-3 text-slate-700">{n.client}</td>
                            <td className="py-1 pr-3 whitespace-nowrap">{n.fv
                              ? <span className="text-emerald-700">{n.fv} · aplicada</span>
                              : <span className="text-slate-400">sin FV · revisar</span>}</td>
                            <td className="py-1 text-slate-700 font-medium whitespace-nowrap text-right">{fmtMoney(n.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              <p className="text-[11px] text-amber-700">Al aplicar: se crean/actualizan las participaciones sobre el <b>valor neto</b> (venta − NC + ND); el <b>recaudo (RC)</b> libera el disponible, la <b>factura del tercero (FC)</b> genera la Orden de Pago y el <b>pago (RP)</b> registra el egreso.</p>
            </>
          )}
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 shrink-0">
          <Button variant="secondary" onClick={onClose}>Cerrar</Button>
          <Button variant="secondary" disabled={!file} loading={previewMut.isPending} onClick={() => previewMut.mutate()}>Previsualizar</Button>
          <Button disabled={!canApply} loading={applyMut.isPending} onClick={() => applyMut.mutate()}>
            Aplicar {s ? `(${s.matched})` : ''}
          </Button>
        </div>
      </div>
    </div>
  )
}

export function AccountSettingsModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['participation-accounts'],
    queryFn: async () => { const { data } = await api.get('/api/participations/settings/accounts'); return data },
  })
  const [form, setForm] = useState<Record<string, string> | null>(null)
  const f = form ?? data ?? null

  const FIELDS: [string, string, string][] = [
    ['income_account',        'Ventas (facturación)',      'Base de la participación. Ej. 41'],
    ['mandate_account',       'Mandato (porción tercero)', 'Ej. 28150601'],
    ['receivable_account',    'Cartera (recaudo y NC)',    'Ej. 13050501'],
    ['third_invoice_account', 'Factura del tercero',       'Ej. 2335'],
    ['payment_account',       'Pago al tercero (banco)',   'Varios con "|". Ej. 1120|1110'],
  ]

  const saveMut = useMutation({
    mutationFn: async () => { const { data } = await api.put('/api/participations/settings/accounts', f); return data },
    onSuccess: () => { toast.success('Cuentas actualizadas'); qc.invalidateQueries({ queryKey: ['participation-accounts'] }); onClose() },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Error al guardar'),
  })
  const set = (k: string, v: string) => setForm({ ...(f ?? {}), [k]: v })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div>
            <h3 className="text-base font-bold text-slate-900">Cuentas contables del import</h3>
            <p className="text-xs text-slate-400">Prefijos de cuenta que el import "Movimiento por cuenta contable" usa para cada etapa. Solo dígitos; varios prefijos separados por "|".</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-slim px-6 py-5 space-y-3">
          {isLoading || !f ? (
            <p className="text-sm text-slate-400 py-8 text-center">Cargando…</p>
          ) : FIELDS.map(([k, label, hint]) => (
            <div key={k}>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">{label}</label>
              <input value={f[k] ?? ''} onChange={e => set(k, e.target.value)} placeholder={hint}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-500" />
              <p className="text-[10px] text-slate-400 mt-0.5">{hint}</p>
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 shrink-0">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button disabled={!f} loading={saveMut.isPending} onClick={() => saveMut.mutate()}>Guardar</Button>
        </div>
      </div>
    </div>
  )
}
