import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { useState } from 'react'
import { api } from '@/lib/api'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { CheckCircle2 } from 'lucide-react'

const schema = z.object({ email: z.string().email('Email inválido') })
type Form = z.infer<typeof schema>

export function ForgotPasswordPage() {
  const [sent, setSent] = useState(false)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: Form) => {
    try {
      await api.post('/auth/forgot-password', data)
      setSent(true)
    } catch {
      toast.error('Ocurrió un error. Intenta de nuevo.')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-primary-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary-500 mb-4">
            <span className="text-white font-bold text-xl">RS</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Recuperar contraseña</h1>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {sent ? (
            <div className="text-center py-4">
              <CheckCircle2 className="w-12 h-12 text-primary-500 mx-auto mb-4" />
              <h3 className="font-semibold text-slate-900 mb-2">Revisa tu correo</h3>
              <p className="text-sm text-slate-500">Si el email está registrado, recibirás instrucciones para restablecer tu contraseña.</p>
              <Link to="/login" className="mt-6 inline-block text-sm text-primary-600 hover:underline">
                Volver al inicio de sesión
              </Link>
            </div>
          ) : (
            <>
              <p className="text-sm text-slate-500 mb-6">Ingresa tu correo y te enviaremos un enlace para restablecer tu contraseña.</p>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <Input label="Correo electrónico" type="email" placeholder="tu@empresa.com" error={errors.email?.message} {...register('email')} />
                <Button type="submit" className="w-full" size="lg" loading={isSubmitting}>
                  Enviar enlace
                </Button>
              </form>
              <div className="text-center mt-4">
                <Link to="/login" className="text-sm text-slate-500 hover:text-slate-700">← Volver</Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
