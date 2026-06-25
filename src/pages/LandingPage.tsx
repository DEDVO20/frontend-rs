import { Link } from 'react-router-dom'
import { ArrowRight, ChevronRight, Menu, X, Phone } from 'lucide-react'
import { useState } from 'react'

const NAV_LINKS = [
  { label: 'Servicios', href: '#servicios' },
  { label: 'Cómo funciona', href: '#proceso' },
  { label: 'Plataforma', href: '#plataforma' },
  { label: 'Contacto', href: '#contacto' },
]

const SERVICES = [
  {
    num: '01',
    emoji: '📊',
    title: 'Contabilidad e impuestos',
    desc: 'Gestión contable integral bajo NIIF y normativa colombiana vigente. Información financiera precisa y oportuna para la toma de decisiones.',
    items: [
      'Registro y causación de movimientos',
      'Estados financieros mensuales',
      'Conciliaciones bancarias',
      'Declaraciones tributarias (IVA, Renta, ICA)',
      'Libros oficiales y auxiliares',
    ],
  },
  {
    num: '02',
    emoji: '🏦',
    title: 'Controller financiero y Tesorería',
    desc: 'Control del flujo de caja, pagos y recaudos con visibilidad en tiempo real. Optimizamos la liquidez de su empresa.',
    items: [
      'Planeación financiera',
      'Flujo de caja proyectado',
      'Gestión bancaria',
      'Reportes financieros',
      'Reportes y Dashboard en línea',
    ],
  },
  {
    num: '03',
    emoji: '🧾',
    title: 'Facturación y recaudo',
    desc: 'Emisión y gestión de factura electrónica conforme a los requisitos de la DIAN. Procesos ágiles y sin errores.',
    items: [
      'Facturación masiva y programada',
      'Notas crédito y débito',
      'Gestión de cobro preventivo y activo',
      'Ageing de cartera (antigüedad)',
      'Reportes y Dashboard en línea',
    ],
  },
  {
    num: '05',
    emoji: '👥',
    title: 'Gestión de Personal y compras',
    desc: 'Nómina, seguridad social y bienestar laboral. Cumplimos con toda la normativa laboral colombiana de manera eficiente.',
    items: [
      'Vinculaciones y desvinculaciones',
      'Evaluaciones de desempeño',
      'Contratos, novedades y certificados',
      'Compras de oficina y suministros',
      'Reportes y dashboard en línea',
    ],
  },
]

const PROCESS_STEPS = [
  {
    num: '01',
    title: 'Diagnóstico inicial',
    desc: 'Analizamos el estado actual de su empresa, sus necesidades específicas y definimos el alcance del servicio.',
  },
  {
    num: '02',
    title: 'Configuración del portal',
    desc: 'Creamos su portal personalizado con acceso seguro para todos los usuarios autorizados de su organización.',
  },
  {
    num: '03',
    title: 'Operación continua',
    desc: 'Nuestros equipos especializados gestionan cada área con reportes y entregables definidos mes a mes.',
  },
  {
    num: '04',
    title: 'Reporte y seguimiento',
    desc: 'Usted consulta su información en tiempo real desde el dashboard y recibe informes ejecutivos periódicos.',
  },
]

const PLATFORM_FEATURES = [
  { emoji: '⚡', title: 'Información actualizada al instante', desc: 'Los datos de su empresa se reflejan en el portal en tiempo real. Sin esperas, sin versiones desactualizadas.' },
  { emoji: '🛡️', title: 'Seguridad de nivel bancario', desc: 'Cifrado SSL, autenticación de dos factores y copias de seguridad automáticas diarias.' },
  { emoji: '📱', title: 'Acceso desde cualquier dispositivo', desc: 'Portal responsivo optimizado para computador, tableta y móvil. Su información siempre disponible.' },
  { emoji: '🔗', title: 'Integración con su ERP', desc: 'Conectamos con los principales sistemas contables y ERP del mercado colombiano sin fricciones.' },
  { emoji: '📋', title: 'Reportes personalizados', desc: 'Genere informes a la medida de su empresa: por período, área, proyecto o centro de costos.' },
  { emoji: '🎯', title: 'Soporte dedicado', desc: 'Un equipo especializado asignado a su empresa, con tiempos de respuesta garantizados por SLA.' },
]

