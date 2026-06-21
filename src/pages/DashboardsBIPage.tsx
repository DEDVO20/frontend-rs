import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { TopBar } from '@/components/layout/TopBar'
import { Button } from '@/components/ui/Button'
import { PageLoader } from '@/components/ui/Spinner'
import { useAuthStore } from '@/stores/authStore'
import { toast } from 'sonner'
import {
  Plus, BarChart3, ExternalLink, Trash2, Pencil, X, Eye, Maximize2,
} from 'lucide-react'

const INTERNAL_ROLES = ['admin', 'rs_admin', 'rs_staff']

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function DashboardsBIPage() {
  const qc = useQueryClient()
  const { user } = useAuthStore()
  const isAdmin = INTERNAL_ROLES.includes(user?.role ?? '')
  const [showNew, setShowNew] = useState(false)
  const [editTarget, setEditTarget] = useState<any | null>(null)
  const [viewTarget, setViewTarget] = useState<any | null>(null)

  const { data: dashboards, isLoading } = useQuery({
    queryKey: ['dashboards-bi'],
    queryFn: async () => { const { data } = await api.get('/api/dashboards'); return data },
  })

  const deleteMut = useMutation({
    mutationFn: async (id: string) => { await api.delete(`/api/dashboards/${id}`) },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['dashboards-bi'] }); toast.success('Dashboard eliminado') },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Error'),
  })

  const all: any[] = dashboards ?? []

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar title="Dashboards BI" subtitle="Reportes y análisis integrados" />

      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Dashboards integrados</h2>
            <p className="text-sm text-slate-400">{all.length} dashboard{all.length !== 1 ? 's' : ''} activo{all.length !== 1 ? 's' : ''}</p>
          </div>
          {isAdmin && (
            <Button onClick={() => { setEditTarget(null); setShowNew(true) }}>
              <Plus className="w-4 h-4" /> Agregar dashboard
            </Button>
          )}
        </div>

        {isLoading ? <PageLoader /> : all.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
            <BarChart3 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-500">No hay dashboards configurados</p>
            {isAdmin && (
              <Button className="mt-4" onClick={() => setShowNew(true)}>
                <Plus className="w-4 h-4" /> Agregar primer dashboard
              </Button>
            )}
          </div>
        ) : (
          <>
            {/* Grid de dashboards */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {all.map((d: any) => (
                <div key={d.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden group hover:shadow-md transition-shadow">
                  {/* Preview */}
                  <div className="relative bg-slate-100 h-44 overflow-hidden">
                    <iframe
                      src={d.embed_url}
                      className="w-full h-full pointer-events-none"
                      title={d.title}
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <button
                        onClick={() => setViewTarget(d)}
                        className="px-4 py-2 bg-white rounded-lg text-sm font-medium text-slate-800 shadow-lg flex items-center gap-2 hover:bg-slate-50 transition-colors"
                      >
                        <Maximize2 className="w-4 h-4" /> Ver completo
                      </button>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-slate-900 truncate">{d.title}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                            d.tool === 'powerbi' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                          }`}>
                            {d.tool === 'powerbi' ? 'Power BI' : 'Looker'}
                          </span>
                          {d.created_at && <span className="text-xs text-slate-400">{fmtDate(d.created_at)}</span>}
                        </div>
                      </div>
                      {isAdmin && (
                        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => { setEditTarget(d); setShowNew(true) }}
                            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => toast('¿Eliminar este dashboard?', {
                            action: { label: 'Eliminar', onClick: () => deleteMut.mutate(d.id) },
                            cancel: { label: 'Cancelar', onClick: () => {} },
                            duration: 8000,
                          })}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Modal crear/editar */}
      {showNew && (
        <DashboardModal
          editing={editTarget}
          onClose={() => { setShowNew(false); setEditTarget(null) }}
        />
      )}

      {/* Fullscreen viewer */}
      {viewTarget && (
        <DashboardViewer
          dashboard={viewTarget}
          onClose={() => setViewTarget(null)}
        />
      )}
    </div>
  )
}

// ── Modal crear/editar ────────────────────────────────────────────────────────

function DashboardModal({ editing, onClose }: { editing: any | null; onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    title:      editing?.title ?? '',
    tool:       editing?.tool ?? 'powerbi',
    embed_url:  editing?.embed_url ?? '',
    company_id: editing?.company_id ?? '',
    active:     editing?.active ?? true,
  })
  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }))

  const { data: companies } = useQuery({
    queryKey: ['companies-list'],
    queryFn: async () => { const { data } = await api.get('/api/companies?limit=100'); return data },
    staleTime: 120_000,
  })
  const companyList: any[] = companies?.data ?? (Array.isArray(companies) ? companies : [])

  const saveMut = useMutation({
    mutationFn: async () => {
      if (editing) {
        await api.patch(`/api/dashboards/${editing.id}`, form)
      } else {
        await api.post('/api/dashboards', form)
      }
    },
    onSuccess: () => {
      toast.success(editing ? 'Dashboard actualizado' : 'Dashboard creado')
      qc.invalidateQueries({ queryKey: ['dashboards-bi'] })
      onClose()
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Error'),
  })

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
            <h2 className="text-lg font-bold text-slate-900">{editing ? 'Editar dashboard' : 'Agregar dashboard'}</h2>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500"><X className="w-5 h-5" /></button>
          </div>
          <div className="p-6 space-y-4">
            <label className="block">
              <span className="text-xs font-medium text-slate-500">Título *</span>
              <input value={form.title} onChange={e => set('title', e.target.value)}
                placeholder="Ej: Reporte de cartera mensual"
                className="w-full mt-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-500">Herramienta</span>
              <select value={form.tool} onChange={e => set('tool', e.target.value)}
                className="w-full mt-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500">
                <option value="powerbi">Power BI</option>
                <option value="looker">Looker</option>
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-500">URL de embed *</span>
              <input value={form.embed_url} onChange={e => set('embed_url', e.target.value)}
                placeholder="https://app.powerbi.com/reportEmbed?..."
                className="w-full mt-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500" />
              <p className="text-[10px] text-slate-400 mt-1">
                En Power BI: Archivo → Insertar informe → Sitio web o portal → Copiar URL
              </p>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-500">Empresa *</span>
              <select value={form.company_id} onChange={e => set('company_id', e.target.value)}
                className="w-full mt-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500">
                <option value="">Seleccionar empresa…</option>
                {companyList.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
          </div>
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50">
            <Button variant="secondary" onClick={onClose}>Cancelar</Button>
            <Button onClick={() => saveMut.mutate()} loading={saveMut.isPending}
              disabled={!form.title.trim() || !form.embed_url.trim() || !form.company_id}>
              {editing ? 'Guardar cambios' : 'Agregar dashboard →'}
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}

// ── Fullscreen viewer ─────────────────────────────────────────────────────────

function DashboardViewer({ dashboard, onClose }: { dashboard: any; onClose: () => void }) {
  return (
    <>
      <div className="fixed inset-0 bg-black/80 z-50" onClick={onClose} />
      <div className="fixed inset-4 z-50 bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50 shrink-0">
          <div className="flex items-center gap-3">
            <BarChart3 className="w-5 h-5 text-primary-500" />
            <div>
              <h2 className="text-sm font-bold text-slate-900">{dashboard.title}</h2>
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                dashboard.tool === 'powerbi' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
              }`}>
                {dashboard.tool === 'powerbi' ? 'Power BI' : 'Looker'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a href={dashboard.embed_url} target="_blank" rel="noreferrer"
              className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
              <ExternalLink className="w-4 h-4" />
            </a>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-200 text-slate-500 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="flex-1">
          <iframe
            src={dashboard.embed_url}
            className="w-full h-full border-0"
            title={dashboard.title}
            allowFullScreen
          />
        </div>
      </div>
    </>
  )
}
