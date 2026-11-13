import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  AlertTriangle, BarChart3, CheckCircle2, Coins, FileText, Landmark, Layers, Scale, ShieldCheck, TrendingDown, TrendingUp,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { PageLoader } from '@/components/ui/Spinner'
import {
  ChartTooltip,
  PeriodFilterBar,
  useBalanceReport,
  useChartStyle,
  useSalesReport,
  type ChartStyle,
  type PeriodFilter,
} from '@/pages/siigo/SiigoChartsPage'
import { SiigoNotConnected } from '@/pages/siigo/siigoBooks'

const compact = new Intl.NumberFormat('es-CO', { notation: 'compact', maximumFractionDigits: 1 })
const money = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
const fmtCompact = (n: number) => `${n < 0 ? '-' : ''}$${compact.format(Math.abs(n || 0))}`
const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const fmtPeriod = (p: string) => `${MONTHS[Number(p.slice(5, 7)) - 1] ?? p} ${p.slice(2, 4)}`

/** Costos en azul claro: misma familia que ingresos, distinto paso de luminosidad */
const COSTOS = { light: '#9db7e8', dark: '#3f5f99' }

/** Meses YYYY-MM entre dos periodos (incluidos) */
function monthsBetween(from: string, to: string): string[] {
  const out: string[] = []
  let [y, m] = from.split('-').map(Number) as [number, number]
  for (let i = 0; i < 240; i++) {
    const ym = `${y}-${String(m).padStart(2, '0')}`
    if (ym > to) break
    out.push(ym)
    if (++m > 12) { m = 1; y++ }
  }
  return out
}

function Kpi({ icon: Icon, label, value, title, style }: { icon: LucideIcon; label: string; value: string; title?: string; style: ChartStyle }) {
  return (
    <div className={cn(style.cardCls, 'flex items-center gap-4')} title={title}>
      <Icon className="w-8 h-8 shrink-0 text-gold-500" strokeWidth={1.5} />
      <div className="min-w-0">
        <p className={cn('text-sm font-semibold', style.titleCls)}>{label}</p>
        <p className={cn('text-3xl font-bold font-display leading-tight truncate', style.titleCls)}>{value}</p>
      </div>
    </div>
  )
}

function CardTitle({ children, style, badge }: { children: React.ReactNode; style: ChartStyle; badge?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-4">
      <h3 className={cn('text-xl font-bold font-display', style.titleCls)}>{children}</h3>
      {badge && <span className="text-xs font-semibold px-3 py-1 rounded-full bg-gold-500/15 text-gold-600 dark:text-gold-400">{badge}</span>}
    </div>
  )
}

/**
 * Pestaña «Gestión Financiera» del dashboard del cliente, con el balance de prueba de Siigo:
 * estado de resultados, situación financiera y flujo de caja reportado (cuentas de disponible).
 */
