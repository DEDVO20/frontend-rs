import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { TopBar } from '@/components/layout/TopBar'
import { Button } from '@/components/ui/Button'
import { PageLoader } from '@/components/ui/Spinner'
import { toast } from 'sonner'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import {
  Building2, Search, Plus, Eye, Pencil, Trash2, X,
  CheckCircle2, FileText, LayoutGrid, ListTodo, Activity,
} from 'lucide-react'

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  active: { label: 'Activa', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  activa: { label: 'Activa', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  approved: { label: 'Activa', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  inactive: { label: 'Inactiva', cls: 'bg-slate-100 text-slate-500 border-slate-200' },
  nueva: { label: 'Nueva', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  new: { label: 'Nueva', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
}

const isActive = (s: string) => s === 'active' || s === 'activa' || s === 'approved'
const isNew = (s: string) => s === 'new' || s === 'nueva'

const FILTERS = [
  { key: '', label: 'Todas' },
  { key: 'active', label: 'Activas' },
  { key: 'mora', label: 'En mora' },
  { key: 'inactive', label: 'Inactivas' },
  { key: 'new', label: 'Nuevas' },
] as const

const AVATAR_COLORS = [
  'bg-primary-600', 'bg-blue-600', 'bg-violet-600', 'bg-amber-600',
  'bg-rose-600', 'bg-cyan-600', 'bg-emerald-600', 'bg-orange-600',
]

function getAvatarColor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

type DetailTab = 'info' | 'modules' | 'tasks' | 'docs' | 'activity'

const DEPARTAMENTOS = [
  'Amazonas', 'Antioquia', 'Arauca', 'Atlántico', 'Bolívar', 'Boyacá', 'Caldas', 'Caquetá',
  'Casanare', 'Cauca', 'Cesar', 'Chocó', 'Córdoba', 'Cundinamarca', 'Guainía', 'Guaviare',
  'Huila', 'La Guajira', 'Magdalena', 'Meta', 'Nariño', 'Norte de Santander', 'Putumayo',
  'Quindío', 'Risaralda', 'San Andrés', 'Santander', 'Sucre', 'Tolima', 'Valle del Cauca',
  'Vaupés', 'Vichada', 'Bogotá D.C.',
]

const SECTORES = [
  'Tecnología', 'Comercio', 'Construcción', 'Salud', 'Educación', 'Servicios', 'Manufactura',
  'Agroindustria', 'Financiero', 'Transporte', 'Energía', 'Telecomunicaciones', 'Consultoría', 'Otro',
]

const TAMANOS = [
  'Microempresa', 'Pequeña empresa', 'Mediana empresa', 'Gran empresa',
]

function NewCompanyModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    name: '', nit: '', city: '', dept: '', sector: '', size: '',
    contact: '', cargo: '', email: '', phone: '', asesor: '', status: 'nueva', notes: '',
  })
  const [selectedServices, setSelectedServices] = useState<string[]>([])

  const { data: allServices } = useQuery({
    queryKey: ['all-services'],
    queryFn: async () => { const { data } = await api.get('/api/services?active=true'); return data },
  })

  const services: any[] = allServices ?? []

  const toggleService = (id: string) =>
    setSelectedServices(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }))

  const createMut = useMutation({
    mutationFn: async () => {
      const { data: company } = await api.post('/api/companies', form)
      // Assign selected services
      await Promise.allSettled(
        selectedServices.map(serviceId =>
          api.post(`/api/company-services/${company.id}`, { service_id: serviceId })
        )
      )
      return company
    },
    onSuccess: (data) => {
      toast.success('Empresa creada exitosamente')
      qc.invalidateQueries({ queryKey: ['companies'] })
      onCreated(data.id)
      onClose()
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Error al crear empresa'),
  })

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-full max-w-lg bg-white z-50 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Nueva empresa</h2>
            <p className="text-xs text-slate-400">Ingresa los datos del nuevo cliente Finto</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* Información empresa */}
          <fieldset>
            <legend className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Información de la empresa</legend>
            <div className="space-y-3">
              <Field label="Razón social" required>
                <input value={form.name} onChange={e => set('name', e.target.value)}
                  placeholder="Ej: Constructora ABC S.A.S" className="w-full mt-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="NIT">
                  <input value={form.nit} onChange={e => set('nit', e.target.value)}
                    placeholder="900.123.456-7" className="w-full mt-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </Field>
                <Field label="Ciudad">
                  <input value={form.city} onChange={e => set('city', e.target.value)}
                    placeholder="Bogotá D.C." className="w-full mt-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Departamento">
                  <select value={form.dept} onChange={e => set('dept', e.target.value)} className="w-full mt-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500">
                    <option value="">Seleccionar…</option>
                    {DEPARTAMENTOS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </Field>
                <Field label="Sector">
                  <select value={form.sector} onChange={e => set('sector', e.target.value)} className="w-full mt-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500">
                    <option value="">Seleccionar…</option>
                    {SECTORES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="Tamaño">
                <select value={form.size} onChange={e => set('size', e.target.value)} className="w-full mt-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500">
                  <option value="">Seleccionar…</option>
                  {TAMANOS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
            </div>
          </fieldset>

          {/* Contacto */}
          <fieldset>
            <legend className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Contacto principal</legend>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Nombre completo">
                  <input value={form.contact} onChange={e => set('contact', e.target.value)}
                    placeholder="Jorge Rodríguez" className="w-full mt-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </Field>
                <Field label="Cargo">
                  <input value={form.cargo} onChange={e => set('cargo', e.target.value)}
                    placeholder="Gerente / Director Financiero" className="w-full mt-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Email">
                  <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                    placeholder="contacto@empresa.co" className="w-full mt-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </Field>
                <Field label="Teléfono">
                  <input value={form.phone} onChange={e => set('phone', e.target.value)}
                    placeholder="+57 300 000 0000" className="w-full mt-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </Field>
              </div>
            </div>
          </fieldset>

          {/* Asesor y módulos */}
          <fieldset>
            <legend className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Asesor y módulos</legend>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Asesor asignado">
                  <input value={form.asesor} onChange={e => set('asesor', e.target.value)}
                    placeholder="Ana García" className="w-full mt-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </Field>
                <Field label="Estado inicial">
                  <select value={form.status} onChange={e => set('status', e.target.value)} className="w-full mt-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500">
                    <option value="nueva">Nueva</option>
                    <option value="activa">Activa</option>
                  </select>
                </Field>
              </div>

              <div>
                <p className="text-xs font-medium text-slate-500 mb-2">Módulos a contratar</p>
                <div className="grid grid-cols-2 gap-2">
                  {services.map((s: any) => {
                    const checked = selectedServices.includes(s.id)
                    const icon = MODULE_ICONS[s.name] ?? '📦'
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => toggleService(s.id)}
                        className={`flex items-center gap-2 p-3 rounded-xl border text-left text-sm transition-colors ${checked
                            ? 'border-primary-300 bg-primary-50 text-primary-700'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                          }`}
                      >
                        {checked && <CheckCircle2 className="w-4 h-4 text-primary-500 shrink-0" />}
                        <span>{icon} {s.name}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </fieldset>

          {/* Notas */}
          <fieldset>
            <legend className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Notas internas</legend>
            <textarea
              rows={3}
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              placeholder="Observaciones, acuerdos, contexto del cliente…"
              className="w-full mt-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            />
          </fieldset>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50 shrink-0">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={() => createMut.mutate()}
            loading={createMut.isPending}
            disabled={!form.name.trim()}
          >
            Crear empresa →
          </Button>
        </div>
      </div>
    </>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-500">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      {children}
    </label>
  )
}

const MODULE_ICONS: Record<string, string> = {
  'Facturación y Cartera': '🧾',
  'Contabilidad': '📋',
  'Tesorería': '🏦',
  'Gestión de Personal': '👥',
}

function ModulesPanel({ companyId }: { companyId: string }) {
  const qc = useQueryClient()
  const confirm = useConfirm()

  const { data: allServices } = useQuery({
    queryKey: ['all-services'],
    queryFn: async () => { const { data } = await api.get('/api/services?active=true'); return data },
  })

  const { data: companyServices } = useQuery({
    queryKey: ['company-services', companyId],
    queryFn: async () => { const { data } = await api.get(`/api/company-services/${companyId}`); return data },
  })

  const enabledIds = new Set((companyServices ?? []).map((cs: any) => cs.service_id))

  const toggleMut = useMutation({
    mutationFn: async ({ serviceId, enable }: { serviceId: string; enable: boolean }) => {
      if (enable) {
        await api.post(`/api/company-services/${companyId}`, { service_id: serviceId })
      } else {
        await api.delete(`/api/company-services/${companyId}/${serviceId}`)
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['company-services', companyId] })
      qc.invalidateQueries({ queryKey: ['company-detail', companyId] })
      toast.success('Módulo actualizado')
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Error al actualizar módulo'),
  })

  const services: any[] = allServices ?? []

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-1 h-5 bg-primary-500 rounded-full" />
        <h3 className="text-xs font-bold text-primary-600 uppercase tracking-wider">Servicios contratados</h3>
      </div>
      <h4 className="text-sm font-bold text-slate-900 mt-2">Módulos habilitados</h4>
      <p className="text-xs text-slate-400 mb-4">Activa o desactiva los módulos disponibles para este cliente</p>

      {!services.length ? (
        <p className="text-sm text-slate-400 text-center py-8">Sin servicios registrados en la plataforma</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {services.map((s: any) => {
            const enabled = enabledIds.has(s.id)
            const icon = MODULE_ICONS[s.name] ?? '📦'
            return (
              <div
                key={s.id}
                className={`flex items-center gap-3 p-4 rounded-xl border transition-colors ${enabled ? 'border-primary-200 bg-primary-50/30' : 'border-slate-200 bg-slate-50'
                  }`}
              >
                <span className="text-xl shrink-0">{icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900">{s.name}</p>
                  <p className="text-xs text-slate-400 truncate">{s.description ?? '—'}</p>
                </div>
                <button
                  onClick={() => confirm({
                    title: enabled ? `¿Desactivar "${s.name}"?` : `¿Activar "${s.name}"?`,
                    description: enabled
                      ? 'El cliente perderá acceso a este módulo.'
                      : 'El cliente tendrá acceso a este módulo y podrá utilizarlo.',
                    type: enabled ? 'warning' : 'info',
                    confirmLabel: enabled ? 'Desactivar' : 'Activar',
                    onConfirm: () => toggleMut.mutateAsync({ serviceId: s.id, enable: !enabled }),
                  })}
                  disabled={toggleMut.isPending}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full shrink-0 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1 ${enabled ? 'bg-primary-600' : 'bg-slate-300'
                    }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function CompaniesPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detailTab, setDetailTab] = useState<DetailTab>('info')
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState<Record<string, string>>({})
  const [showNew, setShowNew] = useState(false)

  // List
  const { data: listData, isLoading } = useQuery({
    queryKey: ['companies', search],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: '100' })
      if (search) params.set('search', search)
      const { data } = await api.get(`/api/companies?${params}`)
      return data
    },
  })

  const allCompanies: any[] = listData?.data ?? (Array.isArray(listData) ? listData : [])

  const filtered = allCompanies.filter(c => {
    const st = c.status ?? ''
    if (filter === 'active') return isActive(st)
    if (filter === 'new') return isNew(st)
    if (filter === 'inactive') return st === 'inactive' || st === 'inactiva'
    if (filter === 'mora') return false
    return true
  })

  const activeCount = allCompanies.filter(c => isActive(c.status ?? '')).length

  // Detail
  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ['company-detail', selectedId],
    queryFn: async () => {
      const { data } = await api.get(`/api/companies/${selectedId}`)
      return data
    },
    enabled: !!selectedId,
  })

  // Tasks for selected company
  const { data: companyTasks } = useQuery({
    queryKey: ['company-tasks', selectedId],
    queryFn: async () => {
      const { data } = await api.get(`/api/tasks?company_id=${selectedId}&limit=100`)
      return data
    },
    enabled: !!selectedId && detailTab === 'tasks',
  })

  // Documents for selected company
  const { data: companyDocs } = useQuery({
    queryKey: ['company-docs', selectedId],
    queryFn: async () => {
      const { data } = await api.get(`/api/documents?company_id=${selectedId}&limit=20`)
      return data
    },
    enabled: !!selectedId && detailTab === 'docs',
  })

  // Update mutation
  const updateMut = useMutation({
    mutationFn: async (input: Record<string, string>) => {
      const { data } = await api.patch(`/api/companies/${selectedId}`, input)
      return data
    },
    onSuccess: () => {
      toast.success('Empresa actualizada')
      setEditing(false)
      qc.invalidateQueries({ queryKey: ['companies'] })
      qc.invalidateQueries({ queryKey: ['company-detail', selectedId] })
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Error al actualizar'),
  })

  const services: any[] = detail?.company_services ?? []
  const activeModules = services.filter((s: any) => s.active !== false).length
  const today = new Date().toISOString().split('T')[0]!
  const allTasks: any[] = Array.isArray(companyTasks) ? companyTasks : (companyTasks?.data ?? [])
  const pendingTasks = allTasks.filter((t: any) => t.status !== 'done' && t.status !== 'completed')
  const overdueTasks = pendingTasks.filter((t: any) => t.due_date && t.due_date < today)
  const allDocs: any[] = Array.isArray(companyDocs) ? companyDocs : (companyDocs?.data ?? [])

  const co = detail // alias

  const DETAIL_TABS: { key: DetailTab; label: string; icon: any }[] = [
    { key: 'info', label: 'Información', icon: Building2 },
    { key: 'modules', label: 'Módulos', icon: LayoutGrid },
    { key: 'tasks', label: 'Tareas', icon: ListTodo },
    { key: 'docs', label: 'Documentos', icon: FileText },
    { key: 'activity', label: 'Actividad', icon: Activity },
  ]

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar title="Empresas" subtitle="Gestión de clientes y empresas" />

      <div className="flex-1 flex overflow-hidden">

        {/* ── Left sidebar: company list ── */}
        <div className="w-full max-w-sm border-r border-slate-200 flex flex-col bg-white shrink-0">

          {/* Header */}
          <div className="px-4 pt-4 pb-3 border-b border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Empresas</h2>
                <p className="text-xs text-slate-400">{allCompanies.length} empresas · {activeCount} activas</p>
              </div>
              <Button size="sm" onClick={() => setShowNew(true)}><Plus className="w-3.5 h-3.5" /> Nueva</Button>
            </div>

            {/* Search */}
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar empresa o NIT..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {/* Filters */}
            <div className="flex gap-1.5 flex-wrap">
              {FILTERS.map(f => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-colors ${filter === f.key
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Company list */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
            {isLoading ? (
              <div className="py-10 flex justify-center"><PageLoader /></div>
            ) : filtered.map((c: any) => {
              const st = STATUS_MAP[c.onboarding_status ?? c.status] ?? STATUS_MAP['nueva']!
              const isSelected = selectedId === c.id
              return (
                <button
                  key={c.id}
                  onClick={() => { setSelectedId(c.id); setDetailTab('info'); setEditing(false) }}
                  className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors ${isSelected ? 'bg-primary-50 border-l-4 border-primary-500' : 'hover:bg-slate-50 border-l-4 border-transparent'
                    }`}
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0 ${getAvatarColor(c.name ?? '')}`}>
                    {(c.name ?? '?')[0]!.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{c.name ?? c.legal_name ?? '—'}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-slate-400">{c.city ?? '—'}</span>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${st.cls}`}>
                        • {st.label}
                      </span>
                    </div>
                  </div>
                </button>
              )
            })}
            {!isLoading && !filtered.length && (
              <p className="text-center text-sm text-slate-400 py-8">Sin empresas</p>
            )}
          </div>
        </div>

        {/* ── Right panel: detail ── */}
        <div className="flex-1 overflow-y-auto bg-slate-50">
          {!selectedId ? (
            <div className="flex items-center justify-center h-full text-slate-400">
              <div className="text-center">
                <Building2 className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p className="text-sm">Selecciona una empresa para ver los detalles</p>
              </div>
            </div>
          ) : detailLoading ? (
            <div className="flex items-center justify-center h-full"><PageLoader /></div>
          ) : co ? (
            <div className="p-5 space-y-5">

              {/* Company header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg ${getAvatarColor(co.name ?? '')}`}>
                    {(co.name ?? '?')[0]!.toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">{co.name ?? co.legal_name}</h2>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-slate-400">NIT: {co.nit ?? '—'}</span>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${(STATUS_MAP[co.onboarding_status ?? co.status] ?? STATUS_MAP['nueva']!).cls}`}>
                        • {(STATUS_MAP[co.onboarding_status ?? co.status] ?? STATUS_MAP['nueva']!).label}
                      </span>
                      {co.city && <span className="text-xs text-slate-400">📍 {co.city}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="secondary" onClick={() => { setEditing(!editing); if (!editing) setEditForm({ name: co.name ?? '', nit: co.nit ?? '', city: co.city ?? '', dept: co.dept ?? '', sector: co.sector ?? '', size: co.size ?? '', contact: co.contact ?? '', email: co.email ?? '', phone: co.phone ?? '', asesor: co.asesor ?? '', notes: co.notes ?? '' }) }}>
                    <Pencil className="w-3.5 h-3.5" /> Editar
                  </Button>
                  <Button size="sm" variant="secondary">
                    <Eye className="w-3.5 h-3.5" /> Portal
                  </Button>
                  <div className="relative group">
                    <button
                      onClick={() => {
                        toast(
                          `¿Desactivar la empresa "${co.name}"?`,
                          {
                            description: 'La empresa quedará inactiva y no podrá acceder a la plataforma.',
                            action: {
                              label: 'Desactivar',
                              onClick: () => {
                                api.patch(`/api/companies/${selectedId}`, { status: 'inactive' })
                                  .then(() => { toast.success('Empresa desactivada correctamente'); qc.invalidateQueries({ queryKey: ['companies'] }); setSelectedId(null) })
                                  .catch((e: any) => toast.error(e.response?.data?.error ?? 'Error al desactivar'))
                              },
                            },
                            cancel: { label: 'Cancelar', onClick: () => { } },
                            duration: 10000,
                          },
                        )
                      }}
                      className="p-2 rounded-lg border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-xs font-medium text-white bg-slate-800 rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      Eliminar empresa
                    </span>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex gap-1 border-b border-slate-200">
                {DETAIL_TABS.map(t => (
                  <button
                    key={t.key}
                    onClick={() => setDetailTab(t.key)}
                    className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${detailTab === t.key
                        ? 'border-primary-500 text-primary-600'
                        : 'border-transparent text-slate-500 hover:text-slate-700'
                      }`}
                  >
                    <t.icon className="w-4 h-4" />
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              {detailTab === 'info' && (
                <div className="space-y-5">
                  {/* General data */}
                  <div className="bg-white border border-slate-200 rounded-xl p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-1 h-5 bg-primary-500 rounded-full" />
                      <h3 className="text-xs font-bold text-primary-600 uppercase tracking-wider">Datos generales</h3>
                    </div>

                    {editing ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          {[
                            { key: 'name', label: 'Razón social' },
                            { key: 'nit', label: 'NIT' },
                            { key: 'city', label: 'Ciudad' },
                            { key: 'dept', label: 'Departamento' },
                            { key: 'sector', label: 'Sector' },
                            { key: 'size', label: 'Tamaño' },
                            { key: 'contact', label: 'Contacto principal' },
                            { key: 'email', label: 'Email' },
                            { key: 'phone', label: 'Teléfono' },
                            { key: 'asesor', label: 'Asesor asignado' },
                          ].map(f => (
                            <div key={f.key}>
                              <label className="block text-xs font-medium text-slate-500 mb-1">{f.label}</label>
                              <input
                                value={editForm[f.key] ?? ''}
                                onChange={e => setEditForm(p => ({ ...p, [f.key]: e.target.value }))}
                                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                              />
                            </div>
                          ))}
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-500 mb-1">Notas internas</label>
                          <textarea
                            rows={3}
                            value={editForm.notes ?? ''}
                            onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))}
                            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                          />
                        </div>
                        <div className="flex gap-2 justify-end">
                          <Button variant="secondary" size="sm" onClick={() => setEditing(false)}>Cancelar</Button>
                          <Button size="sm" loading={updateMut.isPending} onClick={() => updateMut.mutate(editForm)}>Guardar</Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                          {[
                            { label: 'NIT', value: co.nit },
                            { label: 'Razón social', value: co.name ?? co.legal_name },
                            { label: 'Ciudad', value: co.city },
                            { label: 'Departamento', value: co.dept },
                            { label: 'Sector', value: co.sector },
                            { label: 'Tamaño', value: co.size },
                            { label: 'Contacto principal', value: co.contact },
                            { label: 'Email', value: co.email },
                            { label: 'Teléfono', value: co.phone },
                            { label: 'Fecha vinculación', value: co.created_at ? fmtDate(co.created_at) : null },
                            { label: 'Asesor asignado', value: co.asesor },
                            { label: 'Plan', value: activeModules > 0 ? `${activeModules} módulo(s) activo(s)` : null },
                          ].map((f, i) => (
                            <div key={i}>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{f.label}</p>
                              <p className="text-sm font-medium text-slate-900 mt-0.5">{f.value || '—'}</p>
                            </div>
                          ))}
                        </div>

                        {/* Notes */}
                        <div className="mt-6 pt-5 border-t border-slate-100">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Notas internas</p>
                          <div className="bg-slate-50 rounded-lg p-3 min-h-[60px]">
                            <p className="text-sm text-slate-600">{co.notes || 'Sin notas.'}</p>
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {/* KPI cards */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tareas activas</p>
                      <p className="text-3xl font-bold text-slate-900 mt-1">{pendingTasks.length || '—'}</p>
                      {overdueTasks.length > 0 && (
                        <p className="text-xs text-red-500 mt-1">{overdueTasks.length} vencidas</p>
                      )}
                    </div>
                    <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Documentos</p>
                      <p className="text-3xl font-bold text-slate-900 mt-1">{allDocs.length || '—'}</p>
                      <p className="text-xs text-slate-400 mt-1">Este mes</p>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Módulos activos</p>
                      <p className="text-3xl font-bold text-primary-600 mt-1">{activeModules}</p>
                      <p className="text-xs text-slate-400 mt-1">de {services.length || activeModules} disponibles</p>
                    </div>
                  </div>
                </div>
              )}

              {detailTab === 'modules' && (
                <ModulesPanel companyId={selectedId!} />
              )}

              {detailTab === 'tasks' && (
                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <h3 className="text-sm font-bold text-slate-900 mb-4">
                    Tareas ({pendingTasks.length} pendientes · {overdueTasks.length} vencidas)
                  </h3>
                  {allTasks.length ? (
                    <div className="space-y-2">
                      {allTasks.slice(0, 20).map((t: any) => {
                        const isOverdue = t.status !== 'done' && t.status !== 'completed' && t.due_date && t.due_date < today
                        return (
                          <div key={t.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                            <div>
                              <p className="text-sm font-medium text-slate-900">{t.title}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                {isOverdue && <span className="text-xs text-red-600 font-medium">🔴 Vencida</span>}
                                {t.due_date && <span className="text-xs text-slate-400">📅 {fmtDate(t.due_date)}</span>}
                              </div>
                            </div>
                            <span className={`text-xs font-medium px-2 py-1 rounded-full ${t.status === 'done' || t.status === 'completed' ? 'bg-emerald-50 text-emerald-700' :
                                isOverdue ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
                              }`}>
                              {t.status === 'done' || t.status === 'completed' ? 'Completada' : isOverdue ? 'Vencida' : 'Pendiente'}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400 text-center py-8">Sin tareas para esta empresa</p>
                  )}
                </div>
              )}

              {detailTab === 'docs' && (
                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <h3 className="text-sm font-bold text-slate-900 mb-4">Documentos</h3>
                  {allDocs.length ? (
                    <div className="space-y-2">
                      {allDocs.map((doc: any) => (
                        <div key={doc.id} className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0">
                          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                            <FileText className="w-4 h-4 text-slate-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-900 truncate">{doc.title ?? doc.name ?? doc.file_name ?? '—'}</p>
                            <p className="text-xs text-slate-400">{doc.category ?? 'general'} · {doc.created_at ? fmtDate(doc.created_at) : '—'}</p>
                          </div>
                          <span className={`text-xs font-medium px-2 py-1 rounded-full ${doc.status === 'available' || doc.status === 'approved' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                            }`}>
                            {doc.status === 'available' || doc.status === 'approved' ? 'Disponible' : doc.status ?? '—'}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400 text-center py-8">Sin documentos para esta empresa</p>
                  )}
                </div>
              )}

              {detailTab === 'activity' && (
                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <h3 className="text-sm font-bold text-slate-900 mb-4">Actividad reciente</h3>
                  <p className="text-sm text-slate-400 text-center py-8">Próximamente: historial de acciones y cambios</p>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {showNew && (
        <NewCompanyModal
          onClose={() => setShowNew(false)}
          onCreated={(id) => { setSelectedId(id); setDetailTab('info') }}
        />
      )}
    </div>
  )
}
