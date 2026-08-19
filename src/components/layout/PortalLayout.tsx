import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { PortalSidebar } from './PortalSidebar'
import { ConfirmProvider } from '../ui/ConfirmDialog'
import { FintoLogo } from '../ui/FintoLogo'
import { ThemeToggle } from '../ui/ThemeToggle'
import { Menu } from 'lucide-react'

/** Layout del portal del cliente (estética Finto, claro/oscuro). */
export function PortalLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <ConfirmProvider>
      <div className="flex h-screen overflow-hidden bg-cream-50 dark:bg-navy-950">
        {/* Overlay móvil */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-30 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <div className={`
          fixed inset-y-0 left-0 z-40 w-64 transition-transform duration-200 lg:static lg:translate-x-0 lg:z-auto
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}>
          <PortalSidebar onClose={() => setSidebarOpen(false)} />
        </div>

        {/* Contenido */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Topbar móvil */}
          <div className="flex items-center justify-between gap-3 px-4 py-3 bg-navy-900 lg:hidden shrink-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="text-cream-100 p-1 rounded-lg hover:bg-white/10 transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            <FintoLogo variant="white" height={22} />
            <ThemeToggle className="text-cream-100/70 hover:text-cream-100" />
          </div>

          <main className="flex-1 overflow-y-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </ConfirmProvider>
  )
}
