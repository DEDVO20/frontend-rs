import fintoNavy from '@/assets/finto/logo/finto-navy.opt.png'
import fintoWhite from '@/assets/finto/logo/finto-white.opt.png'
import { useThemeStore } from '@/stores/themeStore'
import { cn } from '@/lib/utils'

interface Props {
  /** `navy` (azul, para fondos claros) · `white` (crema, para fondos oscuros) · `auto` sigue el tema */
  variant?: 'navy' | 'white' | 'auto'
  className?: string
  /** altura en px. Default: 28 */
  height?: number
}

/** Logotipo "finto." de marca. */
export function FintoLogo({ variant = 'auto', className, height = 28 }: Props) {
  const theme = useThemeStore((s) => s.theme)
  const resolved = variant === 'auto' ? (theme === 'dark' ? 'white' : 'navy') : variant
  const src = resolved === 'white' ? fintoWhite : fintoNavy

  return (
    <img
      src={src}
      alt="Finto"
      style={{ height }}
      className={cn('w-auto select-none', className)}
      draggable={false}
    />
  )
}
