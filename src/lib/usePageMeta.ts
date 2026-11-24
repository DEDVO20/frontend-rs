import { useEffect } from 'react'

const SITE_URL = 'https://www.finto.la'

interface PageMeta {
  title: string
  description?: string
  /** Ruta canónica (ej. '/terminos-y-condiciones'); se omite en páginas no indexables */
  path?: string
  noindex?: boolean
}

function setMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.content = content
}

/** Título, descripción, canonical y Open Graph por página (la app es SPA, index.html trae los de la landing). */
export function usePageMeta({ title, description, path, noindex }: PageMeta) {
  useEffect(() => {
    const prevTitle = document.title
    document.title = title
    setMeta('property', 'og:title', title)
    if (description) {
      setMeta('name', 'description', description)
      setMeta('property', 'og:description', description)
    }

    const canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    const prevCanonical = canonical?.href
    if (canonical && path) {
      canonical.href = SITE_URL + path
      setMeta('property', 'og:url', SITE_URL + path)
    }

    if (noindex) setMeta('name', 'robots', 'noindex')

    return () => {
      document.title = prevTitle
      if (canonical && prevCanonical) canonical.href = prevCanonical
      if (noindex) document.head.querySelector('meta[name="robots"]')?.remove()
    }
  }, [title, description, path, noindex])
}
