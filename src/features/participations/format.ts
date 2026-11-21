export const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

export type DateSel = { year: string; month: string; from: string; to: string }

export function fmtMoney(n: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n ?? 0)
}

/** Impuestos que el cliente retuvo en el recaudo (líneas 1355 del RC). */
export type CollectionTaxes = { income: number; ica: number; iva: number; total: number }

// Estados de la relación (spec §15)
export const INV_STATUS: Record<string, { label: string; cls: string }> = {
  pending_invoice:       { label: 'Pendiente de factura',     cls: 'bg-slate-100 text-slate-500' },
  pending_third_invoice: { label: 'Pendiente factura tercero', cls: 'bg-amber-100 text-amber-700' },
  value_difference:      { label: 'Diferencia de valor',      cls: 'bg-rose-100 text-rose-700' },
  pending_payment:       { label: 'Pendiente de pago',        cls: 'bg-blue-100 text-blue-700' },
  complete:              { label: 'Completa',                 cls: 'bg-emerald-100 text-emerald-700' },
}

export const STATUS_FILTERS: [string, string][] = [
  ['', 'Todas'],
  ['pending_invoice', 'Pendiente de factura'],
  ['pending_third_invoice', 'Pendiente factura tercero'],
  ['value_difference', 'Diferencia de valor'],
  ['pending_payment', 'Pendiente de pago'],
  ['complete', 'Completas'],
]

export const DOC_BADGE: Record<string, string> = {
  FV: 'bg-slate-100 text-slate-600', RC: 'bg-blue-100 text-blue-700', NC: 'bg-rose-100 text-rose-700',
  ND: 'bg-amber-100 text-amber-700', FC: 'bg-violet-100 text-violet-700', RP: 'bg-emerald-100 text-emerald-700',
}

// ── Conciliación manual asistida (dinero: RC/FC/RP) ──────────────────────────
export const normNit = (s: any) => String(s ?? '').replace(/[^0-9]/g, '')

export const DOC_TONE: Record<string, { badge: string; text: string; label: string }> = {
  RC: { badge: 'bg-blue-100 text-blue-800', text: 'text-blue-700', label: 'Recaudo cliente' },
  FC: { badge: 'bg-violet-100 text-violet-800', text: 'text-violet-700', label: 'Factura tercero' },
  RP: { badge: 'bg-emerald-100 text-emerald-800', text: 'text-emerald-700', label: 'Pago tercero' },
}
