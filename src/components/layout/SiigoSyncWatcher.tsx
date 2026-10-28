import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { useSiigoSyncStore, type SiigoSyncKind } from '@/stores/siigoSyncStore'

const POLL_MS = 10_000

const SOURCES: Record<SiigoSyncKind, { url: string; queryKeys: string[][] }> = {
  sales:       { url: '/api/siigo/sync-logs',             queryKeys: [['siigo-sales'], ['siigo-report']] },
  collections: { url: '/api/siigo/collections/sync-logs', queryKeys: [['siigo-collections'], ['siigo-collections-report']] },
  trialBalance: { url: '/api/siigo/trial-balance/sync-logs', queryKeys: [['siigo-trial-balance']] },
}

function successMessage(kind: SiigoSyncKind, log: any): string {
  if (kind === 'sales') {
    return `Facturación Siigo sincronizada: ${log.invoices_count} facturas y ${log.credit_notes_count} notas crédito (${log.lines_count} líneas) en ${log.duration_sec}s`
  }
  if (kind === 'trialBalance') {
    return `Balance de prueba importado: ${log.months_ok} mes(es) correctos` +
      (log.months_failed ? `, ${log.months_failed} con error (se conservaron sus datos anteriores)` : '') +
      ` · ${log.rows_count} filas en ${log.duration_sec}s`
  }
  return `Recaudo Siigo sincronizado: ${log.vouchers_count} recibos y ${log.lines_count} movimientos en ${log.duration_sec}s`
}

/**
 * Vigila en segundo plano las sincronizaciones con Siigo lanzadas desde la app y avisa
 * al terminar, sin importar en qué pantalla esté el usuario. No renderiza nada.
 */
export function SiigoSyncWatcher() {
  const qc = useQueryClient()
  const watching = useSiigoSyncStore(s => s.watching)
  const finish = useSiigoSyncStore(s => s.finish)
  const kinds = (Object.keys(watching) as SiigoSyncKind[]).filter(k => watching[k])

  useEffect(() => {
    if (!kinds.length) return

    let cancelled = false
    const check = async () => {
      for (const kind of kinds) {
        try {
          const { data } = await api.get(SOURCES[kind].url)
          if (cancelled || data?.isSyncRunning) continue

          const startedAt = new Date(watching[kind]!).getTime()
          // El log de esta ejecución empieza justo después de lanzarla (margen por desfase de reloj)
          const log = (data?.logs ?? []).find((l: any) => new Date(l.started_at).getTime() >= startedAt - 60_000)

          if (log?.status === 'completed') toast.success(successMessage(kind, log), { duration: 10_000 })
          else if (log?.status === 'failed') toast.error(`La sincronización con Siigo falló: ${log.error_message ?? 'error desconocido'}`, { duration: 15_000 })

          finish(kind)
          for (const key of SOURCES[kind].queryKeys) qc.invalidateQueries({ queryKey: key })
        } catch {
          // Error transitorio de red: se reintenta en la siguiente vuelta
        }
      }
    }

    void check()
    const id = setInterval(check, POLL_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [kinds.join(','), watching, finish, qc])

  return null
}
