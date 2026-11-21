/**
 * Gráficas de Siigo y CRM: bloques por tema, filtro de periodo y estilo compartido.
 * Las usan la página interna «Gráficas Siigo» y el dashboard del cliente.
 */
export { BalanceCharts } from './BalanceCharts'
export { CarteraCharts } from './CarteraCharts'
export { ComercialCharts } from './ComercialCharts'
export { CrmCharts } from './CrmCharts'
export { FacturacionCharts } from './FacturacionCharts'
export { RecaudoCharts } from './RecaudoCharts'
export { PeriodFilterBar } from './PeriodFilterBar'
export { usePeriodFilter, type PeriodFilter } from './period'
export { ChartTooltip, type ChartProps } from './shared'
export { useChartStyle, type ChartStyle } from './style'
