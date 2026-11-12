import { Link } from 'react-router-dom'
import { ArrowLeft, Cookie } from 'lucide-react'
import { FintoLogo } from '@/components/ui/FintoLogo'

type Item = { name: string; type: string; purpose: string; duration: string }

// Mantener sincronizado con lo que realmente guarda la aplicación:
// backend/src/lib/authCookies.ts y las claves persist de src/stores/*.
const COOKIES: Item[] = [
  {
    name: 'rs_at',
    type: 'Cookie propia · httpOnly · necesaria',
    purpose: 'Mantiene la sesión iniciada en el portal de clientes y autentica cada solicitud. No es accesible desde JavaScript.',
    duration: 'Hasta 1 hora',
  },
  {
    name: 'rs_rt',
    type: 'Cookie propia · httpOnly · necesaria',
    purpose: 'Renueva la sesión de forma segura sin pedir de nuevo la contraseña. Solo se envía al servicio de autenticación.',
    duration: 'Hasta 30 días, o hasta cerrar sesión',
  },
]

const LOCAL_STORAGE: Item[] = [
  {
    name: 'rs-auth',
    type: 'Almacenamiento local · necesario',
    purpose: 'Guarda datos básicos del perfil (nombre, correo, rol) para mostrar el portal. No contiene contraseñas ni tokens.',
    duration: 'Hasta cerrar sesión',
  },
  {
    name: 'finto-theme',
    type: 'Almacenamiento local · funcional',
    purpose: 'Recuerda si prefieres el tema claro u oscuro.',
    duration: 'Hasta que lo borres',
  },
  {
    name: 'finto-siigo-sync-v2',
    type: 'Almacenamiento local · funcional',
    purpose: 'Recuerda el estado de las sincronizaciones con Siigo en curso para seguir avisándote si recargas la página.',
    duration: 'Hasta que lo borres',
  },
  {
    name: 'finto-cookie-notice',
    type: 'Almacenamiento local · necesario',
    purpose: 'Recuerda que ya viste este aviso de cookies para no mostrarlo en cada visita.',
    duration: 'Hasta que lo borres',
  },
]

function ItemTable({ items }: { items: Item[] }) {
  return (
    <div className="space-y-3">
      {items.map((i) => (
        <div key={i.name} className="rounded-xl border border-sand-200 bg-cream-50/60 p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1.5">
            <code className="font-mono text-sm font-bold text-navy-900">{i.name}</code>
            <span className="text-xs text-navy-900/60">{i.type}</span>
          </div>
          <p className="text-sm text-navy-900/80 mb-1.5">{i.purpose}</p>
          <p className="text-xs text-navy-900/60"><strong>Duración:</strong> {i.duration}</p>
        </div>
      ))}
    </div>
  )
}

