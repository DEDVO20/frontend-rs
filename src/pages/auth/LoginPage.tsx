import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate, Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Loader2, X } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { FintoLogo } from '@/components/ui/FintoLogo'
import mockupHero from '@/assets/finto/images/mockup-hero.webp'

const schema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
})

type Form = z.infer<typeof schema>

export function LoginPage() {
  const { login } = useAuthStore()
  const navigate = useNavigate()

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
    <div className="min-h-screen bg-cream-100 flex items-center justify-center p-4 md:p-8">
      <div className="relative w-full max-w-5xl overflow-hidden rounded-[2rem] shadow-2xl shadow-navy-900/25
                      bg-gradient-to-br from-navy-900 via-brand-800 to-brand-600">
        {/* Cerrar */}
        <Link to="/" aria-label="Cerrar"
          className="absolute top-5 right-5 z-10 text-brand-200 hover:text-cream-100 transition-colors">
          <X className="w-6 h-6" />
        </Link>

        <div className="flex flex-col lg:flex-row">

          {/* ── Panel izquierdo (marca) ── */}
          <div className="lg:w-[52%] p-8 md:p-12 flex flex-col">
            <FintoLogo variant="white" height={34} className="mb-8 self-start" />

            <h2 className="font-display text-3xl md:text-4xl xl:text-5xl font-bold text-cream-100 leading-[1.1] mb-6">
              Bienvenido a<br />tu portal
            </h2>

            <img src={mockupHero} alt="Portal Finto en un portátil"
              className="hidden lg:block w-full max-w-sm mx-auto drop-shadow-2xl mb-6" />

            <p className="text-cream-100/70 text-sm leading-relaxed max-w-sm mx-auto text-center">
              Toda la información financiera de tu empresa, organizada en un solo lugar.
            </p>
          </div>

          {/* ── Panel derecho (formulario) ── */}
          <div className="lg:w-[48%] p-8 md:p-12 lg:border-l border-white/10 flex flex-col justify-center">
            <h1 className="font-display text-2xl md:text-3xl font-bold text-cream-100 mb-8">
              Iniciar sesión
            </h1>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-brand-200 mb-2">
                  Correo electrónico
                </label>
                <input
                  type="email"
                  placeholder="empresa@correo.com"
                  autoComplete="email"
                  className="w-full px-4 py-3 rounded-xl bg-white/10 text-cream-100 placeholder:text-cream-100/40
                             ring-1 ring-white/15 focus:outline-none focus:ring-2 focus:ring-brand-300 transition"
                  {...register('email')}
                />
                {errors.email && <p className="text-xs text-red-300 mt-1.5">{errors.email.message}</p>}
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-brand-200 mb-2">
                  Contraseña
                </label>
                <input
                  type="password"
                  placeholder="••••••••••••"
                  autoComplete="current-password"
                  className="w-full px-4 py-3 rounded-xl bg-white/10 text-cream-100 placeholder:text-cream-100/40
                             ring-1 ring-white/15 focus:outline-none focus:ring-2 focus:ring-brand-300 transition"
                  {...register('password')}
                />
                {errors.password && <p className="text-xs text-red-300 mt-1.5">{errors.password.message}</p>}
              </div>

              <div className="space-y-3 pt-1">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-full font-display font-bold text-base
                             bg-navy-950 text-cream-100 hover:bg-navy-900 ring-1 ring-white/10
                             disabled:opacity-60 transition-colors"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Ingresar
                </button>

                <Link
                  to="/register"
                  className="w-full flex items-center justify-center py-3.5 rounded-full font-display font-bold text-base
                             bg-brand-500 text-cream-100 hover:bg-brand-400 transition-colors"
                >
                  Registrarme
                </Link>
              </div>

              <div className="text-center">
                <Link to="/forgot-password" className="text-xs text-cream-100/50 hover:text-cream-100/80 transition-colors">
                  ¿Olvidó su contraseña?
                </Link>
              </div>
            </form>

            <p className="text-center text-sm text-cream-100/60 mt-6 leading-relaxed">
              ¿Aún no tiene cuenta?<br />
              <span className="text-cream-100/80">Regístrate y obtén grandes beneficios.</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
