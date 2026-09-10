import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { TopBar } from '@/components/layout/TopBar'
import { Button } from '@/components/ui/Button'
import { PageLoader } from '@/components/ui/Spinner'
import { useAuthStore } from '@/stores/authStore'
import { toast } from 'sonner'
import { X, Plus, UserPlus } from 'lucide-react'
import { Field, Select } from './TaxProfilesPage'
import type { TaxProfile, ThirdParty } from './taxTypes'

const INTERNAL_EDIT = ['admin', 'rs_admin', 'rs_staff']

export function ThirdPartiesPage() {
  const qc = useQueryClient()
  const role = useAuthStore(s => s.user?.role ?? '')
  const canEdit = INTERNAL_EDIT.includes(role)
  const [editing, setEditing] = useState<ThirdParty | 'new' | null>(null)

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
                  <td className="px-4 py-2.5 font-medium text-slate-800">{tp.name}</td>
                  <td className="px-4 py-2.5 text-slate-600">{tp.identification ?? '—'}</td>
                  <td className="px-4 py-2.5 text-slate-600">{tp.person_type === 'JURIDICA' ? 'Jurídica' : 'Natural'}</td>
                  <td className="px-4 py-2.5">
                    <span className={tp.tax_profile_id ? 'text-slate-700' : 'text-amber-600'}>{profileName(tp.tax_profile_id)}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {canEdit && <button onClick={() => setEditing(tp)} className="text-xs text-primary-600 hover:text-primary-700 font-medium">Editar</button>}
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
