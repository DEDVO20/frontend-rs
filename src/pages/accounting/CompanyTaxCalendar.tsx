import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { PageLoader } from '@/components/ui/Spinner'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { toast } from 'sonner'
import { CalendarDays, ListChecks, Plus, Trash2, X } from 'lucide-react'
import { PERIODICITY_LABELS } from './taxCalendar'

const fmtDate = (d: string) => {
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

type View = 'obligations' | 'chronological'

// ── Fecha de un período (guarda al salir del campo para no disparar con cada tecla) ──

function DeadlineRow({ d, mandatory, onDelete }: { d: any; mandatory: boolean; onDelete?: () => void }) {
  const qc = useQueryClient()
  const mut = useMutation({
    mutationFn: async (due_date: string | null) => { await api.patch(`/api/accounting/deadlines/${d.id}`, { due_date }) },
    onSuccess: () => { toast.success('Fecha actualizada'); qc.invalidateQueries({ queryKey: ['accounting'] }) },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Error al guardar la fecha'),
  })

  const missing = !d.due_date && mandatory

  return (
    <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${missing ? 'border-amber-200 bg-amber-50/60' : 'border-slate-100 bg-slate-50/50'}`}>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-slate-700 truncate" title={d.period_label}>{d.period_label}</p>
        {d.is_custom && <p className="text-[10px] text-slate-400">Fecha adicional</p>}
      </div>
      <input
        type="date"
        key={d.id + (d.due_date ?? '')}
        defaultValue={d.due_date ?? ''}
        onBlur={ev => {
          const v = ev.target.value || null
          if (v !== (d.due_date ?? null)) mut.mutate(v)
        }}
        className={`text-sm border rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 ${missing ? 'border-amber-300' : 'border-slate-200'}`}
      />
      {onDelete && (
        <button onClick={onDelete} className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500" title="Eliminar fecha adicional">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}

// ── Formulario de fecha adicional (ej. "Pago 2a cuota") ─────────────────────

function AddDeadlineForm({ entryId, year, onDone }: { entryId: string; year: number; onDone: () => void }) {
  const qc = useQueryClient()
  const [label, setLabel] = useState('')
  const [date, setDate] = useState('')
  const mut = useMutation({
    mutationFn: async () => {
      await api.post(`/api/accounting/entries/${entryId}/deadlines`, { year, period_label: label.trim(), due_date: date || null })
    },
    onSuccess: () => { toast.success('Fecha adicional agregada'); qc.invalidateQueries({ queryKey: ['accounting'] }); onDone() },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Error al agregar la fecha'),
  })

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-primary-300 bg-primary-50/40 px-3 py-2">
      <input value={label} onChange={e => setLabel(e.target.value)} placeholder="Ej: Pago 2a cuota"
        className="flex-1 min-w-[160px] text-sm border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary-500" />
      <input type="date" value={date} onChange={e => setDate(e.target.value)}
        className="text-sm border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary-500" />
      <button disabled={label.trim().length < 2 || mut.isPending} onClick={() => mut.mutate()}
        className="text-xs font-medium px-3 py-1.5 rounded-lg bg-primary-600 text-white disabled:opacity-50">
        Agregar
      </button>
      <button onClick={onDone} className="p-1 rounded hover:bg-slate-100 text-slate-400"><X className="w-3.5 h-3.5" /></button>
    </div>
  )
}

// ── Calendario tributario de una empresa ──────────────────────────────────────

export function CompanyTaxCalendar({ companyId, year }: { companyId: string; year: number }) {
  const qc = useQueryClient()
  const confirm = useConfirm()
  const [view, setView] = useState<View>('obligations')
  const [adding, setAdding] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['accounting', 'calendar', companyId, year],
    queryFn: async () => { const { data } = await api.get(`/api/accounting/companies/${companyId}`, { params: { year } }); return data },
  })
  const entries: any[] = data?.entries ?? []

  const periodicityMut = useMutation({
    mutationFn: async ({ id, periodicity }: { id: string; periodicity: string | null }) => {
      await api.patch(`/api/accounting/entries/${id}`, { periodicity })
    },
    onSuccess: () => { toast.success('Periodicidad actualizada'); qc.invalidateQueries({ queryKey: ['accounting'] }) },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Error al cambiar la periodicidad'),
  })

  const deleteMut = useMutation({
    mutationFn: async (id: string) => { await api.delete(`/api/accounting/deadlines/${id}`) },
    onSuccess: () => { toast.success('Fecha eliminada'); qc.invalidateQueries({ queryKey: ['accounting'] }) },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Error al eliminar'),
  })

  if (isLoading) return <div className="py-10"><PageLoader /></div>
  if (!entries.length) {
    return <p className="bg-white border border-slate-200 rounded-xl px-4 py-12 text-center text-slate-400 text-sm">La plantilla maestra está vacía</p>
  }

  // Vista cronológica: todas las fechas del año ordenadas, como el calendario de la empresa
  const chronological = entries
    .flatMap(e => e.deadlines.map((d: any) => ({ ...d, entry: e })))
    .filter((d: any) => d.due_date)
    .sort((a: any, b: any) => a.due_date.localeCompare(b.due_date))
  const withoutDate = entries.reduce((n, e) => n + e.deadlines.filter((d: any) => !d.due_date).length, 0)
  const today = new Date().toISOString().slice(0, 10)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          {([['obligations', 'Por obligación', ListChecks], ['chronological', 'Cronológico', CalendarDays]] as const).map(([k, l, Icon]) => (
            <button key={k} onClick={() => setView(k)}
              className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md transition-colors ${view === k ? 'bg-white text-primary-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              <Icon className="w-3.5 h-3.5" /> {l}
            </button>
          ))}
        </div>
        {withoutDate > 0 && <span className="text-xs text-amber-600 font-medium">{withoutDate} fecha(s) sin diligenciar en {year}</span>}
      </div>

      {view === 'obligations' ? (
        entries.map((e: any) => {
          const generated = e.deadlines.filter((d: any) => !d.is_custom)
          const custom    = e.deadlines.filter((d: any) => d.is_custom)
          const dated     = generated.filter((d: any) => d.due_date).length
          const defaultPeriodicity = e.master?.periodicity ?? 'anual'
          return (
            <div key={e.id} className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-slate-900">{e.master?.title ?? '—'}</p>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${e.is_mandatory ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                      {e.is_mandatory ? 'Obligatoria' : 'Opcional'}
                    </span>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${dated === generated.length ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                      {dated}/{generated.length} fechas
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    {[e.master?.entity, e.master?.description].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <label className="flex items-center gap-2 text-xs text-slate-500 shrink-0">
                  Periodicidad
                  <select
                    value={e.periodicity ?? ''}
                    onChange={ev => {
                      const periodicity = ev.target.value || null
                      confirm({
                        title: '¿Cambiar la periodicidad para esta empresa?',
                        description: `Se regenerarán los períodos desde ${new Date().getFullYear()} y se perderán las fechas ya diligenciadas de los períodos generados (las fechas adicionales se conservan).`,
                        type: 'warning',
                        confirmLabel: 'Cambiar',
                        onConfirm: () => periodicityMut.mutateAsync({ id: e.id, periodicity }).then(() => {}),
                      })
                    }}
                    className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500">
                    <option value="">{PERIODICITY_LABELS[defaultPeriodicity]} (por defecto)</option>
                    {Object.entries(PERIODICITY_LABELS).filter(([k]) => k !== defaultPeriodicity).map(([k, l]) => (
                      <option key={k} value={k}>{l}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
                {generated.map((d: any) => <DeadlineRow key={d.id} d={d} mandatory={e.is_mandatory} />)}
                {custom.map((d: any) => (
                  <DeadlineRow key={d.id} d={d} mandatory={false}
                    onDelete={() => confirm({
                      title: `¿Eliminar "${d.period_label}"?`,
                      type: 'danger',
                      confirmLabel: 'Eliminar',
                      onConfirm: () => deleteMut.mutateAsync(d.id).then(() => {}),
                    })} />
                ))}
              </div>

              <div className="mt-2">
                {adding === e.id ? (
                  <AddDeadlineForm entryId={e.id} year={year} onDone={() => setAdding(null)} />
                ) : (
                  <button onClick={() => setAdding(e.id)} className="flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700">
                    <Plus className="w-3.5 h-3.5" /> Agregar fecha adicional (cuota, corrección…)
                  </button>
                )}
              </div>
            </div>
          )
        })
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {['Fecha límite', 'Entidad', 'Obligación', 'Período / Detalle'].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {chronological.map((d: any) => (
                <tr key={d.id} className={d.due_date < today ? 'text-slate-400' : ''}>
                  <td className="px-4 py-2.5 font-medium whitespace-nowrap">{fmtDate(d.due_date)}</td>
                  <td className="px-4 py-2.5">{d.entry.master?.entity ?? '—'}</td>
                  <td className="px-4 py-2.5">{d.entry.master?.title ?? '—'}</td>
                  <td className="px-4 py-2.5">{d.period_label}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!chronological.length && (
            <p className="px-4 py-12 text-center text-slate-400 text-sm">Aún no hay fechas diligenciadas para {year}</p>
          )}
        </div>
      )}
    </div>
  )
}
