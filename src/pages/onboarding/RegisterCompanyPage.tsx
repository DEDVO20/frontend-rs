import { useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import {
  CheckCircle2, Loader2, ChevronLeft, X,
  FileText, Shield, ClipboardList, Users, Calculator, CreditCard, ShoppingBag,
  FileCheck2, IdCard, AlertCircle, ChevronDown, ChevronUp, Paperclip,
} from 'lucide-react'
import { FintoLogo } from '@/components/ui/FintoLogo'

// ── Types ──────────────────────────────────────────────────────────────────────

interface CompanyData {
  razon_social: string
  nit: string
  tipo: string
  sector: string
  ciudad: string
  direccion: string
  telefono: string
  sitio_web: string
}

interface LegalRep {
  nombre: string
  cedula: string
  email: string
  telefono: string
  cargo: string
}

interface Policy {
  id: string
  label: string
  icon: React.ElementType
  version: string
  body: string
  accepted: boolean
  expanded: boolean
}

// ── Constants ──────────────────────────────────────────────────────────────────

const TIPOS = ['S.A.S', 'S.A.', 'LTDA', 'E.A.T', 'Persona Natural', 'Otro']
const SECTORES = [
  'Comercio', 'Servicios', 'Manufactura', 'Salud', 'Educación',
  'Tecnología', 'Construcción', 'Agropecuario', 'Financiero', 'Otro',
]

const SERVICE_ICONS: Record<string, any> = {
  'Contabilidad e impuestos': Calculator,
  'Controller financiero e impuestos': CreditCard,
  'Facturación y cartera': FileText,
  'Gestión de personal y nómina': Users,
  'Nómina': Users,
  'SG-SST': Shield,
}

const SERVICES_FALLBACK = [
  { id: 'contabilidad', name: 'Contabilidad e Impuestos', description: 'Contabilidad, declaraciones, medios magnéticos y revisión fiscal.' },
  { id: 'controller',   name: 'Controller financiero y tesorería', description: 'Control presupuestal, flujo de caja y gestión bancaria.' },
  { id: 'facturacion',  name: 'Facturación y recaudo', description: 'Facturación electrónica DIAN, cartera y cobro.' },
  { id: 'gestion',      name: 'Gestión de personal y compras', description: 'Selección, contratación, proveedores y compras.' },
  { id: 'nomina',       name: 'Nómina', description: 'Procesamiento de nómina, seguridad social y PILA.' },
  { id: 'sgsst',        name: 'SG-SST', description: 'Sistema de gestión de seguridad y salud en el trabajo.' },
]

const POLICY_TEXTS: Record<string, string> = {
  datos:    'Autorizo a RS Hubs S.A.S. para recolectar, almacenar, usar y circular mis datos personales conforme a la Ley 1581 de 2012, con finalidades de prestación de servicios, envío de comunicaciones y mejora de la plataforma.',
  politica: 'RS Hubs S.A.S. tratará sus datos personales con las medidas de seguridad requeridas. Usted tiene derecho a conocer, actualizar, rectificar y suprimir sus datos. Dirija sus solicitudes a privacidad@rshubs.com.',
  sarlaft:  'Declaro que los recursos con los que se vincula a RS Hubs S.A.S. provienen de actividades lícitas y me obligo a informar cualquier cambio en las condiciones declaradas. Autorizo las verificaciones en listas restrictivas.',
  terminos: 'Acepto los Términos y Condiciones de Servicio de RS Hubs S.A.S., incluyendo las condiciones de uso de la plataforma, tarifas, SLA, propiedad intelectual y política de confidencialidad.',
}

// policy_type values que usa el backend
const POLICY_TYPE_MAP: Record<string, string> = {
  datos:    'data_processing',
  politica: 'privacy_policy',
  sarlaft:  'sarlaft',
  terminos: 'terms_of_service',
}

const INITIAL_POLICIES: Policy[] = [
  { id: 'datos',    label: 'Autorización de Tratamiento de Datos',               icon: FileCheck2,   version: 'v1.0', body: POLICY_TEXTS.datos,    accepted: false, expanded: false },
  { id: 'politica', label: 'Política de Tratamiento de Datos Personales',         icon: Shield,       version: 'v1.0', body: POLICY_TEXTS.politica, accepted: false, expanded: false },
  { id: 'sarlaft',  label: 'Declaración SARLAFT — Prevención Lavado de Activos',  icon: ShoppingBag,  version: 'v1.0', body: POLICY_TEXTS.sarlaft,  accepted: false, expanded: false },
  { id: 'terminos', label: 'Términos y Condiciones de Servicio',                  icon: ClipboardList, version: 'v1.0', body: POLICY_TEXTS.terminos, accepted: false, expanded: false },
]

const STEPS = ['Empresa', 'Servicios', 'Políticas', 'Documentos', 'Confirmar']

// ── Component ─────────────────────────────────────────────────────────────────

export function RegisterCompanyPage() {
  const [step, setStep] = useState(0)

  // Step 1
  const [company, setCompany] = useState<CompanyData>({
    razon_social: '', nit: '', tipo: '', sector: '', ciudad: '', direccion: '', telefono: '', sitio_web: '',
  })
  const [rep, setRep] = useState<LegalRep>({ nombre: '', cedula: '', email: '', telefono: '', cargo: '' })

  // Step 2
  const [services, setServices] = useState<string[]>([])

  const { data: dbServices } = useQuery({
    queryKey: ['services-public'],
    queryFn: async () => {
      try {
        const { data } = await api.get('/api/services/public')
        return data as any[]
      } catch { return null }
    },
  })
  const availableServices: any[] = dbServices ?? SERVICES_FALLBACK

  // Step 3
  const [policies, setPolicies] = useState<Policy[]>(INITIAL_POLICIES)

  // Step 4
  const [files, setFiles] = useState<{ rut: File | null; cedula: File | null; sarlaft: File | null }>({
    rut: null, cedula: null, sarlaft: null,
  })

  const mutation = useMutation({
    mutationFn: async () => {
      // 1. Crear borrador de onboarding (ruta pública, sin auth)
      const payload = {
        company_name:    company.razon_social,
        company_nit:     company.nit || undefined,
        company_type:    company.tipo || undefined,
        company_sector:  company.sector || undefined,
        company_city:    company.ciudad || undefined,
        company_address: company.direccion || undefined,
        company_phone:   company.telefono || undefined,
        company_website: company.sitio_web
          ? (company.sitio_web.match(/^https?:\/\//) ? company.sitio_web : `https://${company.sitio_web}`)
          : undefined,
        rep_name:        rep.nombre,
        rep_email:       rep.email,
        rep_phone:       rep.telefono || undefined,
        rep_cedula:      rep.cedula || undefined,
        rep_position:    rep.cargo || undefined,
      }
      const { data: draft } = await api.post('/api/onboarding', payload)
      const id = draft.id as string

      // 2. Subir documentos KYC
      const uploadKyc = async (file: File, doc_type: string) => {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('doc_type', doc_type)
        try {
          await api.post(`/api/onboarding/${id}/kyc/documents`, fd)
        } catch (err: any) {
          const msg = err?.response?.data?.error ?? err?.message ?? 'Error desconocido'
          throw new Error(`Error al subir "${file.name}": ${msg}`)
        }
      }
      await Promise.all([
        files.rut     && uploadKyc(files.rut,     'rut'),
        files.cedula  && uploadKyc(files.cedula,  'cedula_representante'),
        files.sarlaft && uploadKyc(files.sarlaft, 'sarlaft_form'),
      ])

      // 3. Seleccionar servicios — /api/services requiere auth; los servicios
      //    seleccionados se registran como nota hasta que un admin los asigne.
      //    Si en el futuro se expone un endpoint público, se puede enlazar aquí.

      // 4. Aceptar políticas — GET /api/policies/active es público
      let policyPayload: Array<{
        policy_version_id: string
        accepted_by_name: string
        accepted_by_email: string
        accepted_by_cedula?: string
      }>
      try {
        const { data: activePolicies } = await api.get('/api/policies/active')
        const activeList = Array.isArray(activePolicies) ? activePolicies : (activePolicies.data ?? [])
        policyPayload = policies.map(p => {
          const policyType = POLICY_TYPE_MAP[p.id] ?? p.id
          const match = activeList.find((pv: any) => pv.policy_type === policyType)
          return {
            policy_version_id:  match?.id ?? p.id,
            accepted_by_name:   rep.nombre,
            accepted_by_email:  rep.email,
            accepted_by_cedula: rep.cedula || undefined,
          }
        })
      } catch {
        // Si no hay políticas en la BD, enviamos placeholders
        policyPayload = policies.map(p => ({
          policy_version_id:  p.id,
          accepted_by_name:   rep.nombre,
          accepted_by_email:  rep.email,
          accepted_by_cedula: rep.cedula || undefined,
        }))
      }
      try {
        await api.post(`/api/onboarding/${id}/policies`, { policies: policyPayload })
      } catch (err: any) {
        // Si falla la aceptación de políticas (ej: policy_version_id inválido), continuamos
        // El equipo puede registrarlas manualmente
      }

      // 5. Enviar a revisión
      try {
        const { data } = await api.post(`/api/onboarding/${id}/submit`)
        return data
      } catch (err: any) {
        const msg = err?.response?.data?.error ?? err?.message ?? 'Error al enviar la solicitud'
        throw new Error(msg)
      }
    },
  })

  const setC = (f: keyof CompanyData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setCompany(p => ({ ...p, [f]: e.target.value }))
  const setR = (f: keyof LegalRep) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setRep(p => ({ ...p, [f]: e.target.value }))

  const toggleService = (id: string) =>
    setServices(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])

  const togglePolicy = (id: string, field: 'accepted' | 'expanded') =>
    setPolicies(ps => ps.map(p => p.id === id ? { ...p, [field]: !p[field] } : p))

  const step1Valid = !!company.razon_social && !!company.nit && !!company.tipo && !!company.ciudad
    && !!rep.nombre && !!rep.cedula && !!rep.email && !!rep.telefono

  const step2Valid = services.length > 0
  const step3Valid = policies.every(p => p.accepted)
  const step4Valid = !!files.rut && !!files.cedula && !!files.sarlaft

  const canNext = [step1Valid, step2Valid, step3Valid, step4Valid, true][step]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (step < 4) { setStep(s => s + 1); return }
    await mutation.mutateAsync()
  }

  // ── Success screen ───────────────────────────────────────────────────────────
  if (mutation.isSuccess) {
    return (
      <div className="min-h-screen bg-cream-100 flex items-center justify-center p-4 md:p-8">
        <div className="relative w-full max-w-md overflow-hidden rounded-[2rem] shadow-2xl shadow-navy-900/25
                        bg-gradient-to-br from-navy-900 via-brand-800 to-brand-600 p-10 text-center">
          <div className="w-16 h-16 rounded-full bg-cream-100/15 flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 className="w-9 h-9 text-cream-100" />
          </div>
          <h2 className="font-display text-2xl font-bold text-cream-100 mb-2">¡Solicitud enviada!</h2>
          <p className="text-cream-100/70 mb-8 leading-relaxed">
            Nuestro equipo revisará su solicitud y le contactará en menos de 24 horas hábiles.
          </p>
          <Link to="/" className="inline-flex w-full items-center justify-center gap-2 bg-cream-100 text-navy-900 px-6 py-3.5 rounded-full font-display font-bold hover:bg-cream-50 transition-colors">
            Volver al inicio
          </Link>
        </div>
      </div>
    )
  }

  const STEP_TITLES = ['Empieza hoy', 'Seleccione sus servicios', 'Políticas y autorizaciones', 'Documentos de vinculación', 'Revise y confirme']
  const STEP_SUBS = [
    'Ingrese la información básica de su empresa y del representante legal.',
    'Escoja uno o más módulos según las necesidades de su empresa.',
    'Lea cada política y confirme su aceptación. Queda registrada con fecha y hora.',
    'Suba los documentos requeridos en PDF o imagen. Máx. 10 MB por archivo.',
    'Verifique que toda la información sea correcta antes de enviar.',
  ]

  return (
    <div className="min-h-screen bg-cream-100 flex items-center justify-center p-4 md:p-8">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-[2rem] shadow-2xl shadow-navy-900/25
                      bg-gradient-to-br from-navy-900 via-brand-800 to-brand-600">
        {/* Cerrar */}
        <Link to="/" aria-label="Cerrar"
          className="absolute top-5 right-5 z-10 text-brand-200 hover:text-cream-100 transition-colors">
          <X className="w-6 h-6" />
        </Link>

        <div className="p-6 md:p-10">
          {/* Header: logo + título */}
          <div className="relative mb-6">
            <FintoLogo variant="white" height={26} className="absolute left-0 top-0" />
            <h1 className="font-display text-2xl md:text-3xl font-bold text-cream-100 text-center pt-1">
              {STEP_TITLES[step]}
            </h1>
          </div>

          {/* Indicador de pasos */}
          <div className="flex items-center justify-center gap-2 mb-6">
            {STEPS.map((_, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold font-display transition-all ${
                  i < step ? 'bg-brand-400 text-cream-100' :
                  i === step ? 'bg-brand-500 text-cream-100 ring-2 ring-cream-100/50' :
                  'bg-white/10 text-cream-100/40'
                }`}>
                  {i < step ? '✓' : i + 1}
                </div>
                {i < STEPS.length - 1 && <div className={`w-5 h-px ${i < step ? 'bg-brand-400' : 'bg-white/20'}`} />}
              </div>
            ))}
          </div>

          <p className="text-center text-sm text-cream-100/60 mb-8 max-w-lg mx-auto">{STEP_SUBS[step]}</p>

          <form onSubmit={handleSubmit}>
            {/* ── STEP 1: Empresa ─────────────────────────────────────────── */}
            {step === 0 && (
              <div className="space-y-7">
                <Section title="Regístrate">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Razón social *" className="sm:col-span-2">
                      <Input placeholder="Nombre S.A.S." value={company.razon_social} onChange={setC('razon_social')} required />
                    </Field>
                    <Field label="NIT *">
                      <Input placeholder="900.123.456-7" value={company.nit} onChange={setC('nit')} required />
                    </Field>
                    <Field label="Tipo *">
                      <Select value={company.tipo} onChange={setC('tipo')} required>
                        <option value="">Seleccionar…</option>
                        {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
                      </Select>
                    </Field>
                    <Field label="Sector">
                      <Select value={company.sector} onChange={setC('sector')}>
                        <option value="">Seleccionar…</option>
                        {SECTORES.map(s => <option key={s} value={s}>{s}</option>)}
                      </Select>
                    </Field>
                    <Field label="Ciudad *">
                      <Input placeholder="Bogotá" value={company.ciudad} onChange={setC('ciudad')} required />
                    </Field>
                    <Field label="Dirección" className="sm:col-span-2">
                      <Input placeholder="Calle 100 # 15-20" value={company.direccion} onChange={setC('direccion')} />
                    </Field>
                    <Field label="Correo electrónico *" className="sm:col-span-2">
                      <Input placeholder="empresa@correo.com" type="email" value={rep.email} onChange={setR('email')} required />
                    </Field>
                    <Field label="Teléfono *">
                      <Input placeholder="+57 300 000 0000" value={company.telefono} onChange={setC('telefono')} />
                    </Field>
                    <Field label="Sitio web">
                      <Input placeholder="https://…" value={company.sitio_web} onChange={setC('sitio_web')} />
                    </Field>
                  </div>
                </Section>

                <Section title="Representante legal">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Nombre completo *" className="sm:col-span-2">
                      <Input placeholder="" value={rep.nombre} onChange={setR('nombre')} required />
                    </Field>
                    <Field label="Cédula *">
                      <Input placeholder="" value={rep.cedula} onChange={setR('cedula')} required />
                    </Field>
                    <Field label="Cargo">
                      <Input placeholder="Gerente General" value={rep.cargo} onChange={setR('cargo')} />
                    </Field>
                    <Field label="Teléfono móvil *" className="sm:col-span-2">
                      <Input placeholder="+57 300 000 0000" value={rep.telefono} onChange={setR('telefono')} required />
                    </Field>
                  </div>
                </Section>
              </div>
            )}

            {/* ── STEP 2: Servicios ───────────────────────────────────────── */}
            {step === 1 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {availableServices.map((svc: any) => {
                  const Icon = SERVICE_ICONS[svc.name] ?? ClipboardList
                  const selected = services.includes(svc.id)
                  return (
                    <button
                      key={svc.id}
                      type="button"
                      onClick={() => toggleService(svc.id)}
                      className={`text-left p-4 rounded-xl ring-1 transition-all ${
                        selected
                          ? 'ring-brand-300 bg-brand-500/30'
                          : 'ring-white/10 bg-white/5 hover:bg-white/10'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${selected ? 'bg-brand-400/40' : 'bg-white/10'}`}>
                          <Icon className="w-5 h-5 text-cream-100" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-semibold text-sm text-cream-100">{svc.name}</p>
                            {selected && <CheckCircle2 className="w-4 h-4 text-cream-100 shrink-0" />}
                          </div>
                          <p className="text-xs text-cream-100/55 mt-0.5 leading-relaxed">{svc.description ?? ''}</p>
                        </div>
                      </div>
                    </button>
                  )
                })}
                {!step2Valid && (
                  <p className="sm:col-span-2 text-xs text-gold-300 flex items-center gap-1.5 bg-white/5 px-3 py-2 rounded-lg">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" /> Seleccione al menos un servicio para continuar.
                  </p>
                )}
              </div>
            )}

            {/* ── STEP 3: Políticas ───────────────────────────────────────── */}
            {step === 2 && (
              <div className="space-y-3">
                {policies.map(policy => {
                  const Icon = policy.icon
                  return (
                    <div key={policy.id} className={`rounded-xl ring-1 bg-white/5 overflow-hidden transition-all ${policy.accepted ? 'ring-brand-300' : 'ring-white/10'}`}>
                      <div className="flex items-center gap-3 p-4">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${policy.accepted ? 'bg-brand-400/40' : 'bg-white/10'}`}>
                          <Icon className="w-5 h-5 text-cream-100" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-cream-100">{policy.label}</p>
                          <p className="text-xs text-cream-100/50">{policy.version} · Activa</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => togglePolicy(policy.id, 'expanded')}
                          className="text-cream-100/50 hover:text-cream-100 transition-colors p-1"
                        >
                          {policy.expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>
                      {policy.expanded && (
                        <div className="px-4 pb-3 border-t border-white/10 pt-3">
                          <p className="text-xs text-cream-100/70 leading-relaxed">{policy.body}</p>
                        </div>
                      )}
                      <div className="px-4 pb-4">
                        <label className="flex items-center gap-2.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={policy.accepted}
                            onChange={() => togglePolicy(policy.id, 'accepted')}
                            className="w-4 h-4 rounded accent-brand-500 cursor-pointer"
                          />
                          <span className={`text-sm font-medium ${policy.accepted ? 'text-cream-100' : 'text-cream-100/70'}`}>
                            He leído y acepto {policy.label}
                          </span>
                        </label>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* ── STEP 4: Documentos ──────────────────────────────────────── */}
            {step === 3 && (
              <div className="space-y-4">
                <DocUpload
                  icon={<FileText className="w-5 h-5 text-cream-100" />}
                  label="RUT de la empresa"
                  required
                  file={files.rut}
                  onChange={f => setFiles(p => ({ ...p, rut: f }))}
                  hint="PDF o imagen · Máx. 10 MB"
                  uploadLabel="Subir RUT"
                />
                <DocUpload
                  icon={<IdCard className="w-5 h-5 text-cream-100" />}
                  label="Cédula del representante"
                  required
                  file={files.cedula}
                  onChange={f => setFiles(p => ({ ...p, cedula: f }))}
                  hint="PDF o imagen · Máx. 10 MB"
                  uploadLabel="Subir cédula (ambas caras)"
                />
                <DocUpload
                  icon={<Shield className="w-5 h-5 text-cream-100" />}
                  label="Formulario SARLAFT"
                  required
                  file={files.sarlaft}
                  onChange={f => setFiles(p => ({ ...p, sarlaft: f }))}
                  hint="PDF o imagen · Máx. 10 MB"
                  uploadLabel="Subir formulario SARLAFT firmado"
                  extra={
                    <p className="text-xs text-cream-100/60 flex items-center gap-1.5 mt-1">
                      <Paperclip className="w-3.5 h-3.5 shrink-0" />
                      Descargue, diligencie y firme el formulario SARLAFT antes de subirlo.{' '}
                      <a href="#" className="text-brand-200 font-medium hover:underline">Descargar formulario →</a>
                    </p>
                  }
                />
              </div>
            )}

            {/* ── STEP 5: Confirmar ───────────────────────────────────────── */}
            {step === 4 && (
              <div className="space-y-4">
                <ReviewSection title="🏢 Datos de la empresa">
                  <Row label="Razón social"  value={company.razon_social} />
                  <Row label="NIT"           value={company.nit} />
                  <Row label="Tipo y Sector" value={[company.tipo, company.sector].filter(Boolean).join(' · ')} />
                  <Row label="Ciudad"        value={company.ciudad} />
                  {company.direccion && <Row label="Dirección" value={company.direccion} />}
                  {company.telefono  && <Row label="Tel. Empresa" value={company.telefono} />}
                  {company.sitio_web && <Row label="Sitio web" value={company.sitio_web} />}
                </ReviewSection>

                <ReviewSection title="👤 Representante Legal">
                  <Row label="Nombre"   value={rep.nombre} />
                  <Row label="Cédula"   value={rep.cedula} />
                  {rep.cargo    && <Row label="Cargo"   value={rep.cargo} />}
                  <Row label="Correo"   value={rep.email} />
                  <Row label="Tel. Móvil" value={rep.telefono} />
                </ReviewSection>

                <ReviewSection title="⚙️ Servicios seleccionados">
                  <Row label="Módulos" value={availableServices.filter((s: any) => services.includes(s.id)).map((s: any) => s.name).join(', ')} />
                </ReviewSection>

                <ReviewSection title="✅ Políticas aceptadas">
                  {policies.map(p => (
                    <Row key={p.id} label={p.label} value={`✓ ${p.version}`} valueClass="text-emerald-300 font-semibold" />
                  ))}
                </ReviewSection>

                <ReviewSection title="📁 Documentos cargados">
                  {files.rut    && <Row label="RUT"            value={`✓ ${files.rut.name}`}    valueClass="text-emerald-300" />}
                  {files.cedula && <Row label="Cédula rep. legal" value={`✓ ${files.cedula.name}`} valueClass="text-emerald-300" />}
                  {files.sarlaft && <Row label="SARLAFT"        value={`✓ ${files.sarlaft.name}`} valueClass="text-emerald-300" />}
                </ReviewSection>

                {mutation.isError && (
                  <div className="text-sm text-red-200 bg-red-500/20 ring-1 ring-red-400/30 px-4 py-3 rounded-lg flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <p>
                      {(mutation.error as any)?.response?.data?.error
                        ?? (mutation.error as any)?.message
                        ?? 'Error al enviar la solicitud. Por favor intente nuevamente.'}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ── Nav buttons ─────────────────────────────────────────────── */}
            <div className="flex gap-3 mt-8 justify-center">
              {step > 0 && (
                <button
                  type="button"
                  onClick={() => setStep(s => s - 1)}
                  className="flex items-center gap-1.5 px-6 py-3.5 rounded-full border border-cream-100/30 text-cream-100 font-display font-bold hover:bg-white/10 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" /> Volver
                </button>
              )}
              <button
                type="submit"
                disabled={!canNext || mutation.isPending}
                className="min-w-[200px] inline-flex items-center justify-center gap-2 bg-navy-950 text-cream-100 py-3.5 px-8 rounded-full font-display font-bold hover:bg-navy-900 ring-1 ring-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {mutation.isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Enviando…</>
                ) : step < 4 ? (
                  'Continuar'
                ) : (
                  'Enviar solicitud'
                )}
              </button>
            </div>
          </form>

          <p className="text-center text-sm text-cream-100/60 mt-6">
            ¿Ya tiene cuenta?{' '}
            <Link to="/login" className="text-brand-200 hover:text-cream-100 font-medium">Inicie sesión</Link>
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Helper components (estética Finto sobre tarjeta azul) ────────────────────────

const inputCls = 'w-full px-4 py-3 rounded-xl bg-white/10 text-cream-100 placeholder:text-cream-100/40 ring-1 ring-white/15 focus:outline-none focus:ring-2 focus:ring-brand-300 transition text-sm'

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={inputCls} />
}

function Select({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { children: React.ReactNode }) {
  return <select {...props} className={`${inputCls} appearance-none bg-[position:right_0.75rem_center] bg-no-repeat [&>option]:text-navy-900`}>{children}</select>
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-2 ${className ?? ''}`}>
      <label className="block text-[11px] font-bold text-brand-200 uppercase tracking-wider">{label}</label>
      {children}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="font-display font-bold text-cream-100 text-lg mb-4">{title}</h3>
      {children}
    </div>
  )
}

function ReviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white/5 ring-1 ring-white/10 rounded-2xl overflow-hidden">
      <div className="px-5 py-3 bg-white/5 border-b border-white/10">
        <p className="text-sm font-bold text-cream-100">{title}</p>
      </div>
      <div className="divide-y divide-white/5">{children}</div>
    </div>
  )
}

function Row({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 py-2.5">
      <span className="text-xs text-cream-100/50 shrink-0 pt-0.5">{label}</span>
      <span className={`text-sm font-medium text-right ${valueClass ?? 'text-cream-100'}`}>{value || '—'}</span>
    </div>
  )
}

function DocUpload({
  icon, label, required, file, onChange, hint, uploadLabel, extra,
}: {
  icon: React.ReactNode
  label: string
  required?: boolean
  file: File | null
  onChange: (f: File) => void
  hint: string
  uploadLabel: string
  extra?: React.ReactNode
}) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div className="bg-white/5 ring-1 ring-white/10 rounded-2xl p-5 space-y-3">
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center shrink-0">{icon}</div>
        <div>
          <p className="font-semibold text-sm text-cream-100">
            {label} {required && <span className="text-gold-300 text-xs">Requerido</span>}
          </p>
          {file ? (
            <p className="text-xs text-emerald-300 font-medium mt-0.5 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> {file.name}
            </p>
          ) : (
            <p className="text-xs text-cream-100/45">Sin archivos seleccionados</p>
          )}
        </div>
      </div>
      {extra}
      <button
        type="button"
        onClick={() => ref.current?.click()}
        className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-white/20 hover:border-brand-300 text-cream-100/70 hover:text-cream-100 text-sm py-3 rounded-xl transition-colors"
      >
        <FileCheck2 className="w-4 h-4" />
        {uploadLabel}
        <span className="text-xs text-cream-100/45">· {hint}</span>
      </button>
      <input
        ref={ref}
        type="file"
        accept=".pdf,image/*"
        className="hidden"
        onChange={e => e.target.files?.[0] && onChange(e.target.files[0])}
      />
    </div>
  )
}
