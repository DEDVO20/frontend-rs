import { useState, useEffect } from 'react'
import { X, ChevronRight, ChevronLeft, CheckCircle2, Loader2, Check } from 'lucide-react'
import { api } from '@/lib/api'

// ── Types ─────────────────────────────────────────────────────────────────────

type Service =
  | 'facturacion' | 'cartera' | 'controller'
  | 'contabilidad' | 'pagos' | 'nomina' | 'multiples'

type CompanySize = '1-3' | '4-10' | '11-24' | '25+'
type StartDate   = 'asap' | 'this-month' | 'next-month' | 'just-quoting'
type PricingTier = 'emprendedor' | 'pequeña' | 'mediana'
type BillingModule = 'controller' | 'contabilidad' | 'facturacion-cartera' | 'nomina'

interface FormData {
  services:    Service[]
  companySize: CompanySize | ''
  startDate:   StartDate | ''
  name:        string
  company:     string
  phone:       string
  email:       string
}

interface Props {
  open:    boolean
  onClose: () => void
}

// ── Pricing data ──────────────────────────────────────────────────────────────

const SIZE_TO_TIER: Record<CompanySize, PricingTier> = {
  '1-3':   'emprendedor',
  '4-10':  'pequeña',
  '11-24': 'pequeña',
  '25+':   'mediana',
}

const TIER_INFO: Record<PricingTier, { label: string; employees: string; color: string }> = {
  emprendedor: { label: 'Emprendedor',     employees: '1–3 empleados',     color: '#3d6bc1' },
  pequeña:     { label: 'Pequeña empresa', employees: '4–24 empleados',    color: '#315aa8' },
  mediana:     { label: 'Mediana empresa', employees: '25+ empleados',     color: '#1a2545' },
}

const BANK_ACCOUNTS: Record<PricingTier, string> = {
  emprendedor: '1 cuenta bancaria (hasta 40 txn)',
  pequeña:     '2 cuentas bancarias (hasta 100 txn)',
  mediana:     '3 cuentas bancarias (hasta 500 txn)',
}

const SERVICE_TO_MODULE: Record<Service, BillingModule | 'multiples'> = {
  facturacion:  'facturacion-cartera',
  cartera:      'facturacion-cartera',
  controller:   'controller',
  pagos:        'controller',
  contabilidad: 'contabilidad',
  nomina:       'nomina',
  multiples:    'multiples',
}

const MODULE_PRICES: Record<BillingModule, Record<PricingTier, number>> = {
  'controller':          { emprendedor: 1_750_905, pequeña: 3_501_810, mediana:  7_003_620 },
  'contabilidad':        { emprendedor: 3_501_810, pequeña: 7_003_620, mediana: 14_007_240 },
  'facturacion-cartera': { emprendedor: 1_750_905, pequeña: 3_501_810, mediana:  7_003_620 },
  'nomina':              { emprendedor: 1_750_905, pequeña: 3_501_810, mediana:  7_003_620 },
}

const MODULE_LABELS: Record<BillingModule, string> = {
  'controller':          'Control financiero y tesorería',
  'contabilidad':        'Contabilidad e impuestos',
  'facturacion-cartera': 'Facturación, cobranza y datos',
  'nomina':              'Gestión de personal y SG-SST',
}

const FULL_PACKAGE_PRICE: Record<PricingTier, number> = {
  emprendedor:  8_754_525,
  pequeña:     17_509_050,
  mediana:     35_018_100,
}

const ANNUAL_EXTRAS = [
  { label: 'Renta anual*',        prices: { emprendedor: 1_750_905, pequeña: 3_501_810, mediana: 7_003_620 } },
  { label: 'Medios distritales*', prices: { emprendedor: 1_750_905, pequeña: 3_501_810, mediana: 7_003_620 } },
  { label: 'Medios nacionales*',  prices: { emprendedor: 1_750_905, pequeña: 3_501_810, mediana: 7_003_620 } },
]

const formatCOP = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)

function getActiveModules(services: Service[]): BillingModule[] {
  if (services.includes('multiples')) return Object.keys(MODULE_PRICES) as BillingModule[]
  const mods = services
    .map(s => SERVICE_TO_MODULE[s])
    .filter((m): m is BillingModule => m !== 'multiples')
  return [...new Set(mods)]
}

