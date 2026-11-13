import { cn } from '@/lib/utils'

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

/**
 * Selector de año y meses para importar meses específicos desde Siigo.
 * Los meses que aún no comienzan quedan deshabilitados. Controlado: el padre guarda año y meses.
 */
export function MonthPicker({ year, months, onYear, onMonths, minYear = 2020 }: {
  year: number
  months: number[]
  onYear: (year: number) => void
  onMonths: (months: number[]) => void
  minYear?: number
}) {
  const now = new Date()
  const thisYear = now.getFullYear()
  const lastMonth = year < thisYear ? 12 : now.getMonth() + 1
  const toggle = (m: number) => onMonths(months.includes(m) ? months.filter(x => x !== m) : [...months, m].sort((a, b) => a - b))

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <select
          value={year}
          onChange={e => { onYear(Number(e.target.value)); onMonths([]) }}
          aria-label="Año"
          className="px-3 py-1.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          {Array.from({ length: thisYear - minYear + 1 }, (_, i) => thisYear - i).map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <div className="flex gap-3 text-xs font-semibold">
          <button type="button" onClick={() => onMonths(Array.from({ length: lastMonth }, (_, i) => i + 1))} className="text-primary-600 hover:underline">Todos</button>
          <button type="button" onClick={() => onMonths([])} className="text-slate-500 hover:underline">Ninguno</button>
        </div>
      </div>
      <div className="grid grid-cols-6 gap-1.5">
        {MESES.map((nombre, i) => {
          const m = i + 1
          const on = months.includes(m)
          return (
            <button
              key={m}
              type="button"
              onClick={() => toggle(m)}
              disabled={m > lastMonth}
              title={m > lastMonth ? 'Mes aún no comenzado' : undefined}
              className={cn(
                'py-1.5 rounded-lg border text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
                on ? 'bg-primary-600 text-white border-primary-600' : 'border-slate-200 text-slate-700 hover:bg-slate-50',
              )}
            >
              {nombre}
            </button>
          )
        })}
      </div>
    </div>
  )
}
