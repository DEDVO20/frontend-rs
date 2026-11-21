import { crmParamsOf, useCrmReport } from '@/features/siigo/reports'
import { queryKeys } from '@/lib/queryKeys'
import { ChartContainer } from '@/components/ui/ChartContainer'
import { useMemo } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Bar, BarChart, CartesianGrid, LabelList, Legend, Line, LineChart, Tooltip, XAxis, YAxis } from 'recharts'
import { BarChart3 } from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { PageLoader } from '@/components/ui/Spinner'
import { useAuthStore } from '@/stores/authStore'
import { useSiigoSyncStore } from '@/stores/siigoSyncStore'
import { fmtMoney, fmtCompact, fmtPeriod, toYm } from './format'
import { SYNC_ROLES } from './style'
import { type ChartProps, ServiceTick, ChartHeader, ChartTooltip, DataTable } from './shared'

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
      qc.invalidateQueries({ queryKey: queryKeys.hubspotReport })
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
            <ChartContainer width="100%" height="100%">
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
            </ChartContainer>
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
            <ChartContainer width="100%" height="100%">
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
            </ChartContainer>
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
