import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { TopBar } from '@/components/layout/TopBar'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { PageLoader } from '@/components/ui/Spinner'
import { toast } from 'sonner'
import {
  Plus, Search, Eye, Trash2, X, Paperclip, FileText,
} from 'lucide-react'

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

const STATUS_MAP: Record<string, { label: string; color: any }> = {
  open:        { label: 'Abierta',    color: 'yellow' },
  in_progress: { label: 'En proceso', color: 'blue' },
  resolved:    { label: 'Resuelta',   color: 'green' },
  closed:      { label: 'Cerrada',    color: 'gray' },
  cancelled:   { label: 'Cancelada',  color: 'gray' },
}

const PRIORITY_MAP: Record<string, { label: string; color: any }> = {
  low:    { label: 'Baja',    color: 'gray' },
  medium: { label: 'Media',   color: 'yellow' },
  high:   { label: 'Alta',    color: 'orange' },
  urgent: { label: 'Urgente', color: 'red' },
}

export function RequestsPage() {
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [searchQ, setSearchQ] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [companyFilter, setCompanyFilter] = useState('')
  const [showNew, setShowNew] = useState(false)

  const { data: companiesData } = useQuery({
    queryKey: ['companies-list'],
    queryFn: async () => { const { data } = await api.get('/api/companies?limit=100'); return data },
    staleTime: 120_000,
  })
  const companies: any[] = companiesData?.data ?? (Array.isArray(companiesData) ? companiesData : [])

  const { data, isLoading } = useQuery({
    queryKey: ['requests', page, statusFilter, companyFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: '50' })
      if (statusFilter) params.set('status', statusFilter)
      if (companyFilter) params.set('company_id', companyFilter)
      const { data } = await api.get(`/api/requests?${params}`)
      return data
    },
  })

  const allRequests: any[] = data?.data ?? []
  const total = data?.total ?? 0

  const filtered = searchQ
    ? allRequests.filter(r => (r.title ?? '').toLowerCase().includes(searchQ.toLowerCase()))
    : allRequests

  const openCount       = allRequests.filter(r => r.status === 'open').length
  const inProgressCount = allRequests.filter(r => r.status === 'in_progress').length
  const resolvedCount   = allRequests.filter(r => r.status === 'resolved' || r.status === 'closed').length

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await api.patch(`/api/requests/${id}`, { status })
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['requests'] }); toast.success('Estado actualizado') },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Error'),
  })

  const companyName = (id: string) => companies.find(c => c.id === id)?.name ?? '—'

  const todayStr = new Date().toLocaleDateString('es-CO', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar title="Solicitudes" subtitle="Solicitudes operativas" />

      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400">Admin / <span className="text-primary-600 font-medium">Solicitudes</span></p>
            <h2 className="text-xl font-bold text-slate-900">Solicitudes operativas</h2>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400">{todayStr}</span>
            <Button size="sm" onClick={() => setShowNew(true)}><Plus className="w-3.5 h-3.5" /> Nueva solicitud</Button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total', value: total, sub: 'todas las solicitudes', color: 'border-t-primary-500' },
            { label: 'Abiertas', value: openCount, sub: 'esperan atención', color: 'border-t-amber-500' },
            { label: 'En proceso', value: inProgressCount, sub: 'siendo gestionadas', color: 'border-t-blue-500' },
            { label: 'Resueltas', value: resolvedCount, sub: 'completadas', color: 'border-t-emerald-500' },
          ].map(k => (
            <div key={k.label} className={`bg-white border border-slate-200 rounded-xl p-4 border-t-4 ${k.color}`}>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{k.label}</p>
              <p className={`text-3xl font-bold mt-1 ${k.label === 'Abiertas' ? 'text-amber-500' : k.label === 'Resueltas' ? 'text-emerald-600' : 'text-slate-900'}`}>
                {k.value}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">{k.sub}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input value={searchQ} onChange={e => setSearchQ(e.target.value)}
                placeholder="Buscar solicitud, empresa..."
                className="w-full pl-10 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div className="flex gap-1.5">
              {[
                { key: '', label: 'Todas' },
                { key: 'open', label: '🟡 Abiertas' },
                { key: 'in_progress', label: '🔵 En proceso' },
                { key: 'resolved', label: '🟢 Resueltas' },
                { key: 'closed', label: '⚪ Cerradas' },
              ].map(s => (
                <button key={s.key} onClick={() => { setStatusFilter(s.key); setPage(1) }}
                  className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-colors ${
                    statusFilter === s.key ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}>{s.label}</button>
              ))}
            </div>
          </div>
          {/* Company filter dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 shrink-0">Por empresa:</span>
            <select
              value={companyFilter}
              onChange={e => { setCompanyFilter(e.target.value); setPage(1) }}
              className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500 max-w-xs"
            >
              <option value="">Todas las empresas</option>
              {companies.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            {companyFilter && (
              <button onClick={() => { setCompanyFilter(''); setPage(1) }} className="text-slate-400 hover:text-slate-600">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900">Solicitudes</h3>
            <span className="text-xs text-slate-400">{total} solicitud{total !== 1 ? 'es' : ''}</span>
          </div>

          {isLoading ? (
            <div className="py-10"><PageLoader /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    {['Solicitud', 'Empresa', 'Tipo', 'Estado', 'Prioridad', 'Fecha', 'Acciones'].map(h => (
                      <th key={h} className={`${h === 'Acciones' ? 'text-right' : 'text-left'} px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filtered.map((r: any) => {
                    const pr = PRIORITY_MAP[r.priority] ?? { label: r.priority, color: 'gray' }
                    return (
                      <tr key={r.id} className="hover:bg-slate-50 transition-colors group">
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-900">{r.title}</p>
                          {r.description && <p className="text-xs text-slate-400 truncate max-w-[200px]">{r.description}</p>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-md bg-primary-100 flex items-center justify-center text-[10px] font-bold text-primary-700 shrink-0">
                              {(companyName(r.company_id)?.[0] ?? '?').toUpperCase()}
                            </span>
                            <span className="text-xs text-slate-700">{companyName(r.company_id)}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">
                          {r.operational_request_types?.name ?? '—'}
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={r.status}
                            onChange={e => updateStatus.mutate({ id: r.id, status: e.target.value })}
                            className="text-xs font-medium border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary-500"
                          >
                            {Object.entries(STATUS_MAP).map(([k, v]) => (
                              <option key={k} value={k}>{v.label}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <Badge label={pr.label} color={pr.color} />
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-400">
                          {r.requested_at ? fmtDate(r.requested_at) : r.created_at ? fmtDate(r.created_at) : '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-primary-600 transition-colors" title="Ver detalle">
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => toast('¿Eliminar esta solicitud?', {
                                action: { label: 'Eliminar', onClick: () => {
                                  api.delete(`/api/requests/${r.id}`).then(() => {
                                    toast.success('Solicitud eliminada')
                                    qc.invalidateQueries({ queryKey: ['requests'] })
                                  }).catch(() => toast.error('Error'))
                                }},
                                cancel: { label: 'Cancelar', onClick: () => {} },
                                duration: 8000,
                              })}
                              className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors" title="Eliminar">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  {!filtered.length && (
                    <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-400">No hay solicitudes</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

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

      {showNew && <NewRequestModal companies={companies} onClose={() => setShowNew(false)} />}
    </div>
  )
}

// ── New Request Modal ─────────────────────────────────────────────────────────

function NewRequestModal({ onClose }: { companies: any[]; onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ request_type_id: '', title: '', description: '', priority: 'medium' })
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))
  const [files, setFiles] = useState<File[]>([])
  const fileRef = useRef<HTMLInputElement>(null)

  const { data: types } = useQuery({
    queryKey: ['request-types'],
    queryFn: async () => { const { data } = await api.get('/api/requests/types'); return data },
  })

  const addFiles = (newFiles: FileList | null) => {
    if (!newFiles) return
    setFiles(prev => [...prev, ...Array.from(newFiles)])
  }

  const removeFile = (idx: number) => setFiles(prev => prev.filter((_, i) => i !== idx))

  const createMut = useMutation({
    mutationFn: async () => {
      // 1. Crear solicitud
      const { data: request } = await api.post('/api/requests', form)

      // 2. Subir archivos adjuntos (directo a Supabase)
      const { uploadFile } = await import('@/lib/upload')
      for (const file of files) {
        await uploadFile(file, `Adjunto: ${file.name}`, 'request_attachment').catch(() => {})
      }

      return request
    },
    onSuccess: () => { toast.success('Solicitud creada'); qc.invalidateQueries({ queryKey: ['requests'] }); onClose() },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Error'),
  })

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
            <h2 className="text-lg font-bold text-slate-900">Nueva solicitud</h2>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500"><X className="w-5 h-5" /></button>
          </div>
          <div className="p-6 space-y-4">
            <label className="block">
              <span className="text-xs font-medium text-slate-500">Tipo de solicitud *</span>
              <select value={form.request_type_id} onChange={e => set('request_type_id', e.target.value)}
                className="w-full mt-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500">
                <option value="">Seleccionar…</option>
                {(types ?? []).map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-500">Título *</span>
              <input value={form.title} onChange={e => set('title', e.target.value)}
                placeholder="Ej: Control de vacaciones"
                className="w-full mt-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-500">Descripción</span>
              <textarea rows={3} value={form.description} onChange={e => set('description', e.target.value)}
                placeholder="Detalles de la solicitud..."
                className="w-full mt-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none" />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-500">Prioridad</span>
              <select value={form.priority} onChange={e => set('priority', e.target.value)}
                className="w-full mt-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500">
                <option value="low">Baja</option>
                <option value="medium">Media</option>
                <option value="high">Alta</option>
                <option value="urgent">Urgente</option>
              </select>
            </label>

            {/* Archivos adjuntos */}
            <div>
              <span className="text-xs font-medium text-slate-500">Archivos adjuntos</span>
              <input ref={fileRef} type="file" className="hidden" multiple
                accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls,.doc,.docx,.csv"
                onChange={e => { addFiles(e.target.files); e.target.value = '' }} />

              {files.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded-lg">
                      <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="text-xs text-slate-700 flex-1 truncate">{f.name}</span>
                      <span className="text-[10px] text-slate-400 shrink-0">{(f.size / 1024).toFixed(0)} KB</span>
                      <button onClick={() => removeFile(i)} className="text-slate-400 hover:text-red-500 shrink-0">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="mt-2 w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-slate-200 rounded-lg text-xs font-medium text-slate-500 hover:border-primary-300 hover:text-primary-600 transition-colors"
              >
                <Paperclip className="w-4 h-4" />
                {files.length ? 'Agregar más archivos' : 'Adjuntar archivos (PDF, imágenes, Excel)'}
              </button>
            </div>
          </div>
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50">
            <Button variant="secondary" onClick={onClose}>Cancelar</Button>
            <Button onClick={() => createMut.mutate()} loading={createMut.isPending}
              disabled={!form.title.trim() || !form.request_type_id}>
              Crear solicitud →
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
