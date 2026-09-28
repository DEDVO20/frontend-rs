import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Clock, Calendar, ArrowRight, BookOpen, Sparkles } from 'lucide-react'
import { BlogReaderModal, type BlogPostData } from './BlogReaderModal'

export interface BlogCategoryData {
  id: string
  name: string
  slug: string
  description?: string
  color?: string
  post_count?: number
}

export function BlogSection() {
  const [selectedCategory, setSelectedCategory] = useState('Todas')
  const [selectedPost, setSelectedPost] = useState<BlogPostData | null>(null)

  // Obtener categorías dinámicas de la base de datos
  const { data: categoriesData } = useQuery({
    queryKey: ['public-blog-categories'],
    queryFn: async () => {
      const res = await api.get('/api/blog/categories')
      return res.data as BlogCategoryData[]
    },
    staleTime: 30_000,
  })

  // Categorías a mostrar: 'Todas' + categorías existentes
  const availableCategories = [
    'Todas',
    ...(categoriesData ? categoriesData.map(c => c.name) : [
      'Finanzas Corporativas',
      'Tesorería & Cartera',
      'Impuestos & Legal',
    ]),
  ]

  // Obtener artículos según la categoría seleccionada
  const { data, isLoading } = useQuery({
    queryKey: ['public-blog-posts', selectedCategory],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: '20', published: 'true' })
      if (selectedCategory && selectedCategory !== 'Todas') {
        params.set('category', selectedCategory)
      }
      const res = await api.get(`/api/blog/public?${params}`)
      return res.data
    },
    staleTime: 30_000,
  })

  const posts: BlogPostData[] = data?.data ?? []

  return (
    <section id="articulos" className="py-20 md:py-28 bg-cream-100/60 relative overflow-hidden border-t border-sand-300/40">
      {/* Elemento de fondo decorativo */}
      <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 rounded-full bg-brand-200/20 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-96 h-96 rounded-full bg-gold-400/10 blur-3xl pointer-events-none" />

      <div className="relative max-w-6xl mx-auto px-5 md:px-6">
        {/* Encabezado de la sección */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-[0.2em] bg-brand-100 text-brand-700 border border-brand-200 mb-3">
              <BookOpen className="w-3.5 h-3.5 text-gold-600" />
              Artículos & Publicaciones
            </div>
            <h2 className="font-display text-3xl md:text-5xl font-bold text-navy-950 leading-tight">
              Conocimiento que impulsa <br />
              <span className="text-brand-600">su gestión empresarial</span>
            </h2>
            <p className="text-navy-900/65 mt-3 text-base md:text-lg leading-relaxed">
              Principios de finanzas, análisis de inversión, control de caja y buenas prácticas contables redactadas por nuestros especialistas.
            </p>
          </div>

          {/* Filtros de categoría dinámicos */}
          <div className="flex flex-wrap gap-2">
            {availableCategories.map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
                  selectedCategory === cat
                    ? 'bg-navy-900 text-cream-100 shadow-md ring-2 ring-navy-900/20 scale-[1.02]'
                    : 'bg-cream-50 text-navy-900/70 border border-sand-300/70 hover:bg-white hover:text-navy-950'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-96 rounded-3xl bg-sand-200/40 animate-pulse" />
            ))}
          </div>
        )}

        {/* Lista de artículos */}
        {!isLoading && posts.length > 0 && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {posts.map((post, idx) => {
              const isFirstFeatured = idx === 0 && post.featured
              return (
                <article
                  key={post.id}
                  onClick={() => setSelectedPost(post)}
                  className={`group cursor-pointer rounded-3xl bg-cream-50 border border-sand-300/60 overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col hover:-translate-y-1.5 ${
                    isFirstFeatured ? 'md:col-span-2 lg:col-span-2' : ''
                  }`}
                >
                  {/* Imagen de portada */}
                  {post.cover_image && (
                    <div className={`relative overflow-hidden ${isFirstFeatured ? 'h-64 md:h-80' : 'h-52'} bg-navy-900`}>
                      <img
                        src={post.cover_image}
                        alt={post.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-navy-950/70 via-transparent to-transparent" />
                      
                      <div className="absolute top-4 left-4 flex items-center gap-2">
                        <span className="px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-navy-900/90 text-gold-400 backdrop-blur border border-white/10">
                          {post.category}
                        </span>
                        {post.featured && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-gold-500 text-navy-950 shadow-sm">
                            <Sparkles className="w-3 h-3" />
                            Destacado
                          </span>
                        )}
                      </div>

                      <div className="absolute bottom-3 right-4 flex items-center gap-1 text-[11px] text-cream-100/90 font-medium bg-black/40 px-2.5 py-1 rounded-full backdrop-blur">
                        <Clock className="w-3 h-3 text-gold-400" />
                        <span>{post.reading_time_minutes} min lectura</span>
                      </div>
                    </div>
                  )}

                  {/* Cuerpo de la tarjeta */}
                  <div className="p-6 md:p-7 flex-1 flex flex-col justify-between">
                    <div>
                      {!post.cover_image && (
                        <div className="flex items-center gap-2 mb-3">
                          <span className="px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-brand-100 text-brand-700">
                            {post.category}
                          </span>
                        </div>
                      )}

                      <h3 className={`font-display font-bold text-navy-950 group-hover:text-brand-600 transition-colors leading-snug mb-3 ${
                        isFirstFeatured ? 'text-2xl md:text-3xl' : 'text-xl'
                      }`}>
                        {post.title}
                      </h3>

                      {post.excerpt && (
                        <p className="text-slate-600 text-sm md:text-base leading-relaxed line-clamp-3 mb-6">
                          {post.excerpt}
                        </p>
                      )}
                    </div>

                    <div className="pt-4 border-t border-sand-300/40 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <div className="w-6 h-6 rounded-full bg-brand-500 text-white flex items-center justify-center font-bold text-[10px]">
                          {post.author_name.charAt(0)}
                        </div>
                        <span className="font-medium text-slate-700">{post.author_name}</span>
                        {post.published_at && (
                          <>
                            <span>·</span>
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-slate-400" />
                              {new Date(post.published_at).toLocaleDateString('es-CO', { month: 'short', day: 'numeric' })}
                            </span>
                          </>
                        )}
                      </div>

                      <span className="inline-flex items-center gap-1 text-xs font-bold text-brand-600 group-hover:text-brand-700 group-hover:translate-x-1 transition-all">
                        Leer <ArrowRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && posts.length === 0 && (
          <div className="text-center py-16 bg-cream-50 rounded-3xl border border-sand-300/60 p-8">
            <BookOpen className="w-12 h-12 text-sand-400 mx-auto mb-3" />
            <p className="font-display font-bold text-lg text-navy-900">No hay artículos en la categoría "{selectedCategory}"</p>
            <p className="text-sm text-slate-500 mt-1">Pronto publicaremos nuevo contenido sobre este tema.</p>
          </div>
        )}
      </div>

      {/* Modal Lector Inmersivo */}
      <BlogReaderModal post={selectedPost} onClose={() => setSelectedPost(null)} />
    </section>
  )
}
