import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { PortalTopBar } from '@/components/layout/PortalTopBar'
import { PageLoader } from '@/components/ui/Spinner'
import { FintoIcon, type FintoIconName } from '@/components/ui/FintoIcon'
import { UploadModal } from '@/pages/DocumentsPage'
import { useAuthStore } from '@/stores/authStore'
import { cn } from '@/lib/utils'
import { Search, Plus, LayoutGrid, ChevronLeft, ChevronRight } from 'lucide-react'

function fmtDate(d?: string) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

// Tipo de archivo → etiqueta legible + color
function typeInfo(mime?: string | null, name?: string | null): { key: string; label: string; cls: string } {
  const ext = (name?.split('.').pop() ?? '').toLowerCase()
  const m = (mime ?? '').toLowerCase()
  if (ext === 'pdf' || m.includes('pdf')) return { key: 'pdf', label: 'PDF', cls: 'text-red-500 ring-red-400/40' }
  if (['xls', 'xlsx', 'csv'].includes(ext) || m.includes('sheet') || m.includes('excel')) return { key: 'excel', label: 'Excel', cls: 'text-emerald-600 dark:text-emerald-400 ring-emerald-400/40' }
  if (['doc', 'docx'].includes(ext) || m.includes('word')) return { key: 'word', label: 'Word', cls: 'text-brand-600 dark:text-brand-300 ring-brand-400/40' }
  if (['jpg', 'jpeg', 'png', 'webp'].includes(ext) || m.includes('image')) return { key: 'jpg', label: 'JPG', cls: 'text-brand-500 ring-brand-300/40' }
  return { key: 'file', label: (ext || 'FILE').toUpperCase(), cls: 'text-navy-900/60 dark:text-cream-100/60 ring-navy-900/15' }
}

// Estado de revisión → etiqueta + color
function reviewInfo(status?: string): { label: string; text: string; dot: string } {
  const s = status ?? 'published'
  if (s === 'published' || s === 'done') return { label: 'Completada', text: 'text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500' }
  if (s === 'draft' || s === 'outdated') return { label: 'Por actualizar', text: 'text-red-500', dot: 'bg-red-500' }
  return { label: 'En proceso', text: 'text-gold-600 dark:text-gold-400', dot: 'bg-gold-500' }
}

function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('rounded-2xl bg-cream-100 dark:bg-navy-900 ring-1 ring-navy-900/5 dark:ring-white/5', className)}>{children}</div>
}

const TYPE_CHIPS: { key: string; label: string; cls: string }[] = [
  { key: 'pdf',   label: 'PDF',   cls: 'text-red-500 ring-red-400/50' },
  { key: 'excel', label: 'Excel', cls: 'text-emerald-600 dark:text-emerald-400 ring-emerald-400/50' },
  { key: 'word',  label: 'Word',  cls: 'text-brand-600 dark:text-brand-300 ring-brand-400/50' },
  { key: 'jpg',   label: 'JPG',   cls: 'text-brand-500 ring-brand-300/50' },
]

const PAGE_SIZE = 8

