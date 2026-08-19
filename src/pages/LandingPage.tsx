import { Link } from 'react-router-dom'
import { ArrowRight, Menu, X, Search, Settings2, FileText, BarChart3, User } from 'lucide-react'
import { useState } from 'react'
import { FintoLogo } from '@/components/ui/FintoLogo'
import { FintoIcon, type FintoIconName } from '@/components/ui/FintoIcon'

import mockupHero from '@/assets/finto/images/mockup-hero.webp'
import mockupPortal from '@/assets/finto/images/mockup-portal.webp'
import imgContabilidad from '@/assets/finto/images/CONTABILIDAD E IMPUESTOS.webp'
import imgController from '@/assets/finto/images/CONTROLLER FINANCIERO Y TESORERIA.webp'
import imgFacturacion from '@/assets/finto/images/FACTURACION Y RECAUDO.webp'
import imgPersonal from '@/assets/finto/images/GESTION DE PERSONAL Y COMPRAS.webp'

const NAV_LINKS = [
  { label: 'Servicios', href: '#servicios' },
  { label: 'Cómo funciona', href: '#proceso' },
  { label: 'Plataforma', href: '#plataforma' },
  { label: 'Contacto', href: '#contacto' },
]

const SERVICES = [
  { img: imgContabilidad, title: 'Contabilidad e impuestos' },
  { img: imgController, title: 'Controller Financiero y Tesorería' },
  { img: imgFacturacion, title: 'Facturación y recaudo' },
  { img: imgPersonal, title: 'Gestión de Personal y compras' },
]

const PROCESS = [
  { icon: Search,     title: 'Diagnóstico',    desc: 'Analizamos el estado actual de su empresa y definimos el alcance.' },
  { icon: Settings2,  title: 'Configuración',  desc: 'Personalizamos su portal con acceso seguro para su equipo.' },
  { icon: FileText,   title: 'Operación',      desc: 'Gestionamos cada área con entregables definidos mes a mes.' },
  { icon: BarChart3,  title: 'Seguimiento',    desc: 'Consulta su información en tiempo real desde el dashboard.' },
]

const PORTAL_FEATURES: { icon: FintoIconName; title: string; desc: string }[] = [
  { icon: 'analytics',  title: 'Dashboard en tiempo real', desc: 'Indicadores clave actualizados al instante: flujo de caja, cartera, nómina y más.' },
  { icon: 'security-lock', title: 'Acceso seguro por roles', desc: 'Administre los permisos de su equipo. Cada usuario ve solo lo que le corresponde.' },
  { icon: 'download',   title: 'Descarga de documentos', desc: 'Facturas, comprobantes, informes y certificados disponibles en cualquier momento.' },
]

const PLATFORM: { icon: FintoIconName; title: string; desc: string }[] = [
  { icon: 'download',      title: 'Información actualizada al instante', desc: 'Los datos de su empresa se reflejan en el portal en tiempo real. Sin esperas, sin versiones desactualizadas.' },
  { icon: 'security-lock', title: 'Seguridad de nivel bancario', desc: 'Cifrado SSL, autenticación de dos factores y copias de seguridad automáticas diarias.' },
  { icon: 'devices',       title: 'Acceso desde cualquier dispositivo', desc: 'Portal responsivo optimizado para computador, tableta y móvil. Su información siempre disponible.' },
  { icon: 'bank-gear',     title: 'Integración con su ERP', desc: 'Conectamos con los principales sistemas contables y ERP del mercado colombiano sin fricciones.' },
  { icon: 'analytics',     title: 'Reportes personalizados', desc: 'Genere informes a la medida de su empresa: por período, área, proyecto o centro de costos.' },
  { icon: 'support',       title: 'Soporte dedicado', desc: 'Un equipo especializado asignado a su empresa, con tiempos de respuesta garantizados por SLA.' },
]

const STATS = [
  { value: '+10', label: 'Empresas\nactivas' },
  { value: '+14', label: 'Meses en\nel mercado' },
  { value: '99%', label: 'Satisfacción\nclientes' },
]

