import { useBalanceReport, type BalanceMonthly } from '@/features/siigo/reports'
import { ChartContainer } from '@/components/ui/ChartContainer'
import { useMemo } from 'react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, LabelList, Legend, ReferenceLine, Tooltip, XAxis, YAxis } from 'recharts'
import { BarChart3 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PageLoader } from '@/components/ui/Spinner'
import { fmtMoney, fmtCompact, fmtPeriod } from './format'
import { type ChartProps, ServiceTick, ChartHeader, StatTile, ChartTooltip, DataTable } from './shared'
import { monthParams, dimOpacity, rowClick, monthClick, monthSelect } from './interactions'

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
              <ChartContainer width="100%" height="100%">
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
              </ChartContainer>
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
              <ChartContainer width="100%" height="100%">
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
              </ChartContainer>
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
          <ChartContainer width="100%" height="100%">
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
          </ChartContainer>
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
            <ChartContainer width="100%" height="100%">
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
            </ChartContainer>
          </div>
        </section>

        <section className={cardCls}>
          <ChartHeader title={`Estructura del balance · ${lastLabel}`} subtitle="Saldos finales de activo, pasivo y patrimonio" titleCls={titleCls} mutedCls={mutedCls} />
          <div className="h-48">
            <ChartContainer width="100%" height="100%">
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
            </ChartContainer>
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
            <ChartContainer width="100%" height="100%">
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
            </ChartContainer>
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
