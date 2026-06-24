import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { TopBar } from '@/components/layout/TopBar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { PageLoader } from '@/components/ui/Spinner'
import { formatDate } from '@/lib/utils'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import {
  Search, Upload, Download, Eye, Trash2, X, Grid3x3, List,
  FileText, Edit3, Send,
} from 'lucide-react'

// ── helpers ────────────────────────────────────────────────────────────────────

const STATUS_META: Record<string, { label: string; color: any }> = {
  published: { label: 'Publicado',  color: 'green'  },
  review:    { label: 'En revisión', color: 'yellow' },
  draft:     { label: 'Borrador',   color: 'gray'   },
}

function extLabel(mime: string | null, name: string | null) {
  if (name) {
    const ext = name.split('.').pop()?.toUpperCase()
    if (ext) return ext
  }
  if (!mime) return 'FILE'
  if (mime.includes('pdf'))   return 'PDF'
  if (mime.includes('sheet') || mime.includes('excel')) return 'XLS'
  if (mime.includes('word'))  return 'DOC'
  if (mime.includes('png'))   return 'PNG'
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'JPG'
  return 'FILE'
}

function extColor(ext: string) {
  if (ext === 'PDF') return 'bg-red-100 text-red-700'
  if (['XLS','XLSX'].includes(ext)) return 'bg-emerald-100 text-emerald-700'
  if (['DOC','DOCX'].includes(ext)) return 'bg-blue-100 text-blue-700'
  return 'bg-slate-100 text-slate-600'
}

const MODULE_FOLDERS = [
  { id: 'facturacion', label: 'Facturación',  emoji: '🧾' },
  { id: 'contabilidad',label: 'Contabilidad', emoji: '📋' },
  { id: 'tesoreria',   label: 'Tesorería',    emoji: '🏦' },
  { id: 'personal',    label: 'Personal',      emoji: '👥' },
]

const TYPE_FOLDERS = [
  { id: 'pdf',   label: 'PDF',   emoji: '📕' },
  { id: 'excel', label: 'Excel', emoji: '📗' },
  { id: 'word',  label: 'Word',  emoji: '📘' },
]

// ── Upload modal ───────────────────────────────────────────────────────────────

function UploadModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [title, setTitle]       = useState('')
  const [category, setCategory] = useState('general')
  const [file, setFile]         = useState<File | null>(null)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const handleSubmit = async () => {
    if (!file || !title.trim()) { setError('Complete todos los campos.'); return }
    setLoading(true); setError('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('title', title.trim())
      fd.append('category', category)
      await api.post('/api/documents/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      onSuccess()
      onClose()
    } catch (e: any) {
      setError(e.response?.data?.error ?? 'Error al subir el archivo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-slate-900">Subir documento</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          {/* File drop */}
          <div
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center cursor-pointer hover:border-primary-400 hover:bg-primary-50/50 transition-colors"
          >
            <Upload className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            {file ? (
              <p className="text-sm font-medium text-slate-700">{file.name}</p>
            ) : (
              <p className="text-sm text-slate-400">Haga clic para seleccionar un archivo</p>
            )}
            <input ref={fileRef} type="file" className="hidden" onChange={e => setFile(e.target.files?.[0] ?? null)} />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Título *</label>
            <input
              value={title} onChange={e => setTitle(e.target.value)}
              placeholder="Ej: Cierre contable Junio 2026"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Módulo / Categoría</label>
            <select
              value={category} onChange={e => setCategory(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="general">General</option>
              <option value="facturacion">Facturación</option>
              <option value="contabilidad">Contabilidad</option>
              <option value="tesoreria">Tesorería</option>
              <option value="personal">Personal</option>
            </select>
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex gap-2 pt-1">
            <Button variant="secondary" className="flex-1" onClick={onClose}>Cancelar</Button>
            <Button className="flex-1" onClick={handleSubmit} loading={loading}>
              <Upload className="w-4 h-4" /> Subir
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Detail panel ───────────────────────────────────────────────────────────────

function DetailPanel({ doc, onClose, onDeleted }: { doc: any; onClose: () => void; onDeleted: () => void }) {
  const qc = useQueryClient()
  const confirm = useConfirm()
  const ext = extLabel(doc.mime_type, doc.original_name)
  const sm  = STATUS_META[doc.status ?? 'published'] ?? STATUS_META.published

  const deleteMut = useMutation({
    mutationFn: () => api.delete(`/api/documents/${doc.id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['documents'] }); onDeleted(); onClose() },
  })

  return (
    <div className="flex flex-col h-full bg-white border-l border-slate-100">
      {/* Header */}
      <div className="flex items-start justify-between px-5 py-4 border-b border-slate-100 bg-slate-50 shrink-0">
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center justify-center w-10 h-10 rounded-xl text-xs font-bold ${extColor(ext)}`}>
            {ext}
          </span>
          <div>
            <p className="font-semibold text-slate-900 text-sm leading-tight line-clamp-1">{doc.title ?? doc.original_name}</p>
            <p className="text-xs text-slate-400 mt-0.5">—</p>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Detalles */}
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Detalles</p>
          <dl className="space-y-2 text-sm">
            {[
              { label: 'Empresa',  value: doc.company?.name ?? '—' },
              { label: 'Módulo',   value: doc.category ?? 'general' },
              { label: 'Estado',   value: <Badge label={sm.label} color={sm.color} /> },
              { label: 'Tipo',     value: ext },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between items-center gap-2">
                <dt className="text-slate-400 shrink-0">{label}</dt>
                <dd className="font-medium text-slate-700 text-right">{value}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Metadatos */}
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Metadatos</p>
          <dl className="space-y-2 text-sm">
            {[
              { label: 'Subido por', value: 'Admin RS' },
              { label: 'Fecha',      value: doc.created_at ? formatDate(doc.created_at) : '—' },
              { label: 'Versión',    value: 'v1.0' },
              { label: 'Descargas', value: `${doc.download_count ?? 0} veces` },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between">
                <dt className="text-slate-400">{label}</dt>
                <dd className="font-medium text-slate-700">{value}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Descripción */}
        {doc.description && (
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Descripción</p>
            <p className="text-sm text-slate-600 leading-relaxed">{doc.description}</p>
          </div>
        )}
        {!doc.description && (
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Descripción</p>
            <p className="text-sm text-slate-400">{doc.title ?? doc.original_name}</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="p-4 border-t border-slate-100 space-y-2 shrink-0">
        {doc.file_url && (
          <a href={doc.file_url} target="_blank" rel="noreferrer"
            className="flex items-center justify-center gap-2 w-full py-2 text-sm font-medium text-primary-600 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors">
            <Eye className="w-4 h-4" /> Ver archivo
          </a>
        )}
        {doc.file_url && (
          <a href={doc.file_url} download
            className="flex items-center justify-center gap-2 w-full py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">
            <Download className="w-4 h-4" /> Descargar
          </a>
        )}
        <button className="flex items-center justify-center gap-2 w-full py-2 text-sm font-medium text-emerald-600 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors">
          <Send className="w-4 h-4" /> Publicar
        </button>
        <button className="flex items-center justify-center gap-2 w-full py-2 text-sm font-medium text-slate-600 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
          <Edit3 className="w-4 h-4" /> Editar
        </button>
        <button
          onClick={() => confirm({ title: '¿Eliminar este documento?', description: 'Esta acción no se puede deshacer.', type: 'danger', confirmLabel: 'Eliminar', onConfirm: async () => { await deleteMut.mutateAsync() } })}
          className="flex items-center justify-center gap-2 w-full py-2 text-sm font-medium text-red-500 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
        >
          <Trash2 className="w-4 h-4" /> Eliminar
        </button>
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export function DocumentsPage() {
  const confirmFn = useConfirm()
  const [search,       setSearch]       = useState('')
  const [statusTab,    setStatusTab]    = useState<'all'|'published'|'review'|'draft'>('all')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [typeFilter,   setTypeFilter]   = useState('')
  const [viewMode,     setViewMode]     = useState<'list'|'grid'>('list')
  const [page,         setPage]         = useState(1)
  const [selectedDoc,  setSelectedDoc]  = useState<any | null>(null)
  const [showUpload,   setShowUpload]   = useState(false)
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['documents', page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: '100' })
      const { data } = await api.get(`/api/documents?${params}`)
      return data
    },
  })

  const allDocs: any[] = data?.data ?? []

  const rows = allDocs.filter((d: any) => {
    const docStatus = d.status ?? 'published'
    if (statusTab !== 'all' && docStatus !== statusTab) return false
    if (search) {
      const q = search.toLowerCase()
      if (!(d.title?.toLowerCase().includes(q) || d.original_name?.toLowerCase().includes(q) || d.company?.name?.toLowerCase().includes(q) || d.category?.toLowerCase().includes(q)))
        return false
    }
    if (categoryFilter && (d.category ?? 'general') !== categoryFilter) return false
    if (typeFilter) {
      const ext = extLabel(d.mime_type, d.original_name).toLowerCase()
      if (typeFilter === 'pdf' && ext !== 'pdf') return false
      if (typeFilter === 'excel' && !['xls', 'xlsx'].includes(ext)) return false
      if (typeFilter === 'word' && !['doc', 'docx'].includes(ext)) return false
    }
    return true
  })

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Gestión de documentos" subtitle={new Date().toLocaleDateString('es-CO', { weekday:'short', day:'numeric', month:'short', year:'numeric' })} />

      <div className="flex flex-1 overflow-hidden">

        {/* ── Main content ── */}
        <div className={`flex-1 flex overflow-hidden ${selectedDoc ? 'flex-row' : ''}`}>
          <div className="flex-1 flex flex-col overflow-hidden">

            {/* Toolbar */}
            <div className="flex flex-col gap-3 px-4 md:px-5 py-3 border-b border-slate-100 bg-white shrink-0">
              <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar documento, empresa, módulo…"
                    className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <div className="flex items-center gap-1">
                    <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-primary-100 text-primary-600' : 'text-slate-400 hover:bg-slate-100'}`}>
                      <Grid3x3 className="w-4 h-4" />
                    </button>
                    <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-primary-100 text-primary-600' : 'text-slate-400 hover:bg-slate-100'}`}>
                      <List className="w-4 h-4" />
                    </button>
                  </div>
                  <Button size="sm" className="ml-auto sm:ml-0" onClick={() => setShowUpload(true)}>
                    <Upload className="w-3.5 h-3.5" /> Subir
                  </Button>
                </div>
              </div>

              {/* Filters row */}
              <div className="flex flex-wrap gap-2">
                {/* Status */}
                <div className="flex items-center bg-slate-100 rounded-lg p-0.5 text-xs">
                  {(['all','published','review','draft'] as const).map(s => (
                    <button key={s}
                      onClick={() => { setStatusTab(s); setCategoryFilter(''); setTypeFilter('') }}
                      className={`px-2.5 py-1.5 rounded-md font-medium transition-colors ${statusTab === s ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      {s === 'all' ? 'Todos' : s === 'published' ? 'Publicados' : s === 'review' ? 'Revisión' : 'Borrador'}
                    </button>
                  ))}
                </div>

                <span className="hidden sm:block w-px h-6 bg-slate-200 self-center" />

                {/* Module filters */}
                {MODULE_FOLDERS.map(f => (
                  <button key={f.id}
                    onClick={() => { setCategoryFilter(categoryFilter === f.id ? '' : f.id); setTypeFilter('') }}
                    className={`text-xs px-2.5 py-1.5 rounded-full font-medium border transition-colors ${
                      categoryFilter === f.id ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}>
                    {f.emoji} {f.label}
                  </button>
                ))}

                <span className="hidden sm:block w-px h-6 bg-slate-200 self-center" />

                {/* Type filters */}
                {TYPE_FOLDERS.map(f => (
                  <button key={f.id}
                    onClick={() => { setTypeFilter(typeFilter === f.id ? '' : f.id); setCategoryFilter('') }}
                    className={`text-xs px-2.5 py-1.5 rounded-full font-medium border transition-colors ${
                      typeFilter === f.id ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}>
                    {f.emoji} {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Document list */}
            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center h-40"><PageLoader /></div>
              ) : (
                <>
                  <div className="px-5 py-3 flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-500">Todos los documentos</p>
                    <p className="text-xs text-slate-400">{rows.length} archivos</p>
                  </div>

                  {viewMode === 'list' ? (
                    <div className="divide-y divide-slate-50">
                      {rows.map((doc: any) => {
                        const ext = extLabel(doc.mime_type, doc.original_name)
                        const sm  = STATUS_META[doc.status ?? 'published'] ?? STATUS_META.published
                        return (
                          <div key={doc.id}
                            onClick={() => setSelectedDoc(doc)}
                            className={`flex items-center gap-4 px-5 py-3.5 cursor-pointer transition-colors group hover:bg-slate-50 ${selectedDoc?.id === doc.id ? 'bg-primary-50 border-l-2 border-primary-500' : ''}`}
                          >
                            <span className={`inline-flex items-center justify-center w-9 h-9 rounded-lg text-[10px] font-bold shrink-0 ${extColor(ext)}`}>
                              {ext}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-900 truncate">{doc.title ?? doc.original_name}</p>
                              <p className="text-xs text-slate-400 truncate">
                                {doc.company?.name ?? '—'} · {doc.category ?? 'general'} · {doc.created_at ? formatDate(doc.created_at) : '—'}
                              </p>
                            </div>
                            <Badge label={sm.label} color={sm.color} />
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                              {doc.file_url && (
                                <a href={doc.file_url} target="_blank" rel="noreferrer"
                                  onClick={e => e.stopPropagation()}
                                  className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500" title="Ver">
                                  <Eye className="w-3.5 h-3.5" />
                                </a>
                              )}
                              {doc.file_url && (
                                <a href={doc.file_url} download onClick={e => e.stopPropagation()}
                                  className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500" title="Descargar">
                                  <Download className="w-3.5 h-3.5" />
                                </a>
                              )}
                              <button onClick={e => { e.stopPropagation(); confirmFn({ title: '¿Eliminar este documento?', type: 'danger', confirmLabel: 'Eliminar', onConfirm: async () => { await api.delete(`/api/documents/${doc.id}`); qc.invalidateQueries({ queryKey: ['documents'] }) } }) }}
                                className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500" title="Eliminar">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 p-5">
                      {rows.map((doc: any) => {
                        const ext = extLabel(doc.mime_type, doc.original_name)
                        const sm  = STATUS_META[doc.status ?? 'published'] ?? STATUS_META.published
                        return (
                          <div key={doc.id}
                            onClick={() => setSelectedDoc(doc)}
                            className="bg-white border border-slate-200 rounded-xl p-4 cursor-pointer hover:border-primary-300 hover:shadow-md transition-all group">
                            <span className={`inline-flex items-center justify-center w-10 h-10 rounded-xl text-xs font-bold mb-3 ${extColor(ext)}`}>
                              {ext}
                            </span>
                            <p className="text-xs font-medium text-slate-900 line-clamp-2 mb-2">{doc.title ?? doc.original_name}</p>
                            <Badge label={sm.label} color={sm.color} />
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {!rows.length && (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                      <FileText className="w-10 h-10 mb-3 text-slate-300" />
                      <p className="text-sm">{search ? `Sin resultados para "${search}"` : 'No hay documentos'}</p>
                    </div>
                  )}

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
            </div>
          </div>

          {/* ── Detail panel ── */}
          {selectedDoc && (
            <div className="w-72 xl:w-80 shrink-0 overflow-hidden">
              <DetailPanel
                doc={selectedDoc}
                onClose={() => setSelectedDoc(null)}
                onDeleted={() => setSelectedDoc(null)}
              />
            </div>
          )}
        </div>
      </div>

      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onSuccess={() => qc.invalidateQueries({ queryKey: ['documents'] })}
        />
      )}
    </div>
  )
}