export function LandingPage() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="min-h-screen bg-white font-sans">

      {/* ── Navbar ─────────────────────────────────────────────────────────── */}
      <header className="fixed top-0 inset-x-0 z-50 bg-white/90 backdrop-blur border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center shrink-0">
              <span className="text-white font-bold text-sm">F</span>
            </div>
            <div>
              <p className="font-semibold text-slate-900 text-sm leading-tight">Finto</p>
              <p className="text-xs text-slate-400 leading-tight">Gestión Empresarial</p>
            </div>
          </div>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-6">
            {NAV_LINKS.map(l => (
              <a key={l.label} href={l.href}
                className="text-sm text-slate-600 hover:text-primary-600 transition-colors">
                {l.label}
              </a>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <Link to="/register"
              className="text-sm text-slate-600 hover:text-primary-600 transition-colors font-medium">
              Registrarse
            </Link>
            <Link to="/login"
              className="text-sm bg-primary-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-primary-700 transition-colors">
              Acceder al Portal
            </Link>
          </div>

          {/* Mobile toggle */}
          <button className="md:hidden text-slate-600 p-1" onClick={() => setMobileOpen(o => !o)}>
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden bg-white border-t border-slate-100 px-6 py-4 space-y-3">
            {NAV_LINKS.map(l => (
              <a key={l.label} href={l.href} onClick={() => setMobileOpen(false)}
                className="block text-sm text-slate-600 hover:text-primary-600">
                {l.label}
              </a>
            ))}
            <div className="pt-2 flex flex-col gap-2 border-t border-slate-100">
              <Link to="/register" onClick={() => setMobileOpen(false)}
                className="block text-sm font-medium text-slate-600">
                Registrarse
              </Link>
              <Link to="/login" onClick={() => setMobileOpen(false)}
                className="block text-sm font-semibold text-primary-600">
                Acceder al Portal →
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <section className="pt-32 pb-20 bg-gradient-to-br from-slate-900 via-slate-800 to-primary-950 relative overflow-hidden">
        {/* Grid decorativo */}
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'linear-gradient(#14b8a6 1px,transparent 1px),linear-gradient(90deg,#14b8a6 1px,transparent 1px)', backgroundSize: '48px 48px' }} />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-primary-500/20 rounded-full blur-3xl" />

        <div className="max-w-6xl mx-auto px-6 relative">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-400 bg-primary-400/10 border border-primary-400/20 rounded-full px-3 py-1 mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-primary-400 animate-pulse" />
              Gestión empresarial profesional
            </span>

            <h1 className="text-5xl md:text-6xl font-bold text-white leading-tight tracking-tight mb-4">
              Su negocio, organizado{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-teal-300">
                con precisión.
              </span>
            </h1>

            <p className="text-lg text-slate-400 leading-relaxed mb-10">
              Soluciones integrales de back office para empresas que exigen excelencia. Contabilidad,
              finanzas, tesorería, facturación, cartera y gestión de personal, todo en una sola plataforma.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center flex-wrap">
              <Link to="/login"
                className="inline-flex items-center justify-center gap-2 border border-white/20 text-white px-6 py-3 rounded-xl font-semibold hover:bg-white/10 transition-colors backdrop-blur">
                Acceder al Portal
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link to="/register"
                className="inline-flex items-center justify-center gap-2 bg-primary-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-primary-700 transition-colors shadow-lg shadow-primary-600/30">
                Empieza ahora
                <ArrowRight className="w-4 h-4" />
              </Link>
              <a href="#servicios"
                className="inline-flex items-center justify-center gap-2 text-slate-300 px-6 py-3 rounded-xl font-semibold hover:text-white transition-colors">
                Ver Servicios
                <ChevronRight className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Stats row */}
          <div className="flex flex-wrap justify-center gap-6 mb-12">
            {[
              { value: '+5', label: 'Empresas activas' },
              { value: '14+', label: 'Meses en el mercado' },
              { value: '99%', label: 'Satisfacción clientes' },
            ].map(s => (
              <div key={s.label} className="text-center px-6">
                <p className="text-3xl font-bold text-primary-400">{s.value}</p>
                <p className="text-xs text-slate-400 mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Dashboard mockup */}
          <div className="relative max-w-4xl mx-auto">
            <div className="bg-slate-800/80 backdrop-blur border border-slate-700/60 rounded-2xl shadow-2xl shadow-black/40 overflow-hidden">
              {/* Window chrome */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-700/60 bg-slate-900/60">
                <div className="w-3 h-3 rounded-full bg-red-500/70" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
                <div className="w-3 h-3 rounded-full bg-green-500/70" />
                <div className="flex-1 mx-4 bg-slate-700/60 rounded-md h-6 flex items-center px-3">
                  <span className="text-xs text-slate-400">DASHBOARD CLIENTE</span>
                </div>
                <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> En vivo
                </span>
              </div>

              <div className="flex flex-col md:flex-row">
                {/* KPIs grid */}
                <div className="flex-1 p-5 grid grid-cols-3 gap-3">
                  {[
                    { label: 'Facturación', val: '$84.2M', change: '↑ 12.4%' },
                    { label: 'Cartera', val: '$21.7M', change: '↑ 8.1%' },
                    { label: 'Tesorería', val: '97.3%', change: '↑ 3.2%' },
                  ].map(k => (
                    <div key={k.label} className="bg-slate-700/40 rounded-xl p-3">
                      <p className="text-[10px] text-slate-400 mb-1">{k.label}</p>
                      <p className="text-sm font-bold text-white">{k.val}</p>
                      <p className="text-[10px] text-emerald-400 mt-0.5">{k.change}</p>
                    </div>
                  ))}
                  <div className="bg-slate-700/40 rounded-xl p-3">
                    <p className="text-[10px] text-slate-400 mb-1">Personal</p>
                    <p className="text-sm font-bold text-white">48</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Activos</p>
                  </div>
                  <div className="bg-slate-700/40 rounded-xl p-3">
                    <p className="text-[10px] text-slate-400 mb-1">Facturas del mes</p>
                    <p className="text-sm font-bold text-white">142</p>
                    <p className="text-[10px] text-emerald-400 mt-0.5">Al día</p>
                  </div>
                  <div className="bg-slate-700/40 rounded-xl p-3">
                    <p className="text-[10px] text-slate-400 mb-1">Nómina procesada</p>
                    <p className="text-sm font-bold text-white">Jun 2025</p>
                    <p className="text-[10px] text-emerald-400 mt-0.5">✓</p>
                  </div>
                </div>

                {/* Right panel */}
                <div className="w-full md:w-44 bg-slate-900/60 border-t md:border-t-0 md:border-l border-slate-700/40 p-4 flex flex-col gap-3 shrink-0">
                  <div className="bg-primary-600/20 border border-primary-500/30 rounded-xl p-3">
                    <p className="text-[10px] text-slate-400">Saldo disponible</p>
                    <p className="text-base font-bold text-white mt-1">$12.4M</p>
                    <p className="text-[10px] text-emerald-400 mt-1">↑ COP +2.1% este mes</p>
                  </div>
                  <div className="bg-slate-700/30 rounded-xl p-3">
                    <p className="text-[10px] text-slate-400">Próximo cierre</p>
                    <p className="text-sm font-bold text-white mt-1">30 Jun</p>
                    <p className="text-[10px] text-amber-400 mt-1">● 4 días restantes</p>
                  </div>
                  <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                    <p className="text-[10px] text-slate-400">Obligaciones fiscales</p>
                    <p className="text-sm font-bold text-white mt-1">2 pend.</p>
                    <p className="text-[10px] text-red-400 mt-1">Revisar</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Servicios ──────────────────────────────────────────────────────── */}
      <section id="servicios" className="py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <p className="text-sm font-semibold text-primary-600 uppercase tracking-wider mb-3">Lo que ofrecemos</p>
            <h2 className="text-4xl font-bold text-slate-900 mb-4">Servicios especializados</h2>
            <p className="text-slate-500 leading-relaxed">
              Cubrimos todas las áreas administrativas y financieras de su empresa con equipos expertos
              y tecnología de punta.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {SERVICES.map(s => (
              <div key={s.num}
                className="group p-7 rounded-2xl border border-slate-200 hover:border-primary-300 hover:shadow-lg hover:shadow-primary-50 transition-all bg-white">
                <div className="flex items-start gap-4 mb-4">
                  <span className="text-3xl">{s.emoji}</span>
                  <div>
                    <p className="text-xs font-bold text-primary-600 mb-0.5">{s.num}</p>
                    <h3 className="font-semibold text-slate-900 text-lg">{s.title}</h3>
                  </div>
                </div>
                <p className="text-sm text-slate-500 leading-relaxed mb-4">{s.desc}</p>
                <ul className="space-y-1.5">
                  {s.items.map(item => (
                    <li key={item} className="flex items-center gap-2 text-sm text-slate-600">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary-400 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Proceso ────────────────────────────────────────────────────────── */}
      <section id="proceso" className="py-24 bg-slate-50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <p className="text-sm font-semibold text-primary-600 uppercase tracking-wider mb-3">Proceso</p>
            <h2 className="text-4xl font-bold text-slate-900 mb-4">Así trabajamos con usted</h2>
            <p className="text-slate-500 leading-relaxed">
              Un proceso transparente y estructurado desde el primer día.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {PROCESS_STEPS.map(({ num, title, desc }) => (
              <div key={num} className="bg-white rounded-2xl border border-slate-200 p-6">
                <div className="text-5xl font-black text-primary-100 mb-3 leading-none">{num}</div>
                <h3 className="font-semibold text-slate-900 mb-2">{title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Portal cliente ─────────────────────────────────────────────────── */}
      <section className="py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="bg-gradient-to-br from-slate-900 to-primary-950 rounded-3xl p-8 md:p-14 flex flex-col lg:flex-row gap-12 items-center">

            {/* Login mockup */}
            <div className="w-full lg:w-72 shrink-0">
              <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
                <div className="bg-slate-900 px-5 py-4 flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-primary-600 flex items-center justify-center shrink-0">
                    <span className="text-white font-bold text-xs">F</span>
                  </div>
                  <div>
                    <p className="font-semibold text-white text-xs leading-tight">Finto</p>
                    <p className="text-[10px] text-slate-400 leading-tight">Gestión Empresarial</p>
                  </div>
                </div>
                <div className="px-5 py-5">
                  <p className="text-sm font-semibold text-slate-900 mb-1">Bienvenido de vuelta</p>
                  <p className="text-xs text-slate-400 mb-4">Ingrese a su portal empresarial</p>
                  <div className="space-y-3 mb-4">
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Correo electrónico</p>
                      <div className="h-8 bg-slate-100 rounded-lg px-3 flex items-center">
                        <span className="text-xs text-slate-400">empresa@correo.com</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Contraseña</p>
                      <div className="h-8 bg-slate-100 rounded-lg px-3 flex items-center">
                        <span className="text-xs text-slate-400">••••••••</span>
                      </div>
                    </div>
                  </div>
                  <Link to="/login"
                    className="block w-full text-center text-xs font-semibold bg-primary-600 text-white py-2 rounded-lg hover:bg-primary-700 transition-colors">
                    Ingresar al Portal →
                  </Link>
                  <p className="text-center text-[10px] text-slate-400 mt-3">
                    ¿No tiene cuenta?{' '}
                    <Link to="/register" className="text-primary-600 font-medium">Solicite acceso</Link>
                  </p>
                </div>

                {/* Mini nav */}
                <div className="border-t border-slate-100 px-5 pb-4">
                  {['Dashboard general', 'Mis facturas', 'Estado de nómina', 'Cartera y cobros'].map((item, i) => (
                    <div key={item}
                      className={`flex items-center gap-2 py-2 text-xs ${i === 0 ? 'text-primary-600 font-medium' : 'text-slate-400'}`}>
                      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${i === 0 ? 'bg-primary-500' : 'bg-slate-200'}`} />
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Text */}
            <div className="flex-1 text-center lg:text-left">
              <p className="text-sm font-semibold text-primary-400 uppercase tracking-wider mb-4">Portal del cliente</p>
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-6 leading-tight">
                Todo su negocio<br />en un solo lugar
              </h2>
              <p className="text-slate-400 mb-8 leading-relaxed">
                Acceda a su información financiera y administrativa desde cualquier dispositivo,
                en tiempo real y con total seguridad.
              </p>

              <div className="grid sm:grid-cols-3 gap-4">
                {[
                  { emoji: '📈', title: 'Dashboard en tiempo real', desc: 'Indicadores clave actualizados al instante: flujo de caja, cartera, nómina y más.' },
                  { emoji: '🔒', title: 'Acceso seguro por roles', desc: 'Administre los permisos de su equipo. Cada usuario ve solo lo que le corresponde.' },
                  { emoji: '📥', title: 'Descarga de documentos', desc: 'Facturas, comprobantes, informes y certificados disponibles en cualquier momento.' },
                ].map(f => (
                  <div key={f.title} className="bg-white/10 backdrop-blur border border-white/10 rounded-xl p-4 text-left">
                    <span className="text-2xl">{f.emoji}</span>
                    <p className="text-sm font-semibold text-white mt-2 mb-1">{f.title}</p>
                    <p className="text-xs text-slate-400 leading-relaxed">{f.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Plataforma ─────────────────────────────────────────────────────── */}
      <section id="plataforma" className="py-24 bg-slate-50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <p className="text-sm font-semibold text-primary-600 uppercase tracking-wider mb-3">Plataforma</p>
            <h2 className="text-4xl font-bold text-slate-900 mb-4">Tecnología al<br />servicio de su empresa</h2>
            <p className="text-slate-500 leading-relaxed">
              Nuestra plataforma está diseñada para empresas que no pueden permitirse errores
              ni retrasos en su información.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {PLATFORM_FEATURES.map(f => (
              <div key={f.title}
                className="bg-white p-6 rounded-2xl border border-slate-200 hover:border-primary-200 hover:shadow-md transition-all">
                <span className="text-3xl">{f.emoji}</span>
                <h3 className="font-semibold text-slate-900 mt-3 mb-2">{f.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────────────────────── */}
      <section id="contacto" className="py-24 bg-primary-600">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <p className="text-sm font-semibold text-primary-200 uppercase tracking-wider mb-4">Comience hoy</p>
          <h2 className="text-4xl font-bold text-white mb-4">
            ¿Listo para ordenar<br />el back office de su empresa?
          </h2>
          <p className="text-primary-100 mb-10 text-lg leading-relaxed">
            Contáctenos y en menos de 48 horas tendrá una propuesta<br className="hidden sm:block" />
            personalizada para su negocio.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/register"
              className="inline-flex items-center justify-center gap-2 bg-white text-primary-700 px-8 py-3.5 rounded-xl font-semibold hover:bg-primary-50 transition-colors shadow-lg">
              Registrar mi empresa →
            </Link>
            <a href="tel:+57"
              className="inline-flex items-center justify-center gap-2 border border-white/30 text-white px-8 py-3.5 rounded-xl font-semibold hover:bg-white/10 transition-colors">
              <Phone className="w-4 h-4" /> Llamar ahora
            </a>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="bg-slate-900 text-slate-400 py-14">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between gap-10 mb-10">
            {/* Brand */}
            <div className="max-w-xs">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-7 h-7 rounded-lg bg-primary-600 flex items-center justify-center shrink-0">
                  <span className="text-white font-bold text-xs">F</span>
                </div>
                <div>
                  <p className="font-semibold text-white text-sm leading-tight">Finto</p>
                  <p className="text-[10px] text-slate-400 leading-tight">Gestión Empresarial</p>
                </div>
              </div>
              <p className="text-sm leading-relaxed">
                Soluciones integrales de back office para empresas colombianas.
                Confianza, precisión y tecnología al servicio de su crecimiento.
              </p>
            </div>

            {/* Links */}
            <div className="grid grid-cols-3 gap-8 text-sm">
              <div>
                <p className="text-white font-medium mb-3">Servicios</p>
                {['Contabilidad', 'Tesorería', 'Facturación', 'Cartera', 'Gestión de Personal'].map(l => (
                  <p key={l} className="mb-2 hover:text-white cursor-pointer transition-colors">{l}</p>
                ))}
              </div>
              <div>
                <p className="text-white font-medium mb-3">Portal</p>
                {['Acceder', 'Solicitar acceso', 'Soporte técnico', 'Manual de usuario'].map(l => (
                  <p key={l} className="mb-2 hover:text-white cursor-pointer transition-colors">{l}</p>
                ))}
              </div>
              <div>
                <p className="text-white font-medium mb-3">Empresa</p>
                {['Nosotros', 'Equipo', 'Contacto', 'Política de privacidad'].map(l => (
                  <p key={l} className="mb-2 hover:text-white cursor-pointer transition-colors">{l}</p>
                ))}
              </div>
            </div>
          </div>

          <div className="border-t border-slate-800 pt-6 flex flex-col md:flex-row justify-between items-center gap-2 text-xs">
            <p>© 2025 Finto. Todos los derechos reservados.</p>
            <p>Bogotá, Colombia · info@rsbackoffice.com</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
