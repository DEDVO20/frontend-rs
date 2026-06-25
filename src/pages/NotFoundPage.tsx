import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { Home, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/Button'

export function NotFoundPage() {
  const nav = useNavigate()
  const token = useAuthStore(s => s.accessToken)
  const home = token ? '/app/dashboard' : '/'

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="text-center max-w-md">

        {/* Logo */}
        <div className="w-12 h-12 rounded-xl bg-primary-500 flex items-center justify-center mx-auto mb-6">
          <span className="text-white font-bold text-lg">F</span>
        </div>

        {/* Imagen */}
        <img src="/not-found.png" alt="Página no encontrada" className="w-64 mx-auto mb-6" />

        <h1 className="text-2xl font-bold text-slate-900 mb-2">Página no encontrada</h1>
        <p className="text-sm text-slate-500 mb-8">
          La página que buscas no existe, fue movida o no tienes permisos para acceder.
        </p>

        <div className="flex items-center justify-center gap-3">
          <Button variant="secondary" onClick={() => nav(-1)}>
            <ArrowLeft className="w-4 h-4" /> Volver
          </Button>
          <Button onClick={() => nav(home)}>
            <Home className="w-4 h-4" /> Ir al inicio
          </Button>
        </div>

        <p className="text-xs text-slate-400 mt-10">
          © {new Date().getFullYear()} Finto
        </p>
      </div>
    </div>
  )
}
