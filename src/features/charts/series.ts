import { type MonthlyRow, type ProductRow } from '@/features/siigo/reports'
import { fmtPeriod } from './format'

export const MAX_SERVICES = 8

/** Completa con ceros los meses sin documentos para que la serie sea continua */
export function fillMonths(rows: MonthlyRow[], from: string | null, to: string | null): MonthlyRow[] {
  const byPeriod = new Map(rows.map(r => [r.period, r]))
  const start = from ?? rows[0]?.period
  const end = to ?? rows[rows.length - 1]?.period
  if (!start || !end || start > end) return rows

  const out: MonthlyRow[] = []
  let [y, m] = start.split('-').map(Number) as [number, number]
  for (let i = 0; i < 120; i++) {
    const ym = `${y}-${String(m).padStart(2, '0')}`
    if (ym > end) break
    out.push(byPeriod.get(ym) ?? {
      period: ym, facturas: 0, notasCredito: 0, bruto: 0, subtotal: 0, total: 0,
      totalFacturado: 0, totalNotasCredito: 0,
    })
    m++
    if (m > 12) { m = 1; y++ }
  }
  return out
}

/** Top de servicios por total; el resto se agrupa en "Otros" (nunca se generan colores nuevos) */
export function topServices(rows: ProductRow[]) {
  const sorted = [...rows].sort((a, b) => Number(b.total) - Number(a.total))
  const top = sorted.slice(0, MAX_SERVICES).map(r => ({ name: r.description, total: Number(r.total) }))
  const rest = sorted.slice(MAX_SERVICES)
  if (rest.length) {
    top.push({ name: `Otros (${rest.length})`, total: rest.reduce((s, r) => s + Number(r.total), 0) })
  }
  return top
}

export function toSalesMonthly(rows: MonthlyRow[], range: { from: string | null; to: string | null }) {
  return fillMonths(rows, range.from, range.to).map(m => ({
    ...m,
    label: fmtPeriod(m.period),
    bruto: Number(m.bruto),
    subtotal: Number(m.subtotal ?? 0),
    total: Number(m.total),
    totalFacturado: Number(m.totalFacturado),
    totalNotasCredito: Number(m.totalNotasCredito),
  }))
}

/** Servicios con su subtotal (antes de impuestos) como valor a graficar */
export const bySubtotal = (rows: ProductRow[]) => rows.map(p => ({ ...p, total: Number(p.subtotal ?? p.total) }))

export const MAX_CUSTOMERS = 10
