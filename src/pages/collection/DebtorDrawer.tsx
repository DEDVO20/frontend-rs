import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { formatDate, formatCurrency } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { toast } from 'sonner'
import {
  X, Phone, Mail, User, FileText, Handshake,
  ClipboardList, History, Plus, Calendar,
} from 'lucide-react'

const CHANNEL_LABELS: Record<string, string> = {
  phone: 'Teléfono', whatsapp: 'WhatsApp', email: 'Email', sms: 'SMS', manual: 'Manual',
}

const RESULT_LABELS: Record<string, string> = {
  contacted:           'Contactado',
  no_answer:           'No contestó',
  wrong_number:        'Número equivocado',
  bounced_email:       'Email rebotado',
  whatsapp_unavailable:'WhatsApp no disponible',
  requested_extension: 'Solicitó extensión',
  payment_promise:     'Promesa de pago',
  payment_agreement:   'Acuerdo de pago',
  partial_payment:     'Pago parcial',
  paid:                'Pagado',
  rejected:            'Rechazó pago',
  uncontactable:       'No contactable',
}

const STATUS_LABELS: Record<string, { label: string; color: any }> = {
  pending:        { label: 'Pendiente',      color: 'gray' },
  in_collection:  { label: 'En gestión',     color: 'blue' },
  promised:       { label: 'Prometido',      color: 'yellow' },
  agreement:      { label: 'Acuerdo',        color: 'teal' },
  partially_paid: { label: 'Pago parcial',   color: 'orange' },
  paid:           { label: 'Pagado',         color: 'green' },
  defaulted:      { label: 'En mora',        color: 'red' },
  uncontactable:  { label: 'No contactable', color: 'gray' },
}

function getTramoColor(days: number) {
  if (days >= 91) return 'text-red-600'
  if (days >= 61) return 'text-orange-500'
  if (days >= 31) return 'text-amber-500'
  if (days >= 1)  return 'text-yellow-600'
  return 'text-slate-400'
}

function getTramo(days: number) {
  if (days >= 91) return '91+ días'
  if (days >= 61) return '61-90 días'
  if (days >= 31) return '31-60 días'
  if (days >= 1)  return '1-30 días'
  return 'Al día'
}

function getMaxTramo(d: any): number {
  if (d.prev_max_tramo) return d.prev_max_tramo
  const debts: any[] = d.collection_debts ?? []
  if (debts.some((x: any) => (x.overdue_91_plus ?? 0) > 0)) return 91
  if (debts.some((x: any) => (x.overdue_61_90 ?? 0) > 0))   return 61
  if (debts.some((x: any) => (x.overdue_31_60 ?? 0) > 0))   return 31
  if (debts.some((x: any) => (x.overdue_1_30  ?? 0) > 0))   return 1
  return 0
}

type Tab = 'info' | 'debts' | 'agreements' | 'tasks' | 'actions'

interface Props { id: string; onClose: () => void }

