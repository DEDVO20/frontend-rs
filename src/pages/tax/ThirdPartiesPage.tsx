import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { TopBar } from '@/components/layout/TopBar'
import { Button } from '@/components/ui/Button'
import { PageLoader } from '@/components/ui/Spinner'
import { formatCurrency } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'
import { toast } from 'sonner'
import { X, Plus, UserPlus, Calculator } from 'lucide-react'
import { Field, Select } from './TaxProfilesPage'
import type { TaxProfile, ThirdParty } from './taxTypes'

const INTERNAL_EDIT = ['admin', 'rs_admin', 'rs_staff']

export function ThirdPartiesPage() {
  const qc = useQueryClient()
  const role = useAuthStore(s => s.user?.role ?? '')
  const canEdit = INTERNAL_EDIT.includes(role)
  const [editing, setEditing] = useState<ThirdParty | 'new' | null>(null)
  const [calcParty, setCalcParty] = useState<ThirdParty | null>(null)

  const { data: parties, isLoading } = useQuery<ThirdParty[]>({
    queryKey: ['third-parties'],
    queryFn: async () => (await api.get('/api/participations/third-parties')).data,
  })
  const { data: profiles } = useQuery<TaxProfile[]>({
    queryKey: ['tax-profiles'],
    queryFn: async () => (await api.get('/api/tax/profiles')).data,
  })

  if (isLoading) return <PageLoader />

  const profileName = (id: string | null) => profiles?.find(p => p.id === id)?.name ?? '—'

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Terceros" subtitle="Clientes y proveedores con su perfil tributario" />

      <div className="flex-1 overflow-auto p-6 space-y-4">
        {canEdit && (
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setEditing('new')}><Plus className="w-3.5 h-3.5" /> Nuevo tercero</Button>
          </div>
        )}

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-left text-slate-500">
                <th className="px-4 py-3 font-semibold">Nombre</th>
                <th className="px-4 py-3 font-semibold">Identificación</th>
                <th className="px-4 py-3 font-semibold">Tipo</th>
                <th className="px-4 py-3 font-semibold">Perfil tributario</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {(parties ?? []).map(tp => (
                <tr key={tp.id} className="border-b border-slate-100 hover:bg-slate-50/60">
                  <td className="px-4 py-2.5 font-medium">
                    <button onClick={() => setCalcParty(tp)} className="text-slate-800 hover:text-primary-600 text-left" title="Ver cálculo">{tp.name}</button>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{tp.identification ?? '—'}</td>
                  <td className="px-4 py-2.5 text-slate-600">{tp.person_type === 'JURIDICA' ? 'Jurídica' : 'Natural'}</td>
                  <td className="px-4 py-2.5">
                    <span className={tp.tax_profile_id ? 'text-slate-700' : 'text-amber-600'}>{profileName(tp.tax_profile_id)}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    <button onClick={() => setCalcParty(tp)} className="text-xs text-primary-600 hover:text-primary-700 font-medium inline-flex items-center gap-1">
                      <Calculator className="w-3.5 h-3.5" /> Cálculo
                    </button>
                    {canEdit && <button onClick={() => setEditing(tp)} className="text-xs text-slate-500 hover:text-slate-700 font-medium ml-3">Editar</button>}
                  </td>
                </tr>
              ))}
              {(parties ?? []).length === 0 && (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">No hay terceros todavía.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <ThirdPartyDrawer party={editing === 'new' ? null : editing} profiles={profiles ?? []}
          onClose={() => setEditing(null)}
          onSaved={() => { qc.invalidateQueries({ queryKey: ['third-parties'] }); setEditing(null); toast.success('Tercero guardado') }} />
      )}

      {calcParty && (
        <CalcDrawer party={calcParty} profile={profiles?.find(p => p.id === calcParty.tax_profile_id) ?? null}
          onClose={() => setCalcParty(null)} />
      )}
    </div>
  )
}

// ── Resumen de los cálculos tributarios que aplican a un tercero ─────────────
interface WithholdingLine { amount: number; rate: number; applied: boolean }
interface OperationResult {
  invoiceBase: number; invoiceIva: number; invoiceTotal: number
  incomeWithholding: WithholdingLine; icaWithholding: WithholdingLine; ivaWithholding: WithholdingLine
  invoicePayment: number
  commission: number; commissionIva: number; commissionTotal: number
  commissionIncomeWithholding: WithholdingLine; commissionIcaWithholding: WithholdingLine; commissionNet: number
  finalTotal: number
}

