import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { fmtMoney } from './format'
import { type ChartStyle } from './style'
import { type TableSelect } from './interactions'

/** Filtros activos de una pestaña, cada uno con su botón para quitarlo */
export function FilterChips({ filters, onClearAll, mutedCls }: {
  filters: { label: string; onClear: () => void }[]
  onClearAll: () => void
  mutedCls: string
}) {
  if (!filters.length) return null
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className={cn('text-xs font-bold uppercase tracking-wider', mutedCls)}>Filtros</span>
      {filters.map(f => (
        <button
          key={f.label}
          onClick={f.onClear}
          title="Quitar filtro"
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-primary-50 text-primary-700 ring-1 ring-primary-600/20 hover:bg-primary-100"
        >
          {f.label} <X className="w-3 h-3" />
        </button>
      ))}
      {filters.length > 1 && (
        <button onClick={onClearAll} className={cn('text-xs underline', mutedCls)}>Quitar todos</button>
      )}
    </div>
  )
}

/** Props comunes de cada bloque de gráficas */
export interface ChartProps {
  params: Record<string, string>
  range: { from: string | null; to: string | null }
  style: ChartStyle
  /** Nombre de quien se grafica (empresa o libros) para los subtítulos */
  scopeName: string
  /** Mes seleccionado (YYYY-MM) que acota cifras y desgloses; null = todo el periodo */
  month?: string | null
  /** Sin este callback las gráficas no permiten seleccionar mes */
  onMonth?: (month: string | null) => void
  /** Solo internos: clic en un tercero con empresa vinculada para ver solo esa empresa */
  onCompany?: (companyId: string) => void
  /** Vista reducida del dashboard del cliente: solo las gráficas principales, sin cifras ni tablas extra */
  /** Con compact: qué gráficas mostrar (cartera: edades, vendedor, evolucion, clientes); sin definir = todas */
  only?: string[]
  compact?: boolean
}

/** Etiqueta de servicio en una sola línea, recortada, con el nombre completo al pasar el mouse */
export function ServiceTick({ x, y, payload, fill }: { x: number; y: number; payload: { value: string }; fill: string }) {
  const value = String(payload?.value ?? '')
  const short = value.length > 24 ? `${value.slice(0, 23)}…` : value
  return (
    <text x={x} y={y} dy={4} textAnchor="end" fill={fill} fontSize={11}>
      <title>{value}</title>
      {short}
    </text>
  )
}

export function ChartHeader({ title, subtitle, titleCls, mutedCls }: { title: string; subtitle: string; titleCls: string; mutedCls: string }) {
  return (
    <div className="mb-3">
      <h3 className={cn('text-sm font-bold', titleCls)}>{title}</h3>
      <p className={cn('text-xs mt-0.5', mutedCls)}>{subtitle}</p>
    </div>
  )
}

export function StatTile({ label, value, title, cardCls, titleCls, mutedCls }: {
  label: string
  value: string
  title?: string
  cardCls: string
  titleCls: string
  mutedCls: string
}) {
  return (
    <div className={cardCls} title={title}>
      <p className={cn('text-xs font-medium', mutedCls)}>{label}</p>
      <p className={cn('text-2xl font-semibold mt-1 truncate', titleCls)}>{value}</p>
    </div>
  )
}

/** fmt: formato del valor (por defecto, dinero) */
export type TooltipRow = { key: string; label: string; color?: string; fmt?: (n: number) => string }

/** Tooltip con tokens de texto; el color de serie solo va en la marca junto a la etiqueta */
export function ChartTooltip({ active, payload, label, rows, labelKey, isDark, isInternal }: {
  active?: boolean
  payload?: any[]
  label?: string
  rows: TooltipRow[]
  labelKey?: string
  isDark: boolean
  isInternal: boolean
}) {
  if (!active || !payload?.length) return null
  const datum = payload[0]?.payload ?? {}
  return (
    <div className={cn(
      'rounded-xl px-3 py-2 text-xs shadow-lg ring-1 min-w-[180px]',
      isDark ? 'bg-navy-800 ring-white/10 text-cream-100' : 'bg-white ring-slate-200 text-slate-700',
    )}>
      <p className={cn('font-semibold mb-1', isDark ? 'text-cream-100' : (isInternal ? 'text-slate-900' : 'text-navy-900'))}>
        {labelKey ? datum[labelKey] : label}
      </p>
      {rows.map(r => (
        <div key={r.key} className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-1.5">
            {r.color
              ? <span className="w-2 h-2 rounded-full" style={{ background: r.color }} />
              : <span className="w-2" />}
            {r.label}
          </span>
          <span className="font-mono">{(r.fmt ?? fmtMoney)(Number(datum[r.key] ?? 0))}</span>
        </div>
      ))}
    </div>
  )
}

/** Vista de tabla de cada gráfica (accesibilidad y valores exactos); con `select` las filas filtran por clic */
export function DataTable({ headers, rows, mutedCls, isInternal, select }: {
  headers: string[]
  rows: string[][]
  mutedCls: string
  isInternal: boolean
  select?: TableSelect
}) {
  const selectedCls = isInternal ? 'bg-primary-50 text-primary-800 font-semibold' : 'bg-primary-600/10 font-semibold'
  const hoverCls = isInternal ? 'hover:bg-slate-50' : 'hover:bg-navy-900/5 dark:hover:bg-white/5'
  return (
    <details className="mt-3">
      <summary className={cn('text-xs font-semibold cursor-pointer select-none', mutedCls)}>Ver datos en tabla</summary>
      <div className="mt-2 max-h-64 overflow-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className={cn('text-left', mutedCls)}>
              {headers.map((h, i) => (
                <th key={h} className={cn('py-1.5 px-2 font-semibold', i > 0 && 'text-right')}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className={cn(
            'divide-y',
            isInternal ? 'divide-slate-100 text-slate-700' : 'divide-navy-900/5 dark:divide-white/5 text-navy-900 dark:text-cream-100/90',
          )}>
            {rows.map((r, i) => {
              const key = select?.keys[i]
              return (
              <tr
                key={i}
                onClick={select && key ? () => select.onSelect(key) : undefined}
                aria-selected={select ? key === select.selected : undefined}
                className={cn(select && 'cursor-pointer', select && (key === select.selected ? selectedCls : hoverCls))}
              >
                {r.map((cell, j) => (
                  <td key={j} className={cn('py-1.5 px-2', j > 0 && 'text-right font-mono whitespace-nowrap')}>{cell}</td>
                ))}
              </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </details>
  )
}
