import { useState, useRef, useEffect, type ReactNode, type DragEvent } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { TopBar } from '@/components/layout/TopBar'
import { Button } from '@/components/ui/Button'
import { PageLoader } from '@/components/ui/Spinner'
import { useAuthStore } from '@/stores/authStore'
import { toast } from 'sonner'
import { X, Upload, Download, CheckCircle2, CalendarPlus, Filter, ChevronDown, Calendar, SlidersHorizontal, Search, ChevronsUpDown, AlertCircle, RotateCcw, Wallet, Receipt, CreditCard } from 'lucide-react'

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

type DateSel = { year: string; month: string; from: string; to: string }

/** Selector de fecha unificado: Año + Mes (o rango de fechas), en un popover. */
function DateFilter({ value, onChange }: { value: DateSel; onChange: (v: DateSel) => void }) {
  const [open, setOpen] = useState(false)
  const { year, month, from, to } = value
  const nowYear = new Date().getFullYear()
  const years = [nowYear + 1, nowYear, nowYear - 1, nowYear - 2].map(String)

  const fmt = (d: string) => d ? d.split('-').reverse().join('/') : '…'
  const label =
    (from || to) ? `${fmt(from)} – ${fmt(to)}`
    : (year && month) ? `${MONTHS[Number(month) - 1]} ${year}`
    : year ? `Año ${year}`
    : 'Todas las fechas'
  const active = !!(year || month || from || to)

  return (
    <div className="relative">
      <Button size="sm" variant="secondary" onClick={() => setOpen(o => !o)}>
        <Calendar className="w-3.5 h-3.5" /> {label}
        {active && <span className="w-1.5 h-1.5 rounded-full bg-primary-600" />}
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 mt-1 z-20 bg-white border border-slate-200 rounded-xl shadow-lg p-3 w-64 space-y-3">
            {/* Año + Mes */}
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Por mes y año</p>
              <div className="grid grid-cols-2 gap-2">
                <select value={year} onChange={e => onChange({ year: e.target.value, month, from: '', to: '' })}
                  className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary-500">
                  <option value="">Año…</option>
                  {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                <select value={month} onChange={e => onChange({ year: year || String(nowYear), month: e.target.value, from: '', to: '' })}
                  className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary-500">
                  <option value="">Todos</option>
                  {MONTHS.map((m, i) => <option key={m} value={String(i + 1).padStart(2, '0')}>{m}</option>)}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="h-px bg-slate-100 flex-1" />
              <span className="text-[10px] text-slate-400 uppercase">o rango</span>
              <div className="h-px bg-slate-100 flex-1" />
            </div>

            {/* Rango de fechas */}
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Rango de fechas</p>
              <div className="space-y-1.5">
                <label className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400 w-10 shrink-0">Desde</span>
                  <input type="date" value={from} max={to || undefined} onChange={e => onChange({ year: '', month: '', from: e.target.value, to })}
                    className="flex-1 min-w-0 text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </label>
                <label className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400 w-10 shrink-0">Hasta</span>
                  <input type="date" value={to} min={from || undefined} onChange={e => onChange({ year: '', month: '', from, to: e.target.value })}
                    className="flex-1 min-w-0 text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </label>
              </div>
            </div>

            <div className="flex justify-between pt-1">
              <button onClick={() => onChange({ year: '', month: '', from: '', to: '' })}
                className="text-xs text-slate-500 hover:text-slate-700 underline">Limpiar</button>
              <button onClick={() => setOpen(false)}
                className="text-xs font-medium text-primary-600 hover:text-primary-700">Listo</button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function fmtMoney(n: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n ?? 0)
}

// Estados de la relación (spec §15)
const INV_STATUS: Record<string, { label: string; cls: string }> = {
  pending_invoice:       { label: 'Pendiente de factura',     cls: 'bg-slate-100 text-slate-500' },
  pending_third_invoice: { label: 'Pendiente factura tercero', cls: 'bg-amber-100 text-amber-700' },
  value_difference:      { label: 'Diferencia de valor',      cls: 'bg-rose-100 text-rose-700' },
  pending_payment:       { label: 'Pendiente de pago',        cls: 'bg-blue-100 text-blue-700' },
  complete:              { label: 'Completa',                 cls: 'bg-emerald-100 text-emerald-700' },
}

const STATUS_FILTERS: [string, string][] = [
  ['', 'Todas'],
  ['pending_invoice', 'Pendiente de factura'],
  ['pending_third_invoice', 'Pendiente factura tercero'],
  ['value_difference', 'Diferencia de valor'],
  ['pending_payment', 'Pendiente de pago'],
  ['complete', 'Completas'],
]

function MovimientoImportModal({ onClose }: { onClose: () => void }) {
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
                En el informe: recaudos (RC) <b className="text-slate-600">{s.collections ?? 0}</b> · notas crédito (NC) <b className="text-slate-600">{s.credit_notes ?? 0}</b> · facturas del tercero (FC) <b className="text-slate-600">{s.third_invoices ?? 0}</b> · pagos (RP) <b className="text-slate-600">{s.payments ?? 0}</b>. Se aplican los que cruzan con un cliente/tercero configurado.
              </p>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="overflow-x-auto max-h-72 overflow-y-auto scrollbar-slim">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-slate-50">
                      <tr className="border-b border-slate-100">
                        {['Factura', 'Cliente', 'Tercero', 'Tipo', 'Neto', 'Participación', 'Recaudado', 'Resultado'].map(h => (
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
                            <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{r.collected ? fmtMoney(r.collected) : '—'}</td>
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

function AccountSettingsModal({ onClose }: { onClose: () => void }) {
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

function ParticipationDetailModal({ item, onClose }: { item: any; onClose: () => void }) {
  const st = INV_STATUS[item.status] ?? INV_STATUS.pending_third_invoice
  const p = item.participation ?? {}
  const inv = Number(item.finto_invoice_value ?? 0)
  const collected = Number(item.collected ?? 0)
  const pct = inv > 0 ? Math.min(100, Math.round(collected / inv * 100)) : 0

  // Cada etapa se marca "hecha" por su dato propio o por el estado alcanzado.
  const RANK: Record<string, number> = {
    pending_invoice: 1, pending_third_invoice: 2,
    value_difference: 3, pending_payment: 4, complete: 5,
  }
  const rank = RANK[item.status] ?? 2
  const saleDone      = rank >= 2 || !!item.finto_invoice
  const collectDone   = inv > 0 && collected + 0.01 >= inv
  const purchaseDone  = rank >= 3 || !!item.third_party_invoice || !!item.payment_order
  const paymentDone   = rank >= 5 || !!item.egress_voucher

  const Field = ({ label, value, mono }: { label: string; value: any; mono?: boolean }) => (
    <div className="flex justify-between gap-4 py-1">
      <span className="text-xs text-slate-400">{label}</span>
      <span className={`text-sm text-slate-700 text-right ${mono ? 'font-mono text-[12px]' : ''}`}>{value ?? '—'}</span>
    </div>
  )
  const Stage = ({ n, title, done, children }: { n: number; title: string; done: boolean; children: ReactNode }) => (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <div className={`px-4 py-2 flex items-center gap-2 ${done ? 'bg-emerald-50' : 'bg-slate-50'}`}>
        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${done ? 'bg-emerald-500 text-white' : 'bg-slate-300 text-white'}`}>{n}</span>
        <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">{title}</span>
        {done && <CheckCircle2 className="w-4 h-4 text-emerald-500 ml-auto" />}
      </div>
      <div className="px-4 py-2">{children}</div>
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span className="font-mono text-sm text-slate-600">{item.purchase_order}</span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
            </h3>
            <p className="text-xs text-slate-400">{item.companies?.name ?? '—'} · {p.third_party?.name ?? 'sin tercero'}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-slim px-6 py-5 space-y-3">
          <Stage n={1} title="Generación · OC" done>
            <Field label="Orden de compra" value={item.purchase_order} mono />
            <Field label="Periodo" value={item.period ?? '—'} />
            <Field label="Servicio" value={p.company_service?.services?.name ?? '—'} />
            <Field label="Participación causada" value={fmtMoney(Number(item.participation_value ?? 0))} />
          </Stage>

          <Stage n={2} title="Venta (factura Finto)" done={saleDone}>
            <Field label="Factura de venta" value={item.finto_invoice ?? 'Pendiente'} />
            <Field label="Fecha" value={item.finto_invoice_date ?? '—'} />
            <Field label="Valor factura" value={fmtMoney(inv)} />
          </Stage>

          <Stage n={3} title="Recaudo del cliente (CxC · RC)" done={collectDone}>
            <Field label="Recibo de caja (RC)" value={item.cash_receipts ?? 'Pendiente'} mono />
            <Field label="Fecha de recaudo (RC)" value={item.cash_receipt_date ?? (item.cash_receipts ? 'Sin fecha' : '—')} />
            <Field label="Recaudado" value={`${fmtMoney(collected)}${inv > 0 ? ` · ${pct}%` : ''}`} />
            <Field label="Disponible para el tercero" value={fmtMoney(Number(item.available_for_payment ?? 0))} />
          </Stage>

          <Stage n={4} title="Factura de compra + Orden de Pago" done={purchaseDone}>
            <Field label="Factura del tercero" value={item.third_party_invoice ?? (purchaseDone ? 'No registrada (pago directo)' : 'Pendiente')} />
            <Field label="Valor" value={item.third_party_invoice_value != null ? fmtMoney(Number(item.third_party_invoice_value)) : '—'} />
            <Field label="Orden de pago" value={item.payment_order ?? '—'} mono />
          </Stage>

          <Stage n={5} title="Pago al tercero (egreso · RP)" done={paymentDone}>
            <Field label="Comprobante de egreso (RP)" value={item.egress_voucher ?? (paymentDone ? 'Registrado' : 'Pendiente')} mono />
            <Field label="Fecha de pago (RP)" value={item.egress_voucher_date ?? (item.egress_voucher ? 'Sin fecha' : '—')} />
            <Field label="Valor pagado" value={item.egress_voucher_value != null ? fmtMoney(Number(item.egress_voucher_value)) : '—'} />
          </Stage>

          {item.tax_partition && (
            <div className="border border-primary-200 rounded-xl overflow-hidden">
              <div className="px-4 py-2 bg-primary-50 flex items-center gap-2">
                <span className="text-xs font-bold text-primary-700 uppercase tracking-wider">Partición tributaria</span>
                {!item.tax_partition.has_profile && (
                  <span className="text-[10px] text-amber-600 ml-auto">Tercero sin perfil — cálculo neutro</span>
                )}
              </div>
              <div className="px-4 py-3 grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">Pagar al tercero</p>
                  <p className="text-sm font-bold text-emerald-700">{fmtMoney(item.tax_partition.payThirdParty)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">Nos deben</p>
                  <p className="text-sm font-bold text-blue-700">{fmtMoney(item.tax_partition.owedToUs)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">Queda en Finto</p>
                  <p className="text-sm font-bold text-primary-700">{fmtMoney(item.tax_partition.staysInFinto)}</p>
                </div>
              </div>
              {item.tax_partition.breakdown && (
                <div className="px-4 pb-3 pt-1 border-t border-slate-100">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">
                    Desglose sobre la participación · recaudo {Math.round((item.tax_partition.collectionRatio ?? 0) * 100)}%
                  </p>
                  <Field label="IVA factura" value={fmtMoney(item.tax_partition.breakdown.invoiceIva)} />
                  <Field label="Retención fuente" value={fmtMoney(item.tax_partition.breakdown.incomeWithholding.amount)} />
                  <Field label="Retención ICA" value={fmtMoney(item.tax_partition.breakdown.icaWithholding.amount)} />
                  <Field label="Retención IVA" value={fmtMoney(item.tax_partition.breakdown.ivaWithholding.amount)} />
                  <Field label="Comisión + IVA" value={fmtMoney(item.tax_partition.breakdown.commissionTotal)} />
                  <Field label="Giro final (100% recaudo)" value={fmtMoney(item.tax_partition.breakdown.finalTotal)} />
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end px-6 py-4 border-t border-slate-100 shrink-0">
          <Button variant="secondary" onClick={onClose}>Cerrar</Button>
        </div>
      </div>
    </div>
  )
}

function BalanceDetailModal({ kind, row, onClose }: { kind: 'cxc' | 'cxp'; row: any; onClose: () => void }) {
  const isCxc = kind === 'cxc'
  const items: any[] = row.items ?? []
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

const DOC_BADGE: Record<string, string> = {
  FV: 'bg-slate-100 text-slate-600', RC: 'bg-blue-100 text-blue-700', NC: 'bg-rose-100 text-rose-700',
  ND: 'bg-amber-100 text-amber-700', FC: 'bg-violet-100 text-violet-700', RP: 'bg-emerald-100 text-emerald-700',
}

function DocTypeFilter({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div className="flex gap-1">
      {['', ...options].map(t => (
        <button key={t} onClick={() => onChange(t)}
          className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${value === t ? 'border-primary-300 bg-primary-50 text-primary-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
          {t || 'Todos'}
        </button>
      ))}
    </div>
  )
}

function ManualPaymentModal({
  data: initialData,
  onClose,
}: {
  data: { comprobante: string; clientNit?: string; clientName?: string; amount: number; fvRef?: string }
  onClose: () => void
}) {
  const qc = useQueryClient()
  const comprobante = initialData.comprobante
  const clientNit = initialData.clientNit || ''
  const totalAmount = Number(initialData.amount ?? 0)

  const [allocations, setAllocations] = useState<Record<string, number>>({})

  const { data: openInvoices, isLoading } = useQuery({
    queryKey: ['participations', 'client-pending-invoices', clientNit],
    enabled: !!clientNit,
    queryFn: async () => {
      const { data } = await api.get(`/api/participations/client-pending-invoices?nit=${encodeURIComponent(clientNit)}`)
      return (data ?? []) as any[]
    },
  })

  const roundMoney = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

  // Autollenar con orden FIFO (factura más antigua primero)
  const autoFillFifo = () => {
    if (!openInvoices?.length) return
    let remaining = totalAmount
    const newAlloc: Record<string, number> = {}

    const sorted = [...openInvoices].sort((a, b) =>
      String(a.finto_invoice_date ?? a.period ?? '').localeCompare(String(b.finto_invoice_date ?? b.period ?? ''))
    )

    for (const inv of sorted) {
      if (remaining <= 0.01) break
      const bal = Number(inv.balance ?? 0)
      if (bal <= 0) continue
      const toApply = roundMoney(Math.min(remaining, bal))
      newAlloc[inv.id] = toApply
      remaining = roundMoney(remaining - toApply)
    }

    setAllocations(newAlloc)
  }

  // Pre-llenar automáticamente al cargar las facturas
  useEffect(() => {
    if (openInvoices && openInvoices.length > 0 && Object.keys(allocations).length === 0) {
      autoFillFifo()
    }
  }, [openInvoices])

  const currentTotal = roundMoney(Object.values(allocations).reduce((a, b) => a + (Number(b) || 0), 0))
  const remainingTotal = roundMoney(Math.max(0, totalAmount - currentTotal))
  const isOverAllocated = currentTotal > totalAmount + 0.01

  const applyMutation = useMutation({
    mutationFn: async () => {
      const allocList = Object.entries(allocations)
        .filter(([_, val]) => val > 0)
        .map(([invoice_id, amount]) => ({ invoice_id, amount }))

      const { data } = await api.post('/api/participations/apply-manual-payment', {
        comprobante,
        client_nit: clientNit,
        allocations: allocList,
      })
      return data
    },
    onSuccess: (res: any) => {
      toast.success(`Recaudo aplicado correctamente a ${res.invoices?.length ?? 0} factura(s)`)
      qc.invalidateQueries({ queryKey: ['participations'] })
      onClose()
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error ?? 'Error al aplicar el recaudo')
    },
  })

  const setInvoiceAmount = (id: string, val: number) => {
    setAllocations(prev => {
      const copy = { ...prev }
      if (val <= 0) delete copy[id]
      else copy[id] = roundMoney(val)
      return copy
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-700">RC</span>
              <h3 className="text-base font-bold text-slate-900">Aplicación Manual de Recaudo</h3>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Comprobante <b>{comprobante}</b> · Cliente: <b>{initialData.clientName || clientNit || '—'}</b> (NIT: {clientNit || '—'})
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto scrollbar-slim px-6 py-5 space-y-4">
          {/* Card de resumen del monto */}
          <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Recibo</p>
              <p className="text-sm font-bold text-slate-800">{fmtMoney(totalAmount)}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Asignado</p>
              <p className={`text-sm font-bold ${isOverAllocated ? 'text-rose-600' : 'text-emerald-600'}`}>
                {fmtMoney(currentTotal)}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Por Asignar</p>
              <p className="text-sm font-bold text-slate-600">{fmtMoney(remainingTotal)}</p>
            </div>
          </div>

          {/* Acciones de llenado rápido */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700">Facturas Pendientes del Cliente (FIFO):</span>
            <Button size="sm" variant="secondary" onClick={autoFillFifo} disabled={isLoading || !openInvoices?.length}>
              <RotateCcw className="w-3 h-3" /> Autollenar FIFO (Más antigua primero)
            </Button>
          </div>

          {isLoading ? (
            <div className="py-12 text-center text-slate-400"><PageLoader /></div>
          ) : !openInvoices?.length ? (
            <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-100">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700">Sin facturas pendientes con saldo</p>
              <p className="text-xs text-slate-400">Todas las facturas de este cliente se encuentran completamente pagadas o no hay facturas configuradas para este NIT.</p>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                  <tr>
                    <th className="px-3 py-2 text-left">Factura</th>
                    <th className="px-3 py-2 text-left">Fecha / Mes</th>
                    <th className="px-3 py-2 text-right">Valor Total</th>
                    <th className="px-3 py-2 text-right">Recaudado</th>
                    <th className="px-3 py-2 text-right">Saldo Pend.</th>
                    <th className="px-3 py-2 text-right w-36">Abonar ($)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {openInvoices.map((inv: any) => {
                    const allocatedVal = allocations[inv.id] || 0
                    return (
                      <tr key={inv.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-3 py-2 font-mono font-medium text-slate-800 whitespace-nowrap">
                          {inv.finto_invoice || '—'}
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-500 whitespace-nowrap">
                          {inv.finto_invoice_date || inv.period || '—'}
                        </td>
                        <td className="px-3 py-2 text-right text-slate-600 whitespace-nowrap">
                          {fmtMoney(inv.finto_invoice_value)}
                        </td>
                        <td className="px-3 py-2 text-right text-emerald-600 whitespace-nowrap">
                          {fmtMoney(inv.collected)}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-slate-800 whitespace-nowrap">
                          {fmtMoney(inv.balance)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <input
                              type="number"
                              min="0"
                              max={inv.balance}
                              step="any"
                              value={allocatedVal || ''}
                              onChange={e => setInvoiceAmount(inv.id, Number(e.target.value) || 0)}
                              placeholder="0"
                              className="w-24 text-right text-xs font-semibold px-2 py-1 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                            />
                            <button
                              type="button"
                              onClick={() => setInvoiceAmount(inv.id, inv.balance)}
                              title="Asignar saldo completo"
                              className="text-[10px] font-bold text-primary-600 hover:text-primary-700 px-1.5 py-0.5 rounded bg-primary-50 hover:bg-primary-100"
                            >
                              Max
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {isOverAllocated && (
            <p className="text-xs text-rose-600 font-medium">
              ⚠️ El valor asignado ({fmtMoney(currentTotal)}) supera el monto disponible del recibo ({fmtMoney(totalAmount)}).
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-100 shrink-0 bg-slate-50 rounded-b-2xl">
          <Button variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
          <Button
            size="sm"
            loading={applyMutation.isPending}
            disabled={currentTotal <= 0 || isOverAllocated}
            onClick={() => applyMutation.mutate()}
          >
            Confirmar y Aplicar Recaudo
          </Button>
        </div>
      </div>
    </div>
  )
}

function CruceView({ period, onApplyPayment }: { period: string; onApplyPayment?: (data: any) => void }) {
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

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <DocTypeFilter value={docType} onChange={setDocType} options={['FV', 'RC', 'NC', 'ND', 'FC', 'RP']} />
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


function BalancesPanel({ period, year, from, to }: { period: string; year: string; from: string; to: string }) {
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

// ── Vista de Pagos: Saldos de RC y RP no cruzados con filtros por Tercero, Cliente y Mes ──
function PaymentsView({
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
  const s = data?.summary ?? { count: 0, rc_count: 0, rp_count: 0, rc_saldo: 0, rp_saldo: 0, total_saldo: 0 }
  const options = data?.filter_options ?? { clients: [], third_parties: [], periods: [] }

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
      r.doc_type === 'RC' ? 'Cliente' : 'Tercero',
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
    link.setAttribute('download', `saldos_rc_rp_${period || 'todos'}_${new Date().toISOString().slice(0, 10)}.csv`)
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
            Saldos No Cruzados (RC / RP)
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

            {/* Saldo RC Clientes */}
            <div className="bg-blue-50/50 border border-blue-200/70 rounded-xl p-4 flex flex-col justify-between shadow-xs">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700">Saldo RC · Recaudos Clientes</span>
                <span className="p-1.5 rounded-lg bg-blue-100 text-blue-700">
                  <Receipt className="w-4 h-4" />
                </span>
              </div>
              <div className="text-xl font-bold text-blue-900">{fmtMoney(s.rc_saldo)}</div>
              <p className="text-[11px] text-blue-600/90 mt-1">
                <b className="text-blue-900">{s.rc_count}</b> recibo{s.rc_count === 1 ? '' : 's'} pendiente{s.rc_count === 1 ? '' : 's'} por cruzar
              </p>
            </div>

            {/* Saldo RP Terceros */}
            <div className="bg-emerald-50/50 border border-emerald-200/70 rounded-xl p-4 flex flex-col justify-between shadow-xs">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Saldo RP · Pagos a Terceros</span>
                <span className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700">
                  <CreditCard className="w-4 h-4" />
                </span>
              </div>
              <div className="text-xl font-bold text-emerald-900">{fmtMoney(s.rp_saldo)}</div>
              <p className="text-[11px] text-emerald-600/90 mt-1">
                <b className="text-emerald-900">{s.rp_count}</b> comprobante{s.rp_count === 1 ? '' : 's'} de egreso pendiente{s.rp_count === 1 ? '' : 's'}
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
                  onClick={() => setDocType('RC')}
                  className={`px-3 py-1 rounded-md transition-all ${
                    docType === 'RC' ? 'bg-white text-blue-700 font-semibold shadow-xs' : 'text-slate-500 hover:text-blue-700'
                  }`}
                >
                  RC Clientes ({s.rc_count})
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

              {/* Filtro por Cliente (visible para Todos o RC) */}
              {docType !== 'RP' && (
                <div className="flex items-center gap-1.5 min-w-[200px] flex-1 sm:flex-initial">
                  <span className="text-xs font-semibold text-blue-700">Cliente:</span>
                  <select
                    value={client}
                    onChange={e => setClient(e.target.value)}
                    className={`w-full text-xs border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white ${
                      client ? 'border-blue-400 text-blue-800 font-medium' : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    <option value="">Todos los clientes (RC)</option>
                    {options.clients.map((c: any) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Filtro por Tercero (visible para Todos o RP) */}
              {docType !== 'RC' && (
                <div className="flex items-center gap-1.5 min-w-[200px] flex-1 sm:flex-initial">
                  <span className="text-xs font-semibold text-emerald-700">Tercero:</span>
                  <select
                    value={thirdParty}
                    onChange={e => setThirdParty(e.target.value)}
                    className={`w-full text-xs border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white ${
                      thirdParty ? 'border-emerald-400 text-emerald-800 font-medium' : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    <option value="">Todos los terceros (RP)</option>
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
                          <p className="font-semibold text-slate-700">No hay saldos de RC o RP pendientes con los filtros seleccionados</p>
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
                      const isRC = r.doc_type === 'RC'
                      const pctUncrossed = r.amount > 0 ? Math.round(((r.saldo ?? 0) / r.amount) * 100) : 100
                      const isPartial = (Number(r.applied ?? 0) > 0)
                      return (
                        <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-3.5 py-2.5 whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md ${
                              isRC ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'
                            }`}>
                              {r.doc_type}
                              <span className="text-[9px] font-normal opacity-75">
                                {isRC ? 'Recaudo' : 'Egreso'}
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
                                <span className={`text-[10px] font-bold uppercase ${isRC ? 'text-blue-600' : 'text-emerald-600'}`}>
                                  {isRC ? 'Cliente' : 'Tercero'}:
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
                              <span className={`text-xs font-bold ${isRC ? 'text-blue-700' : 'text-emerald-700'}`}>
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
                            {isRC && onApplyPayment && (
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

function ThirdPartiesView({
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
            const invs: any[] = tp.invoices ?? []
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
                                onClick={() => onSelectInvoice(inv._raw)}
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

export function ParticipationsPage() {
  const qc = useQueryClient()
  const { user } = useAuthStore()
  const isAdmin = ['admin', 'rs_admin'].includes(user?.role ?? '')

  const [view, setView] = useState<'panel' | 'list' | 'third_parties' | 'payments' | 'cruce' | 'saldos'>('panel')
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
  })
  const rows: any[] = data?.data ?? []
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
          {([['panel', 'Resumen'], ['list', 'Detalle'], ['third_parties', 'Terceros'], ['payments', 'Pagos'], ['cruce', 'Cruce']] as const).map(([k, l]) => (
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
      {detailItem && <ParticipationDetailModal item={detailItem} onClose={() => setDetailItem(null)} />}
      {manualPaymentData && <ManualPaymentModal data={manualPaymentData} onClose={() => setManualPaymentData(null)} />}
    </div>
  )
}