export function GestionFinancieraTab({ period }: { period: PeriodFilter }) {
  const style = useChartStyle()
  const { colors, isDark, isInternal, cardCls, titleCls, mutedCls } = style
  const params = period.dateParams
  const { data: sales, isLoading: salesLoading } = useSalesReport(params)
  const { data, isLoading } = useBalanceReport(params, true)

  const monthly = useMemo(() => {
    const cash = new Map((data?.cash ?? []).map(c => [c.period, c]))
    return (data?.monthly ?? []).map(m => {
      const c = cash.get(m.period)
      const ingresos = Number(m.ingresos ?? 0)
      const costos = Number(m.costos ?? 0)
      const gastos = Number(m.gastos ?? 0)
      return {
        period: m.period,
        label: fmtPeriod(m.period),
        ingresos, costos, gastos,
        resultado: ingresos - costos - gastos,
        activo: Number(m.activo ?? 0),
        pasivo: Number(m.pasivo ?? 0),
        patrimonio: Number(m.patrimonio ?? 0),
        entradas: Number(c?.entradas ?? 0),
        salidas: Number(c?.salidas ?? 0),
        posicion: Number(c?.posicion ?? 0),
      }
    })
  }, [data?.monthly, data?.cash])

  if (salesLoading || isLoading) return <PageLoader />
  if (sales?.notConnected) return <SiigoNotConnected />

  const filter = <PeriodFilterBar filter={period} style={style} />

  if (!monthly.length) {
    return (
      <>
        {filter}
        <div className={cn(cardCls, 'py-16 text-center space-y-2')}>
          <BarChart3 className={cn('w-10 h-10 mx-auto', mutedCls)} />
          <p className={cn('font-semibold', titleCls)}>No hay balance de prueba en el periodo seleccionado</p>
          <p className={cn('text-xs', mutedCls)}>La información financiera sale del balance de prueba importado desde Siigo.</p>
        </div>
      </>
    )
  }

  const last = monthly[monthly.length - 1]!
  const prev = monthly.length > 1 ? monthly[monthly.length - 2]! : null
  const ingresos = monthly.reduce((s, m) => s + m.ingresos, 0)
  const resultado = monthly.reduce((s, m) => s + m.resultado, 0)

  // Estado de actualización: meses del periodo con balance importado correctamente
  const from = period.range.from ?? monthly[0]!.period
  const to = period.range.to ?? last.period
  const currentMonth = new Date().toISOString().slice(0, 7)
  const expected = monthsBetween(from, to < currentMonth ? to : currentMonth)
  const ok = new Set((data?.periods ?? []).filter(p => p.status === 'OK').map(p => p.period))
  const updatedPct = expected.length ? Math.round((expected.filter(p => ok.has(p)).length / expected.length) * 100) : 0

  const axisProps = { tick: { fill: colors.axis, fontSize: 11 }, tickLine: false, axisLine: false }
  const legend = (
    <Legend
      verticalAlign="bottom"
      iconType="circle"
      iconSize={8}
      wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
      formatter={(value: string) => <span style={{ color: colors.axis }}>{value}</span>}
    />
  )
  const costosColor = isDark ? COSTOS.dark : COSTOS.light
  const lineColor = isDark ? '#fff7e4' : '#1a2545'

  // Análisis automático del último mes
  const avgEgresos = monthly.reduce((s, m) => s + m.costos + m.gastos, 0) / monthly.length
  const egresosLast = last.costos + last.gastos
  const varIngresos = prev && prev.ingresos ? ((last.ingresos - prev.ingresos) / Math.abs(prev.ingresos)) * 100 : null
  const flujoNeto = last.entradas - last.salidas
  const insights: { icon: LucideIcon; tone: string; text: React.ReactNode }[] = [
    varIngresos === null
      ? { icon: TrendingUp, tone: 'text-emerald-500', text: <>Ingresos de {last.label}: <b>{fmtCompact(last.ingresos)}</b></> }
      : {
        icon: varIngresos >= 0 ? TrendingUp : TrendingDown,
        tone: varIngresos >= 0 ? 'text-emerald-500' : 'text-red-500',
        text: <>Ingresos <b className={varIngresos >= 0 ? 'text-brand-600 dark:text-brand-300' : 'text-red-500'}>{varIngresos >= 0 ? '+' : ''}{varIngresos.toFixed(1).replace('.', ',')} %</b> vs {prev!.label}</>,
      },
    egresosLast > avgEgresos * 1.05
      ? { icon: AlertTriangle, tone: 'text-gold-500', text: <>Costos y gastos de {last.label} sobre el promedio del periodo</> }
      : { icon: CheckCircle2, tone: 'text-emerald-500', text: <>Costos y gastos dentro del promedio del periodo</> },
    flujoNeto >= 0
      ? { icon: CheckCircle2, tone: 'text-emerald-500', text: <>Flujo neto de caja positivo en {last.label} ({fmtCompact(flujoNeto)})</> }
      : { icon: AlertTriangle, tone: 'text-gold-500', text: <>Flujo neto de caja negativo en {last.label} ({fmtCompact(flujoNeto)})</> },
  ]

  const situacion: { icon: LucideIcon; label: string; value: number }[] = [
    { icon: Layers, label: 'Activos', value: last.activo },
    { icon: Coins, label: 'Pasivos', value: last.pasivo },
    { icon: Scale, label: 'Patrimonio', value: last.patrimonio },
  ]

  return (
    <>
      {filter}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Kpi icon={Coins} label="Ingresos acumulados" value={fmtCompact(ingresos)} title={money.format(ingresos)} style={style} />
        <Kpi icon={FileText} label="Resultado del periodo" value={fmtCompact(resultado)} title={`${money.format(resultado)} · ingresos menos costos y gastos`} style={style} />
        <Kpi icon={ShieldCheck} label="Posición de caja" value={fmtCompact(last.posicion)} title={`${money.format(last.posicion)} · saldo del disponible al cierre de ${last.label}`} style={style} />
        <Kpi icon={CheckCircle2} label="Estado de actualización" value={`${updatedPct}%`} title={`${expected.filter(p => ok.has(p)).length} de ${expected.length} meses del periodo con balance importado`} style={style} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 items-start">
        {/* Estado de resultados */}
        <section className={cn(cardCls, 'xl:col-span-2')}>
          <CardTitle style={style}>Estado de resultados</CardTitle>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly} barGap={2} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={colors.grid} />
                <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={8} />
                <YAxis {...axisProps} tickFormatter={fmtCompact} width={64} />
                <Tooltip
                  cursor={{ fill: colors.grid }}
                  content={<ChartTooltip isDark={isDark} isInternal={isInternal} rows={[
                    { key: 'ingresos', label: 'Ingresos', color: colors.facturado },
                    { key: 'costos', label: 'Costos', color: costosColor },
                    { key: 'gastos', label: 'Gastos', color: colors.notas },
                    { key: 'resultado', label: 'Resultado' },
                  ]} />}
                />
                {legend}
                <Bar dataKey="ingresos" name="Ingresos" fill={colors.facturado} maxBarSize={16} radius={[3, 3, 0, 0]} />
                <Bar dataKey="costos" name="Costos" fill={costosColor} maxBarSize={16} radius={[3, 3, 0, 0]} />
                <Bar dataKey="gastos" name="Gastos" fill={colors.notas} maxBarSize={16} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Situación financiera */}
        <section className={cardCls}>
          <CardTitle style={style}>Situación financiera</CardTitle>
          <div className="space-y-4">
            {situacion.map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-center gap-4" title={money.format(value)}>
                <div className="w-10 h-10 rounded-full bg-gold-500/15 flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 text-gold-500" strokeWidth={1.5} />
                </div>
                <span className={cn('flex-1 text-sm', titleCls)}>{label}</span>
                <span className={cn('min-w-[7rem] text-right text-lg font-bold rounded-lg px-3 py-1', isDark ? 'bg-brand-600/30 text-cream-100' : 'bg-brand-100 text-navy-900')}>
                  {fmtCompact(value)}
                </span>
              </div>
            ))}
            <p className={cn('text-xs', mutedCls)}>Saldos al cierre de {last.label}</p>
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 items-start">
        {/* Flujo de caja reportado */}
        <section className={cn(cardCls, 'xl:col-span-2')}>
          <CardTitle style={style}>Flujo de caja reportado</CardTitle>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={monthly} barGap={2} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={colors.grid} />
                <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={8} />
                <YAxis {...axisProps} tickFormatter={fmtCompact} width={64} />
                <Tooltip
                  cursor={{ fill: colors.grid }}
                  content={<ChartTooltip isDark={isDark} isInternal={isInternal} rows={[
                    { key: 'entradas', label: 'Entradas', color: colors.facturado },
                    { key: 'salidas', label: 'Salidas', color: colors.notas },
                    { key: 'posicion', label: 'Posición de caja', color: lineColor },
                  ]} />}
                />
                {legend}
                <Bar dataKey="entradas" name="Entradas" fill={colors.facturado} maxBarSize={18} radius={[3, 3, 0, 0]} />
                <Bar dataKey="salidas" name="Salidas" fill={colors.notas} maxBarSize={18} radius={[3, 3, 0, 0]} />
                <Line dataKey="posicion" name="Posición de caja" type="linear" stroke={lineColor} strokeWidth={2}
                  dot={{ r: 3, fill: isDark ? '#1a2545' : '#ffffff', stroke: lineColor, strokeWidth: 2 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <p className={cn('text-xs mt-2', mutedCls)}>Movimientos de las cuentas de caja y bancos (disponible) en el balance de prueba.</p>
        </section>

        {/* Análisis financiero */}
        <section className={cardCls}>
          <CardTitle style={style} badge="Módulo adicional">Análisis financiero con IA</CardTitle>
          <ul className="space-y-3">
            {insights.map(({ icon: Icon, tone, text }, i) => (
              <li key={i} className={cn('flex items-center gap-3 rounded-xl px-3 py-2.5', isDark ? 'bg-white/5' : 'bg-gold-500/5')}>
                <Icon className={cn('w-5 h-5 shrink-0', tone)} strokeWidth={1.75} />
                <span className={cn('text-sm', titleCls)}>{text}</span>
              </li>
            ))}
          </ul>
          <p className={cn('text-xs mt-4', mutedCls)}>
            Indicadores calculados con tu balance de prueba. El análisis con IA (alertas, explicaciones y recomendaciones) es un módulo adicional.{' '}
            <Link to="/#contacto" className="font-semibold text-brand-600 dark:text-brand-300 hover:underline">Quiero activarlo</Link>
          </p>
        </section>
      </div>

      <p className={cn('text-xs flex items-center gap-1.5', mutedCls)}>
        <Landmark className="w-3.5 h-3.5" /> Información del balance de prueba importado desde Siigo.
      </p>
    </>
  )
}
