import { useState, useRef, type ReactNode, type DragEvent } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { TopBar } from '@/components/layout/TopBar'
import { Button } from '@/components/ui/Button'
import { PageLoader } from '@/components/ui/Spinner'
import { useAuthStore } from '@/stores/authStore'
import { toast } from 'sonner'
import { X, Upload, Download, CheckCircle2, CalendarPlus, Filter, ChevronDown, Calendar } from 'lucide-react'

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

// Estados del modelo por factura
const INV_STATUS: Record<string, { label: string; cls: string }> = {
  pending_invoice:    { label: 'Pendiente de factura', cls: 'bg-slate-100 text-slate-500' },
  invoiced:           { label: 'Facturada',           cls: 'bg-slate-100 text-slate-600' },
  partial_collection: { label: 'Recaudo parcial',     cls: 'bg-amber-100 text-amber-700' },
  available:          { label: 'Disponible para pago', cls: 'bg-blue-100 text-blue-700' },
  payment_in_process: { label: 'Pago en proceso',     cls: 'bg-violet-100 text-violet-700' },
  paid:               { label: 'Pagada',              cls: 'bg-emerald-100 text-emerald-700' },
  closed:             { label: 'Cerrada',             cls: 'bg-emerald-100 text-emerald-700' },
}

const STATUS_FILTERS: [string, string][] = [
  ['', 'Todas'],
  ['pending_invoice', 'Pendientes'],
  ['invoiced', 'Facturadas'],
  ['partial_collection', 'Recaudo parcial'],
  ['available', 'Disponible para pago'],
  ['paid', 'Pagadas'],
  ['closed', 'Cerradas'],
]