export function CookiePolicyPage() {
  return (
    <div className="min-h-screen bg-cream-50 font-sans text-navy-900 flex flex-col">
      <header className="sticky top-0 z-40 bg-cream-50/95 backdrop-blur border-b border-sand-300/40">
        <div className="max-w-5xl mx-auto px-5 md:px-6 h-16 flex items-center gap-4">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-navy-900/70 hover:text-navy-900 px-3 py-1.5 rounded-lg border border-sand-300/60 hover:bg-white/80 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Volver al inicio
          </Link>
          <Link to="/" aria-label="Ir al inicio" className="hidden sm:inline-block">
            <FintoLogo variant="navy" height={30} />
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto px-5 md:px-8 py-10 md:py-14 w-full">
        <div className="bg-white rounded-2xl border border-sand-300/60 shadow-sm p-6 md:p-10 mb-8">
          <div className="flex items-center gap-2 text-xs font-semibold text-brand-600 uppercase tracking-wider mb-2">
            <Cookie className="w-4 h-4" />
            <span>Documento Legal</span>
          </div>
          <h1 className="font-display text-2xl md:text-4xl font-bold text-navy-900 mb-3">
            Política de Cookies
          </h1>
          <p className="text-base md:text-lg font-medium text-navy-800/80 mb-4">
            RAD Services S.A.S. | Finto
          </p>
          <p className="text-sm text-navy-900/70 leading-relaxed">
            Aplicable al sitio web https://finto.la y al portal de clientes de Finto. Complementa la{' '}
            <Link to="/politica-tratamiento-datos" className="font-semibold text-brand-600 hover:text-brand-700 underline underline-offset-2">
              Política de Tratamiento de Datos Personales
            </Link>.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-sand-300/60 shadow-sm p-6 md:p-10 space-y-8 text-sm md:text-base leading-relaxed text-navy-900/80">
          <section>
            <h2 className="font-display text-lg md:text-xl font-bold text-navy-900 mb-3">1. ¿Qué son las cookies?</h2>
            <p className="mb-3">
              Las cookies son pequeños archivos que un sitio web guarda en tu navegador. El almacenamiento local
              (<em>localStorage</em>) es una tecnología similar que permite guardar información en tu dispositivo.
              En esta política llamamos “cookies” a ambas tecnologías.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg md:text-xl font-bold text-navy-900 mb-3">2. ¿Qué cookies usamos?</h2>
            <p className="mb-3">
              Finto solo usa cookies <strong>propias</strong>, <strong>estrictamente necesarias</strong> para prestar el
              servicio que solicitas y <strong>funcionales</strong> para recordar tus preferencias.
              <strong> No usamos cookies de publicidad, de perfilamiento ni de analítica de terceros</strong>, y no
              vendemos ni compartimos esta información con anunciantes.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg md:text-xl font-bold text-navy-900 mb-3">3. Cookies de sesión</h2>
            <p className="mb-4">
              Se crean únicamente cuando inicias sesión en el portal de clientes y se eliminan al cerrar sesión.
              Están protegidas con los atributos <code>HttpOnly</code> y <code>Secure</code>, lo que impide que
              sean leídas por scripts y que viajen por conexiones no cifradas.
            </p>
            <ItemTable items={COOKIES} />
          </section>

          <section>
            <h2 className="font-display text-lg md:text-xl font-bold text-navy-900 mb-3">4. Almacenamiento local</h2>
            <ItemTable items={LOCAL_STORAGE} />
          </section>

          <section>
            <h2 className="font-display text-lg md:text-xl font-bold text-navy-900 mb-3">5. Servicios de terceros</h2>
            <p>
              El sitio carga tipografías desde Google Fonts. Para entregarlas, Google recibe datos técnicos como tu
              dirección IP, pero este servicio no instala cookies en tu navegador.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg md:text-xl font-bold text-navy-900 mb-3">6. ¿Cómo gestionar o eliminar las cookies?</h2>
            <p className="mb-3">
              Al tratarse de cookies necesarias para el funcionamiento del portal, no requieren tu autorización
              previa. Aun así, puedes bloquearlas o eliminarlas en cualquier momento desde la configuración de tu
              navegador (Chrome, Safari, Firefox, Edge u otro). Ten en cuenta que, si bloqueas las cookies de sesión,
              no podrás iniciar sesión en el portal de clientes.
            </p>
            <p>
              Si en el futuro incorporamos cookies que no sean estrictamente necesarias, como las de analítica,
              te pediremos tu autorización antes de activarlas y actualizaremos esta política.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg md:text-xl font-bold text-navy-900 mb-3">7. Contacto</h2>
            <p>
              Si tienes preguntas sobre esta política o sobre el tratamiento de tus datos, escríbenos a{' '}
              <a href="mailto:finto@finto.la" className="font-semibold text-brand-600 hover:text-brand-700">finto@finto.la</a>.
            </p>
          </section>

          <section className="pt-6 border-t border-sand-200 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <span className="text-navy-900/60 block">Entrada en vigencia:</span>
                <span className="font-bold text-navy-900">12 de noviembre de 2026</span>
              </div>
              <div>
                <span className="text-navy-900/60 block">Última actualización:</span>
                <span className="font-bold text-navy-900">12 de noviembre de 2026</span>
              </div>
            </div>
          </section>
        </div>
      </main>

      <footer className="bg-navy-950 text-cream-100/60 py-8 border-t border-white/10 mt-auto">
        <div className="max-w-4xl mx-auto px-5 md:px-8 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs">
          <p>© {new Date().getFullYear()} Finto · RAD Services S.A.S. Todos los derechos reservados.</p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link to="/politica-tratamiento-datos" className="hover:text-cream-100 transition-colors">Política de Tratamiento de Datos</Link>
            <Link to="/terminos-y-condiciones" className="hover:text-cream-100 transition-colors">Términos y Condiciones</Link>
            <a href="mailto:finto@finto.la" className="hover:text-cream-100 transition-colors">finto@finto.la</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
