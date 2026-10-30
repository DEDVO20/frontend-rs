import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { BarChart3 } from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { TopBar } from '@/components/layout/TopBar'
import { PortalTopBar } from '@/components/layout/PortalTopBar'
import { PageLoader } from '@/components/ui/Spinner'
import { useAuthStore } from '@/stores/authStore'
import { useThemeStore } from '@/stores/themeStore'
import { SiigoBooksSelect, SiigoNotConnected, useSiigoBooks, type SiigoBooksInfo } from './siigoBooks'

const INTERNAL_ROLES = ['admin', 'rs_admin', 'rs_staff', 'contador']
const MAX_SERVICES = 8

interface MonthlyRow {
  period: string
  facturas: number
  notasCredito: number
  bruto: number
  total: number
  totalFacturado: number
  totalNotasCredito: number
}

interface ProductRow {
  code: string
  description: string
  bruto: number
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
    totalNeto: number
  }
  monthly: MonthlyRow[]
  byProduct: ProductRow[]
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
  lastSync: { started_at: string; end_date: string; status: string } | null
}

type ViewTab = 'facturacion' | 'recaudo' | 'balance'

interface BalanceMonthly {
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

interface BalanceReport {
  scope: 'global' | 'company'
  latestPeriod: string | null
  monthly: BalanceMonthly[]
  byAccount: { code: string; name: string; debit: number; credit: number; finalBalance: number }[]
  topCartera: { nit: string; name: string; companyId: string | null; saldo: number }[]
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
      period: ym, facturas: 0, notasCredito: 0, bruto: 0, total: 0, totalFacturado: 0, totalNotasCredito: 0,
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

export function SiigoChartsPage() {
  const { user } = useAuthStore()
  const theme = useThemeStore(s => s.theme)
  const isInternal = INTERNAL_ROLES.includes(user?.role ?? '')
  // La app interna siempre es clara (AppLayout fuerza data-theme="light")
  const isDark = !isInternal && theme === 'dark'
  const colors = isDark ? PALETTE.dark : PALETTE.light

  const [tab, setTab] = useState<ViewTab>('facturacion')
  const [preset, setPreset] = useState<Preset>('12m')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [companyId, setCompanyId] = useState('')

  // Libros: los internos eligen la cuenta de Siigo; los clientes ven siempre la de su empresa
  const { booksParam, selected: selectedBooks } = useSiigoBooks()

  const range = presetRange(preset, customFrom, customTo)
  const params = {
    ...booksParam,
    ...(range.from ? { startDate: `${range.from}-01` } : {}),
    ...(range.to ? { endDate: lastDayOfMonth(range.to) } : {}),
    ...(isInternal && companyId ? { companyId } : {}),
  }

  const { data: companiesRes } = useQuery({
    queryKey: ['companies-siigo-selector'],
    queryFn: async () => (await api.get('/api/companies?limit=100')).data,
    enabled: isInternal,
    staleTime: 120_000,
  })
  const companies: any[] = Array.isArray(companiesRes) ? companiesRes : (companiesRes?.data ?? [])

  const { data, isLoading } = useQuery<SiigoReport>({
    queryKey: ['siigo-report', params],
    queryFn: async () => (await api.get('/api/siigo/report', { params })).data,
    staleTime: 30_000,
  })

  const monthly = useMemo(
    () => fillMonths(data?.monthly ?? [], range.from, range.to).map(m => ({
      ...m,
      label: fmtPeriod(m.period),
      bruto: Number(m.bruto),
      total: Number(m.total),
      totalFacturado: Number(m.totalFacturado),
      totalNotasCredito: Number(m.totalNotasCredito),
    })),
    [data?.monthly, range.from, range.to],
  )
  const services = useMemo(() => topServices(data?.byProduct ?? []), [data?.byProduct])

  const summary = data?.summary
  const hasData = (data?.monthly?.length ?? 0) > 0
  const year = new Date().getFullYear()
  const booksLabel = data?.books?.label ?? selectedBooks?.label ?? 'Finto'
  const scopeName = isInternal
    ? (data?.clientCompany ? `${booksLabel} · cliente ${data.clientCompany.name}` : booksLabel)
    : (data?.clientCompany?.name ?? 'Mi empresa')

  const cardCls = isInternal
    ? 'bg-white border border-slate-200 rounded-2xl p-5'
    : 'rounded-2xl bg-cream-100 dark:bg-navy-900 ring-1 ring-navy-900/5 dark:ring-white/5 p-5'
  const titleCls = isInternal ? 'text-slate-900' : 'text-navy-900 dark:text-cream-100 font-display'
  const mutedCls = isInternal ? 'text-slate-500' : 'text-navy-900/55 dark:text-cream-100/55'

  const axisProps = {
    tick: { fill: colors.axis, fontSize: 11 },
    tickLine: false,
    axisLine: false,
  }

  const chipCls = (active: boolean) => cn(
    'px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors',
    active
      ? 'bg-primary-600 text-white border-primary-600'
      : isInternal
        ? 'border-slate-200 text-slate-600 hover:bg-slate-50'
        : 'border-navy-900/10 text-navy-900/70 hover:bg-navy-900/5 dark:border-white/10 dark:text-cream-100/80 dark:hover:bg-white/5',
  )
  const inputCls = cn(
    'px-2.5 py-1.5 text-xs rounded-xl border focus:outline-none focus:ring-2 focus:ring-primary-500',
    isInternal
      ? 'border-slate-200 bg-white text-slate-700'
      : 'border-navy-900/10 bg-white text-navy-900 dark:border-white/10 dark:bg-navy-800 dark:text-cream-100',
  )

  return (
    // Vista interna siempre clara (el contador navega dentro del layout del portal, que puede estar en oscuro)
    <div
      className="flex flex-col h-full overflow-hidden"
      {...(isInternal ? { 'data-theme': 'light', style: { colorScheme: 'light' } } : {})}
    >
      {isInternal ? (
        <TopBar title="Gráficas de facturación" subtitle="Facturación, recaudo y balance de prueba mes a mes (Siigo)" />
      ) : (
        <PortalTopBar
          title="Gráficas de facturación"
          subtitle="La facturación, el recaudo y el balance de tu empresa en el tiempo"
          companyName={data?.clientCompany?.name ?? 'Mi Empresa'}
        />
      )}

      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5">
        {/* Filtros: una sola fila sobre las gráficas */}
        <div className={cn(cardCls, 'flex flex-wrap items-center gap-2 py-3')}>
          <span className={cn('text-xs font-bold uppercase tracking-wider mr-1', mutedCls)}>Periodo</span>
          <button className={chipCls(preset === '12m')} onClick={() => setPreset('12m')}>Últimos 12 meses</button>
          <button className={chipCls(preset === 'year-current')} onClick={() => setPreset('year-current')}>Año {year}</button>
          <button className={chipCls(preset === 'year-previous')} onClick={() => setPreset('year-previous')}>Año {year - 1}</button>
          <button className={chipCls(preset === 'all')} onClick={() => setPreset('all')}>Todo</button>
          <button className={chipCls(preset === 'custom')} onClick={() => setPreset('custom')}>Personalizado</button>
          {preset === 'custom' && (
            <div className="flex items-center gap-1.5">
              <input
                type="month"
                aria-label="Mes desde"
                value={customFrom}
                max={customTo || undefined}
                onChange={e => setCustomFrom(e.target.value)}
                className={inputCls}
              />
              <span className={cn('text-xs', mutedCls)}>a</span>
              <input
                type="month"
                aria-label="Mes hasta"
                value={customTo}
                min={customFrom || undefined}
                onChange={e => setCustomTo(e.target.value)}
                className={inputCls}
              />
            </div>
          )}
          {isInternal && (
            <div className="ml-auto flex flex-wrap items-center gap-3">
              <SiigoBooksSelect />
              <select
                value={companyId}
                onChange={e => setCompanyId(e.target.value)}
                aria-label="Cliente dentro de los libros"
                className={cn(inputCls, 'min-w-[200px]')}
              >
                <option value="">Todos los clientes</option>
                {companies.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {data?.notConnected ? <SiigoNotConnected /> : (<>

        {/* Pestañas */}
        <div className={cn('flex items-center gap-2 border-b pb-1', isInternal ? 'border-slate-200' : 'border-navy-900/10 dark:border-white/10')}>
          {([
            { id: 'facturacion', label: 'Facturación' },
            { id: 'recaudo', label: 'Recaudo' },
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

        {tab === 'balance' ? (
          <BalanceCharts
            params={params}
            range={range}
            colors={colors}
            isDark={isDark}
            isInternal={isInternal}
            scopeName={scopeName}
            cardCls={cardCls}
            titleCls={titleCls}
            mutedCls={mutedCls}
          />
        ) : tab === 'recaudo' ? (
          <RecaudoCharts
            params={params}
            range={range}
            salesMonthly={monthly}
            colors={colors}
            isDark={isDark}
            isInternal={isInternal}
            scopeName={scopeName}
            cardCls={cardCls}
            titleCls={titleCls}
            mutedCls={mutedCls}
          />
        ) : isLoading ? (
          <PageLoader />
        ) : !hasData ? (
          <div className={cn(cardCls, 'py-16 text-center space-y-2')}>
            <BarChart3 className={cn('w-10 h-10 mx-auto', mutedCls)} />
            <p className={cn('font-semibold', titleCls)}>No hay facturación en el periodo seleccionado</p>
            <p className={cn('text-xs', mutedCls)}>Prueba con otro periodo o con «Todo».</p>
          </div>
        ) : (
          <>
            {/* Cifras del periodo */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatTile label="Valor bruto facturado" value={fmtCompact(summary?.totalBruto ?? 0)} title={fmtMoney(summary?.totalBruto ?? 0)} cardCls={cardCls} titleCls={titleCls} mutedCls={mutedCls} />
              <StatTile label="Total neto" value={fmtCompact(summary?.totalNeto ?? 0)} title={fmtMoney(summary?.totalNeto ?? 0)} cardCls={cardCls} titleCls={titleCls} mutedCls={mutedCls} />
              <StatTile label="Facturas emitidas" value={String(summary?.totalFacturas ?? 0)} cardCls={cardCls} titleCls={titleCls} mutedCls={mutedCls} />
              <StatTile label="Notas crédito" value={String(summary?.totalNotasCredito ?? 0)} cardCls={cardCls} titleCls={titleCls} mutedCls={mutedCls} />
            </div>

            {/* 1. Facturación del cliente */}
            <section className={cardCls}>
              <ChartHeader
                title="Facturación del cliente"
                subtitle={`${scopeName} · facturas y notas crédito por mes (total con impuestos)`}
                titleCls={titleCls}
                mutedCls={mutedCls}
              />
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthly} stackOffset="sign" margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke={colors.grid} />
                    <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={12} />
                    <YAxis {...axisProps} tickFormatter={fmtCompact} width={64} />
                    <ReferenceLine y={0} stroke={colors.axis} strokeOpacity={0.4} />
                    <Tooltip
                      cursor={{ fill: colors.grid }}
                      content={<ChartTooltip isDark={isDark} isInternal={isInternal} rows={[
                        { key: 'totalFacturado', label: 'Facturado', color: colors.facturado },
                        { key: 'totalNotasCredito', label: 'Notas crédito', color: colors.notas },
                        { key: 'total', label: 'Neto' },
                      ]} />}
                    />
                    <Legend
                      verticalAlign="top"
                      align="right"
                      iconType="circle"
                      iconSize={8}
                      wrapperStyle={{ fontSize: 12, paddingBottom: 8 }}
                      // El texto de la leyenda usa tokens de texto; el color de serie va solo en el punto
                      formatter={(value: string) => <span style={{ color: colors.axis }}>{value}</span>}
                    />
                    <Bar dataKey="totalFacturado" name="Facturado" stackId="v" fill={colors.facturado} maxBarSize={24} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="totalNotasCredito" name="Notas crédito" stackId="v" fill={colors.notas} maxBarSize={24} radius={[0, 0, 4, 4]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <DataTable
                mutedCls={mutedCls}
                isInternal={isInternal}
                headers={['Mes', 'Facturas', 'Facturado', 'Notas crédito', 'Neto']}
                rows={monthly.map(m => [m.label, String(m.facturas), fmtMoney(m.totalFacturado), fmtMoney(m.totalNotasCredito), fmtMoney(m.total)])}
              />
            </section>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
              {/* 2. Facturación por servicio */}
              <section className={cardCls}>
                <ChartHeader
                  title="Facturación por servicio"
                  subtitle={`Total neto por servicio en el periodo${services.length > MAX_SERVICES ? ` · top ${MAX_SERVICES}` : ''}`}
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
                  headers={['Servicio', 'Valor bruto', 'Total neto']}
                  rows={(data?.byProduct ?? []).map(p => [p.description, fmtMoney(Number(p.bruto)), fmtMoney(Number(p.total))])}
                />
              </section>

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
                    <AreaChart data={monthly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke={colors.grid} />
                      <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={12} />
                      <YAxis {...axisProps} tickFormatter={fmtCompact} width={64} />
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
                />
              </section>
            </div>
          </>
        )}
        </>)}
      </div>
    </div>
  )
}

/** Pestaña Recaudo: recibos de caja aplicados (Siigo vouchers RC) */
function RecaudoCharts({ params, range, salesMonthly, colors, isDark, isInternal, scopeName, cardCls, titleCls, mutedCls }: {
  params: Record<string, string>
  range: { from: string | null; to: string | null }
  salesMonthly: { period: string; label: string; total: number }[]
  colors: Palette
  isDark: boolean
  isInternal: boolean
  scopeName: string
  cardCls: string
  titleCls: string
  mutedCls: string
}) {
  const { data, isLoading } = useQuery<CollectionsReport>({
    queryKey: ['siigo-collections-report', params],
    queryFn: async () => (await api.get('/api/siigo/collections/report', { params })).data,
    staleTime: 30_000,
  })

  // Facturado (neto) y recaudado alineados por mes; meses sin movimiento en cero
  const monthly = useMemo(() => {
    const recaudo = new Map((data?.monthly ?? []).map(m => [m.period, m]))
    const sales = new Map(salesMonthly.map(m => [m.period, m]))
    const periods = Array.from(new Set([...recaudo.keys(), ...sales.keys()])).sort()
    const from = range.from ?? periods[0]
    const to = range.to ?? periods[periods.length - 1]
    const filled = fillMonths(
      periods.map(p => ({ period: p, facturas: 0, notasCredito: 0, bruto: 0, total: 0, totalFacturado: 0, totalNotasCredito: 0 })),
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
    () => topServices((data?.byProduct ?? []).map(p => ({ code: '', description: p.description, bruto: 0, total: Number(p.recaudado) }))),
    [data?.byProduct],
  )

  if (isLoading) return <PageLoader />

  const s = data?.summary
  if (!s || s.movimientos === 0) {
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

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="Total recaudado" value={fmtCompact(s.totalRecaudado)} title={fmtMoney(s.totalRecaudado)} {...tile} />
        <StatTile label="Recibos de caja" value={String(s.recibos)} {...tile} />
        <StatTile label="Facturas pagadas" value={String(s.facturas)} {...tile} />
        <StatTile label="Anticipos y otros ingresos" value={fmtCompact(s.anticipos)} title={fmtMoney(s.anticipos)} {...tile} />
      </div>

      {/* Facturado vs recaudado: misma unidad, un solo eje */}
      <section className={cardCls}>
        <ChartHeader
          title="Facturado vs recaudado"
          subtitle={`${scopeName} · total neto facturado y valor recaudado por mes`}
          titleCls={titleCls}
          mutedCls={mutedCls}
        />
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthly} barGap={2} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
              <Bar dataKey="facturado" name="Facturado" fill={colors.facturado} maxBarSize={20} radius={[4, 4, 0, 0]} />
              <Bar dataKey="recaudado" name="Recaudado" fill={colors.recaudo} maxBarSize={20} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <DataTable
          mutedCls={mutedCls}
          isInternal={isInternal}
          headers={['Mes', 'Facturado', 'Recaudado', 'Recibos']}
          rows={monthly.map(m => [m.label, fmtMoney(m.facturado), fmtMoney(m.recaudado), String(m.recibos)])}
        />
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <section className={cardCls}>
          <ChartHeader title="Recaudo mes a mes" subtitle="Valor aplicado de los recibos de caja" titleCls={titleCls} mutedCls={mutedCls} />
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={colors.grid} />
                <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={12} />
                <YAxis {...axisProps} tickFormatter={fmtCompact} width={64} />
                <Tooltip
                  cursor={{ fill: colors.grid }}
                  content={<ChartTooltip isDark={isDark} isInternal={isInternal} rows={[
                    { key: 'recaudado', label: 'Recaudado', color: colors.recaudo },
                  ]} />}
                />
                <Bar dataKey="recaudado" fill={colors.recaudo} maxBarSize={24} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className={cardCls}>
          <ChartHeader
            title="Recaudo por servicio"
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
            rows={(data?.byProduct ?? []).map(p => [p.description, fmtMoney(Number(p.recaudado)), String(p.movimientos)])}
          />
        </section>
      </div>

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
function BalanceCharts({ params, range, colors, isDark, isInternal, scopeName, cardCls, titleCls, mutedCls }: {
  params: Record<string, string>
  range: { from: string | null; to: string | null }
  colors: Palette
  isDark: boolean
  isInternal: boolean
  scopeName: string
  cardCls: string
  titleCls: string
  mutedCls: string
}) {
  const { data, isLoading } = useQuery<BalanceReport>({
    queryKey: ['siigo-trial-balance-report', params],
    queryFn: async () => (await api.get('/api/siigo/trial-balance/report', { params })).data,
    staleTime: 30_000,
  })

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
  const last = monthly[monthly.length - 1]!
  const lastLabel = fmtPeriod(last.period)
  const sum = (k: 'ingresos' | 'gastosCostos' | 'utilidad' | 'debito' | 'credito') => monthly.reduce((s, m) => s + m[k], 0)
  const rangeNote = range.from || range.to ? '' : ' · todos los meses importados'
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
    const accounts = (data.byAccount ?? []).map(a => ({ name: `${a.code} · ${a.name}`, total: Number(a.finalBalance) }))
    return (
      <>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatTile label={isInternal ? `Saldo de cartera · ${lastLabel}` : `Saldo por pagar · ${lastLabel}`} value={fmtCompact(last.cartera)} title={fmtMoney(last.cartera)} {...tile} />
          <StatTile label={`Anticipos / saldos a favor · ${lastLabel}`} value={fmtCompact(last.anticipos)} title={fmtMoney(last.anticipos)} {...tile} />
          <StatTile label="Movimiento débito del periodo" value={fmtCompact(sum('debito'))} title={fmtMoney(sum('debito'))} {...tile} />
          <StatTile label="Movimiento crédito del periodo" value={fmtCompact(sum('credito'))} title={fmtMoney(sum('credito'))} {...tile} />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          <section className={cardCls}>
            <ChartHeader
              title={isInternal ? 'Saldo de cartera mes a mes' : 'Saldo por pagar mes a mes'}
              subtitle={`${scopeName} · saldo final de cuentas por cobrar (13) al cierre de cada mes`}
              titleCls={titleCls}
              mutedCls={mutedCls}
            />
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke={colors.grid} />
                  <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={12} />
                  <YAxis {...axisProps} tickFormatter={fmtCompact} width={64} />
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
              rows={(data.byAccount ?? []).map(a => [`${a.code} · ${a.name}`, fmtMoney(Number(a.debit)), fmtMoney(Number(a.credit)), fmtMoney(Number(a.finalBalance))])}
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
  const cartera = (data?.topCartera ?? []).map(t => ({ name: t.name, total: Number(t.saldo) }))

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="Ingresos del periodo" value={fmtCompact(sum('ingresos'))} title={fmtMoney(sum('ingresos'))} {...tile} />
        <StatTile label="Gastos y costos del periodo" value={fmtCompact(sum('gastosCostos'))} title={fmtMoney(sum('gastosCostos'))} {...tile} />
        <StatTile label="Utilidad del periodo" value={fmtCompact(sum('utilidad'))} title={fmtMoney(sum('utilidad'))} {...tile} />
        <StatTile label={`Activo · ${lastLabel}`} value={fmtCompact(last.activo)} title={fmtMoney(last.activo)} {...tile} />
      </div>

      <section className={cardCls}>
        <ChartHeader
          title="Ingresos vs gastos y costos"
          subtitle={`Movimiento de cada mes (clase 4 frente a clases 5, 6 y 7)${rangeNote}`}
          titleCls={titleCls}
          mutedCls={mutedCls}
        />
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthly} barGap={2} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
              <Bar dataKey="ingresos" name="Ingresos" fill={colors.facturado} maxBarSize={20} radius={[4, 4, 0, 0]} />
              <Bar dataKey="gastosCostos" name="Gastos y costos" fill={colors.recaudo} maxBarSize={20} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <DataTable
          mutedCls={mutedCls}
          isInternal={isInternal}
          headers={['Mes', 'Ingresos', 'Gastos y costos', 'Utilidad']}
          rows={monthly.map(m => [m.label, fmtMoney(m.ingresos), fmtMoney(m.gastosCostos), fmtMoney(m.utilidad)])}
        />
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <section className={cardCls}>
          <ChartHeader title="Utilidad mes a mes" subtitle="Ingresos menos gastos y costos de cada mes" titleCls={titleCls} mutedCls={mutedCls} />
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
                <Bar dataKey="utilidad" fill={colors.facturado} maxBarSize={24} radius={[4, 4, 0, 0]} />
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
          />
        </section>
      </div>

      {cartera.length > 0 && (
        <section className={cardCls}>
          <ChartHeader title={`Mayores saldos de cartera · ${lastLabel}`} subtitle="Terceros con mayor saldo en cuentas por cobrar (13)" titleCls={titleCls} mutedCls={mutedCls} />
          <div style={{ height: Math.max(180, cartera.length * 40) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cartera} layout="vertical" margin={{ top: 0, right: 72, left: 0, bottom: 0 }}>
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
            rows={(data?.topCartera ?? []).map(t => [t.name, t.nit, fmtMoney(Number(t.saldo))])}
          />
        </section>
      )}
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

type TooltipRow = { key: string; label: string; color?: string }

/** Tooltip con tokens de texto; el color de serie solo va en la marca junto a la etiqueta */
function ChartTooltip({ active, payload, label, rows, labelKey, isDark, isInternal }: {
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
          <span className="font-mono">{fmtMoney(Number(datum[r.key] ?? 0))}</span>
        </div>
      ))}
    </div>
  )
}

/** Vista de tabla de cada gráfica (accesibilidad y valores exactos) */
function DataTable({ headers, rows, mutedCls, isInternal }: { headers: string[]; rows: string[][]; mutedCls: string; isInternal: boolean }) {
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
            {rows.map((r, i) => (
              <tr key={i}>
                {r.map((cell, j) => (
                  <td key={j} className={cn('py-1.5 px-2', j > 0 && 'text-right font-mono whitespace-nowrap')}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}
