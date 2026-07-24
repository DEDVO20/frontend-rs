import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { TopBar } from '@/components/layout/TopBar'
import { Button } from '@/components/ui/Button'
import { PageLoader } from '@/components/ui/Spinner'
import { SearchSelect } from '@/components/ui/SearchSelect'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { useAuthStore } from '@/stores/authStore'
import { toast } from 'sonner'
import {
  Calculator, AlertTriangle, CalendarDays, CheckCircle2, Clock,
  Building2, Plus, Pencil, Trash2, X, PlayCircle, ListChecks, Bell, Handshake,
} from 'lucide-react'

type Tab = 'dashboard' | 'clients' | 'analysis' | 'participations' | 'master'

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

function fmtMoney(n: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n ?? 0)
}

const PART_STATUS: Record<string, { label: string; cls: string }> = {
  pending:   { label: 'Pendiente',      cls: 'bg-amber-100 text-amber-700' },
  review:    { label: 'Pend. revisión', cls: 'bg-red-100 text-red-700' },
  validated: { label: 'Conciliada',     cls: 'bg-blue-100 text-blue-700' },
  closed:    { label: 'Cerrada',        cls: 'bg-emerald-100 text-emerald-700' },
}

// ── Registro manual de facturación + conciliación ────────────────────────────

