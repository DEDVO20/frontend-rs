import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { CheckCircle2, KeyRound, Handshake, XCircle } from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { PageLoader } from '@/components/ui/Spinner'
import { useAuthStore } from '@/stores/authStore'
import { useSiigoSyncStore } from '@/stores/siigoSyncStore'

interface HubspotConnection {
  id: string
  company_id: string | null
  label: string
  active: boolean
  has_token: boolean
  last_test_at: string | null
  last_test_ok: boolean | null
  last_test_message: string | null
}

const fmtDateTime = (d: string | null) => (d ? new Date(d).toLocaleString('es-CO') : '—')

/**
 * Conexión de HubSpot de una empresa (Empresas → Siigo), para las gráficas de CRM.
 * El token de la private app se guarda cifrado y no se vuelve a mostrar.
 */
export function HubspotConnectionPanel({ companyId }: { companyId: string }) {
  const qc = useQueryClient()
  const role = useAuthStore(s => s.user?.role ?? '')
  const canEdit = ['admin', 'rs_admin'].includes(role)
  const startWatching = useSiigoSyncStore(s => s.start)

  const { data: conn, isLoading } = useQuery<HubspotConnection | null>({
    queryKey: ['hubspot-connection', companyId],
    queryFn: async () => (await api.get(`/api/hubspot/connections/company/${companyId}`)).data,
  })

  const [token, setToken] = useState('')
  const [active, setActive] = useState(true)

  useEffect(() => {
    setActive(conn?.active ?? true)
    setToken('')
  }, [conn])

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['hubspot-connection', companyId] })
    qc.invalidateQueries({ queryKey: ['hubspot-report'] })
  }

  const saveMut = useMutation({
    mutationFn: async () => (await api.put(`/api/hubspot/connections/company/${companyId}`, {
      ...(token.trim() ? { token: token.trim() } : {}),
      active,
    })).data as HubspotConnection,
    onSuccess: () => {
      toast.success('Conexión de HubSpot guardada')
      setToken('')
      invalidate()
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'No se pudo guardar la conexión de HubSpot'),
  })

  const testMut = useMutation({
    mutationFn: async () => (await api.post(`/api/hubspot/connections/${conn!.id}/test`)).data as HubspotConnection,
    onSuccess: (res) => {
      if (res.last_test_ok) toast.success('Conexión con HubSpot correcta')
      else toast.error(`HubSpot rechazó el token: ${res.last_test_message ?? ''}`)
      invalidate()
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'No se pudo probar la conexión'),
  })

  const syncMut = useMutation({
    mutationFn: async () => (await api.post('/api/hubspot/sync', { companyId })).data,
    onSuccess: (res) => {
      startWatching('hubspot', res.connectionId, res.label ?? conn?.label ?? 'HubSpot')
      toast.info('Sincronización de HubSpot iniciada en segundo plano. Te avisaremos cuando termine.')
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'No se pudo iniciar la sincronización de HubSpot'),
  })

  if (isLoading) return <PageLoader />

  const inputCls = 'w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-slate-50 disabled:text-slate-500'
  const isNew = !conn

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 p-4 rounded-xl border border-slate-200 bg-slate-50">
        <Handshake className="w-5 h-5 text-primary-600 shrink-0 mt-0.5" />
        <div className="text-sm text-slate-600 space-y-1">
          <p className="font-semibold text-slate-800">HubSpot (CRM) de esta empresa</p>
          <p>
            Con el token de una <b>private app</b> de HubSpot se traen los negocios para las gráficas de propuestas.
            La private app necesita los permisos <code>crm.objects.deals.read</code> y <code>crm.objects.owners.read</code>.
          </p>
        </div>
      </div>

      {conn && (
        <div className={cn(
          'flex items-center gap-2 px-4 py-3 rounded-xl border text-sm',
          conn.last_test_ok === true ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
            : conn.last_test_ok === false ? 'border-red-200 bg-red-50 text-red-800'
              : 'border-slate-200 bg-white text-slate-600',
        )}>
          {conn.last_test_ok === true ? <CheckCircle2 className="w-4 h-4" /> : conn.last_test_ok === false ? <XCircle className="w-4 h-4" /> : <KeyRound className="w-4 h-4" />}
          <span className="flex-1">
            {conn.last_test_ok === null
              ? 'Conexión guardada, aún sin probar.'
              : `${conn.last_test_ok ? 'Última prueba correcta' : 'Última prueba fallida'} · ${fmtDateTime(conn.last_test_at)}` +
                (conn.last_test_ok ? '' : ` · ${conn.last_test_message ?? ''}`)}
          </span>
          {!conn.active && <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-200 text-slate-700">Inactiva</span>}
        </div>
      )}

      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1">Token de la private app {isNew ? '*' : ''}</label>
        <input
          type="password"
          autoComplete="new-password"
          value={token}
          onChange={e => setToken(e.target.value)}
          disabled={!canEdit}
          placeholder={conn?.has_token ? '•••••••• guardado (escribe para reemplazarlo)' : 'pat-na1-…'}
          className={inputCls}
        />
        <p className="text-[11px] text-slate-400 mt-1">Se guarda cifrado y no se vuelve a mostrar.</p>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} disabled={!canEdit} className="rounded" />
        Conexión activa (se sincroniza automáticamente cada día)
      </label>

      {canEdit && (
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => saveMut.mutate()} loading={saveMut.isPending} disabled={isNew && !token.trim()}>
            {isNew ? 'Conectar HubSpot' : 'Guardar cambios'}
          </Button>
          {conn && (
            <>
              <Button variant="secondary" onClick={() => testMut.mutate()} loading={testMut.isPending}>Probar conexión</Button>
              <Button variant="secondary" onClick={() => syncMut.mutate()} loading={syncMut.isPending} disabled={!conn.active}>
                Sincronizar negocios
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
