import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { BookOpen, PlugZap } from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'

export const SIIGO_INTERNAL_ROLES = ['admin', 'rs_admin', 'rs_staff', 'contador']

/** Conexión de Siigo (cuenta / "dueño de los libros") tal como la entrega el backend, sin secretos */
export interface SiigoConnection {
  id: string
  company_id: string | null
  company_name?: string | null
  is_platform: boolean
  label: string
  username: string
  partner_id: string
  seller_filter: string
  sales_start_year: number | null
  collections_start_date: string | null
  active: boolean
  has_access_key: boolean
  uses_env_credentials: boolean
  last_test_at: string | null
  last_test_ok: boolean | null
  last_test_message: string | null
}

/** Libros consultados, como los devuelve cada consulta */
export interface SiigoBooksInfo {
  connectionId: string
  label: string
  companyId: string | null
  isPlatform: boolean
}

export function useSiigoConnections(enabled = true) {
  return useQuery<SiigoConnection[]>({
    queryKey: ['siigo-connections'],
    queryFn: async () => (await api.get('/api/siigo/connections')).data,
    enabled,
    staleTime: 60_000,
  })
}

/**
 * Libros que se están consultando.
 * - Internos: la cuenta elegida en `?libros=` (por defecto, Finto). Se envía como `connectionId`.
 * - Clientes: siempre los de su empresa; el backend lo resuelve solo (no se envía nada).
 */
export function useSiigoBooks() {
  const role = useAuthStore(s => s.user?.role ?? '')
  const isInternal = SIIGO_INTERNAL_ROLES.includes(role)
  const [searchParams, setSearchParams] = useSearchParams()
  const { data: connections = [] } = useSiigoConnections(isInternal)

  const requested = isInternal ? searchParams.get('libros') : null
  const selected = connections.find(c => c.id === requested) ?? connections.find(c => c.is_platform) ?? null

  const setConnectionId = (id: string) => {
    const next = new URLSearchParams(searchParams)
    const platform = connections.find(c => c.is_platform)
    if (!id || id === platform?.id) next.delete('libros')
    else next.set('libros', id)
    setSearchParams(next, { replace: true })
  }

  return {
    isInternal,
    connections,
    selected,
    connectionId: selected?.id ?? null,
    setConnectionId,
    /** Parámetro para las consultas al backend (vacío = Finto para internos, su empresa para clientes) */
    booksParam: (isInternal && requested && selected ? { connectionId: selected.id } : {}) as Record<string, string>,
  }
}

/** Selector "Libros de:" para roles internos */
export function SiigoBooksSelect({ className }: { className?: string }) {
  const { isInternal, connections, selected, setConnectionId } = useSiigoBooks()
  if (!isInternal) return null

  return (
    <label className={cn('flex items-center gap-2 text-xs font-semibold text-slate-500', className)}>
      <BookOpen className="w-4 h-4 text-slate-400" />
      Libros de
      <select
        value={selected?.id ?? ''}
        onChange={e => setConnectionId(e.target.value)}
        className="px-3 py-1.5 text-sm font-medium text-slate-800 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
      >
        {connections.map(c => (
          <option key={c.id} value={c.id} disabled={!c.active}>
            {c.is_platform ? `${c.label} (plataforma)` : c.label}{c.active ? '' : ' · inactiva'}
          </option>
        ))}
      </select>
    </label>
  )
}

/** Aviso cuando la empresa del cliente aún no tiene su cuenta de Siigo conectada */
export function SiigoNotConnected({ dark = true }: { dark?: boolean }) {
  return (
    <div className={cn(
      'rounded-2xl p-10 text-center space-y-3 border',
      dark
        ? 'bg-cream-100 dark:bg-navy-900 border-navy-900/10 dark:border-white/10'
        : 'bg-white border-slate-200',
    )}>
      <PlugZap className="w-10 h-10 mx-auto text-navy-900/40 dark:text-cream-100/40" />
      <p className="font-semibold text-navy-900 dark:text-cream-100">Tu cuenta de Siigo aún no está conectada</p>
      <p className="text-sm text-navy-900/60 dark:text-cream-100/60 max-w-md mx-auto">
        Cuando el equipo de Finto conecte la cuenta de Siigo de tu empresa, aquí verás tu facturación,
        tu recaudo y tu balance de prueba.
      </p>
    </div>
  )
}
