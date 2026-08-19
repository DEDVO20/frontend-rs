import { Moon, Sun } from 'lucide-react'
import { useThemeStore } from '@/stores/themeStore'
import { cn } from '@/lib/utils'

interface Props { className?: string }

/** Botón para alternar entre modo claro y oscuro. */
export function ThemeToggle({ className }: Props) {
  const { theme, toggle } = useThemeStore()
  const isDark = theme === 'dark'

  return (
    <button
      onClick={toggle}
      title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      className={cn(
        'inline-flex items-center justify-center w-9 h-9 rounded-lg transition-colors',
        'text-navy-900/70 hover:bg-sand-200/60 hover:text-navy-900',
        'dark:text-cream-100/70 dark:hover:bg-white/10 dark:hover:text-cream-100',
        className,
      )}
    >
      {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
    </button>
  )
}