function calcMonthlyPrice(services: Service[], tier: PricingTier): number {
  if (services.includes('multiples')) return FULL_PACKAGE_PRICE[tier]
  const modules = getActiveModules(services)
  if (modules.length === 4) return FULL_PACKAGE_PRICE[tier]
  return modules.reduce((sum, mod) => sum + MODULE_PRICES[mod][tier], 0)
}

const hasAnnualExtras = (services: Service[]) =>
  services.includes('contabilidad') || services.includes('multiples')

// ── Step configs ──────────────────────────────────────────────────────────────

const SERVICES: { value: Service; label: string; emoji: string }[] = [
  { value: 'facturacion',  label: 'Facturación',                      emoji: '🧾' },
  { value: 'cartera',      label: 'Cobro de cartera',                 emoji: '💰' },
  { value: 'controller',   label: 'Control financiero y tesorería',   emoji: '📊' },
  { value: 'contabilidad', label: 'Contabilidad e impuestos',         emoji: '📚' },
  { value: 'pagos',        label: 'Pagos y tesorería',                emoji: '💳' },
  { value: 'nomina',       label: 'Nómina y gestión administrativa',  emoji: '👥' },
  { value: 'multiples',    label: 'Tercerizar varias áreas',          emoji: '🚀' },
]

const SIZES: { value: CompanySize; label: string }[] = [
  { value: '1-3',   label: '1 a 3 empleados' },
  { value: '4-10',  label: '4 a 10 empleados' },
  { value: '11-24', label: '11 a 24 empleados' },
  { value: '25+',   label: '25 o más empleados' },
]

const START_DATES: { value: StartDate; label: string; emoji: string }[] = [
  { value: 'asap',          label: 'Lo antes posible',    emoji: '⚡' },
  { value: 'this-month',    label: 'Este mes',             emoji: '📅' },
  { value: 'next-month',    label: 'Próximo mes',          emoji: '🗓️' },
  { value: 'just-quoting',  label: 'Solo estoy cotizando', emoji: '🔍' },
]

// Orden: 1 Servicios → 2 Tamaño → 3 Cuándo → 4 Contacto → 5 Cotizador (submit)
const TOTAL_STEPS = 5

// ── Component ─────────────────────────────────────────────────────────────────

