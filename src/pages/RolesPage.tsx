import { useEffect, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { TopBar } from '@/components/layout/TopBar'
import { Button } from '@/components/ui/Button'
import { PageLoader } from '@/components/ui/Spinner'
import { toast } from 'sonner'
import {
  Shield, ShieldCheck, Plus, Trash2, Save, X, Lock,
  Users, Eye, PlusCircle, Pencil, Trash,
} from 'lucide-react'

type Action = 'view' | 'create' | 'update' | 'delete'

type Role = {
  key: string
  name: string
  description: string | null
  scope: 'internal' | 'client'
  is_system: boolean
  user_count: number
  permissions: Record<string, Action[]>
}

type ModuleMeta = { key: string; name: string; scope: 'internal' | 'client' | 'shared' }

const ACTION_META: { key: Action; label: string; icon: any }[] = [
  { key: 'view',   label: 'Ver',     icon: Eye },
  { key: 'create', label: 'Crear',   icon: PlusCircle },
  { key: 'update', label: 'Editar',  icon: Pencil },
  { key: 'delete', label: 'Eliminar', icon: Trash },
]

const SCOPE_BADGE: Record<string, { label: string; cls: string }> = {
  internal: { label: 'Interno', cls: 'bg-primary-100 text-primary-700' },
  client:   { label: 'Cliente', cls: 'bg-blue-100 text-blue-700' },
  shared:   { label: 'Compartido', cls: 'bg-slate-100 text-slate-600' },
}

type Draft = Record<string, Set<Action>>

function permsToDraft(perms: Record<string, Action[]>): Draft {
  const d: Draft = {}
  for (const [m, actions] of Object.entries(perms)) d[m] = new Set(actions)
  return d
}

function draftEquals(a: Draft, b: Draft): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  for (const k of keys) {
    const sa = a[k] ?? new Set()
    const sb = b[k] ?? new Set()
    if (sa.size !== sb.size) return false
    for (const x of sa) if (!sb.has(x)) return false
  }
  return true
}

