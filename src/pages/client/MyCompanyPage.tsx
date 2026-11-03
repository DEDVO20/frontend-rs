import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Pencil } from 'lucide-react'
import { api } from '@/lib/api'
import { PortalTopBar } from '@/components/layout/PortalTopBar'
import { PageLoader } from '@/components/ui/Spinner'
import { FintoIcon, type FintoIconName } from '@/components/ui/FintoIcon'
import { useAuthStore } from '@/stores/authStore'
import { cn } from '@/lib/utils'

// Catálogo de servicios para la sección "Más servicios" (upsell)
const SERVICE_CATALOG = [
  'Controller financiero', 'Gestión comercial', 'Contabilidad e impuestos', 'Tesorería',
  'Gestión de personal', 'Nómina', 'SG-SST',
]

const ADVISOR_PITCH = 'Su empresa merece un control financiero inteligente. Nos encargamos del análisis, seguimiento y optimización de sus finanzas para que usted se enfoque en crecer.'

// ── Medidor semicircular ────────────────────────────────────────────────────
function Gauge({ value }: { value: number }) {
  const semi = Math.PI * 42
  const dash = Math.max(0, Math.min(100, value)) / 100 * semi
  return (
    <svg viewBox="0 0 100 58" className="w-24">
      <path d="M8 50 A42 42 0 0 1 92 50" fill="none" strokeWidth="10" strokeLinecap="round" className="stroke-sand-300 dark:stroke-white/10" />
      <path d="M8 50 A42 42 0 0 1 92 50" fill="none" strokeWidth="10" strokeLinecap="round" className="stroke-gold-500" strokeDasharray={`${dash} ${semi}`} />
      <text x="50" y="46" textAnchor="middle" className="fill-navy-900 dark:fill-cream-100 font-display font-bold" fontSize="20">{Math.round(value)}%</text>
    </svg>
  )
}

function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('rounded-2xl bg-cream-100 dark:bg-navy-900 ring-1 ring-navy-900/5 dark:ring-white/5 p-6', className)}>{children}</div>
}

function CardHeader({ icon, title }: { icon: FintoIconName; title: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-6">
      <FintoIcon name={icon} size={24} />
      <h3 className="font-display font-bold text-navy-900 dark:text-cream-100 text-lg">{title}</h3>
    </div>
  )
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-[11px] font-bold text-brand-600 dark:text-brand-300 uppercase tracking-wider">{label}</p>
      <p className="text-sm font-medium text-navy-900 dark:text-cream-100 mt-0.5 break-words">{value || '—'}</p>
    </div>
  )
}

