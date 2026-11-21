import { useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

import { Button } from '@/components/ui/Button'

import { CheckCircle2, ChevronDown, Calendar, Edit2 } from 'lucide-react'
import { MONTHS, type DateSel, fmtMoney, type CollectionTaxes } from './format'

/** Selector de fecha unificado: Año + Mes (o rango de fechas), en un popover. */
export function DateFilter({ value, onChange }: { value: DateSel; onChange: (v: DateSel) => void }) {
  const [open, setOpen] = useState(false)
  const { year, month, from, to } = value
  const nowYear = new Date().getFullYear()
  const years = [nowYear + 1, nowYear, nowYear - 1, nowYear - 2].map(String)

  const fmt = (d: string) => d ? d.split('-').reverse().join('/') : '…'
  const label =
    (from || to) ? `${fmt(from)} – ${fmt(to)}`
    : (year && month) ? `${MONTHS[Number(month) - 1]} ${year}`
    : year ? `Año ${year}`
    : 'Todas las fechas'
  const active = !!(year || month || from || to)

  return (
    <div className="relative">
      <Button size="sm" variant="secondary" onClick={() => setOpen(o => !o)}>
        <Calendar className="w-3.5 h-3.5" /> {label}
        {active && <span className="w-1.5 h-1.5 rounded-full bg-primary-600" />}
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 mt-1 z-20 bg-white border border-slate-200 rounded-xl shadow-lg p-3 w-64 space-y-3">
            {/* Año + Mes */}
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Por mes y año</p>
              <div className="grid grid-cols-2 gap-2">
                <select value={year} onChange={e => onChange({ year: e.target.value, month, from: '', to: '' })}
                  className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary-500">
                  <option value="">Año…</option>
                  {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                <select value={month} onChange={e => onChange({ year: year || String(nowYear), month: e.target.value, from: '', to: '' })}
                  className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary-500">
                  <option value="">Todos</option>
                  {MONTHS.map((m, i) => <option key={m} value={String(i + 1).padStart(2, '0')}>{m}</option>)}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="h-px bg-slate-100 flex-1" />
              <span className="text-[10px] text-slate-400 uppercase">o rango</span>
              <div className="h-px bg-slate-100 flex-1" />
            </div>

            {/* Rango de fechas */}
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Rango de fechas</p>
              <div className="space-y-1.5">
                <label className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400 w-10 shrink-0">Desde</span>
                  <input type="date" value={from} max={to || undefined} onChange={e => onChange({ year: '', month: '', from: e.target.value, to })}
                    className="flex-1 min-w-0 text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </label>
                <label className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400 w-10 shrink-0">Hasta</span>
                  <input type="date" value={to} min={from || undefined} onChange={e => onChange({ year: '', month: '', from, to: e.target.value })}
                    className="flex-1 min-w-0 text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </label>
              </div>
            </div>

            <div className="flex justify-between pt-1">
              <button onClick={() => onChange({ year: '', month: '', from: '', to: '' })}
                className="text-xs text-slate-500 hover:text-slate-700 underline">Limpiar</button>
              <button onClick={() => setOpen(false)}
                className="text-xs font-medium text-primary-600 hover:text-primary-700">Listo</button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export function RcTaxesLine({ taxes }: { taxes?: CollectionTaxes | null }) {
  if (!taxes || !(taxes.total > 0)) return null
  const parts = [
    taxes.income > 0 && `Ret. fte ${fmtMoney(taxes.income)}`,
    taxes.ica > 0 && `ReteICA ${fmtMoney(taxes.ica)}`,
    taxes.iva > 0 && `ReteIVA ${fmtMoney(taxes.iva)}`,
  ].filter(Boolean)
  return (
    <div className="text-[10px] text-amber-700" title={parts.join(' · ')}>
      Imp. retenidos {fmtMoney(taxes.total)}
      <span className="text-slate-400"> ({parts.join(' · ')})</span>
    </div>
  )
}

export function DocTypeFilter({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div className="flex gap-1">
      {['', ...options].map(t => (
        <button key={t} onClick={() => onChange(t)}
          className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${value === t ? 'border-primary-300 bg-primary-50 text-primary-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
          {t || 'Todos'}
        </button>
      ))}
    </div>
  )
}

/** Saldo que le queda libre a cada documento (RC/FC/RP) asignado a la OC, para
 *  saber cuánto se puede aplicar todavía a otras OC. */
export function AssignedDocsBalance({ docType, nit, comprobantes }: { docType: 'FV' | 'RC' | 'FC' | 'RP'; nit: string; comprobantes?: string | null }) {
  const norm = (s: string) => String(s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  const list = String(comprobantes ?? '').split(',').map(s => s.trim()).filter(Boolean)
  const { data: docs } = useQuery({
    queryKey: ['participations', 'available-documents', docType, nit],
    enabled: !!nit && list.length > 0,
    queryFn: async () => ((await api.get(`/api/participations/available-documents?doc_type=${docType}&nit=${encodeURIComponent(nit)}`)).data ?? []) as any[],
  })
  if (!list.length || !docs) return null
  const wanted = new Set(list.map(norm))
  const mine = docs.filter((d: any) => wanted.has(norm(d.comprobante)))
  if (!mine.length) return null
  return (
    <div className="mt-1 rounded-lg bg-slate-50 border border-slate-100 px-2.5 py-1.5 space-y-0.5">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Saldo libre para otras OC</p>
      {mine.map((d: any) => {
        const total = Number(d.amount ?? 0)
        const avail = Number(d.available ?? 0)
        return (
          <div key={d.id}>
            <div className="flex justify-between gap-3 text-[11px]">
              <span className="font-mono font-semibold text-slate-700">{d.comprobante}</span>
              <span className={avail > 0.01 ? 'font-semibold text-emerald-700' : 'text-slate-400'}>
                {avail > 0.01 ? `${fmtMoney(avail)} de ${fmtMoney(total)}` : `sin saldo (${fmtMoney(total)} asignado)`}
              </span>
            </div>
            {(d.holders ?? []).length > 1 && (
              <div className="text-[10px] text-slate-400 leading-snug">
                {(d.holders as any[]).map((h, i) => (
                  <span key={i} className={h.finto_invoice ? '' : 'text-amber-700 font-medium'}>
                    {i > 0 && ' · '}{h.purchase_order} ({h.finto_invoice ?? 'sin FV'}) {fmtMoney(Number(h.amount))}
                  </span>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export function DetailField({ label, value, mono }: { label: string; value: any; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4 py-1">
      <span className="text-xs text-slate-400">{label}</span>
      <span className={`text-sm text-slate-700 text-right ${mono ? 'font-mono text-[12px]' : ''}`}>{value ?? '—'}</span>
    </div>
  )
}

export function DetailStage({
  n,
  title,
  done,
  editable,
  isEditing,
  onToggleEdit,
  children,
}: {
  n: number
  title: string
  done: boolean
  editable?: boolean
  isEditing?: boolean
  onToggleEdit?: () => void
  children: ReactNode
}) {
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden transition-shadow hover:shadow-sm">
      <div className={`px-4 py-2 flex items-center gap-2 ${done ? 'bg-emerald-50' : 'bg-slate-50'}`}>
        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${done ? 'bg-emerald-500 text-white' : 'bg-slate-300 text-white'}`}>{n}</span>
        <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">{title}</span>
        <div className="ml-auto flex items-center gap-2">
          {done && !isEditing && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
          {editable && onToggleEdit && (
            <button
              type="button"
              onClick={onToggleEdit}
              className={`text-[11px] font-semibold px-2 py-0.5 rounded transition-colors flex items-center gap-1 ${
                isEditing
                  ? 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                  : 'bg-white border border-slate-200 text-slate-600 hover:text-primary-600 hover:border-primary-300 shadow-xs'
              }`}
            >
              <Edit2 className="w-3 h-3" />
              {isEditing ? 'Cancelar' : 'Editar'}
            </button>
          )}
        </div>
      </div>
      <div className="px-4 py-3">{children}</div>
    </div>
  )
}
