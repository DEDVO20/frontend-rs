import { useThemeStore } from '@/stores/themeStore'
import { cn } from '@/lib/utils'

/**
 * Iconos de marca Finto. Cada icono existe en dos variantes de color ya "horneadas"
 * en el SVG (no se pueden recolorear por CSS): `navy` (para fondos claros) y
 * `white` (para fondos oscuros como el sidebar o el modo oscuro).
 *
 * Archivos en: src/assets/finto/icons/{sidebar,tabs,misc}/<name>.<variant>.svg
 */

const modules = import.meta.glob('../../assets/finto/icons/*/*.svg', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

// Índice: "<name>.<variant>" -> url
const REGISTRY: Record<string, string> = {}
for (const [path, url] of Object.entries(modules)) {
  const file = path.split('/').pop()! // p.ej. "dashboard.navy.svg"
  const key = file.replace(/\.svg$/, '') // "dashboard.navy"
  REGISTRY[key] = url
}

export type FintoIconName =
  // sidebar
  | 'dashboard' | 'perfil-empresa' | 'tareas' | 'documentos' | 'solicitudes' | 'finto-web' | 'usuario'
  // tabs
  | 'general' | 'facturacion' | 'recaudo' | 'cartera' | 'comercial'
  // misc
  | 'check' | 'check-circle' | 'info' | 'clock' | 'folders' | 'download' | 'shield'
  | 'coin' | 'hand-coin' | 'wallet' | 'briefcase' | 'people' | 'support' | 'building'
  | 'doc-money' | 'gear-idea' | 'bank-gear' | 'security-lock' | 'devices' | 'analytics' | 'globe'

type Variant = 'navy' | 'white' | 'auto'

interface Props {
  name: FintoIconName
  /** `auto` sigue el tema: navy en claro, blanco en oscuro. Default: auto */
  variant?: Variant
  className?: string
  /** tamaño en px (aplica a width y height). Default: 24 */
  size?: number
  alt?: string
}

export function FintoIcon({ name, variant = 'auto', className, size = 24, alt = '' }: Props) {
  const theme = useThemeStore((s) => s.theme)
  const resolved = variant === 'auto' ? (theme === 'dark' ? 'white' : 'navy') : variant
  const url = REGISTRY[`${name}.${resolved}`] ?? REGISTRY[`${name}.navy`] ?? REGISTRY[`${name}.white`]

  if (!url) {
    if (import.meta.env.DEV) console.warn(`[FintoIcon] icono no encontrado: ${name}.${resolved}`)
    return null
  }

  return (
    <img
      src={url}
      alt={alt}
      width={size}
      height={size}
      className={cn('inline-block shrink-0 select-none', className)}
      draggable={false}
    />
  )
}
