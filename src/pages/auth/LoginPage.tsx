import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate, Link } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/authStore'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

const schema = z.object({
  email:    z.string().email('Email inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
})

type Form = z.infer<typeof schema>

const FEATURES = [
  {
    emoji: '📊',
    title: 'Dashboard en tiempo real',
    desc: 'KPIs, facturación, cartera y tesorería actualizados al instante.',
  },
  {
    emoji: '🔒',
    title: 'Acceso seguro por roles',
    desc: 'Cada usuario ve únicamente la información que le corresponde.',
  },
  {
    emoji: '📁',
    title: 'Documentos y reportes',
    desc: 'Descargue facturas, nóminas e informes desde cualquier dispositivo.',
  },
]

export function LoginPage() {
  const { login } = useAuthStore()
  const navigate   = useNavigate()

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: Form) => {
    try {
      await login(data.email, data.password)
      navigate('/app/dashboard')
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Credenciales inválidas')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-primary-950 flex items-center justify-center p-4">
      {/* Grid decorativo */}
      <div
        className="fixed inset-0 opacity-[0.06] pointer-events-none"
        style={{ backgroundImage: 'linear-gradient(#14b8a6 1px,transparent 1px),linear-gradient(90deg,#14b8a6 1px,transparent 1px)', backgroundSize: '48px 48px' }}
      />

      <div className="relative w-full max-w-5xl flex flex-col lg:flex-row gap-0 rounded-3xl overflow-hidden shadow-2xl shadow-black/50">

        {/* ── Panel izquierdo ── */}
        <div className="hidden lg:flex flex-col w-[52%] bg-slate-900/80 backdrop-blur border-r border-white/5 p-10 xl:p-14">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 rounded-xl bg-primary-600 flex items-center justify-center shrink-0">
              <span className="text-white font-bold text-base">RS</span>
            </div>
            <div>
              <p className="font-semibold text-white text-sm leading-tight">RS Back Office</p>
              <p className="text-xs text-slate-400 leading-tight">Gestión empresarial</p>
            </div>
          </div>

          {/* Headline */}
          <div className="mb-10">
            <h2 className="text-4xl xl:text-5xl font-bold text-white leading-tight mb-4">
              Bienvenido<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-teal-300">
                a su portal
              </span>
            </h2>
            <p className="text-slate-400 leading-relaxed text-sm">
              Acceda a toda la información financiera y administrativa de su empresa
              en un solo lugar, seguro y en tiempo real.
            </p>
          </div>

          {/* Features */}
          <div className="space-y-5 mb-12">
            {FEATURES.map(f => (
              <div key={f.title} className="flex items-start gap-4">
                <span className="text-2xl shrink-0">{f.emoji}</span>
                <div>
                  <p className="text-sm font-semibold text-white mb-0.5">{f.title}</p>
                  <p className="text-xs text-slate-400 leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Testimonial */}
          <div className="mt-auto bg-white/5 border border-white/10 rounded-2xl p-5">
            <p className="text-sm text-slate-300 italic leading-relaxed mb-4">
              "RS Back Office transformó la manera en que gestionamos nuestra contabilidad.
              Tenemos visibilidad total y nunca más perdemos una fecha tributaria."
            </p>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-primary-700 flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-primary-200">JR</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-white leading-tight">Jorge Rodríguez</p>
                <p className="text-xs text-slate-400 leading-tight">Constructora Bolívar S.A.S</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Panel derecho (formulario) ── */}
        <div className="flex-1 bg-white flex flex-col justify-center p-8 xl:p-12">
          {/* Logo mobile */}
          <div className="flex lg:hidden items-center gap-3 mb-8">
            <div className="w-9 h-9 rounded-xl bg-primary-600 flex items-center justify-center shrink-0">
              <span className="text-white font-bold text-sm">RS</span>
            </div>
            <div>
              <p className="font-semibold text-slate-900 text-sm leading-tight">RS Back Office</p>
              <p className="text-xs text-slate-400 leading-tight">Gestión empresarial</p>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-slate-900 mb-1">Iniciar sesión</h2>
          <p className="text-sm text-slate-400 mb-8">Ingrese a su portal empresarial</p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              label="Correo electrónico"
              type="email"
              placeholder="empresa@correo.com"
              error={errors.email?.message}
              {...register('email')}
            />
            <Input
              label="Contraseña"
              type="password"
              placeholder="••••••••"
              error={errors.password?.message}
              {...register('password')}
            />

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer">
                <input type="checkbox" className="rounded border-slate-300" />
                Recordarme
              </label>
              <Link to="/forgot-password" className="text-xs text-primary-600 hover:underline">
                ¿Olvidó su contraseña?
              </Link>
            </div>

            <Button type="submit" className="w-full" size="lg" loading={isSubmitting}>
              Ingresar al Portal →
            </Button>
          </form>

          {/* Registro */}
          <div className="mt-6 pt-6 border-t border-slate-100 text-center">
            <p className="text-sm text-slate-500 mb-2">¿Aún no tiene cuenta?</p>
            <Link
              to="/register"
              className="inline-flex items-center gap-1 text-sm font-semibold text-primary-600 hover:text-primary-700 transition-colors"
            >
              Registrar mi empresa →
            </Link>
          </div>

          <p className="text-center text-slate-300 text-xs mt-8">
            © {new Date().getFullYear()} RS Back Office · Todos los derechos reservados
          </p>
        </div>
      </div>
    </div>
  )
}
