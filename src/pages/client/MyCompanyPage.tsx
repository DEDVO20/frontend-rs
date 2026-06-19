import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { TopBar } from '@/components/layout/TopBar'
import { PageLoader } from '@/components/ui/Spinner'
import { useAuthStore } from '@/stores/authStore'
import { Building2, CheckCircle2 } from 'lucide-react'

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function MyCompanyPage() {
  const { user } = useAuthStore()
  const companyId = user?.companyId

  const { data: company, isLoading } = useQuery({
    queryKey: ['my-company', companyId],
    queryFn: async () => {
      const { data } = await api.get(`/api/companies/${companyId}`)
      return data
    },
    enabled: !!companyId,
  })

  const { data: servicesData } = useQuery({
    queryKey: ['my-company-services', companyId],
    queryFn: async () => {
      const { data } = await api.get(`/api/company-services/${companyId}`)
      return data
    },
    enabled: !!companyId,
  })

  if (!companyId) return (
    <div className="flex flex-col h-full">
      <TopBar title="Mi empresa" subtitle="" />
      <div className="flex-1 flex items-center justify-center text-slate-400">No tienes empresa asignada</div>
    </div>
  )

  if (isLoading) return <PageLoader />

  const co = company
  const services: any[] = servicesData ?? []

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar title="Mi empresa" subtitle={co?.name ?? ''} />

      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5">

        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-primary-500 flex items-center justify-center text-white font-bold text-xl">
            {(co?.name ?? '?')[0]!.toUpperCase()}
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">{co?.name}</h2>
            <p className="text-sm text-slate-400">NIT: {co?.nit ?? '—'} · {co?.city ?? '—'}</p>
          </div>
        </div>

        {/* Datos */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-5 bg-primary-500 rounded-full" />
            <h3 className="text-xs font-bold text-primary-600 uppercase tracking-wider">Datos de la empresa</h3>
          </div>
          <div className="grid grid-cols-2 gap-x-8 gap-y-4">
            {[
              { label: 'Razón social', value: co?.name },
              { label: 'NIT', value: co?.nit },
              { label: 'Ciudad', value: co?.city },
              { label: 'Sector', value: co?.sector },
              { label: 'Teléfono', value: co?.phone },
              { label: 'Dirección', value: co?.address },
              { label: 'Sitio web', value: co?.website },
              { label: 'Estado', value: co?.status },
            ].map((f, i) => (
              <div key={i}>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{f.label}</p>
                <p className="text-sm font-medium text-slate-900 mt-0.5">{f.value || '—'}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Servicios */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-5 bg-primary-500 rounded-full" />
            <h3 className="text-xs font-bold text-primary-600 uppercase tracking-wider">Servicios contratados</h3>
          </div>
          {services.length ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {services.map((s: any) => (
                <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl border border-primary-200 bg-primary-50/30">
                  <CheckCircle2 className="w-5 h-5 text-primary-500 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-slate-900">{s.services?.name ?? '—'}</p>
                    <p className="text-xs text-slate-400">{s.services?.description ?? ''}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400 text-center py-4">Sin servicios contratados</p>
          )}
        </div>
      </div>
    </div>
  )
}