export function ContactFormModal({ open, onClose }: Props) {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState<FormData>({
    services: [], companySize: '', startDate: '',
    name: '', company: '', phone: '', email: '',
  })
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else      document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  const handleClose = () => {
    onClose()
    setTimeout(() => {
      setStep(1); setSuccess(false); setError(null)
      setForm({ services: [], companySize: '', startDate: '',
                name: '', company: '', phone: '', email: '' })
    }, 300)
  }

  const toggleService = (svc: Service) => {
    setForm(f => {
      let next: Service[]
      if (svc === 'multiples') {
        next = f.services.includes('multiples') ? [] : ['multiples']
      } else {
        const without = f.services.filter(s => s !== 'multiples')
        next = without.includes(svc) ? without.filter(s => s !== svc) : [...without, svc]
      }
      return { ...f, services: next }
    })
  }

  const canNext = (): boolean => {
    if (step === 1) return form.services.length > 0
    if (step === 2) return form.companySize !== ''
    if (step === 3) return form.startDate !== ''
    if (step === 4) return (
      form.name.trim().length >= 2 &&
      form.company.trim().length >= 1 &&
      form.phone.trim().length >= 7 &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)
    )
    if (step === 5) return true  // cotizador — siempre puede enviar
    return false
  }

  const handleSubmit = async () => {
    setLoading(true); setError(null)
    try {
      await api.post('/contact/lead', {
        services:    form.services,
        companySize: form.companySize,
        startDate:   form.startDate,
        name:        form.name,
        company:     form.company,
        phone:       form.phone,
        email:       form.email,
      })
      setSuccess(true)
    } catch (e: any) {
      setError(e?.response?.data?.error ?? 'Ocurrió un error. Por favor intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  const tier          = form.companySize ? SIZE_TO_TIER[form.companySize as CompanySize] : null
  const tierInfo      = tier ? TIER_INFO[tier] : null
  const activeModules = getActiveModules(form.services)
  const monthlyPrice  = (tier && form.services.length > 0) ? calcMonthlyPrice(form.services, tier) : 0
  const isFullPackage = form.services.includes('multiples') || activeModules.length === 4

  const progress = ((step - 1) / (TOTAL_STEPS - 1)) * 100

  return (
    <div
      id="contact-form-modal-overlay"
      className="contact-modal-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) handleClose() }}
    >
      <div className="contact-modal-panel" role="dialog" aria-modal="true" aria-labelledby="contact-modal-title">

        <button id="contact-modal-close-btn" onClick={handleClose}
          className="contact-modal-close" aria-label="Cerrar">
          <X className="w-5 h-5" />
        </button>

        {success ? (
          <div className="contact-modal-success">
            <div className="contact-success-icon">
              <CheckCircle2 className="w-10 h-10 text-brand-600" />
            </div>
            <h2 className="contact-success-title">¡Listo! Ya podemos preparar tu cotización</h2>
            <p className="contact-success-body">
              En menos de <strong>48 horas</strong> recibirás una propuesta personalizada en tu correo.
              También puedes escribirnos a <strong>finto@finto.la</strong>.
            </p>
            <button id="contact-modal-success-close" onClick={handleClose}
              className="contact-btn-primary w-full mt-2">
              Perfecto, gracias
            </button>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="contact-modal-header">
              <div className="contact-modal-step-label">Paso {step} de {TOTAL_STEPS}</div>
              <div className="contact-progress-track">
                <div className="contact-progress-fill" style={{ width: `${progress}%` }} />
              </div>
            </div>

            <div className="contact-modal-body">

              {/* ── Step 1: Servicios ── */}
              {step === 1 && (
                <div className="contact-step-enter">
                  <h2 id="contact-modal-title" className="contact-question-title">
                    ¿En qué podemos ayudarte?
                  </h2>
                  <p className="contact-question-sub">Puedes seleccionar uno o varios servicios.</p>
                  <div className="contact-options-grid">
                    {SERVICES.map(s => {
                      const isSelected = form.services.includes(s.value)
                      const isDisabled = s.value !== 'multiples' && form.services.includes('multiples')
                      return (
                        <button key={s.value} id={`service-opt-${s.value}`} type="button"
                          onClick={() => toggleService(s.value)} disabled={isDisabled}
                          className={`contact-option-card multi ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}`}>
                          {isSelected && (
                            <span className="contact-option-check">
                              <Check className="w-3 h-3" />
                            </span>
                          )}
                          <span className="contact-option-emoji">{s.emoji}</span>
                          <span className="contact-option-label">{s.label}</span>
                        </button>
                      )
                    })}
                  </div>
                  {form.services.length > 0 && !form.services.includes('multiples') && (
                    <p className="contact-selection-count">
                      {form.services.length} servicio{form.services.length > 1 ? 's' : ''} seleccionado{form.services.length > 1 ? 's' : ''}
                    </p>
                  )}
                </div>
              )}

              {/* ── Step 2: Tamaño (4 opciones) ── */}
              {step === 2 && (
                <div className="contact-step-enter">
                  <h2 className="contact-question-title">¿Qué tan grande es tu operación?</h2>
                  <div className="contact-options-list">
                    {SIZES.map(s => (
                      <button key={s.value} id={`size-opt-${s.value}`} type="button"
                        onClick={() => setForm(f => ({ ...f, companySize: s.value }))}
                        className={`contact-option-pill ${form.companySize === s.value ? 'selected' : ''}`}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Step 3: ¿Cuándo? ── */}
              {step === 3 && (
                <div className="contact-step-enter">
                  <h2 className="contact-question-title">¿Cuándo te gustaría empezar?</h2>
                  <div className="contact-options-grid contact-options-grid-2">
                    {START_DATES.map(d => (
                      <button key={d.value} id={`start-opt-${d.value}`} type="button"
                        onClick={() => setForm(f => ({ ...f, startDate: d.value }))}
                        className={`contact-option-card ${form.startDate === d.value ? 'selected' : ''}`}>
                        <span className="contact-option-emoji">{d.emoji}</span>
                        <span className="contact-option-label">{d.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Step 4: Datos de contacto ── */}
              {step === 4 && (
                <div className="contact-step-enter">
                  <h2 className="contact-question-title">¿Dónde te enviamos la cotización?</h2>
                  <p className="contact-question-sub">
                    Prepararemos una propuesta personalizada basada en tus respuestas.
                  </p>
                  <div className="contact-fields">
                    <div className="contact-field">
                      <label htmlFor="contact-name" className="contact-label">Nombre</label>
                      <input id="contact-name" type="text" placeholder="Tu nombre completo"
                        value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                        className="contact-input" autoComplete="name" />
                    </div>
                    <div className="contact-field">
                      <label htmlFor="contact-company" className="contact-label">Empresa</label>
                      <input id="contact-company" type="text" placeholder="Nombre de tu empresa"
                        value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))}
                        className="contact-input" autoComplete="organization" />
                    </div>
                    <div className="contact-field">
                      <label htmlFor="contact-phone" className="contact-label">WhatsApp</label>
                      <input id="contact-phone" type="tel" placeholder="+57 300 000 0000"
                        value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                        className="contact-input" autoComplete="tel" />
                    </div>
                    <div className="contact-field">
                      <label htmlFor="contact-email" className="contact-label">Correo electrónico</label>
                      <input id="contact-email" type="email" placeholder="tu@empresa.com"
                        value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                        className="contact-input" autoComplete="email" />
                    </div>
                  </div>
                </div>
              )}

              {/* ── Step 5: Cotizador (ÚLTIMO — submit aquí) ── */}
              {step === 5 && tier && (
                <div className="contact-step-enter">
                  <h2 className="contact-question-title">Tu estimado de inversión</h2>
                  <p className="contact-question-sub">
                    Basado en los datos que nos diste, este es el rango aproximado.
                  </p>

                  <div className="quote-card" style={{ '--tier-color': tierInfo!.color } as React.CSSProperties}>

                    <div className="quote-card-header">
                      <div>
                        <span className="quote-tier-badge">{tierInfo!.label}</span>
                        <p className="quote-tier-employees">{tierInfo!.employees}</p>
                      </div>
                      <div className="quote-bank-info">
                        <span>🏦</span>
                        <span>{BANK_ACCOUNTS[tier]}</span>
                      </div>
                    </div>

                    <div className="quote-price-main">
                      <p className="quote-price-label">Inversión mensual estimada</p>
                      <p className="quote-price-amount">{formatCOP(monthlyPrice)}</p>
                      <p className="quote-price-period">/ mes</p>
                    </div>

                    <div className="quote-breakdown">
                      <p className="quote-breakdown-title">
                        {isFullPackage ? 'Paquete completo incluye:' : 'Módulos seleccionados:'}
                      </p>
                      {(isFullPackage
                        ? (Object.keys(MODULE_PRICES) as BillingModule[])
                        : activeModules
                      ).map(mod => (
                        <div key={mod} className="quote-breakdown-row">
                          <span>{MODULE_LABELS[mod]}</span>
                          <span className="quote-breakdown-price">
                            {formatCOP(MODULE_PRICES[mod][tier])}
                          </span>
                        </div>
                      ))}
                      {(isFullPackage || activeModules.length > 1) && (
                        <div className="quote-breakdown-total">
                          <span>Total mensual</span>
                          <span>{formatCOP(monthlyPrice)}</span>
                        </div>
                      )}
                    </div>

                    {hasAnnualExtras(form.services) && (
                      <div className="quote-annual">
                        <p className="quote-annual-title">Servicios anuales adicionales</p>
                        {ANNUAL_EXTRAS.map(item => (
                          <div key={item.label} className="quote-breakdown-row">
                            <span>{item.label}</span>
                            <span className="quote-breakdown-price">
                              {formatCOP(item.prices[tier])}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <p className="quote-disclaimer">
                    ⚠️ Estas tarifas están sujetas a verificación del volumen de transacciones.
                    Un asesor te contactará para confirmar los detalles.
                  </p>

                  {error && <p className="contact-error">{error}</p>}
                </div>
              )}
            </div>

            {/* ── Footer ── */}
            <div className="contact-modal-footer">
              {step > 1 && (
                <button id="contact-modal-back-btn" type="button"
                  onClick={() => setStep(s => s - 1)}
                  className="contact-btn-ghost" disabled={loading}>
                  <ChevronLeft className="w-4 h-4" /> Atrás
                </button>
              )}
              <div className="contact-footer-spacer" />
              {step < TOTAL_STEPS ? (
                <button id="contact-modal-next-btn" type="button"
                  onClick={() => canNext() && setStep(s => s + 1)}
                  disabled={!canNext()}
                  className="contact-btn-primary">
                  Siguiente <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button id="contact-modal-submit-btn" type="button"
                  onClick={handleSubmit} disabled={loading}
                  className="contact-btn-primary">
                  {loading
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando…</>
                    : <>Solicitar mi cotización <ChevronRight className="w-4 h-4" /></>
                  }
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
