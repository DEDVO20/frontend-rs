import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import {
  X, CheckCircle2, FileText, Shield, IdCard, Mail, Phone, MessageCircle,
  Building2, Globe, MapPin, ExternalLink, AlertCircle, ChevronDown,
} from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { toast } from 'sonner'

// ── Types ──────────────────────────────────────────────────────────────────────

interface Props {
  id: string | null
  onClose: () => void
}

const STEPS = [
  { n: 1, label: 'Datos' },
  { n: 2, label: 'Servicios' },
  { n: 3, label: 'Políticas' },
  { n: 4, label: 'KYC' },
  { n: 5, label: 'Confirmación' },
]

const STATUS_META: Record<string, { label: string; color: any }> = {
  draft:             { label: 'Borrador',       color: 'gray' },
  services_selected: { label: 'Servicios',      color: 'blue' },
  policies_accepted: { label: 'Políticas ✓',    color: 'blue' },
  kyc_submitted:     { label: 'Docs. enviados', color: 'yellow' },
  pending_review:    { label: 'En revisión',    color: 'yellow' },
  approved:          { label: 'Aprobado',       color: 'green' },
  rejected:          { label: 'Rechazado',      color: 'red' },
  resubmit:          { label: 'Reenviar',       color: 'orange' },
  needs_correction:  { label: 'Corrección',     color: 'orange' },
}

const STATUS_OPTIONS = [
  'draft', 'pending_review', 'approved', 'rejected', 'needs_correction', 'resubmit',
]

const DOC_TYPE_LABELS: Record<string, { label: string; icon: React.ElementType }> = {
  rut:                 { label: 'RUT',              icon: FileText },
  cedula_representante:{ label: 'Cédula rep. legal', icon: IdCard },
  sarlaft_form:        { label: 'SARLAFT',           icon: Shield },
  camara_comercio:     { label: 'Cámara de comercio', icon: Building2 },
  estados_financieros: { label: 'Estados financieros', icon: FileText },
  otro:                { label: 'Otro documento',   icon: FileText },
}

const DOC_STATUS: Record<string, { label: string; color: string }> = {
  uploaded:  { label: 'Subido',     color: 'text-blue-500' },
  verified:  { label: 'Verificado', color: 'text-green-600' },
  rejected:  { label: 'Rechazado',  color: 'text-red-500' },
  pending:   { label: 'Pendiente',  color: 'text-slate-400' },
}

// ── Component ─────────────────────────────────────────────────────────────────

