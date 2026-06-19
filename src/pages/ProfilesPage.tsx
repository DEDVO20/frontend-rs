import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { TopBar } from '@/components/layout/TopBar'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { PageLoader } from '@/components/ui/Spinner'
import { formatDate } from '@/lib/utils'
import { toast } from 'sonner'
import {
  UserPlus, Search, Users, Shield, ShieldCheck, Mail,
  MoreVertical, X, CheckCircle2, XCircle,
} from 'lucide-react'

const ROLE_LABELS: Record<string, { label: string; color: string; icon: any }> = {
  admin:       { label: 'Super Administrador', color: 'text-red-600',     icon: <ShieldCheck className="w-3.5 h-3.5 text-red-500" /> },
  rs_admin:    { label: 'Administrador RS',    color: 'text-amber-600',   icon: <Shield className="w-3.5 h-3.5 text-amber-500" /> },
  rs_staff:    { label: 'Staff RS',            color: 'text-primary-600', icon: <Users className="w-3.5 h-3.5 text-primary-500" /> },
  client_owner:{ label: 'Admin empresa',       color: 'text-blue-600',    icon: <Users className="w-3.5 h-3.5 text-blue-500" /> },
  client_user: { label: 'Usuario empresa',     color: 'text-slate-600',   icon: <Users className="w-3.5 h-3.5 text-slate-400" /> },
}

const AVATAR_COLORS = [
  'bg-primary-600', 'bg-blue-600', 'bg-violet-600', 'bg-amber-600',
  'bg-rose-600', 'bg-cyan-600', 'bg-emerald-600', 'bg-orange-600',
]
function avatarColor(s: string) {
  let h = 0; for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h)
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}

