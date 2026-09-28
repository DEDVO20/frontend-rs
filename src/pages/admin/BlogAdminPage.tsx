import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { TopBar } from '@/components/layout/TopBar'
import { Button } from '@/components/ui/Button'
import { PageLoader } from '@/components/ui/Spinner'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { toast } from 'sonner'
import { BlogReaderModal, type BlogPostData } from '@/components/blog/BlogReaderModal'
import {
  BookOpen, Plus, Search, Edit3, Trash2, Eye, Globe,
  FileText, CheckCircle2, Clock, Sparkles, X, Tag, Settings2
} from 'lucide-react'

export interface BlogCategory {
  id: string
  name: string
  slug: string
  description?: string
  color: string
  post_count?: number
}

const PRESET_COVERS = [
  { label: 'Finanzas & Análisis', url: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1200&q=80' },
  { label: 'Cartera & Monedas', url: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=1200&q=80' },
  { label: 'Impuestos & Gráficos', url: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=80' },
  { label: 'Estrategia Corporativa', url: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80' },
]

function generateSlug(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
}

export function BlogAdminPage() {
  const qc = useQueryClient()
  const confirm = useConfirm()

  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [publishedFilter, setPublishedFilter] = useState<'all' | 'true' | 'false'>('all')

  // Modales
  const [showEditor, setShowEditor] = useState(false)
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [editingPost, setEditingPost] = useState<BlogPostData | null>(null)
  const [previewPost, setPreviewPost] = useState<BlogPostData | null>(null)

  // Estado para gestión de categorías
  const [editingCategory, setEditingCategory] = useState<BlogCategory | null>(null)
  const [categoryForm, setCategoryForm] = useState({ name: '', description: '', color: 'brand' })
  const [quickNewCategoryName, setQuickNewCategoryName] = useState('')
  const [showQuickCategoryInput, setShowQuickCategoryInput] = useState(false)

  // Form State para Artículos
  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    category: 'Finanzas Corporativas',
    excerpt: '',
    content: '',
    cover_image: PRESET_COVERS[0]!.url,
    author_name: 'Equipo Finto',
    author_role: 'Finanzas & Estrategia',
    reading_time_minutes: 5,
    published: false,
    featured: false,
    tagsInput: 'Finanzas, Estrategia',
  })

  // ── Consultas ─────────────────────────────────────────────────────────────

  // Categorías
  const { data: categories = [] } = useQuery<BlogCategory[]>({
    queryKey: ['admin-blog-categories'],
    queryFn: async () => {
      const res = await api.get('/api/blog/categories')
      return res.data
    },
    staleTime: 30_000,
  })

  // Artículos para admin
  const { data: postsData, isLoading } = useQuery({
    queryKey: ['admin-blog-posts', categoryFilter, publishedFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: '100' })
      if (categoryFilter !== 'all') params.set('category', categoryFilter)
      if (publishedFilter !== 'all') params.set('published', publishedFilter)
      const res = await api.get(`/api/blog?${params}`)
      return res.data
    },
    staleTime: 30_000,
  })

  const posts: BlogPostData[] = postsData?.data ?? []

  // Filtrado en memoria adicional por búsqueda
  const filteredPosts = search
    ? posts.filter(p =>
        p.title.toLowerCase().includes(search.toLowerCase()) ||
        p.slug.toLowerCase().includes(search.toLowerCase()) ||
        p.excerpt?.toLowerCase().includes(search.toLowerCase()) ||
        p.author_name.toLowerCase().includes(search.toLowerCase())
      )
    : posts

  // ── Mutaciones de Artículos ───────────────────────────────────────────────

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (editingPost) {
        return api.patch(`/api/blog/${editingPost.id}`, payload)
      } else {
        return api.post('/api/blog', payload)
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-blog-posts'] })
      qc.invalidateQueries({ queryKey: ['public-blog-posts'] })
      qc.invalidateQueries({ queryKey: ['admin-blog-categories'] })
      qc.invalidateQueries({ queryKey: ['public-blog-categories'] })
      toast.success(editingPost ? 'Artículo actualizado con éxito' : 'Artículo creado con éxito')
      setShowEditor(false)
      setEditingPost(null)
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error ?? 'Error al guardar el artículo')
    },
  })

  const togglePublishMutation = useMutation({
    mutationFn: async (id: string) => {
      return api.patch(`/api/blog/${id}/toggle-publish`)
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['admin-blog-posts'] })
      qc.invalidateQueries({ queryKey: ['public-blog-posts'] })
      const isPub = res.data.published
      toast.success(isPub ? 'Artículo publicado en la página principal' : 'Artículo cambiado a borrador')
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error ?? 'Error al alternar estado')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return api.delete(`/api/blog/${id}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-blog-posts'] })
      qc.invalidateQueries({ queryKey: ['public-blog-posts'] })
      qc.invalidateQueries({ queryKey: ['admin-blog-categories'] })
      toast.success('Artículo eliminado correctamente')
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error ?? 'Error al eliminar')
    },
  })

  // ── Mutaciones de Categorías ───────────────────────────────────────────────

  const saveCategoryMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (editingCategory) {
        return api.patch(`/api/blog/categories/${editingCategory.id}`, payload)
      } else {
        return api.post('/api/blog/categories', payload)
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-blog-categories'] })
      qc.invalidateQueries({ queryKey: ['public-blog-categories'] })
      qc.invalidateQueries({ queryKey: ['admin-blog-posts'] })
      qc.invalidateQueries({ queryKey: ['public-blog-posts'] })
      toast.success(editingCategory ? 'Categoría actualizada' : 'Categoría creada')
      setEditingCategory(null)
      setCategoryForm({ name: '', description: '', color: 'brand' })
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error ?? 'Error al guardar la categoría')
    },
  })

  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: string) => {
      return api.delete(`/api/blog/categories/${id}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-blog-categories'] })
      qc.invalidateQueries({ queryKey: ['public-blog-categories'] })
      qc.invalidateQueries({ queryKey: ['admin-blog-posts'] })
      toast.success('Categoría eliminada')
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error ?? 'Error al eliminar la categoría')
    },
  })

  const quickCreateCategoryMutation = useMutation({
    mutationFn: async (name: string) => {
      return api.post('/api/blog/categories', { name, description: '' })
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['admin-blog-categories'] })
      qc.invalidateQueries({ queryKey: ['public-blog-categories'] })
      const newCat = res.data
      setFormData(prev => ({ ...prev, category: newCat.name }))
      setQuickNewCategoryName('')
      setShowQuickCategoryInput(false)
      toast.success(`Categoría "${newCat.name}" creada y seleccionada`)
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error ?? 'Error al crear categoría rápida')
    },
  })

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleOpenNew = () => {
    setEditingPost(null)
    const defaultCat = categories[0]?.name || 'Finanzas Corporativas'
    setFormData({
      title: '',
      slug: '',
      category: defaultCat,
      excerpt: '',
      content: `Hablemos de finanzas y estrategia.

Empecemos por los principios fundamentales:
1) **Un peso hoy vale más que un peso mañana.**
2) **A mayor rentabilidad, mayor riesgo.**

Detengámonos aquí para analizar los resultados.

> **VAN = VA - Inversión realizada**`,
      cover_image: PRESET_COVERS[0]!.url,
      author_name: 'Equipo Finto',
      author_role: 'Finanzas & Estrategia',
      reading_time_minutes: 5,
      published: true,
      featured: false,
      tagsInput: 'Finanzas, Estrategia',
    })
    setShowEditor(true)
  }

  const handleOpenEdit = (post: BlogPostData) => {
    setEditingPost(post)
    setFormData({
      title: post.title,
      slug: post.slug,
      category: post.category,
      excerpt: post.excerpt ?? '',
      content: post.content,
      cover_image: post.cover_image ?? PRESET_COVERS[0]!.url,
      author_name: post.author_name,
      author_role: post.author_role ?? 'Finanzas & Estrategia',
      reading_time_minutes: post.reading_time_minutes,
      published: post.published,
      featured: post.featured ?? false,
      tagsInput: (post.tags ?? []).join(', '),
    })
    setShowEditor(true)
  }

  const handleDelete = (post: BlogPostData) => {
    confirm({
      title: '¿Eliminar artículo?',
      description: `¿Estás seguro de que deseas eliminar permanentemente el artículo "${post.title}"? Esta acción no se puede deshacer.`,
      confirmLabel: 'Sí, eliminar',
      type: 'danger',
      onConfirm: () => {
        deleteMutation.mutate(post.id)
      },
    })
  }

  const handleDeleteCategory = (cat: BlogCategory) => {
    confirm({
      title: '¿Eliminar categoría?',
      description: `¿Deseas eliminar la categoría "${cat.name}"? Los artículos asociados mantendrán su contenido.`,
      confirmLabel: 'Sí, eliminar',
      type: 'danger',
      onConfirm: () => {
        deleteCategoryMutation.mutate(cat.id)
      },
    })
  }

  const handleSaveCategory = (e: React.FormEvent) => {
    e.preventDefault()
    if (!categoryForm.name.trim()) {
      toast.error('El nombre de la categoría es requerido')
      return
    }
    saveCategoryMutation.mutate(categoryForm)
  }

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.title.trim()) {
      toast.error('El título es requerido')
      return
    }

    const calculatedSlug = formData.slug.trim() || generateSlug(formData.title)
    const tags = formData.tagsInput
      .split(',')
      .map(t => t.trim())
      .filter(Boolean)

    const wordCount = formData.content.trim().split(/\s+/).length
    const estMinutes = Math.max(1, Math.ceil(wordCount / 180))

    const payload = {
      title: formData.title,
      slug: calculatedSlug,
      category: formData.category,
      excerpt: formData.excerpt,
      content: formData.content,
      cover_image: formData.cover_image,
      author_name: formData.author_name,
      author_role: formData.author_role,
      reading_time_minutes: formData.reading_time_minutes || estMinutes,
      published: formData.published,
      featured: formData.featured,
      tags,
    }

    saveMutation.mutate(payload)
  }

  // KPIs
  const totalCount = posts.length
  const publishedCount = posts.filter(p => p.published).length
  const draftCount = posts.filter(p => !p.published).length
  const totalCategories = categories.length

  return (
    <div className="flex flex-col h-full overflow-hidden bg-slate-50">
      <TopBar title="Blog y Publicaciones" subtitle="Administre los artículos y categorías que se publican en la web principal" />

      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 scrollbar-slim">
        
        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Total Artículos</span>
              <BookOpen className="w-4 h-4 text-primary-500" />
            </div>
            <p className="text-3xl font-bold text-slate-900">{totalCount}</p>
            <p className="text-xs text-slate-500 mt-0.5">{publishedCount} publicados en la web</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Publicados</span>
              <Globe className="w-4 h-4 text-emerald-500" />
            </div>
            <p className="text-3xl font-bold text-emerald-600">{publishedCount}</p>
            <p className="text-xs text-slate-500 mt-0.5">Visibles en la página principal</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Borradores</span>
              <FileText className="w-4 h-4 text-amber-500" />
            </div>
            <p className="text-3xl font-bold text-amber-600">{draftCount}</p>
            <p className="text-xs text-slate-500 mt-0.5">En redacción o revisión</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Categorías</span>
              <Tag className="w-4 h-4 text-brand-500" />
            </div>
            <div className="flex items-center justify-between mt-1">
              <p className="text-3xl font-bold text-slate-900">{totalCategories}</p>
              <button
                type="button"
                onClick={() => setShowCategoryModal(true)}
                className="text-xs font-bold px-3 py-1.5 rounded-xl bg-brand-50 text-brand-700 hover:bg-brand-100 transition-colors border border-brand-200 flex items-center gap-1.5"
              >
                <Settings2 className="w-3.5 h-3.5" /> Gestionar
              </button>
            </div>
          </div>
        </div>

        {/* Barra de Filtros, Búsqueda y Botones de Acción */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por título, contenido o autor..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {/* Filtro estado */}
            <div className="flex items-center rounded-xl bg-slate-100 p-1 border border-slate-200 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setPublishedFilter('all')}
                className={`px-3 py-1.5 rounded-lg transition-all ${publishedFilter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
              >
                Todos
              </button>
              <button
                type="button"
                onClick={() => setPublishedFilter('true')}
                className={`px-3 py-1.5 rounded-lg transition-all ${publishedFilter === 'true' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
              >
                Publicados
              </button>
              <button
                type="button"
                onClick={() => setPublishedFilter('false')}
                className={`px-3 py-1.5 rounded-lg transition-all ${publishedFilter === 'false' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
              >
                Borradores
              </button>
            </div>

            {/* Filtro categoría dinámico */}
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              className="text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="all">Todas las categorías</option>
              {categories.map(c => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>

            <Button onClick={handleOpenNew} className="shadow-md">
              <Plus className="w-4 h-4" /> Nuevo Artículo
            </Button>
          </div>
        </div>

        {/* Tabla de Artículos */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="py-20 flex justify-center">
              <PageLoader />
            </div>
          ) : filteredPosts.length === 0 ? (
            <div className="text-center py-16 px-4">
              <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="font-semibold text-slate-700 text-base">No se encontraron artículos</p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                No hay publicaciones que coincidan con los filtros seleccionados o aún no has creado ninguna.
              </p>
              <Button onClick={handleOpenNew} className="mt-4" variant="secondary">
                <Plus className="w-4 h-4" /> Crear el primer artículo
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th className="py-3.5 px-4">Artículo</th>
                    <th className="py-3.5 px-4">Categoría</th>
                    <th className="py-3.5 px-4">Autor</th>
                    <th className="py-3.5 px-4 text-center">Estado</th>
                    <th className="py-3.5 px-4 text-center">Destacado</th>
                    <th className="py-3.5 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPosts.map(post => (
                    <tr key={post.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Portada + Título + Slug */}
                      <td className="py-3.5 px-4 max-w-md">
                        <div className="flex items-center gap-3">
                          {post.cover_image ? (
                            <img
                              src={post.cover_image}
                              alt=""
                              className="w-12 h-12 rounded-xl object-cover shrink-0 border border-slate-200"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 border border-slate-200">
                              <BookOpen className="w-5 h-5 text-slate-400" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 truncate leading-tight hover:text-primary-600 transition-colors">
                              {post.title}
                            </p>
                            <p className="text-xs text-slate-400 font-mono truncate mt-0.5">
                              /{post.slug}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Categoría */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-brand-50 text-brand-700 border border-brand-200">
                          {post.category}
                        </span>
                      </td>

                      {/* Autor y fecha */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-xs">
                        <p className="font-medium text-slate-800">{post.author_name}</p>
                        <p className="text-slate-400 flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3" /> {post.reading_time_minutes} min
                        </p>
                      </td>

                      {/* Estado publicado/borrador con botón de switch */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => togglePublishMutation.mutate(post.id)}
                          title="Hacer clic para cambiar estado"
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all ${
                            post.published
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border border-emerald-300'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-300'
                          }`}
                        >
                          {post.published ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              Publicado
                            </>
                          ) : (
                            <>
                              <FileText className="w-3.5 h-3.5 text-slate-400" />
                              Borrador
                            </>
                          )}
                        </button>
                      </td>

                      {/* Destacado */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        {post.featured ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gold-100 text-gold-800 border border-gold-300">
                            <Sparkles className="w-3 h-3 text-gold-600" /> Sí
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>

                      {/* Acciones */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setPreviewPost(post)}
                            title="Vista previa de lectura"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-primary-600 hover:bg-slate-100 transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(post)}
                            title="Editar artículo"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(post)}
                            title="Eliminar artículo"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Modal de Gestión de Categorías ─────────────────────────── */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-navy-950/70 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-2xl max-h-[90vh] bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/70">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-brand-600 text-white flex items-center justify-center">
                  <Tag className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base leading-tight">
                    Gestión de Categorías
                  </h3>
                  <p className="text-xs text-slate-400">
                    Agregue, edite o quite las categorías del blog
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowCategoryModal(false)
                  setEditingCategory(null)
                  setCategoryForm({ name: '', description: '', color: 'brand' })
                }}
                className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Contenido */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-slim">
              {/* Formulario Agregar / Editar Categoría */}
              <form onSubmit={handleSaveCategory} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    {editingCategory ? `Editar Categoría: "${editingCategory.name}"` : 'Agregar Nueva Categoría'}
                  </p>
                  {editingCategory && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCategory(null)
                        setCategoryForm({ name: '', description: '', color: 'brand' })
                      }}
                      className="text-xs text-slate-500 hover:text-slate-800 underline"
                    >
                      Cancelar edición
                    </button>
                  )}
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Nombre *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej. Finanzas Sostenibles"
                      value={categoryForm.name}
                      onChange={e => setCategoryForm({ ...categoryForm, name: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Descripción corta</label>
                    <input
                      type="text"
                      placeholder="Ej. Inversión ESG y finanzas verdes"
                      value={categoryForm.description}
                      onChange={e => setCategoryForm({ ...categoryForm, description: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <Button type="submit" disabled={saveCategoryMutation.isPending} size="sm">
                    {saveCategoryMutation.isPending ? 'Guardando...' : editingCategory ? 'Guardar Cambios' : 'Agregar Categoría'}
                  </Button>
                </div>
              </form>

              {/* Lista de categorías existentes */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                  Categorías Registradas ({categories.length})
                </p>

                <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-white">
                  {categories.map(cat => (
                    <div key={cat.id} className="p-3.5 flex items-center justify-between hover:bg-slate-50/70 transition-colors">
                      <div className="min-w-0 pr-3">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900 text-sm">{cat.name}</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                            {cat.post_count ?? 0} artículos
                          </span>
                        </div>
                        {cat.description && (
                          <p className="text-xs text-slate-500 truncate mt-0.5">{cat.description}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCategory(cat)
                            setCategoryForm({
                              name: cat.name,
                              description: cat.description ?? '',
                              color: cat.color ?? 'brand',
                            })
                          }}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                          title="Editar categoría"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCategory(cat)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Eliminar categoría"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex justify-end">
              <Button variant="secondary" onClick={() => setShowCategoryModal(false)}>
                Cerrar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal de Creación / Edición de Artículo ─────────────────── */}
      {showEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-navy-950/70 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-4xl max-h-[94vh] bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200">
            {/* Header del modal */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/70">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary-600 text-white flex items-center justify-center">
                  <BookOpen className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base leading-tight">
                    {editingPost ? 'Editar Artículo' : 'Nuevo Artículo para el Blog'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Configure el contenido que se mostrará en la página principal
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowEditor(false)}
                className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Formulario scrolleable */}
            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-slim">
              
              {/* Título & Slug */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Título del Artículo *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={e => {
                      const t = e.target.value
                      setFormData(prev => ({
                        ...prev,
                        title: t,
                        slug: prev.slug === generateSlug(prev.title) || !prev.slug ? generateSlug(t) : prev.slug,
                      }))
                    }}
                    placeholder="Ej. Hablemos de finanzas y de lo que hace un gerente financiero"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    URL amigable (Slug) *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.slug}
                    onChange={e => setFormData({ ...formData, slug: generateSlug(e.target.value) })}
                    placeholder="ej-hablemos-de-finanzas"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-mono text-slate-700 focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Categoría Dinámica & Etiquetas */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Categoría *
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowQuickCategoryInput(!showQuickCategoryInput)}
                      className="text-[11px] font-bold text-brand-600 hover:text-brand-700"
                    >
                      {showQuickCategoryInput ? 'Cancelar' : '+ Nueva categoría'}
                    </button>
                  </div>

                  {showQuickCategoryInput ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Nombre de nueva categoría..."
                        value={quickNewCategoryName}
                        onChange={e => setQuickNewCategoryName(e.target.value)}
                        className="flex-1 px-3 py-2 rounded-xl border border-brand-300 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
                      />
                      <Button
                        type="button"
                        size="sm"
                        disabled={!quickNewCategoryName.trim() || quickCreateCategoryMutation.isPending}
                        onClick={() => quickCreateCategoryMutation.mutate(quickNewCategoryName.trim())}
                      >
                        Crear
                      </Button>
                    </div>
                  ) : (
                    <select
                      value={formData.category}
                      onChange={e => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none bg-white font-medium"
                    >
                      {categories.map(c => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Etiquetas (separadas por coma)
                  </label>
                  <input
                    type="text"
                    value={formData.tagsInput}
                    onChange={e => setFormData({ ...formData, tagsInput: e.target.value })}
                    placeholder="Finanzas, VAN, Estrategia, Flujo"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Extracto */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Resumen o Extracto Breve
                </label>
                <textarea
                  rows={2}
                  value={formData.excerpt}
                  onChange={e => setFormData({ ...formData, excerpt: e.target.value })}
                  placeholder="Resumen atractivo que aparecerá en la tarjeta de la página de inicio..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>

              {/* Imagen de portada con Presets rápidos */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Imagen de Portada (URL)
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="url"
                    value={formData.cover_image}
                    onChange={e => setFormData({ ...formData, cover_image: e.target.value })}
                    placeholder="https://images.unsplash.com/..."
                    className="flex-1 px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-bold text-slate-400 uppercase">Presets rápidos:</span>
                  {PRESET_COVERS.map(preset => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setFormData({ ...formData, cover_image: preset.url })}
                      className={`text-xs px-2.5 py-1 rounded-lg border transition-all ${
                        formData.cover_image === preset.url
                          ? 'bg-primary-50 border-primary-500 text-primary-700 font-bold'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Contenido Completo del Artículo */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Contenido del Artículo *
                  </label>
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                    <span className="bg-slate-100 px-2 py-0.5 rounded font-mono">### Título</span>
                    <span className="bg-slate-100 px-2 py-0.5 rounded font-mono">**Negrita**</span>
                    <span className="bg-slate-100 px-2 py-0.5 rounded font-mono">&gt; Fórmula/Cita</span>
                    <span className="bg-slate-100 px-2 py-0.5 rounded font-mono">1) Principio</span>
                  </div>
                </div>
                <textarea
                  required
                  rows={12}
                  value={formData.content}
                  onChange={e => setFormData({ ...formData, content: e.target.value })}
                  placeholder="Escriba aquí el contenido del artículo..."
                  className="w-full px-4 py-3 rounded-2xl border border-slate-300 font-sans text-sm text-slate-800 leading-relaxed focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>

              {/* Autor y Tiempo de Lectura */}
              <div className="grid md:grid-cols-3 gap-4 pt-2 border-t border-slate-200">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Nombre del Autor
                  </label>
                  <input
                    type="text"
                    value={formData.author_name}
                    onChange={e => setFormData({ ...formData, author_name: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Cargo o Rol del Autor
                  </label>
                  <input
                    type="text"
                    value={formData.author_role}
                    onChange={e => setFormData({ ...formData, author_role: e.target.value })}
                    placeholder="Controller Financiero"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Tiempo de Lectura (minutos)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={formData.reading_time_minutes}
                    onChange={e => setFormData({ ...formData, reading_time_minutes: Number(e.target.value) })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Switches de Publicación y Destacado */}
              <div className="flex flex-wrap items-center gap-6 p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.published}
                    onChange={e => setFormData({ ...formData, published: e.target.checked })}
                    className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                  />
                  <div>
                    <p className="text-sm font-bold text-slate-800 leading-tight">Publicar en la Web Principal</p>
                    <p className="text-xs text-slate-500">Si se desmarca, se guardará como borrador visible solo en admin.</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.featured}
                    onChange={e => setFormData({ ...formData, featured: e.target.checked })}
                    className="w-4 h-4 text-gold-500 rounded focus:ring-gold-400"
                  />
                  <div>
                    <p className="text-sm font-bold text-slate-800 leading-tight">Artículo Destacado</p>
                    <p className="text-xs text-slate-500">Tendrá mayor prominencia en la página principal.</p>
                  </div>
                </label>
              </div>

              {/* Footer con botones de guardar */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowEditor(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={saveMutation.isPending}
                >
                  {saveMutation.isPending ? 'Guardando...' : editingPost ? 'Actualizar Artículo' : 'Crear y Guardar'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lector modal de previsualización */}
      <BlogReaderModal post={previewPost} onClose={() => setPreviewPost(null)} />
    </div>
  )
}
