import { useSalesReport } from '@/features/siigo/reports'
import { queryKeys } from '@/lib/queryKeys'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { TopBar } from '@/components/layout/TopBar'
import { PortalTopBar } from '@/components/layout/PortalTopBar'
import { SiigoBooksSelect, SiigoNotConnected, useSiigoBooks } from '@/pages/siigo/siigoBooks'
import { useChartStyle, chartInputCls } from '@/features/charts/style'
import { usePeriodFilter } from '@/features/charts/period'
import { PeriodFilterBar } from '@/features/charts/PeriodFilterBar'
import { type ChartProps } from '@/features/charts/shared'
import { FacturacionCharts } from '@/features/charts/FacturacionCharts'
import { RecaudoCharts } from '@/features/charts/RecaudoCharts'
import { BalanceCharts } from '@/features/charts/BalanceCharts'
import { CarteraCharts } from '@/features/charts/CarteraCharts'
import { CrmCharts } from '@/features/charts/CrmCharts'

type ViewTab = 'facturacion' | 'recaudo' | 'cartera' | 'balance'

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
    queryKey: queryKeys.siigoCompanies,
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
