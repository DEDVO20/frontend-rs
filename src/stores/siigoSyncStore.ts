import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type SiigoSyncKind = 'sales' | 'collections' | 'trialBalance'

export interface WatchedSync {
  kind: SiigoSyncKind
  /** Cuenta de Siigo (conexión) que se está sincronizando */
  connectionId: string
  label: string
  startedAt: string
}

interface SiigoSyncState {
  /** Sincronizaciones vigiladas, por `${kind}:${connectionId}` */
  watching: Record<string, WatchedSync>
  start: (kind: SiigoSyncKind, connectionId: string, label: string) => void
  finish: (key: string) => void
}

export const syncKey = (kind: SiigoSyncKind, connectionId: string) => `${kind}:${connectionId}`

/**
 * Sincronizaciones con Siigo lanzadas manualmente que corren en segundo plano.
 * Persiste en localStorage para seguir avisando aunque se recargue la página.
 */
export const useSiigoSyncStore = create<SiigoSyncState>()(
  persist(
    (set) => ({
      watching: {},
      start: (kind, connectionId, label) => set(s => ({
        watching: { ...s.watching, [syncKey(kind, connectionId)]: { kind, connectionId, label, startedAt: new Date().toISOString() } },
      })),
      finish: (key) => set(s => {
        const { [key]: _done, ...rest } = s.watching
        return { watching: rest }
      }),
    }),
    // v2: antes se vigilaba una sola cuenta por tipo
    { name: 'finto-siigo-sync-v2' },
  ),
)
