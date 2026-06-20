import { useState, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { TopBar } from '@/components/layout/TopBar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { PageLoader } from '@/components/ui/Spinner'
import { formatCurrency } from '@/lib/utils'
import { toast } from 'sonner'
import {
  Upload, Plus, Users, DollarSign, PhoneOff,
  Handshake, ClipboardList, Send, ArrowUpDown, Clock, FileText, Edit3, Trash2, X, Eye, Pencil,
} from 'lucide-react'
import { DebtorDrawer } from './DebtorDrawer'

// ── helpers ────────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, { label: string; color: any }> = {
  pending:        { label: 'Pendiente',      color: 'gray'   },
  in_collection:  { label: 'En gestión',     color: 'blue'   },
  promised:       { label: 'Prometido',      color: 'yellow' },
  agreement:      { label: 'Acuerdo',        color: 'teal'   },
  partially_paid: { label: 'Pago parcial',   color: 'orange' },
  paid:           { label: 'Pagado',         color: 'green'  },
  defaulted:      { label: 'En mora',        color: 'red'    },
  uncontactable:  { label: 'No contactable', color: 'gray'   },
}

function getTramo(days: number): string {
  if (days <= 0)  return '—'
  if (days <= 30) return '1-30 días'
  if (days <= 60) return '31-60 días'
  if (days <= 90) return '61-90 días'
  return '91+ días'
}

function getTramoColor(days: number): string {
  if (days > 90) return 'text-red-600 font-semibold'
  if (days > 60) return 'text-orange-500 font-semibold'
  if (days > 30) return 'text-amber-500'
  return 'text-slate-500'
}

function renderPreview(template: string, debtor: any): string {
  const saldo = debtor.outstanding_balance ?? 0
  return template
    .replace(/\{\{nombre\}\}/g, debtor.debtor_name ?? '')
    .replace(/\{\{saldo\}\}/g, formatCurrency(saldo))
    .replace(/\{\{dias_mora\}\}/g, String(debtor.days_overdue ?? 0))
    .replace(/\{\{empresa\}\}/g, debtor.company?.name ?? '')
    .replace(/\{\{asesor\}\}/g, 'RS Back Office')
    .replace(/\{\{facturas\}\}/g, String(debtor.collection_debts?.length ?? 0))
}

type TabKey = 'active' | 'paid' | 'gestion' | 'masivo' | 'plantillas'

// ── KPI card ───────────────────────────────────────────────────────────────────

function KpiCard({ icon: Icon, iconBg, label, value, sub, subColor = 'text-slate-400' }: {
  icon: any; iconBg: string; label: string; value: React.ReactNode; sub?: string; subColor?: string
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-start gap-3">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>
        <Icon className="w-4 h-4 text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">{label}</p>
        <p className="text-2xl font-bold text-slate-900 leading-tight">{value}</p>
        {sub && <p className={`text-xs mt-0.5 ${subColor}`}>{sub}</p>}
      </div>
    </div>
  )
}

// ── Envío masivo panel ─────────────────────────────────────────────────────────

