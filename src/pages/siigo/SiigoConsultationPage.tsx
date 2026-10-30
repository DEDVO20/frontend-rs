import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { PortalTopBar } from '@/components/layout/PortalTopBar'
import { Button } from '@/components/ui/Button'
import { PageLoader } from '@/components/ui/Spinner'
import { useAuthStore } from '@/stores/authStore'
import { useSiigoSyncStore } from '@/stores/siigoSyncStore'
import { SiigoNotConnected, useSiigoBooks, type SiigoBooksInfo, type SiigoConnection } from './siigoBooks'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  Search,
  Download,
  RefreshCw,
  FileSpreadsheet,
  Filter,
  ChevronLeft,
  ChevronRight,
  X,
  CheckCircle2,
  Layers,
  BarChart3,
  Receipt,
  Package,
} from 'lucide-react'

const INTERNAL_ROLES = ['admin', 'rs_admin', 'rs_staff', 'contador']
const CAN_SYNC_ROLES = ['admin', 'rs_admin', 'contador']

interface SiigoSalesLine {
  siigo_doc_id: string
  line_index: number
  doc_type: 'FACTURA' | 'NOTA_CREDITO'
  comprobante: string
  doc_date: string
  period: string
  customer_nit: string
  normalized_nit: string
  company_id: string | null
  sucursal: string
  customer_name: string
  seller_id: string
  product_code: string
  product_description: string
  gross_value: number
  discount: number
  subtotal: number
  tax_charge: number
  tax_retention: number
  total_charges: number
  total_discounts: number
  total: number
}

interface SiigoSalesResponse {
  data: SiigoSalesLine[]
  total: number
  page: number
  limit: number
  /** Libros consultados (cuenta de Siigo) */
  books: SiigoBooksInfo | null
  /** Cliente cuya empresa aún no tiene su cuenta de Siigo conectada */
  notConnected: boolean
  clientCompany: { id: string; name: string; nit: string | null } | null
  isSyncRunning: boolean
  lastSync: {
    id: string
    started_at: string
    finished_at: string | null
    status: 'running' | 'completed' | 'failed'
    start_date: string
    end_date: string
    invoices_count: number
    credit_notes_count: number
    lines_count: number
    duration_sec: number
  } | null
  summary: {
    totalFacturas: number
    totalNotasCredito: number
    totalDocumentos: number
    totalLineas: number
    totalBruto: number
    totalDescuento: number
    totalSubtotal: number
    totalImpuestos: number
    totalRetenciones: number
    totalNeto: number
  }
  monthly: {
    period: string
    facturas: number
    notasCredito: number
    lineas: number
    subtotal: number
    impuestos: number
    retenciones: number
    total: number
  }[]
  byProduct: {
    code: string
    description: string
    lineas: number
    subtotal: number
    total: number
  }[]
  byCustomer: {
    nit: string
    name: string
    companyId: string | null
    facturas: number
    notasCredito: number
    subtotal: number
    total: number
  }[]
  catalogs: {
    products: { code: string; description: string }[]
    customers: { nit: string; name: string; companyId: string | null }[]
  }
}

function fmtMoney(n: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n || 0)
}

