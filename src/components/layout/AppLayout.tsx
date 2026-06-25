import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { ConfirmProvider } from '../ui/ConfirmDialog'
import { Menu } from 'lucide-react'

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <ConfirmProvider>
      <div className="flex h-screen bg-slate-50 overflow-hidden">
        {/* Mobile overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-30 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar — hidden on mobile, slide-in when open */}
        <div className={`
        fixed inset-y-0 left-0 z-40 w-64 transition-transform duration-200 lg:static lg:translate-x-0 lg:z-auto
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
          <Sidebar onClose={() => setSidebarOpen(false)} />
        </div>

        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Mobile topbar */}
          <div className="flex items-center gap-3 px-4 py-3 bg-slate-900 lg:hidden shrink-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-primary-500 flex items-center justify-center">
                <span className="text-white font-bold text-xs">F</span>
              </div>
              <span className="text-white font-semibold text-sm">Finto</span>
            </div>
          </div>

          <main className="flex-1 overflow-y-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </ConfirmProvider>
  )
}
