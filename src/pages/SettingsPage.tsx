import { useAuthStore } from '@/stores/authStore'
import { TopBar } from '@/components/layout/TopBar'
import { Card, CardBody } from '@/components/ui/Card'
import { User, Bell, Shield, Palette } from 'lucide-react'

const sections = [
  {
    icon: User,
    title: 'Perfil de usuario',
    description: 'Actualiza tu nombre, email y contraseña',
  },
  {
    icon: Bell,
    title: 'Notificaciones',
    description: 'Configura cómo y cuándo recibes alertas',
  },
  {
    icon: Shield,
    title: 'Seguridad',
    description: 'Gestiona sesiones activas y autenticación',
  },
  {
    icon: Palette,
    title: 'Apariencia',
    description: 'Personaliza el tema y el idioma',
  },
]

export function SettingsPage() {
  const user = useAuthStore(s => s.user)

  return (
    <div>
      <TopBar title="Configuración" subtitle="Preferencias de cuenta y sistema" />

      <div className="p-6 space-y-6">
        {/* User summary */}
        <Card>
          <CardBody>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-xl font-bold shadow-lg">
                {user?.full_name?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? '?'}
              </div>
              <div>
                <p className="font-semibold text-slate-900 text-lg">{user?.full_name ?? '—'}</p>
                <p className="text-sm text-slate-500">{user?.email}</p>
                <span className="inline-block mt-1 text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full font-medium capitalize">
                  {user?.role?.replace(/_/g, ' ')}
                </span>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Settings grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {sections.map(({ icon: Icon, title, description }) => (
            <button
              key={title}
              className="group text-left p-5 rounded-xl border border-slate-200 bg-white hover:border-primary-300 hover:shadow-sm transition-all"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-slate-100 group-hover:bg-primary-50 flex items-center justify-center transition-colors shrink-0">
                  <Icon className="w-5 h-5 text-slate-400 group-hover:text-primary-500 transition-colors" />
                </div>
                <div>
                  <p className="font-semibold text-slate-800 text-sm">{title}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{description}</p>
                </div>
              </div>
            </button>
          ))}
        </div>

        <p className="text-center text-xs text-slate-400">v1.0.0 · Empresa Paola Platform</p>
      </div>
    </div>
  )
}
