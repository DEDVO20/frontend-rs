import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { TopBar } from '@/components/layout/TopBar'
import { Button } from '@/components/ui/Button'
import { PageLoader } from '@/components/ui/Spinner'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { toast } from 'sonner'
import type { LucideIcon } from 'lucide-react'
import {
  Plus, Search, Pencil, X, Briefcase, Building2, Repeat,
  CheckCircle2, XCircle, Power, RotateCcw,
} from 'lucide-react'

type Service = { id: string; name: string; description: string | null; active: boolean }
type Stats = Record<string, { companies: number; templates: number; active_templates: number }>

type ApiError = { response?: { data?: { error?: string } } }

const EMPTY_STATS = { companies: 0, templates: 0, active_templates: 0 }

export function ServicesAdminPage() {
  const qc = useQueryClient()
  const confirm = useConfirm()
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState<'' | 'true' | 'false'>('')
  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState<Service | null>(null)

  const { data: services, isLoading } = useQuery({
    queryKey: ['services-admin'],
    queryFn: async () => { const { data } = await api.get('/api/services'); return data as Service[] },
  })

  const { data: stats } = useQuery({
    queryKey: ['services-stats'],
    queryFn: async () => { const { data } = await api.get('/api/services/stats'); return data as Stats },
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['services-admin'] })
    qc.invalidateQueries({ queryKey: ['all-services'] })
  }

  const toggleMut = useMutation({
    mutationFn: async (s: Service) => {
      if (s.active) await api.delete(`/api/services/${s.id}`)
      else await api.patch(`/api/services/${s.id}`, { active: true })
    },
    onSuccess: (_, s) => { invalidate(); toast.success(s.active ? 'Servicio desactivado' : 'Servicio reactivado') },
    onError: (e: ApiError) => toast.error(e.response?.data?.error ?? 'Error'),
  })

  const all = services ?? []
  const hasFilters = !!(search || activeFilter)

  const filtered = all.filter(s => {
    if (activeFilter && String(s.active) !== activeFilter) return false
    if (search) {
      const q = search.toLowerCase()
      if (!s.name.toLowerCase().includes(q) && !(s.description ?? '').toLowerCase().includes(q)) return false
    }
    return true
  })

  const activeCount = all.filter(s => s.active).length
  const totalCompanies = Object.values(stats ?? {}).reduce((n, s) => n + s.companies, 0)

  const askToggle = (s: Service) => {
    const st = stats?.[s.id] ?? EMPTY_STATS
    confirm(s.active
      ? {
          title: `¿Desactivar "${s.name}"?`,
          description: st.companies
            ? `${st.companies} empresa(s) lo tienen asignado; sus asignaciones se conservan, pero no podrá asignarse a nuevas empresas ni aparecerá en el registro.`
            : 'No podrá asignarse a nuevas empresas ni aparecerá en el formulario de registro.',
          type: 'warning',
          confirmLabel: 'Desactivar',
          onConfirm: () => toggleMut.mutateAsync(s),
        }
      : {
          title: `¿Reactivar "${s.name}"?`,
          type: 'info',
          confirmLabel: 'Reactivar',
          onConfirm: () => toggleMut.mutateAsync(s),
        })
  }

  const openEdit = (s: Service | null) => { setEditTarget(s); setShowModal(true) }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar title="Servicios" subtitle="Catálogo de servicios que ofrece Finto" />

      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Administración de servicios</h2>
            <p className="text-sm text-slate-400">Los servicios activos se asignan a empresas y agrupan las tareas recurrentes</p>
          </div>
          <Button onClick={() => openEdit(null)}>
            <Plus className="w-4 h-4" /> Nuevo servicio
          </Button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Kpi label="Servicios" value={all.length} icon={Briefcase} />
          <Kpi label="Activos" value={activeCount} icon={CheckCircle2}
            active={activeFilter === 'true'} onClick={() => setActiveFilter(activeFilter === 'true' ? '' : 'true')} />
          <Kpi label="Inactivos" value={all.length - activeCount} icon={XCircle}
            active={activeFilter === 'false'} onClick={() => setActiveFilter(activeFilter === 'false' ? '' : 'false')} />
          <Kpi label="Asignaciones activas" value={totalCompanies} icon={Building2} />
        </div>

        {/* Filters */}
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Buscar servicio..."
                className="w-full pl-10 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <select value={activeFilter} onChange={e => setActiveFilter(e.target.value as '' | 'true' | 'false')}
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white">
              <option value="">Estado</option>
              <option value="true">Activo</option>
              <option value="false">Inactivo</option>
            </select>
            {hasFilters && (
              <button onClick={() => { setSearch(''); setActiveFilter('') }}
                className="text-xs text-slate-500 flex items-center gap-1 hover:text-slate-700 whitespace-nowrap">
                <X className="w-3 h-3" /> Limpiar filtros
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900">Servicios</h3>
            <span className="text-xs text-slate-400">{filtered.length} de {all.length}</span>
          </div>

          {isLoading ? <div className="py-10"><PageLoader /></div> : (
            <>
              {/* Mobile cards */}
              <div className="md:hidden divide-y divide-slate-50">
                {filtered.map(s => {
                  const st = stats?.[s.id] ?? EMPTY_STATS
                  return (
                    <div key={s.id} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900">{s.name}</p>
                          {s.description && <p className="text-xs text-slate-400 line-clamp-2">{s.description}</p>}
                          <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                            <StatusLabel active={s.active} />
                            <span>{st.companies} empresas</span>
                            <span>{st.active_templates} plantillas</span>
                          </div>
                        </div>
                        <RowActions service={s} onEdit={() => openEdit(s)} onToggle={() => askToggle(s)} />
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
                      {['Servicio', 'Empresas', 'Tareas recurrentes', 'Estado', ''].map(h => (
                        <th key={h} className={`${h === '' ? 'text-right' : 'text-left'} px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filtered.map(s => {
                      const st = stats?.[s.id] ?? EMPTY_STATS
                      return (
                        <tr key={s.id} className={`hover:bg-slate-50 transition-colors group ${s.active ? '' : 'opacity-60'}`}>
                          <td className="px-4 py-3">
                            <p className="font-medium text-slate-900">{s.name}</p>
                            {s.description && <p className="text-xs text-slate-400 truncate max-w-[420px]">{s.description}</p>}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500">
                            <span className="inline-flex items-center gap-1"><Building2 className="w-3 h-3" /> {st.companies}</span>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500">
                            <span className="inline-flex items-center gap-1"><Repeat className="w-3 h-3" /> {st.active_templates}</span>
                            {st.templates > st.active_templates && (
                              <span className="text-slate-300"> · {st.templates - st.active_templates} inactivas</span>
                            )}
                          </td>
                          <td className="px-4 py-3"><StatusLabel active={s.active} /></td>
                          <td className="px-4 py-3 text-right">
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                              <RowActions service={s} onEdit={() => openEdit(s)} onToggle={() => askToggle(s)} />
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
                  <Briefcase className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                  <p className="text-sm">{hasFilters ? 'Sin resultados con esos filtros' : 'No hay servicios registrados'}</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {showModal && (
        <ServiceModal
          editing={editTarget}
          onSaved={invalidate}
          onClose={() => { setShowModal(false); setEditTarget(null) }}
        />
      )}
    </div>
  )
}

function Kpi({ label, value, icon: Icon, active, onClick }: {
  label: string; value: number; icon: LucideIcon; active?: boolean; onClick?: () => void
}) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag onClick={onClick}
      className={`bg-white border rounded-xl p-4 text-left transition-colors ${
        active ? 'border-primary-500 bg-primary-50' : 'border-slate-200'
      } ${onClick ? 'hover:border-slate-300' : ''}`}>
      <div className="flex items-center gap-2 text-slate-400">
        <Icon className="w-4 h-4" />
        <span className="text-[10px] font-medium uppercase">{label}</span>
      </div>
      <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
    </Tag>
  )
}

function StatusLabel({ active }: { active: boolean }) {
  return active
    ? <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600"><CheckCircle2 className="w-3 h-3" /> Activo</span>
    : <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-400"><XCircle className="w-3 h-3" /> Inactivo</span>
}

function RowActions({ service, onEdit, onToggle }: { service: Service; onEdit: () => void; onToggle: () => void }) {
  return (
    <div className="flex items-center justify-end gap-1 shrink-0">
      <button onClick={onEdit} title="Editar"
        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"><Pencil className="w-3.5 h-3.5" /></button>
      {service.active ? (
        <button onClick={onToggle} title="Desactivar"
          className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500"><Power className="w-3.5 h-3.5" /></button>
      ) : (
        <button onClick={onToggle} title="Reactivar"
          className="p-1.5 rounded-lg hover:bg-emerald-50 text-slate-400 hover:text-emerald-600"><RotateCcw className="w-3.5 h-3.5" /></button>
      )}
    </div>
  )
}

// ── Service Modal ─────────────────────────────────────────────────────────────

function ServiceModal({ editing, onSaved, onClose }: { editing: Service | null; onSaved: () => void; onClose: () => void }) {
  const [form, setForm] = useState({
    name:        editing?.name ?? '',
    description: editing?.description ?? '',
    active:      editing?.active ?? true,
  })
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm(p => ({ ...p, [k]: v }))

  const saveMut = useMutation({
    mutationFn: async () => {
      const body = { name: form.name.trim(), description: form.description.trim() || null, active: form.active }
      if (editing) await api.patch(`/api/services/${editing.id}`, body)
      else await api.post('/api/services', body)
    },
    onSuccess: () => {
      toast.success(editing ? 'Servicio actualizado' : 'Servicio creado')
      onSaved()
      onClose()
    },
    onError: (e: ApiError) => toast.error(e.response?.data?.error ?? 'Error'),
  })

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white z-50 shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <h2 className="text-lg font-bold text-slate-900">{editing ? 'Editar servicio' : 'Nuevo servicio'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <label className="block">
            <span className="text-xs font-medium text-slate-500">Nombre *</span>
            <input value={form.name} onChange={e => set('name', e.target.value)} maxLength={120}
              placeholder="Ej: Contabilidad"
              className="w-full mt-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </label>
          {editing && editing.name.toLowerCase().includes('contab') && !form.name.toLowerCase().includes('contab') && (
            <p className="text-[11px] text-amber-600 -mt-2">
              Al asignar un servicio cuyo nombre contiene "Contab" se genera la ficha tributaria del cliente; renombrarlo desactiva ese comportamiento.
            </p>
          )}
          <label className="block">
            <span className="text-xs font-medium text-slate-500">Descripción</span>
            <textarea rows={4} value={form.description} onChange={e => set('description', e.target.value)} maxLength={1000}
              placeholder="Se muestra en el formulario de registro de empresas"
              className="w-full mt-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none" />
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.active} onChange={e => set('active', e.target.checked)}
              className="rounded border-slate-300" />
            <span className="text-sm text-slate-700">Activo</span>
          </label>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => saveMut.mutate()} loading={saveMut.isPending}
            disabled={form.name.trim().length < 2}>
            {editing ? 'Guardar cambios' : 'Crear servicio →'}
          </Button>
        </div>
      </div>
    </>
  )
}
