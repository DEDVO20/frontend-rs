import { useSalesReport } from '@/features/siigo/reports'
import { ChartContainer } from '@/components/ui/ChartContainer'
import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, LabelList, Tooltip, XAxis, YAxis } from 'recharts'
import { BarChart3 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PageLoader } from '@/components/ui/Spinner'
import { fmtMoney, fmtCompact, pct } from './format'
import { MAX_CUSTOMERS } from './series'
import { type ChartProps, ServiceTick, ChartHeader, StatTile, ChartTooltip, DataTable } from './shared'
import { monthParams, monthNote } from './interactions'

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
          <ChartContainer width="100%" height="100%">
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
          </ChartContainer>
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
