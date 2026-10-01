import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import {
  Search, RefreshCw, Mail, Phone, Building2, Calendar,
  ChevronDown, ChevronUp, Inbox, Tag, ArrowUpDown, Check, FileEdit,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Lead {
  id:             string
  created_at:     string
  service:        string
  company_size:   string
  start_date:     string
  name:           string
  company:        string
  phone:          string
  email:          string
  status:         'new' | 'contacted' | 'converted' | 'lost'
  notes:          string | null
}

// ── Helpers & Labels ──────────────────────────────────────────────────────────

const SERVICE_LABELS: Record<string, string> = {
  control:      'Control financiero y tesorería',
  contabilidad: 'Contabilidad e impuestos',
  facturacion:  'Facturación, cobranza y datos',
  nomina:       'Gestión de personal y SG-SST',
}

const SIZE_LABELS: Record<string, string> = {
  '0-3':   '0–3 emp (Emprendedor)',
  '4-9':   '4–9 emp (Pequeña)',
  '10-24': '10–24 emp (Mediana)',
  '25+':   '25+ emp (Personalizado)',
}

const START_LABELS: Record<string, string> = {
  asap:           'Lo antes posible',
  'this-month':   'Este mes',
  'next-month':   'Próximo mes',
  'just-quoting': 'Solo cotizando',
}

export const STATUS_CONFIG: Record<Lead['status'], { label: string; badgeCls: string; activeCls: string }> = {
  new: {
    label:     'Nuevo',
    badgeCls:  'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100',
    activeCls: 'bg-blue-600 text-white border-blue-600 shadow-sm',
  },
  contacted: {
    label:     'Contactado',
    badgeCls:  'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100',
    activeCls: 'bg-amber-600 text-white border-amber-600 shadow-sm',
  },
  converted: {
    label:     'Convertido',
    badgeCls:  'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100',
    activeCls: 'bg-emerald-600 text-white border-emerald-600 shadow-sm',
  },
  lost: {
    label:     'Perdido',
    badgeCls:  'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100',
    activeCls: 'bg-rose-600 text-white border-rose-600 shadow-sm',
  },
}

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat('es-CO', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso))
}

function parseServices(raw: string) {
  return raw.split(',').map(s => SERVICE_LABELS[s.trim()] ?? s.trim())
}

// ── Component ─────────────────────────────────────────────────────────────────

