import { ThemeToggle } from '@/components/ui/ThemeToggle'

interface Props {
  title: string
  subtitle?: string
  /** Nombre de la empresa (se muestra a la derecha, como "Logo de la empresa" en el diseño). */
  companyName?: string
  /** Contenido extra opcional a la derecha (botones de acción, etc.). */
  right?: React.ReactNode
}

export function PortalTopBar({ title, subtitle, companyName, right }: Props) {
  return (
    <header className="flex items-start justify-between gap-4 px-5 md:px-8 pt-6 pb-4 shrink-0">
      <div>
        <h1 className="font-display text-2xl md:text-3xl font-bold text-navy-900 dark:text-cream-100 leading-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm text-navy-900/55 dark:text-cream-100/55 mt-0.5">{subtitle}</p>
        )}
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {right}
        <ThemeToggle />
        {companyName && (
          <span className="hidden sm:block font-display text-lg md:text-xl font-bold text-navy-900 dark:text-cream-100 text-right max-w-[180px] leading-tight">
            {companyName}
          </span>
        )}
      </div>
    </header>
  )
}
