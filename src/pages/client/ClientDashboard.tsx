import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { TopBar } from '@/components/layout/TopBar'
import { PageLoader } from '@/components/ui/Spinner'
import { useAuthStore } from '@/stores/authStore'
import { useNavigate } from 'react-router-dom'
import {
  ClipboardList, FileText, AlertTriangle, Building2,
} from 'lucide-react'

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Buenos días'
  if (h < 18) return 'Buenas tardes'
  return 'Buenas noches'
}

export function ClientDashboard() {
  const { user } = useAuthStore()
  const nav = useNavigate()

  const { data, isLoading } = useQuery({
    queryKey: ['client-dashboard'],
    queryFn: async () => {
      const [company, tasks, documents] = await Promise.allSettled([
        api.get(`/api/companies/${user?.companyId}`),
        api.get('/api/tasks?limit=100'),
        api.get('/api/documents?limit=10'),
      ])

      const companyData = company.status === 'fulfilled' ? company.value.data : null
      const tasksData   = tasks.status === 'fulfilled' ? tasks.value.data : { data: [], total: 0 }
      const docsData    = documents.status === 'fulfilled' ? documents.value.data : { data: [], total: 0 }

      const allTasks: any[] = Array.isArray(tasksData) ? tasksData : (tasksData.data ?? [])
      const today = new Date().toISOString().split('T')[0]!
      const pending = allTasks.filter((t: any) => t.status !== 'done' && t.status !== 'completed')
      const overdue = pending.filter((t: any) => t.due_date && t.due_date < today)

      const allDocs: any[] = Array.isArray(docsData) ? docsData : (docsData.data ?? [])

      return {
        company: companyData,
        tasks: allTasks,
        pending,
        overdue,
        docs: allDocs,
        totalTasks: tasksData.total ?? allTasks.length,
        totalDocs: docsData.total ?? allDocs.length,
      }
    },
    staleTime: 60_000,
  })

  if (isLoading) return <PageLoader />

  const d = data!

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar title="Dashboard" subtitle={d.company?.name ?? 'Mi empresa'} />

      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5">

        <h2 className="text-xl font-bold text-slate-900">{greeting()}, bienvenido</h2>

        {d.overdue.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
            <p className="text-sm font-semibold text-amber-800">
              Tienes {d.overdue.length} tarea{d.overdue.length !== 1 ? 's' : ''} vencida{d.overdue.length !== 1 ? 's' : ''}.
            </p>
            <button onClick={() => nav('/app/tasks')} className="text-sm font-medium text-amber-700 hover:text-amber-900 ml-auto">
              Ver tareas →
            </button>
          </div>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary-500 flex items-center justify-center shrink-0">
              <ClipboardList className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Tareas pendientes</p>
              <p className="text-2xl font-bold text-slate-900">{d.pending.length}</p>
              <p className="text-xs text-slate-400">{d.overdue.length} vencidas</p>
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-violet-500 flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Documentos</p>
              <p className="text-2xl font-bold text-slate-900">{d.totalDocs}</p>
              <p className="text-xs text-slate-400">En la plataforma</p>
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500 flex items-center justify-center shrink-0">
              <Building2 className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Empresa</p>
              <p className="text-2xl font-bold text-slate-900">{d.company?.name ?? '—'}</p>
              <p className="text-xs text-slate-400">NIT: {d.company?.nit ?? '—'}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Tareas */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Tareas pendientes</h3>
              <button onClick={() => nav('/app/tasks')} className="text-xs font-medium text-primary-600 hover:text-primary-800">Ver todas →</button>
            </div>
            <div className="divide-y divide-slate-50 max-h-[320px] overflow-y-auto">
              {d.pending.slice(0, 8).map((t: any) => {
                const today = new Date().toISOString().split('T')[0]!
                const isOverdue = t.due_date && t.due_date < today
                return (
                  <div key={t.id} className="px-4 py-3 hover:bg-slate-50 transition-colors">
                    <p className="text-sm font-medium text-slate-900">{t.title}</p>
                    <div className="flex items-center gap-3 mt-1">
                      {isOverdue && <span className="text-xs text-red-600 font-medium">🔴 Vencida</span>}
                      {t.due_date && <span className="text-xs text-slate-400">📅 {fmtDate(t.due_date)}</span>}
                      {t.services?.name && <span className="text-xs text-slate-400">{t.services.name}</span>}
                    </div>
                  </div>
                )
              })}
              {!d.pending.length && (
                <p className="text-center text-sm text-slate-400 py-8">Sin tareas pendientes 🎉</p>
              )}
            </div>
          </div>

          {/* Documentos */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Documentos recientes</h3>
              <button onClick={() => nav('/app/documents')} className="text-xs font-medium text-primary-600 hover:text-primary-800">Ver todos →</button>
            </div>
            <div className="divide-y divide-slate-50 max-h-[320px] overflow-y-auto">
              {d.docs.slice(0, 8).map((doc: any) => (
                <div key={doc.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4 text-slate-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{doc.title ?? doc.name ?? doc.file_name ?? '—'}</p>
                    <p className="text-xs text-slate-400">{doc.category ?? 'general'} · {doc.created_at ? fmtDate(doc.created_at) : '—'}</p>
                  </div>
                </div>
              ))}
              {!d.docs.length && (
                <p className="text-center text-sm text-slate-400 py-8">Sin documentos recientes</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