export function LeadsPage() {
  const queryClient = useQueryClient()
  const [search, setSearch]             = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [sortDesc, setSortDesc]         = useState(true)
  const [expanded, setExpanded]         = useState<string | null>(null)
  const [editingNotes, setEditingNotes] = useState<Record<string, string>>({})

  // Fetch leads
  const { data: leads = [], isLoading, refetch, isFetching } = useQuery<Lead[]>({
    queryKey: ['contact-leads'],
    queryFn:  async () => {
      const res = await api.get('/api/contact/leads')
      return res.data as Lead[]
    },
    staleTime: 30_000,
  })

  // Mutation for updating status or notes
  const updateMutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status?: Lead['status']; notes?: string | null }) => {
      const res = await api.patch(`/api/contact/leads/${id}`, { status, notes })
      return res.data as Lead
    },
    onMutate: async ({ id, status, notes }) => {
      await queryClient.cancelQueries({ queryKey: ['contact-leads'] })
      const prev = queryClient.getQueryData<Lead[]>(['contact-leads'])
      if (prev) {
        queryClient.setQueryData<Lead[]>(['contact-leads'], old =>
          old?.map(l => (l.id === id ? { ...l, ...(status ? { status } : {}), ...(notes !== undefined ? { notes } : {}) } : l))
        )
      }
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['contact-leads'], ctx.prev)
      toast.error('No se pudo actualizar el lead')
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['contact-leads'] })
      if (vars.status) {
        toast.success(`Estado actualizado a: ${STATUS_CONFIG[vars.status].label}`)
      } else if (vars.notes !== undefined) {
        toast.success('Notas guardadas correctamente')
      }
    },
  })

  // ── Filters & Sort ──
  const filtered = leads
    .filter(l => {
      if (statusFilter !== 'all' && l.status !== statusFilter) return false
      if (!search.trim()) return true
      const q = search.toLowerCase()
      return (
        l.name.toLowerCase().includes(q) ||
        l.company.toLowerCase().includes(q) ||
        l.email.toLowerCase().includes(q) ||
        l.phone.includes(q)
      )
    })
    .sort((a, b) => sortDesc
      ? new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      : new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-display font-bold text-navy-900">Leads del cotizador</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Empresas que dejaron sus datos en el formulario del landing page. Gestiona su estado y seguimiento comercial.
          </p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-2 text-sm font-medium bg-navy-900 text-white px-4 py-2 rounded-xl hover:bg-navy-800 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {/* Filters bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="search"
            placeholder="Buscar por nombre, empresa, email o teléfono…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/40"
          />
        </div>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="text-sm border border-slate-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/40"
        >
          <option value="all">Todos los estados</option>
          {Object.entries(STATUS_CONFIG).map(([val, cfg]) => (
            <option key={val} value={val}>{cfg.label}</option>
          ))}
        </select>

        {/* Sort */}
        <button
          type="button"
          onClick={() => setSortDesc(d => !d)}
          className="inline-flex items-center gap-2 text-sm font-medium border border-slate-200 px-3 py-2.5 rounded-xl bg-white hover:bg-slate-50 transition-colors"
        >
          <ArrowUpDown className="w-4 h-4 text-slate-400" />
          {sortDesc ? 'Más recientes' : 'Más antiguos'}
        </button>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(['new', 'contacted', 'converted', 'lost'] as Lead['status'][]).map(status => {
          const cfg = STATUS_CONFIG[status]
          const count = leads.filter(l => l.status === status).length
          const isSelected = statusFilter === status

          return (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(s => s === status ? 'all' : status)}
              className={`p-3.5 rounded-xl border text-left transition-all ${
                isSelected ? 'ring-2 ring-brand-500 border-transparent bg-white shadow-sm' : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">{cfg.label}</p>
              <p className="text-2xl font-bold text-navy-900 mt-0.5">{count}</p>
            </button>
          )
        })}
      </div>

      {/* Table / cards */}
      {isLoading ? (
        <div className="text-center py-16 text-slate-400">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
          Cargando leads…
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 p-8">
          <Inbox className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No hay leads que coincidan</p>
          <p className="text-sm text-slate-400 mt-1">
            {leads.length === 0 ? 'Aún no ha llegado ningún lead del cotizador.' : 'Prueba con otros términos de búsqueda o filtros.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(lead => {
            const isOpen = expanded === lead.id
            const services = parseServices(lead.service)
            const statusCfg = STATUS_CONFIG[lead.status] || STATUS_CONFIG.new
            const currentNote = editingNotes[lead.id] ?? (lead.notes || '')

            return (
              <div
                key={lead.id}
                className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
              >
                {/* Row header */}
                <div
                  className="w-full text-left p-4 sm:p-5 flex items-start sm:items-center justify-between gap-4 flex-wrap cursor-pointer"
                  onClick={() => setExpanded(isOpen ? null : lead.id)}
                >
                  {/* Left: Avatar & Name */}
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-500 to-navy-700 flex items-center justify-center text-white font-bold text-sm shrink-0">
                      {lead.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-navy-900 truncate">{lead.name}</p>
                      <p className="text-sm text-slate-500 truncate flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5 inline shrink-0" /> {lead.company}
                      </p>
                    </div>
                  </div>

                  {/* Center: Contact links */}
                  <div className="hidden sm:flex flex-col gap-0.5 text-sm text-slate-600 min-w-0">
                    <a
                      href={`mailto:${lead.email}`}
                      onClick={e => e.stopPropagation()}
                      className="flex items-center gap-1 hover:text-brand-600 truncate"
                    >
                      <Mail className="w-3.5 h-3.5 shrink-0" /> {lead.email}
                    </a>
                    <a
                      href={`https://wa.me/${lead.phone.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      className="flex items-center gap-1 hover:text-green-600"
                    >
                      <Phone className="w-3.5 h-3.5 shrink-0" /> {lead.phone}
                    </a>
                  </div>

                  {/* Right: Interactive Status Dropdown + Date + Expand Chevron */}
                  <div className="flex items-center gap-3 shrink-0 ml-auto" onClick={e => e.stopPropagation()}>
                    {/* Status Dropdown Selector */}
                    <div className="relative">
                      <select
                        value={lead.status}
                        disabled={updateMutation.isPending}
                        onChange={e => {
                          const newStatus = e.target.value as Lead['status']
                          updateMutation.mutate({ id: lead.id, status: newStatus })
                        }}
                        className={`text-xs font-semibold px-3 py-1.5 rounded-full border cursor-pointer appearance-none pr-7 focus:outline-none focus:ring-2 focus:ring-brand-500/40 transition-all ${statusCfg.badgeCls}`}
                        title="Haz clic para cambiar el estado"
                      >
                        <option value="new">Nuevo</option>
                        <option value="contacted">Contactado</option>
                        <option value="converted">Convertido</option>
                        <option value="lost">Perdido</option>
                      </select>
                      <ChevronDown className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-60" />
                    </div>

                    <span className="hidden md:flex text-xs text-slate-400 items-center gap-1">
                      <Calendar className="w-3 h-3 inline" /> {fmtDate(lead.created_at)}
                    </span>

                    <button
                      type="button"
                      aria-label="Expandir detalle"
                      onClick={() => setExpanded(isOpen ? null : lead.id)}
                      className="p-1 rounded-lg hover:bg-slate-100 text-slate-400"
                    >
                      {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Expanded detail */}
                {isOpen && (
                  <div className="border-t border-slate-100 px-5 py-5 bg-slate-50 space-y-5">
                    {/* Grid de información */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                      {/* Mobile contact info */}
                      <div className="sm:hidden space-y-1 text-sm bg-white p-3 rounded-xl border border-slate-200">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Contacto</p>
                        <a href={`mailto:${lead.email}`} className="flex items-center gap-2 text-brand-600 hover:underline">
                          <Mail className="w-4 h-4" /> {lead.email}
                        </a>
                        <a href={`https://wa.me/${lead.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-green-600 hover:underline">
                          <Phone className="w-4 h-4" /> {lead.phone}
                        </a>
                      </div>

                      {/* Servicios de interés */}
                      <div className="bg-white p-3.5 rounded-xl border border-slate-200">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1">
                          <Tag className="w-3 h-3" /> Servicios cotizados
                        </p>
                        <ul className="space-y-1">
                          {services.map(s => (
                            <li key={s} className="text-sm text-navy-900 font-medium flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-brand-500 shrink-0" />
                              {s}
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Operación y Fecha inicio */}
                      <div className="bg-white p-3.5 rounded-xl border border-slate-200">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Operación y Equipo</p>
                        <p className="text-sm font-semibold text-navy-900">{SIZE_LABELS[lead.company_size] ?? lead.company_size}</p>
                        <p className="text-xs text-slate-500 mt-2">
                          <span className="font-semibold text-slate-600">Fecha tentativa:</span> {START_LABELS[lead.start_date] ?? lead.start_date}
                        </p>
                      </div>

                      {/* Acciones de contacto rápido */}
                      <div className="bg-white p-3.5 rounded-xl border border-slate-200 flex flex-col justify-between">
                        <div>
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Fecha de recepción</p>
                          <p className="text-sm text-navy-900 font-medium">{fmtDate(lead.created_at)}</p>
                        </div>
                        <div className="mt-3 flex gap-2">
                          <a
                            href={`mailto:${lead.email}?subject=Cotización%20Finto%20-%20${encodeURIComponent(lead.company)}&body=Hola%20${encodeURIComponent(lead.name)},%0A%0AGracias%20por%20cotizar%20con%20Finto.`}
                            className="inline-flex items-center gap-1 text-xs font-semibold bg-brand-600 text-white px-3 py-1.5 rounded-lg hover:bg-brand-700 transition-colors"
                          >
                            <Mail className="w-3 h-3" /> Correo
                          </a>
                          <a
                            href={`https://wa.me/${lead.phone.replace(/\D/g, '')}?text=Hola%20${encodeURIComponent(lead.name)},%20te%20escribo%20de%20Finto%20respecto%20a%20tu%20cotización.`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-semibold bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 transition-colors"
                          >
                            <Phone className="w-3 h-3" /> WhatsApp
                          </a>
                        </div>
                      </div>
                    </div>

                    {/* Selector visual de estado */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2.5">
                        Cambiar estado del lead:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {(['new', 'contacted', 'converted', 'lost'] as Lead['status'][]).map(status => {
                          const cfg = STATUS_CONFIG[status]
                          const isActive = lead.status === status

                          return (
                            <button
                              key={status}
                              type="button"
                              disabled={updateMutation.isPending}
                              onClick={() => {
                                if (lead.status !== status) {
                                  updateMutation.mutate({ id: lead.id, status })
                                }
                              }}
                              className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border transition-all ${
                                isActive ? cfg.activeCls : `${cfg.badgeCls} opacity-80 hover:opacity-100`
                              }`}
                            >
                              {isActive && <Check className="w-3.5 h-3.5" />}
                              <span>{cfg.label}</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {/* Notas internas de seguimiento */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200">
                      <div className="flex items-center justify-between mb-2">
                        <label htmlFor={`notes-${lead.id}`} className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                          <FileEdit className="w-3.5 h-3.5" />
                          Notas internas de seguimiento
                        </label>
                        {currentNote !== (lead.notes || '') && (
                          <span className="text-[11px] text-amber-600 font-medium">Cambios sin guardar</span>
                        )}
                      </div>
                      <textarea
                        id={`notes-${lead.id}`}
                        rows={2}
                        value={currentNote}
                        placeholder="Escribe notas sobre la conversación, requerimientos especiales o próximos pasos…"
                        onChange={e => {
                          const val = e.target.value
                          setEditingNotes(prev => ({ ...prev, [lead.id]: val }))
                        }}
                        className="w-full text-sm p-2.5 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/40"
                      />
                      <div className="mt-2 flex justify-end">
                        <button
                          type="button"
                          disabled={updateMutation.isPending || currentNote === (lead.notes || '')}
                          onClick={() => {
                            updateMutation.mutate({ id: lead.id, notes: currentNote })
                          }}
                          className="inline-flex items-center gap-1 text-xs font-semibold bg-navy-900 text-white px-3.5 py-1.5 rounded-lg hover:bg-navy-800 disabled:opacity-40 transition-colors"
                        >
                          Guardar nota
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Footer count */}
      {filtered.length > 0 && (
        <p className="text-xs text-slate-400 text-center">
          Mostrando {filtered.length} de {leads.length} leads
        </p>
      )}
    </div>
  )
}
