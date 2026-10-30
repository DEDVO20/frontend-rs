import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { CheckCircle2, KeyRound, PlugZap, XCircle } from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { PageLoader } from '@/components/ui/Spinner'
import { useAuthStore } from '@/stores/authStore'
import type { SiigoConnection } from './siigoBooks'

const fmtDateTime = (d: string | null) => (d ? new Date(d).toLocaleString('es-CO') : '—')

/**
 * Conexión de Siigo de una empresa cliente (Empresas → Siigo).
 * Las credenciales se guardan cifradas; la access key nunca se vuelve a mostrar.
 */
export function SiigoConnectionPanel({ companyId }: { companyId: string }) {
  const qc = useQueryClient()
  const role = useAuthStore(s => s.user?.role ?? '')
  const canEdit = ['admin', 'rs_admin'].includes(role)

  const { data: conn, isLoading } = useQuery<SiigoConnection | null>({
    queryKey: ['siigo-connection', companyId],
    queryFn: async () => (await api.get(`/api/siigo/connections/company/${companyId}`)).data,
  })

  const [username, setUsername] = useState('')
  const [accessKey, setAccessKey] = useState('')
  const [partnerId, setPartnerId] = useState('')
  const [sellerFilter, setSellerFilter] = useState('')
  const [salesStartYear, setSalesStartYear] = useState('')
  const [collectionsStartDate, setCollectionsStartDate] = useState('')
  const [active, setActive] = useState(true)

  useEffect(() => {
    setUsername(conn?.username ?? '')
    setPartnerId(conn?.partner_id ?? '')
    setSellerFilter(conn?.seller_filter ?? '')
    setSalesStartYear(conn?.sales_start_year ? String(conn.sales_start_year) : '')
    setCollectionsStartDate(conn?.collections_start_date ?? '')
    setActive(conn?.active ?? true)
    setAccessKey('')
  }, [conn])

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['siigo-connection', companyId] })
    qc.invalidateQueries({ queryKey: ['siigo-connections'] })
  }

  const saveMut = useMutation({
    mutationFn: async () => (await api.put(`/api/siigo/connections/company/${companyId}`, {
      username,
      ...(accessKey.trim() ? { accessKey: accessKey.trim() } : {}),
      partnerId,
      sellerFilter,
      salesStartYear: salesStartYear ? Number(salesStartYear) : null,
      collectionsStartDate: collectionsStartDate || null,
      active,
    })).data as SiigoConnection,
    onSuccess: () => {
      toast.success('Conexión de Siigo guardada')
      setAccessKey('')
      invalidate()
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'No se pudo guardar la conexión'),
  })

  const testMut = useMutation({
    mutationFn: async () => (await api.post(`/api/siigo/connections/${conn!.id}/test`)).data as SiigoConnection,
    onSuccess: (res) => {
      if (res.last_test_ok) toast.success('Conexión con Siigo correcta')
      else toast.error(`Siigo rechazó las credenciales: ${res.last_test_message ?? ''}`)
      invalidate()
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'No se pudo probar la conexión'),
  })

  if (isLoading) return <PageLoader />

  const inputCls = 'w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-slate-50 disabled:text-slate-500'
  const isNew = !conn
  const dirtyKeyMissing = isNew && !accessKey.trim()

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 p-4 rounded-xl border border-slate-200 bg-slate-50">
        <PlugZap className="w-5 h-5 text-primary-600 shrink-0 mt-0.5" />
        <div className="text-sm text-slate-600 space-y-1">
          <p className="font-semibold text-slate-800">Cuenta de Siigo de esta empresa</p>
          <p>
            Con estas credenciales se sincronizan los libros de la empresa (su facturación, su recaudo y su balance de prueba).
            El cliente verá solo esos datos en su portal, nunca los de Finto.
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Usuario de API de Siigo *</label>
          <input value={username} onChange={e => setUsername(e.target.value)} disabled={!canEdit} placeholder="usuario@empresa.com" className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Access key {isNew ? '*' : ''}</label>
          <input
            type="password"
            autoComplete="new-password"
            value={accessKey}
            onChange={e => setAccessKey(e.target.value)}
            disabled={!canEdit}
            placeholder={conn?.has_access_key ? '•••••••• guardada (escribe para reemplazarla)' : 'Pega la access key de Siigo'}
            className={inputCls}
          />
          <p className="text-[11px] text-slate-400 mt-1">Se guarda cifrada y no se vuelve a mostrar.</p>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Partner-Id (opcional)</label>
          <input value={partnerId} onChange={e => setPartnerId(e.target.value)} disabled={!canEdit} placeholder="Por defecto, el de Finto" className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">ID de vendedor (opcional)</label>
          <input value={sellerFilter} onChange={e => setSellerFilter(e.target.value)} disabled={!canEdit} placeholder="Vacío = todas las facturas" className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Año inicial de facturación</label>
          <input type="number" min={2015} max={2035} value={salesStartYear} onChange={e => setSalesStartYear(e.target.value)} disabled={!canEdit} placeholder="Ej: 2025" className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Recaudo desde</label>
          <input type="date" value={collectionsStartDate} onChange={e => setCollectionsStartDate(e.target.value)} disabled={!canEdit} className={inputCls} />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} disabled={!canEdit} className="rounded" />
        Conexión activa (se sincroniza automáticamente cada día)
      </label>

      {canEdit && (
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => saveMut.mutate()} loading={saveMut.isPending} disabled={!username.trim() || dirtyKeyMissing}>
            {isNew ? 'Conectar Siigo' : 'Guardar cambios'}
          </Button>
          {conn && (
            <Button variant="secondary" onClick={() => testMut.mutate()} loading={testMut.isPending}>
              Probar conexión
            </Button>
          )}
        </div>
      )}
      {conn && (
        <p className="text-xs text-slate-500">
          Para traer los datos por primera vez, ve a Consultas Siigo, elige «Libros de: {conn.label}» y sincroniza cada pestaña.
          Después se actualizan solos cada madrugada.
        </p>
      )}
    </div>
  )
}