function fmtDate(d: string) {
  if (!d) return '—'
  const parts = d.slice(0, 10).split('-')
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`
  }
  return d
}

type ViewTab = 'items' | 'monthly' | 'summary'

export function SiigoConsultationPage() {
  const { user } = useAuthStore()
  const isInternal = INTERNAL_ROLES.includes(user?.role ?? '')
  const canSync = CAN_SYNC_ROLES.includes(user?.role ?? '')
  // Libros consultados: los internos eligen la cuenta; los clientes ven siempre la de su empresa
  const { booksParam, selected: selectedBooks } = useSiigoBooks()

  // Filtros
  const [companyId, setCompanyId] = useState<string>('')
  const [customerNit, setCustomerNit] = useState<string>('')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [docType, setDocType] = useState<string>('')
  const [productCode, setProductCode] = useState<string>('')
  const [search, setSearch] = useState<string>('')
  const [page, setPage] = useState<number>(1)
  const [limit] = useState<number>(50)
  const [activeTab, setActiveTab] = useState<ViewTab>('items')
  const [showSyncModal, setShowSyncModal] = useState<boolean>(false)
  const [exporting, setExporting] = useState<boolean>(false)

  // Listado de empresas registradas (para filtro interno)
  const { data: companiesRes } = useQuery({
    queryKey: ['companies-siigo-selector'],
    queryFn: async () => {
      const { data } = await api.get('/api/companies?limit=100')
      return data
    },
    enabled: isInternal,
    staleTime: 120_000,
  })
  const companiesList: any[] = Array.isArray(companiesRes) ? companiesRes : (companiesRes?.data ?? [])

  // Consulta principal de datos Siigo
  const queryParams = {
    ...booksParam,
    ...(isInternal && companyId ? { companyId } : {}),
    ...(customerNit ? { customerNit } : {}),
    ...(startDate ? { startDate } : {}),
    ...(endDate ? { endDate } : {}),
    ...(docType ? { docType } : {}),
    ...(productCode ? { productCode } : {}),
    ...(search.trim() ? { search: search.trim() } : {}),
    page,
    limit,
  }

  const { data, isLoading, isFetching, refetch } = useQuery<SiigoSalesResponse>({
    queryKey: ['siigo-sales', queryParams],
    queryFn: async () => {
      const res = await api.get('/api/siigo/sales', { params: queryParams })
      return res.data
    },
    staleTime: 30_000,
    // Mientras corre una sincronización en segundo plano se refresca el estado
    refetchInterval: q => (q.state.data?.isSyncRunning ? 10_000 : false),
  })

  const handleResetFilters = () => {
    setCompanyId('')
    setCustomerNit('')
    setStartDate('')
    setEndDate('')
    setDocType('')
    setProductCode('')
    setSearch('')
    setPage(1)
  }

  const handleExportExcel = async () => {
    setExporting(true)
    try {
      const res = await api.get('/api/siigo/export', {
        params: queryParams,
        responseType: 'blob',
      })
      const blob = new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const contentDisp = res.headers['content-disposition'] as string | undefined
      const match = contentDisp?.match(/filename="?([^"]+)"?/)
      a.download = match?.[1] ?? `informe_ventas_siigo_${new Date().toISOString().slice(0, 10)}.xlsx`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      toast.success('Archivo Excel descargado exitosamente')
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Error al generar el archivo Excel')
    } finally {
      setExporting(false)
    }
  }

  const summary = data?.summary ?? {
    totalFacturas: 0,
    totalNotasCredito: 0,
    totalDocumentos: 0,
    totalLineas: 0,
    totalBruto: 0,
    totalDescuento: 0,
    totalSubtotal: 0,
    totalImpuestos: 0,
    totalRetenciones: 0,
    totalNeto: 0,
  }

  // Clases de color compartidas (las variantes dark: solo aplican en el portal del cliente)
  const theadCls = isInternal ? 'bg-slate-900 text-white' : 'bg-navy-900 text-cream-100 dark:bg-navy-800'
  const numCls = 'text-slate-700 dark:text-cream-100/90'
  const ncCls = 'text-red-600 dark:text-red-400'
  const secondaryBtnCls = 'dark:bg-navy-800 dark:text-cream-100 dark:border-white/10 dark:hover:bg-navy-700'

  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / limit))
  const hasFilters = Boolean(companyId || customerNit || startDate || endDate || docType || productCode || search)

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full overflow-hidden">
      {/* Para roles internos el encabezado y las pestañas los pone SiigoLayout */}
      {!isInternal && (
        <PortalTopBar
          title="Facturación Siigo"
          subtitle="Las facturas y notas crédito que tu empresa emite en Siigo, por cliente y por servicio"
          companyName={data?.clientCompany?.name ?? 'Mi Empresa'}
        />
      )}

      {data?.notConnected ? (
        <div className="flex-1 overflow-y-auto p-4 md:p-6"><SiigoNotConnected /></div>
      ) : (
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5">
        {/* Barra superior de estado y acciones */}
        <div className={cn(
          'rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 border',
          isInternal
            ? 'bg-white border-slate-200'
            : 'bg-cream-100 dark:bg-navy-900 border-navy-900/10 dark:border-white/10',
        )}>
          <div className="flex items-start sm:items-center gap-3">
            <div className={cn(
              'w-11 h-11 rounded-xl flex items-center justify-center shrink-0',
              isInternal ? 'bg-primary-50 text-primary-600' : 'bg-gold-500/15 text-gold-600 dark:text-gold-400',
            )}>
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className={cn(
                  'font-bold text-base',
                  isInternal ? 'text-slate-900' : 'text-navy-900 dark:text-cream-100 font-display',
                )}>
                  {isInternal
                    ? (data?.clientCompany
                        ? `${data.books?.label ?? 'Finto'} · cliente ${data.clientCompany.name}`
                        : `Facturación de ${data?.books?.label ?? selectedBooks?.label ?? 'Finto'}`)
                    : `Facturación de ${data?.clientCompany?.name ?? 'tu empresa'}`}
                </h2>
                {data?.clientCompany?.nit && (
                  <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-cream-100/70">
                    NIT: {data.clientCompany.nit}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-cream-100/60 mt-0.5">
                {data?.isSyncRunning ? (
                  <span className="inline-flex items-center gap-1.5 font-medium text-primary-600">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    Sincronización con Siigo en curso (segundo plano)…
                  </span>
                ) : data?.lastSync ? (
                  <>
                    Última sincronización: <span className="font-medium">{new Date(data.lastSync.started_at).toLocaleString('es-CO')}</span>
                    {' · '}Periodo: {data.lastSync.start_date} a {data.lastSync.end_date}
                  </>
                ) : (
                  'Datos cargados y listos para consulta y descarga en Excel'
                )}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              variant="secondary"
              size="sm"
              className={secondaryBtnCls}
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw className={cn('w-4 h-4', isFetching && 'animate-spin')} />
              Actualizar vista
            </Button>

            {canSync && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowSyncModal(true)}
                disabled={data?.isSyncRunning}
              >
                <RefreshCw className={cn('w-4 h-4 text-primary-600', data?.isSyncRunning && 'animate-spin')} />
                {data?.isSyncRunning ? 'Sincronizando…' : 'Sincronizar con Siigo API'}
              </Button>
            )}

            <Button
              size="sm"
              onClick={handleExportExcel}
              loading={exporting}
              disabled={(data?.total ?? 0) === 0}
            >
              <Download className="w-4 h-4" />
              Descargar Excel (.xlsx)
            </Button>
          </div>
        </div>

        {/* Tarjetas KPI */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
          <KpiCard
            label="Documentos Emitidos"
            value={`${summary.totalFacturas} FV · ${summary.totalNotasCredito} NC`}
            sub={`${summary.totalLineas} líneas de servicio/producto`}
            tone="slate"
            isInternal={isInternal}
          />
          <KpiCard
            label="Subtotal (Antes de Imp.)"
            value={fmtMoney(summary.totalSubtotal)}
            sub={`Bruto: ${fmtMoney(summary.totalBruto)}`}
            tone="blue"
            isInternal={isInternal}
          />
          <KpiCard
            label="Impuestos Cargo (IVA)"
            value={fmtMoney(summary.totalImpuestos)}
            sub={summary.totalDescuento > 0 ? `Descuentos: ${fmtMoney(summary.totalDescuento)}` : 'IVA / Cargos aplicados'}
            tone="amber"
            isInternal={isInternal}
          />
          <KpiCard
            label="Retenciones"
            value={fmtMoney(summary.totalRetenciones)}
            sub="ReteFuente / ReteIVA practicadas"
            tone="rose"
            isInternal={isInternal}
          />
          <KpiCard
            label="Total Neto Facturado"
            value={fmtMoney(summary.totalNeto)}
            sub="Facturas menos Notas Crédito"
            tone="emerald"
            isInternal={isInternal}
            highlight
          />
        </div>

        {/* Panel de Filtros */}
        <div className={cn(
          'rounded-2xl p-4 border space-y-3',
          isInternal
            ? 'bg-white border-slate-200'
            : 'bg-cream-100 dark:bg-navy-900 border-navy-900/10 dark:border-white/10',
        )}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-cream-100/60">
              <Filter className="w-3.5 h-3.5" />
              Filtros de consulta
            </div>
            {hasFilters && (
              <button
                onClick={handleResetFilters}
                className="text-xs font-semibold text-primary-600 dark:text-brand-300 hover:underline flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" /> Limpiar filtros
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            {/* Buscador texto libre */}
            <div className="lg:col-span-2 relative">
              <label className="block text-[11px] font-medium text-slate-500 dark:text-cream-100/60 mb-1">
                Buscar comprobante, producto o cliente
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1) }}
                  placeholder="Ej: FV-2-1045, Contabilidad, 901655..."
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 dark:border-white/10 dark:bg-navy-800 dark:text-cream-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>

            {/* Tercero que es una empresa de la plataforma (solo roles internos) */}
            {isInternal && (
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">
                  Cliente (empresa de la plataforma)
                </label>
                <select
                  value={companyId}
                  onChange={e => { setCompanyId(e.target.value); setCustomerNit(''); setPage(1) }}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                >
                  <option value="">Todas las empresas…</option>
                  {companiesList.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.nit ? `(${c.nit})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Cliente (tercero) dentro de los libros consultados */}
            {(
              <div>
                <label className="block text-[11px] font-medium text-slate-500 dark:text-cream-100/60 mb-1">
                  Cliente / NIT en Siigo
                </label>
                <select
                  value={customerNit}
                  onChange={e => { setCustomerNit(e.target.value); setCompanyId(''); setPage(1) }}
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-white/10 dark:bg-navy-800 dark:text-cream-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                >
                  <option value="">Todos los NITs…</option>
                  {(data?.catalogs?.customers ?? []).map(c => (
                    <option key={c.nit} value={c.nit}>
                      {c.name} ({c.nit})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Tipo de documento */}
            <div>
              <label className="block text-[11px] font-medium text-slate-500 dark:text-cream-100/60 mb-1">
                Tipo de documento
              </label>
              <select
                value={docType}
                onChange={e => { setDocType(e.target.value); setPage(1) }}
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-white/10 dark:bg-navy-800 dark:text-cream-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
              >
                <option value="">Todos (FV + NC)</option>
                <option value="FACTURA">Facturas de Venta (FV)</option>
                <option value="NOTA_CREDITO">Notas Crédito (NC)</option>
              </select>
            </div>

            {/* Servicio / Producto */}
            <div>
              <label className="block text-[11px] font-medium text-slate-500 dark:text-cream-100/60 mb-1">
                Servicio / Producto
              </label>
              <select
                value={productCode}
                onChange={e => { setProductCode(e.target.value); setPage(1) }}
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-white/10 dark:bg-navy-800 dark:text-cream-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
              >
                <option value="">Todos los servicios…</option>
                {(data?.catalogs?.products ?? []).map(p => (
                  <option key={p.code} value={p.code}>
                    {p.code ? `[${p.code}] ` : ''}{p.description}
                  </option>
                ))}
              </select>
            </div>

            {/* Rango de fechas */}
            <div className="sm:col-span-2 lg:col-span-2 grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-medium text-slate-500 dark:text-cream-100/60 mb-1">
                  Fecha desde
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => { setStartDate(e.target.value); setPage(1) }}
                  className="w-full px-2.5 py-1.5 text-sm border border-slate-200 dark:border-white/10 dark:bg-navy-800 dark:text-cream-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-500 dark:text-cream-100/60 mb-1">
                  Fecha hasta
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => { setEndDate(e.target.value); setPage(1) }}
                  className="w-full px-2.5 py-1.5 text-sm border border-slate-200 dark:border-white/10 dark:bg-navy-800 dark:text-cream-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>

            {/* Atajos rápidos de año */}
            <div className="sm:col-span-2 lg:col-span-2 flex items-end gap-1.5">
              <button
                type="button"
                onClick={() => { setStartDate('2025-01-01'); setEndDate('2025-12-31'); setPage(1) }}
                className={cn(
                  'px-3 py-2 rounded-xl text-xs font-semibold border transition-colors',
                  startDate === '2025-01-01' && endDate === '2025-12-31'
                    ? 'bg-primary-600 text-white border-primary-600'
                    : 'border-slate-200 dark:border-white/10 text-slate-600 dark:text-cream-100/80 hover:bg-slate-50 dark:hover:bg-navy-800',
                )}
              >
                Año 2025
              </button>
              <button
                type="button"
                onClick={() => { setStartDate('2026-01-01'); setEndDate('2026-12-31'); setPage(1) }}
                className={cn(
                  'px-3 py-2 rounded-xl text-xs font-semibold border transition-colors',
                  startDate === '2026-01-01' && endDate === '2026-12-31'
                    ? 'bg-primary-600 text-white border-primary-600'
                    : 'border-slate-200 dark:border-white/10 text-slate-600 dark:text-cream-100/80 hover:bg-slate-50 dark:hover:bg-navy-800',
                )}
              >
                Año 2026
              </button>
              <button
                type="button"
                onClick={() => { setStartDate(''); setEndDate(''); setPage(1) }}
                className={cn(
                  'px-3 py-2 rounded-xl text-xs font-semibold border transition-colors',
                  !startDate && !endDate
                    ? 'bg-slate-800 text-white border-slate-800 dark:bg-gold-500 dark:border-gold-500'
                    : 'border-slate-200 dark:border-white/10 text-slate-600 dark:text-cream-100/80 hover:bg-slate-50 dark:hover:bg-navy-800',
                )}
              >
                Todo el histórico
              </button>
            </div>
          </div>
        </div>

        {/* Pestañas de visualización */}
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-white/10 pb-1">
          <button
            onClick={() => setActiveTab('items')}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors',
              activeTab === 'items'
                ? 'bg-primary-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-cream-100/70 hover:bg-slate-100 dark:hover:bg-navy-800',
            )}
          >
            <Receipt className="w-4 h-4" />
            Detalle Ítem por Ítem ({data?.total ?? 0})
          </button>
          <button
            onClick={() => setActiveTab('monthly')}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors',
              activeTab === 'monthly'
                ? 'bg-primary-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-cream-100/70 hover:bg-slate-100 dark:hover:bg-navy-800',
            )}
          >
            <BarChart3 className="w-4 h-4" />
            Resumen Mensual ({data?.monthly?.length ?? 0})
          </button>
          <button
            onClick={() => setActiveTab('summary')}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors',
              activeTab === 'summary'
                ? 'bg-primary-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-cream-100/70 hover:bg-slate-100 dark:hover:bg-navy-800',
            )}
          >
            <Package className="w-4 h-4" />
            Agrupado por Servicio y Cliente
          </button>
        </div>

        {/* Contenido principal según pestaña */}
        {isLoading ? (
          <PageLoader />
        ) : activeTab === 'items' ? (
          <div className={cn(
            'rounded-2xl border overflow-hidden',
            isInternal
              ? 'bg-white border-slate-200'
              : 'bg-cream-100 dark:bg-navy-900 border-navy-900/10 dark:border-white/10',
          )}>
            {(data?.data?.length ?? 0) === 0 ? (
              <div className="p-12 text-center space-y-3">
                <Layers className="w-12 h-12 text-slate-300 dark:text-cream-100/30 mx-auto" />
                <p className="text-base font-semibold text-slate-700 dark:text-cream-100">
                  No se encontraron registros de facturación para los filtros seleccionados
                </p>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  {isInternal
                    ? 'Puedes ajustar los filtros de búsqueda o ejecutar una sincronización con Siigo API para descargar nuevos documentos.'
                    : 'Aún no hay facturas registradas en este rango de fechas para el NIT de tu empresa.'}
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className={cn(theadCls, 'text-[11px] font-semibold uppercase tracking-wider')}>
                        <th className="py-3 px-3 whitespace-nowrap">No. Comprobante</th>
                        <th className="py-3 px-3 whitespace-nowrap">Fecha</th>
                        <th className="py-3 px-3 whitespace-nowrap">Identificación</th>
                        <th className="py-3 px-3 whitespace-nowrap">Cliente</th>
                        <th className="py-3 px-3 whitespace-nowrap">Cód.</th>
                        <th className="py-3 px-3 whitespace-nowrap">Descripción Producto / Servicio</th>
                        <th className="py-3 px-3 text-right whitespace-nowrap">Valor Bruto</th>
                        <th className="py-3 px-3 text-right whitespace-nowrap">Descuento</th>
                        <th className="py-3 px-3 text-right whitespace-nowrap">Subtotal</th>
                        <th className="py-3 px-3 text-right whitespace-nowrap">Imp. Cargo</th>
                        <th className="py-3 px-3 text-right whitespace-nowrap">Retención</th>
                        <th className="py-3 px-3 text-right whitespace-nowrap">Total Neto</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5 text-xs">
                      {data!.data.map((row, idx) => {
                        const isNC = row.doc_type === 'NOTA_CREDITO'
                        return (
                          <tr
                            key={`${row.siigo_doc_id}-${row.line_index}-${idx}`}
                            className="hover:bg-slate-50/80 dark:hover:bg-white/5 transition-colors"
                          >
                            <td className="py-2.5 px-3 whitespace-nowrap font-semibold">
                              <span className={cn(
                                'inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold',
                                isNC
                                  ? 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/50 dark:text-red-300'
                                  : 'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/50 dark:text-blue-300',
                              )}>
                                {row.comprobante}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap text-slate-600 dark:text-cream-100/80">
                              {fmtDate(row.doc_date)}
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap font-mono text-slate-600 dark:text-cream-100/70">
                              {row.customer_nit || '—'}
                              {row.sucursal ? <span className="text-[10px] text-slate-400 ml-1">(Suc. {row.sucursal})</span> : null}
                            </td>
                            <td className="py-2.5 px-3 max-w-[220px] truncate font-medium text-slate-800 dark:text-cream-100" title={row.customer_name}>
                              {row.customer_name || '—'}
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap font-mono text-slate-500 dark:text-cream-100/60">
                              {row.product_code || '—'}
                            </td>
                            <td className="py-2.5 px-3 max-w-[260px] truncate text-slate-800 dark:text-cream-100" title={row.product_description}>
                              {row.product_description}
                            </td>
                            <td className={cn('py-2.5 px-3 text-right whitespace-nowrap font-mono', isNC ? ncCls : numCls)}>
                              {fmtMoney(row.gross_value)}
                            </td>
                            <td className="py-2.5 px-3 text-right whitespace-nowrap font-mono text-slate-500 dark:text-cream-100/60">
                              {row.discount ? fmtMoney(row.discount) : '—'}
                            </td>
                            <td className={cn('py-2.5 px-3 text-right whitespace-nowrap font-mono font-medium', isNC ? ncCls : numCls)}>
                              {fmtMoney(row.subtotal)}
                            </td>
                            <td className={cn('py-2.5 px-3 text-right whitespace-nowrap font-mono', isNC ? ncCls : numCls)}>
                              {fmtMoney(row.tax_charge)}
                            </td>
                            <td className="py-2.5 px-3 text-right whitespace-nowrap font-mono text-amber-700 dark:text-amber-400">
                              {row.tax_retention ? fmtMoney(row.tax_retention) : '—'}
                            </td>
                            <td className={cn(
                              'py-2.5 px-3 text-right whitespace-nowrap font-mono font-bold',
                              isNC ? ncCls : 'text-slate-900 dark:text-cream-100',
                            )}>
                              {fmtMoney(row.total)}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-100 dark:bg-navy-800 font-bold text-xs border-t-2 border-slate-300 dark:border-white/10">
                        <td colSpan={6} className="py-3 px-3 text-right uppercase text-slate-600 dark:text-cream-100/80">
                          Total General Filtrado ({summary.totalLineas} ítems):
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-slate-700 dark:text-cream-100/90">{fmtMoney(summary.totalBruto)}</td>
                        <td className="py-3 px-3 text-right font-mono text-slate-700 dark:text-cream-100/90">{fmtMoney(summary.totalDescuento)}</td>
                        <td className="py-3 px-3 text-right font-mono text-slate-700 dark:text-cream-100/90">{fmtMoney(summary.totalSubtotal)}</td>
                        <td className="py-3 px-3 text-right font-mono text-slate-700 dark:text-cream-100/90">{fmtMoney(summary.totalImpuestos)}</td>
                        <td className="py-3 px-3 text-right font-mono text-amber-700 dark:text-amber-400">{fmtMoney(summary.totalRetenciones)}</td>
                        <td className="py-3 px-3 text-right font-mono text-primary-700 dark:text-gold-400">{fmtMoney(summary.totalNeto)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Paginación */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-slate-100 dark:border-white/10 bg-slate-50/50 dark:bg-navy-900">
                  <p className="text-xs text-slate-500 dark:text-cream-100/60">
                    Mostrando página <span className="font-semibold">{page}</span> de <span className="font-semibold">{totalPages}</span>
                    {' '}({data?.total ?? 0} líneas en total)
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      className={secondaryBtnCls}
                      disabled={page <= 1}
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                    >
                      <ChevronLeft className="w-4 h-4" /> Anterior
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      className={secondaryBtnCls}
                      disabled={page >= totalPages}
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    >
                      Siguiente <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        ) : activeTab === 'monthly' ? (
          /* Pestaña Resumen Mensual */
          <div className={cn(
            'rounded-2xl border overflow-hidden',
            isInternal
              ? 'bg-white border-slate-200'
              : 'bg-cream-100 dark:bg-navy-900 border-navy-900/10 dark:border-white/10',
          )}>
            <div className="px-5 py-4 border-b border-slate-100 dark:border-white/10 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-cream-100">
                  Desglose Mensual de Facturación
                </h3>
                <p className="text-xs text-slate-400">
                  Comportamiento mes a mes de facturas, notas crédito, impuestos y total neto
                </p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className={cn(theadCls, 'text-[11px] font-semibold uppercase tracking-wider')}>
                    <th className="py-3 px-4">Periodo (Año-Mes)</th>
                    <th className="py-3 px-4 text-center">Facturas (FV)</th>
                    <th className="py-3 px-4 text-center">Notas Crédito (NC)</th>
                    <th className="py-3 px-4 text-center">Líneas / Ítems</th>
                    <th className="py-3 px-4 text-right">Subtotal</th>
                    <th className="py-3 px-4 text-right">Impuestos Cargo</th>
                    <th className="py-3 px-4 text-right">Retenciones</th>
                    <th className="py-3 px-4 text-right">Total Neto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5 text-xs">
                  {(data?.monthly ?? []).map(m => (
                    <tr key={m.period} className="hover:bg-slate-50 dark:hover:bg-white/5">
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-cream-100">{m.period}</td>
                      <td className="py-3 px-4 text-center font-medium text-blue-600 dark:text-blue-300">{m.facturas}</td>
                      <td className="py-3 px-4 text-center font-medium text-red-600 dark:text-red-400">{m.notasCredito || '—'}</td>
                      <td className="py-3 px-4 text-center text-slate-600 dark:text-cream-100/70">{m.lineas}</td>
                      <td className="py-3 px-4 text-right font-mono text-slate-700 dark:text-cream-100/90">{fmtMoney(m.subtotal)}</td>
                      <td className="py-3 px-4 text-right font-mono text-slate-700 dark:text-cream-100/90">{fmtMoney(m.impuestos)}</td>
                      <td className="py-3 px-4 text-right font-mono text-amber-700 dark:text-amber-400">{fmtMoney(m.retenciones)}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 dark:text-cream-100">
                        {fmtMoney(m.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* Pestaña Resumen por Servicio y por Cliente */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className={cn(
              'rounded-2xl border overflow-hidden',
              isInternal
                ? 'bg-white border-slate-200'
                : 'bg-cream-100 dark:bg-navy-900 border-navy-900/10 dark:border-white/10',
            )}>
              <div className="px-5 py-4 border-b border-slate-100 dark:border-white/10">
                <h3 className="font-bold text-sm text-slate-900 dark:text-cream-100">
                  Facturación por Servicio / Producto
                </h3>
                <p className="text-xs text-slate-400">Acumulado por línea de servicio facturada en Siigo</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className={cn(theadCls, 'text-[11px] font-semibold uppercase tracking-wider')}>
                      <th className="py-2.5 px-4">Cód.</th>
                      <th className="py-2.5 px-4">Servicio / Producto</th>
                      <th className="py-2.5 px-4 text-center">Ítems</th>
                      <th className="py-2.5 px-4 text-right">Subtotal</th>
                      <th className="py-2.5 px-4 text-right">Total Neto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5 text-xs">
                    {(data?.byProduct ?? []).map(p => (
                      <tr key={p.code + p.description} className="hover:bg-slate-50 dark:hover:bg-white/5">
                        <td className="py-2.5 px-4 font-mono text-slate-500 dark:text-cream-100/60">{p.code}</td>
                        <td className="py-2.5 px-4 font-medium text-slate-900 dark:text-cream-100">{p.description}</td>
                        <td className="py-2.5 px-4 text-center text-slate-500 dark:text-cream-100/60">{p.lineas}</td>
                        <td className="py-2.5 px-4 text-right font-mono text-slate-700 dark:text-cream-100/90">{fmtMoney(p.subtotal)}</td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900 dark:text-cream-100">{fmtMoney(p.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {(
              <div className={cn(
                'rounded-2xl border overflow-hidden',
                isInternal ? 'bg-white border-slate-200' : 'bg-cream-100 dark:bg-navy-900 border-navy-900/10 dark:border-white/10',
              )}>
                <div className="px-5 py-4 border-b border-slate-100 dark:border-white/10">
                  <h3 className="font-bold text-sm text-slate-900 dark:text-cream-100">
                    Facturación por Cliente ({data?.byCustomer?.length ?? 0})
                  </h3>
                  <p className="text-xs text-slate-400">Haz clic en un cliente para filtrar sus facturas</p>
                </div>
                <div className="overflow-x-auto max-h-[500px]">
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0">
                      <tr className={cn(theadCls, 'text-[11px] font-semibold uppercase tracking-wider')}>
                        <th className="py-2.5 px-4">NIT</th>
                        <th className="py-2.5 px-4">Cliente</th>
                        <th className="py-2.5 px-4 text-center">FV / NC</th>
                        <th className="py-2.5 px-4 text-right">Subtotal</th>
                        <th className="py-2.5 px-4 text-right">Total Neto</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5 text-xs">
                      {(data?.byCustomer ?? []).map(c => (
                        <tr
                          key={c.nit}
                          onClick={() => {
                            setCustomerNit(c.nit)
                            setCompanyId('')
                            setActiveTab('items')
                            setPage(1)
                          }}
                          className="hover:bg-primary-50/60 dark:hover:bg-white/5 cursor-pointer transition-colors"
                        >
                          <td className="py-2.5 px-4 font-mono text-slate-600 dark:text-cream-100/70">{c.nit}</td>
                          <td className="py-2.5 px-4 font-medium text-slate-900 dark:text-cream-100">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate max-w-[200px]">{c.name}</span>
                              {/* "Vinculado" solo tiene sentido en los libros de Finto (sus clientes son empresas de la plataforma) */}
                              {isInternal && c.companyId && (
                                <span
                                  title="Vinculado con empresa en plataforma"
                                  className="inline-flex items-center px-1.5 py-0.5 text-[10px] rounded bg-emerald-50 text-emerald-700 font-semibold"
                                >
                                  Vinculado
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-4 text-center">
                            <span className="text-blue-600 dark:text-blue-300 font-semibold">{c.facturas}</span>
                            {c.notasCredito > 0 && <span className="text-red-500 dark:text-red-400 ml-1">/ {c.notasCredito} NC</span>}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono text-slate-700 dark:text-cream-100/90">{fmtMoney(c.subtotal)}</td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900 dark:text-cream-100">{fmtMoney(c.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      )}

      {/* Modal de Sincronización con Siigo API (Solo Roles Internos Autorizados) */}
      {showSyncModal && (
        <SyncSiigoModal
          books={selectedBooks}
          lastSync={data?.lastSync ?? null}
          onClose={() => setShowSyncModal(false)}
          onSynced={() => {
            refetch()
          }}
        />
      )}
    </div>
  )
}

function KpiCard({
  label,
  value,
  sub,
  tone,
  isInternal,
  highlight,
}: {
  label: string
  value: string
  sub: string
  tone: 'slate' | 'blue' | 'amber' | 'rose' | 'emerald'
  isInternal: boolean
  highlight?: boolean
}) {
  const accent = {
    slate:   'border-l-slate-500',
    blue:    'border-l-blue-500',
    amber:   'border-l-amber-500',
    rose:    'border-l-rose-500',
    emerald: 'border-l-emerald-500',
  }[tone]

  return (
    <div className={cn(
      'rounded-2xl p-4 border border-l-4 transition-shadow',
      isInternal
        ? (highlight ? 'bg-slate-900 text-white border-slate-800' : 'bg-white border-slate-200')
        : (highlight ? 'bg-navy-900 text-cream-100 border-gold-500/40 dark:bg-navy-800' : 'bg-cream-100 dark:bg-navy-900 border-navy-900/10 dark:border-white/10'),
      // El acento va al final: tailwind-merge descarta border-l-* si un border-* posterior lo pisa
      accent,
    )}>
      <p className={cn(
        'text-xs font-semibold uppercase tracking-wider',
        highlight ? 'text-slate-300 dark:text-gold-400' : 'text-slate-500 dark:text-cream-100/60',
      )}>
        {label}
      </p>
      <p className={cn(
        'text-xl font-bold mt-1.5 font-mono truncate',
        highlight ? 'text-white dark:text-cream-100' : 'text-slate-900 dark:text-cream-100',
      )}>
        {value}
      </p>
      <p className={cn(
        'text-[11px] mt-1 truncate',
        highlight ? 'text-slate-300' : 'text-slate-400 dark:text-cream-100/50',
      )}>
        {sub}
      </p>
    </div>
  )
}

function SyncSiigoModal({
  books,
  lastSync,
  onClose,
  onSynced,
}: {
  books: SiigoConnection | null
  lastSync: SiigoSalesResponse['lastSync']
  onClose: () => void
  onSynced: () => void
}) {
  const qc = useQueryClient()
  const [mode, setMode] = useState<'incremental' | 'days' | 'range' | 'full'>('incremental')
  const [days, setDays] = useState<number>(15)
  const [year, setYear] = useState<number>(books?.sales_start_year ?? 2025)
  const [startDate, setStartDate] = useState<string>(new Date(Date.now() - 15 * 86400000).toISOString().slice(0, 10))
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().slice(0, 10))
  // El vendedor 689 (Paola Blanco) solo aplica a los libros de Finto; otras cuentas usan su propio filtro
  const [sellerFilter, setSellerFilter] = useState<string>(books?.seller_filter || (books?.is_platform ? '689' : ''))
  const startWatching = useSiigoSyncStore(s => s.start)

  const syncMut = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/api/siigo/sync', {
        connectionId: books?.id,
        mode,
        days,
        year,
        startDate: mode === 'range' ? startDate : undefined,
        endDate:   mode === 'range' ? endDate : undefined,
        sellerFilter,
      })
      return data
    },
    onSuccess: (res) => {
      // La sincronización sigue en el servidor; SiigoSyncWatcher avisa cuando termine
      startWatching('sales', res.connectionId, books?.label ?? 'Finto')
      toast.info('Sincronización iniciada en segundo plano. Puedes seguir trabajando: te avisaremos cuando termine.')
      qc.invalidateQueries({ queryKey: ['siigo-sales'] })
      onSynced()
      onClose()
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error ?? 'Error al sincronizar con Siigo API')
    },
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={syncMut.isPending ? undefined : onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <RefreshCw className={cn('w-5 h-5 text-primary-600', syncMut.isPending && 'animate-spin')} />
            <h3 className="text-base font-bold text-slate-900">Sincronizar facturación · {books?.label ?? 'Finto'}</h3>
          </div>
          {!syncMut.isPending && (
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="p-6 space-y-4">
          <p className="text-xs text-slate-500 leading-relaxed">
            Descarga las facturas de venta y notas crédito directamente desde Siigo API, calcula retenciones e impuestos ítem por ítem y vincula automáticamente cada NIT con su empresa cliente.
          </p>

          {/* Selector de modo */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: 'incremental', label: 'Incremental', desc: 'Desde la última sync' },
              { id: 'days',  label: 'Últimos días', desc: 'Últimos N días' },
              { id: 'range', label: 'Por Fechas',  desc: 'Rango exacto' },
              { id: 'full',  label: 'Completa',    desc: 'Todo el año' },
            ].map(opt => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setMode(opt.id as any)}
                className={cn(
                  'p-3 rounded-xl border text-left transition-colors',
                  mode === opt.id
                    ? 'border-primary-500 bg-primary-50 text-primary-800'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-600',
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold">{opt.label}</span>
                  {mode === opt.id && <CheckCircle2 className="w-3.5 h-3.5 text-primary-600" />}
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">{opt.desc}</p>
              </button>
            ))}
          </div>

          {mode === 'incremental' && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[11px] text-slate-600 leading-relaxed">
              Trae solo lo nuevo: revisa desde la última sincronización completada (con 5 días de margen para
              anulaciones y ediciones) hasta hoy. Si nunca se ha sincronizado, hace la carga completa.
              {lastSync?.status === 'completed' && (
                <span className="block mt-1 font-medium text-slate-700">
                  Última sincronización cubrió hasta {lastSync.end_date}.
                </span>
              )}
              <span className="block mt-1 text-slate-400">También se ejecuta automáticamente todos los días a las 2:00 AM.</span>
            </div>
          )}

          {mode === 'days' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Consultar últimos días
              </label>
              <select
                value={days}
                onChange={e => setDays(Number(e.target.value))}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value={7}>Últimos 7 días (Rápida)</option>
                <option value={15}>Últimos 15 días (Recomendado)</option>
                <option value={30}>Últimos 30 días (1 mes)</option>
                <option value={60}>Últimos 60 días (2 meses)</option>
                <option value={90}>Últimos 90 días (3 meses)</option>
              </select>
            </div>
          )}

          {mode === 'range' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Fecha inicial</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Fecha final</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
                />
              </div>
            </div>
          )}

          {mode === 'full' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Año inicial de sincronización completa
              </label>
              <select
                value={year}
                onChange={e => setYear(Number(e.target.value))}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
              >
                <option value={2025}>Desde 2025-01-01 hasta hoy</option>
                <option value={2026}>Desde 2026-01-01 hasta hoy</option>
              </select>
              <p className="text-[11px] text-amber-600 mt-1.5">
                Nota: La sincronización completa puede tardar varios minutos debido a las pausas anti-bloqueo (Rate Limit 429) de Siigo.
              </p>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              ID Vendedor Siigo (Opcional)
            </label>
            <input
              value={sellerFilter}
              onChange={e => setSellerFilter(e.target.value)}
              placeholder={books?.is_platform ? '689 = Paola Blanco (dejar vacío para todos)' : 'Vacío = todas las facturas'}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Por defecto `689` (Paola Blanco). Borra el valor si deseas traer facturas de todos los vendedores.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50">
          <Button variant="secondary" onClick={onClose} disabled={syncMut.isPending}>
            Cancelar
          </Button>
          <Button onClick={() => syncMut.mutate()} loading={syncMut.isPending}>
            <RefreshCw className="w-4 h-4" />
            {syncMut.isPending ? 'Iniciando…' : 'Iniciar sincronización'}
          </Button>
        </div>
      </div>
    </div>
  )
}
