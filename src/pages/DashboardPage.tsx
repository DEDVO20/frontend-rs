import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { TopBar } from '@/components/layout/TopBar'
import { PageLoader } from '@/components/ui/Spinner'
import { useNavigate } from 'react-router-dom'
import {
  Building2, CheckCircle2, FileText, BarChart3,
  AlertTriangle, ChevronRight, Eye, RefreshCw,
} from 'lucide-react'

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Buenos días'
  if (h < 18) return 'Buenas tardes'
  return 'Buenas noches'
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    active:  { label: 'activa',  cls: 'bg-emerald-50 text-emerald-700' },
    nueva:   { label: 'nueva',   cls: 'bg-blue-50 text-blue-700' },
    pending: { label: 'pendiente', cls: 'bg-amber-50 text-amber-700' },
    new:     { label: 'nueva',   cls: 'bg-blue-50 text-blue-700' },
  }
  const s = map[status] ?? { label: status, cls: 'bg-slate-100 text-slate-600' }
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${s.cls}`}>{s.label}</span>
}

export function DashboardPage() {
  const nav = useNavigate()

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: async () => {
      const [companies, tasks, documents, dashboards, requests] = await Promise.allSettled([
        api.get('/api/companies?limit=100'),
        api.get('/api/tasks?limit=100'),
        api.get('/api/documents?limit=20'),
        api.get('/api/dashboards'),
        api.get('/api/requests?limit=20'),
      ])

      const companiesData = companies.status === 'fulfilled' ? companies.value.data : { data: [], total: 0 }
      const tasksData     = tasks.status === 'fulfilled'     ? tasks.value.data     : { data: [], total: 0 }
      const docsData      = documents.status === 'fulfilled' ? documents.value.data : { data: [], total: 0 }
      const dashData      = dashboards.status === 'fulfilled' ? dashboards.value.data : []
      const reqData       = requests.status === 'fulfilled'  ? requests.value.data  : { data: [], total: 0 }

      const allCompanies = Array.isArray(companiesData) ? companiesData : (companiesData.data ?? [])
      const totalCompanies = companiesData.total ?? allCompanies.length
      const activeCompanies = allCompanies.filter((c: any) => c.status === 'active' || c.onboarding_status === 'approved').length

      const allTasks = Array.isArray(tasksData) ? tasksData : (tasksData.data ?? [])
      const totalTasks = tasksData.total ?? allTasks.length
      const today = new Date().toISOString().split('T')[0]!
      const overdueTasks = allTasks.filter((t: any) => t.status !== 'done' && t.status !== 'completed' && t.due_date && t.due_date < today)
      const pendingTasks = allTasks.filter((t: any) => t.status !== 'done' && t.status !== 'completed')

      const allDocs = Array.isArray(docsData) ? docsData : (docsData.data ?? [])
      const totalDocs = docsData.total ?? allDocs.length

      const allDashboards = Array.isArray(dashData) ? dashData : []
      const publishedDashboards = allDashboards.filter((d: any) => d.active)

      const allRequests = Array.isArray(reqData) ? reqData : (reqData.data ?? [])
      const openRequests = allRequests.filter((r: any) => r.status === 'open' || r.status === 'pending')
      const inProgress = allRequests.filter((r: any) => r.status === 'in_progress')

      // Cobertura de servicios
      const modules = { facturacion: 0, contabilidad: 0, tesoreria: 0, personal: 0 }
      allCompanies.forEach((c: any) => {
        const mods: string[] = c.modules ?? c.active_modules ?? []
        if (mods.includes('billing') || mods.includes('facturacion')) modules.facturacion++
        if (mods.includes('accounting') || mods.includes('contabilidad')) modules.contabilidad++
        if (mods.includes('treasury') || mods.includes('tesoreria')) modules.tesoreria++
        if (mods.includes('hr') || mods.includes('personal') || mods.includes('payroll')) modules.personal++
      })

      return {
        companies: allCompanies, totalCompanies, activeCompanies,
        tasks: allTasks, totalTasks, pendingTasks, overdueTasks,
        docs: allDocs, totalDocs,
        dashboards: allDashboards, publishedDashboards,
        requests: allRequests, openRequests, inProgress,
        modules, companyCount: allCompanies.length,
      }
    },
    staleTime: 60_000,
  })

  if (isLoading) return <PageLoader />

  const d = data!
  const todayStr = new Date().toLocaleDateString('es-CO', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar title="Dashboard" subtitle="Vista general" />

      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">{greeting()} — Vista general</h2>
            <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Conectado
              </span>
              <span>{todayStr}</span>
            </div>
          </div>
          <button onClick={() => refetch()} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Banner alerta */}
        {d.overdueTasks.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-800">
                {d.overdueTasks.length} tareas vencidas requieren atención inmediata.
              </p>
            </div>
            <button onClick={() => nav('/tasks')} className="text-sm font-medium text-amber-700 hover:text-amber-900 whitespace-nowrap">
              Revisar →
            </button>
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-500 flex items-center justify-center shrink-0">
              <Building2 className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Empresas activas</p>
              <p className="text-2xl font-bold text-slate-900">{d.activeCompanies}</p>
              <p className="text-xs text-slate-400">{d.totalCompanies} total en Supabase</p>
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Tareas pendientes</p>
              <p className="text-2xl font-bold text-slate-900">{d.pendingTasks.length}</p>
              <p className="text-xs text-slate-400">{d.overdueTasks.length} vencidas</p>
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-violet-500 flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Documentos</p>
              <p className="text-2xl font-bold text-slate-900">{d.totalDocs}</p>
              <p className="text-xs text-slate-400">Últimos 20 registros</p>
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-sky-500 flex items-center justify-center shrink-0">
              <BarChart3 className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Dashboards BI activos</p>
              <p className="text-2xl font-bold text-slate-900">{d.publishedDashboards.length}</p>
              <p className="text-xs text-slate-400">{d.publishedDashboards.length} publicados</p>
            </div>
          </div>
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Empresas clientes */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Supabase · companies</p>
                <p className="text-sm font-bold text-slate-900 mt-0.5">Empresas clientes</p>
                <p className="text-xs text-slate-400">{d.companyCount} empresas · {d.activeCompanies} activas</p>
              </div>
              <button onClick={() => nav('/companies')} className="flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-800">
                <RefreshCw className="w-3 h-3" /> Ver todas →
              </button>
            </div>
            <div className="divide-y divide-slate-50">
              <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-4 py-2 text-xs font-medium text-slate-400">
                <span>Empresa</span>
                <span>Módulos</span>
                <span>Estado</span>
                <span>Creada</span>
              </div>
              {d.companies.slice(0, 6).map((c: any) => (
                <div key={c.id} className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-4 py-3 items-center hover:bg-slate-50 transition-colors">
                  <p className="text-sm font-medium text-slate-900 truncate">{c.name ?? c.legal_name ?? '—'}</p>
                  <span className="text-xs text-slate-400">{(c.modules ?? c.active_modules ?? []).length || '—'}</span>
                  <StatusBadge status={c.status ?? c.onboarding_status ?? 'nueva'} />
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">{c.created_at ? fmtDate(c.created_at) : '—'}</span>
                    <button onClick={() => nav(`/companies/${c.id}`)} className="text-slate-400 hover:text-primary-600">
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              {!d.companies.length && (
                <p className="text-center text-sm text-slate-400 py-6">Sin empresas registradas</p>
              )}
            </div>
          </div>

          {/* Tareas urgentes */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Supabase · tasks</p>
                <p className="text-sm font-bold text-slate-900 mt-0.5">Tareas urgentes</p>
                <p className="text-xs text-slate-400">{d.pendingTasks.length} pendientes · {d.overdueTasks.length} vencidas</p>
              </div>
              <button onClick={() => nav('/tasks')} className="text-xs font-medium text-primary-600 hover:text-primary-800">
                Ver todas →
              </button>
            </div>
            <div className="divide-y divide-slate-50 max-h-[360px] overflow-y-auto">
              {(d.overdueTasks.length ? d.overdueTasks : d.pendingTasks).slice(0, 7).map((t: any) => {
                const isOverdue = t.due_date && t.due_date < new Date().toISOString().split('T')[0]!
                return (
                  <div key={t.id} className="px-4 py-3 hover:bg-slate-50 transition-colors">
                    <p className="text-sm font-medium text-slate-900">{t.title}</p>
                    <div className="flex items-center gap-3 mt-1">
                      {isOverdue && <span className="text-xs font-medium text-red-600 flex items-center gap-1">🔴 Vencida</span>}
                      {t.due_date && <span className="text-xs text-slate-400">📅 {fmtDate(t.due_date)}</span>}
                      {t.company_name && <span className="text-xs text-slate-400">🏢 {t.company_name}</span>}
                    </div>
                  </div>
                )
              })}
              {!d.pendingTasks.length && (
                <p className="text-center text-sm text-slate-400 py-6">Sin tareas pendientes</p>
              )}
            </div>
          </div>

          {/* Documentos recientes */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Supabase · documents</p>
                <p className="text-sm font-bold text-slate-900 mt-0.5">Documentos recientes</p>
                <p className="text-xs text-slate-400">{d.totalDocs} documento{d.totalDocs !== 1 ? 's' : ''} cargados</p>
              </div>
              <button onClick={() => nav('/documents')} className="text-xs font-medium text-primary-600 hover:text-primary-800">
                Ver todos →
              </button>
            </div>
            <div className="divide-y divide-slate-50">
              {d.docs.slice(0, 5).map((doc: any) => (
                <div key={doc.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4 text-slate-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{doc.title ?? doc.name ?? doc.file_name ?? '—'}</p>
                    <p className="text-xs text-slate-400">
                      {doc.company_name ?? doc.category ?? '—'} · {doc.status ?? 'Disponible'} · {doc.created_at ? fmtDate(doc.created_at) : '—'}
                    </p>
                  </div>
                </div>
              ))}
              {!d.docs.length && (
                <p className="text-center text-sm text-slate-400 py-6">Sin documentos recientes</p>
              )}
            </div>
          </div>

          {/* Cobertura de servicios + Solicitudes */}
          <div className="space-y-5">

            {/* Cobertura */}
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Cobertura de servicios</p>
              <p className="text-xs text-slate-400 mb-4">{d.companyCount} empresas · cobertura actual</p>
              <div className="space-y-3">
                {[
                  { label: 'Facturación',  icon: '🧾', count: d.modules.facturacion },
                  { label: 'Contabilidad', icon: '📋', count: d.modules.contabilidad },
                  { label: 'Tesorería',    icon: '🏦', count: d.modules.tesoreria },
                  { label: 'Personal',     icon: '👥', count: d.modules.personal },
                ].map(m => {
                  const pct = d.companyCount > 0 ? Math.round((m.count / d.companyCount) * 100) : 0
                  return (
                    <div key={m.label} className="flex items-center gap-3">
                      <span className="text-sm">{m.icon}</span>
                      <span className="text-sm text-slate-700 w-28">{m.label}</span>
                      <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div className="h-full bg-primary-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-sm font-bold text-slate-700 w-12 text-right">{pct}%</span>
                    </div>
                  )
                })}
              </div>
              <div className="grid grid-cols-2 gap-3 mt-4 pt-3 border-t border-slate-100">
                <div>
                  <p className="text-xs text-slate-400">Dashboards BI</p>
                  <p className="text-lg font-bold text-slate-900">{d.publishedDashboards.length}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Usuarios portal</p>
                  <p className="text-lg font-bold text-slate-900">—</p>
                </div>
              </div>
            </div>

            {/* Solicitudes pendientes */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Supabase · operational_requests</p>
                  <p className="text-sm font-bold text-slate-900 mt-0.5">Solicitudes pendientes</p>
                  <p className="text-xs text-slate-400">{d.openRequests.length} abierta{d.openRequests.length !== 1 ? 's' : ''} · {d.inProgress.length} en proceso</p>
                </div>
                <button onClick={() => nav('/requests')} className="text-xs font-medium text-primary-600 hover:text-primary-800">
                  Ver todas →
                </button>
              </div>
              <div className="divide-y divide-slate-50">
                <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 px-4 py-2 text-xs font-medium text-slate-400">
                  <span>Solicitud</span>
                  <span>Empresa</span>
                  <span>Tipo</span>
                  <span>Estado</span>
                  <span>Fecha</span>
                </div>
                {d.requests.slice(0, 5).map((r: any) => (
                  <div key={r.id} className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 px-4 py-3 items-center hover:bg-slate-50 transition-colors">
                    <p className="text-sm font-medium text-slate-900 truncate">{r.title ?? r.description ?? '—'}</p>
                    <span className="text-xs text-slate-400 truncate max-w-[100px]">{r.company_name ?? '—'}</span>
                    <span className="text-xs text-slate-400">{r.type_name ?? r.request_type ?? '—'}</span>
                    <StatusBadge status={r.status ?? 'pending'} />
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">{r.created_at ? fmtDate(r.created_at) : '—'}</span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
                    </div>
                  </div>
                ))}
                {!d.requests.length && (
                  <p className="text-center text-sm text-slate-400 py-6">Sin solicitudes pendientes</p>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