function ConsolidatedImportModal({ onClose }: { onClose: () => void }) {
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
    const { data } = await api.post('/api/participations/import-consolidado', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
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
      toast.success(`${s.created ?? 0} creada(s), ${s.updated ?? 0} actualizada(s)${s.attached ? `, ${s.attached} en OC del mes` : ''} desde el informe`)
      qc.invalidateQueries({ queryKey: ['participations'] })
      onClose()
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Error al aplicar'),
  })
  const s = report?.summary
  const OUT: Record<string, { label: string; cls: string }> = {
    matched:       { label: 'Con participación', cls: 'bg-emerald-100 text-emerald-700' },
    ambiguous:     { label: 'Ambigua',           cls: 'bg-amber-100 text-amber-700' },
    multi_tercero: { label: 'Varios terceros',   cls: 'bg-amber-100 text-amber-700' },
    no_config:     { label: 'Sin config',        cls: 'bg-slate-100 text-slate-500' },
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div>
            <h3 className="text-base font-bold text-slate-900">Importar informe consolidado</h3>
            <p className="text-xs text-slate-400">Un solo archivo con ventas, recaudo y pagos al tercero ya cruzados. Cada factura que cruza con una participación configurada se crea o actualiza con los valores del informe. Reemplaza subir los reportes por separado.</p>
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
                  { label: 'Facturas', value: s.invoices, cls: 'text-slate-700' },
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
                Leídas {s.lines} líneas del informe.
                {s.multi_tercero > 0 && (
                  <span className="text-amber-600"> · {s.multi_tercero} factura(s) con varios terceros: se escribe el primero (el modelo admite un tercero por factura).</span>
                )}
              </p>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="overflow-x-auto max-h-72 overflow-y-auto scrollbar-slim">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-slate-50">
                      <tr className="border-b border-slate-100">
                        {['Factura', 'Cliente', 'Tercero', 'Participación', 'Recaudado', 'Pagado', 'Resultado'].map(h => (
                          <th key={h} className="text-left px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {report.results.filter((r: any) => r.outcome !== 'no_config').map((r: any, i: number) => {
                        const o = OUT[r.outcome] ?? OUT.no_config
                        return (
                          <tr key={i} className="hover:bg-slate-50">
                            <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{r.fv}</td>
                            <td className="px-3 py-2 text-slate-700">{r.client}</td>
                            <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{r.tercero}</td>
                            <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{r.participation_value != null ? fmtMoney(r.participation_value) : '—'}</td>
                            <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{r.collected != null ? fmtMoney(r.collected) : '—'}</td>
                            <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{r.paid != null ? fmtMoney(r.paid) : '—'}</td>
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
              <p className="text-[11px] text-amber-700">Al aplicar, cada factura del informe se crea o <b>reemplaza</b> (recaudo, disponible y pagos) manteniendo su OC. Las facturas anteriores que no estén en el informe no se tocan.</p>
            </>
          )}
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 shrink-0">
          <Button variant="secondary" onClick={onClose}>Cerrar</Button>
          <Button variant="secondary" disabled={!file} loading={previewMut.isPending} onClick={() => previewMut.mutate()}>Previsualizar</Button>
          <Button disabled={!report || (s?.matched ?? 0) === 0} loading={applyMut.isPending} onClick={() => applyMut.mutate()}>
            Aplicar {s ? `(${s.matched})` : ''}
          </Button>
        </div>
      </div>
    </div>
  )
}

function ParticipationDetailModal({ item, onClose }: { item: any; onClose: () => void }) {
  const st = INV_STATUS[item.status] ?? INV_STATUS.invoiced
  const p = item.participation ?? {}
  const inv = Number(item.finto_invoice_value ?? 0)
  const collected = Number(item.collected ?? 0)
  const pct = inv > 0 ? Math.round(collected / inv * 100) : 0

  // Una etapa se marca "hecha" por su dato propio o porque el estado ya avanzó
  // más allá de ella. El informe consolidado va venta → recaudo → pago sin
  // registrar la factura de compra/OP (etapa 4), así que sin esto una
  // participación pagada mostraría etapas previas como incompletas.
  const RANK: Record<string, number> = {
    pending_invoice: 1, invoiced: 2, partial_collection: 2,
    available: 3, payment_in_process: 4, paid: 5, closed: 5,
  }
  const rank = RANK[item.status] ?? 2
  const saleDone      = rank >= 2 || !!item.finto_invoice
  const collectDone   = rank >= 3 || (inv > 0 && collected + 0.01 >= inv)
  const purchaseDone  = rank >= 4 || !!item.third_party_invoice || !!item.payment_order
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

          <Stage n={3} title="Recaudo del cliente (CxC)" done={collectDone}>
            <Field label="Recibos de caja" value={item.cash_receipts ?? '—'} />
            <Field label="Recaudado" value={`${fmtMoney(collected)}${inv > 0 ? ` · ${pct}%` : ''}`} />
            <Field label="Disponible para el tercero" value={fmtMoney(Number(item.available_for_payment ?? 0))} />
          </Stage>

          <Stage n={4} title="Factura de compra + Orden de Pago" done={purchaseDone}>
            <Field label="Factura del tercero" value={item.third_party_invoice ?? (purchaseDone ? 'No registrada (pago directo)' : 'Pendiente')} />
            <Field label="Valor" value={item.third_party_invoice_value != null ? fmtMoney(Number(item.third_party_invoice_value)) : '—'} />
            <Field label="Orden de pago" value={item.payment_order ?? '—'} mono />
          </Stage>

          <Stage n={5} title="Pago al tercero (egreso)" done={paymentDone}>
            <Field label="Comprobante de egreso" value={item.egress_voucher ?? 'Pendiente'} />
            <Field label="Fecha" value={item.egress_voucher_date ?? '—'} />
            <Field label="Valor pagado" value={item.egress_voucher_value != null ? fmtMoney(Number(item.egress_voucher_value)) : '—'} />
          </Stage>
        </div>

        <div className="flex justify-end px-6 py-4 border-t border-slate-100 shrink-0">
          <Button variant="secondary" onClick={onClose}>Cerrar</Button>
        </div>
      </div>
    </div>
  )
}