export function ClientDocumentsPage() {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [areaFilter, setAreaFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [page, setPage] = useState(1)
  const [showUpload, setShowUpload] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['client-documents'],
    queryFn: async () => (await api.get('/api/documents?limit=100')).data,
    staleTime: 30_000,
  })

  const allDocs: any[] = Array.isArray(data) ? data : (data?.data ?? [])
  const today = new Date().toISOString().split('T')[0]!

  const areaOf = (d: any) => d.service?.name ?? d.category ?? 'General'
  const areas = useMemo(() => Array.from(new Set(allDocs.map(areaOf))) as string[], [allDocs])

  const total = data?.total ?? allDocs.length
  const folders = areas.length
  const updatedToday = allDocs.filter(d => (d.updated_at ?? d.created_at ?? '').slice(0, 10) === today).length
  const inReview = allDocs.filter(d => (d.status ?? 'published') === 'review').length

  const rows = allDocs.filter(d => {
    if (search && !((d.title ?? d.original_name ?? '').toLowerCase().includes(search.toLowerCase()))) return false
    if (areaFilter && areaOf(d) !== areaFilter) return false
    if (typeFilter && typeInfo(d.mime_type, d.original_name).key !== typeFilter) return false
    return true
  })

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const STATS: { icon: FintoIconName; label: string; value: number }[] = [
    { icon: 'documentos', label: 'Total documentos', value: total },
    { icon: 'folders',    label: 'Carpetas',         value: folders },
    { icon: 'clock',      label: 'Actualizados hoy',  value: updatedToday },
    { icon: 'check',      label: 'Revisión',          value: inReview },
  ]

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PortalTopBar title="Documentos" subtitle="Gestión" companyName={user?.full_name ?? 'Logo de la empresa'} />

      <div className="flex-1 overflow-y-auto px-5 md:px-8 pb-8 space-y-5">

        {/* Buscador + acciones */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-navy-900/40 dark:text-cream-100/40" />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              placeholder="Buscar documentos..."
              className="w-full pl-10 pr-3 py-2.5 text-sm rounded-xl bg-cream-100 dark:bg-navy-900 ring-1 ring-navy-900/10 dark:ring-white/10
                         text-navy-900 dark:text-cream-100 placeholder:text-navy-900/40 dark:placeholder:text-cream-100/40
                         focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          </div>
          <button className="p-2.5 rounded-xl bg-cream-100 dark:bg-navy-900 ring-1 ring-navy-900/10 dark:ring-white/10 text-navy-900/60 dark:text-cream-100/60 hover:text-navy-900 dark:hover:text-cream-100 transition-colors">
            <LayoutGrid className="w-5 h-5" />
          </button>
          <button onClick={() => setShowUpload(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-display font-bold text-sm bg-navy-900 text-cream-100 hover:bg-navy-800 dark:bg-brand-600 dark:hover:bg-brand-500 transition-colors">
            <Plus className="w-4 h-4" /> Subir
          </button>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {STATS.map(s => (
            <Card key={s.label} className="p-4 flex items-center gap-3">
              <FintoIcon name={s.icon} size={30} />
              <div>
                <p className="text-xs font-semibold text-navy-900/55 dark:text-cream-100/55 leading-tight">{s.label}</p>
                <p className="font-display text-2xl font-bold text-navy-900 dark:text-cream-100 leading-none mt-0.5">{s.value}</p>
              </div>
            </Card>
          ))}
        </div>

        {/* Filtros: área + tipo */}
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[240px]">
            <p className="text-[11px] font-bold text-brand-600 dark:text-brand-300 uppercase tracking-wider mb-2">Por área</p>
            <select
              value={areaFilter}
              onChange={e => { setAreaFilter(e.target.value); setPage(1) }}
              className="w-full px-4 py-2.5 text-sm rounded-xl bg-cream-100 dark:bg-navy-900 ring-1 ring-navy-900/10 dark:ring-white/10
                         text-navy-900 dark:text-cream-100 focus:outline-none focus:ring-2 focus:ring-brand-400 [&>option]:text-navy-900"
            >
              <option value="">Todas las áreas</option>
              {areas.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            {TYPE_CHIPS.map(c => {
              const active = typeFilter === c.key
              return (
                <button
                  key={c.key}
                  onClick={() => { setTypeFilter(active ? '' : c.key); setPage(1) }}
                  className={cn('text-xs font-bold px-4 py-2.5 rounded-xl bg-cream-100 dark:bg-navy-900 ring-1 transition-all',
                    c.cls, active && 'ring-2 bg-cream-50 dark:bg-navy-800')}
                >
                  {c.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Tabla */}
        <Card className="overflow-hidden">
          <div className="px-5 py-4">
            <h3 className="font-display font-bold text-navy-900 dark:text-cream-100">Todos los documentos</h3>
          </div>

          {isLoading ? <div className="py-10"><PageLoader /></div> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[720px]">
                <thead>
                  <tr className="bg-sand-300/40 dark:bg-navy-800 text-[10px] font-bold uppercase tracking-wider text-navy-900/50 dark:text-cream-100/50">
                    <th className="text-left px-5 py-2.5">Documentos</th>
                    <th className="text-left px-4 py-2.5">Carpeta</th>
                    <th className="text-left px-4 py-2.5">Etiqueta</th>
                    <th className="text-left px-4 py-2.5">Actualizado</th>
                    <th className="text-left px-4 py-2.5">Revisión</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-900/5 dark:divide-white/5">
                  {pageRows.map((d: any) => {
                    const ti = typeInfo(d.mime_type, d.original_name)
                    const rv = reviewInfo(d.status)
                    return (
                      <tr key={d.id} className="hover:bg-sand-300/20 dark:hover:bg-white/5 transition-colors">
                        <td className="px-5 py-3">
                          <span className="text-brand-700 dark:text-brand-300 font-medium truncate block max-w-[280px]">{d.title ?? d.original_name}</span>
                        </td>
                        <td className="px-4 py-3 text-navy-900/70 dark:text-cream-100/70">{areaOf(d)}</td>
                        <td className="px-4 py-3">
                          <span className={cn('inline-flex items-center text-xs font-bold px-2.5 py-1 rounded-lg ring-1 bg-cream-50 dark:bg-navy-800', ti.cls)}>{ti.label}</span>
                        </td>
                        <td className="px-4 py-3 text-navy-900/70 dark:text-cream-100/70 whitespace-nowrap">{fmtDate(d.updated_at ?? d.created_at)}</td>
                        <td className="px-4 py-3">
                          <span className={cn('inline-flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap', rv.text)}>
                            <span className={cn('w-2 h-2 rounded-full', rv.dot)} /> {rv.label}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              {!pageRows.length && <p className="px-5 py-12 text-center text-navy-900/40 dark:text-cream-100/40">No hay documentos con esos filtros</p>}

              <div className="flex items-center justify-end gap-2 px-5 py-3">
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                  className="p-1.5 rounded-lg text-navy-900/60 dark:text-cream-100/60 hover:bg-sand-300/40 dark:hover:bg-white/10 disabled:opacity-30 transition-colors">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs text-navy-900/50 dark:text-cream-100/50">{page} / {pageCount}</span>
                <button disabled={page >= pageCount} onClick={() => setPage(p => p + 1)}
                  className="p-1.5 rounded-lg text-navy-900/60 dark:text-cream-100/60 hover:bg-sand-300/40 dark:hover:bg-white/10 disabled:opacity-30 transition-colors">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </Card>
      </div>

      {showUpload && <UploadModal onClose={() => setShowUpload(false)} onSuccess={() => qc.invalidateQueries({ queryKey: ['client-documents'] })} />}
    </div>
  )
}
