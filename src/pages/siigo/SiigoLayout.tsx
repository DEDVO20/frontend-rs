import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { HandCoins, Receipt, Scale, type LucideIcon } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { useAuthStore } from '@/stores/authStore'
import { cn } from '@/lib/utils'
import { SiigoCollectionsPanel } from './SiigoCollectionsPanel'
import { SIIGO_INTERNAL_ROLES, SiigoBooksSelect } from './siigoBooks'

export { SIIGO_INTERNAL_ROLES }

/** Pestañas de la sección Siigo. Para agregar una: nueva entrada + ruta hija en router.tsx */
const TABS: { to: string; label: string; icon: LucideIcon }[] = [
  { to: 'facturacion', label: 'Facturación',       icon: Receipt },
  { to: 'recaudo',     label: 'Recaudo',           icon: HandCoins },
  { to: 'balance',     label: 'Balance de prueba', icon: Scale },
]

/**
 * Sección Siigo. Cada pestaña muestra los libros de UNA cuenta de Siigo:
 * - Internos: la elegida en «Libros de» (Finto por defecto); se conserva al cambiar de pestaña (?libros=).
 * - Clientes: siempre los de su propia empresa, con el estilo del portal.
 */
export function SiigoLayout() {
  const role = useAuthStore(s => s.user?.role ?? '')
  const { search } = useLocation()
  const isInternal = SIIGO_INTERNAL_ROLES.includes(role)

  if (!isInternal) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <nav className="flex items-center gap-1 px-5 md:px-8 pt-4 shrink-0">
          {TABS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => cn(
                'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors',
                isActive
                  ? 'bg-navy-900 text-cream-100 dark:bg-gold-500 dark:text-navy-950'
                  : 'text-navy-900/70 hover:bg-navy-900/5 dark:text-cream-100/70 dark:hover:bg-white/5',
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="flex-1 min-h-0 flex flex-col">
          <Outlet />
        </div>
      </div>
    )
  }

  return (
    // Vista interna siempre clara (el contador navega dentro del layout del portal, que puede estar en oscuro)
    <div data-theme="light" style={{ colorScheme: 'light' }} className="flex flex-col h-full overflow-hidden bg-slate-50">
      <TopBar title="Consultas Siigo" subtitle="Facturación, recaudo y balance de prueba de cada cuenta de Siigo" />

      <nav className="flex flex-wrap items-center gap-1 px-4 md:px-6 bg-white border-b border-slate-200 shrink-0">
        {TABS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={{ pathname: to, search }}
            className={({ isActive }) => cn(
              'flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 -mb-px transition-colors',
              isActive
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300',
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </NavLink>
        ))}
        <SiigoBooksSelect className="ml-auto py-2" />
      </nav>

      <div className="flex-1 min-h-0 flex flex-col">
        <Outlet />
      </div>
    </div>
  )
}

/** Pestaña Recaudo: detalle de recibos de caja de los libros consultados */
export function SiigoCollectionsPage() {
  const role = useAuthStore(s => s.user?.role ?? '')
  const canSync = ['admin', 'rs_admin', 'contador'].includes(role)
  const isInternal = SIIGO_INTERNAL_ROLES.includes(role)
  return (
    // El detalle de recaudo usa el estilo claro del back-office también en el portal
    <div data-theme="light" style={{ colorScheme: 'light' }} className={cn('flex-1 overflow-y-auto p-4 md:p-6', !isInternal && 'md:px-8')}>
      <SiigoCollectionsPanel canSync={canSync} />
    </div>
  )
}