function ThirdPartyPaymentModal({ item, onClose }: { item: any; onClose: () => void }) {
  const qc = useQueryClient()
  const causado = Number(item.participation_value ?? 0)
  const available = Number(item.available_for_payment ?? 0)

  const [tpInv, setTpInv] = useState(item.third_party_invoice ?? '')
  const [tpDate, setTpDate] = useState(item.third_party_invoice_date ?? '')
  const [tpValue, setTpValue] = useState(item.third_party_invoice_value != null ? String(item.third_party_invoice_value) : String(causado || ''))
  const [ce, setCe] = useState(item.egress_voucher ?? '')
  const [ceDate, setCeDate] = useState(item.egress_voucher_date ?? '')
  const [ceValue, setCeValue] = useState(item.egress_voucher_value != null ? String(item.egress_voucher_value) : String(available || ''))
  const [op, setOp] = useState<string | null>(item.payment_order ?? null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const tpMut = useMutation({
    mutationFn: async () => {
      const { data } = await api.patch(`/api/participations/invoices/${item.id}/third-party`, {
        third_party_invoice: tpInv.trim(),
        third_party_invoice_date: tpDate || null,
        third_party_invoice_value: Number(tpValue) || 0,
      })
      return data
    },
    onSuccess: (d: any) => {
      qc.invalidateQueries({ queryKey: ['participations'] })
      ;(d.warnings ?? []).forEach((w: string) => toast.warning(w))
      if (d.ok) { setOp(d.payment_order); setMsg({ ok: true, text: `Conciliada. Orden de Pago ${d.payment_order} generada.` }) }
      else setMsg({ ok: false, text: (d.reasons ?? []).join(' · ') || 'Pendiente de revisión' })
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Error'),
  })

  const ceMut = useMutation({
    mutationFn: async () => {
      const { data } = await api.patch(`/api/participations/invoices/${item.id}/egress`, {
        egress_voucher: ce.trim(),
        egress_voucher_date: ceDate || null,
        egress_voucher_value: Number(ceValue) || 0,
      })
      return data
    },
    onSuccess: (d: any) => {
      qc.invalidateQueries({ queryKey: ['participations'] })
      ;(d.warnings ?? []).forEach((w: string) => toast.warning(w))
      toast.success('Pago registrado')
      onClose()
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Error'),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div>
            <h3 className="text-base font-bold text-slate-900">Pago al tercero</h3>
            <p className="text-xs text-slate-400">{item.finto_invoice} · {item.companies?.name ?? ''} · {item.participation?.third_party?.name ?? ''}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-slim px-6 py-5 space-y-5">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-slate-50 rounded-lg p-2">
              <p className="text-[10px] font-bold text-slate-400 uppercase">Causado</p>
              <p className="text-sm font-semibold text-slate-900">{fmtMoney(causado)}</p>
            </div>
            <div className="bg-emerald-50 rounded-lg p-2">
              <p className="text-[10px] font-bold text-emerald-500 uppercase">Disponible</p>
              <p className="text-sm font-bold text-emerald-700">{fmtMoney(available)}</p>
            </div>
            <div className="bg-violet-50 rounded-lg p-2">
              <p className="text-[10px] font-bold text-violet-500 uppercase">Orden de Pago</p>
              <p className="text-sm font-semibold text-violet-700">{op ?? '—'}</p>
            </div>
          </div>

          {/* Paso 1: factura del tercero */}
          <div>
            <p className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">1 · Factura del tercero</p>
            <div className="grid grid-cols-3 gap-2">
              <input value={tpInv} onChange={e => setTpInv(e.target.value)} placeholder="N° factura"
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              <input type="date" value={tpDate} onChange={e => setTpDate(e.target.value)}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              <input type="number" min={0} value={tpValue} onChange={e => setTpValue(e.target.value)} placeholder="Valor"
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div className="flex justify-end mt-2">
              <Button size="sm" variant="secondary" loading={tpMut.isPending} disabled={!tpInv.trim() || tpValue === ''} onClick={() => tpMut.mutate()}>
                Conciliar y generar OP
              </Button>
            </div>
            {msg && (
              <p className={`text-[11px] mt-1 ${msg.ok ? 'text-emerald-700' : 'text-red-600'}`}>
                {msg.ok ? '✓ ' : '⚠ '}{msg.text}
              </p>
            )}
          </div>

          {/* Paso 2: comprobante de egreso */}
          <div className={op ? '' : 'opacity-50 pointer-events-none'}>
            <p className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">2 · Comprobante de egreso (pago)</p>
            <div className="grid grid-cols-3 gap-2">
              <input value={ce} onChange={e => setCe(e.target.value)} placeholder="N° comprobante"
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              <input type="date" value={ceDate} onChange={e => setCeDate(e.target.value)}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              <input type="number" min={0} value={ceValue} onChange={e => setCeValue(e.target.value)} placeholder="Valor pagado"
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            {!op && <p className="text-[11px] text-slate-400 mt-1">Primero concilia la factura del tercero para generar la Orden de Pago.</p>}
          </div>
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 shrink-0">
          <Button variant="secondary" onClick={onClose}>Cerrar</Button>
          <Button disabled={!op || !ce.trim() || ceValue === ''} loading={ceMut.isPending} onClick={() => ceMut.mutate()}>
            Registrar pago
          </Button>
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

export function ParticipationsPage() {
  const qc = useQueryClient()
  const { user } = useAuthStore()
  const isAdmin = ['admin', 'rs_admin'].includes(user?.role ?? '')

  const [view, setView] = useState<'panel' | 'list'>('panel')
  const [showFilters, setShowFilters] = useState(false)
  const [statusF, setStatusF] = useState('')
  const [yearF, setYearF] = useState('')
  const [monthF, setMonthF] = useState('')
  const [fromF, setFromF] = useState('')
  const [toF, setToF] = useState('')
  const [page, setPage] = useState(1)
  const [showConsolidado, setShowConsolidado] = useState(false)
  const [payItem, setPayItem] = useState<any | null>(null)
  const [detailItem, setDetailItem] = useState<any | null>(null)
  const [downloading, setDownloading] = useState(false)

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

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar title="Participaciones" subtitle="Participación de terceros en la facturación" />

      <div className="flex-1 overflow-y-auto scrollbar-slim p-4 md:p-6 space-y-4">
        {/* Vista: Resumen (panel) / Detalle (lista) */}
        <div className="flex gap-1 border-b border-slate-200">
          {([['panel', 'Resumen'], ['list', 'Detalle']] as const).map(([k, l]) => (
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
            <Button size="sm" onClick={() => setShowConsolidado(true)} title="Un solo archivo: ventas + recaudo + pagos ya cruzados">
              <Upload className="w-3.5 h-3.5" /> Importar informe
            </Button>
          )}
        </div>

        {view === 'panel' && <BalancesPanel period={monthPeriod} year={yearOnly} from={fromF} to={toF} />}

        {view === 'list' && (<>
        {/* Mini stats */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            { label: 'Participaciones', value: stats?.total ?? 0, cls: 'text-slate-900' },
            { label: 'Recaudo parcial', value: stats?.partial_collection ?? 0, cls: 'text-amber-600' },
            { label: 'Disponible p/pago', value: stats?.available ?? 0, cls: 'text-blue-600' },
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
                    {['OC', 'Cliente', 'Servicio', 'Tercero', 'Factura', 'Valor factura', 'Participación', 'Recaudado', 'Disponible', 'Estado', ''].map((h, i) => (
                      <th key={i} className="text-left px-3 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {rows.map((r: any) => {
                    const p = r.participation ?? {}
                    const st = INV_STATUS[r.status] ?? INV_STATUS.invoiced
                    const collected = Number(r.collected ?? 0)
                    const inv = Number(r.finto_invoice_value ?? 0)
                    return (
                      <tr key={r.id} onClick={() => setDetailItem(r)} className="hover:bg-slate-50 transition-colors cursor-pointer">
                        <td className="px-3 py-2.5 font-mono text-[11px] text-slate-600 whitespace-nowrap">{r.purchase_order}</td>
                        <td className="px-3 py-2.5 text-slate-700">{r.companies?.name ?? '—'}</td>
                        <td className="px-3 py-2.5 text-slate-500">{p.company_service?.services?.name ?? '—'}</td>
                        <td className="px-3 py-2.5 text-slate-500">{p.third_party?.name ?? '—'}</td>
                        <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">{r.finto_invoice}</td>
                        <td className="px-3 py-2.5 text-slate-700 whitespace-nowrap">{fmtMoney(inv)}</td>
                        <td className="px-3 py-2.5 font-semibold text-slate-900 whitespace-nowrap">{fmtMoney(Number(r.participation_value))}</td>
                        <td className={`px-3 py-2.5 whitespace-nowrap ${collected > 0 ? 'text-slate-700' : 'text-slate-400'}`}>
                          {fmtMoney(collected)}{inv > 0 && <span className="text-[10px] text-slate-400"> · {Math.round(collected / inv * 100)}%</span>}
                        </td>
                        <td className={`px-3 py-2.5 whitespace-nowrap font-medium ${Number(r.available_for_payment) > 0 ? 'text-emerald-700' : 'text-slate-400'}`}>
                          {fmtMoney(Number(r.available_for_payment ?? 0))}
                        </td>
                        <td className="px-3 py-2.5"><span className={`text-xs font-medium px-2 py-1 rounded-full ${st.cls}`}>{st.label}</span></td>
                        <td className="px-3 py-2.5 text-right">
                          {isAdmin && Number(r.available_for_payment) > 0 && r.status !== 'closed' ? (
                            <button onClick={e => { e.stopPropagation(); setPayItem(r) }} className="text-xs font-medium text-primary-600 hover:underline whitespace-nowrap">
                              Pago al tercero
                            </button>
                          ) : (
                            <span className="text-xs text-slate-400">Ver detalle</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {!rows.length && (
                <p className="px-4 py-12 text-center text-slate-400 text-sm">
                  No hay participaciones por factura. {isAdmin && 'Usa "Importar informe" para crearlas desde el informe consolidado.'}
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

      {showConsolidado && <ConsolidatedImportModal onClose={() => setShowConsolidado(false)} />}
      {payItem && <ThirdPartyPaymentModal item={payItem} onClose={() => setPayItem(null)} />}
      {detailItem && <ParticipationDetailModal item={detailItem} onClose={() => setDetailItem(null)} />}
    </div>
  )
}