export function ProfilesPage() {
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [showInvite, setShowInvite] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['profiles', page, roleFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: '50' })
      if (roleFilter) params.set('role', roleFilter)
      const { data } = await api.get(`/api/profiles?${params}`)
      return data
    },
  })

  const profiles: any[] = data?.data ?? []
  const total = data?.total ?? 0

  const filtered = search
    ? profiles.filter(p =>
        (p.full_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (p.email ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : profiles

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      await api.patch(`/api/profiles/${id}`, { active })
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['profiles'] }); toast.success('Usuario actualizado') },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Error'),
  })

  const adminCount = profiles.filter(p => ['admin', 'rs_admin', 'rs_staff'].includes(p.role)).length
  const clientCount = profiles.filter(p => ['client_owner', 'client_user'].includes(p.role)).length
  const activeCount = profiles.filter(p => p.active).length

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar title="Usuarios" subtitle="Gestión de usuarios y roles" />

      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5">

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total usuarios</p>
            <p className="text-3xl font-bold text-slate-900 mt-1">{total}</p>
            <p className="text-xs text-slate-400">{activeCount} activos</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Personal RS</p>
            <p className="text-3xl font-bold text-primary-600 mt-1">{adminCount}</p>
            <p className="text-xs text-slate-400">Administradores y staff</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Clientes</p>
            <p className="text-3xl font-bold text-blue-600 mt-1">{clientCount}</p>
            <p className="text-xs text-slate-400">Usuarios de empresas</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-center">
            <Button onClick={() => setShowInvite(true)}>
              <UserPlus className="w-4 h-4" /> Invitar personal
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nombre o email..."
              className="w-full pl-10 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div className="flex gap-1.5">
            {[
              { key: '', label: 'Todos' },
              { key: 'admin', label: 'Super Admin' },
              { key: 'rs_admin', label: 'Admin RS' },
              { key: 'rs_staff', label: 'Staff RS' },
              { key: 'client_owner', label: 'Admin empresa' },
              { key: 'client_user', label: 'Usuario' },
            ].map(f => (
              <button
                key={f.key}
                onClick={() => { setRoleFilter(f.key); setPage(1) }}
                className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-colors ${
                  roleFilter === f.key
                    ? 'bg-primary-600 text-white border-primary-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Users table */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900">Usuarios registrados</h3>
            <span className="text-xs text-slate-400">{total} usuarios</span>
          </div>

          {isLoading ? (
            <div className="py-10"><PageLoader /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="text-left px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Usuario</th>
                    <th className="text-left px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Rol</th>
                    <th className="text-left px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Empresa</th>
                    <th className="text-left px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Estado</th>
                    <th className="text-left px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Registrado</th>
                    <th className="text-right px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filtered.map((p: any) => {
                    const rl = ROLE_LABELS[p.role] ?? { label: p.role, color: 'text-slate-600', icon: null }
                    return (
                      <tr key={p.id} className="hover:bg-slate-50 transition-colors group">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${avatarColor(p.email ?? '')}`}>
                              {(p.full_name ?? p.email ?? '?')[0]!.toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-slate-900 truncate">{p.full_name ?? '—'}</p>
                              <p className="text-xs text-slate-400 truncate">{p.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            {rl.icon}
                            <span className={`text-xs font-medium ${rl.color}`}>{rl.label}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">
                          {p.companies?.name ?? '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                            p.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {p.active ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                            {p.active ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-400">
                          {p.created_at ? formatDate(p.created_at) : '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => {
                                toast(p.active ? '¿Desactivar este usuario?' : '¿Reactivar este usuario?', {
                                  action: {
                                    label: p.active ? 'Desactivar' : 'Reactivar',
                                    onClick: () => toggleActive.mutate({ id: p.id, active: !p.active }),
                                  },
                                  cancel: { label: 'Cancelar', onClick: () => {} },
                                  duration: 8000,
                                })
                              }}
                              className={`text-xs font-medium px-2.5 py-1 rounded-lg border transition-colors ${
                                p.active
                                  ? 'border-slate-200 text-slate-500 hover:text-red-600 hover:border-red-200'
                                  : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'
                              }`}
                            >
                              {p.active ? 'Desactivar' : 'Reactivar'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  {!filtered.length && (
                    <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-400">No hay usuarios</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showInvite && <InviteModal onClose={() => setShowInvite(false)} />}
    </div>
  )
}

// ── Invite Modal ──────────────────────────────────────────────────────────────

function InviteModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ full_name: '', email: '', role: 'rs_staff' })
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  const inviteMut = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/api/profiles/invite', form)
      return data
    },
    onSuccess: () => {
      toast.success('Invitación enviada por correo')
      qc.invalidateQueries({ queryKey: ['profiles'] })
      onClose()
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Error al enviar invitación'),
  })

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">

          {/* Header */}
          <div className="flex items-start justify-between px-6 py-5 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Invitar personal administrativo</h2>
              <p className="text-xs text-slate-400 mt-0.5">El usuario recibirá un correo para activar su cuenta y crear su contraseña.</p>
            </div>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="px-6 py-5 space-y-5">

            <div className="flex items-center gap-2 mb-1">
              <div className="w-1 h-5 bg-primary-500 rounded-full" />
              <p className="text-xs font-bold text-primary-600 uppercase tracking-wider">Información del usuario</p>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Nombre completo *</label>
              <input
                value={form.full_name}
                onChange={e => set('full_name', e.target.value)}
                placeholder="Ej: Laura Becerra"
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Correo electrónico *</label>
              <input
                type="email"
                value={form.email}
                onChange={e => set('email', e.target.value)}
                placeholder="Ej: laura@rsbackoffice.com"
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Rol asignado</label>
              <select
                value={form.role}
                onChange={e => set('role', e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="rs_staff">Staff RS</option>
                <option value="rs_admin">Administrador RS</option>
                <option value="admin">Super Administrador</option>
              </select>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50">
            <Button variant="secondary" onClick={onClose}>Cancelar</Button>
            <Button
              onClick={() => inviteMut.mutate()}
              loading={inviteMut.isPending}
              disabled={!form.full_name.trim() || !form.email.trim()}
            >
              <Mail className="w-4 h-4" /> Enviar invitación
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
