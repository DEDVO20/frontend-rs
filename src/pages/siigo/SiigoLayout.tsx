import { NavLink, Outlet } from 'react-router-dom'
import { HandCoins, Receipt, Scale, type LucideIcon } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { useAuthStore } from '@/stores/authStore'
import { cn } from '@/lib/utils'
import { SiigoCollectionsPanel } from './SiigoCollectionsPanel'

export const SIIGO_INTERNAL_ROLES = ['admin', 'rs_admin', 'rs_staff', 'contador']

/** Pestañas de la sección Siigo (roles internos). Para agregar una: nueva entrada + ruta hija en router.tsx */
const TABS: { to: string; label: string; icon: LucideIcon }[] = [
  { to: 'facturacion', label: 'Facturación', icon: Receipt },
  { to: 'recaudo',     label: 'Recaudo',     icon: HandCoins },
  { to: 'balance',     label: 'Balance de prueba', icon: Scale },
]

/**
 * Sección Siigo: los roles internos ven las pestañas (cada una con su ruta);
 * los clientes solo tienen la consulta de facturación con el encabezado del portal.
 */
export function SiigoLayout() {
  const role = useAuthStore(s => s.user?.role ?? '')
  if (!SIIGO_INTERNAL_ROLES.includes(role)) return <Outlet />

  return (
    // Vista interna siempre clara (el contador navega dentro del layout del portal, que puede estar en oscuro)
    <div data-theme="light" style={{ colorScheme: 'light' }} className="flex flex-col h-full overflow-hidden bg-slate-50">
      <TopBar title="Consultas Siigo" subtitle="Facturación, recaudo y balance de prueba sincronizados desde Siigo" />

      <nav className="flex items-center gap-1 px-4 md:px-6 bg-white border-b border-slate-200 shrink-0">
        {TABS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
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
      </nav>

      <div className="flex-1 min-h-0 flex flex-col">
        <Outlet />
      </div>
    </div>
  )
}

/** Pestaña Recaudo: detalle de recibos de caja (solo roles internos) */
export function SiigoCollectionsPage() {
  const role = useAuthStore(s => s.user?.role ?? '')
  const canSync = ['admin', 'rs_admin', 'contador'].includes(role)
  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6">
      <SiigoCollectionsPanel canSync={canSync} />
    </div>
  )
}
