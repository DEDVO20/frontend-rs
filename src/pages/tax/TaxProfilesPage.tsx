import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { TopBar } from '@/components/layout/TopBar'
import { Button } from '@/components/ui/Button'
import { PageLoader } from '@/components/ui/Spinner'
import { formatCurrency } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { toast } from 'sonner'
import { X, SlidersHorizontal, Calculator, Settings2, Plus, Trash2 } from 'lucide-react'
import { emptyTaxProfile, type TaxProfile } from './taxTypes'

const INTERNAL_EDIT = ['admin', 'rs_admin', 'rs_staff']

// ── Tipos del resultado del motor (espejo de tax.domain) ─────────────────────
interface WithholdingLine { applied: boolean; base: number; rate: number; amount: number; reason: string }
interface OperationResult {
  invoiceBase: number; invoiceIva: number; invoiceTotal: number
  incomeWithholding: WithholdingLine; icaWithholding: WithholdingLine; ivaWithholding: WithholdingLine
  invoicePayment: number
  commission: number; commissionIva: number; commissionTotal: number
  commissionIncomeWithholding: WithholdingLine; commissionIcaWithholding: WithholdingLine; commissionNet: number
  finalTotal: number
}
interface MatrixColumn {
  id: string; name: string
  profile: { taxRegime: string; ivaResponsible: boolean; grandTaxpayer: boolean; selfWithholder: boolean }
  result: OperationResult
}
interface Settings {
  iva_rate: number; income_withholding_rate: number; ica_withholding_rate: number
  iva_withholding_rate: number; commission_rate: number; commission_iva_rate: number
  default_invoice_value: number
}
interface MatrixResponse { invoiceValue: number; settings: Settings; columns: MatrixColumn[] }

// ── Filas de la matriz (spec §8) ─────────────────────────────────────────────
type RowDef = { label: string; get: (r: OperationResult) => number; strong?: boolean; muted?: boolean }
const SECTIONS: { title: string; rows: RowDef[] }[] = [
  {
    title: 'Factura',
    rows: [
      { label: 'Factura (base)',      get: r => r.invoiceBase },
      { label: 'IVA factura',         get: r => r.invoiceIva },
      { label: 'Valor factura',       get: r => r.invoiceTotal, strong: true },
      { label: 'Retención fuente',    get: r => r.incomeWithholding.amount, muted: true },
      { label: 'Retención ICA',       get: r => r.icaWithholding.amount, muted: true },
      { label: 'Retención IVA',       get: r => r.ivaWithholding.amount, muted: true },
      { label: 'Pago / giro factura', get: r => r.invoicePayment, strong: true },
    ],
  },
  {
    title: 'Comisión',
    rows: [
      { label: 'Comisión',            get: r => r.commission },
      { label: 'IVA comisión',        get: r => r.commissionIva },
      { label: 'Total comisión',      get: r => r.commissionTotal, strong: true },
      { label: 'Retefuente comisión', get: r => r.commissionIncomeWithholding.amount, muted: true },
      { label: 'ReteICA comisión',    get: r => r.commissionIcaWithholding.amount, muted: true },
      { label: 'Comisión neta',       get: r => r.commissionNet, strong: true },
    ],
  },
]

