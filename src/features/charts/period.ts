import { useState } from 'react'
import { MONTHS, toYm, lastDayOfMonth } from './format'

/** Atajos relativos a hoy, un mes concreto ('month') o un rango de fechas exacto ('range') */
export type Preset = 'month-current' | 'month-previous' | '3m' | '12m' | 'year-current' | 'year-previous' | 'all' | 'month' | 'range'

export const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

/** Fecha local como YYYY-MM-DD (sin desfase por zona horaria) */
export const toYmd = (d: Date) => `${toYm(d)}-${String(d.getDate()).padStart(2, '0')}`

/** "15 mar 2026" */
export const fmtFullDay = (ymd: string) => {
  const [y, m, d] = ymd.split('-')
  return `${Number(d)} ${MONTHS[Number(m) - 1] ?? m} ${y}`
}

/**
 * Fechas exactas [desde, hasta] del filtro de periodo (YYYY-MM-DD); null = sin límite.
 * Atajos relativos a hoy, un mes concreto o un rango de fechas exacto.
 */
export function presetDates(preset: Preset, monthPick: string, dateFrom: string, dateTo: string): { start: string | null; end: string | null } {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  const today = toYmd(now)
  switch (preset) {
    case 'month-current':  return { start: `${toYm(now)}-01`, end: today }
    case 'month-previous': { const p = toYm(new Date(y, m - 1, 1)); return { start: `${p}-01`, end: lastDayOfMonth(p) } }
    case '3m':             return { start: `${toYm(new Date(y, m - 2, 1))}-01`, end: today }
    case '12m':            return { start: `${toYm(new Date(y, m - 11, 1))}-01`, end: today }
    case 'year-current':   return { start: `${y}-01-01`, end: today }
    case 'year-previous':  return { start: `${y - 1}-01-01`, end: `${y - 1}-12-31` }
    case 'month':          return monthPick ? { start: `${monthPick}-01`, end: lastDayOfMonth(monthPick) } : { start: null, end: null }
    case 'range':          return { start: dateFrom || null, end: dateTo || null }
    default:               return { start: null, end: null }
  }
}

/** Texto del periodo aplicado, para que siempre quede claro qué se está viendo */
export function describeDates(start: string | null, end: string | null): string {
  if (!start && !end) return 'Todo el histórico'
  if (start && end) return `${fmtFullDay(start)} – ${fmtFullDay(end)}`
  return start ? `Desde ${fmtFullDay(start)}` : `Hasta ${fmtFullDay(end!)}`
}

/**
 * Filtro por periodo (compartido por la página de gráficas y el dashboard del cliente).
 * `month` es el mes seleccionado con un clic en una gráfica o tabla mensual: acota las cifras
 * y los desgloses a ese mes, mientras las series mes a mes siguen mostrando todo el periodo.
 */
export function usePeriodFilter() {
  const [preset, setPresetRaw] = useState<Preset>('12m')
  const [monthPick, setMonthPickRaw] = useState(() => toYm(new Date()))
  const [dateFrom, setDateFromRaw] = useState('')
  const [dateTo, setDateToRaw] = useState('')
  const [month, setMonth] = useState<string | null>(null)
  // Cambiar el periodo quita el mes seleccionado (podría quedar fuera del rango)
  const setPreset = (p: Preset) => {
    // El rango exacto arranca con las fechas del periodo que se estaba viendo, para ajustarlo desde ahí
    if (p === 'range' && !dateFrom && !dateTo) {
      const cur = presetDates(preset, monthPick, dateFrom, dateTo)
      setDateFromRaw(cur.start ?? '')
      setDateToRaw(cur.end ?? '')
    }
    setPresetRaw(p)
    setMonth(null)
  }
  const setMonthPick = (v: string) => { setMonthPickRaw(v); setMonth(null) }
  const setDateFrom = (v: string) => { setDateFromRaw(v); setMonth(null) }
  const setDateTo = (v: string) => { setDateToRaw(v); setMonth(null) }

  const dates = presetDates(preset, monthPick, dateFrom, dateTo)
  // Un rango invertido (desde > hasta) no se aplica hasta corregirlo
  const invalid = Boolean(dates.start && dates.end && dates.start > dates.end)
  const start = invalid ? null : dates.start
  const end = invalid ? null : dates.end
  // Meses que cubre el periodo, para las series mes a mes
  const range = { from: start?.slice(0, 7) ?? null, to: end?.slice(0, 7) ?? null }
  const dateParams: Record<string, string> = {
    ...(start ? { startDate: start } : {}),
    ...(end ? { endDate: end } : {}),
  }
  return {
    preset, setPreset, monthPick, setMonthPick, dateFrom, setDateFrom, dateTo, setDateTo,
    invalid, label: describeDates(start, end), month, setMonth, range, dateParams,
  }
}

export type PeriodFilter = ReturnType<typeof usePeriodFilter>
