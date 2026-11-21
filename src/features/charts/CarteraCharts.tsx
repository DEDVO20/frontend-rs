import { type ReceivablesReport } from '@/features/siigo/reports'
import { queryKeys } from '@/lib/queryKeys'
import { ChartContainer } from '@/components/ui/ChartContainer'
import { Fragment, useMemo, useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, LabelList, Legend, Tooltip, XAxis, YAxis } from 'recharts'
import { BarChart3 } from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { PageLoader } from '@/components/ui/Spinner'
import { useAuthStore } from '@/stores/authStore'
import { useSiigoSyncStore } from '@/stores/siigoSyncStore'
import { fmtMoney, fmtCompact, pct, fmtDay } from './format'
import { SYNC_ROLES } from './style'
import { FilterChips, type ChartProps, ServiceTick, ChartHeader, StatTile, ChartTooltip, DataTable } from './shared'
import { rowClick, dimKey } from './interactions'

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
    queryKey: [...queryKeys.siigoReceivablesReport, reportParams],
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
      qc.invalidateQueries({ queryKey: queryKeys.siigoReceivablesReport })
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
        <ChartContainer width="100%" height="100%">
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
        </ChartContainer>
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
          <ChartContainer width="100%" height="100%">
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
          </ChartContainer>
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
        <ChartContainer width="100%" height="100%">
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
        </ChartContainer>
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
        <ChartContainer width="100%" height="100%">
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
        </ChartContainer>
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
