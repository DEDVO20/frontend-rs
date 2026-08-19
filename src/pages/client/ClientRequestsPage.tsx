import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { PortalTopBar } from '@/components/layout/PortalTopBar'
import { PageLoader } from '@/components/ui/Spinner'
import { useAuthStore } from '@/stores/authStore'
import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'

function fmtDate(d?: string) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

function statusInfo(status?: string): { label: string; text: string; dot: string } {
  const s = status ?? 'open'
  if (s === 'resolved' || s === 'closed') return { label: 'Resuelta', text: 'text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500' }
  return { label: 'En proceso', text: 'text-gold-600 dark:text-gold-400', dot: 'bg-gold-500' }
}

const PRIORITY_LABEL: Record<string, string> = { low: 'Baja', medium: 'Media', high: 'Alta', urgent: 'Urgente' }

function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('rounded-2xl bg-cream-100 dark:bg-navy-900 ring-1 ring-navy-900/5 dark:ring-white/5', className)}>{children}</div>
}

export function ClientRequestsPage() {
  const qc = useQueryClient()
  const { user } = useAuthStore()
  const [selectedCat, setSelectedCat] = useState<string>('')
  const [detail, setDetail] = useState('')

  const { data: typesData } = useQuery({
    queryKey: ['request-types'],
    queryFn: async () => (await api.get('/api/requests/types')).data,
    staleTime: 120_000,
  })
  const types: any[] = Array.isArray(typesData) ? typesData : (typesData?.data ?? [])

  // Agrupar tipos por categoría (área/servicio) para las tarjetas
  const categories = useMemo(() => {
    const groups = new Map<string, any[]>()
    for (const t of types) {
      const cat = t.category ?? t.area ?? t.service?.name ?? t.group ?? t.name ?? 'General'
      if (!groups.has(cat)) groups.set(cat, [])
      groups.get(cat)!.push(t)
    }
    return Array.from(groups.entries()).map(([name, items]) => ({ name, count: items.length, firstId: items[0]?.id }))
  }, [types])

  const { data: reqData, isLoading } = useQuery({
    queryKey: ['client-requests'],
    queryFn: async () => (await api.get('/api/requests?limit=50')).data,
    staleTime: 30_000,
  })
  const requests: any[] = Array.isArray(reqData) ? reqData : (reqData?.data ?? [])

  const createMut = useMutation({
    mutationFn: async () => {
      const cat = categories.find(c => c.name === selectedCat)
      const body: any = {
        title: selectedCat,
        description: detail || undefined,
        priority: 'medium',
      }
      if (cat?.firstId) body.request_type_id = cat.firstId
      await api.post('/api/requests', body)
    },
    onSuccess: () => {
      toast.success('Solicitud enviada')
      setSelectedCat(''); setDetail('')
      qc.invalidateQueries({ queryKey: ['client-requests'] })
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Error al enviar la solicitud'),
  })

  const encargado = (r: any) => r.assignee?.full_name ?? 'Finto'

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PortalTopBar title="Solicitudes" subtitle="Solicitudes operativas" companyName={user?.full_name ?? 'Logo de la empresa'} />

      <div className="flex-1 overflow-y-auto px-5 md:px-8 pb-8 space-y-5">

        {/* Nueva solicitud */}
        <Card className="p-5 md:p-6 space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {categories.map(c => {
              const active = selectedCat === c.name
              return (
                <button
                  key={c.name}
                  onClick={() => setSelectedCat(active ? '' : c.name)}
                  className={cn('text-left rounded-xl px-4 py-3 ring-1 transition-colors',
                    active
                      ? 'bg-gold-500 text-cream-100 ring-gold-500'
                      : 'bg-cream-50 dark:bg-navy-800 ring-navy-900/15 dark:ring-white/10 text-navy-900 dark:text-cream-100 hover:bg-sand-300/40 dark:hover:bg-navy-700')}
                >
                  <p className="font-display font-bold text-sm leading-tight mb-2">{c.name}</p>
                  <p className={cn('text-[11px]', active ? 'text-cream-100/80' : 'text-navy-900/50 dark:text-cream-100/50')}>
                    {c.count} tipo{c.count !== 1 ? 's' : ''} de solicitud
                  </p>
                </button>
              )
            })}
            {!categories.length && (
              <p className="col-span-full text-sm text-navy-900/40 dark:text-cream-100/40 py-4">No hay tipos de solicitud disponibles.</p>
            )}
          </div>

          <div>
            <p className="text-[11px] font-bold text-brand-600 dark:text-brand-300 uppercase tracking-wider mb-2">Detalle adicional (opcional)</p>
            <textarea
              value={detail}
              onChange={e => setDetail(e.target.value)}
              rows={3}
              placeholder="Describe el contexto o adjunta números de documentos, fechas, montos…"
              className="w-full px-4 py-3 text-sm rounded-xl bg-sand-300/30 dark:bg-navy-800 ring-1 ring-navy-900/10 dark:ring-white/10
                         text-navy-900 dark:text-cream-100 placeholder:text-navy-900/40 dark:placeholder:text-cream-100/40
                         focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
            />
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => createMut.mutate()}
              disabled={!selectedCat || createMut.isPending}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-display font-bold text-sm
                         bg-navy-900 text-cream-100 hover:bg-navy-800 dark:bg-brand-600 dark:hover:bg-brand-500
                         disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {createMut.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Enviar solicitud
            </button>
          </div>
        </Card>

        {/* Historial */}
        <Card className="p-5 md:p-6">
          <h3 className="font-display font-bold text-navy-900 dark:text-cream-100 text-lg mb-4">Historial de Solicitudes</h3>

          {isLoading ? <div className="py-8"><PageLoader /></div> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="bg-sand-300/40 dark:bg-navy-800 text-[10px] font-bold uppercase tracking-wider text-navy-900/50 dark:text-cream-100/50">
                    <th className="text-left px-4 py-2.5 rounded-l-lg">Solicitud</th>
                    <th className="text-left px-4 py-2.5">Encargado</th>
                    <th className="text-left px-4 py-2.5">Tipo</th>
                    <th className="text-left px-4 py-2.5">Estado</th>
                    <th className="text-left px-4 py-2.5">Prioridad</th>
                    <th className="text-left px-4 py-2.5 rounded-r-lg">Fecha</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-900/5 dark:divide-white/5">
                  {requests.map((r: any) => {
                    const s = statusInfo(r.status)
                    return (
                      <tr key={r.id} className="hover:bg-sand-300/20 dark:hover:bg-white/5 transition-colors">
                        <td className="px-4 py-3">
                          <span className="text-brand-700 dark:text-brand-300 font-medium">{r.title}</span>
                        </td>
                        <td className="px-4 py-3 text-navy-900/70 dark:text-cream-100/70">{encargado(r)}</td>
                        <td className="px-4 py-3 text-navy-900/70 dark:text-cream-100/70">{r.operational_request_types?.name ?? 'Otro'}</td>
                        <td className="px-4 py-3">
                          <span className={cn('inline-flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap', s.text)}>
                            <span className={cn('w-2 h-2 rounded-full', s.dot)} /> {s.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-navy-900/70 dark:text-cream-100/70">{PRIORITY_LABEL[r.priority] ?? r.priority ?? '—'}</td>
                        <td className="px-4 py-3 text-navy-900/70 dark:text-cream-100/70 whitespace-nowrap">{fmtDate(r.requested_at ?? r.created_at)}</td>
                      </tr>
                    )
                  })}
                  {!requests.length && (
                    <tr><td colSpan={6} className="px-4 py-12 text-center text-navy-900/40 dark:text-cream-100/40">Aún no tienes solicitudes</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