function MasivoPanel({ companyId }: { companyId: string }) {
  const [channel,  setChannel]  = useState<'whatsapp'|'sms'|'email'>('whatsapp')
  const [message,  setMessage]  = useState('')
  const [tramo,    setTramo]    = useState('')
  const [statusF,  setStatusF]  = useState('')
  const [plantilla,setPlantilla]= useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [sending,  setSending]  = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['debtors-masivo', companyId],
    queryFn: async () => {
      const params = new URLSearchParams({ page: '1', limit: '500' })
      if (companyId) params.set('company_id', companyId)
      const { data } = await api.get(`/api/collection/debtors?${params}`)
      return data
    },
    staleTime: 60_000,
  })

  const { data: templates } = useQuery({
    queryKey: ['collection-templates'],
    queryFn: async () => { const { data } = await api.get('/api/collection/templates'); return data },
  })

  const { data: history } = useQuery({
    queryKey: ['collection-campaigns'],
    queryFn: async () => { const { data } = await api.get('/api/collection/campaigns'); return data },
  })

  const allDebtors: any[] = data?.data ?? []

  // Determina el tramo máximo de un deudor a partir de sus deudas
  const getMaxTramo = (d: any): number => {
    if (d.prev_max_tramo) return d.prev_max_tramo
    const debts: any[] = d.collection_debts ?? []
    if (debts.some((x: any) => (x.overdue_91_plus ?? 0) > 0)) return 91
    if (debts.some((x: any) => (x.overdue_61_90 ?? 0) > 0))   return 61
    if (debts.some((x: any) => (x.overdue_31_60 ?? 0) > 0))   return 31
    if (debts.some((x: any) => (x.overdue_1_30  ?? 0) > 0))   return 1
    return 0
  }

  const filtered = allDebtors.filter(d => {
    if (statusF && d.status !== statusF) return false
    if (tramo) {
      const t = getMaxTramo(d)
      if (tramo === '1-30'  && !(t >= 1  && t <= 30)) return false
      if (tramo === '31-60' && !(t >= 31 && t <= 60)) return false
      if (tramo === '61-90' && !(t >= 61 && t <= 90)) return false
      if (tramo === '91+'   && !(t >= 91))             return false
    }
    return true
  })

  const toggleAll = () =>
    setSelected(prev => prev.length === filtered.length ? [] : filtered.map(d => d.id))

  const toggle = (id: string) =>
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const targets = selected.length ? allDebtors.filter(d => selected.includes(d.id)) : filtered

  const contactable = targets.filter(d => {
    if (channel === 'email') return !!d.email
    return !!(d.phone ?? d.whatsapp)
  })
  const noContact = targets.length - contactable.length

  const applyTemplate = (tpl: any) => {
    if (tpl) { setMessage(tpl.body ?? tpl.content ?? ''); setChannel(tpl.channel ?? 'whatsapp') }
  }

  const firstTarget = targets[0]

  const send = async () => {
    if (!message.trim()) { toast.error('Escribe un mensaje'); return }
    if (!contactable.length) { toast.error(`Ningún deudor tiene ${channel === 'email' ? 'email' : 'teléfono'} registrado`); return }
    setSending(true)
    try {
      const { data } = await api.post('/api/collection/campaigns', {
        name: `Campaña ${new Date().toLocaleDateString('es-CO')}`,
        channel,
        message_template: message,
        debtor_ids: targets.map(d => d.id),
      })
      const sent = data.sent ?? contactable.length
      toast.success(`Campaña enviada a ${sent} de ${targets.length} deudores`)
      setMessage('')
      setSelected([])
    } catch (e: any) {
      toast.error(e.response?.data?.error ?? 'Error al enviar')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="p-4 md:p-5 space-y-5">

      {/* ── Filtros ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Filtrar por tramo</label>
          <select value={tramo} onChange={e => setTramo(e.target.value)}
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500">
            <option value="">Todos los tramos</option>
            <option value="1-30">1-30 días</option>
            <option value="31-60">31-60 días</option>
            <option value="61-90">61-90 días</option>
            <option value="91+">91+ días</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Filtrar por estado</label>
          <select value={statusF} onChange={e => setStatusF(e.target.value)}
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500">
            <option value="">Todos los estados</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Plantilla</label>
          <select
            value={plantilla}
            onChange={e => {
              setPlantilla(e.target.value)
              const tpl = (templates ?? []).find((t: any) => t.id === e.target.value)
              if (tpl) applyTemplate(tpl)
            }}
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500">
            <option value="">Sin plantilla</option>
            {(templates ?? []).map((t: any) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Canal de envío</label>
          <div className="flex gap-1.5">
            {([
              { id: 'whatsapp', label: '💬 WhatsApp' },
              { id: 'sms',     label: '📱 SMS' },
              { id: 'email',   label: '📧 Email' },
            ] as const).map(ch => (
              <button key={ch.id} onClick={() => setChannel(ch.id)}
                className={`flex-1 text-xs py-2 rounded-lg font-medium transition-colors ${channel === ch.id ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                {ch.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Grid deudores + Composer ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">

        {/* Lista de deudores */}
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox"
                checked={selected.length === filtered.length && filtered.length > 0}
                onChange={toggleAll}
                className="rounded border-slate-300" />
              <span className="text-sm font-medium text-slate-700">
                {selected.length > 0 ? `${selected.length} seleccionado(s)` : `${filtered.length} deudores`}
              </span>
            </label>
            {selected.length > 0 && (
              <button onClick={() => setSelected([])} className="text-xs text-slate-400 hover:text-slate-600">
                Limpiar
              </button>
            )}
          </div>

          <div className="max-h-[520px] overflow-y-auto divide-y divide-slate-50">
            {isLoading ? (
              <div className="py-10 flex justify-center"><PageLoader /></div>
            ) : filtered.map((d: any) => {
              const saldo = d.collection_debts?.reduce((a: number, x: any) => a + (x.outstanding_amount ?? 0), 0) ?? 0
              const maxTramo = getMaxTramo(d)
              return (
                <label key={d.id}
                  className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-slate-50 ${selected.includes(d.id) ? 'bg-primary-50' : ''}`}>
                  <input type="checkbox"
                    checked={selected.includes(d.id)}
                    onChange={() => toggle(d.id)}
                    className="rounded border-slate-300 mt-1 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{d.debtor_name}</p>
                    <p className="text-xs text-slate-400">{d.debtor_document}</p>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-slate-500">
                      {d.phone && <span>📞 {d.phone}</span>}
                      {d.email && <span>📧 {d.email}</span>}
                    </div>
                  </div>
                  <div className="shrink-0 text-right space-y-0.5">
                    <p className={`text-xs font-medium ${getTramoColor(maxTramo)}`}>{getTramo(maxTramo)}</p>
                    <p className="text-sm font-bold text-slate-800">{formatCurrency(saldo)}</p>
                  </div>
                </label>
              )
            })}
            {!isLoading && !filtered.length && (
              <p className="text-center text-sm text-slate-400 py-8">Sin deudores con esos filtros</p>
            )}
          </div>
        </div>

        {/* Composer + preview */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Mensaje <span className="text-red-500">*</span>
            </label>
            <p className="text-xs text-slate-400 mb-2">
              Usa <code className="bg-slate-100 px-1 rounded">{'{{nombre}}'}</code>,{' '}
              <code className="bg-slate-100 px-1 rounded">{'{{saldo}}'}</code>,{' '}
              <code className="bg-slate-100 px-1 rounded">{'{{dias_mora}}'}</code>,{' '}
              <code className="bg-slate-100 px-1 rounded">{'{{empresa}}'}</code>,{' '}
              <code className="bg-slate-100 px-1 rounded">{'{{asesor}}'}</code>,{' '}
              <code className="bg-slate-100 px-1 rounded">{'{{facturas}}'}</code> como variables
            </p>
            <textarea
              rows={6}
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Escribe el mensaje..."
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            />
            <p className="text-xs text-slate-400 text-right mt-1">{message.length} caracteres</p>
          </div>

          {/* Preview */}
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Vista previa (primer deudor seleccionado)
            </p>
            {firstTarget && message ? (
              <div className="bg-white border border-slate-200 rounded-lg p-3">
                <p className="text-xs text-slate-400 mb-1">{firstTarget.debtor_name}</p>
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                  {renderPreview(message, firstTarget)}
                </p>
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">
                {!firstTarget
                  ? 'Completa los pasos anteriores (selecciona deudores y escribe un mensaje).'
                  : 'Escribe un mensaje para ver la vista previa.'}
              </p>
            )}
          </div>

          {noContact > 0 && targets.length > 0 && (
            <div className={`flex items-start gap-2 p-3 rounded-lg text-xs ${contactable.length === 0 ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>
              <span className="shrink-0 mt-0.5">⚠️</span>
              <span>
                {contactable.length === 0
                  ? `Ninguno de los ${targets.length} deudores tiene ${channel === 'email' ? 'email' : 'teléfono'} registrado. Importa los datos de contacto primero.`
                  : `${noContact} de ${targets.length} deudores no tienen ${channel === 'email' ? 'email' : 'teléfono'}. Solo se enviará a ${contactable.length}.`}
              </span>
            </div>
          )}

          <Button
            className="w-full"
            size="lg"
            onClick={send}
            loading={sending}
            disabled={!message.trim() || contactable.length === 0}
          >
            <Send className="w-4 h-4" />
            ✉️ Aprobar y enviar a {contactable.length} deudores
          </Button>
        </div>
      </div>

      {/* Historial */}
      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
          <Clock className="w-4 h-4 text-slate-400" />
          <p className="text-sm font-semibold text-slate-700">Historial de envíos masivos</p>
          <span className="ml-auto text-xs text-slate-400">{(history ?? []).length} envíos masivos registrados</span>
        </div>
        {!(history ?? []).length ? (
          <p className="text-center text-sm text-slate-400 py-8">Sin envíos masivos registrados aún.</p>
        ) : (
          <div className="divide-y divide-slate-50">
            {(history ?? []).map((h: any) => (
              <div key={h.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">{h.name}</p>
                  <p className="text-xs text-slate-400">{h.channel} · {h.recipient_count ?? 0} destinatarios</p>
                </div>
                <Badge label={h.status ?? 'enviado'} color="green" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Template modal ─────────────────────────────────────────────────────────────

const EMPTY_FORM = { name: '', channel: 'whatsapp', tramo_min: '', content: '', active: true }
const VARS = ['{{nombre}}', '{{saldo}}', '{{empresa}}', '{{dias_mora}}', '{{asesor}}', '{{facturas}}']

function TemplateModal({ editing, onClose, onSaved }: {
  editing: any | null   // null = crear, objeto = editar
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState(() =>
    editing
      ? { name: editing.name ?? '', channel: editing.channel ?? 'whatsapp', tramo_min: editing.tramo != null ? String(editing.tramo) : '', content: editing.body ?? editing.content ?? '', active: editing.is_active !== false }
      : EMPTY_FORM
  )
  const [saving, setSaving] = useState(false)

  const isEdit = !!editing

  const handleSave = async () => {
    if (!form.name.trim() || !form.content.trim()) {
      toast.error('Nombre y cuerpo del mensaje son obligatorios')
      return
    }
    setSaving(true)
    try {
      // Extrae el número mínimo del rango: '31–60' → 31, '91+' → 91, '5' → 5
      const tramoNum = form.tramo_min
        ? parseInt(form.tramo_min.replace(/[^0-9].*/, ''), 10) || undefined
        : undefined

      const payload = {
        name:      form.name.trim(),
        channel:   form.channel,
        body:      form.content.trim(),
        tramo:     tramoNum,
        is_active: form.active,
        is_global: true,
      }
      if (isEdit) {
        await api.patch(`/api/collection/templates/${editing.id}`, payload)
        toast.success('Plantilla actualizada')
      } else {
        await api.post('/api/collection/templates', payload)
        toast.success('Plantilla creada')
      }
      onSaved()
      onClose()
    } catch (e: any) {
      const msg = e.response?.data?.error ?? e.response?.data?.message ?? `Error al ${isEdit ? 'actualizar' : 'crear'} plantilla`
      toast.error(typeof msg === 'string' ? msg : 'Error inesperado')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <h3 className="text-base font-bold text-slate-900">
            {isEdit ? 'Editar plantilla' : 'Nueva plantilla'}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            {/* Nombre */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Nombre <span className="text-red-500">*</span>
              </label>
              <input
                value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Ej: Recordatorio mora 91+"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {/* Canal */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Canal <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { id: 'whatsapp', label: 'WhatsApp', icon: '💬', active: 'bg-emerald-500 border-emerald-500 text-white', dot: 'bg-emerald-400' },
                  { id: 'sms',      label: 'SMS',       icon: '📱', active: 'bg-blue-500 border-blue-500 text-white',    dot: 'bg-blue-400' },
                  { id: 'email',    label: 'Email',     icon: '📧', active: 'bg-primary-600 border-primary-600 text-white', dot: 'bg-primary-400' },
                ] as const).map(ch => (
                  <button key={ch.id} type="button"
                    onClick={() => setForm(f => ({ ...f, channel: ch.id }))}
                    className={`flex flex-col items-center gap-1.5 py-3 rounded-xl font-medium text-xs transition-all border-2 ${
                      form.channel === ch.id
                        ? `${ch.active} shadow-md`
                        : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}>
                    <span className="text-xl leading-none">{ch.icon}</span>
                    <span>{ch.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Tramo */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Tramo mínimo (días)</label>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { label: '1–30',  val: '1–30' },
                  { label: '31–60', val: '31–60' },
                  { label: '61–90', val: '61–90' },
                  { label: '91+',   val: '91+' },
                ].map(t => (
                  <button key={t.val} type="button"
                    onClick={() => setForm(f => ({ ...f, tramo_min: f.tramo_min === t.val ? '' : t.val }))}
                    className={`py-2 rounded-lg text-xs font-medium border-2 transition-all ${
                      form.tramo_min === t.val
                        ? 'bg-slate-800 border-slate-800 text-white'
                        : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                    }`}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Empresa */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-600 mb-1">Empresa (vacío = global)</label>
              <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 text-slate-400 text-sm">
                🌐 Global
              </div>
            </div>
          </div>

          {/* Cuerpo */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
              <label className="text-xs font-semibold text-slate-600">
                Cuerpo del mensaje <span className="text-red-500">*</span>
              </label>
              <div className="flex flex-wrap gap-1">
                {VARS.map(v => (
                  <button key={v} type="button"
                    onClick={() => setForm(f => ({ ...f, content: f.content + v }))}
                    className="text-[10px] bg-slate-100 hover:bg-primary-100 text-slate-600 hover:text-primary-700 px-1.5 py-0.5 rounded font-mono transition-colors">
                    {v}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              rows={5}
              value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
              placeholder="Escribe el cuerpo del mensaje. Usa las variables de arriba para personalizarlo."
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            />
            <p className="text-xs text-slate-400 text-right mt-1">{form.content.length} caracteres</p>
          </div>

          {/* Activa */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.active}
              onChange={e => setForm(f => ({ ...f, active: e.target.checked }))}
              className="rounded border-slate-300" />
            <span className="text-sm text-slate-700">Plantilla activa</span>
          </label>
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-6 py-4 border-t border-slate-100 shrink-0">
          <Button variant="secondary" onClick={onClose} className="flex-1">Cancelar</Button>
          <Button onClick={handleSave} loading={saving} className="flex-1">
            {isEdit ? 'Guardar cambios' : 'Crear plantilla'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Plantillas panel ───────────────────────────────────────────────────────────

function PlantillasPanel() {
  const qc = useQueryClient()
  const [modalOpen,  setModalOpen]  = useState(false)
  const [editTarget, setEditTarget] = useState<any | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['collection-templates'],
    queryFn: async () => { const { data } = await api.get('/api/collection/templates'); return data },
  })

  const openCreate = () => { setEditTarget(null); setModalOpen(true) }
  const openEdit   = (t: any) => { setEditTarget(t); setModalOpen(true) }
  const onSaved    = () => qc.invalidateQueries({ queryKey: ['collection-templates'] })

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta plantilla?')) return
    try {
      await api.delete(`/api/collection/templates/${id}`)
      toast.success('Plantilla eliminada')
      qc.invalidateQueries({ queryKey: ['collection-templates'] })
    } catch {
      toast.error('Error al eliminar la plantilla')
    }
  }

  return (
    <div className="p-4 md:p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{(data ?? []).length} plantillas registradas</p>
        <Button size="sm" onClick={openCreate}>
          <Plus className="w-3.5 h-3.5" /> Nueva plantilla
        </Button>
      </div>

      {/* Tabla */}
      {isLoading ? <PageLoader /> : (data ?? []).length > 0 ? (
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {['Nombre','Canal','Tramo','Empresa','Estado',''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(data ?? []).map((t: any) => (
                <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-900">{t.name}</td>
                  <td className="px-4 py-3 text-slate-500 capitalize">{t.channel}</td>
                  <td className="px-4 py-3 text-slate-500">{t.tramo != null ? `${t.tramo}+ días` : '—'}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">🌐 Global</td>
                  <td className="px-4 py-3">
                    {t.is_active !== false
                      ? <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Activa</span>
                      : <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-400"><span className="w-1.5 h-1.5 rounded-full bg-slate-300" />Inactiva</span>
                    }
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(t)}
                        className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-600" title="Editar">
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(t.id)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500" title="Eliminar">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-12 text-slate-400 border border-dashed border-slate-200 rounded-xl">
          <FileText className="w-8 h-8 mx-auto mb-2 text-slate-300" />
          <p className="text-sm">No hay plantillas creadas</p>
          <button onClick={openCreate} className="text-xs text-primary-600 mt-1 hover:underline">
            Crear la primera plantilla →
          </button>
        </div>
      )}

      {modalOpen && (
        <TemplateModal
          editing={editTarget}
          onClose={() => setModalOpen(false)}
          onSaved={onSaved}
        />
      )}
    </div>
  )
}

// ── Import modal ───────────────────────────────────────────────────────────────

type ImportMode = 'siigo' | 'contactos'

const SIIGO_STEPS     = ['Seleccionar empresa', 'Cargar archivo', 'Previsualizar', 'Importar']
const CONTACTOS_STEPS = ['Cargar archivo', 'Confirmar', 'Importar']

const CONTACT_COLS = [
  { col: 'A', label: 'Empresa',              desc: 'Nombre largo de la empresa' },
  { col: 'B', label: 'Abreviatura',           desc: 'Nombre corto o sigla' },
  { col: 'C', label: 'Asesor',                desc: 'Siglas del asesor asignado' },
  { col: 'D', label: 'NIT / Celular',         desc: 'NIT para matching · Celular → teléfono', highlight: true },
  { col: 'E', label: 'Email Facturación',     desc: 'Correo del área de facturación' },
  { col: 'F', label: 'Contacto Comercial',    desc: 'Nombre del contacto comercial' },
  { col: 'G', label: 'Email Comercial',       desc: 'Correo del contacto comercial' },
  { col: 'H', label: 'Contacto Tesorería',    desc: 'Nombre del contacto de tesorería' },
  { col: 'I', label: 'Email Tesorería',       desc: 'Correo del contacto de tesorería' },
]

function StepBar({ steps, step }: { steps: string[]; step: number }) {
  return (
    <div className="flex items-center gap-0 px-6 py-4 border-b border-slate-100 shrink-0">
      {steps.map((label, i) => (
        <div key={i} className="flex items-center flex-1 last:flex-none">
          <div className="flex items-center gap-2 shrink-0">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
              i < step ? 'bg-emerald-500 text-white' : i === step ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-400'
            }`}>
              {i < step ? '✓' : i + 1}
            </div>
            <span className={`text-xs font-medium hidden sm:block ${i === step ? 'text-slate-900' : 'text-slate-400'}`}>
              {label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className={`flex-1 h-px mx-3 ${i < step ? 'bg-emerald-400' : 'bg-slate-200'}`} />
          )}
        </div>
      ))}
    </div>
  )
}

function FileDropZone({
  file, onFile, onClear, accept, hint,
}: {
  file: File | null
  onFile: (f: File) => void
  onClear: () => void
  accept: string
  hint: string
}) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div className="space-y-3">
      <div
        onClick={() => ref.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) onFile(f) }}
        className="border-2 border-dashed border-slate-300 rounded-2xl p-10 text-center cursor-pointer hover:border-primary-400 hover:bg-primary-50/40 transition-colors">
        <div className="text-4xl mb-3">📂</div>
        {file ? (
          <>
            <p className="text-sm font-semibold text-slate-800">{file.name}</p>
            <p className="text-xs text-slate-400 mt-1">{(file.size / 1024).toFixed(0)} KB</p>
          </>
        ) : (
          <>
            <p className="text-sm font-medium text-slate-600">Arrastra el archivo aquí o haz clic para seleccionar</p>
            <p className="text-xs text-slate-400 mt-1">{hint}</p>
          </>
        )}
        <input ref={ref} type="file" accept={accept} className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f) }} />
      </div>
      {file && (
        <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
          <span className="text-emerald-500 text-lg">✅</span>
          <div>
            <p className="text-sm font-medium text-emerald-800">{file.name}</p>
            <p className="text-xs text-emerald-600">Archivo listo</p>
          </div>
          <button onClick={onClear} className="ml-auto text-slate-400 hover:text-red-500">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}

function ResultPanel({ result }: { result: { imported: number; skipped: number; errors: string[] }; onClose: () => void }) {
  return (
    <div className="space-y-4 text-center py-4">
      <div className="text-5xl mb-2">🎉</div>
      <h4 className="text-lg font-bold text-slate-900">¡Importación completada!</h4>
      <div className="grid grid-cols-3 gap-3 mt-4">
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <p className="text-2xl font-bold text-emerald-700">{result.imported}</p>
          <p className="text-xs text-emerald-600 mt-0.5">Actualizados</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-2xl font-bold text-amber-700">{result.skipped}</p>
          <p className="text-xs text-amber-600 mt-0.5">Sin cambios</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-2xl font-bold text-red-700">{result.errors?.length ?? 0}</p>
          <p className="text-xs text-red-600 mt-0.5">Errores</p>
        </div>
      </div>
      {result.errors?.length > 0 && (
        <div className="text-left mt-3 border border-red-200 rounded-xl p-3 bg-red-50 max-h-32 overflow-y-auto">
          {result.errors.map((err, i) => <p key={i} className="text-xs text-red-600">• {err}</p>)}
        </div>
      )}
    </div>
  )
}

function ImportModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [mode,      setMode]      = useState<ImportMode>('siigo')
  const [step,      setStep]      = useState(0)
  const [companyId, setCompanyId] = useState('')
  const [file,      setFile]      = useState<File | null>(null)
  const [preview,   setPreview]   = useState<{ headers: string[]; rows: string[][] } | null>(null)
  const [importing, setImporting] = useState(false)
  const [result,    setResult]    = useState<{ imported: number; skipped: number; errors: string[] } | null>(null)

  const steps = mode === 'siigo' ? SIIGO_STEPS : CONTACTOS_STEPS
  const done  = !!result

  const { data: companies } = useQuery({
    queryKey: ['companies-list'],
    queryFn: async () => { const { data } = await api.get('/api/companies?limit=100'); return data },
  })
  const companyList: any[] = companies?.data ?? []

  const switchMode = (m: ImportMode) => {
    setMode(m); setStep(0); setFile(null); setPreview(null); setResult(null); setCompanyId('')
  }

  const parseCsvPreview = (f: File) => {
    const reader = new FileReader()
    reader.onload = e => {
      const text = e.target?.result as string
      const lines = text.trim().split('\n').map(l => l.split(',').map(c => c.trim().replace(/^"|"$/g, '')))
      setPreview({ headers: lines[0] ?? [], rows: lines.slice(1, 6) })
    }
    reader.readAsText(f)
  }

  const handleSiigoFile = (f: File) => { setFile(f); parseCsvPreview(f) }

  const handleImportSiigo = async () => {
    if (!file) return
    setImporting(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      if (companyId) fd.append('company_id', companyId)
      const { data: res } = await api.post('/api/collection/debtors/import', fd)
      setResult(res); setStep(3); onDone()
    } catch (e: any) {
      toast.error(e.response?.data?.error ?? 'Error al importar')
    } finally { setImporting(false) }
  }

  const handleImportContactos = async () => {
    if (!file) return
    setImporting(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const { data: res } = await api.post('/api/collection/contacts/import', fd)
      setResult(res); setStep(2); onDone()
    } catch (e: any) {
      toast.error(e.response?.data?.error ?? 'Error al importar contactos')
    } finally { setImporting(false) }
  }

  const canContinue = () => {
    if (mode === 'siigo') {
      if (step === 0) return !!companyId
      if (step === 1) return !!file
    } else {
      if (step === 0) return !!file
    }
    return true
  }

  const handleContinue = () => {
    if (mode === 'siigo' && step === 2)  { handleImportSiigo();    return }
    if (mode === 'contactos' && step === 1) { handleImportContactos(); return }
    setStep(s => s + 1)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">

        {/* Header con toggle */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
            <button
              onClick={() => switchMode('siigo')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                mode === 'siigo' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'
              }`}>
              📊 Importar Siigo
            </button>
            <button
              onClick={() => switchMode('contactos')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                mode === 'contactos' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'
              }`}>
              📞 Importar contactos
            </button>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 ml-4">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step bar */}
        <StepBar steps={steps} step={step} />

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6">

          {/* ── SIIGO ── */}
          {mode === 'siigo' && (
            <>
              {/* Paso 0: empresa */}
              {step === 0 && (
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-bold text-slate-700 mb-0.5">Paso 1 — Empresa</h4>
                    <p className="text-slate-500 text-sm">¿Para qué empresa es este reporte?</p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Empresa cliente <span className="text-red-500">*</span>
                    </label>
                    <select value={companyId} onChange={e => setCompanyId(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white">
                      <option value="">Seleccionar empresa...</option>
                      {companyList.map((c: any) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-500 space-y-1">
                    <p className="font-semibold text-slate-700 mb-2">Columnas esperadas en el CSV de Siigo:</p>
                    {['Cliente identificacion', 'Nombre vendedor', 'Cliente nombre', 'Fecha factura', 'Numero', 'Rango vencimiento', 'Moneda', 'Total factura original', 'Saldo actual COP'].map(c => (
                      <p key={c}>· {c}</p>
                    ))}
                  </div>
                </div>
              )}

              {/* Paso 1: archivo */}
              {step === 1 && (
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-bold text-slate-700 mb-0.5">Paso 2 — Archivo</h4>
                    <p className="text-slate-500 text-sm">Carga el CSV exportado desde Siigo (Cartera por vencer / vencida).</p>
                  </div>
                  <FileDropZone
                    file={file} onFile={handleSiigoFile} onClear={() => { setFile(null); setPreview(null) }}
                    accept=".csv" hint="Solo archivos .csv exportados desde Siigo" />
                </div>
              )}

              {/* Paso 2: preview */}
              {step === 2 && preview && (
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-bold text-slate-700 mb-0.5">Paso 3 — Vista previa</h4>
                    <p className="text-slate-500 text-sm">Primeras 5 filas del archivo. Revisa antes de importar.</p>
                  </div>
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200">
                            {preview.headers.map((h, i) => (
                              <th key={i} className="text-left px-3 py-2.5 font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {preview.rows.map((row, i) => (
                            <tr key={i} className="hover:bg-slate-50">
                              {row.map((cell, j) => (
                                <td key={j} className="px-3 py-2 text-slate-600 whitespace-nowrap">{cell || '—'}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400">Máx. 5 filas de previsualización · {file?.name}</p>
                </div>
              )}

              {/* Paso 3: resultado */}
              {step === 3 && result && <ResultPanel result={result} onClose={onClose} />}
            </>
          )}

          {/* ── CONTACTOS ── */}
          {mode === 'contactos' && (
            <>
              {/* Paso 0: cargar Excel */}
              {step === 0 && (
                <div className="space-y-5">
                  <div>
                    <h4 className="text-sm font-bold text-slate-700 mb-0.5">Importar datos de contacto</h4>
                    <p className="text-slate-500 text-sm">Actualiza teléfono, WhatsApp y email de deudores existentes en cartera usando su NIT como clave de matching.</p>
                  </div>

                  <FileDropZone
                    file={file} onFile={f => setFile(f)} onClear={() => setFile(null)}
                    accept=".xlsx,.xls" hint="Archivo Excel (.xlsx) con la estructura de contactos" />

                  {/* Estructura esperada */}
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Estructura esperada del Excel</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {CONTACT_COLS.map(({ col, label, desc, highlight }) => (
                        <div key={col} className={`flex items-start gap-3 p-3 rounded-xl border ${
                          highlight ? 'bg-primary-50 border-primary-200' : 'bg-slate-50 border-slate-200'
                        }`}>
                          <span className={`inline-flex items-center justify-center w-6 h-6 rounded-md text-xs font-bold shrink-0 ${
                            highlight ? 'bg-primary-600 text-white' : 'bg-slate-200 text-slate-600'
                          }`}>
                            {col}
                          </span>
                          <div className="min-w-0">
                            <p className={`text-xs font-semibold leading-tight ${highlight ? 'text-primary-800' : 'text-slate-700'}`}>{label}</p>
                            <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Paso 1: confirmar */}
              {step === 1 && (
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-bold text-slate-700 mb-0.5">Paso 2 — Confirmar importación</h4>
                    <p className="text-slate-500 text-sm">El sistema actualizará teléfono, WhatsApp y emails de los deudores encontrados por NIT.</p>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 space-y-2">
                    <p className="font-semibold">⚠️ Esta acción sobrescribirá los datos de contacto existentes.</p>
                    <p className="text-xs text-amber-700">Deudores no encontrados por NIT serán omitidos sin error.</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center gap-3">
                    <span className="text-2xl">📄</span>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{file?.name}</p>
                      <p className="text-xs text-slate-400">{file ? `${(file.size / 1024).toFixed(0)} KB · Excel` : ''}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Paso 2: resultado */}
              {step === 2 && result && <ResultPanel result={result} onClose={onClose} />}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 shrink-0">
          <button
            onClick={() => (step === 0 || done) ? onClose() : setStep(s => s - 1)}
            disabled={done}
            className="text-sm text-slate-500 hover:text-slate-700 disabled:opacity-0 transition-colors">
            ← Volver
          </button>

          <div className="flex gap-2">
            {done ? (
              <Button onClick={onClose}>Cerrar</Button>
            ) : (
              <Button onClick={handleContinue} loading={importing} disabled={!canContinue()}>
                {(mode === 'siigo' && step === 2) || (mode === 'contactos' && step === 1)
                  ? 'Importar ahora'
                  : `Continuar → ${steps[step + 1]}`}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export function CollectionPage() {
  const [search,     setSearch]     = useState('')
  const [status,     setStatus]     = useState('')
  const [page,       setPage]       = useState(1)
  const [tab,        setTab]        = useState<TabKey>('active')
  const [selected,   setSelected]   = useState<string[]>([])
  const [showImport, setShowImport] = useState(false)
  const [viewDebtorId, setViewDebtorId] = useState<string | null>(null)
  const [companyId,  setCompanyId]  = useState('')
  const qc = useQueryClient()

  const { data: companies } = useQuery({
    queryKey: ['companies-list'],
    queryFn: async () => { const { data } = await api.get('/api/companies?limit=100'); return data },
    staleTime: 300_000,
  })
  const companyList: any[] = companies?.data ?? []

  const { data: stats } = useQuery({
    queryKey: ['collection-stats', companyId],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (companyId) params.set('company_id', companyId)
      const { data } = await api.get(`/api/collection/stats${companyId ? `?${params}` : ''}`)
      return data
    },
    staleTime: 60_000,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['debtors', search, status, page, tab, companyId],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      if (search)    params.set('search', search)
      if (companyId) params.set('company_id', companyId)
      if (tab === 'paid')        params.set('status', 'paid')
      else if (tab === 'gestion') params.set('status', 'in_collection')
      else if (status)           params.set('status', status)
      const { data } = await api.get(`/api/collection/debtors?${params}`)
      return data
    },
    staleTime: 30_000,
    enabled: ['active','paid','gestion'].includes(tab),
  })

  const rows: any[] = data?.data ?? []

  const toggleSelect = (id: string) =>
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const toggleAll = () =>
    setSelected(prev => prev.length === rows.length ? [] : rows.map(r => r.id))

  const TABS: { key: TabKey; label: string; count?: number }[] = [
    { key: 'active',     label: 'Cartera activa',  count: stats?.active },
    { key: 'paid',       label: 'Pagados',          count: stats?.paid },
    { key: 'gestion',    label: 'Gestión del día',  count: stats?.inCollection },
    { key: 'masivo',     label: 'Envío masivo' },
    { key: 'plantillas', label: 'Plantillas' },
  ]

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar title="Cobranza" subtitle="Gestión de deudores y cartera" />

      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5">

        {/* KPIs fila 1 */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <KpiCard icon={Users}        iconBg="bg-slate-500"   label="Total deudores"
            value={stats?.total ?? '—'}
            sub={stats ? `${stats.active} activos · ${stats.paid} pagados` : undefined} />
          <KpiCard icon={DollarSign}   iconBg="bg-red-500"     label="Saldo vencido"
            value={stats ? formatCurrency(stats.saldoVencido) : '—'}
            sub={stats ? `${stats.mora91} con mora 91+` : undefined} subColor="text-red-500" />
          <KpiCard icon={PhoneOff}     iconBg="bg-amber-500"   label="Sin contacto"
            value={stats?.noContact ?? '—'} sub="Sin teléfono ni email" />
          <KpiCard icon={Handshake}    iconBg="bg-yellow-500"  label="Acuerdos activos"
            value={stats?.acuerdosActivos ?? '—'} sub="0 incumplidos" />
          <KpiCard icon={ClipboardList} iconBg="bg-primary-500" label="Tareas hoy"
            value={stats?.tasksHoy ?? '—'}
            sub={stats ? `${stats.tasksVencidas} vencidas` : undefined}
            subColor={stats?.tasksVencidas ? 'text-red-500' : 'text-slate-400'} />
        </div>

        {/* KPIs fila 2 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Contactabilidad</p>
            <p className={`text-3xl font-bold ${(stats?.contactabilidad ?? 0) < 20 ? 'text-red-500' : 'text-emerald-600'}`}>
              {stats?.contactabilidad ?? 0}%
            </p>
            <p className="text-xs text-slate-400 mt-1">{stats ? `${stats.active} de ${stats.total} gestionados` : '—'}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Efectividad</p>
            <p className="text-3xl font-bold text-emerald-600">{stats?.efectividad ?? 0}%</p>
            <p className="text-xs text-slate-400 mt-1">{stats ? `${stats.paid} pagados de ${stats.active + stats.paid} contactados` : '—'}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Deudores activos</p>
            <p className="text-3xl font-bold text-slate-900">{stats?.active ?? '—'}</p>
            <p className="text-xs text-slate-400 mt-1">{stats ? `de ${stats.total} en cartera` : '—'}</p>
          </div>
        </div>

        {/* Tabla principal */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-slate-100">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Collection_Debtors</p>
              <h3 className="text-base font-bold text-slate-900">Cartera de cobranza</h3>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={companyId}
                onChange={e => { setCompanyId(e.target.value); setPage(1) }}
                className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white max-w-[180px]">
                <option value="">Todas las empresas</option>
                {companyList.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <button
                onClick={() => setShowImport(true)}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors">
                <Upload className="w-3.5 h-3.5" />
                Importar Siigo
              </button>
              <Button size="sm"><Plus className="w-3.5 h-3.5" /> Nuevo deudor</Button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 px-5 py-2 border-b border-slate-100 overflow-x-auto">
            {TABS.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  tab === t.key ? 'bg-amber-400 text-slate-900' : 'text-slate-500 hover:bg-slate-100'
                }`}>
                {t.label}
                {t.count !== undefined && (
                  <span className={`text-[10px] font-bold rounded-full px-1.5 py-0.5 ${tab === t.key ? 'bg-slate-900/20' : 'bg-slate-200 text-slate-600'}`}>
                    {t.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Panels */}
          {tab === 'masivo'     && <MasivoPanel companyId={companyId} />}
          {tab === 'plantillas' && <PlantillasPanel />}

          {/* Debtors table */}
          {['active','paid','gestion'].includes(tab) && (
            <>
              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-2 px-5 py-3 border-b border-slate-100 flex-wrap">
                <div className="relative flex-1 min-w-0 sm:max-w-xs">
                  <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
                    placeholder="Buscar deudor, documento…"
                    className="w-full pl-4 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
                <select value={status} onChange={e => { setStatus(e.target.value); setPage(1) }}
                  className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500">
                  <option value="">Todos los estados</option>
                  {Object.entries(STATUS_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
                <select className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500">
                  <option>Todos (Contacto)</option>
                  <option>Con teléfono</option>
                  <option>Con email</option>
                  <option>Sin contacto</option>
                </select>
                <button className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 border border-slate-200 rounded-lg px-3 py-1.5 hover:bg-slate-50">
                  Antigüedad <ArrowUpDown className="w-3 h-3" />
                </button>
                <button className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 border border-slate-200 rounded-lg px-3 py-1.5 hover:bg-slate-50">
                  Mora <ArrowUpDown className="w-3 h-3" />
                </button>
                <button className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 border border-slate-200 rounded-lg px-3 py-1.5 hover:bg-slate-50">
                  Saldo <ArrowUpDown className="w-3 h-3" />
                </button>
              </div>

              {isLoading ? (
                <div className="py-12 flex justify-center"><PageLoader /></div>
              ) : (
                <>
                  {/* Mobile cards */}
                  <div className="md:hidden divide-y divide-slate-50">
                    {rows.map((d: any) => {
                      const s = STATUS_LABELS[d.status] ?? { label: d.status, color: 'gray' }
                      const saldo = d.outstanding_balance ?? d.collection_debts?.reduce((a: number, x: any) => a + (x.outstanding_amount ?? 0), 0) ?? 0
                      const days  = d.days_overdue ?? 0
                      return (
                        <div key={d.id} className="px-5 py-4 space-y-1.5">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold text-slate-900">{d.debtor_name}</p>
                              <p className="text-xs text-slate-400">{d.debtor_document}</p>
                            </div>
                            <Badge label={s.label} color={s.color} />
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className={getTramoColor(days)}>{getTramo(days)}</span>
                            <span className="font-bold text-slate-800">{formatCurrency(saldo)}</span>
                          </div>
                          {(d.phone || d.email) && (
                            <div className="flex flex-wrap gap-3 text-xs text-slate-400">
                              {d.phone && <span>📱 {d.phone}</span>}
                              {d.email && <span className="truncate">✉️ {d.email}</span>}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {/* Desktop table */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50">
                          <th className="px-4 py-3 w-8">
                            <input type="checkbox"
                              checked={selected.length === rows.length && rows.length > 0}
                              onChange={toggleAll} className="rounded border-slate-300" />
                          </th>
                          {['DEUDOR','EMPRESA','FACTURAS','ANTIGÜEDAD','SALDO VENCIDO','TRAMOS','CONTACTO','ESTADO','ACCIONES'].map(h => (
                            <th key={h} className={`${h === 'ACCIONES' ? 'text-right' : 'text-left'} px-3 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider`}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {rows.map((d: any) => {
                          const s = STATUS_LABELS[d.status] ?? { label: d.status, color: 'gray' }
                          const saldo = d.outstanding_balance ?? d.collection_debts?.reduce((a: number, x: any) => a + (x.outstanding_amount ?? 0), 0) ?? 0
                          const days  = d.days_overdue ?? 0
                          return (
                            <tr key={d.id} className="hover:bg-slate-50 transition-colors group">
                              <td className="px-4 py-3">
                                <input type="checkbox" checked={selected.includes(d.id)}
                                  onChange={() => toggleSelect(d.id)} className="rounded border-slate-300" />
                              </td>
                              <td className="px-3 py-3">
                                <p className="font-medium text-slate-900">{d.debtor_name}</p>
                                <p className="text-xs text-slate-400 font-mono">{d.debtor_document}</p>
                              </td>
                              <td className="px-3 py-3 text-xs text-slate-500">{d.company?.name ?? '—'}</td>
                              <td className="px-3 py-3 text-xs text-slate-500">{d.collection_debts?.length ?? 0} fact.</td>
                              <td className="px-3 py-3 text-xs">
                                {days > 0
                                  ? <span className={getTramoColor(days)}>{days} días</span>
                                  : <span className="text-slate-400">—</span>}
                              </td>
                              <td className="px-3 py-3 font-semibold text-slate-900">{formatCurrency(saldo)}</td>
                              <td className="px-3 py-3 text-xs">
                                <span className={getTramoColor(days)}>{getTramo(days)}</span>
                              </td>
                              <td className="px-3 py-3 text-xs">
                                <div className="space-y-0.5">
                                  {d.phone && <p className="text-slate-500">📱 {d.phone}</p>}
                                  {d.email && <p className="text-slate-400 truncate max-w-[130px]">{d.email}</p>}
                                  {!d.phone && !d.email && <span className="text-red-400">Sin contacto</span>}
                                </div>
                              </td>
                              <td className="px-3 py-3"><Badge label={s.label} color={s.color} /></td>
                              <td className="px-3 py-3 text-right">
                                <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button onClick={() => setViewDebtorId(d.id)}
                                    className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-primary-600 transition-colors"
                                    title="Ver detalle">
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                  <button className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                                    title="Editar">
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => toast('¿Eliminar este deudor?', {
                                      action: { label: 'Eliminar', onClick: () => {
                                        api.delete(`/api/collection/debtors/${d.id}`).then(() => {
                                          toast.success('Deudor eliminado')
                                          qc.invalidateQueries({ queryKey: ['debtors'] })
                                        }).catch(() => toast.error('Error al eliminar'))
                                      }},
                                      cancel: { label: 'Cancelar', onClick: () => {} },
                                      duration: 8000,
                                    })}
                                    className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                                    title="Eliminar">
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                        {!rows.length && (
                          <tr><td colSpan={10} className="px-6 py-12 text-center text-slate-400">No se encontraron deudores</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {data && data.total > 20 && (
                    <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between text-sm text-slate-500">
                      <span>Página {page} de {Math.ceil(data.total / 20)}</span>
                      <div className="flex gap-2">
                        <Button variant="secondary" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Anterior</Button>
                        <Button variant="secondary" size="sm" disabled={page >= Math.ceil(data.total / 20)} onClick={() => setPage(p => p + 1)}>Siguiente</Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>

      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onDone={() => {
            qc.invalidateQueries({ queryKey: ['debtors'] })
            qc.invalidateQueries({ queryKey: ['collection-stats'] })
            setShowImport(false)
          }}
        />
      )}

      {viewDebtorId && (
        <DebtorDrawer
          id={viewDebtorId}
          onClose={() => setViewDebtorId(null)}
        />
      )}
    </div>
  )
}