export function RolesPage() {
  const qc = useQueryClient()
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft>({})
  const [showCreate, setShowCreate] = useState(false)

  const { data: roles, isLoading: rolesLoading } = useQuery<Role[]>({
    queryKey: ['roles'],
    queryFn: async () => (await api.get('/api/roles')).data,
  })

  const { data: catalog } = useQuery<{ modules: ModuleMeta[]; actions: Action[] }>({
    queryKey: ['roles-modules'],
    queryFn: async () => (await api.get('/api/roles/modules')).data,
  })

  const selected = roles?.find(r => r.key === selectedKey) ?? null

  // Selecciona el primer rol al cargar
  useEffect(() => {
    if (!selectedKey && roles?.length) setSelectedKey(roles[0]!.key)
  }, [roles, selectedKey])

  // Resetea el draft cuando cambia el rol seleccionado o llegan datos frescos
  useEffect(() => {
    if (selected) setDraft(permsToDraft(selected.permissions))
  }, [selected?.key, selected?.permissions])

  const original = useMemo<Draft>(
    () => (selected ? permsToDraft(selected.permissions) : {}),
    [selected?.key, selected?.permissions],
  )
  const dirty = selected ? !draftEquals(draft, original) : false

  function toggle(module: string, action: Action) {
    setDraft(prev => {
      const next: Draft = {}
      for (const [k, v] of Object.entries(prev)) next[k] = new Set(v)
      const set = next[module] ?? new Set<Action>()

      if (action === 'view') {
        if (set.has('view')) { delete next[module] }          // apagar "Ver" oculta el módulo entero
        else { set.add('view'); next[module] = set }
      } else {
        if (set.has(action)) { set.delete(action) }
        else { set.add(action); set.add('view') }             // cualquier acción implica poder ver
        if (set.size) next[module] = set; else delete next[module]
      }
      return next
    })
  }

  const saveMut = useMutation({
    mutationFn: async () => {
      const permissions = Object.entries(draft).map(([module, actions]) => ({
        module, actions: [...actions],
      }))
      await api.put(`/api/roles/${selectedKey}/permissions`, { permissions })
    },
    onSuccess: () => {
      toast.success('Permisos actualizados')
      qc.invalidateQueries({ queryKey: ['roles'] })
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Error al guardar'),
  })

  const deleteMut = useMutation({
    mutationFn: async (key: string) => { await api.delete(`/api/roles/${key}`) },
    onSuccess: () => {
      toast.success('Rol eliminado')
      setSelectedKey(null)
      qc.invalidateQueries({ queryKey: ['roles'] })
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'No se pudo eliminar'),
  })

  if (rolesLoading) return <div className="p-10"><PageLoader /></div>

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar title="Roles y permisos" subtitle="Define qué puede ver y hacer cada rol" />

      <div className="flex-1 overflow-hidden flex">
        {/* ── Lista de roles ── */}
        <div className="w-72 shrink-0 border-r border-slate-200 bg-white flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900">Roles</h3>
            <button
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700"
            >
              <Plus className="w-3.5 h-3.5" /> Nuevo
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {roles?.map(r => {
              const isSel = r.key === selectedKey
              return (
                <button
                  key={r.key}
                  onClick={() => setSelectedKey(r.key)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg border transition-colors ${
                    isSel ? 'border-primary-300 bg-primary-50' : 'border-transparent hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {r.is_system
                      ? <ShieldCheck className="w-4 h-4 text-primary-500 shrink-0" />
                      : <Shield className="w-4 h-4 text-slate-400 shrink-0" />}
                    <span className="font-medium text-sm text-slate-900 truncate flex-1">{r.name}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 pl-6">
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${SCOPE_BADGE[r.scope]?.cls}`}>
                      {SCOPE_BADGE[r.scope]?.label}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] text-slate-400">
                      <Users className="w-3 h-3" /> {r.user_count}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Matriz de permisos ── */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {!selected ? (
            <div className="h-full flex items-center justify-center text-slate-400 text-sm">
              Selecciona un rol
            </div>
          ) : (
            <div className="max-w-4xl mx-auto space-y-5">
              {/* Header del rol */}
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-slate-900 truncate">{selected.name}</h2>
                    {selected.is_system && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                        <Lock className="w-3 h-3" /> Sistema
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {selected.description ?? 'Sin descripción'} · clave <code className="text-slate-500">{selected.key}</code>
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {!selected.is_system && (
                    <button
                      onClick={() => {
                        toast(`¿Eliminar el rol "${selected.name}"?`, {
                          action: { label: 'Eliminar', onClick: () => deleteMut.mutate(selected.key) },
                          cancel: { label: 'Cancelar', onClick: () => {} },
                          duration: 8000,
                        })
                      }}
                      className="inline-flex items-center gap-1 text-xs font-medium text-red-500 hover:text-red-600 border border-red-200 hover:bg-red-50 px-2.5 py-1.5 rounded-lg"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Eliminar
                    </button>
                  )}
                  <Button onClick={() => saveMut.mutate()} loading={saveMut.isPending} disabled={!dirty}>
                    <Save className="w-4 h-4" /> Guardar cambios
                  </Button>
                </div>
              </div>

              {/* Grilla */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="text-left px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Módulo</th>
                      {ACTION_META.map(a => (
                        <th key={a.key} className="px-3 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center w-24">
                          <div className="flex items-center justify-center gap-1">
                            <a.icon className="w-3.5 h-3.5" /> {a.label}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {catalog?.modules.map(m => {
                      const set = draft[m.key] ?? new Set<Action>()
                      const canView = set.has('view')
                      return (
                        <tr key={m.key} className="hover:bg-slate-50/60">
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-slate-800">{m.name}</span>
                              <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${SCOPE_BADGE[m.scope]?.cls}`}>
                                {SCOPE_BADGE[m.scope]?.label}
                              </span>
                            </div>
                          </td>
                          {ACTION_META.map(a => {
                            const checked = set.has(a.key)
                            const disabled = a.key !== 'view' && !canView
                            return (
                              <td key={a.key} className="px-3 py-2.5 text-center">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={disabled}
                                  onChange={() => toggle(m.key, a.key)}
                                  className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                                />
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <p className="text-xs text-slate-400">
                Apagar <strong>Ver</strong> oculta el módulo por completo para este rol. Los cambios se aplican a los usuarios en menos de un minuto.
              </p>
            </div>
          )}
        </div>
      </div>

      {showCreate && <CreateRoleModal catalog={catalog?.modules ?? []} onClose={() => setShowCreate(false)} onCreated={(key) => { setSelectedKey(key); setShowCreate(false) }} />}
    </div>
  )
}

// ── Modal de creación ─────────────────────────────────────────────────────────

function CreateRoleModal({ catalog, onClose, onCreated }: {
  catalog: ModuleMeta[]
  onClose: () => void
  onCreated: (key: string) => void
}) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ name: '', description: '', scope: 'internal' as 'internal' | 'client' })

  const createMut = useMutation({
    mutationFn: async () => {
      // Nuevo rol arranca solo con acceso al panel (view), luego se ajusta en la grilla
      const permissions = catalog.some(m => m.key === 'dashboard')
        ? [{ module: 'dashboard', actions: ['view'] }]
        : []
      const { data } = await api.post('/api/roles', { ...form, permissions })
      return data
    },
    onSuccess: (data) => {
      toast.success('Rol creado')
      qc.invalidateQueries({ queryKey: ['roles'] })
      onCreated(data.key)
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Error al crear rol'),
  })

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
          <div className="flex items-start justify-between px-6 py-5 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Nuevo rol</h2>
              <p className="text-xs text-slate-400 mt-0.5">Luego defines sus permisos en la grilla.</p>
            </div>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="px-6 py-5 space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Nombre *</label>
              <input
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="Ej: Cobranza Junior"
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Descripción</label>
              <input
                value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                placeholder="Opcional"
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Ámbito</label>
              <select
                value={form.scope}
                onChange={e => setForm(p => ({ ...p, scope: e.target.value as 'internal' | 'client' }))}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="internal">Interno (personal de la firma)</option>
                <option value="client">Cliente (empresas)</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50">
            <Button variant="secondary" onClick={onClose}>Cancelar</Button>
            <Button onClick={() => createMut.mutate()} loading={createMut.isPending} disabled={!form.name.trim()}>
              <Plus className="w-4 h-4" /> Crear rol
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
