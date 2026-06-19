import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { TopBar } from '@/components/layout/TopBar'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { PageLoader } from '@/components/ui/Spinner'
import { formatDate } from '@/lib/utils'
import { Search, Eye, CheckCircle2, XCircle, Clock, FileEdit, AlertCircle } from 'lucide-react'
import { OnboardingDrawer } from './OnboardingDrawer'

// Estados reales que devuelve el backend
const STATUS: Record<string, { label: string; color: any; icon: any }> = {
  draft:              { label: 'Borrador',       color: 'gray',   icon: FileEdit },
  services_selected:  { label: 'Servicios',      color: 'blue',   icon: Clock },
  policies_accepted:  { label: 'Políticas',      color: 'blue',   icon: Clock },
  kyc_submitted:      { label: 'Docs. enviados', color: 'yellow', icon: Clock },
  pending_review:     { label: 'En revisión',    color: 'yellow', icon: Clock },
  approved:           { label: 'Aprobado',       color: 'green',  icon: CheckCircle2 },
  rejected:           { label: 'Rechazado',      color: 'red',    icon: XCircle },
  resubmit:           { label: 'Reenviar',       color: 'orange', icon: AlertCircle },
  needs_correction:   { label: 'Corrección',     color: 'orange', icon: AlertCircle },
}

// Solo los estados visibles en los filtros rápidos
const FILTER_STATUSES = ['draft', 'pending_review', 'approved', 'rejected', 'needs_correction']

export function OnboardingPage() {
  const [search, setSearch]       = useState('')
  const [status, setStatus]       = useState('')
  const [page, setPage]           = useState(1)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['onboarding', search, status, page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      if (status) params.set('status', status)
      const { data } = await api.get(`/api/onboarding?${params}`)
      return data
    },
  })

  // Filtro local por búsqueda (el backend aún no tiene búsqueda por texto)
  const rows = search
    ? (data?.data ?? []).filter((item: any) =>
        item.company_name?.toLowerCase().includes(search.toLowerCase()) ||
        item.rep_name?.toLowerCase().includes(search.toLowerCase()) ||
        item.rep_email?.toLowerCase().includes(search.toLowerCase()) ||
        item.company_nit?.includes(search)
      )
    : (data?.data ?? [])

  return (
    <>
    <div>
      <TopBar title="Onboarding" subtitle="Solicitudes de incorporación de clientes" />

      <div className="p-6 space-y-5">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="search"
                placeholder="Buscar empresa, NIT o contacto..."
                className="pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 w-72"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1) }}
              />
            </div>
            <select
              className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              value={status}
              onChange={e => { setStatus(e.target.value); setPage(1) }}
            >
              <option value="">Todos los estados</option>
              {Object.entries(STATUS).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Filtros rápidos */}
        <div className="flex flex-wrap gap-2">
          {FILTER_STATUSES.map(key => {
            const s = STATUS[key]
            const Icon = s.icon
            return (
              <button
                key={key}
                onClick={() => setStatus(status === key ? '' : key)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  status === key
                    ? 'border-primary-400 bg-primary-50 text-primary-700'
                    : 'border-slate-200 bg-white text-slate-500 hover:border-primary-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {s.label}
              </button>
            )
          })}
          {status && (
            <button
              onClick={() => setStatus('')}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium text-slate-400 hover:text-slate-600"
            >
              × Limpiar filtro
            </button>
          )}
        </div>

        {/* Tabla */}
        <Card>
          <CardHeader>
            <p className="text-sm font-medium text-slate-700">
              {data?.total ?? 0} solicitudes en total
            </p>
          </CardHeader>

          {isLoading ? (
            <CardBody><PageLoader /></CardBody>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Empresa</th>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Representante</th>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Estado</th>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tipo</th>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Fecha</th>
                      <th className="px-6 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {rows.map((item: any) => {
                      const s = STATUS[item.status] ?? { label: item.status, color: 'gray', icon: Clock }
                      return (
                        <tr key={item.id} className="hover:bg-slate-50 transition-colors group">
                          <td className="px-6 py-3.5">
                            <p className="font-medium text-slate-900">{item.company_name ?? '—'}</p>
                            {item.company_nit && (
                              <p className="text-xs text-slate-400">NIT {item.company_nit}</p>
                            )}
                          </td>
                          <td className="px-6 py-3.5">
                            <p className="text-slate-700 text-sm">{item.rep_name ?? '—'}</p>
                            {item.rep_email && (
                              <p className="text-xs text-slate-400">{item.rep_email}</p>
                            )}
                          </td>
                          <td className="px-6 py-3.5">
                            <Badge label={s.label} color={s.color as any} />
                          </td>
                          <td className="px-6 py-3.5 text-slate-500 text-xs">
                            {item.company_type ?? '—'}
                          </td>
                          <td className="px-6 py-3.5 text-slate-400 text-xs">
                            {item.created_at ? formatDate(item.created_at) : '—'}
                          </td>
                          <td className="px-6 py-3.5">
                            <button
                              onClick={() => setSelectedId(item.id)}
                              className="inline-flex items-center gap-1 text-primary-600 text-xs font-medium hover:underline"
                            >
                              <Eye className="w-3.5 h-3.5" /> Ver
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                    {!rows.length && (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                          {search ? `Sin resultados para "${search}"` : 'No hay solicitudes de onboarding'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {data && data.total > 20 && (
                <div className="px-6 py-3 border-t border-slate-100 flex items-center justify-between text-sm text-slate-500">
                  <span>Página {page} de {Math.ceil(data.total / 20)}</span>
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Anterior</Button>
                    <Button variant="secondary" size="sm" disabled={page >= Math.ceil(data.total / 20)} onClick={() => setPage(p => p + 1)}>Siguiente</Button>
                  </div>
                </div>
              )}
            </>
          )}
        </Card>
      </div>
    </div>
    <OnboardingDrawer id={selectedId} onClose={() => setSelectedId(null)} />
  </>
  )
}