export function DebtorDrawer({ id, onClose }: Props) {
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('info')
  const [showActionForm, setShowActionForm] = useState(false)
  const [actionForm, setActionForm] = useState({ channel: 'phone', result: 'contacted', notes: '' })
  const [showAgreementForm, setShowAgreementForm] = useState(false)
  const [agreementForm, setAgreementForm] = useState({ type: 'promise', promised_amount: 0, total_amount: 0, installment_count: 1, notes: '' })
  const [showTaskForm, setShowTaskForm] = useState(false)
  const [taskForm, setTaskForm] = useState({ title: '', due_date: '', priority: 'medium', description: '' })

  const { data: debtor, isLoading } = useQuery({
    queryKey: ['debtor-detail', id],
    queryFn: async () => { const { data } = await api.get(`/api/collection/debtors/${id}`); return data },
  })

  const { data: agreements } = useQuery({
    queryKey: ['debtor-agreements', id],
    queryFn: async () => { const { data } = await api.get(`/api/collection/debtors/${id}/agreements`); return data },
    enabled: tab === 'agreements',
  })

  const { data: tasks } = useQuery({
    queryKey: ['debtor-tasks', id],
    queryFn: async () => { const { data } = await api.get(`/api/collection/tasks?debtor_id=${id}`); return data },
    enabled: tab === 'tasks',
  })

  const { data: actions } = useQuery({
    queryKey: ['debtor-actions', id],
    queryFn: async () => { const { data } = await api.get(`/api/collection/actions?debtor_id=${id}`); return data },
    enabled: tab === 'actions',
  })

  const createAgreement = useMutation({
    mutationFn: async () => {
      await api.post('/api/collection/agreements', { debtor_id: id, ...agreementForm })
    },
    onSuccess: () => {
      toast.success('Acuerdo creado')
      qc.invalidateQueries({ queryKey: ['debtor-agreements', id] })
      setShowAgreementForm(false)
      setAgreementForm({ type: 'promise', promised_amount: 0, total_amount: 0, installment_count: 1, notes: '' })
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Error'),
  })

  const createTask = useMutation({
    mutationFn: async () => {
      const body: any = { debtor_id: id, title: taskForm.title, priority: taskForm.priority }
      if (taskForm.due_date) body.due_date = taskForm.due_date
      if (taskForm.description) body.description = taskForm.description
      await api.post('/api/collection/tasks', body)
    },
    onSuccess: () => {
      toast.success('Tarea creada')
      qc.invalidateQueries({ queryKey: ['debtor-tasks', id] })
      setShowTaskForm(false)
      setTaskForm({ title: '', due_date: '', priority: 'medium', description: '' })
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Error'),
  })

  const createAction = useMutation({
    mutationFn: async () => {
      await api.post('/api/collection/actions', { debtor_id: id, ...actionForm })
    },
    onSuccess: () => {
      toast.success('Gestión registrada')
      qc.invalidateQueries({ queryKey: ['debtor-actions', id] })
      setShowActionForm(false)
      setActionForm({ channel: 'phone', result: 'contacted', notes: '' })
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Error'),
  })

  const d = debtor
  const debts: any[] = d?.collection_debts ?? []
  const saldo = debts.reduce((a: number, x: any) => a + (x.outstanding_amount ?? 0), 0)
  const maxTramo = d ? getMaxTramo(d) : 0
  const st = STATUS_LABELS[d?.status] ?? { label: d?.status, color: 'gray' }

  const TABS: { key: Tab; label: string; icon: any }[] = [
    { key: 'info',       label: 'Detalle',    icon: User },
    { key: 'debts',      label: 'Facturas',   icon: FileText },
    { key: 'agreements', label: 'Acuerdos',   icon: Handshake },
    { key: 'tasks',      label: 'Seguimiento', icon: ClipboardList },
    { key: 'actions',    label: 'Historial',  icon: History },
  ]

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full max-w-2xl bg-white z-50 shadow-2xl flex flex-col overflow-hidden">

        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 shrink-0">
          {isLoading ? (
            <div className="h-12 bg-slate-200 rounded animate-pulse" />
          ) : (
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary-500 flex items-center justify-center text-white font-bold text-lg shrink-0">
                  {(d?.debtor_name ?? '?')[0]!.toUpperCase()}{(d?.debtor_name ?? '??')[1]?.toUpperCase() ?? ''}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <Badge label={st.label} color={st.color} />
                  </div>
                  <h2 className="text-lg font-bold text-slate-900">{d?.debtor_name}</h2>
                  <p className="text-xs text-slate-400">{d?.debtor_document} · {d?.company?.name ?? '—'}</p>
                </div>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500">
                <X className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>

        {/* Tramo summary bar */}
        {d && (
          <div className="grid grid-cols-5 gap-0 border-b border-slate-100 bg-white shrink-0">
            {[
              { label: '1–30 días', value: debts.reduce((a: number, x: any) => a + (x.overdue_1_30 ?? 0), 0) },
              { label: '31–60 días', value: debts.reduce((a: number, x: any) => a + (x.overdue_31_60 ?? 0), 0) },
              { label: '61–90 días', value: debts.reduce((a: number, x: any) => a + (x.overdue_61_90 ?? 0), 0) },
              { label: '91+ días', value: debts.reduce((a: number, x: any) => a + (x.overdue_91_plus ?? 0), 0) },
              { label: 'Saldo vencido', value: saldo },
            ].map((b, i) => (
              <div key={i} className="text-center px-2 py-3 border-r border-slate-100 last:border-0">
                <p className="text-[10px] font-medium text-slate-400">{b.label}</p>
                <p className={`text-sm font-bold ${i === 4 ? 'text-red-600' : b.value > 0 ? getTramoColor(i === 0 ? 1 : i === 1 ? 31 : i === 2 ? 61 : 91) : 'text-slate-300'}`}>
                  {formatCurrency(b.value)}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-0 border-b border-slate-100 bg-white shrink-0 px-4">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                tab === t.key ? 'border-primary-500 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {tab === 'info' && d && (
            <>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                <InfoRow label="Antigüedad" value={getTramo(maxTramo)} className={getTramoColor(maxTramo)} />
                <InfoRow label="Ciudad" value={d.city ?? '—'} />
                <InfoRow label="Gestor" value={d.assigned_user?.full_name ?? 'Admin RS'} />
                <InfoRow label="Teléfono" value={d.phone ?? '—'} />
                <InfoRow label="Celular" value={d.whatsapp ?? d.phone ?? '—'} />
                <InfoRow label="Email" value={d.email ?? '—'} />
              </div>

              <div className="flex gap-2 pt-2">
                <Button size="sm" onClick={() => { setTab('actions'); setShowActionForm(true) }}>
                  <Plus className="w-3.5 h-3.5" /> Gestión
                </Button>
                {(d.phone || d.whatsapp) && (
                  <a href={`tel:${d.phone ?? d.whatsapp}`}>
                    <Button size="sm" variant="secondary"><Phone className="w-3.5 h-3.5" /> Llamar</Button>
                  </a>
                )}
                {d.email && (
                  <a href={`mailto:${d.email}`}>
                    <Button size="sm" variant="secondary"><Mail className="w-3.5 h-3.5" /> Email</Button>
                  </a>
                )}
              </div>
            </>
          )}

          {tab === 'debts' && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">Facturas</h3>
                <span className="text-xs text-slate-400">{debts.length} facturas</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      {['Factura', 'Vence', '1–30', '31–60', '61–90', '91+', 'Total', 'Est.'].map(h => (
                        <th key={h} className="text-left px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {debts.map((debt: any) => (
                      <tr key={debt.id ?? debt.siigo_document} className="hover:bg-slate-50">
                        <td className="px-3 py-2 font-medium text-slate-900">{debt.siigo_document ?? '—'}</td>
                        <td className="px-3 py-2 text-xs text-slate-500">{debt.due_date ? formatDate(debt.due_date) : '—'}</td>
                        <td className="px-3 py-2 text-xs">{debt.overdue_1_30 ? formatCurrency(debt.overdue_1_30) : '—'}</td>
                        <td className="px-3 py-2 text-xs">{debt.overdue_31_60 ? formatCurrency(debt.overdue_31_60) : '—'}</td>
                        <td className="px-3 py-2 text-xs">{debt.overdue_61_90 ? formatCurrency(debt.overdue_61_90) : '—'}</td>
                        <td className="px-3 py-2 text-xs">{debt.overdue_91_plus ? formatCurrency(debt.overdue_91_plus) : '—'}</td>
                        <td className="px-3 py-2 font-semibold text-slate-900">{formatCurrency(debt.outstanding_amount ?? debt.total_balance ?? 0)}</td>
                        <td className="px-3 py-2">
                          <span className={`text-xs font-medium ${(debt.outstanding_amount ?? 0) > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                            {(debt.outstanding_amount ?? 0) > 0 ? 'Activa' : 'Pagada'}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {!debts.length && (
                      <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">Sin facturas</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'agreements' && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">Acuerdos de pago</h3>
                <Button size="sm" onClick={() => setShowAgreementForm(!showAgreementForm)}>
                  <Plus className="w-3.5 h-3.5" /> Nuevo
                </Button>
              </div>

              {showAgreementForm && (
                <div className="px-4 py-4 border-b border-slate-100 bg-slate-50 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Tipo</label>
                      <select value={agreementForm.type} onChange={e => setAgreementForm(p => ({ ...p, type: e.target.value }))}
                        className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500">
                        <option value="promise">Promesa de pago</option>
                        <option value="installment">Cuotas</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Número de cuotas</label>
                      <input type="number" min={1} value={agreementForm.installment_count}
                        onChange={e => setAgreementForm(p => ({ ...p, installment_count: parseInt(e.target.value) || 1 }))}
                        className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Monto prometido</label>
                      <input type="number" min={0} value={agreementForm.promised_amount}
                        onChange={e => setAgreementForm(p => ({ ...p, promised_amount: parseFloat(e.target.value) || 0 }))}
                        className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Monto total</label>
                      <input type="number" min={0} value={agreementForm.total_amount}
                        onChange={e => setAgreementForm(p => ({ ...p, total_amount: parseFloat(e.target.value) || 0 }))}
                        className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Notas</label>
                    <textarea rows={2} value={agreementForm.notes}
                      onChange={e => setAgreementForm(p => ({ ...p, notes: e.target.value }))}
                      placeholder="Detalles del acuerdo..."
                      className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none" />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => createAgreement.mutate()} loading={createAgreement.isPending}>Guardar</Button>
                    <Button size="sm" variant="secondary" onClick={() => setShowAgreementForm(false)}>Cancelar</Button>
                  </div>
                </div>
              )}

              {(agreements ?? []).length ? (
                <div className="divide-y divide-slate-50">
                  {(agreements ?? []).map((a: any) => (
                    <div key={a.id} className="px-4 py-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-slate-900">
                            {a.type === 'promise' ? 'Promesa de pago' : 'Acuerdo de cuotas'}
                          </p>
                          <p className="text-xs text-slate-400">
                            {formatCurrency(a.total_amount)} · {a.installment_count} cuota{a.installment_count !== 1 ? 's' : ''}
                          </p>
                          {a.notes && <p className="text-xs text-slate-400 mt-0.5">{a.notes}</p>}
                        </div>
                        <Badge label={a.status === 'active' ? 'Activo' : a.status ?? 'Pendiente'} color={a.status === 'active' ? 'green' : 'gray'} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : !showAgreementForm ? (
                <div className="px-4 py-8 text-center">
                  <Handshake className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">Sin acuerdos</p>
                </div>
              ) : null}
            </div>
          )}

          {tab === 'tasks' && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">Tareas</h3>
                <Button size="sm" onClick={() => setShowTaskForm(!showTaskForm)}>
                  <Plus className="w-3.5 h-3.5" /> Tarea
                </Button>
              </div>

              {showTaskForm && (
                <div className="px-4 py-4 border-b border-slate-100 bg-slate-50 space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Título *</label>
                    <input value={taskForm.title} onChange={e => setTaskForm(p => ({ ...p, title: e.target.value }))}
                      placeholder="Ej: Llamar para confirmar pago"
                      className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Fecha vencimiento</label>
                      <input type="date" value={taskForm.due_date}
                        onChange={e => setTaskForm(p => ({ ...p, due_date: e.target.value }))}
                        className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Prioridad</label>
                      <select value={taskForm.priority} onChange={e => setTaskForm(p => ({ ...p, priority: e.target.value }))}
                        className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500">
                        <option value="low">Baja</option>
                        <option value="medium">Media</option>
                        <option value="high">Alta</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Descripción</label>
                    <textarea rows={2} value={taskForm.description}
                      onChange={e => setTaskForm(p => ({ ...p, description: e.target.value }))}
                      placeholder="Detalles de la tarea..."
                      className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none" />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => createTask.mutate()} loading={createTask.isPending} disabled={!taskForm.title.trim()}>Guardar</Button>
                    <Button size="sm" variant="secondary" onClick={() => setShowTaskForm(false)}>Cancelar</Button>
                  </div>
                </div>
              )}

              {(tasks?.data ?? tasks ?? []).length ? (
                <div className="divide-y divide-slate-50">
                  {(tasks?.data ?? tasks ?? []).map((t: any) => {
                    const today = new Date().toISOString().split('T')[0]!
                    const isOverdue = t.status !== 'done' && t.status !== 'completed' && t.due_date && t.due_date < today
                    return (
                      <div key={t.id} className="px-4 py-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-slate-900">{t.title}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              {isOverdue && <span className="text-xs text-red-600 font-medium">🔴 Vencida</span>}
                              {t.due_date && <span className="text-xs text-slate-400">📅 {formatDate(t.due_date)}</span>}
                              <span className={`text-xs font-medium ${t.priority === 'high' ? 'text-red-500' : t.priority === 'medium' ? 'text-amber-500' : 'text-slate-400'}`}>
                                {t.priority === 'high' ? 'Alta' : t.priority === 'medium' ? 'Media' : 'Baja'}
                              </span>
                            </div>
                            {t.description && <p className="text-xs text-slate-400 mt-0.5">{t.description}</p>}
                          </div>
                          <Badge
                            label={t.status === 'done' || t.status === 'completed' ? 'Completada' : isOverdue ? 'Vencida' : 'Pendiente'}
                            color={t.status === 'done' || t.status === 'completed' ? 'green' : isOverdue ? 'red' : 'yellow'}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : !showTaskForm ? (
                <div className="px-4 py-8 text-center">
                  <Calendar className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">Sin tareas</p>
                </div>
              ) : null}
            </div>
          )}

          {tab === 'actions' && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">Historial de gestiones</h3>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">{actions?.data?.length ?? 0} gestiones</span>
                  <Button size="sm" onClick={() => setShowActionForm(!showActionForm)}>
                    <Plus className="w-3.5 h-3.5" /> Registrar gestión
                  </Button>
                </div>
              </div>

              {showActionForm && (
                <div className="px-4 py-4 border-b border-slate-100 bg-slate-50 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Canal</label>
                      <select value={actionForm.channel} onChange={e => setActionForm(p => ({ ...p, channel: e.target.value }))}
                        className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500">
                        <option value="phone">Teléfono</option>
                        <option value="whatsapp">WhatsApp</option>
                        <option value="email">Email</option>
                        <option value="sms">SMS</option>
                        <option value="manual">Manual</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Resultado</label>
                      <select value={actionForm.result} onChange={e => setActionForm(p => ({ ...p, result: e.target.value }))}
                        className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500">
                        <option value="contacted">Contactado</option>
                        <option value="no_answer">No contestó</option>
                        <option value="wrong_number">Número equivocado</option>
                        <option value="payment_promise">Promesa de pago</option>
                        <option value="payment_agreement">Acuerdo de pago</option>
                        <option value="partial_payment">Pago parcial</option>
                        <option value="paid">Pagado</option>
                        <option value="rejected">Rechazó</option>
                        <option value="uncontactable">No contactable</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Notas</label>
                    <textarea rows={2} value={actionForm.notes}
                      onChange={e => setActionForm(p => ({ ...p, notes: e.target.value }))}
                      placeholder="Detalles de la gestión..."
                      className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none" />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => createAction.mutate()} loading={createAction.isPending}>Guardar</Button>
                    <Button size="sm" variant="secondary" onClick={() => setShowActionForm(false)}>Cancelar</Button>
                  </div>
                </div>
              )}

              {(actions?.data ?? []).length ? (
                <div className="divide-y divide-slate-50">
                  {(actions?.data ?? []).map((a: any) => (
                    <div key={a.id} className="px-4 py-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-slate-900">
                            {CHANNEL_LABELS[a.channel] ?? a.channel} · {RESULT_LABELS[a.result] ?? a.result}
                          </p>
                          {a.notes && <p className="text-xs text-slate-400 mt-0.5">{a.notes}</p>}
                        </div>
                        <span className="text-xs text-slate-400">{a.created_at ? formatDate(a.created_at) : '—'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : !showActionForm ? (
                <div className="px-4 py-8 text-center">
                  <History className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">Sin gestiones registradas.</p>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

function InfoRow({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
      <p className={`text-sm font-medium mt-0.5 ${className ?? 'text-slate-900'}`}>{value}</p>
    </div>
  )
}
