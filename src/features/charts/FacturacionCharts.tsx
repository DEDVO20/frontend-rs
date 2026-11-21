import { useSalesReport } from '@/features/siigo/reports'
import { ChartContainer } from '@/components/ui/ChartContainer'
import { useMemo } from 'react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, LabelList, ReferenceLine, Tooltip, XAxis, YAxis } from 'recharts'
import { BarChart3 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PageLoader } from '@/components/ui/Spinner'
import { fmtMoney, fmtCompact, fmtPeriod } from './format'
import { MAX_SERVICES, topServices, toSalesMonthly, bySubtotal } from './series'
import { type ChartProps, ServiceTick, ChartHeader, StatTile, ChartTooltip, DataTable } from './shared'
import { monthParams, dimOpacity, monthClick, monthSelect, monthNote } from './interactions'

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
            <ChartContainer width="100%" height="100%">
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
            </ChartContainer>
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
          <ChartContainer width="100%" height="100%">
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
          </ChartContainer>
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
            <ChartContainer width="100%" height="100%">
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
            </ChartContainer>
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
