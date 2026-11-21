import { useCollectionsReport, useSalesReport } from '@/features/siigo/reports'
import { ChartContainer } from '@/components/ui/ChartContainer'
import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Legend, Tooltip, XAxis, YAxis } from 'recharts'
import { BarChart3 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PageLoader } from '@/components/ui/Spinner'
import { fmtMoney, fmtCompact, fmtPeriod } from './format'
import { MAX_SERVICES, fillMonths, topServices, toSalesMonthly, MAX_CUSTOMERS } from './series'
import { FilterChips, type ChartProps, ServiceTick, ChartHeader, StatTile, ChartTooltip, DataTable } from './shared'
import { monthParams, dimOpacity, rowClick, monthClick, dimKey, monthSelect, monthNote } from './interactions'

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
          <ChartContainer width="100%" height="100%">
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
          </ChartContainer>
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
            <ChartContainer width="100%" height="100%">
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
            </ChartContainer>
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
            <ChartContainer width="100%" height="100%">
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
            </ChartContainer>
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
            <ChartContainer width="100%" height="100%">
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
            </ChartContainer>
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
