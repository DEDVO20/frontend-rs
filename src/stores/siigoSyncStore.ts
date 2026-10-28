import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type SiigoSyncKind = 'sales' | 'collections' | 'trialBalance'

interface SiigoSyncState {
  /** Momento (ISO) en que se lanzó cada sincronización que se está vigilando */
  watching: Partial<Record<SiigoSyncKind, string>>
  start: (kind: SiigoSyncKind) => void
  finish: (kind: SiigoSyncKind) => void
}

/**
 * Sincronizaciones con Siigo lanzadas manualmente que corren en segundo plano.
 * Persiste en localStorage para seguir avisando aunque se recargue la página.
 */
export const useSiigoSyncStore = create<SiigoSyncState>()(
  persist(
    (set) => ({
      watching: {},
      start:  (kind) => set(s => ({ watching: { ...s.watching, [kind]: new Date().toISOString() } })),
      finish: (kind) => set(s => {
        const { [kind]: _done, ...rest } = s.watching
        return { watching: rest }
      }),
    }),
    { name: 'finto-siigo-sync' },
  ),
)
