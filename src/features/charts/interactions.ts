import { fmtPeriod, lastDayOfMonth } from './format'

/** Parámetros de fecha acotados a un mes (YYYY-MM); sin mes devuelve los mismos */
export function monthParams(params: Record<string, string>, month: string | null): Record<string, string> {
  return month ? { ...params, startDate: `${month}-01`, endDate: lastDayOfMonth(month) } : params
}

/** Opacidad de una barra mensual: las que no son el mes seleccionado quedan atenuadas */
export const dimOpacity = (period: string, month: string | null) => (month && period !== month ? 0.3 : 1)

/** Clic en una gráfica: entrega la fila de la barra/columna bajo el cursor */
export function rowClick<T>(rows: T[], onPick?: (row: T) => void) {
  if (!onPick) return undefined
  return (state: { activeTooltipIndex?: unknown }) => {
    const i = state?.activeTooltipIndex
    if (i == null || i === '') return
    const row = rows[Number(i)]
    if (row) onPick(row)
  }
}

/** Clic en una gráfica mensual: selecciona el mes de la columna (o lo quita si ya estaba) */
export function monthClick(rows: { period: string }[], month: string | null, onMonth?: (m: string | null) => void) {
  return rowClick(rows, onMonth && (r => onMonth(r.period === month ? null : r.period)))
}

/** Opacidad de una barra de categoría: atenuada si hay otra seleccionada */
export const dimKey = (key: string, selected: string | null | undefined) => (selected && key !== selected ? 0.3 : 1)

/** Filas seleccionables de una tabla mensual */
export function monthSelect(rows: { period: string }[], month: string | null, onMonth?: (m: string | null) => void): TableSelect | undefined {
  if (!onMonth) return undefined
  return { keys: rows.map(r => r.period), selected: month, onSelect: k => onMonth(k === month ? null : k) }
}

/** Sufijo de etiquetas cuando hay mes seleccionado */
export const monthNote = (month: string | null | undefined) => (month ? ` · ${fmtPeriod(month)}` : '')

/** Filas seleccionables de una tabla: `keys[i]` identifica la fila i */
export interface TableSelect {
  keys: string[]
  selected: string | null
  onSelect: (key: string) => void
}
