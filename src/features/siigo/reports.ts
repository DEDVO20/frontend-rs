import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { queryKeys } from '@/lib/queryKeys'
import type { SiigoBooksInfo } from '@/pages/siigo/siigoBooks'

export interface MonthlyRow {
  period: string
  facturas: number
  notasCredito: number
  bruto: number
  subtotal: number
  total: number
  totalFacturado: number
  totalNotasCredito: number
}

export interface ProductRow {
  code: string
  description: string
  bruto: number
  subtotal?: number
  total: number
}

export interface CustomerRow {
  nit: string
  name: string
  companyId: string | null
  facturas: number
  notasCredito: number
  subtotal: number
  total: number
}

export interface SiigoReport {
  books: SiigoBooksInfo | null
  notConnected: boolean
  clientCompany: { id: string; name: string; nit: string | null } | null
  lastSync: { started_at: string; end_date: string } | null
  summary: {
    totalFacturas: number
    totalNotasCredito: number
    totalBruto: number
    totalSubtotal: number
    totalNeto: number
  }
  monthly: MonthlyRow[]
  byProduct: ProductRow[]
  byCustomer: CustomerRow[]
}

export interface CollectionsReport {
  summary: { totalRecaudado: number; recibos: number; movimientos: number; facturas: number; anticipos: number; clientes: number }
  monthly: { period: string; recaudado: number; recibos: number; movimientos: number }[]
  byProduct: { description: string; recaudado: number; movimientos: number }[]
  byCustomer: { nit: string; name: string; companyId: string | null; recibos: number; recaudado: number }[]
  lastSync: { started_at: string; end_date: string; status: string } | null
}

export interface BalanceMonthly {
  period: string
  ingresos: number
  gastos: number
  costos: number
  activo: number
  pasivo: number
  patrimonio: number
  cartera: number
  anticipos: number
  debito: number
  credito: number
}

export interface BalanceReport {
  scope: 'global' | 'company'
  latestPeriod: string | null
  monthly: BalanceMonthly[]
  byAccount: { code: string; name: string; debit: number; credit: number; finalBalance: number }[]
  topCartera: { nit: string; name: string; companyId: string | null; saldo: number }[]
  /** Flujo de caja reportado (cuentas de disponible, clase 11) por mes */
  cash?: { period: string; entradas: number; salidas: number; posicion: number }[]
  /** Estado de importación de cada mes del periodo */
  periods?: { period: string; status: 'OK' | 'ERROR' }[]
  lastSync: { started_at: string; status: string } | null
}

export interface ReceivablesReport {
  scope: 'global' | 'company'
  books: SiigoBooksInfo | null
  isSyncRunning: boolean
  lastSync: { started_at: string; status: string; cut_date: string; error_message: string | null } | null
  lastSuccess: { started_at: string; cut_date: string } | null
  cutDate: string | null
  summary: {
    total: number
    vencido: number
    porVencer: number
    facturas: number
    clientes: number
    diasPromedioMora: number
    reduccionControl: number
  } | null
  byBucket: { bucket: string; total: number; facturas: number }[]
  byCustomer: { nit: string; name: string; companyId: string | null; total: number; vencido: number; facturas: number; maxDias: number }[]
  bySeller: { seller: string; total: number; vencido: number; facturas: number }[]
  oldest: { invoice: string; customer: string; dueDate: string; dias: number; balance: number }[]
  history: { cutDate: string; total: number; vencido: number }[]
}

export interface CrmReport {
  connection: { id: string; label: string; has_token: boolean } | null
  notConnected: boolean
  isSyncRunning: boolean
  lastSync: { started_at: string; status: string; deals_count: number; error_message?: string | null } | null
  summary: { deals: number; amount: number; enviadas: number; ganadas: number; valorGanado: number } | null
  byStage: { stage: string; order: number; kind: string; owner: string; amount: number; deals: number }[]
  monthly: { period: string; enviadas: number; ganadas: number }[]
}

/** Informe de facturación: Facturación, Recaudo y Comercial comparten la misma consulta (caché de React Query) */
export function useSalesReport(params: Record<string, string>, keepPrevious = false) {
  return useQuery<SiigoReport>({
    queryKey: [...queryKeys.siigoSalesReport, params],
    queryFn: async () => (await api.get<SiigoReport>('/api/siigo/report', { params })).data,
    staleTime: 30_000,
    // Al cambiar el mes seleccionado se mantienen las cifras anteriores mientras llega la consulta
    placeholderData: keepPrevious ? keepPreviousData : undefined,
  })
}

/** Series del balance de prueba: Balance y Cartera comparten la misma consulta */
export function useBalanceReport(params: Record<string, string>, keepPrevious = false) {
  return useQuery<BalanceReport>({
    queryKey: [...queryKeys.siigoTrialBalanceReport, params],
    queryFn: async () => (await api.get<BalanceReport>('/api/siigo/trial-balance/report', { params })).data,
    staleTime: 30_000,
    placeholderData: keepPrevious ? keepPreviousData : undefined,
  })
}

export function useCollectionsReport(params: Record<string, string>, keepPrevious = false) {
  return useQuery<CollectionsReport>({
    queryKey: [...queryKeys.siigoCollectionsReport, params],
    queryFn: async () => (await api.get<CollectionsReport>('/api/siigo/collections/report', { params })).data,
    staleTime: 30_000,
    placeholderData: keepPrevious ? keepPreviousData : undefined,
  })
}

export function crmParamsOf(params: Record<string, string>) {
  const out: Record<string, string> = {}
  for (const k of ['connectionId', 'startDate', 'endDate']) if (params[k]) out[k] = params[k]!
  return out
}

/** Informe de CRM (HubSpot): lo comparten las gráficas de CRM y el dashboard de negocios */
export function useCrmReport(params: Record<string, string>) {
  const crmParams = crmParamsOf(params)
  return useQuery<CrmReport>({
    queryKey: [...queryKeys.hubspotReport, crmParams],
    queryFn: async () => (await api.get<CrmReport>('/api/hubspot/report', { params: crmParams })).data,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
    refetchInterval: q => (q.state.data?.isSyncRunning ? 10_000 : false),
  })
}

/** Informe de cartera sin filtros por clic (misma consulta, en caché, que la pestaña Cartera) */
export function useReceivablesReport(params: Record<string, string>) {
  return useQuery<ReceivablesReport>({
    queryKey: [...queryKeys.siigoReceivablesReport, params],
    queryFn: async () => (await api.get<ReceivablesReport>('/api/siigo/receivables/report', { params })).data,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  })
}
