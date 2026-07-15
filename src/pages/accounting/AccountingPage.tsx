import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { TopBar } from '@/components/layout/TopBar'
import { Button } from '@/components/ui/Button'
import { PageLoader } from '@/components/ui/Spinner'
import { SearchSelect } from '@/components/ui/SearchSelect'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { useAuthStore } from '@/stores/authStore'
import { toast } from 'sonner'
import {
  Calculator, AlertTriangle, CalendarDays, CheckCircle2, Clock,
  Building2, Plus, Pencil, Trash2, X, PlayCircle, ListChecks,
} from 'lucide-react'

type Tab = 'dashboard' | 'clients' | 'analysis' | 'master'

// ── Modal crear/editar tarea de la plantilla maestra ─────────────────────────

function MasterItemModal({ item, onClose }: { item: any | null; onClose: () => void }) {
  const qc = useQueryClient()
  const confirm = useConfirm()
  const [title, setTitle] = useState(item?.title ?? '')
  const [description, setDescription] = useState(item?.description ?? '')
  const [isMandatory, setIsMandatory] = useState<boolean>(item?.is_mandatory ?? true)

  const saveMut = useMutation({
    mutationFn: async () => {
      const body = { title: title.trim(), description: description.trim() || undefined, is_mandatory: isMandatory }
      if (item) await api.patch(`/api/accounting/master/${item.id}`, body)
      else      await api.post('/api/accounting/master', body)
    },
    onSuccess: () => {
      toast.success(item ? 'Plantilla actualizada' : 'Tarea agregada a la plantilla maestra')
      qc.invalidateQueries({ queryKey: ['accounting'] })
      onClose()
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Error al guardar'),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-slate-900">{item ? 'Editar tarea de la maestra' : 'Nueva tarea en la maestra'}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X className="w-4 h-4" /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Nombre de la tarea *</label>
            <input value={title} onChange={e => setTitle(e.target.value)}
              placeholder="Ej: Impuesto al patrimonio 2027"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Descripción</label>
            <input value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Opcional"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>

          {/* ¿Obligatoria u opcional? (punto 2.c del spec) */}
          <div>
            <p className="text-xs font-medium text-slate-600 mb-2">¿Esta tarea es obligatoria para todos los clientes?</p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setIsMandatory(true)}
                className={`p-3 rounded-xl border text-sm font-medium transition-colors ${isMandatory ? 'border-red-300 bg-red-50 text-red-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                Obligatoria
              </button>
              <button type="button" onClick={() => setIsMandatory(false)}
                className={`p-3 rounded-xl border text-sm font-medium transition-colors ${!isMandatory ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                Opcional
              </button>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <Button variant="secondary" className="flex-1" onClick={onClose}>Cancelar</Button>
            <Button className="flex-1" loading={saveMut.isPending} disabled={title.trim().length < 3}
              onClick={() => confirm({
                title: item ? '¿Guardar los cambios?' : `¿Agregar "${title.trim()}"?`,
                description: 'El cambio se aplicará a todos los calendarios de clientes, nuevos y existentes.',
                type: 'warning',
                confirmLabel: item ? 'Guardar' : 'Agregar',
                onConfirm: () => saveMut.mutateAsync().then(() => {}),
              })}>
              {item ? 'Guardar' : 'Agregar'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────

export function AccountingPage() {
  const qc = useQueryClient()
  const confirm = useConfirm()
  const { user } = useAuthStore()
  const isSuperAdmin = user?.role === 'admin'
  const isAdmin = ['admin', 'rs_admin'].includes(user?.role ?? '')

  const [tab, setTab] = useState<Tab>('dashboard')
  const [selectedCompany, setSelectedCompany] = useState('')
  const [analysisFilter, setAnalysisFilter] = useState<'all' | 'complete' | 'incomplete'>('all')
  const [masterModal, setMasterModal] = useState<{ open: boolean; item: any | null }>({ open: false, item: null })

  // ── Queries ──
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['accounting', 'stats'],
    queryFn: async () => { const { data } = await api.get('/api/accounting/stats'); return data },
    staleTime: 60_000,
  })

  const { data: companiesData } = useQuery({
    queryKey: ['accounting', 'companies'],
    queryFn: async () => { const { data } = await api.get('/api/accounting/companies'); return data },
    staleTime: 60_000,
  })
  const companies: any[] = companiesData ?? []

  const { data: calendar, isLoading: calendarLoading } = useQuery({
    queryKey: ['accounting', 'calendar', selectedCompany],
    queryFn: async () => { const { data } = await api.get(`/api/accounting/companies/${selectedCompany}`); return data },
    enabled: !!selectedCompany,
  })
  const entries: any[] = calendar ?? []

  const { data: masterData, isLoading: masterLoading } = useQuery({
    queryKey: ['accounting', 'master'],
    queryFn: async () => { const { data } = await api.get('/api/accounting/master'); return data },
    staleTime: 60_000,
  })
  const master: any[] = masterData ?? []

  // ── Mutations ──
  const invalidateAll = () => qc.invalidateQueries({ queryKey: ['accounting'] })

  const entryMut = useMutation({
    mutationFn: async ({ id, due_date }: { id: string; due_date: string | null }) => {
      await api.patch(`/api/accounting/entries/${id}`, { due_date })
    },
    onSuccess: () => { toast.success('Fecha actualizada'); invalidateAll() },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Error al guardar la fecha'),
  })

  const deleteMasterMut = useMutation({
    mutationFn: async (id: string) => { await api.delete(`/api/accounting/master/${id}`) },
    onSuccess: () => { toast.success('Tarea eliminada de la maestra y de todos los calendarios'); invalidateAll() },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Error al eliminar'),
  })

  const runCronMut = useMutation({
    mutationFn: async () => { const { data } = await api.post('/api/accounting/run-cron'); return data },
    onSuccess: (d: any) => { toast.success(`Cron ejecutado: ${d.created ?? 0} tareas generadas`); invalidateAll() },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Error al ejecutar el cron'),
  })

  const backfillMut = useMutation({
    mutationFn: async () => { const { data } = await api.post('/api/accounting/backfill'); return data },
    onSuccess: (d: any) => { toast.success(`Fichas generadas para ${d.companies ?? 0} empresas`); invalidateAll() },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Error al generar fichas'),
  })

  const selectedInfo = companies.find(c => c.id === selectedCompany)

  const analysisRows = companies.filter(c =>
    analysisFilter === 'complete' ? c.complete : analysisFilter === 'incomplete' ? !c.complete : true)

  const TABS: { key: Tab; label: string; icon: any; hidden?: boolean }[] = [
    { key: 'dashboard', label: 'Dashboard',          icon: Calculator },
    { key: 'clients',   label: 'Calendarios',        icon: CalendarDays },
    { key: 'analysis',  label: 'Análisis',           icon: ListChecks },
    { key: 'master',    label: 'Plantilla maestra',  icon: Building2, hidden: !isSuperAdmin },
  ]

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar title="Contabilidad" subtitle="Calendario tributario y obligaciones" />

      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <p className="text-xs text-slate-400">Módulos / <span className="text-primary-600 font-medium">Contabilidad</span></p>
            <h2 className="text-xl font-bold text-slate-900">Dashboard contable</h2>
          </div>
          {isAdmin && (
            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" onClick={() => backfillMut.mutate()} loading={backfillMut.isPending}>
                Generar fichas faltantes
              </Button>
              <Button size="sm" variant="secondary" onClick={() => runCronMut.mutate()} loading={runCronMut.isPending}>
                <PlayCircle className="w-3.5 h-3.5" /> Ejecutar cron
              </Button>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-slate-200">
          {TABS.filter(t => !t.hidden).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key ? 'border-primary-500 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}>
              <t.icon className="w-4 h-4" /> {t.label}
            </button>
          ))}
        </div>

        {/* ── Dashboard ── */}
        {tab === 'dashboard' && (
          statsLoading ? <div className="py-10"><PageLoader /></div> : (
            <div className="space-y-5">
              {/* KPIs de tareas del cron */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                {[
                  { label: 'Vencidas',        value: stats?.tasks?.overdue ?? 0,     color: 'border-t-red-500',     text: 'text-red-600' },
                  { label: 'Próximas 7 días', value: stats?.tasks?.due_7_days ?? 0,  color: 'border-t-amber-500',   text: 'text-amber-600' },
                  { label: 'Próximas 15 días', value: stats?.tasks?.due_15_days ?? 0, color: 'border-t-blue-500',   text: 'text-blue-600' },
                  { label: 'Pendientes',      value: stats?.tasks?.pending ?? 0,     color: 'border-t-slate-400',   text: 'text-slate-900' },
                  { label: 'Completadas',     value: stats?.tasks?.done ?? 0,        color: 'border-t-emerald-500', text: 'text-emerald-600' },
                ].map(k => (
                  <div key={k.label} className={`bg-white border border-slate-200 rounded-xl p-4 border-t-4 ${k.color}`}>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{k.label}</p>
                    <p className={`text-3xl font-bold mt-1 ${k.text}`}>{k.value}</p>
                    <p className="text-xs text-slate-400 mt-0.5">tareas tributarias</p>
                  </div>
                ))}
              </div>

              {/* Alerta: empresas sin calendario completo (punto 3) */}
              {(stats?.companies?.incomplete ?? 0) > 0 ? (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="w-5 h-5 text-amber-500" />
                    <h3 className="text-sm font-bold text-amber-800">
                      {stats.companies.incomplete} empresa{stats.companies.incomplete === 1 ? '' : 's'} sin calendario tributario completo
                    </h3>
                  </div>
                  <p className="text-xs text-amber-700 mb-3">Tienen tareas obligatorias sin fecha diligenciada:</p>
                  <div className="flex flex-wrap gap-2">
                    {stats.companies.incomplete_list?.map((c: any) => (
                      <button key={c.id}
                        onClick={() => { setSelectedCompany(c.id); setTab('clients') }}
                        className="text-xs bg-white border border-amber-300 text-amber-800 px-3 py-1.5 rounded-full font-medium hover:bg-amber-100 transition-colors">
                        {c.name} · {c.mandatory_without_date} sin fecha
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 flex items-center gap-3">
                  <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-emerald-800">Todos los calendarios están completos</p>
                    <p className="text-xs text-emerald-600">{stats?.companies?.total ?? 0} empresas con servicio contable tienen sus tareas obligatorias con fecha.</p>
                  </div>
                </div>
              )}

              {/* Resumen de empresas */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Con servicio contable</p>
                  <p className="text-3xl font-bold text-slate-900 mt-1">{stats?.companies?.total ?? 0}</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Calendario completo</p>
                  <p className="text-3xl font-bold text-emerald-600 mt-1">{stats?.companies?.complete ?? 0}</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Incompleto</p>
                  <p className="text-3xl font-bold text-amber-600 mt-1">{stats?.companies?.incomplete ?? 0}</p>
                </div>
              </div>
            </div>
          )
        )}

        {/* ── Calendarios por cliente ── */}
        {tab === 'clients' && (
          <div className="space-y-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="w-full sm:w-96">
                <SearchSelect
                  label="Cliente"
                  value={selectedCompany}
                  onChange={setSelectedCompany}
                  placeholder="Buscar empresa…"
                  options={companies.map(c => ({ value: c.id, label: c.name, color: c.complete ? 'bg-emerald-500' : 'bg-amber-500' }))}
                />
              </div>
              {selectedInfo && (
                <p className={`text-xs mt-2 ${selectedInfo.complete ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {selectedInfo.complete
                    ? '✓ Calendario completo — todas las obligatorias tienen fecha'
                    : `⚠ ${selectedInfo.mandatory_without_date} tarea(s) obligatoria(s) sin fecha`}
                </p>
              )}
            </div>

            {!selectedCompany ? (
              <div className="bg-white border border-slate-200 rounded-xl py-16 text-center text-slate-400">
                <CalendarDays className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                <p className="text-sm">Selecciona un cliente para ver y editar su calendario tributario</p>
              </div>
            ) : calendarLoading ? (
              <div className="py-10"><PageLoader /></div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="text-left px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Obligación</th>
                      <th className="text-left px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tipo</th>
                      <th className="text-left px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Fecha de vencimiento</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {entries.map((e: any) => (
                      <tr key={e.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-900">{e.master?.title ?? '—'}</p>
                          {e.master?.description && <p className="text-xs text-slate-400">{e.master.description}</p>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-medium px-2 py-1 rounded-full ${e.is_mandatory ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                            {e.is_mandatory ? 'Obligatoria' : 'Opcional'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <input
                              type="date"
                              defaultValue={e.due_date ?? ''}
                              key={e.id + (e.due_date ?? '')}
                              onChange={ev => entryMut.mutate({ id: e.id, due_date: ev.target.value || null })}
                              className={`text-sm border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                                !e.due_date && e.is_mandatory ? 'border-amber-300 bg-amber-50' : 'border-slate-200'
                              }`}
                            />
                            {!e.due_date && e.is_mandatory && (
                              <span className="text-xs text-amber-600 font-medium">Sin diligenciar</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!entries.length && (
                  <p className="px-4 py-12 text-center text-slate-400 text-sm">La plantilla maestra está vacía</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Análisis ── */}
        {tab === 'analysis' && (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Estado de calendarios por empresa</h3>
              <div className="flex gap-1.5">
                {([['all', 'Todas'], ['complete', 'Completas'], ['incomplete', 'Incompletas']] as const).map(([k, l]) => (
                  <button key={k} onClick={() => setAnalysisFilter(k)}
                    className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-colors ${
                      analysisFilter === k ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="text-left px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Empresa</th>
                    <th className="text-center px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Obligatorias con fecha</th>
                    <th className="text-center px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Obligatorias sin fecha</th>
                    <th className="text-center px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Opcionales con fecha</th>
                    <th className="text-center px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Opcionales sin fecha</th>
                    <th className="text-left px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {analysisRows.map((c: any) => (
                    <tr key={c.id} className="hover:bg-slate-50 transition-colors cursor-pointer"
                      onClick={() => { setSelectedCompany(c.id); setTab('clients') }}>
                      <td className="px-4 py-3 font-medium text-slate-900">{c.name}</td>
                      <td className="px-4 py-3 text-center text-emerald-600 font-semibold">{c.mandatory_with_date}</td>
                      <td className={`px-4 py-3 text-center font-semibold ${c.mandatory_without_date ? 'text-red-600' : 'text-slate-400'}`}>{c.mandatory_without_date}</td>
                      <td className="px-4 py-3 text-center text-slate-600">{c.optional_with_date}</td>
                      <td className="px-4 py-3 text-center text-slate-400">{c.optional_without_date}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${c.complete ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                          {c.complete ? '✓ Completo' : '⚠ Incompleto'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!analysisRows.length && (
                <p className="px-4 py-12 text-center text-slate-400 text-sm">Sin empresas con servicio contable</p>
              )}
            </div>
          </div>
        )}

        {/* ── Plantilla maestra (solo Super Admin) ── */}
        {tab === 'master' && isSuperAdmin && (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Calendario tributario maestro</h3>
                <p className="text-xs text-slate-400">Los cambios se propagan a todos los calendarios de clientes, nuevos y existentes</p>
              </div>
              <Button size="sm" onClick={() => setMasterModal({ open: true, item: null })}>
                <Plus className="w-3.5 h-3.5" /> Nueva tarea
              </Button>
            </div>
            {masterLoading ? (
              <div className="py-10"><PageLoader /></div>
            ) : (
              <div className="divide-y divide-slate-50">
                {master.map((m: any) => (
                  <div key={m.id} className="flex items-center gap-4 px-4 py-3.5 hover:bg-slate-50 transition-colors group">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${m.is_mandatory ? 'bg-red-50' : 'bg-blue-50'}`}>
                      <Clock className={`w-4 h-4 ${m.is_mandatory ? 'text-red-500' : 'text-blue-500'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900">{m.title}</p>
                      {m.description && <p className="text-xs text-slate-400 truncate">{m.description}</p>}
                    </div>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full shrink-0 ${m.is_mandatory ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                      {m.is_mandatory ? 'Obligatoria' : 'Opcional'}
                    </span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button onClick={() => setMasterModal({ open: true, item: m })}
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-primary-600 transition-colors" title="Editar">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => confirm({
                          title: `¿Eliminar "${m.title}"?`,
                          description: 'Se eliminará de la plantilla maestra y de TODOS los calendarios de clientes, incluso los ya diligenciados. Esta acción no se puede deshacer.',
                          type: 'danger',
                          confirmLabel: 'Eliminar',
                          onConfirm: () => deleteMasterMut.mutateAsync(m.id).then(() => {}),
                        })}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors" title="Eliminar">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
                {!master.length && (
                  <p className="px-4 py-12 text-center text-slate-400 text-sm">La plantilla maestra está vacía — agrega la primera tarea</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {masterModal.open && (
        <MasterItemModal item={masterModal.item} onClose={() => setMasterModal({ open: false, item: null })} />
      )}
    </div>
  )
}