export function LandingPage() {
  const [mobileOpen, setMobileOpen] = useState(false)
  // Giro 3D del mockup según el lado donde esté el mouse (0 = de frente)
  const [heroTilt, setHeroTilt] = useState(0)
  const TILT = 18 // grados de giro a cada lado

  return (
    <div className="min-h-screen bg-cream-50 font-sans text-navy-900">

      {/* ── Navbar ─────────────────────────────────────────────── */}
      <header className="fixed top-0 inset-x-0 z-50 bg-cream-50/90 backdrop-blur border-b border-sand-300/40">
        <div className="max-w-6xl mx-auto px-5 md:px-6 h-16 flex items-center justify-between">
          <FintoLogo variant="navy" height={26} />

          <nav className="hidden md:flex items-center gap-7">
            {NAV_LINKS.map(l => (
              <a key={l.label} href={l.href} className="text-sm font-medium text-navy-900/70 hover:text-brand-600 transition-colors">
                {l.label}
              </a>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-2">
            <Link to="/register" className="text-sm font-medium text-navy-900/70 hover:text-brand-600 px-3 py-2 transition-colors">
              Registrarse
            </Link>
            <Link to="/login" className="inline-flex items-center gap-2 text-sm font-semibold bg-navy-900 text-cream-100 pl-3 pr-4 py-2 rounded-full hover:bg-navy-800 transition-colors">
              <User className="w-4 h-4" /> Acceder al Portal
            </Link>
          </div>

          <button className="md:hidden text-navy-900 p-1" onClick={() => setMobileOpen(o => !o)}>
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {mobileOpen && (
          <div className="md:hidden bg-cream-50 border-t border-sand-300/40 px-6 py-4 space-y-3">
            {NAV_LINKS.map(l => (
              <a key={l.label} href={l.href} onClick={() => setMobileOpen(false)} className="block text-sm font-medium text-navy-900/70">
                {l.label}
              </a>
            ))}
            <div className="pt-2 flex flex-col gap-2 border-t border-sand-300/40">
              <Link to="/register" onClick={() => setMobileOpen(false)} className="text-sm font-medium text-navy-900/70">Registrarse</Link>
              <Link to="/login" onClick={() => setMobileOpen(false)} className="text-sm font-semibold text-brand-600">Acceder al Portal →</Link>
            </div>
          </div>
        )}
      </header>

      {/* ── Hero ───────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-16 bg-gradient-to-br from-navy-950 via-navy-900 to-brand-600">
        <div className="absolute inset-0 opacity-[0.07] pointer-events-none"
          style={{ backgroundImage: 'linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)', backgroundSize: '52px 52px' }} />

        <div className="relative max-w-6xl mx-auto px-5 md:px-6 py-16 md:py-24 grid lg:grid-cols-2 gap-12 items-center">
          {/* Imagen — mockup del portal: de frente sin mouse, gira hacia el lado del cursor */}
          <div
            className="order-2 lg:order-1 flex justify-center [perspective:1400px]"
            onMouseMove={(e) => {
              const r = e.currentTarget.getBoundingClientRect()
              setHeroTilt(e.clientX - r.left < r.width / 2 ? -TILT : TILT)
            }}
            onMouseLeave={() => setHeroTilt(0)}
          >
            <img
              src={mockupHero}
              alt="Portal Finto en un portátil"
              style={{ transform: `rotateY(${heroTilt}deg)` }}
              className="w-full max-w-md drop-shadow-2xl will-change-transform transition-transform duration-500 ease-out"
            />
          </div>

          {/* Texto */}
          <div className="order-1 lg:order-2 text-center lg:text-left">
            <h1 className="font-display text-4xl md:text-5xl xl:text-6xl font-bold text-cream-100 leading-[1.08] mb-6">
              La estructura detrás<br />del crecimiento.
            </h1>
            <p className="text-cream-100/70 text-base md:text-lg leading-relaxed mb-8 max-w-lg mx-auto lg:mx-0">
              Centralizamos las operaciones del back office en un solo lugar, brindándole mayor
              control, eficiencia y visibilidad sobre su operación.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
              <Link to="/login"
                className="inline-flex items-center justify-center gap-2 font-display font-semibold text-cream-100 border border-cream-100/30 bg-white/5 px-6 py-3 rounded-full hover:bg-white/10 transition-colors">
                Acceder al Portal
              </Link>
              <Link to="/register"
                className="inline-flex items-center justify-center gap-2 font-display font-semibold bg-navy-950 text-cream-100 px-6 py-3 rounded-full ring-1 ring-white/10 hover:bg-navy-900 transition-colors">
                Solicitar una propuesta <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats ──────────────────────────────────────────────── */}
      <section className="bg-cream-100">
        <div className="max-w-6xl mx-auto px-5 md:px-6 py-12 md:py-16 flex flex-col md:flex-row items-center gap-10 md:gap-16">
          <p className="text-lg md:text-xl font-semibold text-navy-900 max-w-xs text-center md:text-left leading-snug">
            De principio a fin, organizamos los procesos que impulsan su empresa.
          </p>
          <div className="flex-1 grid grid-cols-3 gap-6">
            {STATS.map(s => (
              <div key={s.label} className="text-center md:text-left">
                <p className="font-display text-4xl md:text-5xl font-bold text-brand-500 leading-none">{s.value}</p>
                <p className="text-sm font-semibold text-navy-900 mt-2 whitespace-pre-line leading-tight">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Servicios ──────────────────────────────────────────── */}
      <section id="servicios" className="bg-cream-50 py-20 md:py-24">
        <div className="max-w-6xl mx-auto px-5 md:px-6">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <p className="text-xs font-bold text-brand-600 uppercase tracking-[0.2em] mb-3">Lo que ofrecemos</p>
            <h2 className="font-display text-3xl md:text-4xl font-bold text-brand-600 mb-4">Servicios Especializados</h2>
            <p className="text-navy-900/60 leading-relaxed">
              Cubrimos todas las áreas administrativas y financieras de su empresa con equipos expertos
              y tecnología de punta.
            </p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
            {SERVICES.map(s => (
              <div key={s.title} className="group relative rounded-2xl overflow-hidden aspect-[3/4] shadow-lg shadow-navy-900/10 ring-1 ring-navy-900/5">
                <img src={s.img} alt={s.title}
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-navy-950/90 via-navy-950/20 to-transparent" />
                <div className="absolute bottom-0 inset-x-0 p-4">
                  <div className="w-9 h-9 rounded-lg bg-gold-500/90 flex items-center justify-center mb-2">
                    <FintoIcon name="briefcase" variant="white" size={18} />
                  </div>
                  <p className="font-display font-bold text-cream-100 text-sm leading-tight">{s.title}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Proceso ────────────────────────────────────────────── */}
      <section id="proceso" className="relative py-20 md:py-24 bg-gradient-to-br from-navy-900 to-brand-700">
        <div className="max-w-6xl mx-auto px-5 md:px-6">
          <div className="mb-8">
            <p className="text-xs font-bold text-gold-400 uppercase tracking-[0.2em] mb-3">Proceso</p>
            <h2 className="font-display text-3xl md:text-4xl font-bold text-cream-100 mb-3">Así trabajamos con usted</h2>
            <p className="text-cream-100/60 leading-relaxed">Un proceso transparente y estructurado desde el primer día.</p>
          </div>

          {/* Móvil / tablet: lista de pasos */}
          <div className="lg:hidden grid sm:grid-cols-2 gap-5">
            {PROCESS.map((step, i) => {
              const Icon = step.icon
              return (
                <div key={step.title} className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-11 h-11 rounded-full border-2 border-gold-400/60 flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5 text-cream-100" />
                    </div>
                    <span className="font-display text-4xl font-bold text-white/15 leading-none">{i + 1}</span>
                  </div>
                  <h3 className="font-display font-bold text-cream-100 mb-1.5">{step.title}</h3>
                  <p className="text-sm text-cream-100/60 leading-relaxed">{step.desc}</p>
                </div>
              )
            })}
          </div>

          {/* Desktop: diagrama circular con efecto lupa al pasar el mouse */}
          <div className="hidden lg:block">
            <div className="relative mx-auto mt-8 w-full max-w-[500px] aspect-square">
              {/* Anillo punteado */}
              <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full text-cream-100/30">
                <circle cx="50" cy="50" r="47" fill="none" stroke="currentColor"
                  strokeWidth="0.4" strokeDasharray="0.1 3.4" strokeLinecap="round" />
              </svg>

              {PROCESS.map((step, i) => {
                const Icon = step.icon
                const pos = [
                  { left: '50%', top: '3%' },   // arriba
                  { left: '97%', top: '50%' },  // derecha
                  { left: '50%', top: '97%' },  // abajo
                  { left: '3%',  top: '50%' },  // izquierda
                ][i]!
                return (
                  <div key={step.title}
                    className="absolute z-10 hover:z-30 -translate-x-1/2 -translate-y-1/2"
                    style={{ left: pos.left, top: pos.top }}>
                    <div className="group relative flex flex-col items-center cursor-pointer">
                      {/* Nodo (efecto lupa: crece al hacer hover) */}
                      <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-gold-400/60
                                      bg-navy-900/70 backdrop-blur transition-all duration-300 origin-center
                                      group-hover:scale-[1.6] group-hover:border-gold-400
                                      group-hover:bg-gradient-to-br group-hover:from-brand-500 group-hover:to-navy-900
                                      group-hover:shadow-2xl group-hover:shadow-brand-500/50">
                        <Icon className="h-8 w-8 text-cream-100 transition-transform duration-300 group-hover:scale-[0.55]" />
                      </div>
                      {/* Texto revelado */}
                      <div className="pointer-events-none absolute top-[calc(100%+0.75rem)] w-52 text-center
                                      translate-y-1 opacity-0 transition-all duration-300
                                      group-hover:translate-y-0 group-hover:opacity-100">
                        <p className="font-display font-bold text-cream-100 text-sm">{i + 1}. {step.title}</p>
                        <p className="mt-1 text-xs text-cream-100/75 leading-snug">{step.desc}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ── Portal del cliente ─────────────────────────────────── */}
      <section className="bg-navy-900 py-20 md:py-24">
        <div className="max-w-6xl mx-auto px-5 md:px-6">
          <div className="rounded-3xl bg-cream-100 p-8 md:p-12 flex flex-col lg:flex-row gap-10 lg:gap-14 items-center">
            {/* Teléfono */}
            <div className="w-full lg:w-72 shrink-0 flex justify-center">
              <img src={mockupPortal} alt="Portal Finto en el móvil"
                className="w-full max-w-[250px] drop-shadow-2xl" />
            </div>

            {/* Texto */}
            <div className="flex-1">
              <p className="text-xs font-bold text-brand-600 uppercase tracking-[0.2em] mb-3">Portal del cliente</p>
              <h2 className="font-display text-3xl md:text-4xl font-bold text-navy-900 mb-4 leading-tight">
                Todo su negocio<br />en un solo lugar
              </h2>
              <p className="text-brand-600 font-medium mb-8 leading-relaxed max-w-md">
                Consulte indicadores, descargue documentos y haga seguimiento desde cualquier dispositivo.
              </p>
              <div className="grid sm:grid-cols-3 gap-4">
                {PORTAL_FEATURES.map(f => (
                  <div key={f.title} className="rounded-xl bg-sand-200/60 p-4">
                    <FintoIcon name={f.icon} variant="navy" size={34} className="mb-3" />
                    <p className="font-display font-bold text-brand-600 text-sm mb-1.5 leading-tight">{f.title}</p>
                    <p className="text-xs text-navy-900/60 leading-relaxed">{f.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Plataforma ─────────────────────────────────────────── */}
      <section id="plataforma" className="bg-cream-100 py-20 md:py-24">
        <div className="max-w-6xl mx-auto px-5 md:px-6">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <p className="text-xs font-bold text-brand-600 uppercase tracking-[0.2em] mb-3">Plataforma</p>
            <h2 className="font-display text-3xl md:text-4xl font-bold text-brand-600 mb-4">Tecnología al servicio<br />de su empresa</h2>
            <p className="text-navy-900/60 leading-relaxed">
              Tecnología diseñada para facilitar la gestión empresarial con información en tiempo real,
              seguridad, integración y soporte.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
            {PLATFORM.map(f => (
              <div key={f.title}
                className="group rounded-2xl p-6 text-center bg-sand-200/70 hover:bg-brand-500 transition-colors duration-300 cursor-default">
                <div className="relative w-12 h-12 mx-auto mb-3 flex items-center justify-center">
                  <FintoIcon name={f.icon} variant="navy" size={40} className="transition-opacity duration-300 group-hover:opacity-0" />
                  <FintoIcon name={f.icon} variant="white" size={40} className="absolute opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                </div>
                <h3 className="font-display font-bold mb-2 text-brand-600 group-hover:text-cream-100 transition-colors duration-300">{f.title}</h3>
                <p className="text-sm leading-relaxed text-navy-900/55 group-hover:text-cream-100/85 transition-colors duration-300">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────────── */}
      <section id="contacto" className="relative overflow-hidden py-20 md:py-28 bg-gradient-to-br from-navy-900 to-brand-700">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <p className="text-xs font-bold text-cream-100 uppercase tracking-[0.2em] mb-4">Comience hoy</p>
          <h2 className="font-display text-3xl md:text-5xl font-bold text-gold-500 mb-5 leading-tight">
            ¿Listo para hacer<br />crecer su empresa?
          </h2>
          <p className="text-cream-100/70 mb-10 text-base md:text-lg leading-relaxed">
            Contáctenos y en menos de 48 horas tendrá una propuesta personalizada para su negocio.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/register"
              className="inline-flex items-center justify-center gap-2 font-display font-semibold border border-cream-100/40 text-cream-100 px-8 py-3.5 rounded-full hover:bg-white/10 transition-colors">
              Solicitar una propuesta
            </Link>
            <a href="#contacto"
              className="inline-flex items-center justify-center gap-2 font-display font-semibold bg-cream-100 text-navy-900 px-8 py-3.5 rounded-full hover:bg-cream-50 transition-colors">
              Hablar con un asesor
            </a>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="bg-navy-950 text-cream-100/60 py-14">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between gap-10 mb-10">
            <div className="max-w-xs">
              <FintoLogo variant="white" height={26} className="mb-4" />
              <p className="text-sm leading-relaxed">
                Soluciones integrales de back office para empresas colombianas. Confianza, precisión
                y tecnología al servicio de su crecimiento.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-8 text-sm">
              <div>
                <p className="text-cream-100 font-semibold mb-3">Servicios</p>
                {['Contabilidad', 'Tesorería', 'Facturación', 'Cartera', 'Gestión de Personal'].map(l => (
                  <p key={l} className="mb-2 hover:text-cream-100 cursor-pointer transition-colors">{l}</p>
                ))}
              </div>
              <div>
                <p className="text-cream-100 font-semibold mb-3">Portal</p>
                {['Acceder', 'Solicitar acceso', 'Soporte técnico', 'Manual de usuario'].map(l => (
                  <p key={l} className="mb-2 hover:text-cream-100 cursor-pointer transition-colors">{l}</p>
                ))}
              </div>
              <div>
                <p className="text-cream-100 font-semibold mb-3">Empresa</p>
                {['Nosotros', 'Equipo', 'Contacto', 'Política de privacidad'].map(l => (
                  <p key={l} className="mb-2 hover:text-cream-100 cursor-pointer transition-colors">{l}</p>
                ))}
              </div>
            </div>
          </div>
          <div className="border-t border-white/10 pt-6 flex flex-col md:flex-row justify-between items-center gap-2 text-xs">
            <p>© {new Date().getFullYear()} Finto. Todos los derechos reservados.</p>
            <p>Bogotá, Colombia · finto@finto.la</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
