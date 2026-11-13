import { Fragment, useMemo, useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { BarChart3, X } from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { TopBar } from '@/components/layout/TopBar'
import { PortalTopBar } from '@/components/layout/PortalTopBar'
import { PageLoader } from '@/components/ui/Spinner'
import { useAuthStore } from '@/stores/authStore'
import { useThemeStore } from '@/stores/themeStore'
import { useSiigoSyncStore } from '@/stores/siigoSyncStore'
import { SiigoBooksSelect, SiigoNotConnected, useSiigoBooks, type SiigoBooksInfo } from './siigoBooks'

const INTERNAL_ROLES = ['admin', 'rs_admin', 'rs_staff', 'contador']
const MAX_SERVICES = 8

interface MonthlyRow {
  period: string
  facturas: number
  notasCredito: number
  bruto: number
  subtotal: number
  total: number
  totalFacturado: number
  totalNotasCredito: number
}

interface ProductRow {
  code: string
  description: string
  bruto: number
  subtotal?: number
  total: number
}

interface CustomerRow {
  nit: string
  name: string
  companyId: string | null
  facturas: number
  notasCredito: number
  subtotal: number
  total: number
}

interface SiigoReport {
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

type Preset = '12m' | 'year-current' | 'year-previous' | 'all' | 'custom'

/**
 * Colores de serie validados (scripts/validate_palette.js del skill dataviz):
 * azul de marca + dorado con croma suficiente, con su paso propio en claro y oscuro.
 */
const PALETTE = {
  light: { facturado: '#3d6bc1', notas: '#a87d1e', recaudo: '#a87d1e', grid: 'rgba(26,37,69,0.08)', axis: '#64748b' },
  dark:  { facturado: '#5c86d0', notas: '#b98d2a', recaudo: '#b98d2a', grid: 'rgba(255,247,228,0.08)', axis: 'rgba(255,247,228,0.6)' },
}

type Palette = (typeof PALETTE)['light']

interface CollectionsReport {
  summary: { totalRecaudado: number; recibos: number; movimientos: number; facturas: number; anticipos: number; clientes: number }
  monthly: { period: string; recaudado: number; recibos: number; movimientos: number }[]
  byProduct: { description: string; recaudado: number; movimientos: number }[]
  byCustomer: { nit: string; name: string; companyId: string | null; recibos: number; recaudado: number }[]
  lastSync: { started_at: string; end_date: string; status: string } | null
}

type ViewTab = 'facturacion' | 'recaudo' | 'cartera' | 'balance'

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

const money = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
const compact = new Intl.NumberFormat('es-CO', { notation: 'compact', maximumFractionDigits: 1 })
const fmtMoney = (n: number) => money.format(n || 0)
const fmtCompact = (n: number) => `${n < 0 ? '-' : ''}$${compact.format(Math.abs(n || 0))}`

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const fmtPeriod = (p: string) => {
  const [y, m] = p.split('-')
  return `${MONTHS[Number(m) - 1] ?? m} ${y?.slice(2)}`
}

const toYm = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

function lastDayOfMonth(ym: string) {
  const [y, m] = ym.split('-').map(Number)
  return `${ym}-${String(new Date(y!, m!, 0).getDate()).padStart(2, '0')}`
}

/** Rango de meses [desde, hasta] del filtro por periodo; null = sin límite */
function presetRange(preset: Preset, customFrom: string, customTo: string): { from: string | null; to: string | null } {
  const now = new Date()
  const year = now.getFullYear()
  switch (preset) {
    case '12m':           return { from: toYm(new Date(year, now.getMonth() - 11, 1)), to: toYm(now) }
    case 'year-current':  return { from: `${year}-01`, to: `${year}-12` }
    case 'year-previous': return { from: `${year - 1}-01`, to: `${year - 1}-12` }
    case 'custom':        return { from: customFrom || null, to: customTo || null }
    default:              return { from: null, to: null }
  }
}

/** Completa con ceros los meses sin documentos para que la serie sea continua */
function fillMonths(rows: MonthlyRow[], from: string | null, to: string | null): MonthlyRow[] {
  const byPeriod = new Map(rows.map(r => [r.period, r]))
  const start = from ?? rows[0]?.period
  const end = to ?? rows[rows.length - 1]?.period
  if (!start || !end || start > end) return rows

  const out: MonthlyRow[] = []
  let [y, m] = start.split('-').map(Number) as [number, number]
  for (let i = 0; i < 120; i++) {
    const ym = `${y}-${String(m).padStart(2, '0')}`
    if (ym > end) break
    out.push(byPeriod.get(ym) ?? {
      period: ym, facturas: 0, notasCredito: 0, bruto: 0, subtotal: 0, total: 0,
      totalFacturado: 0, totalNotasCredito: 0,
    })
    m++
    if (m > 12) { m = 1; y++ }
  }
  return out
}

/** Top de servicios por total; el resto se agrupa en "Otros" (nunca se generan colores nuevos) */
function topServices(rows: ProductRow[]) {
  const sorted = [...rows].sort((a, b) => Number(b.total) - Number(a.total))
  const top = sorted.slice(0, MAX_SERVICES).map(r => ({ name: r.description, total: Number(r.total) }))
  const rest = sorted.slice(MAX_SERVICES)
  if (rest.length) {
    top.push({ name: `Otros (${rest.length})`, total: rest.reduce((s, r) => s + Number(r.total), 0) })
  }
  return top
}

/** Estilo de las gráficas según quién mira: back-office (siempre claro) o portal del cliente (claro/oscuro) */
export interface ChartStyle {
  colors: Palette
  isDark: boolean
  isInternal: boolean
  cardCls: string
  titleCls: string
  mutedCls: string
}

export function useChartStyle(): ChartStyle {
  const role = useAuthStore(s => s.user?.role ?? '')
  const theme = useThemeStore(s => s.theme)
  const isInternal = INTERNAL_ROLES.includes(role)
  // La app interna siempre es clara (AppLayout fuerza data-theme="light")
  const isDark = !isInternal && theme === 'dark'
  return {
    colors: isDark ? PALETTE.dark : PALETTE.light,
    isDark,
    isInternal,
    cardCls: isInternal
      ? 'bg-white border border-slate-200 rounded-2xl p-5'
      : 'rounded-2xl bg-cream-100 dark:bg-navy-900 ring-1 ring-navy-900/5 dark:ring-white/5 p-5',
    titleCls: isInternal ? 'text-slate-900' : 'text-navy-900 dark:text-cream-100 font-display',
    mutedCls: isInternal ? 'text-slate-500' : 'text-navy-900/55 dark:text-cream-100/55',
  }
}

/**
 * Filtro por periodo (compartido por la página de gráficas y el dashboard del cliente).
 * `month` es el mes seleccionado con un clic en una gráfica o tabla mensual: acota las cifras
 * y los desgloses a ese mes, mientras las series mes a mes siguen mostrando todo el periodo.
 */
export function usePeriodFilter() {
  const [preset, setPresetRaw] = useState<Preset>('12m')
  const [customFrom, setCustomFromRaw] = useState('')
  const [customTo, setCustomToRaw] = useState('')
  const [month, setMonth] = useState<string | null>(null)
  // Cambiar el periodo quita el mes seleccionado (podría quedar fuera del rango)
  const setPreset = (p: Preset) => { setPresetRaw(p); setMonth(null) }
  const setCustomFrom = (v: string) => { setCustomFromRaw(v); setMonth(null) }
  const setCustomTo = (v: string) => { setCustomToRaw(v); setMonth(null) }
  const range = presetRange(preset, customFrom, customTo)
  const dateParams: Record<string, string> = {
    ...(range.from ? { startDate: `${range.from}-01` } : {}),
    ...(range.to ? { endDate: lastDayOfMonth(range.to) } : {}),
  }
  return { preset, setPreset, customFrom, setCustomFrom, customTo, setCustomTo, month, setMonth, range, dateParams }
}

export type PeriodFilter = ReturnType<typeof usePeriodFilter>

/** Barra de filtros en una sola fila sobre las gráficas; `children` va a la derecha */
export function PeriodFilterBar({ filter, style, children }: { filter: PeriodFilter; style: ChartStyle; children?: React.ReactNode }) {
  const { isInternal, cardCls, mutedCls } = style
  const year = new Date().getFullYear()
  const chipCls = (active: boolean) => cn(
    'px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors',
    active
      ? 'bg-primary-600 text-white border-primary-600'
      : isInternal
        ? 'border-slate-200 text-slate-600 hover:bg-slate-50'
        : 'border-navy-900/10 text-navy-900/70 hover:bg-navy-900/5 dark:border-white/10 dark:text-cream-100/80 dark:hover:bg-white/5',
  )
  const inputCls = chartInputCls(isInternal)

  return (
    <div className={cn(cardCls, 'flex flex-wrap items-center gap-2 py-3')}>
      <span className={cn('text-xs font-bold uppercase tracking-wider mr-1', mutedCls)}>Periodo</span>
      <button className={chipCls(filter.preset === '12m')} onClick={() => filter.setPreset('12m')}>Últimos 12 meses</button>
      <button className={chipCls(filter.preset === 'year-current')} onClick={() => filter.setPreset('year-current')}>Año {year}</button>
      <button className={chipCls(filter.preset === 'year-previous')} onClick={() => filter.setPreset('year-previous')}>Año {year - 1}</button>
      <button className={chipCls(filter.preset === 'all')} onClick={() => filter.setPreset('all')}>Todo</button>
      <button className={chipCls(filter.preset === 'custom')} onClick={() => filter.setPreset('custom')}>Personalizado</button>
      {filter.preset === 'custom' && (
        <div className="flex items-center gap-1.5">
          <input
            type="month"
            aria-label="Mes desde"
            value={filter.customFrom}
            max={filter.customTo || undefined}
            onChange={e => filter.setCustomFrom(e.target.value)}
            className={inputCls}
          />
          <span className={cn('text-xs', mutedCls)}>a</span>
          <input
            type="month"
            aria-label="Mes hasta"
            value={filter.customTo}
            min={filter.customFrom || undefined}
            onChange={e => filter.setCustomTo(e.target.value)}
            className={inputCls}
          />
        </div>
      )}
      {filter.month && (
        <button
          onClick={() => filter.setMonth(null)}
          title="Quitar el mes seleccionado"
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-primary-50 text-primary-700 ring-1 ring-primary-600/20 hover:bg-primary-100"
        >
          Mes: {fmtPeriod(filter.month)} <X className="w-3 h-3" />
        </button>
      )}
      {children}
    </div>
  )
}

/** Parámetros de fecha acotados a un mes (YYYY-MM); sin mes devuelve los mismos */
function monthParams(params: Record<string, string>, month: string | null): Record<string, string> {
  return month ? { ...params, startDate: `${month}-01`, endDate: lastDayOfMonth(month) } : params
}

/** Opacidad de una barra mensual: las que no son el mes seleccionado quedan atenuadas */
const dimOpacity = (period: string, month: string | null) => (month && period !== month ? 0.3 : 1)

/** Clic en una gráfica: entrega la fila de la barra/columna bajo el cursor */
function rowClick<T>(rows: T[], onPick?: (row: T) => void) {
  if (!onPick) return undefined
  return (state: { activeTooltipIndex?: unknown }) => {
    const i = state?.activeTooltipIndex
    if (i == null || i === '') return
    const row = rows[Number(i)]
    if (row) onPick(row)
  }
}

/** Clic en una gráfica mensual: selecciona el mes de la columna (o lo quita si ya estaba) */
function monthClick(rows: { period: string }[], month: string | null, onMonth?: (m: string | null) => void) {
  return rowClick(rows, onMonth && (r => onMonth(r.period === month ? null : r.period)))
}

/** Opacidad de una barra de categoría: atenuada si hay otra seleccionada */
const dimKey = (key: string, selected: string | null | undefined) => (selected && key !== selected ? 0.3 : 1)

/** Filtros activos de una pestaña, cada uno con su botón para quitarlo */
function FilterChips({ filters, onClearAll, mutedCls }: {
  filters: { label: string; onClear: () => void }[]
  onClearAll: () => void
  mutedCls: string
}) {
  if (!filters.length) return null
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className={cn('text-xs font-bold uppercase tracking-wider', mutedCls)}>Filtros</span>
      {filters.map(f => (
        <button
          key={f.label}
          onClick={f.onClear}
          title="Quitar filtro"
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-primary-50 text-primary-700 ring-1 ring-primary-600/20 hover:bg-primary-100"
        >
          {f.label} <X className="w-3 h-3" />
        </button>
      ))}
      {filters.length > 1 && (
        <button onClick={onClearAll} className={cn('text-xs underline', mutedCls)}>Quitar todos</button>
      )}
    </div>
  )
}

/** Filas seleccionables de una tabla mensual */
function monthSelect(rows: { period: string }[], month: string | null, onMonth?: (m: string | null) => void): TableSelect | undefined {
  if (!onMonth) return undefined
  return { keys: rows.map(r => r.period), selected: month, onSelect: k => onMonth(k === month ? null : k) }
}

function chartInputCls(isInternal: boolean) {
  return cn(
    'px-2.5 py-1.5 text-xs rounded-xl border focus:outline-none focus:ring-2 focus:ring-primary-500',
    isInternal
      ? 'border-slate-200 bg-white text-slate-700'
      : 'border-navy-900/10 bg-white text-navy-900 dark:border-white/10 dark:bg-navy-800 dark:text-cream-100',
  )
}

/** Informe de facturación: Facturación, Recaudo y Comercial comparten la misma consulta (caché de React Query) */
export function useSalesReport(params: Record<string, string>, keepPrevious = false) {
  return useQuery<SiigoReport>({
    queryKey: ['siigo-report', params],
    queryFn: async () => (await api.get('/api/siigo/report', { params })).data,
    staleTime: 30_000,
    // Al cambiar el mes seleccionado se mantienen las cifras anteriores mientras llega la consulta
    placeholderData: keepPrevious ? keepPreviousData : undefined,
  })
}

/** Series del balance de prueba: Balance y Cartera comparten la misma consulta */
export function useBalanceReport(params: Record<string, string>, keepPrevious = false) {
  return useQuery<BalanceReport>({
    queryKey: ['siigo-trial-balance-report', params],
    queryFn: async () => (await api.get('/api/siigo/trial-balance/report', { params })).data,
    staleTime: 30_000,
    placeholderData: keepPrevious ? keepPreviousData : undefined,
  })
}

export function useCollectionsReport(params: Record<string, string>, keepPrevious = false) {
  return useQuery<CollectionsReport>({
    queryKey: ['siigo-collections-report', params],
    queryFn: async () => (await api.get('/api/siigo/collections/report', { params })).data,
    staleTime: 30_000,
    placeholderData: keepPrevious ? keepPreviousData : undefined,
  })
}

function toSalesMonthly(rows: MonthlyRow[], range: { from: string | null; to: string | null }) {
  return fillMonths(rows, range.from, range.to).map(m => ({
    ...m,
    label: fmtPeriod(m.period),
    bruto: Number(m.bruto),
    subtotal: Number(m.subtotal ?? 0),
    total: Number(m.total),
    totalFacturado: Number(m.totalFacturado),
    totalNotasCredito: Number(m.totalNotasCredito),
  }))
}

/** Servicios con su subtotal (antes de impuestos) como valor a graficar */
const bySubtotal = (rows: ProductRow[]) => rows.map(p => ({ ...p, total: Number(p.subtotal ?? p.total) }))

/** Props comunes de cada bloque de gráficas */
export interface ChartProps {
  params: Record<string, string>
  range: { from: string | null; to: string | null }
  style: ChartStyle
  /** Nombre de quien se grafica (empresa o libros) para los subtítulos */
  scopeName: string
  /** Mes seleccionado (YYYY-MM) que acota cifras y desgloses; null = todo el periodo */
  month?: string | null
  /** Sin este callback las gráficas no permiten seleccionar mes */
  onMonth?: (month: string | null) => void
  /** Solo internos: clic en un tercero con empresa vinculada para ver solo esa empresa */
  onCompany?: (companyId: string) => void
  /** Vista reducida del dashboard del cliente: solo las gráficas principales, sin cifras ni tablas extra */
  /** Con compact: qué gráficas mostrar (cartera: edades, vendedor, evolucion, clientes); sin definir = todas */
  only?: string[]
  compact?: boolean
}

/** Sufijo de etiquetas cuando hay mes seleccionado */
const monthNote = (month: string | null | undefined) => (month ? ` · ${fmtPeriod(month)}` : '')

export function SiigoChartsPage() {
  const style = useChartStyle()
  const { isInternal } = style

  const [tab, setTab] = useState<ViewTab>('facturacion')
  const [companyId, setCompanyId] = useState('')
  const period = usePeriodFilter()

  // Libros: los internos eligen la cuenta de Siigo; los clientes ven siempre la de su empresa
  const { booksParam, selected: selectedBooks } = useSiigoBooks()

  const params = {
    ...booksParam,
    ...period.dateParams,
    ...(isInternal && companyId ? { companyId } : {}),
  }

  const { data: companiesRes } = useQuery({
    queryKey: ['companies-siigo-selector'],
    queryFn: async () => (await api.get('/api/companies?limit=100')).data,
    enabled: isInternal,
    staleTime: 120_000,
  })
  const companies: any[] = Array.isArray(companiesRes) ? companiesRes : (companiesRes?.data ?? [])

  const { data } = useSalesReport(params)

  const booksLabel = data?.books?.label ?? selectedBooks?.label ?? 'Finto'
  const scopeName = isInternal
    ? (data?.clientCompany ? `${booksLabel} · cliente ${data.clientCompany.name}` : booksLabel)
    : (data?.clientCompany?.name ?? 'Mi empresa')
  const chartProps: ChartProps = {
    params, range: period.range, style, scopeName, month: period.month, onMonth: period.setMonth,
    onCompany: isInternal ? setCompanyId : undefined,
  }

  return (
    // Vista interna siempre clara (el contador navega dentro del layout del portal, que puede estar en oscuro)
    <div
      className="flex flex-col h-full overflow-hidden"
      {...(isInternal ? { 'data-theme': 'light', style: { colorScheme: 'light' } } : {})}
    >
      {isInternal ? (
        <TopBar title="Gráficas de facturación" subtitle="Facturación, recaudo, cartera y balance de prueba (Siigo)" />
      ) : (
        <PortalTopBar
          title="Gráficas de facturación"
          subtitle="La facturación, el recaudo y el balance de tu empresa en el tiempo"
          companyName={data?.clientCompany?.name ?? 'Mi Empresa'}
        />
      )}

      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5">
        <PeriodFilterBar filter={period} style={style}>
          {isInternal && (
            <div className="ml-auto flex flex-wrap items-center gap-3">
              <SiigoBooksSelect />
              <select
                value={companyId}
                onChange={e => setCompanyId(e.target.value)}
                aria-label="Cliente dentro de los libros"
                className={cn(chartInputCls(true), 'min-w-[200px]')}
              >
                <option value="">Todos los clientes</option>
                {companies.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}
        </PeriodFilterBar>

        {data?.notConnected ? <SiigoNotConnected /> : (<>
          {/* Pestañas */}
          <div className={cn('flex items-center gap-2 border-b pb-1', isInternal ? 'border-slate-200' : 'border-navy-900/10 dark:border-white/10')}>
            {([
              { id: 'facturacion', label: 'Facturación' },
              { id: 'recaudo', label: 'Recaudo' },
              { id: 'cartera', label: 'Cartera' },
              { id: 'balance', label: 'Balance' },
            ] as const).map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  'px-4 py-2 rounded-xl text-sm font-semibold transition-colors',
                  tab === t.id
                    ? 'bg-primary-600 text-white shadow-sm'
                    : isInternal
                      ? 'text-slate-600 hover:bg-slate-100'
                      : 'text-navy-900/70 hover:bg-navy-900/5 dark:text-cream-100/70 dark:hover:bg-white/5',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'balance' ? <BalanceCharts {...chartProps} />
            : tab === 'cartera' ? <CarteraCharts {...chartProps} />
            : tab === 'recaudo' ? <RecaudoCharts {...chartProps} />
              : (
                <>
                  <FacturacionCharts {...chartProps} />
                  {/* CRM (HubSpot) debajo de la facturación */}
                  <h2 className={cn('text-lg font-bold pt-2', style.titleCls)}>CRM</h2>
                  <CrmCharts {...chartProps} />
                </>
              )}
        </>)}
      </div>
    </div>
  )
}

/** Facturación: facturas y notas crédito por mes, por servicio y valor bruto mes a mes */
export function FacturacionCharts({ params, range, style, scopeName, month = null, onMonth, compact = false }: ChartProps) {
  const { colors, isDark, isInternal, cardCls, titleCls, mutedCls } = style
  const { data, isLoading } = useSalesReport(params)
  // Cifras y desglose por servicio del mes seleccionado (sin mes es la misma consulta)
  const { data: focus } = useSalesReport(monthParams(params, month), true)

  const monthly = useMemo(() => toSalesMonthly(data?.monthly ?? [], range), [data?.monthly, range.from, range.to])
  const services = useMemo(() => topServices(bySubtotal(focus?.byProduct ?? [])), [focus?.byProduct])
  const summary = focus?.summary
  const axisProps = { tick: { fill: colors.axis, fontSize: 11 }, tickLine: false, axisLine: false }
  const onChartClick = monthClick(monthly, month, onMonth)
  const select = monthSelect(monthly, month, onMonth)
  const clickable = onChartClick ? { cursor: 'pointer' } : undefined
  const selectedLabel = month ? fmtPeriod(month) : undefined
  const mn = monthNote(month)

  if (isLoading) return <PageLoader />
  if (!(data?.monthly?.length)) {
    return (
      <div className={cn(cardCls, 'py-16 text-center space-y-2')}>
        <BarChart3 className={cn('w-10 h-10 mx-auto', mutedCls)} />
        <p className={cn('font-semibold', titleCls)}>No hay facturación en el periodo seleccionado</p>
        <p className={cn('text-xs', mutedCls)}>Prueba con otro periodo o con «Todo».</p>
      </div>
    )
  }

  // 2. Facturación por servicio
  const porServicio = (
        <section className={cardCls}>
          <ChartHeader
            title={`Facturación por servicio${mn}`}
            subtitle={`Subtotal por servicio ${month ? 'en el mes' : 'en el periodo'}${services.length > MAX_SERVICES ? ` · top ${MAX_SERVICES}` : ''}`}
            titleCls={titleCls}
            mutedCls={mutedCls}
          />
          <div style={{ height: Math.max(180, services.length * 40) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={services} layout="vertical" margin={{ top: 0, right: 72, left: 0, bottom: 0 }}>
                <CartesianGrid horizontal={false} stroke={colors.grid} />
                <XAxis type="number" {...axisProps} tickFormatter={fmtCompact} />
                <YAxis
                  type="category"
                  dataKey="name"
                  {...axisProps}
                  width={170}
                  tick={(props: any) => <ServiceTick {...props} fill={colors.axis} />}
                />
                <Tooltip
                  cursor={{ fill: colors.grid }}
                  content={<ChartTooltip isDark={isDark} isInternal={isInternal} labelKey="name" rows={[
                    { key: 'total', label: 'Subtotal', color: colors.facturado },
                  ]} />}
                />
                <Bar dataKey="total" fill={colors.facturado} maxBarSize={24} radius={[0, 4, 4, 0]}>
                  <LabelList dataKey="total" position="right" formatter={(v: any) => fmtCompact(Number(v))} style={{ fill: colors.axis, fontSize: 11 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <DataTable
            mutedCls={mutedCls}
            isInternal={isInternal}
            headers={['Servicio', 'Valor bruto', 'Subtotal']}
            rows={(focus?.byProduct ?? []).map(p => [p.description, fmtMoney(Number(p.bruto)), fmtMoney(Number(p.subtotal ?? p.total))])}
          />
        </section>
  )

  if (compact) return porServicio

  return (
    <>
      {/* Cifras del periodo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label={`Valor bruto facturado${mn}`} value={fmtCompact(summary?.totalBruto ?? 0)} title={fmtMoney(summary?.totalBruto ?? 0)} cardCls={cardCls} titleCls={titleCls} mutedCls={mutedCls} />
        <StatTile label={`Subtotal facturado${mn}`} value={fmtCompact(summary?.totalSubtotal ?? 0)} title={fmtMoney(summary?.totalSubtotal ?? 0)} cardCls={cardCls} titleCls={titleCls} mutedCls={mutedCls} />
        <StatTile label={`Facturas emitidas${mn}`} value={String(summary?.totalFacturas ?? 0)} cardCls={cardCls} titleCls={titleCls} mutedCls={mutedCls} />
        <StatTile label={`Notas crédito${mn}`} value={String(summary?.totalNotasCredito ?? 0)} cardCls={cardCls} titleCls={titleCls} mutedCls={mutedCls} />
      </div>

      {/* 1. Facturación mes a mes */}
      <section className={cardCls}>
        <ChartHeader
          title="Facturación mes a mes"
          subtitle={`${scopeName} · subtotal por mes, antes de impuestos (facturas menos notas crédito)${onChartClick ? ' · clic en un mes para filtrar' : ''}`}
          titleCls={titleCls}
          mutedCls={mutedCls}
        />
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} onClick={onChartClick} style={clickable}>
              <CartesianGrid vertical={false} stroke={colors.grid} />
              <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={12} />
              <YAxis {...axisProps} tickFormatter={fmtCompact} width={64} />
              <ReferenceLine y={0} stroke={colors.axis} strokeOpacity={0.4} />
              <Tooltip
                cursor={{ fill: colors.grid }}
                content={<ChartTooltip isDark={isDark} isInternal={isInternal} rows={[
                  { key: 'subtotal', label: 'Subtotal', color: colors.facturado },
                ]} />}
              />
              <Bar dataKey="subtotal" name="Subtotal" fill={colors.facturado} maxBarSize={24} radius={[4, 4, 0, 0]}>
                {monthly.map(m => <Cell key={m.period} fillOpacity={dimOpacity(m.period, month)} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <DataTable
          mutedCls={mutedCls}
          isInternal={isInternal}
          headers={['Mes', 'Facturas', 'Notas crédito', 'Subtotal']}
          rows={monthly.map(m => [m.label, String(m.facturas), String(m.notasCredito), fmtMoney(m.subtotal)])}
          select={select}
        />
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {porServicio}

        {/* 3. Valor bruto mes a mes */}
        <section className={cardCls}>
          <ChartHeader
            title="Valor bruto facturado mes a mes"
            subtitle="Antes de descuentos e impuestos (facturas menos notas crédito)"
            titleCls={titleCls}
            mutedCls={mutedCls}
          />
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} onClick={onChartClick} style={clickable}>
                <CartesianGrid vertical={false} stroke={colors.grid} />
                <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={12} />
                <YAxis {...axisProps} tickFormatter={fmtCompact} width={64} />
                {selectedLabel && <ReferenceLine x={selectedLabel} stroke={colors.facturado} strokeDasharray="4 3" />}
                <Tooltip
                  cursor={{ stroke: colors.axis, strokeOpacity: 0.4 }}
                  content={<ChartTooltip isDark={isDark} isInternal={isInternal} rows={[
                    { key: 'bruto', label: 'Valor bruto', color: colors.facturado },
                  ]} />}
                />
                <Area
                  type="monotone"
                  dataKey="bruto"
                  stroke={colors.facturado}
                  strokeWidth={2}
                  fill={colors.facturado}
                  fillOpacity={0.1}
                  dot={false}
                  activeDot={{ r: 5, stroke: isDark ? '#1a2545' : (isInternal ? '#ffffff' : '#fff7e4'), strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <DataTable
            mutedCls={mutedCls}
            isInternal={isInternal}
            headers={['Mes', 'Valor bruto']}
            rows={monthly.map(m => [m.label, fmtMoney(m.bruto)])}
            select={select}
          />
        </section>
      </div>
    </>
  )
}

/** Pestaña Recaudo: recibos de caja aplicados (Siigo vouchers RC) */
export function RecaudoCharts({ params, range, style, scopeName, month = null, onMonth, compact = false }: ChartProps) {
  const { colors, isDark, isInternal, cardCls, titleCls, mutedCls } = style
  // Filtro por cliente (clic en "Recaudo por cliente"): acota series, cifras y servicios
  const [customer, setCustomer] = useState<{ nit: string; name: string } | null>(null)
  const custParams = customer ? { ...params, customerNit: customer.nit } : params

  // Lo facturado viene del mismo informe de la pestaña Facturación (consulta en caché)
  const { data: sales } = useSalesReport(custParams, true)
  const salesMonthly = useMemo(() => toSalesMonthly(sales?.monthly ?? [], range), [sales?.monthly, range.from, range.to])

  const { data, isLoading } = useCollectionsReport(custParams, true)
  // Cifras y desglose por servicio del mes seleccionado (sin mes es la misma consulta)
  const { data: focus } = useCollectionsReport(monthParams(custParams, month), true)
  // El desglose por cliente ignora su propio filtro para seguir mostrando a todos los clientes
  const { data: byCustomerSrc } = useCollectionsReport(monthParams(params, month), true)
  const customers = useMemo(
    () => (byCustomerSrc?.byCustomer ?? []).slice(0, MAX_CUSTOMERS).map(c => ({ nit: c.nit, name: c.name, total: Number(c.recaudado), recibos: c.recibos })),
    [byCustomerSrc?.byCustomer],
  )
  const pickCustomer = (c: { nit: string; name: string }) => setCustomer(cur => (cur?.nit === c.nit ? null : { nit: c.nit, name: c.name }))

  // Facturado (neto) y recaudado alineados por mes; meses sin movimiento en cero
  const monthly = useMemo(() => {
    const recaudo = new Map((data?.monthly ?? []).map(m => [m.period, m]))
    const sales = new Map(salesMonthly.map(m => [m.period, m]))
    const periods = Array.from(new Set([...recaudo.keys(), ...sales.keys()])).sort()
    const from = range.from ?? periods[0]
    const to = range.to ?? periods[periods.length - 1]
    const filled = fillMonths(
      periods.map(p => ({
        period: p, facturas: 0, notasCredito: 0, bruto: 0, subtotal: 0, total: 0,
        totalFacturado: 0, totalNotasCredito: 0,
      })),
      from ?? null,
      to ?? null,
    )
    return filled.map(({ period }) => ({
      period,
      label: fmtPeriod(period),
      recaudado: Number(recaudo.get(period)?.recaudado ?? 0),
      recibos: Number(recaudo.get(period)?.recibos ?? 0),
      facturado: Number(sales.get(period)?.total ?? 0),
    }))
  }, [data?.monthly, salesMonthly, range.from, range.to])

  const services = useMemo(
    () => topServices((focus?.byProduct ?? []).map(p => ({ code: '', description: p.description, bruto: 0, total: Number(p.recaudado) }))),
    [focus?.byProduct],
  )

  if (isLoading) return <PageLoader />

  if (!data?.summary || data.summary.movimientos === 0) {
    return (
      <div className={cn(cardCls, 'py-16 text-center space-y-2')}>
        <BarChart3 className={cn('w-10 h-10 mx-auto', mutedCls)} />
        <p className={cn('font-semibold', titleCls)}>No hay recaudo registrado en el periodo seleccionado</p>
        <p className={cn('text-xs', mutedCls)}>
          {data?.lastSync?.status === 'completed' ? `Recaudo actualizado hasta ${data.lastSync.end_date}.` : 'El recaudo aún no se ha sincronizado desde Siigo.'}
        </p>
      </div>
    )
  }

  const axisProps = { tick: { fill: colors.axis, fontSize: 11 }, tickLine: false, axisLine: false }
  const tile = { cardCls, titleCls, mutedCls }
  // Mientras llega la consulta del mes se muestran las cifras del periodo
  const s = focus?.summary ?? data.summary
  const onChartClick = monthClick(monthly, month, onMonth)
  const select = monthSelect(monthly, month, onMonth)
  const clickable = onChartClick ? { cursor: 'pointer' } : undefined
  const mn = monthNote(month)
  const cells = monthly.map(m => <Cell key={m.period} fillOpacity={dimOpacity(m.period, month)} />)

  // Facturado vs recaudado: misma unidad, un solo eje
  const facturadoVsRecaudado = (
      <section className={cardCls}>
        <ChartHeader
          title="Facturado vs recaudado"
          subtitle={`${scopeName} · total neto facturado y valor recaudado por mes${onChartClick ? ' · clic en un mes para filtrar' : ''}`}
          titleCls={titleCls}
          mutedCls={mutedCls}
        />
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthly} barGap={2} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} onClick={onChartClick} style={clickable}>
              <CartesianGrid vertical={false} stroke={colors.grid} />
              <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={12} />
              <YAxis {...axisProps} tickFormatter={fmtCompact} width={64} />
              <Tooltip
                cursor={{ fill: colors.grid }}
                content={<ChartTooltip isDark={isDark} isInternal={isInternal} rows={[
                  { key: 'facturado', label: 'Facturado', color: colors.facturado },
                  { key: 'recaudado', label: 'Recaudado', color: colors.recaudo },
                ]} />}
              />
              <Legend
                verticalAlign="top"
                align="right"
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: 12, paddingBottom: 8 }}
                formatter={(value: string) => <span style={{ color: colors.axis }}>{value}</span>}
              />
              <Bar dataKey="facturado" name="Facturado" fill={colors.facturado} maxBarSize={20} radius={[4, 4, 0, 0]}>{cells}</Bar>
              <Bar dataKey="recaudado" name="Recaudado" fill={colors.recaudo} maxBarSize={20} radius={[4, 4, 0, 0]}>{cells}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <DataTable
          mutedCls={mutedCls}
          isInternal={isInternal}
          headers={['Mes', 'Facturado', 'Recaudado', 'Recibos']}
          rows={monthly.map(m => [m.label, fmtMoney(m.facturado), fmtMoney(m.recaudado), String(m.recibos)])}
          select={select}
        />
      </section>
  )

  if (compact) return facturadoVsRecaudado

  return (
    <>
      <FilterChips
        mutedCls={mutedCls}
        onClearAll={() => setCustomer(null)}
        filters={customer ? [{ label: `Cliente: ${customer.name}`, onClear: () => setCustomer(null) }] : []}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label={`Total recaudado${mn}`} value={fmtCompact(s.totalRecaudado)} title={fmtMoney(s.totalRecaudado)} {...tile} />
        <StatTile label={`Recibos de caja${mn}`} value={String(s.recibos)} {...tile} />
        <StatTile label={`Facturas pagadas${mn}`} value={String(s.facturas)} {...tile} />
        <StatTile label={`Anticipos y otros ingresos${mn}`} value={fmtCompact(s.anticipos)} title={fmtMoney(s.anticipos)} {...tile} />
      </div>

      {facturadoVsRecaudado}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <section className={cardCls}>
          <ChartHeader title="Recaudo mes a mes" subtitle="Valor aplicado de los recibos de caja" titleCls={titleCls} mutedCls={mutedCls} />
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} onClick={onChartClick} style={clickable}>
                <CartesianGrid vertical={false} stroke={colors.grid} />
                <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={12} />
                <YAxis {...axisProps} tickFormatter={fmtCompact} width={64} />
                <Tooltip
                  cursor={{ fill: colors.grid }}
                  content={<ChartTooltip isDark={isDark} isInternal={isInternal} rows={[
                    { key: 'recaudado', label: 'Recaudado', color: colors.recaudo },
                  ]} />}
                />
                <Bar dataKey="recaudado" fill={colors.recaudo} maxBarSize={24} radius={[4, 4, 0, 0]}>{cells}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className={cardCls}>
          <ChartHeader
            title={`Recaudo por servicio${mn}`}
            subtitle={`Según los productos de la factura pagada${services.length > MAX_SERVICES ? ` · top ${MAX_SERVICES}` : ''}`}
            titleCls={titleCls}
            mutedCls={mutedCls}
          />
          <div style={{ height: Math.max(180, services.length * 40) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={services} layout="vertical" margin={{ top: 0, right: 72, left: 0, bottom: 0 }}>
                <CartesianGrid horizontal={false} stroke={colors.grid} />
                <XAxis type="number" {...axisProps} tickFormatter={fmtCompact} />
                <YAxis type="category" dataKey="name" {...axisProps} width={170} tick={(props: any) => <ServiceTick {...props} fill={colors.axis} />} />
                <Tooltip
                  cursor={{ fill: colors.grid }}
                  content={<ChartTooltip isDark={isDark} isInternal={isInternal} labelKey="name" rows={[
                    { key: 'total', label: 'Recaudado', color: colors.recaudo },
                  ]} />}
                />
                <Bar dataKey="total" fill={colors.recaudo} maxBarSize={24} radius={[0, 4, 4, 0]}>
                  <LabelList dataKey="total" position="right" formatter={(v: any) => fmtCompact(Number(v))} style={{ fill: colors.axis, fontSize: 11 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <DataTable
            mutedCls={mutedCls}
            isInternal={isInternal}
            headers={['Servicio', 'Recaudado', 'Movimientos']}
            rows={(focus?.byProduct ?? []).map(p => [p.description, fmtMoney(Number(p.recaudado)), String(p.movimientos)])}
          />
        </section>
      </div>

      {customers.length > 1 && (
        <section className={cardCls}>
          <ChartHeader
            title={`Recaudo por cliente${mn}`}
            subtitle={`Clientes que más pagaron${(byCustomerSrc?.byCustomer.length ?? 0) > MAX_CUSTOMERS ? ` · top ${MAX_CUSTOMERS}` : ''} · clic en un cliente para filtrar`}
            titleCls={titleCls}
            mutedCls={mutedCls}
          />
          <div style={{ height: Math.max(180, customers.length * 36) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={customers}
                layout="vertical"
                margin={{ top: 0, right: 72, left: 0, bottom: 0 }}
                onClick={rowClick(customers, pickCustomer)}
                style={{ cursor: 'pointer' }}
              >
                <CartesianGrid horizontal={false} stroke={colors.grid} />
                <XAxis type="number" {...axisProps} tickFormatter={fmtCompact} />
                <YAxis type="category" dataKey="name" {...axisProps} width={190} tick={(props: any) => <ServiceTick {...props} fill={colors.axis} />} />
                <Tooltip
                  cursor={{ fill: colors.grid }}
                  content={<ChartTooltip isDark={isDark} isInternal={isInternal} labelKey="name" rows={[
                    { key: 'total', label: 'Recaudado', color: colors.recaudo },
                  ]} />}
                />
                <Bar dataKey="total" fill={colors.recaudo} maxBarSize={22} radius={[0, 4, 4, 0]}>
                  {customers.map(c => <Cell key={c.nit} fillOpacity={dimKey(c.nit, customer?.nit)} />)}
                  <LabelList dataKey="total" position="right" formatter={(v: any) => fmtCompact(Number(v))} style={{ fill: colors.axis, fontSize: 11 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <DataTable
            mutedCls={mutedCls}
            isInternal={isInternal}
            headers={['Cliente', 'NIT', 'Recibos', 'Recaudado']}
            rows={customers.map(c => [c.name, c.nit, String(c.recibos), fmtMoney(c.total)])}
            select={{ keys: customers.map(c => c.nit), selected: customer?.nit ?? null, onSelect: nit => pickCustomer(customers.find(c => c.nit === nit)!) }}
          />
        </section>
      )}

      {data?.lastSync?.status === 'completed' && (
        <p className={cn('text-xs', mutedCls)}>
          Recaudo actualizado el {new Date(data.lastSync.started_at).toLocaleString('es-CO')} (hasta {data.lastSync.end_date}).
          Un pago puede abarcar varios servicios de la misma factura; en ese caso se agrupa con todos ellos.
        </p>
      )}
    </>
  )
}

/**
 * Pestaña Balance (balance de prueba por tercero de Siigo).
 * - Vista global (interno sin empresa): estado de resultados mensual, estructura y cartera por tercero.
 * - Vista empresa (cliente, o interno con empresa): solo las cuentas donde la empresa es el tercero.
 * Solo se grafican los meses importados: un mes sin importar no es un mes en cero.
 */
export function BalanceCharts({ params, range, style, scopeName, month = null, onMonth, onCompany }: ChartProps) {
  const { colors, isDark, isInternal, cardCls, titleCls, mutedCls } = style
  const { data, isLoading } = useBalanceReport(params)
  // Saldos por cuenta y cartera por tercero al cierre del mes seleccionado (sin mes es la misma consulta)
  const { data: focus } = useBalanceReport(monthParams(params, month), true)

  const monthly = useMemo(
    () => (data?.monthly ?? []).map(m => {
      const n = (k: keyof BalanceMonthly) => Number(m[k] ?? 0)
      const gastosCostos = n('gastos') + n('costos')
      return {
        period: m.period,
        label: fmtPeriod(m.period),
        ingresos: n('ingresos'),
        gastosCostos,
        utilidad: n('ingresos') - gastosCostos,
        activo: n('activo'),
        pasivo: n('pasivo'),
        patrimonio: n('patrimonio'),
        cartera: n('cartera'),
        anticipos: n('anticipos'),
        debito: n('debito'),
        credito: n('credito'),
      }
    }),
    [data?.monthly],
  )

  if (isLoading) return <PageLoader />

  if (!monthly.length) {
    return (
      <div className={cn(cardCls, 'py-16 text-center space-y-2')}>
        <BarChart3 className={cn('w-10 h-10 mx-auto', mutedCls)} />
        <p className={cn('font-semibold', titleCls)}>No hay balance de prueba en el periodo seleccionado</p>
        <p className={cn('text-xs', mutedCls)}>
          {data?.scope === 'company'
            ? 'No hay saldos contables a nombre de esta empresa en los meses importados.'
            : 'El balance de prueba aún no se ha importado para estos meses.'}
        </p>
      </div>
    )
  }

  const axisProps = { tick: { fill: colors.axis, fontSize: 11 }, tickLine: false, axisLine: false }
  const tile = { cardCls, titleCls, mutedCls }
  // Con mes seleccionado, la "foto" es ese mes y los totales del periodo son solo ese mes
  const picked = month ? monthly.find(m => m.period === month) : undefined
  const last = picked ?? monthly[monthly.length - 1]!
  const lastLabel = fmtPeriod(last.period)
  const totalsRows = picked ? [picked] : monthly
  const sum = (k: 'ingresos' | 'gastosCostos' | 'utilidad' | 'debito' | 'credito') => totalsRows.reduce((s, m) => s + m[k], 0)
  const periodWord = picked ? `de ${lastLabel}` : 'del periodo'
  const rangeNote = range.from || range.to ? '' : ' · todos los meses importados'
  const onChartClick = monthClick(monthly, month, onMonth)
  const select = monthSelect(monthly, month, onMonth)
  const clickable = onChartClick ? { cursor: 'pointer' } : undefined
  const clickNote = onChartClick ? ' · clic en un mes para filtrar' : ''
  const cells = monthly.map(m => <Cell key={m.period} fillOpacity={dimOpacity(m.period, month)} />)
  const byAccount = focus?.byAccount ?? data?.byAccount ?? []
  const topCartera = focus?.topCartera ?? data?.topCartera ?? []
  const legend = (
    <Legend
      verticalAlign="top"
      align="right"
      iconType="circle"
      iconSize={8}
      wrapperStyle={{ fontSize: 12, paddingBottom: 8 }}
      formatter={(value: string) => <span style={{ color: colors.axis }}>{value}</span>}
    />
  )

  if (data?.scope === 'company') {
    const accounts = byAccount.map(a => ({ name: `${a.code} · ${a.name}`, total: Number(a.finalBalance) }))
    return (
      <>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatTile label={isInternal ? `Saldo de cartera · ${lastLabel}` : `Saldo por pagar · ${lastLabel}`} value={fmtCompact(last.cartera)} title={fmtMoney(last.cartera)} {...tile} />
          <StatTile label={`Anticipos / saldos a favor · ${lastLabel}`} value={fmtCompact(last.anticipos)} title={fmtMoney(last.anticipos)} {...tile} />
          <StatTile label={`Movimiento débito ${periodWord}`} value={fmtCompact(sum('debito'))} title={fmtMoney(sum('debito'))} {...tile} />
          <StatTile label={`Movimiento crédito ${periodWord}`} value={fmtCompact(sum('credito'))} title={fmtMoney(sum('credito'))} {...tile} />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          <section className={cardCls}>
            <ChartHeader
              title={isInternal ? 'Saldo de cartera mes a mes' : 'Saldo por pagar mes a mes'}
              subtitle={`${scopeName} · saldo final de cuentas por cobrar (13) al cierre de cada mes${clickNote}`}
              titleCls={titleCls}
              mutedCls={mutedCls}
            />
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} onClick={onChartClick} style={clickable}>
                  <CartesianGrid vertical={false} stroke={colors.grid} />
                  <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={12} />
                  <YAxis {...axisProps} tickFormatter={fmtCompact} width={64} />
                  {picked && <ReferenceLine x={lastLabel} stroke={colors.facturado} strokeDasharray="4 3" />}
                  <Tooltip
                    cursor={{ stroke: colors.axis, strokeOpacity: 0.4 }}
                    content={<ChartTooltip isDark={isDark} isInternal={isInternal} rows={[
                      { key: 'cartera', label: 'Cartera', color: colors.facturado },
                      { key: 'anticipos', label: 'Anticipos' },
                    ]} />}
                  />
                  <Area
                    // Saldos al cierre de cada mes: tramos rectos, sin suavizar entre fotos mensuales
                    type="linear"
                    dataKey="cartera"
                    stroke={colors.facturado}
                    strokeWidth={2}
                    fill={colors.facturado}
                    fillOpacity={0.1}
                    dot={monthly.length < 3 ? { r: 4, fill: colors.facturado } : false}
                    activeDot={{ r: 5, stroke: isDark ? '#1a2545' : (isInternal ? '#ffffff' : '#fff7e4'), strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <DataTable
              mutedCls={mutedCls}
              isInternal={isInternal}
              headers={['Mes', 'Cartera', 'Anticipos', 'Débito', 'Crédito']}
              rows={monthly.map(m => [m.label, fmtMoney(m.cartera), fmtMoney(m.anticipos), fmtMoney(m.debito), fmtMoney(m.credito)])}
              select={select}
            />
          </section>

          <section className={cardCls}>
            <ChartHeader title={`Saldos por cuenta · ${lastLabel}`} subtitle="Saldo final de cada cuenta contable a tu nombre" titleCls={titleCls} mutedCls={mutedCls} />
            <div style={{ height: Math.max(180, accounts.length * 40) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={accounts} layout="vertical" margin={{ top: 0, right: 72, left: 0, bottom: 0 }}>
                  <CartesianGrid horizontal={false} stroke={colors.grid} />
                  <XAxis type="number" {...axisProps} tickFormatter={fmtCompact} />
                  <YAxis type="category" dataKey="name" {...axisProps} width={170} tick={(props: any) => <ServiceTick {...props} fill={colors.axis} />} />
                  <ReferenceLine x={0} stroke={colors.axis} strokeOpacity={0.4} />
                  <Tooltip
                    cursor={{ fill: colors.grid }}
                    content={<ChartTooltip isDark={isDark} isInternal={isInternal} labelKey="name" rows={[
                      { key: 'total', label: 'Saldo final', color: colors.facturado },
                    ]} />}
                  />
                  <Bar dataKey="total" fill={colors.facturado} maxBarSize={24} radius={[0, 4, 4, 0]}>
                    <LabelList dataKey="total" position="right" formatter={(v: any) => fmtCompact(Number(v))} style={{ fill: colors.axis, fontSize: 11 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <DataTable
              mutedCls={mutedCls}
              isInternal={isInternal}
              headers={['Cuenta', 'Débito', 'Crédito', 'Saldo final']}
              rows={byAccount.map(a => [`${a.code} · ${a.name}`, fmtMoney(Number(a.debit)), fmtMoney(Number(a.credit)), fmtMoney(Number(a.finalBalance))])}
            />
          </section>
        </div>
      </>
    )
  }

  // Vista global
  const estructura = [
    { name: 'Activo', total: last.activo },
    { name: 'Pasivo', total: last.pasivo },
    { name: 'Patrimonio', total: last.patrimonio },
  ]
  const cartera = topCartera.map(t => ({ name: t.name, total: Number(t.saldo), companyId: t.companyId }))
  // Clic en un tercero vinculado a una empresa: cambia toda la página a la vista de esa empresa
  const pickTercero = onCompany && ((t: { companyId: string | null }) => { if (t.companyId) onCompany(t.companyId) })
  const terceroLinked = cartera.some(t => t.companyId)

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label={`Ingresos ${periodWord}`} value={fmtCompact(sum('ingresos'))} title={fmtMoney(sum('ingresos'))} {...tile} />
        <StatTile label={`Gastos y costos ${periodWord}`} value={fmtCompact(sum('gastosCostos'))} title={fmtMoney(sum('gastosCostos'))} {...tile} />
        <StatTile label={`Utilidad ${periodWord}`} value={fmtCompact(sum('utilidad'))} title={fmtMoney(sum('utilidad'))} {...tile} />
        <StatTile label={`Activo · ${lastLabel}`} value={fmtCompact(last.activo)} title={fmtMoney(last.activo)} {...tile} />
      </div>

      <section className={cardCls}>
        <ChartHeader
          title="Ingresos vs gastos y costos"
          subtitle={`Movimiento de cada mes (clase 4 frente a clases 5, 6 y 7)${rangeNote}${clickNote}`}
          titleCls={titleCls}
          mutedCls={mutedCls}
        />
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthly} barGap={2} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} onClick={onChartClick} style={clickable}>
              <CartesianGrid vertical={false} stroke={colors.grid} />
              <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={12} />
              <YAxis {...axisProps} tickFormatter={fmtCompact} width={64} />
              <Tooltip
                cursor={{ fill: colors.grid }}
                content={<ChartTooltip isDark={isDark} isInternal={isInternal} rows={[
                  { key: 'ingresos', label: 'Ingresos', color: colors.facturado },
                  { key: 'gastosCostos', label: 'Gastos y costos', color: colors.recaudo },
                  { key: 'utilidad', label: 'Utilidad' },
                ]} />}
              />
              {legend}
              <Bar dataKey="ingresos" name="Ingresos" fill={colors.facturado} maxBarSize={20} radius={[4, 4, 0, 0]}>{cells}</Bar>
              <Bar dataKey="gastosCostos" name="Gastos y costos" fill={colors.recaudo} maxBarSize={20} radius={[4, 4, 0, 0]}>{cells}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <DataTable
          mutedCls={mutedCls}
          isInternal={isInternal}
          headers={['Mes', 'Ingresos', 'Gastos y costos', 'Utilidad']}
          rows={monthly.map(m => [m.label, fmtMoney(m.ingresos), fmtMoney(m.gastosCostos), fmtMoney(m.utilidad)])}
          select={select}
        />
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <section className={cardCls}>
          <ChartHeader title="Utilidad mes a mes" subtitle="Ingresos menos gastos y costos de cada mes" titleCls={titleCls} mutedCls={mutedCls} />
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} onClick={onChartClick} style={clickable}>
                <CartesianGrid vertical={false} stroke={colors.grid} />
                <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={12} />
                <YAxis {...axisProps} tickFormatter={fmtCompact} width={64} />
                <ReferenceLine y={0} stroke={colors.axis} strokeOpacity={0.4} />
                <Tooltip
                  cursor={{ fill: colors.grid }}
                  content={<ChartTooltip isDark={isDark} isInternal={isInternal} rows={[
                    { key: 'utilidad', label: 'Utilidad', color: colors.facturado },
                  ]} />}
                />
                <Bar dataKey="utilidad" fill={colors.facturado} maxBarSize={24} radius={[4, 4, 0, 0]}>{cells}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className={cardCls}>
          <ChartHeader title={`Estructura del balance · ${lastLabel}`} subtitle="Saldos finales de activo, pasivo y patrimonio" titleCls={titleCls} mutedCls={mutedCls} />
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={estructura} layout="vertical" margin={{ top: 0, right: 72, left: 0, bottom: 0 }}>
                <CartesianGrid horizontal={false} stroke={colors.grid} />
                <XAxis type="number" {...axisProps} tickFormatter={fmtCompact} />
                <YAxis type="category" dataKey="name" {...axisProps} width={90} />
                <Tooltip
                  cursor={{ fill: colors.grid }}
                  content={<ChartTooltip isDark={isDark} isInternal={isInternal} labelKey="name" rows={[
                    { key: 'total', label: 'Saldo final', color: colors.facturado },
                  ]} />}
                />
                <Bar dataKey="total" fill={colors.facturado} maxBarSize={24} radius={[0, 4, 4, 0]}>
                  <LabelList dataKey="total" position="right" formatter={(v: any) => fmtCompact(Number(v))} style={{ fill: colors.axis, fontSize: 11 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <DataTable
            mutedCls={mutedCls}
            isInternal={isInternal}
            headers={['Mes', 'Activo', 'Pasivo', 'Patrimonio']}
            rows={monthly.map(m => [m.label, fmtMoney(m.activo), fmtMoney(m.pasivo), fmtMoney(m.patrimonio)])}
            select={select}
          />
        </section>
      </div>

      {cartera.length > 0 && (
        <section className={cardCls}>
          <ChartHeader
            title={`Mayores saldos de cartera · ${lastLabel}`}
            subtitle={`Terceros con mayor saldo en cuentas por cobrar (13)${pickTercero && terceroLinked ? ' · clic en un cliente vinculado para ver solo su empresa' : ''}`}
            titleCls={titleCls}
            mutedCls={mutedCls}
          />
          <div style={{ height: Math.max(180, cartera.length * 40) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={cartera}
                layout="vertical"
                margin={{ top: 0, right: 72, left: 0, bottom: 0 }}
                onClick={terceroLinked ? rowClick(cartera, pickTercero) : undefined}
                style={pickTercero && terceroLinked ? { cursor: 'pointer' } : undefined}
              >
                <CartesianGrid horizontal={false} stroke={colors.grid} />
                <XAxis type="number" {...axisProps} tickFormatter={fmtCompact} />
                <YAxis type="category" dataKey="name" {...axisProps} width={170} tick={(props: any) => <ServiceTick {...props} fill={colors.axis} />} />
                <Tooltip
                  cursor={{ fill: colors.grid }}
                  content={<ChartTooltip isDark={isDark} isInternal={isInternal} labelKey="name" rows={[
                    { key: 'total', label: 'Saldo de cartera', color: colors.facturado },
                  ]} />}
                />
                <Bar dataKey="total" fill={colors.facturado} maxBarSize={24} radius={[0, 4, 4, 0]}>
                  <LabelList dataKey="total" position="right" formatter={(v: any) => fmtCompact(Number(v))} style={{ fill: colors.axis, fontSize: 11 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <DataTable
            mutedCls={mutedCls}
            isInternal={isInternal}
            headers={['Tercero', 'NIT', 'Saldo']}
            rows={topCartera.map(t => [t.name, t.nit, fmtMoney(Number(t.saldo))])}
            select={pickTercero && terceroLinked
              ? { keys: cartera.map(t => t.companyId ?? ''), selected: null, onSelect: id => onCompany?.(id) }
              : undefined}
          />
        </section>
      )}
    </>
  )
}

const pct = (part: number, total: number) => (total > 0 ? `${Math.round((part / total) * 100)}%` : '—')

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

const SYNC_ROLES = ['admin', 'rs_admin', 'contador']

const fmtDay = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: '2-digit' })

/**
 * Cartera: facturas con saldo a la fecha de corte (Siigo /v1/invoices), con el saldo de cada cliente
 * limitado a su saldo contable en 130505 + 13051001. Foto diaria; el periodo solo filtra la evolución.
 * Es independiente de las importaciones del módulo de cobro.
 */
export function CarteraCharts({ params, style, scopeName, compact = false, only }: ChartProps) {
  const { colors, isDark, isInternal, cardCls, titleCls, mutedCls } = style
  const role = useAuthStore(s => s.user?.role ?? '')
  const canSync = SYNC_ROLES.includes(role)
  const qc = useQueryClient()
  const startWatching = useSiigoSyncStore(s => s.start)

  // Filtros cruzados por clic: edad, cliente y vendedor. Cada desglose ignora su propio filtro (lo resuelve el backend)
  const [bucket, setBucket] = useState<string | null>(null)
  const [customer, setCustomer] = useState<{ nit: string; name: string } | null>(null)
  const [seller, setSeller] = useState<string | null>(null)
  const hasFilters = Boolean(bucket || customer || seller)
  const clearFilters = () => { setBucket(null); setCustomer(null); setSeller(null) }
  const reportParams: Record<string, string> = {
    ...params,
    ...(bucket ? { bucket } : {}),
    ...(customer ? { customerNit: customer.nit } : {}),
    ...(seller ? { seller } : {}),
  }

  const { data, isLoading } = useQuery<ReceivablesReport>({
    queryKey: ['siigo-receivables-report', reportParams],
    queryFn: async () => (await api.get('/api/siigo/receivables/report', { params: reportParams })).data,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
    // Mientras corre una sincronización se refresca su estado
    refetchInterval: q => (q.state.data?.isSyncRunning ? 10_000 : false),
  })

  const syncMut = useMutation({
    mutationFn: async () => (await api.post('/api/siigo/receivables/sync', { connectionId: data?.books?.connectionId })).data,
    onSuccess: (res) => {
      startWatching('receivables', res.connectionId, data?.books?.label ?? 'Finto')
      toast.info('Cálculo de cartera iniciado en segundo plano. Te avisaremos cuando termine.')
      qc.invalidateQueries({ queryKey: ['siigo-receivables-report'] })
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'No se pudo iniciar la sincronización de cartera'),
  })

  const history = useMemo(
    () => (data?.history ?? []).map(h => ({ label: fmtDay(h.cutDate), total: Number(h.total), vencido: Number(h.vencido) })),
    [data?.history],
  )

  if (isLoading) return <PageLoader />

  const s = data?.summary
  const running = Boolean(data?.isSyncRunning || syncMut.isPending)
  const syncBar = canSync && (
    <div className={cn(cardCls, 'flex flex-wrap items-center justify-between gap-3 py-3')}>
      <p className={cn('text-xs', mutedCls)}>
        {data?.lastSuccess
          ? `Cartera con corte al ${fmtDay(data.lastSuccess.cut_date)} · calculada el ${new Date(data.lastSuccess.started_at).toLocaleString('es-CO')}`
          : 'La cartera aún no se ha calculado para estos libros.'}
        {data?.lastSync?.status === 'failed' && (
          <span className="block text-red-600">Último intento fallido: {data.lastSync.error_message}</span>
        )}
      </p>
      <button
        onClick={() => syncMut.mutate()}
        disabled={running}
        className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-60"
      >
        {running ? 'Calculando cartera…' : 'Actualizar cartera desde Siigo'}
      </button>
    </div>
  )

  // Con filtros activos una combinación sin facturas se muestra en cero (para poder quitar filtros)
  if (!s || (!s.facturas && !hasFilters)) {
    return (
      <>
        {syncBar}
        <div className={cn(cardCls, 'py-16 text-center space-y-2')}>
          <BarChart3 className={cn('w-10 h-10 mx-auto', mutedCls)} />
          <p className={cn('font-semibold', titleCls)}>No hay cartera calculada</p>
          <p className={cn('text-xs', mutedCls)}>
            {data?.scope === 'company'
              ? 'Este cliente no tiene facturas con saldo en la última cartera calculada.'
              : 'La cartera se calcula cada día desde Siigo; aún no hay una foto disponible.'}
          </p>
        </div>
      </>
    )
  }

  const axisProps = { tick: { fill: colors.axis, fontSize: 11 }, tickLine: false, axisLine: false }
  const tile = { cardCls, titleCls, mutedCls }
  const cut = data?.cutDate ? fmtDay(data.cutDate) : ''
  const buckets = (data?.byBucket ?? [])
    .filter(b => b.bucket !== 'Sin vencimiento' || Number(b.total) > 0)
    .map(b => ({ name: b.bucket === 'No vencido' ? 'Por vencer' : b.bucket === 'Sin vencimiento' ? b.bucket : `${b.bucket} días`, bucket: b.bucket, total: Number(b.total), facturas: b.facturas }))
  const customers = (data?.byCustomer ?? []).map(c => ({
    name: c.name, nit: c.nit, total: Number(c.total), vencido: Number(c.vencido), porVencer: Number(c.total) - Number(c.vencido), facturas: c.facturas, maxDias: c.maxDias,
  }))
  const sellers = (data?.bySeller ?? []).map(v => ({ name: v.seller, total: Number(v.total), vencido: Number(v.vencido), facturas: v.facturas }))
  const bucketColor = (b: string) => b === 'No vencido' ? colors.facturado : b === 'Sin vencimiento' ? colors.axis : colors.notas
  const pickBucket = (b: { bucket: string }) => setBucket(cur => (cur === b.bucket ? null : b.bucket))
  const pickCustomer = (c: { nit: string; name: string }) => setCustomer(cur => (cur?.nit === c.nit ? null : { nit: c.nit, name: c.name }))
  const pickSeller = (v: { name: string }) => setSeller(cur => (cur === v.name ? null : v.name))
  const bucketLabel = buckets.find(b => b.bucket === bucket)?.name ?? bucket
  const chips = [
    ...(bucket ? [{ label: `Edad: ${bucketLabel}`, onClear: () => setBucket(null) }] : []),
    ...(customer ? [{ label: `Cliente: ${customer.name}`, onClear: () => setCustomer(null) }] : []),
    ...(seller ? [{ label: `Vendedor: ${seller}`, onClear: () => setSeller(null) }] : []),
  ]
  const clickable = { cursor: 'pointer' }
  const legend = (
    <Legend
      verticalAlign="top"
      align="right"
      iconType="circle"
      iconSize={8}
      wrapperStyle={{ fontSize: 12, paddingBottom: 8 }}
      formatter={(value: string) => <span style={{ color: colors.axis }}>{value}</span>}
    />
  )

  // Participación de cada edad sobre el total sin el filtro de edad (la gráfica de edades lo ignora)
  const bucketsTotal = buckets.reduce((n, b) => n + b.total, 0)

  const edadesChart = (
    <section className={cardCls}>
      <ChartHeader
        title={`Cartera por edades · ${cut}`}
        subtitle={`${scopeName} · saldo por días vencidos (azul por vencer, dorado vencido) · clic en una edad para filtrar`}
        titleCls={titleCls}
        mutedCls={mutedCls}
      />
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={buckets} margin={{ top: 16, right: 8, left: 0, bottom: 0 }} onClick={rowClick(buckets, pickBucket)} style={clickable}>
            <CartesianGrid vertical={false} stroke={colors.grid} />
            <XAxis dataKey="name" {...axisProps} />
            <YAxis {...axisProps} tickFormatter={fmtCompact} width={64} />
            <Tooltip
              cursor={{ fill: colors.grid }}
              content={<ChartTooltip isDark={isDark} isInternal={isInternal} labelKey="name" rows={[{ key: 'total', label: 'Saldo' }]} />}
            />
            <Bar dataKey="total" maxBarSize={40} radius={[4, 4, 0, 0]}>
              {buckets.map(b => <Cell key={b.bucket} fill={bucketColor(b.bucket)} fillOpacity={dimKey(b.bucket, bucket)} />)}
              <LabelList dataKey="total" position="top" formatter={(v: any) => fmtCompact(Number(v))} style={{ fill: colors.axis, fontSize: 11 }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <DataTable
        mutedCls={mutedCls}
        isInternal={isInternal}
        headers={['Edad', 'Facturas', 'Saldo', 'Participación']}
        rows={buckets.map(b => [b.name, String(b.facturas), fmtMoney(b.total), pct(b.total, bucketsTotal)])}
        select={{ keys: buckets.map(b => b.bucket), selected: bucket, onSelect: k => pickBucket({ bucket: k }) }}
      />
    </section>
  )

  const evolucionChart = (
    <section className={cardCls}>
      <ChartHeader title="Evolución de la cartera" subtitle={`Total y vencida en cada cálculo diario del periodo${hasFilters ? ' · no aplica los filtros de edad, cliente ni vendedor' : ''}`} titleCls={titleCls} mutedCls={mutedCls} />
      {history.length >= 2 ? (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={history} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={colors.grid} />
              <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={16} />
              <YAxis {...axisProps} tickFormatter={fmtCompact} width={64} />
              <Tooltip
                cursor={{ stroke: colors.axis, strokeOpacity: 0.4 }}
                content={<ChartTooltip isDark={isDark} isInternal={isInternal} rows={[
                  { key: 'total', label: 'Total', color: colors.facturado },
                  { key: 'vencido', label: 'Vencida', color: colors.notas },
                ]} />}
              />
              {legend}
              <Area type="linear" dataKey="total" name="Total" stroke={colors.facturado} strokeWidth={2} fill={colors.facturado} fillOpacity={0.1} dot={false} />
              <Area type="linear" dataKey="vencido" name="Vencida" stroke={colors.notas} strokeWidth={2} fill={colors.notas} fillOpacity={0.1} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className={cn('text-sm py-16 text-center', mutedCls)}>
          La evolución se construye con cada cálculo diario; vuelve en unos días para ver la tendencia.
        </p>
      )}
    </section>
  )

  const clientesChart = (
    <section className={cardCls}>
      <ChartHeader
        title={`Clientes con mayor saldo · ${cut}`}
        subtitle={`Saldo vencido y por vencer de cada cliente${customers.length >= 15 ? ' · top 15' : ''} · clic en un cliente para filtrar`}
        titleCls={titleCls}
        mutedCls={mutedCls}
      />
      <div style={{ height: Math.max(180, customers.length * 36) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={customers} layout="vertical" margin={{ top: 0, right: 72, left: 0, bottom: 0 }} onClick={rowClick(customers, pickCustomer)} style={clickable}>
            <CartesianGrid horizontal={false} stroke={colors.grid} />
            <XAxis type="number" {...axisProps} tickFormatter={fmtCompact} />
            <YAxis type="category" dataKey="name" {...axisProps} width={190} tick={(props: any) => <ServiceTick {...props} fill={colors.axis} />} />
            <Tooltip
              cursor={{ fill: colors.grid }}
              content={<ChartTooltip isDark={isDark} isInternal={isInternal} labelKey="name" rows={[
                { key: 'vencido', label: 'Vencido', color: colors.notas },
                { key: 'porVencer', label: 'Por vencer', color: colors.facturado },
                { key: 'total', label: 'Total' },
              ]} />}
            />
            {legend}
            <Bar dataKey="vencido" name="Vencido" stackId="c" fill={colors.notas} maxBarSize={22}>
              {customers.map(c => <Cell key={c.nit} fillOpacity={dimKey(c.nit, customer?.nit)} />)}
            </Bar>
            <Bar dataKey="porVencer" name="Por vencer" stackId="c" fill={colors.facturado} maxBarSize={22} radius={[0, 4, 4, 0]}>
              {customers.map(c => <Cell key={c.nit} fillOpacity={dimKey(c.nit, customer?.nit)} />)}
              <LabelList dataKey="total" position="right" formatter={(v: any) => fmtCompact(Number(v))} style={{ fill: colors.axis, fontSize: 11 }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <DataTable
        mutedCls={mutedCls}
        isInternal={isInternal}
        headers={['Cliente', 'NIT', 'Facturas', 'Vencido', 'Total', 'Mayor mora', 'Participación']}
        rows={customers.map(c => [c.name, c.nit, String(c.facturas), fmtMoney(c.vencido), fmtMoney(c.total), c.maxDias > 0 ? `${c.maxDias} días` : '—', customer ? '—' : pct(c.total, s.total)])}
        select={{ keys: customers.map(c => c.nit), selected: customer?.nit ?? null, onSelect: nit => pickCustomer(customers.find(c => c.nit === nit)!) }}
      />
    </section>
  )

  const vendedorChart = (sellers.length > 1 || seller) && (
    <section className={cardCls}>
      <ChartHeader title="Cartera por vendedor" subtitle="Saldo total de las facturas de cada vendedor · clic en un vendedor para filtrar" titleCls={titleCls} mutedCls={mutedCls} />
      <div style={{ height: Math.max(160, sellers.length * 40) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={sellers} layout="vertical" margin={{ top: 0, right: 72, left: 0, bottom: 0 }} onClick={rowClick(sellers, pickSeller)} style={clickable}>
            <CartesianGrid horizontal={false} stroke={colors.grid} />
            <XAxis type="number" {...axisProps} tickFormatter={fmtCompact} />
            <YAxis type="category" dataKey="name" {...axisProps} width={150} tick={(props: any) => <ServiceTick {...props} fill={colors.axis} />} />
            <Tooltip
              cursor={{ fill: colors.grid }}
              content={<ChartTooltip isDark={isDark} isInternal={isInternal} labelKey="name" rows={[
                { key: 'total', label: 'Total', color: colors.facturado },
                { key: 'vencido', label: 'Vencido' },
              ]} />}
            />
            <Bar dataKey="total" fill={colors.facturado} maxBarSize={24} radius={[0, 4, 4, 0]}>
              {sellers.map(v => <Cell key={v.name} fillOpacity={dimKey(v.name, seller)} />)}
              <LabelList dataKey="total" position="right" formatter={(v: any) => fmtCompact(Number(v))} style={{ fill: colors.axis, fontSize: 11 }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <DataTable
        mutedCls={mutedCls}
        isInternal={isInternal}
        headers={['Vendedor', 'Facturas', 'Vencido', 'Total']}
        rows={sellers.map(v => [v.name, String(v.facturas), fmtMoney(v.vencido), fmtMoney(v.total)])}
        select={{ keys: sellers.map(v => v.name), selected: seller, onSelect: k => pickSeller({ name: k }) }}
      />
    </section>
  )

  const filterChips = <FilterChips filters={chips} onClearAll={clearFilters} mutedCls={mutedCls} />

  // Dashboard del cliente: solo edades, vendedor, evolución y clientes
  if (compact && only) {
    // Solo las gráficas pedidas, sin envoltorio: quien las usa decide la distribución
    const byKey: Record<string, React.ReactNode> = { edades: edadesChart, vendedor: vendedorChart, evolucion: evolucionChart, clientes: clientesChart }
    return <>{only.map(k => <Fragment key={k}>{byKey[k]}</Fragment>)}</>
  }
  if (compact) {
    return (
      <>
        {filterChips}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {edadesChart}
          {vendedorChart}
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {evolucionChart}
          {clientesChart}
        </div>
      </>
    )
  }

  return (
    <>
      {syncBar}

      {filterChips}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label={`Cartera total · ${cut}`} value={fmtCompact(s.total)} title={fmtMoney(s.total)} {...tile} />
        <StatTile label="Cartera vencida" value={fmtCompact(s.vencido)} title={`${fmtMoney(s.vencido)} · ${pct(s.vencido, s.total)} del total`} {...tile} />
        <StatTile label="Mora promedio (ponderada)" value={s.diasPromedioMora ? `${s.diasPromedioMora} días` : '—'} {...tile} />
        <StatTile label="Facturas / clientes con saldo" value={`${s.facturas} / ${s.clientes}`} {...tile} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {edadesChart}
        {evolucionChart}
      </div>

      {clientesChart}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {vendedorChart}

        {(data?.oldest ?? []).length > 0 && (
          <section className={cardCls}>
            <ChartHeader title="Facturas con más días vencidos" subtitle="Las 10 facturas con mayor mora a la fecha de corte" titleCls={titleCls} mutedCls={mutedCls} />
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className={cn('text-left', mutedCls)}>
                    {['Factura', 'Cliente', 'Vencimiento', 'Días', 'Saldo'].map((h, i) => (
                      <th key={h} className={cn('py-1.5 px-2 font-semibold', i > 2 && 'text-right')}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className={cn('divide-y', isInternal ? 'divide-slate-100 text-slate-700' : 'divide-navy-900/5 dark:divide-white/5 text-navy-900 dark:text-cream-100/90')}>
                  {data!.oldest.map(o => (
                    <tr key={o.invoice}>
                      <td className="py-1.5 px-2 font-mono whitespace-nowrap">{o.invoice}</td>
                      <td className="py-1.5 px-2 truncate max-w-[180px]" title={o.customer}>{o.customer}</td>
                      <td className="py-1.5 px-2 whitespace-nowrap">{fmtDay(o.dueDate)}</td>
                      <td className="py-1.5 px-2 text-right font-mono">{o.dias}</td>
                      <td className="py-1.5 px-2 text-right font-mono whitespace-nowrap">{fmtMoney(Number(o.balance))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>

      <p className={cn('text-xs', mutedCls)}>
        Facturas de Siigo con saldo a la fecha de corte. El saldo de cada cliente se limita a su saldo contable en las cuentas
        130505 y 13051001{s.reduccionControl > 0 ? ` (se descontaron ${fmtMoney(s.reduccionControl)} de las facturas más antiguas)` : ''}.
      </p>
    </>
  )
}

// ── CRM (HubSpot) ───────────────────────────────────────────────────────────

export interface CrmReport {
  connection: { id: string; label: string; has_token: boolean } | null
  notConnected: boolean
  isSyncRunning: boolean
  lastSync: { started_at: string; status: string; deals_count: number; error_message?: string | null } | null
  summary: { deals: number; amount: number; enviadas: number; ganadas: number; valorGanado: number } | null
  byStage: { stage: string; order: number; kind: string; owner: string; amount: number; deals: number }[]
  monthly: { period: string; enviadas: number; ganadas: number }[]
}

/** El HubSpot sale de los libros elegidos (connectionId); companyId del selector es un tercero de esos libros */
function crmParamsOf(params: Record<string, string>) {
  const out: Record<string, string> = {}
  for (const k of ['connectionId', 'startDate', 'endDate']) if (params[k]) out[k] = params[k]!
  return out
}

/** Informe de CRM (HubSpot): lo comparten las gráficas de CRM y el dashboard de negocios */
export function useCrmReport(params: Record<string, string>) {
  const crmParams = crmParamsOf(params)
  return useQuery<CrmReport>({
    queryKey: ['hubspot-report', crmParams],
    queryFn: async () => (await api.get('/api/hubspot/report', { params: crmParams })).data,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
    refetchInterval: q => (q.state.data?.isSyncRunning ? 10_000 : false),
  })
}

/** Informe de cartera sin filtros por clic (misma consulta, en caché, que la pestaña Cartera) */
export function useReceivablesReport(params: Record<string, string>) {
  return useQuery<ReceivablesReport>({
    queryKey: ['siigo-receivables-report', params],
    queryFn: async () => (await api.get('/api/siigo/receivables/report', { params })).data,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  })
}

/** Colores categóricos por socio (máx. 6; el resto se agrupa en "Otros", en gris) */
const CRM_COLORS = {
  light: ['#3d6bc1', '#a87d1e', '#5b3a8c', '#2f8f83', '#c4572e', '#7a8699'],
  dark:  ['#5c86d0', '#b98d2a', '#9a7bd0', '#4fb3a6', '#e07a52', '#9aa5b5'],
}
const MAX_OWNERS = 5

const fmtPct = (n: number) => `${Math.round(n)} %`
const fmtCount = (n: number) => String(Math.round(n))

/** Suma un número de meses a un periodo YYYY-MM */
function addMonths(ym: string, n: number) {
  const [y, m] = ym.split('-').map(Number) as [number, number]
  const d = new Date(y, m - 1 + n, 1)
  return toYm(d)
}

/**
 * CRM: negocios de HubSpot de la empresa (o de los libros elegidos, para internos).
 * - Valor de propuestas por etapa y socio.
 * - Conversión de propuestas enviadas a ganadas por mes de cierre, en ventana móvil de 3 meses.
 */
export function CrmCharts({ params, style, scopeName }: ChartProps) {
  const { colors, isDark, isInternal, cardCls, titleCls, mutedCls } = style
  const role = useAuthStore(s => s.user?.role ?? '')
  const canSync = SYNC_ROLES.includes(role)
  const qc = useQueryClient()
  const startWatching = useSiigoSyncStore(s => s.start)

  const crmParams = crmParamsOf(params)
  const { data, isLoading } = useCrmReport(params)

  const syncMut = useMutation({
    mutationFn: async () => (await api.post('/api/hubspot/sync', { connectionId: crmParams.connectionId })).data,
    onSuccess: (res) => {
      startWatching('hubspot', res.connectionId, res.label ?? 'HubSpot')
      toast.info('Sincronización de HubSpot iniciada en segundo plano. Te avisaremos cuando termine.')
      qc.invalidateQueries({ queryKey: ['hubspot-report'] })
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'No se pudo iniciar la sincronización de HubSpot'),
  })

  const palette = isDark ? CRM_COLORS.dark : CRM_COLORS.light

  // Valor por etapa con una serie por socio (los 5 de mayor valor; el resto en "Otros")
  const { stages, owners } = useMemo(() => {
    const rows = data?.byStage ?? []
    const byOwner = new Map<string, number>()
    for (const r of rows) byOwner.set(r.owner, (byOwner.get(r.owner) ?? 0) + Number(r.amount))
    const ranked = [...byOwner].sort((a, b) => b[1] - a[1]).map(([o]) => o)
    const top = new Set(ranked.slice(0, MAX_OWNERS))
    const ownerList = [...ranked.slice(0, MAX_OWNERS), ...(ranked.length > MAX_OWNERS ? ['Otros'] : [])]

    const map = new Map<string, Record<string, any>>()
    for (const r of rows) {
      const s = map.get(r.stage) ?? { name: r.stage, total: 0, deals: 0 }
      const key = top.has(r.owner) ? r.owner : 'Otros'
      s[key] = Number(s[key] ?? 0) + Number(r.amount)
      s.total += Number(r.amount)
      s.deals += Number(r.deals)
      map.set(r.stage, s)
    }
    return { stages: [...map.values()].sort((a, b) => b.total - a.total), owners: ownerList }
  }, [data?.byStage])

  // Conversión por mes de cierre: ganadas / enviadas de los últimos 3 meses
  const conversion = useMemo(() => {
    const rows = data?.monthly ?? []
    if (!rows.length) return []
    const byPeriod = new Map(rows.map(r => [r.period, r]))
    const out: { period: string; label: string; enviadas: number; ganadas: number; conversion: number | null }[] = []
    let p = rows[0]!.period
    const end = rows[rows.length - 1]!.period
    for (let i = 0; i < 240 && p <= end; i++, p = addMonths(p, 1)) {
      let enviadas = 0, ganadas = 0
      for (let k = 0; k < 3; k++) {
        const r = byPeriod.get(addMonths(p, -k))
        enviadas += Number(r?.enviadas ?? 0)
        ganadas += Number(r?.ganadas ?? 0)
      }
      out.push({ period: p, label: fmtPeriod(p), enviadas, ganadas, conversion: enviadas ? (ganadas / enviadas) * 100 : null })
    }
    return out
  }, [data?.monthly])

  if (isLoading) return <PageLoader />

  const last = data?.lastSync
  const syncBar = canSync && !data?.notConnected && (
    <div className={cn(cardCls, 'flex flex-wrap items-center justify-between gap-3 py-3')}>
      <p className={cn('text-xs', mutedCls)}>
        {last
          ? `HubSpot${data?.connection ? ` de ${data.connection.label}` : ''} · ${last.status === 'completed' ? `${last.deals_count} negocios` : 'último intento fallido'} · ${new Date(last.started_at).toLocaleString('es-CO')}`
          : 'Los negocios de HubSpot aún no se han sincronizado.'}
        {last?.status === 'failed' && <span className="block text-red-600">{last.error_message}</span>}
      </p>
      <button
        onClick={() => syncMut.mutate()}
        disabled={data?.isSyncRunning || syncMut.isPending}
        className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-60"
      >
        {data?.isSyncRunning || syncMut.isPending ? 'Sincronizando…' : 'Actualizar desde HubSpot'}
      </button>
    </div>
  )

  if (data?.notConnected) {
    return (
      <div className={cn(cardCls, 'py-12 text-center space-y-2')}>
        <BarChart3 className={cn('w-10 h-10 mx-auto', mutedCls)} />
        <p className={cn('font-semibold', titleCls)}>HubSpot no está conectado</p>
        <p className={cn('text-xs', mutedCls)}>
          {isInternal
            ? 'Conecta el HubSpot de esta empresa en Empresas → Siigo (token de private app).'
            : 'Tu empresa aún no tiene HubSpot conectado. Pídeselo a tu asesor de Finto.'}
        </p>
      </div>
    )
  }

  if (!stages.length) {
    return (
      <>
        {syncBar}
        <div className={cn(cardCls, 'py-12 text-center space-y-2')}>
          <BarChart3 className={cn('w-10 h-10 mx-auto', mutedCls)} />
          <p className={cn('font-semibold', titleCls)}>No hay negocios de HubSpot en el periodo seleccionado</p>
          <p className={cn('text-xs', mutedCls)}>Prueba con otro periodo o con «Todo».</p>
        </div>
      </>
    )
  }

  const axisProps = { tick: { fill: colors.axis, fontSize: 11 }, tickLine: false, axisLine: false }
  const ownerColor = (o: string, i: number) => (o === 'Otros' ? palette[5]! : palette[i % 5]!)

  return (
    <>
      {syncBar}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-start">
        <section className={cardCls}>
          <ChartHeader
            title="Valor de propuestas por etapa y socio"
            subtitle={`${scopeName} · suma del valor de los negocios por etapa (fecha de cierre en el periodo)`}
            titleCls={titleCls}
            mutedCls={mutedCls}
          />
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stages} margin={{ top: 20, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={colors.grid} />
                <XAxis dataKey="name" {...axisProps} interval={0} tick={(props: any) => <ServiceTick {...props} fill={colors.axis} />} height={40} />
                <YAxis {...axisProps} tickFormatter={fmtCompact} width={64} />
                <Tooltip
                  cursor={{ fill: colors.grid }}
                  content={<ChartTooltip isDark={isDark} isInternal={isInternal} labelKey="name" rows={[
                    ...owners.map((o, i) => ({ key: o, label: o, color: ownerColor(o, i) })),
                    { key: 'total', label: 'Total' },
                    { key: 'deals', label: 'Negocios', fmt: fmtCount },
                  ]} />}
                />
                <Legend
                  verticalAlign="bottom"
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                  formatter={(value: string) => <span style={{ color: colors.axis }}>{value}</span>}
                />
                {owners.map((o, i) => (
                  <Bar key={o} dataKey={o} name={o} stackId="s" fill={ownerColor(o, i)} maxBarSize={56}
                    radius={i === owners.length - 1 ? [4, 4, 0, 0] : undefined}>
                    {i === owners.length - 1 && (
                      <LabelList dataKey="total" position="top" formatter={(v: any) => fmtCompact(Number(v))} style={{ fill: colors.axis, fontSize: 11 }} />
                    )}
                  </Bar>
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
          <DataTable
            mutedCls={mutedCls}
            isInternal={isInternal}
            headers={['Etapa', 'Negocios', ...owners, 'Total']}
            rows={stages.map(s => [s.name, String(s.deals), ...owners.map(o => fmtMoney(Number(s[o] ?? 0))), fmtMoney(s.total)])}
          />
        </section>

        <section className={cardCls}>
          <ChartHeader
            title="Conversión de propuestas enviadas y ganadas"
            subtitle="Ganadas / enviadas por mes de cierre, acumulando los últimos 3 meses (trimestre móvil)"
            titleCls={titleCls}
            mutedCls={mutedCls}
          />
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={conversion} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={colors.grid} />
                <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={16} />
                <YAxis {...axisProps} domain={[0, 100]} tickFormatter={fmtPct} width={48} />
                <Tooltip
                  cursor={{ stroke: colors.axis, strokeOpacity: 0.4 }}
                  content={<ChartTooltip isDark={isDark} isInternal={isInternal} rows={[
                    { key: 'conversion', label: 'Conversión', color: colors.facturado, fmt: fmtPct },
                    { key: 'ganadas', label: 'Ganadas (3 meses)', fmt: fmtCount },
                    { key: 'enviadas', label: 'Enviadas (3 meses)', fmt: fmtCount },
                  ]} />}
                />
                <Line type="linear" dataKey="conversion" stroke={colors.facturado} strokeWidth={2} dot={conversion.length < 3 ? { r: 4 } : false} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <DataTable
            mutedCls={mutedCls}
            isInternal={isInternal}
            headers={['Mes', 'Enviadas (3 meses)', 'Ganadas (3 meses)', 'Conversión']}
            rows={conversion.map(c => [c.label, String(c.enviadas), String(c.ganadas), c.conversion === null ? '—' : fmtPct(c.conversion)])}
          />
        </section>
      </div>
    </>
  )
}

const MAX_CUSTOMERS = 10

/** Comercial: principales clientes por facturación neta, participación y concentración */
export function ComercialCharts({ params, style, scopeName, month = null }: ChartProps) {
  const { colors, isDark, isInternal, cardCls, titleCls, mutedCls } = style
  // Comercial no tiene serie mensual: si hay mes seleccionado (desde otra pestaña), se acota a ese mes
  const { data, isLoading } = useSalesReport(monthParams(params, month), true)
  const mn = monthNote(month)

  const customers = useMemo(
    () => [...(data?.byCustomer ?? [])].sort((a, b) => Number(b.total) - Number(a.total)),
    [data?.byCustomer],
  )
  const top = useMemo(() => {
    const rows = customers.slice(0, MAX_CUSTOMERS).map(c => ({ name: c.name, total: Number(c.total) }))
    const rest = customers.slice(MAX_CUSTOMERS)
    if (rest.length) rows.push({ name: `Otros (${rest.length})`, total: rest.reduce((s, c) => s + Number(c.total), 0) })
    return rows
  }, [customers])

  if (isLoading) return <PageLoader />
  if (!customers.length) {
    return (
      <div className={cn(cardCls, 'py-16 text-center space-y-2')}>
        <BarChart3 className={cn('w-10 h-10 mx-auto', mutedCls)} />
        <p className={cn('font-semibold', titleCls)}>No hay ventas en el periodo seleccionado</p>
        <p className={cn('text-xs', mutedCls)}>Prueba con otro periodo o con «Todo».</p>
      </div>
    )
  }

  const axisProps = { tick: { fill: colors.axis, fontSize: 11 }, tickLine: false, axisLine: false }
  const tile = { cardCls, titleCls, mutedCls }
  const totalNeto = Number(data?.summary.totalNeto ?? 0)
  const facturas = Number(data?.summary.totalFacturas ?? 0)
  const principal = customers[0]!
  const top5 = customers.slice(0, 5).reduce((s, c) => s + Number(c.total), 0)

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label={`Clientes facturados${mn}`} value={String(customers.length)} {...tile} />
        <StatTile label={`Ticket promedio por factura${mn}`} value={facturas ? fmtCompact(totalNeto / facturas) : '—'} title={facturas ? fmtMoney(totalNeto / facturas) : undefined} {...tile} />
        <StatTile label={`Cliente principal${mn}`} value={pct(Number(principal.total), totalNeto)} title={`${principal.name} · ${fmtMoney(Number(principal.total))}`} {...tile} />
        <StatTile label={`Concentración en 5 mayores${mn}`} value={pct(top5, totalNeto)} {...tile} />
      </div>

      <section className={cardCls}>
        <ChartHeader
          title={`Principales clientes${mn}`}
          subtitle={`${scopeName} · total neto facturado por cliente ${month ? 'en el mes' : 'en el periodo'}${customers.length > MAX_CUSTOMERS ? ` · top ${MAX_CUSTOMERS}` : ''}`}
          titleCls={titleCls}
          mutedCls={mutedCls}
        />
        <div style={{ height: Math.max(200, top.length * 40) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={top} layout="vertical" margin={{ top: 0, right: 72, left: 0, bottom: 0 }}>
              <CartesianGrid horizontal={false} stroke={colors.grid} />
              <XAxis type="number" {...axisProps} tickFormatter={fmtCompact} />
              <YAxis type="category" dataKey="name" {...axisProps} width={190} tick={(props: any) => <ServiceTick {...props} fill={colors.axis} />} />
              <Tooltip
                cursor={{ fill: colors.grid }}
                content={<ChartTooltip isDark={isDark} isInternal={isInternal} labelKey="name" rows={[
                  { key: 'total', label: 'Total neto', color: colors.facturado },
                ]} />}
              />
              <Bar dataKey="total" fill={colors.facturado} maxBarSize={24} radius={[0, 4, 4, 0]}>
                <LabelList dataKey="total" position="right" formatter={(v: any) => fmtCompact(Number(v))} style={{ fill: colors.axis, fontSize: 11 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <DataTable
          mutedCls={mutedCls}
          isInternal={isInternal}
          headers={['Cliente', 'NIT', 'Facturas', 'Notas crédito', 'Total neto', 'Participación']}
          rows={customers.map(c => [c.name, c.nit, String(c.facturas), String(c.notasCredito), fmtMoney(Number(c.total)), pct(Number(c.total), totalNeto)])}
        />
      </section>
    </>
  )
}

/** Etiqueta de servicio en una sola línea, recortada, con el nombre completo al pasar el mouse */
function ServiceTick({ x, y, payload, fill }: { x: number; y: number; payload: { value: string }; fill: string }) {
  const value = String(payload?.value ?? '')
  const short = value.length > 24 ? `${value.slice(0, 23)}…` : value
  return (
    <text x={x} y={y} dy={4} textAnchor="end" fill={fill} fontSize={11}>
      <title>{value}</title>
      {short}
    </text>
  )
}

function ChartHeader({ title, subtitle, titleCls, mutedCls }: { title: string; subtitle: string; titleCls: string; mutedCls: string }) {
  return (
    <div className="mb-3">
      <h3 className={cn('text-sm font-bold', titleCls)}>{title}</h3>
      <p className={cn('text-xs mt-0.5', mutedCls)}>{subtitle}</p>
    </div>
  )
}

function StatTile({ label, value, title, cardCls, titleCls, mutedCls }: {
  label: string
  value: string
  title?: string
  cardCls: string
  titleCls: string
  mutedCls: string
}) {
  return (
    <div className={cardCls} title={title}>
      <p className={cn('text-xs font-medium', mutedCls)}>{label}</p>
      <p className={cn('text-2xl font-semibold mt-1 truncate', titleCls)}>{value}</p>
    </div>
  )
}

/** fmt: formato del valor (por defecto, dinero) */
type TooltipRow = { key: string; label: string; color?: string; fmt?: (n: number) => string }

/** Tooltip con tokens de texto; el color de serie solo va en la marca junto a la etiqueta */
export function ChartTooltip({ active, payload, label, rows, labelKey, isDark, isInternal }: {
  active?: boolean
  payload?: any[]
  label?: string
  rows: TooltipRow[]
  labelKey?: string
  isDark: boolean
  isInternal: boolean
}) {
  if (!active || !payload?.length) return null
  const datum = payload[0]?.payload ?? {}
  return (
    <div className={cn(
      'rounded-xl px-3 py-2 text-xs shadow-lg ring-1 min-w-[180px]',
      isDark ? 'bg-navy-800 ring-white/10 text-cream-100' : 'bg-white ring-slate-200 text-slate-700',
    )}>
      <p className={cn('font-semibold mb-1', isDark ? 'text-cream-100' : (isInternal ? 'text-slate-900' : 'text-navy-900'))}>
        {labelKey ? datum[labelKey] : label}
      </p>
      {rows.map(r => (
        <div key={r.key} className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-1.5">
            {r.color
              ? <span className="w-2 h-2 rounded-full" style={{ background: r.color }} />
              : <span className="w-2" />}
            {r.label}
          </span>
          <span className="font-mono">{(r.fmt ?? fmtMoney)(Number(datum[r.key] ?? 0))}</span>
        </div>
      ))}
    </div>
  )
}

/** Filas seleccionables de una tabla: `keys[i]` identifica la fila i */
interface TableSelect {
  keys: string[]
  selected: string | null
  onSelect: (key: string) => void
}

/** Vista de tabla de cada gráfica (accesibilidad y valores exactos); con `select` las filas filtran por clic */
function DataTable({ headers, rows, mutedCls, isInternal, select }: {
  headers: string[]
  rows: string[][]
  mutedCls: string
  isInternal: boolean
  select?: TableSelect
}) {
  const selectedCls = isInternal ? 'bg-primary-50 text-primary-800 font-semibold' : 'bg-primary-600/10 font-semibold'
  const hoverCls = isInternal ? 'hover:bg-slate-50' : 'hover:bg-navy-900/5 dark:hover:bg-white/5'
  return (
    <details className="mt-3">
      <summary className={cn('text-xs font-semibold cursor-pointer select-none', mutedCls)}>Ver datos en tabla</summary>
      <div className="mt-2 max-h-64 overflow-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className={cn('text-left', mutedCls)}>
              {headers.map((h, i) => (
                <th key={h} className={cn('py-1.5 px-2 font-semibold', i > 0 && 'text-right')}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className={cn(
            'divide-y',
            isInternal ? 'divide-slate-100 text-slate-700' : 'divide-navy-900/5 dark:divide-white/5 text-navy-900 dark:text-cream-100/90',
          )}>
            {rows.map((r, i) => {
              const key = select?.keys[i]
              return (
              <tr
                key={i}
                onClick={select && key ? () => select.onSelect(key) : undefined}
                aria-selected={select ? key === select.selected : undefined}
                className={cn(select && 'cursor-pointer', select && (key === select.selected ? selectedCls : hoverCls))}
              >
                {r.map((cell, j) => (
                  <td key={j} className={cn('py-1.5 px-2', j > 0 && 'text-right font-mono whitespace-nowrap')}>{cell}</td>
                ))}
              </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </details>
  )
}
