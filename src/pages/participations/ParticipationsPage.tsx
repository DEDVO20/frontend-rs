import { useState, type ReactNode } from 'react'
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
              <div className="flex items-center gap-1.5">
                <input type="date" value={from} max={to || undefined} onChange={e => onChange({ year: '', month: '', from: e.target.value, to })}
                  className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary-500 w-full" />
                <span className="text-xs text-slate-400">–</span>
                <input type="date" value={to} min={from || undefined} onChange={e => onChange({ year: '', month: '', from, to: e.target.value })}
                  className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary-500 w-full" />
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

const RECON_OUTCOME: Record<string, { label: string; cls: string }> = {
  created:        { label: 'Participación',  cls: 'bg-emerald-100 text-emerald-700' },
  updated:        { label: 'Actualizada',    cls: 'bg-emerald-100 text-emerald-700' },
  value_mismatch: { label: 'Difiere valor',  cls: 'bg-amber-100 text-amber-700' },
  ambiguous:      { label: 'Ambigua',        cls: 'bg-amber-100 text-amber-700' },
  no_config:      { label: 'Sin config',     cls: 'bg-slate-100 text-slate-500' },
}

function SiigoReconcileModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [sales, setSales] = useState<File | null>(null)
  const [receipts, setReceipts] = useState<File | null>(null)
  const [report, setReport] = useState<any | null>(null)

  const run = async (apply: boolean) => {
    const fd = new FormData()
    fd.append('file_sales', sales!)
    fd.append('file_receipts', receipts!)
    fd.append('apply', String(apply))
    const { data } = await api.post('/api/participations/process-siigo', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return data
  }

  const previewMut = useMutation({
    mutationFn: () => run(false),
    onSuccess: (d: any) => setReport(d),
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Error al procesar'),
  })

  const applyMut = useMutation({
    mutationFn: () => run(true),
    onSuccess: (d: any) => {
      const s = d.summary ?? {}
      toast.success(`${s.created ?? 0} creada(s), ${s.updated ?? 0} actualizada(s) desde SIIGO`)
      qc.invalidateQueries({ queryKey: ['participations'] })
      onClose()
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Error al aplicar'),
  })

  const s = report?.summary
  const canRun = !!sales && !!receipts

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div>
            <h3 className="text-base font-bold text-slate-900">Importar ventas y recaudo (SIIGO)</h3>
            <p className="text-xs text-slate-400">Cada factura que cruza con una participación configurada crea su participación; el recibo determina el recaudo y lo disponible para el tercero.</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Ventas por vendedor (facturas Finto)</label>
              <input type="file" accept=".xlsx,.xls,.csv" onChange={e => { setSales(e.target.files?.[0] ?? null); setReport(null) }}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 file:mr-2 file:rounded file:border-0 file:bg-slate-100 file:px-2 file:py-1 file:text-xs" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Recibos de caja detallado por facturas</label>
              <input type="file" accept=".xlsx,.xls,.csv" onChange={e => { setReceipts(e.target.files?.[0] ?? null); setReport(null) }}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 file:mr-2 file:rounded file:border-0 file:bg-slate-100 file:px-2 file:py-1 file:text-xs" />
            </div>
          </div>

          {s && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { label: 'Con participación', value: s.matched, cls: 'text-emerald-600' },
                  { label: 'Difieren valor', value: s.value_mismatch, cls: 'text-amber-600' },
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
                Leídas {s.sales_rows} ventas y {s.receipt_rows} recibos.
                {(s.invalid_sales > 0 || s.dup_receipts > 0) && (
                  <span className="text-amber-600"> · {s.invalid_sales} venta(s) inválida(s), {s.dup_receipts} recibo(s) duplicado(s) ignorados.</span>
                )}
              </p>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="overflow-x-auto max-h-72 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-slate-50">
                      <tr className="border-b border-slate-100">
                        {['Factura', 'Cliente', 'Participación', 'Recaudado', 'Disponible', 'Resultado'].map(h => (
                          <th key={h} className="text-left px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {report.results.filter((r: any) => r.outcome !== 'no_config').map((r: any, i: number) => {
                        const o = RECON_OUTCOME[r.outcome] ?? RECON_OUTCOME.no_config
                        return (
                          <tr key={i} className="hover:bg-slate-50">
                            <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{r.finto_invoice}</td>
                            <td className="px-3 py-2 text-slate-700">{r.company}</td>
                            <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{r.participation_value != null ? fmtMoney(r.participation_value) : '—'}</td>
                            <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{r.collected != null ? fmtMoney(r.collected) : '—'}</td>
                            <td className="px-3 py-2 text-emerald-700 whitespace-nowrap">{r.available != null ? fmtMoney(r.available) : '—'}</td>
                            <td className="px-3 py-2">
                              <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${o.cls}`}>{o.label}</span>
                              {r.note && <p className="text-[10px] text-slate-400 mt-0.5">{r.note}</p>}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              <p className="text-[11px] text-amber-700">Crea/actualiza el lado del cliente (factura + recaudo). El lado del tercero (factura y pago) se hará en las siguientes etapas.</p>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 shrink-0">
          <Button variant="secondary" onClick={onClose}>Cerrar</Button>
          <Button variant="secondary" disabled={!canRun} loading={previewMut.isPending} onClick={() => previewMut.mutate()}>
            Previsualizar
          </Button>
          <Button disabled={!report || (s?.matched ?? 0) === 0} loading={applyMut.isPending} onClick={() => applyMut.mutate()}>
            Aplicar {s ? `(${s.matched})` : ''}
          </Button>
        </div>
      </div>
    </div>
  )
}

function EgresosImportModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [file, setFile] = useState<File | null>(null)
  const [report, setReport] = useState<any | null>(null)

  const run = async (apply: boolean) => {
    const fd = new FormData()
    fd.append('file', file!)
    fd.append('apply', String(apply))
    const { data } = await api.post('/api/participations/import-egresos', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
    return data
  }
  const previewMut = useMutation({
    mutationFn: () => run(false),
    onSuccess: (d: any) => setReport(d),
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Error al leer'),
  })
  const applyMut = useMutation({
    mutationFn: () => run(true),
    onSuccess: (d: any) => { toast.success(`${d.summary?.applied ?? 0} tercero(s) conciliado(s) y pagado(s)`); qc.invalidateQueries({ queryKey: ['participations'] }); onClose() },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Error al aplicar'),
  })
  const s = report?.summary
  const OUT: Record<string, { label: string; cls: string }> = {
    matched:        { label: 'Conciliado',    cls: 'bg-emerald-100 text-emerald-700' },
    value_mismatch: { label: 'Difiere valor', cls: 'bg-amber-100 text-amber-700' },
    ambiguous:      { label: 'Ambiguo',       cls: 'bg-amber-100 text-amber-700' },
    not_found:      { label: 'Sin tercero',   cls: 'bg-slate-100 text-slate-500' },
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div>
            <h3 className="text-base font-bold text-slate-900">Importar facturas y pagos de terceros (SIIGO)</h3>
            <p className="text-xs text-slate-400">Reporte "Movimiento por cuenta contable" (RP). Registra la factura de compra (de la descripción) y el pago, cruzando por NIT del tercero + valor. Genera la Orden de Pago y cierra el ciclo.</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <input type="file" accept=".xlsx,.xls,.csv" onChange={e => { setFile(e.target.files?.[0] ?? null); setReport(null) }}
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 file:mr-2 file:rounded file:border-0 file:bg-slate-100 file:px-2 file:py-1 file:text-xs" />
          {s && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { label: 'Líneas', value: s.rows, cls: 'text-slate-700' },
                  { label: 'Conciliados', value: s.matched, cls: 'text-emerald-600' },
                  { label: 'Difieren valor', value: s.value_mismatch, cls: 'text-amber-600' },
                  { label: 'Sin tercero', value: s.not_found, cls: 'text-slate-500' },
                ].map(k => (
                  <div key={k.label} className="bg-slate-50 rounded-lg p-2 text-center">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">{k.label}</p>
                    <p className={`text-lg font-bold ${k.cls}`}>{k.value}</p>
                  </div>
                ))}
              </div>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="overflow-x-auto max-h-72 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-slate-50">
                      <tr className="border-b border-slate-100">
                        {['RP', 'Factura compra', 'Valor', 'Tercero', 'OC', 'Resultado'].map(h => (
                          <th key={h} className="text-left px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {report.results.map((r: any, i: number) => {
                        const o = OUT[r.outcome] ?? OUT.not_found
                        return (
                          <tr key={i} className="hover:bg-slate-50">
                            <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{r.rp}</td>
                            <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{r.invoice}</td>
                            <td className="px-3 py-2 text-slate-700 whitespace-nowrap">{fmtMoney(r.value)}</td>
                            <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{r.tercero ?? `NIT ${r.nit ?? '—'}`}</td>
                            <td className="px-3 py-2 font-mono text-[11px] text-slate-500 whitespace-nowrap">{r.purchase_order ?? '—'}</td>
                            <td className="px-3 py-2">
                              <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${o.cls}`}>{o.label}</span>
                              {r.note && <p className="text-[10px] text-amber-600 mt-0.5">{r.note}</p>}
                              {r.payment_order && <p className="text-[10px] text-violet-600 mt-0.5">OP {r.payment_order}</p>}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 shrink-0">
          <Button variant="secondary" onClick={onClose}>Cerrar</Button>
          <Button variant="secondary" disabled={!file} loading={previewMut.isPending} onClick={() => previewMut.mutate()}>Previsualizar</Button>
          <Button disabled={!report || (s?.matched ?? 0) === 0} loading={applyMut.isPending} onClick={() => applyMut.mutate()}>
            Conciliar y pagar {s ? `(${s.matched})` : ''}
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

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-3">
          <Stage n={1} title="Generación · OC" done>
            <Field label="Orden de compra" value={item.purchase_order} mono />
            <Field label="Periodo" value={item.period ?? '—'} />
            <Field label="Servicio" value={p.company_service?.services?.name ?? '—'} />
            <Field label="Participación causada" value={fmtMoney(Number(item.participation_value ?? 0))} />
          </Stage>

          <Stage n={2} title="Venta (factura Finto)" done={!!item.finto_invoice}>
            <Field label="Factura de venta" value={item.finto_invoice ?? 'Pendiente'} />
            <Field label="Fecha" value={item.finto_invoice_date ?? '—'} />
            <Field label="Valor factura" value={fmtMoney(inv)} />
          </Stage>

          <Stage n={3} title="Recaudo del cliente (CxC)" done={collected > 0 && collected + 0.01 >= inv}>
            <Field label="Recibos de caja" value={item.cash_receipts ?? '—'} />
            <Field label="Recaudado" value={`${fmtMoney(collected)}${inv > 0 ? ` · ${pct}%` : ''}`} />
            <Field label="Disponible para el tercero" value={fmtMoney(Number(item.available_for_payment ?? 0))} />
          </Stage>

          <Stage n={4} title="Factura de compra + Orden de Pago" done={!!item.third_party_invoice}>
            <Field label="Factura del tercero" value={item.third_party_invoice ?? 'Pendiente'} />
            <Field label="Valor" value={item.third_party_invoice_value != null ? fmtMoney(Number(item.third_party_invoice_value)) : '—'} />
            <Field label="Orden de pago" value={item.payment_order ?? '—'} mono />
          </Stage>

          <Stage n={5} title="Pago al tercero (egreso)" done={!!item.egress_voucher}>
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

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
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

  if (isLoading) return <div className="py-10"><PageLoader /></div>
  const s = data?.summary ?? {}
  const receivable: any[] = data?.receivable ?? []
  const payable: any[] = data?.payable ?? []

  return (
    <div className="space-y-4">
      {/* Tarjetas de saldo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
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
          <div className="overflow-x-auto">
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
                  <tr key={i} className="hover:bg-slate-50">
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
          <div className="overflow-x-auto">
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
                  <tr key={i} className="hover:bg-slate-50">
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
  const [showSiigo, setShowSiigo] = useState(false)
  const [showEgresos, setShowEgresos] = useState(false)
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

      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
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
            <Button size="sm" variant="secondary" onClick={() => setShowSiigo(true)}>
              <Upload className="w-3.5 h-3.5" /> Ventas y recaudo
            </Button>
          )}
          {isAdmin && (
            <Button size="sm" variant="secondary" onClick={() => setShowEgresos(true)}>
              <Upload className="w-3.5 h-3.5" /> Facturas y pagos de terceros
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
            <div className="overflow-x-auto">
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
                  No hay participaciones por factura. {isAdmin && 'Usa "Ventas y recaudo" para crearlas desde las facturas.'}
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

      {showSiigo && <SiigoReconcileModal onClose={() => setShowSiigo(false)} />}
      {showEgresos && <EgresosImportModal onClose={() => setShowEgresos(false)} />}
      {payItem && <ThirdPartyPaymentModal item={payItem} onClose={() => setPayItem(null)} />}
      {detailItem && <ParticipationDetailModal item={detailItem} onClose={() => setDetailItem(null)} />}
    </div>
  )
}