function CalcDrawer({ party, profile, onClose }: { party: ThirdParty; profile: TaxProfile | null; onClose: () => void }) {
  const { data: settings } = useQuery<{ default_invoice_value: number }>({
    queryKey: ['tax-settings'],
    queryFn: async () => (await api.get('/api/tax/settings')).data,
  })
  const [value, setValue] = useState<number | null>(null)
  const [draft, setDraft] = useState('')
  useEffect(() => { if (settings && draft === '') { setDraft(String(settings.default_invoice_value)); setValue(settings.default_invoice_value) } }, [settings]) // eslint-disable-line react-hooks/exhaustive-deps

  const { data, isFetching, error } = useQuery<{ result: OperationResult }>({
    queryKey: ['tax-compute', party.id, value],
    enabled: value != null && !!party.tax_profile_id,
    queryFn: async () => (await api.post('/api/tax/compute', { invoice_value: value, third_party_id: party.id })).data,
  })
  const r = data?.result

  const apply = () => {
    const v = Number(draft.replace(/[^\d.]/g, ''))
    if (!isFinite(v) || v < 0) { toast.error('Valor inválido'); return }
    setValue(v)
  }

  const Row = ({ label, v, strong, neg }: { label: string; v: number; strong?: boolean; neg?: boolean }) => (
    <div className={`flex justify-between gap-4 py-1.5 ${strong ? 'border-t border-slate-100 mt-1 pt-2' : ''}`}>
      <span className={`text-sm ${strong ? 'font-semibold text-slate-800' : 'text-slate-500'}`}>{label}</span>
      <span className={`text-sm text-right tabular-nums ${strong ? 'font-bold text-slate-900' : neg && v > 0 ? 'text-red-600' : 'text-slate-700'}`}>
        {neg && v > 0 ? `−${formatCurrency(v)}` : formatCurrency(v)}
      </span>
    </div>
  )

  return (
    <div className="fixed inset-0 z-30 flex justify-end">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white h-full shadow-xl overflow-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 bg-white">
          <div>
            <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
              <Calculator className="w-4 h-4 text-slate-400" /> {party.name}
            </h2>
            <p className="text-xs text-slate-400">{profile?.name ?? 'Sin perfil tributario'}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-4">
          {!party.tax_profile_id ? (
            <div className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-3">
              Este tercero no tiene un perfil tributario asignado. Asígnale uno para ver el cálculo.
            </div>
          ) : (
            <>
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Valor de la factura (base)</label>
                <div className="flex gap-2">
                  <input value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => e.key === 'Enter' && apply()} inputMode="numeric"
                    className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500" />
                  <Button size="sm" onClick={apply}>Calcular</Button>
                </div>
              </div>

              {error && <p className="text-sm text-red-600">No se pudo calcular.</p>}
              {isFetching && !r && <PageLoader />}

              {r && (
                <>
                  <section className="bg-slate-50 rounded-xl p-4">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Factura</p>
                    <Row label="Base" v={r.invoiceBase} />
                    <Row label="IVA factura" v={r.invoiceIva} />
                    <Row label="Valor factura" v={r.invoiceTotal} strong />
                    <Row label="Retención fuente" v={r.incomeWithholding.amount} neg />
                    <Row label="Retención ICA" v={r.icaWithholding.amount} neg />
                    <Row label="Retención IVA" v={r.ivaWithholding.amount} neg />
                    <Row label="Pago factura" v={r.invoicePayment} strong />
                  </section>

                  <section className="bg-slate-50 rounded-xl p-4">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Comisión</p>
                    <Row label="Comisión" v={r.commission} />
                    <Row label="IVA comisión" v={r.commissionIva} />
                    <Row label="Total comisión" v={r.commissionTotal} strong />
                    <Row label="Retefuente comisión" v={r.commissionIncomeWithholding.amount} neg />
                    <Row label="ReteICA comisión" v={r.commissionIcaWithholding.amount} neg />
                    <Row label="Comisión neta" v={r.commissionNet} strong />
                  </section>

                  <section className="border border-primary-200 rounded-xl overflow-hidden">
                    <div className="px-4 py-2 bg-primary-50">
                      <p className="text-[11px] font-bold text-primary-700 uppercase tracking-wider">Resultado (recaudo total)</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 p-4 text-center">
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider">Pagar al tercero</p>
                        <p className="text-base font-bold text-emerald-700">{formatCurrency(r.finalTotal)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider">Queda en Finto</p>
                        <p className="text-base font-bold text-primary-700">{formatCurrency(r.commissionNet)}</p>
                      </div>
                    </div>
                  </section>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function ThirdPartyDrawer({ party, profiles, onClose, onSaved }: {
  party: ThirdParty | null; profiles: TaxProfile[]; onClose: () => void; onSaved: () => void
}) {
  const isNew = party === null
  const [form, setForm] = useState({
    name: party?.name ?? '',
    identification: party?.identification ?? '',
    person_type: party?.person_type ?? 'NATURAL',
    tax_profile_id: party?.tax_profile_id ?? '',
  })
  const set = (k: keyof typeof form, v: string) => setForm(s => ({ ...s, [k]: v }))

  const mut = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        identification: form.identification.trim() || undefined,
        person_type: form.person_type,
        tax_profile_id: form.tax_profile_id || null,
      }
      if (isNew) await api.post('/api/participations/third-parties', payload)
      else await api.patch(`/api/participations/third-parties/${party!.id}`, payload)
    },
    onSuccess: onSaved,
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'No se pudo guardar el tercero'),
  })

  return (
    <div className="fixed inset-0 z-30 flex justify-end">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white h-full shadow-xl overflow-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 bg-white">
          <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-slate-400" /> {isNew ? 'Nuevo tercero' : (form.name || 'Tercero')}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-5">
          <Field label="Nombre / Razón social">
            <input value={form.name} onChange={e => set('name', e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg px-2 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </Field>
          <Field label="Identificación (NIT / documento)">
            <input value={form.identification} onChange={e => set('identification', e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg px-2 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </Field>
          <Field label="Tipo de persona">
            <Select value={form.person_type} onChange={v => set('person_type', v)}
              options={[['NATURAL', 'Persona natural'], ['JURIDICA', 'Persona jurídica']]} />
          </Field>
          <Field label="Perfil tributario">
            <Select value={form.tax_profile_id} onChange={v => set('tax_profile_id', v)}
              options={[['', 'Sin asignar'], ...profiles.map(p => [p.id!, p.name] as [string, string])]} />
          </Field>
          {form.tax_profile_id && (
            <p className="text-xs text-slate-400 -mt-2">{profiles.find(p => p.id === form.tax_profile_id)?.description}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
            <Button size="sm" loading={mut.isPending} disabled={form.name.trim().length < 2} onClick={() => mut.mutate()}>
              {isNew ? 'Crear tercero' : 'Guardar'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
