import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, LabelList, ResponsiveContainer, XAxis, YAxis } from 'recharts'
import { AlertTriangle, BellRing, CalendarCheck, FileText, Mail, Users, Wallet } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PageLoader } from '@/components/ui/Spinner'
import {
  CarteraCharts,
  CrmCharts,
  FacturacionCharts,
  PeriodFilterBar,
  RecaudoCharts,
  useChartStyle,
  useCollectionsReport,
  useCrmReport,
  useReceivablesReport,
  useSalesReport,
  type ChartProps,
  type ChartStyle,
  type PeriodFilter,
} from '@/pages/siigo/SiigoChartsPage'
import { SiigoNotConnected } from '@/pages/siigo/siigoBooks'

const compact = new Intl.NumberFormat('es-CO', { notation: 'compact', maximumFractionDigits: 1 })
const money = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
const fmtCompact = (n: number) => `${n < 0 ? '-' : ''}$${compact.format(Math.abs(n || 0))}`

function Kpi({ icon: Icon, label, value, title, style }: {
  icon: typeof Users
  label: string
  value: string
  title?: string
  style: ChartStyle
}) {
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

/** Cifras principales: oportunidades (HubSpot), facturación neta (subtotal), recaudo y cartera vencida */
function BusinessKpis({ params, style }: { params: Record<string, string>; style: ChartStyle }) {
  const { data: sales } = useSalesReport(params, true)
  const { data: collections } = useCollectionsReport(params, true)
  const { data: receivables } = useReceivablesReport(params)
  const { data: crm } = useCrmReport(params)

  // Oportunidades activas: negocios abiertos o con propuesta enviada (sin ganar ni perder)
  const activas = crm?.notConnected ? null
    : (crm?.byStage ?? []).filter(s => s.kind === 'open' || s.kind === 'sent').reduce((n, s) => n + Number(s.deals), 0)
  const facturacion = Number(sales?.summary?.totalSubtotal ?? 0)
  const recaudo = Number(collections?.summary?.totalRecaudado ?? 0)
  const vencida = Number(receivables?.summary?.vencido ?? 0)

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <Kpi icon={Users} label="Oportunidades activas" value={activas === null ? '—' : String(activas)} title={activas === null ? 'HubSpot no conectado' : undefined} style={style} />
      <Kpi icon={FileText} label="Facturación neta" value={fmtCompact(facturacion)} title={`${money.format(facturacion)} · subtotal antes de impuestos`} style={style} />
      <Kpi icon={Wallet} label="Recaudo acumulado" value={fmtCompact(recaudo)} title={money.format(recaudo)} style={style} />
      <Kpi icon={AlertTriangle} label="Cartera vencida" value={fmtCompact(vencida)} title={money.format(vencida)} style={style} />
    </div>
  )
}

