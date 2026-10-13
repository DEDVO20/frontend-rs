import { Link } from 'react-router-dom'
import { ArrowLeft, Download, ScrollText } from 'lucide-react'
import { FintoLogo } from '@/components/ui/FintoLogo'
import terms from '@/content/terms.json'

interface Clause {
  number: string
  title: string
  paragraphs: string[]
  list?: { label: string; text: string }[]
  after?: string[]
}

const clauses: Clause[] = terms.clauses
const effectiveDate: string | null = terms.effectiveDate

export function TermsPage() {
  return (
    <div className="min-h-screen bg-cream-50 font-sans text-navy-900 flex flex-col">
      {/* ── Top Header ────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-cream-50/95 backdrop-blur border-b border-sand-300/40">
        <div className="max-w-5xl mx-auto px-5 md:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
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

          <a
            href="/docs/terminos-y-condiciones-servicios-finto.pdf"
            download="Terminos-y-Condiciones-Finto.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-full shadow-sm transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Descargar PDF</span>
          </a>
        </div>
      </header>

      {/* ── Main Content Container ─────────────────────────────────── */}
      <main className="flex-1 max-w-4xl mx-auto px-5 md:px-8 py-10 md:py-14 w-full">
        {/* Document Header Card */}
        <div className="bg-white rounded-2xl border border-sand-300/60 shadow-sm p-6 md:p-10 mb-8">
          <div className="flex items-center gap-2 text-xs font-semibold text-brand-600 uppercase tracking-wider mb-2">
            <ScrollText className="w-4 h-4" />
            <span>Documento Legal Oficial</span>
          </div>

          <h1 className="font-display text-2xl md:text-4xl font-bold text-navy-900 mb-3">
            Términos y Condiciones
          </h1>
          <p className="text-base md:text-lg font-medium text-navy-800/80 mb-6">
            Servicios empresariales de back office
          </p>

          <div className="bg-brand-50 border border-brand-200 rounded-xl p-4 text-sm text-navy-900/80 leading-relaxed mb-4">
            <strong className="text-navy-900">Importante · </strong>
            {terms.important}
          </div>
          <p className="text-sm text-navy-900/70 mb-6 leading-relaxed">
            <strong className="text-navy-900">Arquitectura contractual:</strong> {terms.architecture}
          </p>

          {/* Quick info table */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 border-t border-sand-200 text-xs">
            <div className="bg-cream-50/70 rounded-lg p-3 border border-sand-200/50 sm:col-span-2">
              <span className="font-bold text-navy-900 block mb-0.5">Proveedor:</span>
              <span className="text-navy-900/80">RAD Services S.A.S., identificada con NIT 901.954.048-5, que opera bajo la marca Finto</span>
            </div>
            <div className="bg-cream-50/70 rounded-lg p-3 border border-sand-200/50">
              <span className="font-bold text-navy-900 block mb-0.5">Domicilio:</span>
              <span className="text-navy-900/80">Bogotá D.C., Colombia</span>
            </div>
            <div className="bg-cream-50/70 rounded-lg p-3 border border-sand-200/50">
              <span className="font-bold text-navy-900 block mb-0.5">Versión:</span>
              <span className="text-navy-900/80">
                {terms.version}
                {effectiveDate && ` · Fecha de entrada en vigor: ${effectiveDate}`}
              </span>
            </div>
          </div>
        </div>

        {/* Legal Text Body */}
        <div className="bg-white rounded-2xl border border-sand-300/60 shadow-sm p-6 md:p-10 space-y-8 text-sm md:text-base leading-relaxed text-navy-900/80">
          <p>{terms.intro}</p>

          {clauses.map(clause => (
            <section key={clause.number}>
              <h2 className="font-display text-lg md:text-xl font-bold text-navy-900 mb-3">
                {clause.number}. {clause.title}
              </h2>
              <div className="space-y-3">
                {clause.paragraphs.map((text, i) => <p key={i}>{text}</p>)}
                {clause.list && (
                  <ul className="space-y-2">
                    {clause.list.map(item => (
                      <li key={item.label}><strong>{item.label}</strong> {item.text}</li>
                    ))}
                  </ul>
                )}
                {clause.after?.map((text, i) => <p key={i}>{text}</p>)}
              </div>
            </section>
          ))}
        </div>

        {/* Annex catalog */}
        <div className="bg-white rounded-2xl border border-sand-300/60 shadow-sm p-6 md:p-10 mt-8 text-sm md:text-base leading-relaxed text-navy-900/80">
          <h2 className="font-display text-lg md:text-xl font-bold text-navy-900 mb-3">
            Catálogo de Anexos de Servicio
          </h2>
          <p className="mb-5">{terms.annexes.intro}</p>

          <div className="overflow-x-auto rounded-xl border border-sand-200 mb-5">
            <table className="w-full text-sm text-left">
              <thead className="bg-cream-50 text-navy-900">
                <tr>
                  <th className="px-4 py-2.5 font-bold">Código</th>
                  <th className="px-4 py-2.5 font-bold">Servicio</th>
                  <th className="px-4 py-2.5 font-bold">Contenido principal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sand-200">
                {terms.annexes.services.map(service => (
                  <tr key={service.code} className="align-top">
                    <td className="px-4 py-2.5 font-semibold text-navy-900 whitespace-nowrap">{service.code}</td>
                    <td className="px-4 py-2.5 font-medium text-navy-900">{service.name}</td>
                    <td className="px-4 py-2.5">{service.content}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pl-4 border-l-2 border-brand-300 mb-6">
            <h3 className="font-bold text-navy-900 mb-1">Anexo transversal</h3>
            <p>
              <strong>{terms.annexes.transversal.title}.</strong> {terms.annexes.transversal.text}
            </p>
          </div>

          <h3 className="font-bold text-navy-900 mb-2">Contenido mínimo de cada Anexo de Servicio</h3>
          <ul className="space-y-1.5 list-disc list-inside">
            {terms.annexes.minimumContent.map(item => <li key={item}>{item}</li>)}
          </ul>
        </div>
      </main>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer className="bg-navy-950 text-cream-100/60 py-8 border-t border-white/10 mt-auto">
        <div className="max-w-4xl mx-auto px-5 md:px-8 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs">
          <p>© {new Date().getFullYear()} Finto · RAD Services S.A.S. Todos los derechos reservados.</p>
          <div className="flex items-center gap-4">
            <Link to="/politica-tratamiento-datos" className="hover:text-cream-100 transition-colors">Política de Tratamiento de Datos</Link>
            <a href="mailto:finto@finto.la" className="hover:text-cream-100 transition-colors">finto@finto.la</a>
            <a href="https://wa.me/573102170905" target="_blank" rel="noopener noreferrer" className="hover:text-cream-100 transition-colors">WhatsApp Soporte</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
