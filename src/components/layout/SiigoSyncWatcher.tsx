import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { useSiigoSyncStore, type SiigoSyncKind, type WatchedSync } from '@/stores/siigoSyncStore'

const POLL_MS = 10_000

const SOURCES: Record<SiigoSyncKind, { url: string; queryKeys: string[][] }> = {
  sales:        { url: '/api/siigo/sync-logs',               queryKeys: [['siigo-sales'], ['siigo-report']] },
  collections:  { url: '/api/siigo/collections/sync-logs',   queryKeys: [['siigo-collections'], ['siigo-collections-report']] },
  trialBalance: { url: '/api/siigo/trial-balance/sync-logs', queryKeys: [['siigo-trial-balance'], ['siigo-trial-balance-report']] },
}

function successMessage(w: WatchedSync, log: any): string {
  if (w.kind === 'sales') {
    return `Facturación de ${w.label} sincronizada: ${log.invoices_count} facturas y ${log.credit_notes_count} notas crédito (${log.lines_count} líneas) en ${log.duration_sec}s`
  }
  if (w.kind === 'trialBalance') {
    return `Balance de prueba de ${w.label}: ${log.months_ok} mes(es) correctos` +
      (log.months_failed ? `, ${log.months_failed} con error (se conservaron sus datos anteriores)` : '') +
      ` · ${log.rows_count} filas en ${log.duration_sec}s`
  }
  return `Recaudo de ${w.label} sincronizado: ${log.vouchers_count} recibos y ${log.lines_count} movimientos en ${log.duration_sec}s`
}

/**
 * Vigila en segundo plano las sincronizaciones con Siigo lanzadas desde la app (por cuenta)
 * y avisa al terminar, sin importar en qué pantalla esté el usuario. No renderiza nada.
 */
export function SiigoSyncWatcher() {
  const qc = useQueryClient()
  const watching = useSiigoSyncStore(s => s.watching)
  const finish = useSiigoSyncStore(s => s.finish)
  const keys = Object.keys(watching)

  useEffect(() => {
    if (!keys.length) return

    let cancelled = false
    const check = async () => {
      for (const key of keys) {
        const w = watching[key]
        if (!w) continue
        try {
          const { data } = await api.get(SOURCES[w.kind].url, { params: { connectionId: w.connectionId } })
          if (cancelled || data?.isSyncRunning) continue

          const startedAt = new Date(w.startedAt).getTime()
          // El log de esta ejecución empieza justo después de lanzarla (margen por desfase de reloj)
          const log = (data?.logs ?? []).find((l: any) => new Date(l.started_at).getTime() >= startedAt - 60_000)

          if (log?.status === 'completed') toast.success(successMessage(w, log), { duration: 10_000 })
          else if (log?.status === 'failed') {
            toast.error(`La sincronización de ${w.label} con Siigo falló: ${log.error_message ?? 'error desconocido'}`, { duration: 15_000 })
          }

          finish(key)
          for (const qk of SOURCES[w.kind].queryKeys) qc.invalidateQueries({ queryKey: qk })
        } catch (err: any) {
          // La conexión ya no existe: dejar de vigilarla. Otros errores son transitorios.
          if (err?.response?.status === 404) finish(key)
        }
      }
    }

    void check()
    const id = setInterval(check, POLL_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [keys.join(','), watching, finish, qc])

  return null
}