/** Embudo comercial: negocios por etapa de HubSpot, en el orden del embudo (sin los perdidos) */
function FunnelChart({ params, style }: { params: Record<string, string>; style: ChartStyle }) {
  const { colors, cardCls, titleCls, mutedCls } = style
  const { data, isLoading } = useCrmReport(params)

  const stages = useMemo(() => {
    const map = new Map<string, { name: string; order: number; deals: number }>()
    for (const r of data?.byStage ?? []) {
      if (r.kind === 'lost') continue
      const s = map.get(r.stage) ?? { name: r.stage, order: r.order, deals: 0 }
      s.deals += Number(r.deals)
      s.order = Math.min(s.order, r.order)
      map.set(r.stage, s)
    }
    return [...map.values()].sort((a, b) => a.order - b.order)
  }, [data?.byStage])

  return (
    <section className={cardCls}>
      <h3 className={cn('text-xl font-bold font-display mb-4', titleCls)}>Embudo comercial</h3>
      {isLoading ? <PageLoader />
        : data?.notConnected ? <p className={cn('text-sm py-12 text-center', mutedCls)}>Conecta HubSpot para ver el embudo comercial.</p>
          : !stages.length ? <p className={cn('text-sm py-12 text-center', mutedCls)}>Sin negocios en el periodo seleccionado.</p>
            : (
              <div style={{ height: Math.max(160, stages.length * 44) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stages} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="name" width={130} tickLine={false} axisLine={false} tick={{ fill: colors.axis, fontSize: 12 }} />
                    <Bar dataKey="deals" fill={colors.facturado} maxBarSize={22} radius={[0, 4, 4, 0]}>
                      <LabelList dataKey="deals" position="insideRight" style={{ fill: '#ffffff', fontSize: 12, fontWeight: 700 }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
    </section>
  )
}

const AGING_LABELS: Record<string, string> = {
  'No vencido': 'Por vencer',
  '1-30': '1–30 días',
  '31-60': '31–60 días',
  '61-90': '61–90 días',
  '91+': '91+ días',
  'Sin vencimiento': 'Sin vencimiento',
}

/** Cartera por edades: barra horizontal por edad con su saldo en una etiqueta a la derecha */
function AgingCard({ params, style }: { params: Record<string, string>; style: ChartStyle }) {
  const { colors, cardCls, titleCls, mutedCls, isDark } = style
  const { data, isLoading } = useReceivablesReport(params)
  const buckets = (data?.byBucket ?? [])
    .filter(b => b.bucket !== 'Sin vencimiento' || Number(b.total) > 0)
    .map(b => ({ label: AGING_LABELS[b.bucket] ?? b.bucket, total: Number(b.total), facturas: b.facturas }))
  const max = Math.max(1, ...buckets.map(b => b.total))

  return (
    <section className={cardCls}>
      <h3 className={cn('text-xl font-bold font-display mb-4', titleCls)}>Cartera por edades</h3>
      {isLoading ? <PageLoader />
        : !data?.summary?.facturas ? <p className={cn('text-sm py-12 text-center', mutedCls)}>Aún no hay cartera calculada.</p>
          : (
            <div className="space-y-3">
              {buckets.map(b => (
                <div key={b.label} className="grid grid-cols-[7rem_1fr_6.5rem] items-center gap-3" title={`${money.format(b.total)} · ${b.facturas} factura(s)`}>
                  <span className={cn('text-sm text-right', titleCls)}>{b.label}</span>
                  <div className="h-5">
                    <div className="h-full rounded" style={{ width: `${Math.max(2, (b.total / max) * 100)}%`, background: colors.facturado }} />
                  </div>
                  <span className={cn(
                    'text-sm font-bold text-center rounded-md py-0.5',
                    isDark ? 'bg-brand-600/30 text-cream-100' : 'bg-brand-100 text-navy-900',
                  )}>
                    {fmtCompact(b.total)}
                  </span>
                </div>
              ))}
              {data.cutDate && <p className={cn('text-xs pt-1', mutedCls)}>Corte al {new Date(`${data.cutDate}T00:00:00`).toLocaleDateString('es-CO')}</p>}
            </div>
          )}
    </section>
  )
}

/** Cobranza automatizada: promoción del módulo adicional (sin cifras) */
function CobranzaPromo({ style }: { style: ChartStyle }) {
  const { cardCls, titleCls, mutedCls } = style
  const items = [
    { icon: Mail, text: 'Correo y WhatsApp a tus clientes, desde tu cuenta' },
    { icon: BellRing, text: 'Recordatorios automáticos antes y después del vencimiento' },
    { icon: Users, text: 'Seguimiento de cada cliente en gestión' },
    { icon: CalendarCheck, text: 'Control de promesas de pago' },
  ]
  return (
    <section className={cardCls}>
      <div className="flex items-center justify-between gap-3 mb-4">
        <h3 className={cn('text-xl font-bold font-display', titleCls)}>Cobranza automatizada</h3>
        <span className="text-xs font-semibold px-3 py-1 rounded-full bg-gold-500/15 text-gold-600 dark:text-gold-400">Módulo adicional</span>
      </div>
      <div className="flex flex-col sm:flex-row gap-5 items-center">
        <div className="flex flex-col items-center gap-3 sm:pr-5 sm:border-r border-navy-900/10 dark:border-white/10">
          <div className="w-16 h-16 rounded-2xl bg-gold-500/15 flex items-center justify-center">
            <Mail className="w-8 h-8 text-gold-500" strokeWidth={1.5} />
          </div>
          <Link
            to="/#contacto"
            className="px-4 py-1.5 rounded-full text-xs font-semibold border border-brand-600 text-brand-600 hover:bg-brand-600 hover:text-white dark:border-brand-300 dark:text-brand-300 transition-colors"
          >
            Quiero activarlo
          </Link>
        </div>
        <ul className="space-y-3 flex-1">
          {items.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-3">
              <Icon className="w-5 h-5 shrink-0 text-gold-500" strokeWidth={1.5} />
              <span className={cn('text-sm', titleCls)}>{text}</span>
            </li>
          ))}
        </ul>
      </div>
      <p className={cn('text-xs mt-4', mutedCls)}>Recupera tu cartera sin perseguir a cada cliente: Finto gestiona el cobro por ti.</p>
    </section>
  )
}

function SectionTitle({ title, style }: { title: string; style: ChartStyle }) {
  return <h2 className={cn('text-xl font-bold font-display pt-2', style.titleCls)}>{title}</h2>
}

/**
 * Pestaña «Gestión de Negocios» del dashboard del cliente: cifras, embudo comercial,
 * facturación y recaudo, cartera por edades y cobranza; debajo, el resto de gráficas.
 */
export function GestionNegociosTab({ period, companyName }: { period: PeriodFilter; companyName: string }) {
  const style = useChartStyle()
  const params = period.dateParams
  // La misma consulta (en caché) indica si la empresa tiene su cuenta de Siigo conectada
  const { data, isLoading } = useSalesReport(params)

  if (isLoading) return <PageLoader />
  if (data?.notConnected) return <SiigoNotConnected />

  const props: ChartProps = { params, range: period.range, style, scopeName: companyName, month: period.month, onMonth: period.setMonth, compact: true }

  return (
    <>
      <PeriodFilterBar filter={period} style={style} />
      <BusinessKpis params={params} style={style} />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-start">
        <FunnelChart params={params} style={style} />
        <RecaudoCharts {...props} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-start">
        <AgingCard params={params} style={style} />
        <CobranzaPromo style={style} />
      </div>

      <SectionTitle title="Facturación" style={style} />
      <FacturacionCharts {...props} />

      <SectionTitle title="Cartera" style={style} />
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-start">
        <CarteraCharts {...props} only={['vendedor', 'evolucion', 'clientes']} />
      </div>

      {/* CRM (HubSpot): valor de propuestas por etapa y socio, y conversión */}
      <SectionTitle title="CRM" style={style} />
      <CrmCharts {...props} />
    </>
  )
}

