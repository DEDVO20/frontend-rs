export const queryKeys = {
  siigoCompanies: ['companies-siigo-selector'],
  siigoConnection: ['siigo-connection'],
  siigoConnections: ['siigo-connections'],
  siigoSales: ['siigo-sales'],
  siigoSalesReport: ['siigo-report'],
  siigoCollections: ['siigo-collections'],
  siigoCollectionsReport: ['siigo-collections-report'],
  siigoTrialBalance: ['siigo-trial-balance'],
  siigoTrialBalanceReport: ['siigo-trial-balance-report'],
  siigoTrialBalanceTree: ['siigo-tb-tree'],
  siigoReceivables: ['siigo-receivables'],
  siigoReceivablesReport: ['siigo-receivables-report'],
  hubspotConnection: ['hubspot-connection'],
  hubspotDeals: ['hubspot-deals'],
  hubspotReport: ['hubspot-report'],
} as const

export const syncQueryKeys = {
  sales: [queryKeys.siigoSales, queryKeys.siigoSalesReport],
  collections: [queryKeys.siigoCollections, queryKeys.siigoCollectionsReport],
  trialBalance: [queryKeys.siigoTrialBalance, queryKeys.siigoTrialBalanceReport, queryKeys.siigoTrialBalanceTree],
  receivables: [queryKeys.siigoReceivables, queryKeys.siigoReceivablesReport],
  hubspot: [queryKeys.hubspotDeals, queryKeys.hubspotReport],
} as const
