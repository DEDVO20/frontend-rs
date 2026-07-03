import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { TopBar } from '@/components/layout/TopBar'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { PageLoader } from '@/components/ui/Spinner'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { toast } from 'sonner'
import {
  Plus, Search, Pencil, Trash2, X, Clock, Repeat,
  CheckCircle2, XCircle, Play,
} from 'lucide-react'

const FREQ_LABELS: Record<string, { label: string; color: any; icon: string }> = {
  daily:     { label: 'Diaria',     color: 'blue',   icon: '📅' },
  weekly:    { label: 'Semanal',    color: 'teal',   icon: '📆' },
  biweekly:  { label: 'Quincenal',  color: 'yellow', icon: '📆' },
  monthly:   { label: 'Mensual',    color: 'green',  icon: '🗓️' },
  quarterly: { label: 'Trimestral', color: 'orange', icon: '📊' },
  semestral: { label: 'Semestral',  color: 'red',    icon: '📊' },
  annual:    { label: 'Anual',      color: 'gray',   icon: '🎯' },
}

const OWNER_LABELS: Record<string, string> = {
  rs_team: '⚙ Equipo Finto',
  client:  '🏢 Cliente',
}

export function TaskTemplatesPage() {
  const qc = useQueryClient()
  const confirm = useConfirm()
  const [search, setSearch] = useState('')
  const [freqFilter, setFreqFilter]    = useState('')
  const [ownerFilter, setOwnerFilter]  = useState('')
  const [serviceFilter, setServiceFilter] = useState('')
  const [activeFilter, setActiveFilter]   = useState('')
  const [docFilter, setDocFilter]         = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState<any | null>(null)

  const { data: templates, isLoading } = useQuery({
    queryKey: ['task-templates'],
    queryFn: async () => { const { data } = await api.get('/api/tasks/templates'); return data },
  })

  const { data: services } = useQuery({
    queryKey: ['all-services'],
    queryFn: async () => { const { data } = await api.get('/api/services?active=true'); return data },
    staleTime: 300_000,
  })

  const deleteMut = useMutation({
    mutationFn: async (id: string) => { await api.delete(`/api/tasks/templates/${id}`) },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['task-templates'] }); toast.success('Plantilla eliminada') },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Error'),
  })

  // Edición inline del "Servicio que entrega" desde la tabla
  const providerMut = useMutation({
    mutationFn: async ({ id, provider_service_id }: { id: string; provider_service_id: string | null }) => {
      await api.patch(`/api/tasks/templates/${id}`, { provider_service_id })
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['task-templates'] }); toast.success('Dependencia actualizada') },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Error'),
  })

  const all: any[] = templates ?? []

  const hasFilters = !!(search || freqFilter || ownerFilter || serviceFilter || activeFilter || docFilter)

  const clearFilters = () => {
    setSearch(''); setFreqFilter(''); setOwnerFilter('')
    setServiceFilter(''); setActiveFilter(''); setDocFilter('')
  }

  const filtered = all.filter(t => {
    if (freqFilter    && t.frequency  !== freqFilter)          return false
    if (ownerFilter   && t.owner_type !== ownerFilter)         return false
    if (serviceFilter && t.service_id !== serviceFilter)       return false
    if (activeFilter  && String(t.active) !== activeFilter)    return false
    if (docFilter     && String(t.requires_document) !== docFilter) return false
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const freqCounts: Record<string, number> = {}
  all.forEach(t => { freqCounts[t.frequency] = (freqCounts[t.frequency] ?? 0) + 1 })

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar title="Tareas recurrentes" subtitle="Plantillas de tareas automáticas" />

      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Plantillas de tareas</h2>
            <p className="text-sm text-slate-400">{all.length} plantillas · Generación automática vía cron</p>
          </div>
          <Button onClick={() => { setEditTarget(null); setShowModal(true) }}>
            <Plus className="w-4 h-4" /> Nueva plantilla
          </Button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {Object.entries(FREQ_LABELS).map(([key, f]) => (
            <button
              key={key}
              onClick={() => setFreqFilter(freqFilter === key ? '' : key)}
              className={`bg-white border rounded-xl p-3 text-center transition-colors ${
                freqFilter === key ? 'border-primary-500 bg-primary-50' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <p className="text-lg">{f.icon}</p>
              <p className="text-2xl font-bold text-slate-900">{freqCounts[key] ?? 0}</p>
              <p className="text-[10px] text-slate-400 font-medium uppercase">{f.label}</p>
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Buscar plantilla..."
                className="w-full pl-10 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>

            <select value={ownerFilter} onChange={e => setOwnerFilter(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white">
              <option value="">Responsable</option>
              <option value="rs_team">⚙ Equipo Finto</option>
              <option value="client">🏢 Cliente</option>
            </select>

            <select value={serviceFilter} onChange={e => setServiceFilter(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white">
              <option value="">Servicio</option>
              {(services ?? []).map((s: any) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>

            <select value={activeFilter} onChange={e => setActiveFilter(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white">
              <option value="">Estado</option>
              <option value="true">Activa</option>
              <option value="false">Inactiva</option>
            </select>

            <select value={docFilter} onChange={e => setDocFilter(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white">
              <option value="">Documento</option>
              <option value="true">Requiere doc.</option>
              <option value="false">Sin documento</option>
            </select>

            {hasFilters && (
              <button onClick={clearFilters}
                className="text-xs text-slate-500 flex items-center gap-1 hover:text-slate-700 whitespace-nowrap">
                <X className="w-3 h-3" /> Limpiar filtros
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900">Plantillas</h3>
            <span className="text-xs text-slate-400">{filtered.length} de {all.length}</span>
          </div>

          {isLoading ? <div className="py-10"><PageLoader /></div> : (
            <>
              {/* Mobile cards */}
              <div className="md:hidden divide-y divide-slate-50">
                {filtered.map((t: any) => {
                  const f = FREQ_LABELS[t.frequency] ?? { label: t.frequency, color: 'gray', icon: '📋' }
                  return (
                    <div key={t.id} className="px-4 py-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-medium text-slate-900">{t.title}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge label={f.label} color={f.color} />
                            <span className="text-xs text-slate-400">{t.services?.name ?? '—'}</span>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                            {t.create_day && <span>Crea día {t.create_day}</span>}
                            {t.due_day && <span>Vence día {t.due_day}</span>}
                            <span>{OWNER_LABELS[t.owner_type] ?? t.owner_type}</span>
                          </div>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <button onClick={() => { setEditTarget(t); setShowModal(true) }}
                            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><Pencil className="w-3.5 h-3.5" /></button>
                          <button onClick={() => confirm({ title: '¿Eliminar esta plantilla?', type: 'danger', confirmLabel: 'Eliminar', onConfirm: () => deleteMut.mutateAsync(t.id) })}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      {['Tarea', 'Servicio', 'Frecuencia', 'Crea día', 'Vence día', 'Responsable', 'Doc.', 'Estado', ''].map(h => (
                        <th key={h} className={`${h === '' ? 'text-right' : 'text-left'} px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filtered.map((t: any) => {
                      const f = FREQ_LABELS[t.frequency] ?? { label: t.frequency, color: 'gray', icon: '📋' }
                      return (
                        <tr key={t.id} className="hover:bg-slate-50 transition-colors group">
                          <td className="px-4 py-3">
                            <p className="font-medium text-slate-900">{t.title}</p>
                            {t.description && <p className="text-xs text-slate-400 truncate max-w-[200px]">{t.description}</p>}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500">{t.services?.name ?? '—'}</td>
                          <td className="px-4 py-3"><Badge label={`${f.icon} ${f.label}`} color={f.color} /></td>
                          <td className="px-4 py-3 text-xs text-slate-500">{t.create_day ?? '—'}</td>
                          <td className="px-4 py-3 text-xs text-slate-500">{t.due_day ?? '—'}</td>
                          <td className="px-4 py-3 text-xs text-slate-500">
                            {OWNER_LABELS[t.owner_type] ?? t.owner_type}
                            {t.owner_type === 'client' && (
                              <select
                                value={t.provider_service_id ?? ''}
                                onChange={e => providerMut.mutate({ id: t.id, provider_service_id: e.target.value || null })}
                                disabled={providerMut.isPending}
                                onClick={e => e.stopPropagation()}
                                className={`block mt-1 text-[10px] border rounded-md px-1.5 py-0.5 max-w-[150px] focus:outline-none focus:ring-1 focus:ring-primary-500 ${
                                  t.provider_service_id
                                    ? 'border-primary-200 bg-primary-50 text-primary-700'
                                    : 'border-slate-200 bg-white text-slate-400'
                                }`}
                              >
                                <option value="">↳ entrega: cliente</option>
                                {(services ?? []).filter((s: any) => s.id !== t.service_id).map((s: any) => (
                                  <option key={s.id} value={s.id}>↳ entrega: {s.name}</option>
                                ))}
                              </select>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {t.requires_document
                              ? <span className="text-xs text-amber-600">📎 Sí</span>
                              : <span className="text-xs text-slate-300">No</span>}
                          </td>
                          <td className="px-4 py-3">
                            {t.active
                              ? <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600"><CheckCircle2 className="w-3 h-3" /> Activa</span>
                              : <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-400"><XCircle className="w-3 h-3" /> Inactiva</span>}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => { setEditTarget(t); setShowModal(true) }}
                                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"><Pencil className="w-3.5 h-3.5" /></button>
                              <button onClick={() => confirm({ title: '¿Eliminar esta plantilla?', description: 'Las tareas ya generadas no se eliminarán.', type: 'danger', confirmLabel: 'Eliminar', onConfirm: () => deleteMut.mutateAsync(t.id) })}
                                className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {!filtered.length && (
                <div className="text-center py-12 text-slate-400">
                  <Repeat className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                  <p className="text-sm">{hasFilters ? 'Sin resultados con esos filtros' : 'No hay plantillas de tareas recurrentes'}</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Cron info + historial */}
        <CronPanel />
      </div>

      {showModal && (
        <TemplateModal
          editing={editTarget}
          services={services ?? []}
          onClose={() => { setShowModal(false); setEditTarget(null) }}
        />
      )}
    </div>
  )
}

// ── Template Modal ────────────────────────────────────────────────────────────

// ── Cron Panel ────────────────────────────────────────────────────────────────

const JOB_LABELS: Record<string, { label: string; dot: string; schedule: string }> = {
  'generate-tasks': { label: 'Generar tareas',  dot: 'bg-emerald-500', schedule: '1ro de cada mes, 6:00 AM' },
  'send-reminders': { label: 'Recordatorios',   dot: 'bg-blue-500',    schedule: 'Diario, 7:00 AM' },
  'mark-overdue':   { label: 'Marcar vencidas', dot: 'bg-amber-500',   schedule: 'Diario, 1:00 AM' },
}

function fmtDateTime(d: string) {
  return new Date(d).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function CronPanel() {
  const qc = useQueryClient()
  const confirm = useConfirm()
  const [running, setRunning] = useState('')

  const { data: logs, isLoading } = useQuery({
    queryKey: ['cron-logs'],
    queryFn: async () => { const { data } = await api.get('/api/tasks/cron-logs'); return data },
  })

  const runJob = async (job: string) => {
    setRunning(job)
    try {
      if (job === 'generate-tasks') {
        const now = new Date()
        await api.post('/api/tasks/generate', { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() })
      } else if (job === 'send-reminders') {
        await api.post('/api/tasks/reminders')
      } else if (job === 'mark-overdue') {
        await api.post('/api/tasks/mark-overdue')
      }
      toast.success(`Job "${JOB_LABELS[job]?.label}" ejecutado`)
      qc.invalidateQueries({ queryKey: ['cron-logs'] })
      qc.invalidateQueries({ queryKey: ['tasks'] })
    } catch (e: any) {
      toast.error(e.response?.data?.error ?? 'Error al ejecutar')
    } finally { setRunning('') }
  }

  const handleConfirmRun = (job: string) => {
    let description = ''
    if (job === 'generate-tasks') {
      description = 'Se generarán las tareas recurrentes correspondientes al mes y año actuales.'
    } else if (job === 'send-reminders') {
      description = 'Se enviarán correos recordatorios para las tareas que vencen mañana.'
    } else if (job === 'mark-overdue') {
      description = 'Se marcarán como vencidas todas las tareas pendientes cuya fecha límite sea anterior a hoy.'
    }

    confirm({
      title: `¿Ejecutar "${JOB_LABELS[job]?.label}" manualmente?`,
      description,
      type: 'warning',
      confirmLabel: 'Ejecutar',
      onConfirm: () => runJob(job),
    })
  }

  const cronLogs: any[] = logs ?? []

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-400" />
            <h3 className="text-sm font-bold text-slate-900">Cron jobs</h3>
          </div>
          <span className="text-xs text-slate-400">{cronLogs.length} ejecuciones</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
          {Object.entries(JOB_LABELS).map(([key, j]) => {
            const isRunning = running === key
            return (
              <div key={key} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors">
                <div className="flex flex-col gap-0.5 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${j.dot}`} />
                    <span className="text-xs font-bold text-slate-700 truncate">{j.label}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 truncate">{j.schedule}</span>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  loading={isRunning}
                  disabled={!!running}
                  onClick={() => handleConfirmRun(key)}
                  className="px-2.5 py-1 text-xs shrink-0 h-8 gap-1.5"
                >
                  {!isRunning && <Play className="w-3 h-3 fill-current text-slate-500" />}
                  {!isRunning && 'Ejecutar'}
                </Button>
              </div>
            )
          })}
        </div>
      </div>

      {isLoading ? <div className="py-6"><PageLoader /></div> : cronLogs.length > 0 ? (
        <div className="divide-y divide-slate-50 max-h-[300px] overflow-y-auto">
          {cronLogs.map((log: any) => {
            const j = JOB_LABELS[log.job_name] ?? { label: log.job_name, dot: 'bg-slate-400', schedule: '' }
            const ok = log.status === 'success'
            return (
              <div key={log.id} className="flex items-center gap-3 px-4 py-2.5 text-xs">
                <span className={`w-2 h-2 rounded-full shrink-0 ${ok ? 'bg-emerald-500' : 'bg-red-500'}`} />
                <span className="font-medium text-slate-900 w-32 shrink-0">{j.label}</span>
                <span className={`font-medium ${ok ? 'text-emerald-600' : 'text-red-600'}`}>{ok ? 'Exitoso' : 'Fallido'}</span>
                {log.result && Object.keys(log.result).length > 0 && (
                  <span className="text-slate-400 truncate max-w-[200px]">{JSON.stringify(log.result)}</span>
                )}
                {log.error && <span className="text-red-500 truncate max-w-[200px]">{log.error}</span>}
                {log.duration_ms != null && <span className="text-slate-300">{log.duration_ms}ms</span>}
                <span className="text-slate-400 ml-auto shrink-0">{fmtDateTime(log.executed_at)}</span>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="text-center py-8 text-slate-400">
          <Clock className="w-8 h-8 mx-auto mb-2 text-slate-300" />
          <p className="text-sm">Sin ejecuciones registradas aún</p>
          <p className="text-xs mt-1">Las ejecuciones aparecerán automáticamente cuando el cron se ejecute</p>
        </div>
      )}
    </div>
  )
}

// ── Template Modal ────────────────────────────────────────────────────────────

function TemplateModal({ editing, services, onClose }: { editing: any | null; services: any[]; onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    title:             editing?.title ?? '',
    service_id:        editing?.service_id ?? '',
    frequency:         editing?.frequency ?? 'monthly',
    due_day:           editing?.due_day ?? '',
    create_day:        editing?.create_day ?? '',
    owner_type:        editing?.owner_type ?? 'rs_team',
    requires_document: editing?.requires_document ?? false,
    active:            editing?.active ?? true,
    description:       editing?.description ?? '',
    provider_service_id: editing?.provider_service_id ?? '',
  })
  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }))

  const saveMut = useMutation({
    mutationFn: async () => {
      const body: any = { ...form }
      if (body.due_day) body.due_day = parseInt(body.due_day)
      else delete body.due_day
      if (body.create_day) body.create_day = parseInt(body.create_day)
      else delete body.create_day
      if (!body.description) delete body.description
      body.provider_service_id = body.provider_service_id || null

      if (editing) await api.patch(`/api/tasks/templates/${editing.id}`, body)
      else await api.post('/api/tasks/templates', body)
    },
    onSuccess: () => {
      toast.success(editing ? 'Plantilla actualizada' : 'Plantilla creada')
      qc.invalidateQueries({ queryKey: ['task-templates'] })
      onClose()
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Error'),
  })

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white z-50 shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <h2 className="text-lg font-bold text-slate-900">{editing ? 'Editar plantilla' : 'Nueva plantilla recurrente'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <label className="block">
            <span className="text-xs font-medium text-slate-500">Título *</span>
            <input value={form.title} onChange={e => set('title', e.target.value)}
              placeholder="Ej: Envío extractos bancarios"
              className="w-full mt-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-500">Servicio *</span>
            <select value={form.service_id} onChange={e => set('service_id', e.target.value)}
              className="w-full mt-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500">
              <option value="">Seleccionar…</option>
              {services.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-500">Frecuencia</span>
            <select value={form.frequency} onChange={e => set('frequency', e.target.value)}
              className="w-full mt-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500">
              {Object.entries(FREQ_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v.icon} {v.label}</option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-medium text-slate-500">Día de creación</span>
              <input type="number" min={1} max={31} value={form.create_day} onChange={e => set('create_day', e.target.value)}
                placeholder="Ej: 3"
                className="w-full mt-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-500">Día de vencimiento</span>
              <input type="number" min={1} max={31} value={form.due_day} onChange={e => set('due_day', e.target.value)}
                placeholder="Ej: 5"
                className="w-full mt-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </label>
          </div>
          <label className="block">
            <span className="text-xs font-medium text-slate-500">Responsable</span>
            <select value={form.owner_type} onChange={e => set('owner_type', e.target.value)}
              className="w-full mt-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500">
              <option value="rs_team">⚙ Equipo Finto</option>
              <option value="client">🏢 Cliente</option>
            </select>
          </label>
          {form.owner_type === 'client' && (
            <label className="block">
              <span className="text-xs font-medium text-slate-500">Servicio que entrega (opcional)</span>
              <select value={form.provider_service_id} onChange={e => set('provider_service_id', e.target.value)}
                className="w-full mt-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500">
                <option value="">Ninguno — siempre la entrega el cliente</option>
                {services.filter((s: any) => s.id !== form.service_id).map((s: any) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <p className="text-[11px] text-slate-400 mt-1">
                Si el cliente tiene contratado este servicio, la tarea se asignará al equipo interno en vez de pedírsela al cliente.
              </p>
            </label>
          )}
          <label className="block">
            <span className="text-xs font-medium text-slate-500">Descripción</span>
            <textarea rows={2} value={form.description} onChange={e => set('description', e.target.value)}
              placeholder="Detalles opcionales..."
              className="w-full mt-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none" />
          </label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.requires_document} onChange={e => set('requires_document', e.target.checked)}
                className="rounded border-slate-300" />
              <span className="text-sm text-slate-700">Requiere documento</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.active} onChange={e => set('active', e.target.checked)}
                className="rounded border-slate-300" />
              <span className="text-sm text-slate-700">Activa</span>
            </label>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => saveMut.mutate()} loading={saveMut.isPending}
            disabled={!form.title.trim() || !form.service_id}>
            {editing ? 'Guardar cambios' : 'Crear plantilla →'}
          </Button>
        </div>
      </div>
    </>
  )
}
