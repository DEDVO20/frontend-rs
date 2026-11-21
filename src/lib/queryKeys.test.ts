import { QueryClient } from '@tanstack/react-query'
import { expect, it } from 'vitest'
import { queryKeys, syncQueryKeys } from './queryKeys'

it.each([
  ['trialBalance', queryKeys.siigoTrialBalanceTree, queryKeys.hubspotDeals],
  ['hubspot', queryKeys.hubspotDeals, queryKeys.siigoTrialBalanceTree],
] as const)('invalida las variantes de la consulta al sincronizar %s', async (kind, affected, unrelated) => {
  const client = new QueryClient()
  const variant = [...affected, { connectionId: 'empresa-a' }]
  client.setQueryData(variant, [])
  client.setQueryData(unrelated, [])

  for (const queryKey of syncQueryKeys[kind]) await client.invalidateQueries({ queryKey })

  expect(client.getQueryState(variant)?.isInvalidated).toBe(true)
  expect(client.getQueryState(unrelated)?.isInvalidated).toBe(false)
})