/** Sitio web editable por el dueño de la empresa (los demás solo lo ven) */
function WebsiteField({ companyId, value, canEdit }: { companyId: string; value?: string | null; canEdit: boolean }) {
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? '')

  const saveMut = useMutation({
    mutationFn: async (website: string) => (await api.patch(`/api/companies/${companyId}`, { website: website.trim() })).data,
    onSuccess: () => {
      toast.success('Sitio web actualizado')
      setEditing(false)
      qc.invalidateQueries({ queryKey: ['my-company', companyId] })
      qc.invalidateQueries({ queryKey: ['client-dashboard'] })
    },
    onError: (err: any) => {
      const issues = err.response?.data?.error?.issues ?? err.response?.data?.issues
      toast.error(issues?.[0]?.message ?? err.response?.data?.error ?? 'No se pudo guardar el sitio web')
    },
  })

  const href = value ? (/^https?:\/\//i.test(value) ? value : `https://${value}`) : ''

  if (editing) {
    return (
      <div>
        <p className="text-[11px] font-bold text-brand-600 dark:text-brand-300 uppercase tracking-wider">Sitio web</p>
        <form
          className="flex items-center gap-2 mt-1"
          onSubmit={e => { e.preventDefault(); saveMut.mutate(draft) }}
        >
          <input
            autoFocus
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder="www.miempresa.com"
            aria-label="Sitio web"
            className="flex-1 min-w-0 px-3 py-1.5 text-sm rounded-xl border border-navy-900/10 bg-white text-navy-900
                       dark:border-white/10 dark:bg-navy-800 dark:text-cream-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <button
            type="submit"
            disabled={saveMut.isPending}
            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-navy-900 text-cream-100 hover:bg-navy-800 dark:bg-brand-600 dark:hover:bg-brand-500 disabled:opacity-60"
          >
            {saveMut.isPending ? 'Guardando…' : 'Guardar'}
          </button>
          <button
            type="button"
            onClick={() => { setEditing(false); setDraft(value ?? '') }}
            className="px-2 py-1.5 text-xs font-semibold text-navy-900/60 hover:text-navy-900 dark:text-cream-100/60 dark:hover:text-cream-100"
          >
            Cancelar
          </button>
        </form>
      </div>
    )
  }

  return (
    <div>
      <p className="text-[11px] font-bold text-brand-600 dark:text-brand-300 uppercase tracking-wider">Sitio web</p>
      <div className="flex items-center gap-2 mt-0.5">
        {value ? (
          <a href={href} target="_blank" rel="noopener noreferrer"
             className="text-sm font-medium text-navy-900 dark:text-cream-100 break-all hover:underline">
            {value}
          </a>
        ) : (
          <p className="text-sm font-medium text-navy-900 dark:text-cream-100">—</p>
        )}
        {canEdit && (
          <button
            type="button"
            onClick={() => { setDraft(value ?? ''); setEditing(true) }}
            aria-label="Editar sitio web"
            title="Editar sitio web"
            className="p-1 rounded-lg text-navy-900/50 hover:text-navy-900 hover:bg-navy-900/5 dark:text-cream-100/50 dark:hover:text-cream-100 dark:hover:bg-white/5"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}

export function MyCompanyPage() {
  const { user } = useAuthStore()
  const companyId = user?.companyId

  const { data: company, isLoading } = useQuery({
    queryKey: ['my-company', companyId],
    queryFn: async () => (await api.get(`/api/companies/${companyId}`)).data,
    enabled: !!companyId,
  })

  const { data: servicesData } = useQuery({
    queryKey: ['my-company-services', companyId],
    queryFn: async () => (await api.get(`/api/company-services/${companyId}`)).data,
    enabled: !!companyId,
  })

  if (!companyId) return (
    <div className="flex flex-col h-full">
      <PortalTopBar title="Perfil empresa" subtitle="" />
      <div className="flex-1 flex items-center justify-center text-navy-900/40 dark:text-cream-100/40">No tienes empresa asignada</div>
    </div>
  )

  if (isLoading) return <PageLoader />

  const co = company ?? {}
  const services: any[] = servicesData ?? []
  const contracted = services.map((s: any) => s.services?.name).filter(Boolean)

  const fields = [co.name, co.nit, co.email, co.phone, co.address, co.city, co.sector, co.website]
  const profilePct = fields.length ? Math.round((fields.filter(Boolean).length / fields.length) * 100) : 0

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PortalTopBar title="Perfil empresa" subtitle={co?.name ?? 'Nombre de empresa'} companyName={co?.name ?? 'Logo de la empresa'} />

      <div className="flex-1 overflow-y-auto px-5 md:px-8 pb-8 space-y-5">

        {/* Datos de la empresa */}
        <Card>
          <CardHeader icon="building" title="Datos de la empresa" />
          <div className="grid md:grid-cols-2 gap-x-10 gap-y-5">
            {/* Columna izquierda */}
            <div className="space-y-4">
              <Field label="Razón social" value={co.name} />
              <Field label="Ciudad" value={co.city} />
              <Field label="Teléfono" value={co.phone} />
              <WebsiteField key={co.website ?? ''} companyId={companyId} value={co.website} canEdit={user?.role === 'client_owner'} />
              <Field label="NIT" value={co.nit} />
            </div>

            {/* Columna derecha */}
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-navy-900 dark:text-cream-100 max-w-[8rem] leading-snug">Información completada</p>
                <Gauge value={profilePct} />
              </div>
              <Field label="Sector" value={co.sector} />
              <Field label="Dirección" value={co.address} />
              <Field label="Estado" value={co.status} />
              <button
                type="button"
                title="Estado del registro"
                className="inline-flex items-center justify-center px-8 py-2.5 rounded-full font-display font-bold text-sm
                           bg-navy-900 text-cream-100 hover:bg-navy-800 dark:bg-brand-600 dark:hover:bg-brand-500 transition-colors"
              >
                REGISTRO
              </button>
            </div>
          </div>
        </Card>

        {/* Servicios contratados */}
        <Card>
          <CardHeader icon="briefcase" title="Servicios contratados" />
          {contracted.length ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {contracted.map((name: string, i: number) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-sand-300/40 dark:bg-navy-800">
                  <FintoIcon name="check-circle" size={20} />
                  <span className="text-sm font-medium text-navy-900 dark:text-cream-100">{name}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-navy-900/40 dark:text-cream-100/40 text-center py-4">Sin servicios contratados</p>
          )}
        </Card>

        {/* Más servicios */}
        <Card>
          <CardHeader icon="info" title="Más servicios" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {SERVICE_CATALOG.map((name, i) => (
              <div key={i} className="group relative flex items-center gap-3 px-4 py-3 rounded-xl bg-sand-300/40 dark:bg-navy-800
                                       hover:bg-sand-300/70 dark:hover:bg-navy-700 transition-colors cursor-pointer">
                <FintoIcon name="info" size={20} />
                <span className="text-sm font-medium text-navy-900 dark:text-cream-100">{name}</span>

                {/* Tooltip asesor */}
                <div className="pointer-events-none group-hover:pointer-events-auto absolute left-4 bottom-full mb-2 w-64 z-20
                                opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-200">
                  <div className="rounded-xl bg-navy-900 dark:bg-navy-800 ring-1 ring-white/10 shadow-xl shadow-navy-900/30 p-4">
                    <p className="text-xs text-cream-100/80 leading-relaxed mb-2">{ADVISOR_PITCH}</p>
                    <Link to="/#contacto" className="text-xs font-bold text-cream-100 hover:text-brand-200">Quiero hablar con un asesor →</Link>
                  </div>
                  <div className="w-3 h-3 rotate-45 bg-navy-900 dark:bg-navy-800 ring-1 ring-white/10 -mt-1.5 ml-6" />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
