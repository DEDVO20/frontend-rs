import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { fmtPeriod } from './format'
import { MONTH_NAMES, toYmd, type PeriodFilter, type Preset } from './period'
import { type ChartStyle, chartInputCls } from './style'

/**
 * Barra del filtro de periodo sobre las gráficas: atajos, un mes concreto o un rango de fechas
 * exacto, y siempre el periodo aplicado en texto. `children` va a la derecha.
 */
export function PeriodFilterBar({ filter, style, children }: { filter: PeriodFilter; style: ChartStyle; children?: React.ReactNode }) {
  const { isInternal, cardCls, mutedCls, titleCls } = style
  const now = new Date()
  const year = now.getFullYear()
  const chipCls = (active: boolean) => cn(
    'px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors',
    active
      ? 'bg-primary-600 text-white border-primary-600'
      : isInternal
        ? 'border-slate-200 text-slate-600 hover:bg-slate-50'
        : 'border-navy-900/10 text-navy-900/70 hover:bg-navy-900/5 dark:border-white/10 dark:text-cream-100/80 dark:hover:bg-white/5',
  )
  const inputCls = chartInputCls(isInternal)
  const quick: { id: Preset; label: string }[] = [
    { id: 'month-current', label: 'Este mes' },
    { id: 'month-previous', label: 'Mes anterior' },
    { id: '3m', label: 'Últimos 3 meses' },
    { id: '12m', label: 'Últimos 12 meses' },
    { id: 'year-current', label: `Año ${year}` },
    { id: 'year-previous', label: `Año ${year - 1}` },
    { id: 'all', label: 'Todo' },
  ]
  const [pickYear, pickMonth] = filter.monthPick.split('-').map(Number) as [number, number]
  const maxMonth = pickYear === year ? now.getMonth() + 1 : 12
  const today = toYmd(now)

  return (
    <div className={cn(cardCls, 'py-3 space-y-3')}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn('text-xs font-bold uppercase tracking-wider mr-1', mutedCls)}>Periodo</span>
        {quick.map(q => (
          <button key={q.id} className={chipCls(filter.preset === q.id)} onClick={() => filter.setPreset(q.id)}>{q.label}</button>
        ))}
        <span className={cn('mx-1 h-5 w-px', isInternal ? 'bg-slate-200' : 'bg-navy-900/10 dark:bg-white/10')} aria-hidden />
        <button className={chipCls(filter.preset === 'month')} onClick={() => filter.setPreset('month')}>Un mes</button>
        <button className={chipCls(filter.preset === 'range')} onClick={() => filter.setPreset('range')}>Rango de fechas</button>
        {children}
      </div>

      {(filter.preset === 'month' || filter.preset === 'range') && (
        <div className="flex flex-wrap items-center gap-2">
          {filter.preset === 'month' ? (
            <>
              <select
                aria-label="Mes"
                value={pickMonth}
                onChange={e => filter.setMonthPick(`${pickYear}-${String(e.target.value).padStart(2, '0')}`)}
                className={inputCls}
              >
                {MONTH_NAMES.map((n, i) => <option key={n} value={i + 1} disabled={i + 1 > maxMonth}>{n}</option>)}
              </select>
              <select
                aria-label="Año"
                value={pickYear}
                onChange={e => {
                  const y = Number(e.target.value)
                  // Si el mes aún no ha llegado en el año elegido, se usa el último mes disponible
                  const m = y === year ? Math.min(pickMonth, now.getMonth() + 1) : pickMonth
                  filter.setMonthPick(`${y}-${String(m).padStart(2, '0')}`)
                }}
                className={inputCls}
              >
                {Array.from({ length: year - 2019 }, (_, i) => year - i).map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </>
          ) : (
            <>
              <label className={cn('text-xs', mutedCls)} htmlFor="period-from">Desde</label>
              <input id="period-from" type="date" value={filter.dateFrom} max={filter.dateTo || today}
                onChange={e => filter.setDateFrom(e.target.value)} className={inputCls} />
              <label className={cn('text-xs', mutedCls)} htmlFor="period-to">Hasta</label>
              <input id="period-to" type="date" value={filter.dateTo} min={filter.dateFrom || undefined}
                onChange={e => filter.setDateTo(e.target.value)} className={inputCls} />
              {filter.invalid && <span className="text-xs font-semibold text-red-500">«Desde» debe ser anterior a «Hasta»</span>}
            </>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <span className={cn('text-xs', mutedCls)}>Mostrando:</span>
        <span className={cn('text-xs font-semibold', titleCls)}>{filter.label}</span>
        {filter.month && (
          <button
            onClick={() => filter.setMonth(null)}
            title="Quitar el mes seleccionado"
            className="inline-flex items-center gap-1 px-3 py-1 rounded-xl text-xs font-semibold bg-primary-50 text-primary-700 ring-1 ring-primary-600/20 hover:bg-primary-100"
          >
            Detalle de {fmtPeriod(filter.month)} <X className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  )
}