function InvoicingModal({ item, onClose }: { item: any; onClose: () => void }) {
  const qc = useQueryClient()
  const inv = (Array.isArray(item.participation_invoicing) ? item.participation_invoicing[0] : item.participation_invoicing) ?? {}
  const [form, setForm] = useState({
    finto_invoice:             inv.finto_invoice ?? '',
    finto_invoice_date:        inv.finto_invoice_date ?? '',
    finto_invoice_value:       inv.finto_invoice_value != null ? String(inv.finto_invoice_value) : '',
    cash_receipt:              inv.cash_receipt ?? '',
    cash_receipt_date:         inv.cash_receipt_date ?? '',
    cash_receipt_value:        inv.cash_receipt_value != null ? String(inv.cash_receipt_value) : '',
    cash_account:              inv.cash_account ?? '',
    third_party_invoice:       inv.third_party_invoice ?? '',
    third_party_invoice_date:  inv.third_party_invoice_date ?? '',
    third_party_invoice_value: inv.third_party_invoice_value != null ? String(inv.third_party_invoice_value) : '',
    egress_voucher:            inv.egress_voucher ?? '',
    egress_voucher_date:       inv.egress_voucher_date ?? '',
    egress_voucher_value:      inv.egress_voucher_value != null ? String(inv.egress_voucher_value) : '',
    observations:              inv.observations ?? '',
  })
  const [result, setResult] = useState<{ status: string; reasons: string[] } | null>(null)
  // Alertas de factura ya registrada — informativas, no bloquean el guardado
  const [dupFinto, setDupFinto] = useState<string | null>(null)
  const [dupThird, setDupThird] = useState<string | null>(null)
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const num = (v: string) => v !== '' ? Number(v) : null
  const receivable = (Number(form.finto_invoice_value) || 0) - (Number(form.cash_receipt_value) || 0)
  const payable    = (Number(form.third_party_invoice_value) || 0) - (Number(form.egress_voucher_value) || 0)

  const checkDuplicate = async (type: 'finto' | 'third', value: string) => {
    const setter = type === 'finto' ? setDupFinto : setDupThird
    if (!value.trim()) { setter(null); return }
    try {
      const { data } = await api.get('/api/participations/invoice-check', {
        params: { type, number: value.trim(), exclude: item.id },
      })
      setter(data?.duplicate ? `Ya registrada en ${data.duplicate.purchase_order}` : null)
    } catch { setter(null) }
  }

  const saveMut = useMutation({
    mutationFn: async () => {
      const { data } = await api.patch(`/api/participations/monthly/${item.id}/invoicing`, {
        finto_invoice:             form.finto_invoice.trim() || null,
        finto_invoice_date:        form.finto_invoice_date || null,
        finto_invoice_value:       num(form.finto_invoice_value),
        cash_receipt:              form.cash_receipt.trim() || null,
        cash_receipt_date:         form.cash_receipt_date || null,
        cash_receipt_value:        num(form.cash_receipt_value),
        cash_account:              form.cash_account.trim() || null,
        third_party_invoice:       form.third_party_invoice.trim() || null,
        third_party_invoice_date:  form.third_party_invoice_date || null,
        third_party_invoice_value: num(form.third_party_invoice_value),
        egress_voucher:            form.egress_voucher.trim() || null,
        egress_voucher_date:       form.egress_voucher_date || null,
        egress_voucher_value:      num(form.egress_voucher_value),
        observations:              form.observations.trim() || null,
      })
      return data
    },
    onSuccess: (d: any) => {
      setResult({ status: d.status, reasons: d.reasons ?? [] })
      qc.invalidateQueries({ queryKey: ['participations'] })
      ;(d.warnings ?? []).forEach((w: string) => toast.warning(w))
      toast.success(
        d.status === 'closed'    ? 'Participación cerrada (recaudada y pagada)' :
        d.status === 'validated' ? 'Conciliación correcta' :
        'Guardado — quedó pendiente de revisión',
      )
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Error al guardar'),
  })

  const p = item.participation ?? {}
  const company = p.company_service?.companies?.name ?? '—'
  const service = p.company_service?.services?.name ?? '—'
  const tercero = p.third_party?.name ?? '—'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div>
            <h3 className="text-base font-bold text-slate-900">Registro de facturación</h3>
            <p className="text-xs text-slate-400">{item.purchase_order} · {company} · {service}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Referencia de lo calculado */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-slate-50 rounded-lg p-2">
              <p className="text-[10px] font-bold text-slate-400 uppercase">Valor servicio</p>
              <p className="text-sm font-semibold text-slate-900">{fmtMoney(Number(item.service_value))}</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-2">
              <p className="text-[10px] font-bold text-slate-400 uppercase">Porcentaje</p>
              <p className="text-sm font-semibold text-slate-900">{item.percentage}%</p>
            </div>
            <div className="bg-primary-50 rounded-lg p-2">
              <p className="text-[10px] font-bold text-primary-500 uppercase">Participación</p>
              <p className="text-sm font-bold text-primary-700">{fmtMoney(Number(item.participation_value))}</p>
            </div>
          </div>

          {/* ── CxC Clientes: factura Finto → recibo de caja ── */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 bg-slate-100">
              <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">CxC Clientes</p>
              <span className={`text-xs font-semibold ${receivable > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                Saldo por cobrar: {fmtMoney(receivable)}
              </span>
            </div>
            <div className="p-3 space-y-2">
              <div>
                <p className="text-[11px] font-semibold text-slate-500 mb-1">Factura de Finto</p>
                <div className="grid grid-cols-3 gap-2">
                  <input value={form.finto_invoice} onChange={e => set('finto_invoice', e.target.value)} onBlur={e => checkDuplicate('finto', e.target.value)} placeholder="N° factura"
                    className={`border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 ${dupFinto ? 'border-amber-400 bg-amber-50' : 'border-slate-200'}`} />
                  <input type="date" value={form.finto_invoice_date} onChange={e => set('finto_invoice_date', e.target.value)}
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                  <input type="number" min={0} value={form.finto_invoice_value} onChange={e => set('finto_invoice_value', e.target.value)} placeholder="Valor antes IVA"
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
                {dupFinto && (
                  <p className="text-[11px] text-amber-700 mt-1 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 shrink-0" /> {dupFinto} — puedes continuar de todas formas
                  </p>
                )}
              </div>
              <div>
                <p className="text-[11px] font-semibold text-slate-500 mb-1">Recibo de caja</p>
                <div className="grid grid-cols-3 gap-2">
                  <input value={form.cash_receipt} onChange={e => set('cash_receipt', e.target.value)} placeholder="N° recibo"
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                  <input type="date" value={form.cash_receipt_date} onChange={e => set('cash_receipt_date', e.target.value)}
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                  <input type="number" min={0} value={form.cash_receipt_value} onChange={e => set('cash_receipt_value', e.target.value)} placeholder="V. Recibo"
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
                <input value={form.cash_account} onChange={e => set('cash_account', e.target.value)} placeholder="Caja / cuenta donde ingresó"
                  className="w-full mt-2 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
            </div>
          </div>

          {/* ── CxP Terceros: factura tercero → comprobante de egreso ── */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 bg-blue-50">
              <p className="text-xs font-bold text-blue-800 uppercase tracking-wider">CxP Terceros ({tercero})</p>
              <span className={`text-xs font-semibold ${payable > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                Saldo por pagar: {fmtMoney(payable)}
              </span>
            </div>
            <div className="p-3 space-y-2">
              <div>
                <p className="text-[11px] font-semibold text-slate-500 mb-1">Factura del tercero</p>
                <div className="grid grid-cols-3 gap-2">
                  <input value={form.third_party_invoice} onChange={e => set('third_party_invoice', e.target.value)} onBlur={e => checkDuplicate('third', e.target.value)} placeholder="N° factura"
                    className={`border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 ${dupThird ? 'border-amber-400 bg-amber-50' : 'border-slate-200'}`} />
                  <input type="date" value={form.third_party_invoice_date} onChange={e => set('third_party_invoice_date', e.target.value)}
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                  <input type="number" min={0} value={form.third_party_invoice_value} onChange={e => set('third_party_invoice_value', e.target.value)} placeholder="Valor antes IVA"
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
                {dupThird && (
                  <p className="text-[11px] text-amber-700 mt-1 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 shrink-0" /> {dupThird} — puedes continuar de todas formas
                  </p>
                )}
              </div>
              <div>
                <p className="text-[11px] font-semibold text-slate-500 mb-1">Comprobante de egreso</p>
                <div className="grid grid-cols-3 gap-2">
                  <input value={form.egress_voucher} onChange={e => set('egress_voucher', e.target.value)} placeholder="N° comprobante"
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                  <input type="date" value={form.egress_voucher_date} onChange={e => set('egress_voucher_date', e.target.value)}
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                  <input type="number" min={0} value={form.egress_voucher_value} onChange={e => set('egress_voucher_value', e.target.value)} placeholder="V. CE"
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Observaciones</label>
            <textarea rows={2} value={form.observations} onChange={e => set('observations', e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none" />
          </div>

          {result && (
            <div className={`rounded-lg p-3 text-sm ${result.status === 'review' ? 'bg-red-50 border border-red-200' : 'bg-emerald-50 border border-emerald-200'}`}>
              <p className={`font-semibold ${result.status === 'review' ? 'text-red-700' : 'text-emerald-700'}`}>
                {result.status === 'closed'    ? '✓ Cerrada — recaudada y pagada' :
                 result.status === 'validated' ? '✓ Conciliación correcta — falta recaudar y/o pagar' :
                 result.status === 'pending'   ? 'Sin registros aún' :
                 '⚠ Pendiente de revisión'}
              </p>
              {result.reasons.map((r, i) => <p key={i} className="text-xs text-red-600 mt-0.5">• {r}</p>)}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 shrink-0">
          <Button variant="secondary" onClick={onClose}>Cerrar</Button>
          <Button loading={saveMut.isPending} onClick={() => saveMut.mutate()}>Guardar y conciliar</Button>
        </div>
      </div>
    </div>
  )
}

function ParticipationsTab({ isAdmin }: { isAdmin: boolean }) {
  const qc = useQueryClient()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [statusF, setStatusF] = useState('')
  const [page, setPage] = useState(1)
  const [invoicingItem, setInvoicingItem] = useState<any | null>(null)

  const { data: stats } = useQuery({
    queryKey: ['participations', 'stats', year, month],
    queryFn: async () => { const { data } = await api.get(`/api/participations/stats?year=${year}&month=${month}`); return data },
  })

  const { data, isLoading } = useQuery({
    queryKey: ['participations', 'monthly', year, month, statusF, page],
    queryFn: async () => {
      const params = new URLSearchParams({ year: String(year), month: String(month), page: String(page), limit: '20' })
      if (statusF) params.set('status', statusF)
      const { data } = await api.get(`/api/participations/monthly?${params}`)
      return data
    },
    placeholderData: (prev: any) => prev,
  })
  const rows: any[] = data?.data ?? []
  const total: number = data?.total ?? 0
  const pages = Math.max(1, Math.ceil(total / 20))

  const generateMut = useMutation({
    mutationFn: async () => { const { data } = await api.post('/api/participations/generate', { year, month }); return data },
    onSuccess: (d: any) => { toast.success(`${d.generated ?? 0} participación(es) generada(s)`); qc.invalidateQueries({ queryKey: ['participations'] }) },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Error al generar'),
  })

  const years = [now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2]

  return (
    <div className="space-y-4">
      {/* Controles */}
      <div className="flex flex-wrap items-center gap-2">
        <select value={year} onChange={e => { setYear(Number(e.target.value)); setPage(1) }}
          className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500">
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={month} onChange={e => { setMonth(Number(e.target.value)); setPage(1) }}
          className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500">
          {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <div className="flex flex-wrap gap-1.5">
          {([['', 'Todas'], ['pending', 'Pendientes'], ['review', 'Pend. revisión'], ['validated', 'Conciliadas'], ['closed', 'Cerradas']] as const).map(([k, l]) => (
            <button key={k} onClick={() => { setStatusF(k); setPage(1) }}
              className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-colors ${statusF === k ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
              {l}
            </button>
          ))}
        </div>
        {isAdmin && (
          <Button size="sm" variant="secondary" className="ml-auto" loading={generateMut.isPending} onClick={() => generateMut.mutate()}>
            Generar participaciones del mes
          </Button>
        )}
      </div>

      {/* Mini stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: 'Total', value: stats?.total ?? 0, cls: 'text-slate-900' },
          { label: 'Pend. revisión', value: stats?.review ?? 0, cls: 'text-red-600' },
          { label: 'Valor participaciones', value: fmtMoney(stats?.total_value ?? 0), cls: 'text-primary-700' },
          { label: 'CxC Clientes', value: fmtMoney(stats?.receivable ?? 0), cls: 'text-slate-800' },
          { label: 'CxP Terceros', value: fmtMoney(stats?.payable ?? 0), cls: 'text-blue-700' },
        ].map(k => (
          <div key={k.label} className="bg-white border border-slate-200 rounded-xl p-3">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{k.label}</p>
            <p className={`text-xl font-bold mt-0.5 ${k.cls}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Tabla */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="py-10"><PageLoader /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th colSpan={7} className="bg-slate-50" />
                  <th className="bg-slate-200 text-center px-3 py-1.5 text-[10px] font-bold text-slate-700 uppercase tracking-wider whitespace-nowrap">CxC Clientes</th>
                  <th className="bg-blue-100 text-center px-3 py-1.5 text-[10px] font-bold text-blue-800 uppercase tracking-wider whitespace-nowrap">CxP Terceros</th>
                  <th colSpan={2} className="bg-slate-50" />
                </tr>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {['Orden de compra', 'Cliente', 'Servicio', 'Tercero', 'Valor servicio', '%', 'Participación', 'Por cobrar', 'Por pagar', 'Estado', ''].map((h, i) => (
                    <th key={i} className="text-left px-3 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rows.map((r: any) => {
                  const p = r.participation ?? {}
                  const st = PART_STATUS[r.status] ?? PART_STATUS.pending
                  return (
                    <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-3 py-2.5 font-mono text-xs text-slate-700 whitespace-nowrap">{r.purchase_order}</td>
                      <td className="px-3 py-2.5 text-slate-700">{p.company_service?.companies?.name ?? '—'}</td>
                      <td className="px-3 py-2.5 text-slate-500">{p.company_service?.services?.name ?? '—'}</td>
                      <td className="px-3 py-2.5 text-slate-500">{p.third_party?.name ?? '—'}</td>
                      <td className="px-3 py-2.5 text-slate-700 whitespace-nowrap">{fmtMoney(Number(r.service_value))}</td>
                      <td className="px-3 py-2.5 text-slate-500">{r.percentage}%</td>
                      <td className="px-3 py-2.5 font-semibold text-slate-900 whitespace-nowrap">{fmtMoney(Number(r.participation_value))}</td>
                      <td className={`px-3 py-2.5 whitespace-nowrap bg-slate-50/60 ${Number(r.receivable) > 0 ? 'text-amber-700 font-medium' : 'text-slate-400'}`}>
                        {fmtMoney(Number(r.receivable ?? 0))}
                      </td>
                      <td className={`px-3 py-2.5 whitespace-nowrap bg-blue-50/60 ${Number(r.payable) > 0 ? 'text-amber-700 font-medium' : 'text-slate-400'}`}>
                        {fmtMoney(Number(r.payable ?? 0))}
                      </td>
                      <td className="px-3 py-2.5"><span className={`text-xs font-medium px-2 py-1 rounded-full ${st.cls}`}>{st.label}</span></td>
                      <td className="px-3 py-2.5 text-right">
                        <button onClick={() => setInvoicingItem(r)} className="text-xs font-medium text-primary-600 hover:underline whitespace-nowrap">
                          Registrar facturas
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {!rows.length && (
              <p className="px-4 py-12 text-center text-slate-400 text-sm">
                No hay participaciones para {MESES[month - 1]} {year}. {isAdmin && 'Usa "Generar participaciones del mes" para procesarlas.'}
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

      {invoicingItem && <InvoicingModal item={invoicingItem} onClose={() => setInvoicingItem(null)} />}
    </div>
  )
}

// ── Modal crear/editar tarea de la plantilla maestra ─────────────────────────

function MasterItemModal({ item, onClose }: { item: any | null; onClose: () => void }) {
  const qc = useQueryClient()
  const confirm = useConfirm()
  const [title, setTitle] = useState(item?.title ?? '')
  const [description, setDescription] = useState(item?.description ?? '')
  const [isMandatory, setIsMandatory] = useState<boolean>(item?.is_mandatory ?? true)
  const [noticeDays, setNoticeDays] = useState<number>(item?.notice_days ?? 5)

  const saveMut = useMutation({
    mutationFn: async () => {
      const body = { title: title.trim(), description: description.trim() || undefined, is_mandatory: isMandatory, notice_days: noticeDays }
      if (item) await api.patch(`/api/accounting/master/${item.id}`, body)
      else      await api.post('/api/accounting/master', body)
    },
    onSuccess: () => {
      toast.success(item ? 'Plantilla actualizada' : 'Tarea agregada a la plantilla maestra')
      qc.invalidateQueries({ queryKey: ['accounting'] })
      onClose()
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Error al guardar'),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-slate-900">{item ? 'Editar tarea de la maestra' : 'Nueva tarea en la maestra'}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X className="w-4 h-4" /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Nombre de la tarea *</label>
            <input value={title} onChange={e => setTitle(e.target.value)}
              placeholder="Ej: Impuesto al patrimonio 2027"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Descripción</label>
            <input value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Opcional"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>

          {/* ¿Obligatoria u opcional? (punto 2.c del spec) */}
          <div>
            <p className="text-xs font-medium text-slate-600 mb-2">¿Esta tarea es obligatoria para todos los clientes?</p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setIsMandatory(true)}
                className={`p-3 rounded-xl border text-sm font-medium transition-colors ${isMandatory ? 'border-red-300 bg-red-50 text-red-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                Obligatoria
              </button>
              <button type="button" onClick={() => setIsMandatory(false)}
                className={`p-3 rounded-xl border text-sm font-medium transition-colors ${!isMandatory ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                Opcional
              </button>
            </div>
          </div>

          {/* Anticipación: cuándo se crea la tarea y arrancan los recordatorios */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Anticipación (días antes del vencimiento)</label>
            <div className="flex flex-wrap gap-1.5">
              {[5, 10, 15, 30, 45, 60].map(n => (
                <button key={n} type="button" onClick={() => setNoticeDays(n)}
                  className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${noticeDays === n ? 'border-primary-400 bg-primary-50 text-primary-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                  {n}
                </button>
              ))}
              <input type="number" min={1} max={120} value={noticeDays}
                onChange={e => setNoticeDays(Math.min(120, Math.max(1, Number(e.target.value) || 1)))}
                className="w-20 border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">La tarea se crea y el contador empieza a recibir recordatorios {noticeDays} días antes del vencimiento.</p>
          </div>

          <div className="flex gap-2 pt-1">
            <Button variant="secondary" className="flex-1" onClick={onClose}>Cancelar</Button>
            <Button className="flex-1" loading={saveMut.isPending} disabled={title.trim().length < 3}
              onClick={() => confirm({
                title: item ? '¿Guardar los cambios?' : `¿Agregar "${title.trim()}"?`,
                description: 'El cambio se aplicará a todos los calendarios de clientes, nuevos y existentes.',
                type: 'warning',
                confirmLabel: item ? 'Guardar' : 'Agregar',
                onConfirm: () => saveMut.mutateAsync().then(() => {}),
              })}>
              {item ? 'Guardar' : 'Agregar'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────

export function AccountingPage() {
  const qc = useQueryClient()
  const confirm = useConfirm()
  const { user } = useAuthStore()
  const isSuperAdmin = user?.role === 'admin'
  const isAdmin = ['admin', 'rs_admin'].includes(user?.role ?? '')

  const [tab, setTab] = useState<Tab>('dashboard')
  const [selectedCompany, setSelectedCompany] = useState('')
  const [analysisFilter, setAnalysisFilter] = useState<'all' | 'complete' | 'incomplete'>('all')
  const [masterModal, setMasterModal] = useState<{ open: boolean; item: any | null }>({ open: false, item: null })

  // ── Queries ──
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['accounting', 'stats'],
    queryFn: async () => { const { data } = await api.get('/api/accounting/stats'); return data },
    staleTime: 60_000,
  })

  const { data: companiesData } = useQuery({
    queryKey: ['accounting', 'companies'],
    queryFn: async () => { const { data } = await api.get('/api/accounting/companies'); return data },
    staleTime: 60_000,
  })
  const companies: any[] = companiesData ?? []

  const { data: calendar, isLoading: calendarLoading } = useQuery({
    queryKey: ['accounting', 'calendar', selectedCompany],
    queryFn: async () => { const { data } = await api.get(`/api/accounting/companies/${selectedCompany}`); return data },
    enabled: !!selectedCompany,
  })
  const entries: any[] = calendar ?? []

  const { data: masterData, isLoading: masterLoading } = useQuery({
    queryKey: ['accounting', 'master'],
    queryFn: async () => { const { data } = await api.get('/api/accounting/master'); return data },
    staleTime: 60_000,
  })
  const master: any[] = masterData ?? []

  // ── Mutations ──
  const invalidateAll = () => qc.invalidateQueries({ queryKey: ['accounting'] })

  const entryMut = useMutation({
    mutationFn: async ({ id, due_date }: { id: string; due_date: string | null }) => {
      await api.patch(`/api/accounting/entries/${id}`, { due_date })
    },
    onSuccess: () => { toast.success('Fecha actualizada'); invalidateAll() },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Error al guardar la fecha'),
  })

  const deleteMasterMut = useMutation({
    mutationFn: async (id: string) => { await api.delete(`/api/accounting/master/${id}`) },
    onSuccess: () => { toast.success('Tarea eliminada de la maestra y de todos los calendarios'); invalidateAll() },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Error al eliminar'),
  })

  const runCronMut = useMutation({
    mutationFn: async () => { const { data } = await api.post('/api/accounting/run-cron'); return data },
    onSuccess: (d: any) => { toast.success(`Cron ejecutado: ${d.created ?? 0} tareas generadas`); invalidateAll() },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Error al ejecutar el cron'),
  })

  const backfillMut = useMutation({
    mutationFn: async () => { const { data } = await api.post('/api/accounting/backfill'); return data },
    onSuccess: (d: any) => { toast.success(`Fichas generadas para ${d.companies ?? 0} empresas`); invalidateAll() },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Error al generar fichas'),
  })

  const remindersMut = useMutation({
    mutationFn: async () => { const { data } = await api.post('/api/accounting/run-reminders'); return data },
    onSuccess: (d: any) => { toast.success(`Recordatorios enviados: ${d.reminded ?? 0} obligación(es)`) },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Error al enviar recordatorios'),
  })

  const selectedInfo = companies.find(c => c.id === selectedCompany)

  const analysisRows = companies.filter(c =>
    analysisFilter === 'complete' ? c.complete : analysisFilter === 'incomplete' ? !c.complete : true)

  const TABS: { key: Tab; label: string; icon: any; hidden?: boolean }[] = [
    { key: 'dashboard', label: 'Dashboard',          icon: Calculator },
    { key: 'clients',   label: 'Calendarios',        icon: CalendarDays },
    { key: 'analysis',  label: 'Análisis',           icon: ListChecks },
    { key: 'participations', label: 'Participaciones', icon: Handshake },
    { key: 'master',    label: 'Plantilla maestra',  icon: Building2, hidden: !isSuperAdmin },
  ]

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar title="Contabilidad" subtitle="Calendario tributario y obligaciones" />

      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <p className="text-xs text-slate-400">Módulos / <span className="text-primary-600 font-medium">Contabilidad</span></p>
            <h2 className="text-xl font-bold text-slate-900">Dashboard contable</h2>
          </div>
          {isAdmin && (
            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" onClick={() => backfillMut.mutate()} loading={backfillMut.isPending}>
                Generar fichas faltantes
              </Button>
              <Button size="sm" variant="secondary" onClick={() => runCronMut.mutate()} loading={runCronMut.isPending}>
                <PlayCircle className="w-3.5 h-3.5" /> Ejecutar cron
              </Button>
              <Button size="sm" variant="secondary" onClick={() => remindersMut.mutate()} loading={remindersMut.isPending}>
                <Bell className="w-3.5 h-3.5" /> Enviar recordatorios
              </Button>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-slate-200">
          {TABS.filter(t => !t.hidden).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key ? 'border-primary-500 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}>
              <t.icon className="w-4 h-4" /> {t.label}
            </button>
          ))}
        </div>

        {/* ── Dashboard ── */}
        {tab === 'dashboard' && (
          statsLoading ? <div className="py-10"><PageLoader /></div> : (
            <div className="space-y-5">
              {/* KPIs de tareas del cron */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                {[
                  { label: 'Vencidas',        value: stats?.tasks?.overdue ?? 0,     color: 'border-t-red-500',     text: 'text-red-600' },
                  { label: 'Próximas 7 días', value: stats?.tasks?.due_7_days ?? 0,  color: 'border-t-amber-500',   text: 'text-amber-600' },
                  { label: 'Próximas 15 días', value: stats?.tasks?.due_15_days ?? 0, color: 'border-t-blue-500',   text: 'text-blue-600' },
                  { label: 'Pendientes',      value: stats?.tasks?.pending ?? 0,     color: 'border-t-slate-400',   text: 'text-slate-900' },
                  { label: 'Completadas',     value: stats?.tasks?.done ?? 0,        color: 'border-t-emerald-500', text: 'text-emerald-600' },
                ].map(k => (
                  <div key={k.label} className={`bg-white border border-slate-200 rounded-xl p-4 border-t-4 ${k.color}`}>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{k.label}</p>
                    <p className={`text-3xl font-bold mt-1 ${k.text}`}>{k.value}</p>
                    <p className="text-xs text-slate-400 mt-0.5">tareas tributarias</p>
                  </div>
                ))}
              </div>

              {/* Alerta: empresas sin calendario completo (punto 3) */}
              {(stats?.companies?.incomplete ?? 0) > 0 ? (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="w-5 h-5 text-amber-500" />
                    <h3 className="text-sm font-bold text-amber-800">
                      {stats.companies.incomplete} empresa{stats.companies.incomplete === 1 ? '' : 's'} sin calendario tributario completo
                    </h3>
                  </div>
                  <p className="text-xs text-amber-700 mb-3">Tienen tareas obligatorias sin fecha diligenciada:</p>
                  <div className="flex flex-wrap gap-2">
                    {stats.companies.incomplete_list?.map((c: any) => (
                      <button key={c.id}
                        onClick={() => { setSelectedCompany(c.id); setTab('clients') }}
                        className="text-xs bg-white border border-amber-300 text-amber-800 px-3 py-1.5 rounded-full font-medium hover:bg-amber-100 transition-colors">
                        {c.name} · {c.mandatory_without_date} sin fecha
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 flex items-center gap-3">
                  <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-emerald-800">Todos los calendarios están completos</p>
                    <p className="text-xs text-emerald-600">{stats?.companies?.total ?? 0} empresas con servicio contable tienen sus tareas obligatorias con fecha.</p>
                  </div>
                </div>
              )}

              {/* Resumen de empresas */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Con servicio contable</p>
                  <p className="text-3xl font-bold text-slate-900 mt-1">{stats?.companies?.total ?? 0}</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Calendario completo</p>
                  <p className="text-3xl font-bold text-emerald-600 mt-1">{stats?.companies?.complete ?? 0}</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Incompleto</p>
                  <p className="text-3xl font-bold text-amber-600 mt-1">{stats?.companies?.incomplete ?? 0}</p>
                </div>
              </div>
            </div>
          )
        )}

        {/* ── Calendarios por cliente ── */}
        {tab === 'clients' && (
          <div className="space-y-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="w-full sm:w-96">
                <SearchSelect
                  label="Cliente"
                  value={selectedCompany}
                  onChange={setSelectedCompany}
                  placeholder="Buscar empresa…"
                  options={companies.map(c => ({ value: c.id, label: c.name, color: c.complete ? 'bg-emerald-500' : 'bg-amber-500' }))}
                />
              </div>
              {selectedInfo && (
                <p className={`text-xs mt-2 ${selectedInfo.complete ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {selectedInfo.complete
                    ? '✓ Calendario completo — todas las obligatorias tienen fecha'
                    : `⚠ ${selectedInfo.mandatory_without_date} tarea(s) obligatoria(s) sin fecha`}
                </p>
              )}
            </div>

            {!selectedCompany ? (
              <div className="bg-white border border-slate-200 rounded-xl py-16 text-center text-slate-400">
                <CalendarDays className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                <p className="text-sm">Selecciona un cliente para ver y editar su calendario tributario</p>
              </div>
            ) : calendarLoading ? (
              <div className="py-10"><PageLoader /></div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="text-left px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Obligación</th>
                      <th className="text-left px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tipo</th>
                      <th className="text-left px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Fecha de vencimiento</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {entries.map((e: any) => (
                      <tr key={e.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-900">{e.master?.title ?? '—'}</p>
                          {e.master?.description && <p className="text-xs text-slate-400">{e.master.description}</p>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-medium px-2 py-1 rounded-full ${e.is_mandatory ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                            {e.is_mandatory ? 'Obligatoria' : 'Opcional'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <input
                              type="date"
                              defaultValue={e.due_date ?? ''}
                              key={e.id + (e.due_date ?? '')}
                              onChange={ev => entryMut.mutate({ id: e.id, due_date: ev.target.value || null })}
                              className={`text-sm border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                                !e.due_date && e.is_mandatory ? 'border-amber-300 bg-amber-50' : 'border-slate-200'
                              }`}
                            />
                            {!e.due_date && e.is_mandatory && (
                              <span className="text-xs text-amber-600 font-medium">Sin diligenciar</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!entries.length && (
                  <p className="px-4 py-12 text-center text-slate-400 text-sm">La plantilla maestra está vacía</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Análisis ── */}
        {tab === 'analysis' && (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Estado de calendarios por empresa</h3>
              <div className="flex gap-1.5">
                {([['all', 'Todas'], ['complete', 'Completas'], ['incomplete', 'Incompletas']] as const).map(([k, l]) => (
                  <button key={k} onClick={() => setAnalysisFilter(k)}
                    className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-colors ${
                      analysisFilter === k ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="text-left px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Empresa</th>
                    <th className="text-center px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Obligatorias con fecha</th>
                    <th className="text-center px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Obligatorias sin fecha</th>
                    <th className="text-center px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Opcionales con fecha</th>
                    <th className="text-center px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Opcionales sin fecha</th>
                    <th className="text-left px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {analysisRows.map((c: any) => (
                    <tr key={c.id} className="hover:bg-slate-50 transition-colors cursor-pointer"
                      onClick={() => { setSelectedCompany(c.id); setTab('clients') }}>
                      <td className="px-4 py-3 font-medium text-slate-900">{c.name}</td>
                      <td className="px-4 py-3 text-center text-emerald-600 font-semibold">{c.mandatory_with_date}</td>
                      <td className={`px-4 py-3 text-center font-semibold ${c.mandatory_without_date ? 'text-red-600' : 'text-slate-400'}`}>{c.mandatory_without_date}</td>
                      <td className="px-4 py-3 text-center text-slate-600">{c.optional_with_date}</td>
                      <td className="px-4 py-3 text-center text-slate-400">{c.optional_without_date}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${c.complete ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                          {c.complete ? '✓ Completo' : '⚠ Incompleto'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!analysisRows.length && (
                <p className="px-4 py-12 text-center text-slate-400 text-sm">Sin empresas con servicio contable</p>
              )}
            </div>
          </div>
        )}

        {/* ── Participaciones de terceros ── */}
        {tab === 'participations' && <ParticipationsTab isAdmin={isAdmin} />}

        {/* ── Plantilla maestra (solo Super Admin) ── */}
        {tab === 'master' && isSuperAdmin && (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Calendario tributario maestro</h3>
                <p className="text-xs text-slate-400">Los cambios se propagan a todos los calendarios de clientes, nuevos y existentes</p>
              </div>
              <Button size="sm" onClick={() => setMasterModal({ open: true, item: null })}>
                <Plus className="w-3.5 h-3.5" /> Nueva tarea
              </Button>
            </div>
            {masterLoading ? (
              <div className="py-10"><PageLoader /></div>
            ) : (
              <div className="divide-y divide-slate-50">
                {master.map((m: any) => (
                  <div key={m.id} className="flex items-center gap-4 px-4 py-3.5 hover:bg-slate-50 transition-colors group">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${m.is_mandatory ? 'bg-red-50' : 'bg-blue-50'}`}>
                      <Clock className={`w-4 h-4 ${m.is_mandatory ? 'text-red-500' : 'text-blue-500'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900">{m.title}</p>
                      {m.description && <p className="text-xs text-slate-400 truncate">{m.description}</p>}
                    </div>
                    <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-full shrink-0" title="Anticipación con la que se crea la tarea y arrancan los recordatorios">
                      ⏱ {m.notice_days ?? 5}d
                    </span>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full shrink-0 ${m.is_mandatory ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                      {m.is_mandatory ? 'Obligatoria' : 'Opcional'}
                    </span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button onClick={() => setMasterModal({ open: true, item: m })}
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-primary-600 transition-colors" title="Editar">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => confirm({
                          title: `¿Eliminar "${m.title}"?`,
                          description: 'Se eliminará de la plantilla maestra y de TODOS los calendarios de clientes, incluso los ya diligenciados. Esta acción no se puede deshacer.',
                          type: 'danger',
                          confirmLabel: 'Eliminar',
                          onConfirm: () => deleteMasterMut.mutateAsync(m.id).then(() => {}),
                        })}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors" title="Eliminar">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
                {!master.length && (
                  <p className="px-4 py-12 text-center text-slate-400 text-sm">La plantilla maestra está vacía — agrega la primera tarea</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {masterModal.open && (
        <MasterItemModal item={masterModal.item} onClose={() => setMasterModal({ open: false, item: null })} />
      )}
    </div>
  )
}