export function OnboardingDrawer({ id, onClose }: Props) {
  const qc = useQueryClient()
  const [notes, setNotes]   = useState('')
  const [newStatus, setNewStatus] = useState('')
  const [notesOpen, setNotesOpen] = useState(false)
  const [reviewingDoc, setReviewingDoc] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)

  const { data: item, isLoading } = useQuery({
    queryKey: ['onboarding-detail', id],
    queryFn: async () => {
      const { data } = await api.get(`/api/onboarding/${id}`)
      setNotes(data.review_notes ?? '')
      setNewStatus(data.status)
      return data
    },
    enabled: !!id,
  })

  const saveMutation = useMutation({
    mutationFn: async () => {
      await api.patch(`/api/onboarding/${id}`, {
        ...(newStatus !== item?.status ? { status: newStatus } : {}),
        review_notes: notes || null,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['onboarding'] })
      qc.invalidateQueries({ queryKey: ['onboarding-detail', id] })
    },
  })

  if (!id) return null

  const stepDone = (n: number) => item ? item.current_step > n : false
  const stepActive = (n: number) => item ? item.current_step === n : false

  const kyc = item?.kyc_submissions
  const kyc_docs: any[] = kyc?.kyc_documents ?? []
  const services: any[] = item?.service_contracts ?? []
  const policies: any[] = item?.policy_acceptances ?? []
  const sm = STATUS_META[item?.status] ?? { label: item?.status, color: 'gray' }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full max-w-xl bg-white z-50 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div>
            {isLoading ? (
              <div className="h-6 w-48 bg-slate-200 rounded animate-pulse" />
            ) : (
              <>
                <h2 className="text-lg font-bold text-slate-900">{item?.company_name ?? '—'}</h2>
                <p className="text-sm text-slate-400 mt-0.5">
                  {item?.company_nit ? `NIT: ${item.company_nit} · ` : ''}
                  <Badge label={sm.label} color={sm.color} />
                </p>
              </>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 transition-colors ml-4">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-20 bg-slate-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="p-6 space-y-6">

              {/* ── Progreso ──────────────────────────────────────────── */}
              <Section title="Progreso del proceso">
                <div className="flex items-center justify-between gap-1">
                  {STEPS.map((s, i) => (
                    <div key={s.n} className="flex items-center gap-1 flex-1">
                      <div className="flex flex-col items-center gap-1 flex-1">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                          stepDone(s.n)   ? 'bg-primary-500 text-white' :
                          stepActive(s.n) ? 'bg-primary-100 text-primary-700 ring-2 ring-primary-400' :
                          'bg-slate-100 text-slate-400'
                        }`}>
                          {stepDone(s.n) ? <CheckCircle2 className="w-4 h-4" /> : s.n}
                        </div>
                        <span className="text-xs text-slate-500 text-center leading-tight">{s.label}</span>
                      </div>
                      {i < STEPS.length - 1 && (
                        <div className={`h-0.5 flex-1 mb-5 ${stepDone(s.n) ? 'bg-primary-400' : 'bg-slate-200'}`} />
                      )}
                    </div>
                  ))}
                </div>
              </Section>

              {/* ── Representante ─────────────────────────────────────── */}
              <Section title="Datos de contacto · Representante">
                <div className="space-y-3">
                  <Row label="Nombre"   value={item?.rep_name} />
                  <Row label="Cédula"   value={item?.rep_cedula} />
                  <Row label="Cargo"    value={item?.rep_position} />
                  <Row label="Teléfono" value={item?.rep_phone} />
                  <Row label="Correo"   value={item?.rep_email} />
                  <div className="flex gap-2 pt-1">
                    {item?.rep_email && (
                      <a href={`mailto:${item.rep_email}`}
                        className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-primary-50 hover:text-primary-600 transition-colors">
                        <Mail className="w-3.5 h-3.5" /> Email
                      </a>
                    )}
                    {item?.rep_phone && (
                      <>
                        <a href={`tel:${item.rep_phone}`}
                          className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-primary-50 hover:text-primary-600 transition-colors">
                          <Phone className="w-3.5 h-3.5" /> Llamar
                        </a>
                        <a href={`https://wa.me/${item.rep_phone.replace(/\D/g,'')}`} target="_blank" rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 transition-colors">
                          <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                        </a>
                      </>
                    )}
                  </div>
                </div>
              </Section>

              {/* ── Empresa ───────────────────────────────────────────── */}
              <Section title="Información de la empresa">
                <div className="space-y-3">
                  <Row label="Razón social" value={item?.company_name} />
                  <Row label="NIT"          value={item?.company_nit} />
                  <Row label="Tipo"         value={item?.company_type} />
                  <Row label="Sector"       value={item?.company_sector} />
                  {item?.company_city && (
                    <div className="flex items-start justify-between gap-4">
                      <span className="text-xs text-slate-400 shrink-0 flex items-center gap-1 pt-0.5">
                        <MapPin className="w-3 h-3" /> Ciudad
                      </span>
                      <span className="text-sm text-slate-800 text-right">{item.company_city}</span>
                    </div>
                  )}
                  <Row label="Dirección"  value={item?.company_address} />
                  <Row label="Teléfono"   value={item?.company_phone} />
                  {item?.company_website && (
                    <div className="flex items-start justify-between gap-4">
                      <span className="text-xs text-slate-400 shrink-0 flex items-center gap-1 pt-0.5">
                        <Globe className="w-3 h-3" /> Sitio web
                      </span>
                      <a href={item.company_website} target="_blank" rel="noreferrer"
                        className="text-sm text-primary-600 hover:underline flex items-center gap-1">
                        {item.company_website.replace(/^https?:\/\//, '')}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                </div>
              </Section>

              {/* ── Servicios ─────────────────────────────────────────── */}
              <Section title="Servicios seleccionados">
                {services.length === 0 ? (
                  <Empty>Sin servicios seleccionados</Empty>
                ) : (
                  <ul className="space-y-2">
                    {services.map((sc: any) => (
                      <li key={sc.id} className="flex items-center gap-2 text-sm text-slate-700">
                        <CheckCircle2 className="w-4 h-4 text-primary-500 shrink-0" />
                        {sc.services?.name ?? sc.service_id}
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              {/* ── Políticas ─────────────────────────────────────────── */}
              <Section title="Políticas aceptadas">
                {policies.length === 0 ? (
                  <Empty>Sin políticas registradas</Empty>
                ) : (
                  <ul className="space-y-2">
                    {policies.map((pa: any) => (
                      <li key={pa.id} className="flex items-center justify-between text-sm">
                        <span className="text-slate-700 flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                          {pa.policy_versions?.title ?? pa.policy_version_id}
                          {pa.policy_versions?.version && (
                            <span className="text-[10px] text-slate-400 font-medium">v{pa.policy_versions.version}</span>
                          )}
                        </span>
                        <span className="text-xs text-slate-400 shrink-0 ml-2">
                          {pa.accepted_at ? formatDate(pa.accepted_at) : '—'}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              {/* ── Documentos KYC ────────────────────────────────────── */}
              <Section title={`Documentos KYC · ${kyc?.status ?? 'sin envío'}`}>
                {kyc_docs.length === 0 ? (
                  <Empty>Sin documentos cargados</Empty>
                ) : (
                  <ul className="space-y-3">
                    {kyc_docs.map((doc: any) => {
                      const meta = DOC_TYPE_LABELS[doc.doc_type] ?? { label: doc.doc_type, icon: FileText }
                      const Icon = meta.icon
                      const st = DOC_STATUS[doc.status] ?? { label: doc.status, color: 'text-slate-400' }
                      const isReviewing = reviewingDoc === doc.id
                      return (
                        <li key={doc.id} className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0">
                                <Icon className="w-4 h-4 text-slate-400" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-slate-800 truncate">{meta.label}</p>
                                <p className={`text-xs ${st.color}`}>{st.label}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {doc.file_url && (
                                <a href={doc.file_url} target="_blank" rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-xs text-primary-600 font-medium hover:underline">
                                  <ExternalLink className="w-3.5 h-3.5" /> Ver
                                </a>
                              )}
                              {doc.status !== 'verified' && (
                                <button
                                  onClick={async () => {
                                    if (isReviewing) {
                                      setReviewingDoc(null)
                                      setPreviewUrl(null)
                                      return
                                    }
                                    setReviewingDoc(doc.id)
                                    setPreviewUrl(null)
                                    setLoadingPreview(true)
                                    try {
                                      const { data } = await api.get(`/api/onboarding/${id}/kyc/documents/${doc.id}/url`)
                                      setPreviewUrl(data.url)
                                    } catch { setPreviewUrl(null) }
                                    setLoadingPreview(false)
                                  }}
                                  className="text-xs font-medium px-2 py-1 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors"
                                >
                                  {isReviewing ? 'Cerrar' : 'Revisar'}
                                </button>
                              )}
                              {doc.status === 'verified' && (
                                <span className="text-xs font-medium text-emerald-600 flex items-center gap-1">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Aprobado
                                </span>
                              )}
                            </div>
                          </div>
                          {isReviewing && (
                            <div className="space-y-2 pt-2 border-t border-slate-100">
                              {/* Document viewer */}
                              <div className="rounded-lg border border-slate-200 bg-white overflow-hidden" style={{ height: 360 }}>
                                {loadingPreview ? (
                                  <div className="flex items-center justify-center h-full text-slate-400 text-sm">Cargando documento…</div>
                                ) : previewUrl ? (
                                  <iframe src={previewUrl} className="w-full h-full" title={`Preview ${meta.label}`} />
                                ) : (
                                  <div className="flex items-center justify-center h-full text-slate-400 text-sm">No se pudo cargar el documento</div>
                                )}
                              </div>
                              {previewUrl && (
                                <a href={previewUrl} target="_blank" rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-xs text-primary-600 font-medium hover:underline">
                                  <ExternalLink className="w-3.5 h-3.5" /> Abrir en nueva pestaña
                                </a>
                              )}
                              {/* Approve / Reject */}
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={async () => {
                                    try {
                                      await api.patch(`/api/onboarding/${id}/kyc/documents/${doc.id}`, { status: 'verified' })
                                      qc.invalidateQueries({ queryKey: ['onboarding-detail', id] })
                                      setReviewingDoc(null)
                                      setPreviewUrl(null)
                                    } catch (e: any) { alert(e.response?.data?.error ?? 'Error') }
                                  }}
                                  className="flex-1 py-1.5 rounded-lg bg-emerald-500 text-white text-xs font-semibold hover:bg-emerald-600 transition-colors flex items-center justify-center gap-1"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Aprobar
                                </button>
                                <button
                                  onClick={async () => {
                                    const reason = prompt('Motivo del rechazo:')
                                    if (!reason) return
                                    try {
                                      await api.patch(`/api/onboarding/${id}/kyc/documents/${doc.id}`, { status: 'rejected', notes: reason })
                                      qc.invalidateQueries({ queryKey: ['onboarding-detail', id] })
                                      setReviewingDoc(null)
                                      setPreviewUrl(null)
                                    } catch (e: any) { alert(e.response?.data?.error ?? 'Error') }
                                  }}
                                  className="flex-1 py-1.5 rounded-lg bg-red-500 text-white text-xs font-semibold hover:bg-red-600 transition-colors flex items-center justify-center gap-1"
                                >
                                  <AlertCircle className="w-3.5 h-3.5" /> Rechazar
                                </button>
                              </div>
                            </div>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </Section>

              {/* ── Auditoría ─────────────────────────────────────────── */}
              <Section title="Auditoría">
                <div className="space-y-2">
                  <Row label="Creado"      value={item?.created_at  ? formatDate(item.created_at)  : '—'} />
                  <Row label="Actualizado" value={item?.updated_at  ? formatDate(item.updated_at)  : '—'} />
                  <Row label="Enviado"     value={item?.submitted_at ? formatDate(item.submitted_at) : 'No enviado'} />
                  <Row label="Aprobado"    value={item?.approved_at  ? formatDate(item.approved_at)  : '—'} />
                  {item?.rejection_reason && (
                    <div className="flex items-start gap-2 p-3 bg-red-50 rounded-lg mt-2">
                      <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                      <p className="text-xs text-red-600">{item.rejection_reason}</p>
                    </div>
                  )}
                </div>
              </Section>

              {/* ── Gestión (admin) ───────────────────────────────────── */}
              <Section title="Gestión">
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">Cambiar estado</label>
                    <select
                      value={newStatus}
                      onChange={e => setNewStatus(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      {STATUS_OPTIONS.map(s => (
                        <option key={s} value={s}>{STATUS_META[s]?.label ?? s}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <button
                      onClick={() => setNotesOpen(v => !v)}
                      className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-1.5"
                    >
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform ${notesOpen ? 'rotate-180' : ''}`} />
                      Notas internas
                    </button>
                    {notesOpen && (
                      <textarea
                        rows={3}
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        placeholder="Observaciones del equipo RS…"
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                      />
                    )}
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => saveMutation.mutate()}
                      disabled={saveMutation.isPending}
                      className="flex-1 py-2 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 disabled:opacity-60 transition-colors"
                    >
                      {saveMutation.isPending ? 'Guardando…' : 'Guardar cambios'}
                    </button>
                    <button
                      onClick={onClose}
                      className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                  {saveMutation.isSuccess && (
                    <p className="text-xs text-green-600 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Cambios guardados
                    </p>
                  )}

                  {/* Reenviar invitación */}
                  {item?.status === 'approved' && (
                    <div className="pt-3 border-t border-slate-100">
                      <button
                        onClick={async () => {
                          try {
                            await api.post(`/api/onboarding/${id}/resend-invitation`)
                            toast.success(`Invitación reenviada a ${item.rep_email}`)
                          } catch (e: any) {
                            toast.error(e.response?.data?.error ?? 'Error al reenviar')
                          }
                        }}
                        className="w-full py-2 rounded-lg border border-amber-200 bg-amber-50 text-amber-700 text-sm font-medium hover:bg-amber-100 transition-colors flex items-center justify-center gap-2"
                      >
                        <Mail className="w-4 h-4" /> Reenviar invitación a {item.rep_email}
                      </button>
                      <p className="text-[10px] text-slate-400 mt-1 text-center">
                        Invalida la invitación anterior y envía una nueva con token fresco (7 días).
                      </p>
                    </div>
                  )}
                </div>
              </Section>

            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">{title}</p>
      <div className="bg-slate-50 rounded-xl border border-slate-100 p-4">
        {children}
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-xs text-slate-400 shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-slate-800 text-right font-medium">{value || '—'}</span>
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-slate-400 text-center py-2">{children}</p>
}
