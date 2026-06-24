import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'
import {
  X, Eye, Download, User, Calendar, Building2, Tag, AlertCircle, FileText,
} from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { toast } from 'sonner'

interface Props {
  id: string
  companies: any[]
  onClose: () => void
}

const STATUS_MAP: Record<string, { label: string; color: any }> = {
  open:        { label: 'Abierta',    color: 'yellow' },
  in_progress: { label: 'En proceso', color: 'blue' },
  resolved:    { label: 'Resuelta',   color: 'green' },
  closed:      { label: 'Cerrada',    color: 'gray' },
  cancelled:   { label: 'Cancelada',  color: 'gray' },
}

const PRIORITY_MAP: Record<string, { label: string; color: any }> = {
  low:    { label: 'Baja',    color: 'gray' },
  medium: { label: 'Media',   color: 'yellow' },
  high:   { label: 'Alta',    color: 'orange' },
  urgent: { label: 'Urgente', color: 'red' },
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function RequestDrawer({ id, companies, onClose }: Props) {
  const qc = useQueryClient()
  const { user } = useAuthStore()
  const isInternal = ['admin', 'rs_admin', 'rs_staff'].includes(user?.role ?? '')
  const isAdminOrRsAdmin = ['admin', 'rs_admin'].includes(user?.role ?? '')

  const { data: request, isLoading } = useQuery({
    queryKey: ['request-detail', id],
    queryFn: async () => {
      const { data } = await api.get(`/api/requests/${id}`)
      return data
    },
    enabled: !!id,
  })

  // List profiles for assignees dropdown
  const { data: staffList } = useQuery({
    queryKey: ['staff-profiles'],
    queryFn: async () => {
      const { data } = await api.get('/api/profiles?limit=100')
      return (data?.data ?? []).filter((p: any) => p.active && ['admin', 'rs_admin', 'rs_staff'].includes(p.role))
    },
    enabled: isAdminOrRsAdmin,
  })

  const updateMut = useMutation({
    mutationFn: async (fields: Record<string, any>) => {
      await api.patch(`/api/requests/${id}`, fields)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['requests'] })
      qc.invalidateQueries({ queryKey: ['request-detail', id] })
      toast.success('Solicitud actualizada')
    },
    onError: (e: any) => {
      toast.error(e.response?.data?.error ?? 'Error al actualizar')
    },
  })

  const companyName = (companyId: string) => companies.find(c => c.id === companyId)?.name ?? '—'

  const files: any[] = request?.metadata?.files ?? []

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full max-w-lg bg-white z-50 shadow-2xl flex flex-col overflow-hidden transition-transform duration-300">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-slate-100 bg-slate-50 shrink-0">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Detalle de Solicitud</span>
            {isLoading ? (
              <div className="h-6 w-48 bg-slate-200 rounded animate-pulse mt-1" />
            ) : (
              <h2 className="text-base font-bold text-slate-900 mt-0.5">
                #{request?.id ? request.id.slice(0, 8).toUpperCase() : ''} · {request?.title}
              </h2>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 transition-colors ml-4">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-20 bg-slate-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              {/* Description */}
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Descripción</h3>
                <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">
                  {request?.description || 'Sin descripción.'}
                </p>
              </div>

              {/* Status and Priority Controls */}
              <div className="grid grid-cols-2 gap-4">
                {/* Status selector or static label */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Estado</label>
                  {isInternal ? (
                    <select
                      value={request?.status}
                      onChange={e => updateMut.mutate({ status: e.target.value })}
                      disabled={updateMut.isPending}
                      className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                    >
                      {Object.entries(STATUS_MAP).map(([k, v]) => (
                        <option key={k} value={k}>{v.label}</option>
                      ))}
                    </select>
                  ) : (
                    <div className="pt-1">
                      <Badge
                        label={STATUS_MAP[request?.status]?.label ?? request?.status}
                        color={STATUS_MAP[request?.status]?.color ?? 'gray'}
                      />
                    </div>
                  )}
                </div>

                {/* Priority selector or static label */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Prioridad</label>
                  {isInternal ? (
                    <select
                      value={request?.priority}
                      onChange={e => updateMut.mutate({ priority: e.target.value })}
                      disabled={updateMut.isPending}
                      className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                    >
                      {Object.entries(PRIORITY_MAP).map(([k, v]) => (
                        <option key={k} value={k}>{v.label}</option>
                      ))}
                    </select>
                  ) : (
                    <div className="pt-1">
                      <Badge
                        label={PRIORITY_MAP[request?.priority]?.label ?? request?.priority}
                        color={PRIORITY_MAP[request?.priority]?.color ?? 'gray'}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* General Metadata Info */}
              <div className="border-t border-slate-100 pt-5 space-y-3">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Detalles Generales</h3>
                
                <InfoRow label="Empresa" icon={<Building2 className="w-4 h-4 text-slate-400" />} value={companyName(request?.company_id)} />
                <InfoRow label="Tipo de solicitud" icon={<Tag className="w-4 h-4 text-slate-400" />} value={request?.operational_request_types?.name} />
                <InfoRow label="Servicio relacionado" icon={<AlertCircle className="w-4 h-4 text-slate-400" />} value={request?.services?.name} />
                <InfoRow label="Fecha de creación" icon={<Calendar className="w-4 h-4 text-slate-400" />} value={request?.created_at ? fmtDate(request.created_at) : '—'} />
              </div>

              {/* Creators and Assignees */}
              <div className="border-t border-slate-100 pt-5 space-y-3">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Responsables</h3>

                <InfoRow 
                  label="Creado por" 
                  icon={<User className="w-4 h-4 text-slate-400" />} 
                  value={
                    request?.created_by 
                      ? `${request.created_by.full_name || 'Usuario'} (${request.created_by.email})` 
                      : '—'
                  } 
                />

                {/* Assignment Dropdown or Display */}
                <div className="flex justify-between items-center py-1 text-sm border-b border-slate-50">
                  <div className="flex items-center gap-2 shrink-0">
                    <User className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-400">Asignado a</span>
                  </div>
                  <div className="font-medium text-slate-700 text-right w-2/3">
                    {isAdminOrRsAdmin ? (
                      <select
                        value={request?.assigned_to_user_id || ''}
                        onChange={e => updateMut.mutate({ assigned_to_user_id: e.target.value || null })}
                        disabled={updateMut.isPending}
                        className="text-sm border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white max-w-full truncate"
                      >
                        <option value="">Sin asignar</option>
                        {(staffList ?? []).map((p: any) => (
                          <option key={p.id} value={p.id}>{p.full_name} ({p.email})</option>
                        ))}
                      </select>
                    ) : (
                      <div className="flex flex-col items-end gap-1.5">
                        <span>
                          {request?.assigned_to 
                            ? `${request.assigned_to.full_name || 'Staff'} (${request.assigned_to.email})` 
                            : 'Sin asignar'}
                        </span>
                        {/* Self-assignment button for rs_staff */}
                        {isInternal && !isAdminOrRsAdmin && request?.assigned_to_user_id !== user?.id && (
                          <button
                            onClick={() => updateMut.mutate({ assigned_to_user_id: user?.id })}
                            disabled={updateMut.isPending}
                            className="text-xs text-primary-600 hover:text-primary-700 font-semibold"
                          >
                            Asignarme a mí
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Attachments Section */}
              <div className="border-t border-slate-100 pt-5">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Archivos Adjuntos ({files.length})</h3>
                {files.length > 0 ? (
                  <div className="space-y-2">
                    {files.map((file: any, index: number) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100/70 transition-colors">
                        <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
                          <FileText className="w-5 h-5 text-slate-400 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-slate-700 truncate">{file.name}</p>
                            {file.size && (
                              <p className="text-[10px] text-slate-400 mt-0.5">{(file.size / 1024).toFixed(0)} KB</p>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          {file.file_url && (
                            <a
                              href={file.file_url}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 bg-white border border-slate-200 text-slate-400 hover:text-primary-600 rounded-lg shadow-sm hover:border-primary-100 transition-colors"
                              title="Ver en nueva pestaña"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </a>
                          )}
                          {file.file_url && (
                            <a
                              href={file.file_url}
                              download
                              className="p-1.5 bg-white border border-slate-200 text-slate-400 hover:text-slate-700 rounded-lg shadow-sm hover:border-slate-300 transition-colors"
                              title="Descargar archivo"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">No se adjuntaron archivos a esta solicitud.</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}

function InfoRow({ label, icon, value }: { label: string; icon: React.ReactNode; value: any }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-slate-50 text-sm">
      <div className="flex items-center gap-2 shrink-0">
        {icon}
        <span className="text-slate-400">{label}</span>
      </div>
      <span className="font-medium text-slate-700 text-right truncate max-w-[60%]">{value ?? '—'}</span>
    </div>
  )
}
