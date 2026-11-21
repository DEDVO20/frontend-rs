export const money = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
export const compact = new Intl.NumberFormat('es-CO', { notation: 'compact', maximumFractionDigits: 1 })
export const fmtMoney = (n: number) => money.format(n || 0)
export const fmtCompact = (n: number) => `${n < 0 ? '-' : ''}$${compact.format(Math.abs(n || 0))}`

export const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
export const fmtPeriod = (p: string) => {
  const [y, m] = p.split('-')
  return `${MONTHS[Number(m) - 1] ?? m} ${y?.slice(2)}`
}

export const toYm = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

export function lastDayOfMonth(ym: string) {
  const [y, m] = ym.split('-').map(Number)
  return `${ym}-${String(new Date(y!, m!, 0).getDate()).padStart(2, '0')}`
}

export const pct = (part: number, total: number) => (total > 0 ? `${Math.round((part / total) * 100)}%` : '—')

export const fmtDay = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: '2-digit' })