// ═════════════════════════════════════════════════════════════════════════════
export function TaxProfilesPage() {
  const qc = useQueryClient()
  const role = useAuthStore(s => s.user?.role ?? '')
  const canEdit = INTERNAL_EDIT.includes(role)

  const [invoiceValue, setInvoiceValue] = useState<number | null>(null)
  const [draftValue, setDraftValue] = useState('')
  const [showParams, setShowParams] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)   // '' ⇒ crear nuevo

  const { data, isLoading } = useQuery<MatrixResponse>({
    queryKey: ['tax-matrix', invoiceValue],
    queryFn: async () => {
      const params = invoiceValue != null ? { invoice_value: invoiceValue } : {}
      const { data } = await api.get('/api/tax/matrix', { params })
      return data
    },
  })

  useEffect(() => { if (data && draftValue === '') setDraftValue(String(data.invoiceValue)) }, [data]) // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading || !data) return <PageLoader />

  const applyValue = () => {
    const v = Number(draftValue.replace(/[^\d.]/g, ''))
    if (!isFinite(v) || v < 0) { toast.error('Valor de factura inválido'); return }
    setInvoiceValue(v)
  }
  const refresh = () => qc.invalidateQueries({ queryKey: ['tax-matrix'] })

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Perfiles tributarios" subtitle="Catálogo DIAN y matriz comparativa (Colombia)" />

      <div className="flex-1 overflow-auto p-6 space-y-4">
        {/* Controles */}
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Valor de la factura</label>
            <div className="flex gap-2">
              <input value={draftValue} onChange={e => setDraftValue(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && applyValue()} inputMode="numeric"
                className="w-44 text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500" />
              <Button size="sm" onClick={applyValue}><Calculator className="w-3.5 h-3.5" /> Calcular</Button>
            </div>
          </div>
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => setShowParams(v => !v)}>
              <Settings2 className="w-3.5 h-3.5" /> Parámetros
            </Button>
            {canEdit && (
              <Button size="sm" onClick={() => setEditId('')}><Plus className="w-3.5 h-3.5" /> Nuevo perfil</Button>
            )}
          </div>
        </div>

        {showParams && <ParamsPanel settings={data.settings} canEdit={canEdit}
          onSaved={() => { refresh(); toast.success('Parámetros actualizados') }} />}

        {/* Matriz comparativa */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left font-semibold text-slate-500 px-4 py-3 sticky left-0 bg-slate-50 min-w-[200px]">Concepto</th>
                  {data.columns.map(col => (
                    <th key={col.id} className="px-4 py-3 text-right min-w-[160px] align-top">
                      <button onClick={() => canEdit && setEditId(col.id)}
                        className={`font-semibold text-slate-800 text-right ${canEdit ? 'hover:text-primary-600 cursor-pointer' : 'cursor-default'}`}
                        title={canEdit ? 'Editar perfil' : undefined}>
                        {col.name}
                      </button>
                      <div className="flex flex-wrap gap-1 justify-end mt-1">
                        <Badge>{col.profile.taxRegime === 'SIMPLE' ? 'SIMPLE' : 'Ordinario'}</Badge>
                        <Badge tone={col.profile.ivaResponsible ? 'green' : 'slate'}>{col.profile.ivaResponsible ? 'Resp. IVA' : 'No IVA'}</Badge>
                        {col.profile.grandTaxpayer && <Badge tone="amber">Gran Contrib.</Badge>}
                        {col.profile.selfWithholder && <Badge tone="blue">Autorret.</Badge>}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SECTIONS.map(section => <SectionRows key={section.title} section={section} columns={data.columns} />)}
                <tr className="bg-primary-50 border-t-2 border-primary-200">
                  <td className="px-4 py-3 font-bold text-primary-900 sticky left-0 bg-primary-50">Total final (giro)</td>
                  {data.columns.map(col => (
                    <td key={col.id} className="px-4 py-3 text-right font-bold text-primary-900 tabular-nums">{formatCurrency(col.result.finalTotal)}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <p className="text-xs text-slate-400 max-w-3xl">
          Las tarifas son las del escenario de ejemplo y son parametrizables. Para producción, validar las
          tarifas y condiciones tributarias vigentes en Colombia por cada tercero. El receptor de la matriz
          actúa como agente de todas las retenciones. Asigna estos perfiles a los terceros desde <b>Terceros</b>.
        </p>
      </div>

      {editId !== null && (
        <ProfileDrawer id={editId || null} onClose={() => setEditId(null)}
          onSaved={() => { refresh(); qc.invalidateQueries({ queryKey: ['tax-profiles'] }); setEditId(null); toast.success('Perfil guardado') }} />
      )}
    </div>
  )
}

function SectionRows({ section, columns }: { section: typeof SECTIONS[number]; columns: MatrixColumn[] }) {
  return (
    <>
      <tr className="bg-slate-100/60">
        <td colSpan={columns.length + 1} className="px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 sticky left-0 bg-slate-100/60">{section.title}</td>
      </tr>
      {section.rows.map(rowDef => (
        <tr key={rowDef.label} className="border-b border-slate-100 hover:bg-slate-50/60">
          <td className={`px-4 py-2 sticky left-0 bg-white ${rowDef.strong ? 'font-semibold text-slate-800' : 'text-slate-600'}`}>{rowDef.label}</td>
          {columns.map(col => {
            const v = rowDef.get(col.result)
            return (
              <td key={col.id} className={`px-4 py-2 text-right tabular-nums ${rowDef.strong ? 'font-semibold text-slate-900' : rowDef.muted && v > 0 ? 'text-red-600' : 'text-slate-600'}`}>
                {rowDef.muted && v > 0 ? `−${formatCurrency(v)}` : formatCurrency(v)}
              </td>
            )
          })}
        </tr>
      ))}
    </>
  )
}

function Badge({ children, tone = 'slate' }: { children: React.ReactNode; tone?: 'slate' | 'green' | 'amber' | 'blue' }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-500', green: 'bg-green-100 text-green-700',
    amber: 'bg-amber-100 text-amber-700', blue: 'bg-blue-100 text-blue-700',
  }
  return <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${tones[tone]}`}>{children}</span>
}

// ── Panel de parámetros de la operación (spec §3, §10) ───────────────────────
function ParamsPanel({ settings, canEdit, onSaved }: { settings: Settings; canEdit: boolean; onSaved: () => void }) {
  const [form, setForm] = useState({
    iva_rate: settings.iva_rate * 100, income_withholding_rate: settings.income_withholding_rate * 100,
    ica_withholding_rate: settings.ica_withholding_rate * 100, iva_withholding_rate: settings.iva_withholding_rate * 100,
    commission_rate: settings.commission_rate * 100, commission_iva_rate: settings.commission_iva_rate * 100,
  })
  const mut = useMutation({
    mutationFn: async () => {
      const payload = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, Number(v) / 100]))
      await api.patch('/api/tax/settings', payload)
    },
    onSuccess: onSaved, onError: () => toast.error('No se pudo guardar'),
  })
  const fields: { key: keyof typeof form; label: string }[] = [
    { key: 'iva_rate', label: 'IVA factura' }, { key: 'income_withholding_rate', label: 'Retefuente' },
    { key: 'ica_withholding_rate', label: 'ReteICA' }, { key: 'iva_withholding_rate', label: 'ReteIVA' },
    { key: 'commission_rate', label: 'Comisión' }, { key: 'commission_iva_rate', label: 'IVA comisión' },
  ]
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <SlidersHorizontal className="w-4 h-4 text-slate-400" />
        <h3 className="text-sm font-semibold text-slate-700">Tarifas por defecto de la operación (%)</h3>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {fields.map(f => (
          <label key={f.key} className="block">
            <span className="block text-[11px] text-slate-400 mb-1">{f.label}</span>
            <input type="number" step="0.001" disabled={!canEdit} value={form[f.key]}
              onChange={e => setForm(s => ({ ...s, [f.key]: e.target.value as any }))}
              className="w-full text-sm border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 disabled:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </label>
        ))}
      </div>
      {canEdit && <div className="flex justify-end mt-3"><Button size="sm" loading={mut.isPending} onClick={() => mut.mutate()}>Guardar tarifas</Button></div>}
    </div>
  )
}

// ── Drawer de creación/edición de un PERFIL del catálogo (spec §1, §2) ───────
function ProfileDrawer({ id, onClose, onSaved }: { id: string | null; onClose: () => void; onSaved: () => void }) {
  const isNew = id === null
  const { data: loaded, isLoading } = useQuery<TaxProfile>({
    queryKey: ['tax-profile', id], enabled: !isNew,
    queryFn: async () => (await api.get(`/api/tax/profiles/${id}`)).data,
  })
  const [form, setForm] = useState<TaxProfile>(emptyTaxProfile())
  useEffect(() => { if (loaded) setForm(loaded) }, [loaded])
  const confirm = useConfirm()

  const mut = useMutation({
    mutationFn: async () => {
      if (isNew) await api.post('/api/tax/profiles', form)
      else { const { id: _i, ...payload } = form; await api.patch(`/api/tax/profiles/${id}`, payload) }
    },
    onSuccess: onSaved,
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'No se pudo guardar el perfil'),
  })

  const del = useMutation({
    mutationFn: async () => (await api.delete(`/api/tax/profiles/${id}`)).data as { unassigned: number },
    onSuccess: (r) => {
      onSaved()
      toast.success(r.unassigned > 0
        ? `Perfil eliminado. ${r.unassigned} tercero(s) quedaron sin perfil.`
        : 'Perfil eliminado.')
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'No se pudo eliminar el perfil'),
  })

  const askDelete = () => confirm({
    title: `¿Eliminar "${form.name}"?`,
    description: 'Se eliminará el perfil tributario. Los terceros que lo tengan asignado quedarán sin perfil.',
    type: 'danger',
    confirmLabel: 'Eliminar',
    onConfirm: async () => { await del.mutateAsync() },
  })

  const set = <K extends keyof TaxProfile>(k: K, v: TaxProfile[K]) => setForm(s => ({ ...s, [k]: v }))

  return (
    <div className="fixed inset-0 z-30 flex justify-end">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white h-full shadow-xl overflow-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 bg-white">
          <h2 className="text-base font-semibold text-slate-800">{isNew ? 'Nuevo perfil tributario' : (form.name || 'Perfil')}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>

        {!isNew && isLoading ? <div className="p-8"><PageLoader /></div> : (
          <div className="p-5 space-y-5">
            <Field label="Nombre">
              <input value={form.name} onChange={e => set('name', e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-2 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </Field>
            <Field label="Descripción">
              <textarea value={form.description ?? ''} onChange={e => set('description', e.target.value)} rows={2}
                className="w-full text-sm border border-slate-200 rounded-lg px-2 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </Field>
            <Field label="Régimen de renta">
              <Select value={form.tax_regime} onChange={v => set('tax_regime', v as any)}
                options={[['ORDINARY', 'Ordinario'], ['SIMPLE', 'Simple (SIMPLE)']]} />
            </Field>

            <div className="space-y-2">
              <Check label="Responsable de IVA" checked={form.iva_responsible} onChange={v => set('iva_responsible', v)} />
              <Check label="Gran contribuyente" checked={form.grand_taxpayer} onChange={v => set('grand_taxpayer', v)} />
              <Check label="Autorretenedor de renta" checked={form.self_withholder} onChange={v => set('self_withholder', v)} />
            </div>

            <Group title="Sujeto a retención (como emisor)">
              <Check label="Retención en la fuente" checked={form.subject_income_withholding} onChange={v => set('subject_income_withholding', v)} />
              <Check label="ReteICA" checked={form.subject_ica_withholding} onChange={v => set('subject_ica_withholding', v)} />
              <Check label="ReteIVA" checked={form.subject_iva_withholding} onChange={v => set('subject_iva_withholding', v)} />
            </Group>

            <Group title="Agente retenedor (como receptor)">
              <Check label="Agente de retefuente" checked={form.agent_income_withholding} onChange={v => set('agent_income_withholding', v)} />
              <Check label="Agente de reteICA" checked={form.agent_ica_withholding} onChange={v => set('agent_ica_withholding', v)} />
              <Check label="Agente de reteIVA" checked={form.agent_iva_withholding} onChange={v => set('agent_iva_withholding', v)} />
            </Group>

            <Group title="Tarifas propias (%) — vacío usa la tarifa de la operación">
              <RateField label="IVA" value={form.iva_rate} onChange={v => set('iva_rate', v)} />
              <RateField label="Retefuente" value={form.income_withholding_rate} onChange={v => set('income_withholding_rate', v)} />
              <RateField label="ReteICA" value={form.ica_withholding_rate} onChange={v => set('ica_withholding_rate', v)} />
              <RateField label="ReteIVA" value={form.iva_withholding_rate} onChange={v => set('iva_withholding_rate', v)} />
            </Group>

            <div className="flex items-center gap-2 pt-2">
              {!isNew && (
                <Button variant="danger" size="sm" loading={del.isPending} onClick={askDelete}>
                  <Trash2 className="w-3.5 h-3.5" /> Eliminar
                </Button>
              )}
              <div className="flex-1" />
              <Button variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
              <Button size="sm" loading={mut.isPending} disabled={form.name.trim().length < 2} onClick={() => mut.mutate()}>
                {isNew ? 'Crear' : 'Guardar'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Controles auxiliares (compartidos) ───────────────────────────────────────
export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">{label}</span>
      {children}
    </label>
  )
}
export function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-slate-100 rounded-lg p-3">
      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">{title}</p>
      <div className="space-y-2">{children}</div>
    </div>
  )
}
export function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className="w-full text-sm border border-slate-200 rounded-lg px-2 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500">
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  )
}
export function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
        className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500" />
      <span className="text-sm text-slate-600">{label}</span>
    </label>
  )
}
function RateField({ label, value, onChange }: { label: string; value: number | null | undefined; onChange: (v: number | null) => void }) {
  return (
    <label className="flex items-center justify-between gap-2">
      <span className="text-sm text-slate-600">{label}</span>
      <input type="number" step="0.001" value={value == null ? '' : value * 100} placeholder="—"
        onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value) / 100)}
        className="w-24 text-sm border border-slate-200 rounded-lg px-2 py-1 text-right text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500" />
    </label>
  )
}
