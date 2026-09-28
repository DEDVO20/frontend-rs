import { useState, useEffect } from 'react'
import { X, Clock, Calendar, Share2, Check, ArrowRight, BookOpen } from 'lucide-react'
import { toast } from 'sonner'
import { Link } from 'react-router-dom'

export interface BlogPostData {
  id: string
  title: string
  slug: string
  excerpt?: string
  content: string
  cover_image?: string
  category: string
  tags?: string[]
  author_name: string
  author_role?: string
  reading_time_minutes: number
  published: boolean
  featured?: boolean
  published_at?: string | null
  created_at: string
}

interface Props {
  post: BlogPostData | null
  onClose: () => void
}

export function BlogReaderModal({ post, onClose }: Props) {
  const [copied, setCopied] = useState(false)

  // Manejar tecla Escape para cerrar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (post) {
      document.body.style.overflow = 'hidden'
      window.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      document.body.style.overflow = 'auto'
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [post, onClose])

  if (!post) return null

  const handleShare = () => {
    const url = window.location.origin + `/#articulos?slug=${post.slug}`
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url)
      setCopied(true)
      toast.success('Enlace del artículo copiado al portapapeles')
      setTimeout(() => setCopied(false), 3000)
    }
  }

  const formattedDate = post.published_at
    ? new Date(post.published_at).toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
    : 'Reciente'

  // Renderizador enriquecido de markdown ligero para el contenido del artículo
  const renderFormattedContent = (text: string) => {
    const lines = text.split('\n')
    const elements: React.ReactNode[] = []
    let listItems: string[] = []

    const flushList = (keyPrefix: string) => {
      if (listItems.length > 0) {
        elements.push(
          <ul key={`${keyPrefix}-list`} className="space-y-2.5 my-4 pl-2">
            {listItems.map((item, idx) => (
              <li key={idx} className="flex items-start gap-3 text-slate-700 leading-relaxed text-base">
                <span className="w-2 h-2 rounded-full bg-brand-500 mt-2 shrink-0" />
                <span dangerouslySetInnerHTML={{ __html: formatInline(item) }} />
              </li>
            ))}
          </ul>
        )
        listItems = []
      }
    }

    const formatInline = (str: string) => {
      return str
        .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-navy-950">$1</strong>')
        .replace(/\*(.*?)\*/g, '<em class="italic text-slate-800">$1</em>')
        .replace(/\$(.*?)\$/g, '<code class="px-2 py-0.5 rounded bg-sand-200/50 text-brand-700 font-mono text-sm">$1</code>')
    }

    lines.forEach((line, index) => {
      const trimmed = line.trim()

      if (!trimmed) {
        flushList(`empty-${index}`)
        return
      }

      // Encabezados H3
      if (trimmed.startsWith('### ')) {
        flushList(`h3-${index}`)
        elements.push(
          <h3 key={`h3-${index}`} className="font-display text-xl md:text-2xl font-bold text-navy-900 mt-8 mb-4 flex items-center gap-2">
            <span className="w-1.5 h-6 rounded bg-gold-500 inline-block" />
            {trimmed.replace('### ', '')}
          </h3>
        )
        return
      }

      // Encabezados H2
      if (trimmed.startsWith('## ')) {
        flushList(`h2-${index}`)
        elements.push(
          <h2 key={`h2-${index}`} className="font-display text-2xl md:text-3xl font-bold text-navy-950 mt-10 mb-5 pb-2 border-b border-sand-300/40">
            {trimmed.replace('## ', '')}
          </h2>
        )
        return
      }

      // Separador horizontal
      if (trimmed === '---') {
        flushList(`hr-${index}`)
        elements.push(
          <hr key={`hr-${index}`} className="my-8 border-t border-sand-300/60" />
        )
        return
      }

      // Cita o Fórmula en bloque
      if (trimmed.startsWith('> ')) {
        flushList(`quote-${index}`)
        const quoteContent = trimmed.replace('> ', '')
        const isFormula = quoteContent.includes('VAN') || quoteContent.includes('=') || quoteContent.includes('Fórmula')

        elements.push(
          <div
            key={`quote-${index}`}
            className={`my-5 p-4 md:p-5 rounded-2xl border ${isFormula
              ? 'bg-gradient-to-r from-brand-50 to-cream-100 border-brand-300 text-brand-900 shadow-sm'
              : 'bg-sand-100/70 border-sand-300 text-slate-800 italic'
              }`}
          >
            {isFormula && (
              <div className="flex items-center gap-2 text-xs font-bold text-brand-600 uppercase tracking-widest mb-1.5">
              </div>
            )}
            <p
              className="text-base md:text-lg font-medium leading-relaxed font-sans"
              dangerouslySetInnerHTML={{ __html: formatInline(quoteContent) }}
            />
          </div>
        )
        return
      }

      // Ecuaciones o bloques de cálculo tipo $$...$$
      if (trimmed.startsWith('$$') && trimmed.endsWith('$$')) {
        flushList(`math-${index}`)
        const formulaClean = trimmed.replace(/\$\$/g, '').replace(/\\times/g, '×').replace(/\\frac\{(.*?)\}\{(.*?)\}/g, '($1 / $2)').replace(/\\text\{(.*?)\}/g, '$1')
        elements.push(
          <div key={`math-${index}`} className="my-4 py-3 px-5 rounded-xl bg-navy-950 text-cream-100 font-mono text-center text-sm md:text-base tracking-wide border border-navy-800 shadow-inner">
            {formulaClean}
          </div>
        )
        return
      }

      // Lista numerada especial para Principios Fundamentales
      const matchNumbered = trimmed.match(/^([0-9]+)\)\s+(.*)/)
      if (matchNumbered) {
        flushList(`num-${index}`)
        const num = matchNumbered[1]
        const content = matchNumbered[2] || ''
        elements.push(
          <div
            key={`principle-${index}`}
            className="my-3.5 p-4 rounded-xl bg-cream-100 border border-sand-300/80 flex items-start gap-4 transition-all hover:border-brand-400 hover:shadow-md"
          >
            <div className="w-9 h-9 rounded-lg bg-navy-900 text-gold-400 font-display font-bold flex items-center justify-center shrink-0 shadow-sm text-sm">
              {num}
            </div>
            <div
              className="text-slate-800 text-base leading-relaxed pt-1"
              dangerouslySetInnerHTML={{ __html: formatInline(content) }}
            />
          </div>
        )
        return
      }

      // Elemento de lista estándar (- o *)
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        listItems.push(trimmed.slice(2))
        return
      }

      // Párrafo normal
      flushList(`p-${index}`)
      elements.push(
        <p
          key={`p-${index}`}
          className="text-slate-700 text-base md:text-lg leading-relaxed mb-4"
          dangerouslySetInnerHTML={{ __html: formatInline(trimmed) }}
        />
      )
    })

    flushList('final')
    return elements
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 md:p-8 bg-navy-950/80 backdrop-blur-md animate-fadeIn">
      {/* Contenedor Modal */}
      <div className="relative w-full max-w-4xl max-h-[92vh] bg-cream-50 rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-sand-300/50">

        {/* Barra superior de control */}
        <header className="sticky top-0 z-30 flex items-center justify-between px-6 py-4 bg-cream-50/95 backdrop-blur border-b border-sand-300/40">
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-brand-100 text-brand-700 border border-brand-200">
              {post.category}
            </span>
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500 font-medium">
              <Clock className="w-3.5 h-3.5 text-gold-600" />
              <span>{post.reading_time_minutes} min de lectura</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleShare}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full bg-sand-200/70 hover:bg-sand-200 text-navy-900 transition-colors"
              title="Copiar enlace"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Share2 className="w-3.5 h-3.5" />}
              <span>{copied ? '¡Copiado!' : 'Compartir'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-sand-200 text-slate-600 hover:text-navy-900 transition-colors"
              aria-label="Cerrar artículo"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Contenido scrolleable */}
        <div className="flex-1 overflow-y-auto px-6 sm:px-10 md:px-14 py-8 scrollbar-slim">
          {/* Imagen de portada si existe */}
          {post.cover_image && (
            <div className="w-full h-56 sm:h-72 md:h-80 rounded-2xl overflow-hidden mb-8 shadow-md relative">
              <img
                src={post.cover_image}
                alt={post.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-navy-950/60 via-transparent to-transparent" />
            </div>
          )}

          {/* Título principal */}
          <h1 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold text-navy-950 leading-[1.15] mb-6">
            {post.title}
          </h1>

          {/* Datos del autor y fecha */}
          <div className="flex flex-wrap items-center gap-4 py-4 mb-8 border-y border-sand-300/50 text-sm">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-brand-600 text-cream-100 flex items-center justify-center font-bold font-display shadow-sm">
                {post.author_name.charAt(0)}
              </div>
              <div>
                <p className="font-bold text-navy-900 leading-tight">{post.author_name}</p>
                <p className="text-xs text-slate-500 leading-tight">{post.author_role || 'Equipo de Asesoría Finto'}</p>
              </div>
            </div>

            <div className="ml-auto flex items-center gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-gold-500" />
                {formattedDate}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-brand-500" />
                {post.reading_time_minutes} min
              </span>
            </div>
          </div>

          {/* Extracto destacado */}
          {post.excerpt && (
            <p className="text-lg md:text-xl font-medium text-brand-700 leading-relaxed mb-8 p-5 rounded-2xl bg-cream-100/90 border border-sand-300/70">
              {post.excerpt}
            </p>
          )}

          {/* Cuerpo del artículo formateado */}
          <article className="prose prose-slate max-w-none">
            {renderFormattedContent(post.content)}
          </article>

          {/* Tags */}
          {post.tags && post.tags.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mt-10 pt-6 border-t border-sand-300/40">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-2">Temas:</span>
              {post.tags.map(t => (
                <span key={t} className="px-3 py-1 text-xs font-semibold rounded-lg bg-sand-200/60 text-navy-900">
                  #{t}
                </span>
              ))}
            </div>
          )}

          {/* Banner de llamada a la acción de Finto al pie del artículo */}
          <div className="mt-12 rounded-3xl p-6 sm:p-8 bg-gradient-to-br from-navy-950 via-navy-900 to-brand-800 text-cream-100 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="max-w-md text-center md:text-left">
              <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gold-400 mb-2">
                <BookOpen className="w-4 h-4" />
                Asesoría Financiera & Contable
              </div>
              <h3 className="font-display text-2xl font-bold mb-2">¿Necesita optimizar las finanzas de su empresa?</h3>
              <p className="text-sm text-cream-100/70 leading-relaxed">
                El equipo de Finto centraliza sus operaciones de contabilidad, impuestos, tesorería y cartera con analítica en tiempo real.
              </p>
            </div>
            <div className="shrink-0 flex flex-col sm:flex-row gap-3">
              <Link
                to="/register"
                onClick={onClose}
                className="inline-flex items-center justify-center gap-2 font-display font-semibold text-sm bg-gold-500 hover:bg-gold-400 text-navy-950 px-6 py-3 rounded-full transition-colors shadow-md"
              >
                Solicitar Propuesta <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
