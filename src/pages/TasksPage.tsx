import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { TopBar } from '@/components/layout/TopBar'
import { Button } from '@/components/ui/Button'
import { PageLoader } from '@/components/ui/Spinner'
import {
  CheckCircle2, Circle, Clock, Plus, Search, Trash2,
  ChevronDown, X, AlertTriangle, Eye, Upload, FileText, Paperclip,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/authStore'

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

const STATUS_LABELS: Record<string, { label: string; cls: string; icon: any }> = {
  pending:     { label: 'Pendiente',   cls: 'bg-slate-100 text-slate-600',    icon: <Circle className="w-4 h-4 text-slate-400" /> },
  in_progress: { label: 'En progreso', cls: 'bg-blue-100 text-blue-700',     icon: <Clock className="w-4 h-4 text-blue-500" /> },
  done:        { label: 'Completada',  cls: 'bg-emerald-100 text-emerald-700', icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" /> },
  overdue:     { label: 'Vencida',     cls: 'bg-red-100 text-red-700',       icon: <AlertTriangle className="w-4 h-4 text-red-500" /> },
}

// ── Searchable dropdown ───────────────────────────────────────────────────────

function SearchSelect({ value, onChange, options, placeholder, label }: {
  value: string; onChange: (v: string) => void
  options: { value: string; label: string; color?: string }[]
  placeholder: string; label: string
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
  const selected = options.find(o => o.value === value)

  return (
    <div ref={ref} className="relative">
      <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">{label}</label>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white hover:border-slate-300 transition-colors text-left"
      >
        <span className={selected ? 'text-slate-800' : 'text-slate-400'}>
          {selected ? selected.label : placeholder}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {value && (
            <span onClick={e => { e.stopPropagation(); onChange(''); setOpen(false) }}
              className="text-slate-400 hover:text-slate-600 p-0.5">
              <X className="w-3 h-3" />
            </span>
          )}
          <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
          <div className="p-2 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                autoFocus
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar..."
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-100 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.map(o => (
              <button
                key={o.value}
                onClick={() => { onChange(o.value); setOpen(false); setSearch('') }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center gap-2 transition-colors ${
                  value === o.value ? 'bg-primary-50 text-primary-700 font-medium' : 'text-slate-700'
                }`}
              >
                {o.color && <span className={`w-2 h-2 rounded-full shrink-0 ${o.color}`} />}
                {o.label}
              </button>
            ))}
            {!filtered.length && (
              <p className="px-3 py-4 text-sm text-slate-400 text-center">Sin resultados</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function TasksPage() {
  const qc = useQueryClient()
  const { user } = useAuthStore()
  const isAdmin = ['admin', 'rs_admin', 'rs_staff'].includes(user?.role ?? '')
  const [page, setPage] = useState(1)
  const [searchQ, setSearchQ] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [companyFilter, setCompanyFilter] = useState('')
  const [serviceFilter, setServiceFilter] = useState('')
  const [ownerFilter, setOwnerFilter] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [viewTaskId, setViewTaskId] = useState<string | null>(null)

  // Companies for filter
  const { data: companiesData } = useQuery({
    queryKey: ['companies-list'],
    queryFn: async () => { const { data } = await api.get('/api/companies?limit=100'); return data },
    staleTime: 120_000,
  })
  const companies: any[] = companiesData?.data ?? (Array.isArray(companiesData) ? companiesData : [])

  // Services for filter
  const { data: servicesData } = useQuery({
    queryKey: ['all-services'],
    queryFn: async () => { const { data } = await api.get('/api/services?active=true'); return data },
    staleTime: 120_000,
  })
  const services: any[] = servicesData ?? []

  // Tasks
  const { data, isLoading } = useQuery({
    queryKey: ['tasks', page, statusFilter, companyFilter, serviceFilter, ownerFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: '50' })
      if (statusFilter)  params.set('status', statusFilter)
      if (companyFilter) params.set('company_id', companyFilter)
      if (serviceFilter) params.set('service_id', serviceFilter)
      if (ownerFilter)   params.set('owner_type', ownerFilter)
      const { data } = await api.get(`/api/tasks?${params}`)
      return data
    },
  })

  const allTasks: any[] = data?.data ?? []
  const total = data?.total ?? 0

  const filtered = searchQ
    ? allTasks.filter(t => t.title?.toLowerCase().includes(searchQ.toLowerCase()))
    : allTasks

  const today = new Date().toISOString().split('T')[0]!
  const totalAll    = total
  const overdue     = allTasks.filter(t => t.status !== 'done' && t.due_date && t.due_date < today).length
  const pending     = allTasks.filter(t => t.status === 'pending' || t.status === 'in_progress').length
  const completed   = allTasks.filter(t => t.status === 'done').length

  const completeMut = useMutation({
    mutationFn: (id: string) => api.patch(`/api/tasks/${id}`, { status: 'done' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks'] }); toast.success('Tarea completada') },
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/api/tasks/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks'] }); toast.success('Tarea eliminada') },
  })

  const companyName = (id: string) => companies.find(c => c.id === id)?.name ?? '—'

  const todayStr = new Date().toLocaleDateString('es-CO', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar title="Tareas" subtitle="Gestión de tareas" />

      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400">Admin / <span className="text-primary-600 font-medium">Tareas</span></p>
            <h2 className="text-xl font-bold text-slate-900">Gestión de tareas</h2>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400">{todayStr}</span>
            <Button size="sm" onClick={() => setShowNew(true)}><Plus className="w-3.5 h-3.5" /> Nueva tarea</Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total tareas', value: totalAll, sub: 'en todas las empresas', color: 'border-t-primary-500' },
            { label: 'Vencidas', value: overdue, sub: 'requieren atención inmediata', color: 'border-t-red-500' },
            { label: 'Pendientes', value: pending, sub: 'por completar', color: 'border-t-amber-500' },
            { label: 'Completadas', value: completed, sub: 'finalizadas', color: 'border-t-emerald-500' },
          ].map(k => (
            <div key={k.label} className={`bg-white border border-slate-200 rounded-xl p-4 border-t-4 ${k.color}`}>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{k.label}</p>
              <p className={`text-3xl font-bold mt-1 ${k.label === 'Vencidas' ? 'text-red-500' : k.label === 'Completadas' ? 'text-emerald-600' : 'text-slate-900'}`}>
                {k.value}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">{k.sub}</p>
            </div>
          ))}
        </div>

        {/* Search + status filters */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
                placeholder="Buscar tarea..."
                className="w-full pl-10 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {/* Status pills */}
            <div className="flex gap-1.5">
              {[
                { key: '',            label: 'Todas' },
                { key: 'overdue',     label: '🔴 Vencidas' },
                { key: 'pending',     label: 'Pendientes' },
                { key: 'done',        label: 'Completadas' },
              ].map(s => (
                <button
                  key={s.key}
                  onClick={() => { setStatusFilter(s.key); setPage(1) }}
                  className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-colors ${
                    statusFilter === s.key
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <Button size="sm" onClick={() => setShowNew(true)}><Plus className="w-3.5 h-3.5" /> Nueva tarea</Button>

            {/* Owner filter */}
            <div className="flex gap-1 border border-slate-200 rounded-lg overflow-hidden">
              {[
                { key: '', label: 'Todas' },
                { key: 'rs_team', label: '⚙ RS' },
                { key: 'client', label: '🏢 Cliente' },
              ].map(o => (
                <button
                  key={o.key}
                  onClick={() => { setOwnerFilter(o.key); setPage(1) }}
                  className={`text-xs px-3 py-1.5 font-medium transition-colors ${
                    ownerFilter === o.key
                      ? 'bg-primary-600 text-white'
                      : 'bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {/* Dropdown filters */}
          <div className="grid grid-cols-2 gap-3">
            <SearchSelect
              label="Por empresa"
              value={companyFilter}
              onChange={v => { setCompanyFilter(v); setPage(1) }}
              placeholder="Todas las empresas"
              options={companies.map((c: any) => ({ value: c.id, label: c.name ?? c.legal_name ?? '—', color: 'bg-primary-500' }))}
            />
            <SearchSelect
              label="Por servicio"
              value={serviceFilter}
              onChange={v => { setServiceFilter(v); setPage(1) }}
              placeholder="Todos los servicios"
              options={services.map((s: any) => ({ value: s.id, label: s.name ?? '—' }))}
            />
          </div>
        </div>

        {/* Tasks table */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900">Tareas</h3>
            <span className="text-xs text-slate-400">{total} tareas</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider w-8"></th>
                  <th className="text-left px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tarea</th>
                  <th className="text-left px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Empresa</th>
                  <th className="text-left px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Vencimiento</th>
                  <th className="text-left px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Estado</th>
                  <th className="text-right px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {isLoading ? (
                  <tr><td colSpan={6} className="py-10"><PageLoader /></td></tr>
                ) : filtered.map((t: any) => {
                  const isOverdue = t.status !== 'done' && t.due_date && t.due_date < today
                  const st = isOverdue ? STATUS_LABELS.overdue : (STATUS_LABELS[t.status] ?? STATUS_LABELS.pending)
                  const isRS = t.owner_type === 'rs_team'
                  return (
                    <tr key={t.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="px-4 py-3">
                        <button
                          onClick={() => t.status !== 'done' && completeMut.mutate(t.id)}
                          className="shrink-0"
                          disabled={t.status === 'done'}
                        >
                          {st.icon}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <p className={`font-medium ${t.status === 'done' ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                          {t.title}
                        </p>
                        {t.services?.name && (
                          <span className="text-[10px] text-slate-400">{t.services.name}</span>
                        )}
                        {isRS && (
                          <span className="ml-1.5 inline-flex items-center gap-0.5 text-[10px] font-medium bg-primary-100 text-primary-700 px-1.5 py-0.5 rounded-full">
                            ⚙ RS
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-md bg-primary-100 flex items-center justify-center text-[10px] font-bold text-primary-700 shrink-0">
                            {(companyName(t.company_id)?.[0] ?? '?').toUpperCase()}
                          </span>
                          <span className="text-sm text-slate-700 truncate max-w-[140px]">{companyName(t.company_id)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-sm ${isOverdue ? 'text-red-600 font-medium' : 'text-slate-600'}`}>
                          {t.due_date ? fmtDate(t.due_date) : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${st.cls}`}>
                          • {st.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => setViewTaskId(t.id)}
                            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-primary-600 transition-colors" title="Ver detalle">
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {isAdmin && (
                            <button
                              onClick={() => {
                                toast('¿Eliminar esta tarea?', {
                                  action: { label: 'Eliminar', onClick: () => deleteMut.mutate(t.id) },
                                  cancel: { label: 'Cancelar', onClick: () => {} },
                                  duration: 8000,
                                })
                              }}
                              className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {!isLoading && !filtered.length && (
                  <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-400">No hay tareas con esos filtros</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {total > 50 && (
            <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between text-sm text-slate-500">
              <span>Página {page} de {Math.ceil(total / 50)}</span>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Anterior</Button>
                <Button variant="secondary" size="sm" disabled={page >= Math.ceil(total / 50)} onClick={() => setPage(p => p + 1)}>Siguiente</Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {showNew && <NewTaskModal companies={companies} services={services} onClose={() => setShowNew(false)} />}
      {viewTaskId && <TaskDrawer id={viewTaskId} onClose={() => setViewTaskId(null)} companyName={k => companyName(k)} />}
    </div>
  )
}

// ── New Task Modal ────────────────────────────────────────────────────────────

function NewTaskModal({ companies, services, onClose }: { companies: any[]; services: any[]; onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ company_id: '', title: '', due_date: '', owner_type: 'rs_team', service_id: '' })
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  const createMut = useMutation({
    mutationFn: async () => {
      const body: any = { ...form }
      if (!body.due_date) delete body.due_date
      if (!body.service_id) delete body.service_id
      const { data } = await api.post('/api/tasks', body)
      return data
    },
    onSuccess: () => { toast.success('Tarea creada'); qc.invalidateQueries({ queryKey: ['tasks'] }); onClose() },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Error'),
  })

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white z-50 shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <h2 className="text-lg font-bold text-slate-900">Nueva tarea</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <label className="block">
            <span className="text-xs font-medium text-slate-500">Título <span className="text-red-500">*</span></span>
            <input value={form.title} onChange={e => set('title', e.target.value)}
              placeholder="Ej: Envío extractos bancarios — Jun 2026"
              className="w-full mt-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-500">Empresa <span className="text-red-500">*</span></span>
            <select value={form.company_id} onChange={e => set('company_id', e.target.value)}
              className="w-full mt-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500">
              <option value="">Seleccionar…</option>
              {companies.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-medium text-slate-500">Fecha de vencimiento</span>
              <input type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)}
                className="w-full mt-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-500">Responsable</span>
              <select value={form.owner_type} onChange={e => set('owner_type', e.target.value)}
                className="w-full mt-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500">
                <option value="rs_team">RS Team</option>
                <option value="client">Cliente</option>
              </select>
            </label>
          </div>
          <label className="block">
            <span className="text-xs font-medium text-slate-500">Servicio</span>
            <select value={form.service_id} onChange={e => set('service_id', e.target.value)}
              className="w-full mt-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500">
              <option value="">Sin servicio</option>
              {services.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => createMut.mutate()} loading={createMut.isPending}
            disabled={!form.title.trim() || !form.company_id}>
            Crear tarea →
          </Button>
        </div>
      </div>
    </>
  )
}

// ── Task Detail Drawer ───────────────────────────────────────────────────────

const TASK_STATUS: Record<string, { label: string; cls: string }> = {
  pending:     { label: 'Pendiente',   cls: 'bg-amber-100 text-amber-700' },
  in_progress: { label: 'En progreso', cls: 'bg-blue-100 text-blue-700' },
  done:        { label: 'Completada',  cls: 'bg-emerald-100 text-emerald-700' },
  overdue:     { label: 'Vencida',     cls: 'bg-red-100 text-red-700' },
}

function TaskDrawer({ id, onClose, companyName }: { id: string; onClose: () => void; companyName: (id: string) => string }) {
  const qc = useQueryClient()
  const { user } = useAuthStore()
  const isAdmin = ['admin', 'rs_admin', 'rs_staff'].includes(user?.role ?? '')
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const { data: task, isLoading } = useQuery({
    queryKey: ['task-detail', id],
    queryFn: async () => { const { data } = await api.get(`/api/tasks/${id}`); return data },
  })

  const updateMut = useMutation({
    mutationFn: async (input: Record<string, any>) => {
      await api.patch(`/api/tasks/${id}`, input)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task-detail', id] })
      qc.invalidateQueries({ queryKey: ['tasks'] })
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Error'),
  })

  const uploadDoc = async (file: File) => {
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('title', `Entrega: ${task?.title ?? 'Tarea'}`)
      formData.append('category', 'task_delivery')
      const { data: doc } = await api.post('/api/documents/upload', formData)
      await api.patch(`/api/tasks/${id}`, { document_id: doc.id, status: 'in_progress' })
      toast.success('Documento subido exitosamente')
      qc.invalidateQueries({ queryKey: ['task-detail', id] })
      qc.invalidateQueries({ queryKey: ['tasks'] })
    } catch (e: any) {
      toast.error(e.response?.data?.error ?? 'Error al subir documento')
    } finally {
      setUploading(false)
    }
  }

  const t = task
  if (!t && isLoading) return null

  const today = new Date().toISOString().split('T')[0]!
  const isOverdue = t?.status !== 'done' && t?.due_date && t.due_date < today
  const statusKey = isOverdue ? 'overdue' : (t?.status ?? 'pending')
  const st = TASK_STATUS[statusKey] ?? TASK_STATUS.pending
  const isDone = t?.status === 'done'
  const needsDoc = t?.requires_document && !t?.document_id
  const hasDoc = !!t?.document_id

  const steps = [
    { label: 'Creada', done: true },
    ...(t?.requires_document
      ? [{ label: 'Documento adjunto', done: hasDoc }]
      : []),
    { label: 'Completada', done: isDone },
  ]

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full max-w-lg bg-white z-50 shadow-2xl flex flex-col overflow-hidden">

        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${st.cls}`}>• {st.label}</span>
              <h2 className="text-lg font-bold text-slate-900 mt-1">{t?.title ?? '—'}</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {companyName(t?.company_id)} · {t?.services?.name ?? 'Sin servicio'}
                {t?.owner_type === 'rs_team' && <span className="ml-1.5 text-[10px] font-medium bg-primary-100 text-primary-700 px-1.5 py-0.5 rounded-full">⚙ RS</span>}
              </p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* Progress steps */}
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Progreso</p>
            <div className="flex items-center gap-1">
              {steps.map((s, i) => (
                <div key={i} className="flex items-center gap-1 flex-1">
                  <div className="flex flex-col items-center gap-1 flex-1">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                      s.done ? 'bg-primary-500 text-white' : 'bg-slate-100 text-slate-400'
                    }`}>
                      {s.done ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                    </div>
                    <span className="text-[10px] text-slate-500 text-center leading-tight">{s.label}</span>
                  </div>
                  {i < steps.length - 1 && (
                    <div className={`h-0.5 flex-1 mb-5 ${s.done ? 'bg-primary-400' : 'bg-slate-200'}`} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Info */}
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Vencimiento</p>
                <p className={`text-sm font-medium mt-0.5 ${isOverdue ? 'text-red-600' : 'text-slate-900'}`}>
                  {t?.due_date ? fmtDate(t.due_date) : '—'}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Responsable</p>
                <p className="text-sm font-medium text-slate-900 mt-0.5">
                  {t?.owner_type === 'rs_team' ? 'Equipo RS' : 'Cliente'}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Servicio</p>
                <p className="text-sm font-medium text-slate-900 mt-0.5">{t?.services?.name ?? '—'}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Requiere documento</p>
                <p className="text-sm font-medium text-slate-900 mt-0.5">{t?.requires_document ? 'Sí' : 'No'}</p>
              </div>
            </div>
          </div>

          {/* Document section */}
          {t?.requires_document && (
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1 h-5 bg-primary-500 rounded-full" />
                <p className="text-xs font-bold text-primary-600 uppercase tracking-wider">Documento adjunto</p>
              </div>

              {hasDoc && t.documents ? (
                <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <FileText className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {t.documents.title ?? t.documents.original_name ?? 'Documento adjunto'}
                    </p>
                    <p className="text-xs text-emerald-600">Subido · {t.documents.created_at ? fmtDate(t.documents.created_at) : ''}</p>
                  </div>
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                </div>
              ) : (
                <div className="text-center py-4">
                  <Paperclip className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-500 mb-3">Esta tarea requiere adjuntar un documento</p>
                  <input ref={fileRef} type="file" className="hidden"
                    accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls,.doc,.docx"
                    onChange={e => { const f = e.target.files?.[0]; if (f) uploadDoc(f) }} />
                  <Button size="sm" onClick={() => fileRef.current?.click()} loading={uploading}>
                    <Upload className="w-3.5 h-3.5" /> Subir documento
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          {(() => {
            const isClientTask = t?.owner_type === 'client'
            const isRSTask     = t?.owner_type === 'rs_team'
            const canComplete  = (isClientTask && !isAdmin) || (isRSTask && isAdmin)

            if (isDone) return (
              <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-emerald-800">Tarea completada</p>
                  <p className="text-xs text-emerald-600">Esta tarea fue finalizada exitosamente.</p>
                </div>
              </div>
            )

            return (
              <div className="space-y-2">
                {/* Info de quién debe completar */}
                {!canComplete && (
                  <p className="text-xs text-blue-600 bg-blue-50 px-3 py-2 rounded-lg flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    {isClientTask
                      ? 'Esta tarea debe ser completada por el cliente.'
                      : 'Esta tarea debe ser completada por el equipo RS.'}
                  </p>
                )}

                {/* Requiere documento primero */}
                {canComplete && needsDoc && (
                  <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    {isAdmin
                      ? 'El cliente debe subir el documento antes de completar.'
                      : 'Sube el documento requerido para poder completar esta tarea.'}
                  </p>
                )}

                {/* Completar */}
                {canComplete && !needsDoc && (
                  <Button className="w-full"
                    onClick={() => updateMut.mutate({ status: 'done' }, { onSuccess: () => toast.success('Tarea completada') })}
                    loading={updateMut.isPending}>
                    <CheckCircle2 className="w-4 h-4" />
                    {t?.status === 'in_progress' ? 'Aprobar y completar' : 'Marcar como completada'}
                  </Button>
                )}

                {/* En progreso (solo si puede completar) */}
                {canComplete && t?.status === 'pending' && (
                  <Button className="w-full" variant="secondary"
                    onClick={() => updateMut.mutate({ status: 'in_progress' }, { onSuccess: () => toast.success('Tarea en progreso') })}
                    loading={updateMut.isPending}>
                    <Clock className="w-4 h-4" /> Marcar en progreso
                  </Button>
                )}
              </div>
            )
          })()}
        </div>
      </div>
    </>
  )
}
