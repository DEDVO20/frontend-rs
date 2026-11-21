import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import axios, { isAxiosError } from 'axios'
const BASE = import.meta.env.VITE_API_URL || ''
import { Button } from '@/components/ui/Button'
import { CheckCircle2, AlertCircle, Eye, EyeOff, Lock } from 'lucide-react'

export function AcceptInvitationPage() {
  const [params] = useSearchParams()
  const nav = useNavigate()
  const token = params.get('token') ?? ''

  const [status, setStatus] = useState<'loading' | 'valid' | 'invalid' | 'success' | 'error'>('loading')
  const [invite, setInvite] = useState<{
    email: string; companyName: string; fullName: string; requiresLogin: boolean
  } | null>(null)
  const [password, setPassword] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!token) { setStatus('invalid'); return }
    axios.get(`${BASE}/auth/invitations/verify?token=${token}`)
      .then(({ data }) => {
        if (data.valid) {
          setInvite({
            email: data.email, companyName: data.companyName,
            fullName: data.fullName ?? '', requiresLogin: data.requiresLogin === true,
          })
          setStatus('valid')
        } else {
          setStatus('invalid')
        }
      })
      .catch(() => setStatus('invalid'))
  }, [token])

  const pwMatch = password === confirmPw
  const pwValid = password.length >= 6
  const canSubmit = pwValid && (invite?.requiresLogin || pwMatch) && !submitting

  const handleSubmit = async () => {
    if (!canSubmit || !invite) return
    setSubmitting(true)
    setErrorMsg('')
    try {
      if (invite.requiresLogin) {
        // Verifica la identidad aunque el perfil de la plataforma esté inactivo.
        await axios.post(`${BASE}/auth/login`, { email: invite.email, password }, { withCredentials: true })
      }
      await axios.post(`${BASE}/auth/invitations/accept`, {
        token,
        email: invite.email,
        ...(invite.requiresLogin ? {} : { password }),
        fullName: invite.fullName,
      }, { withCredentials: true })
      setStatus('success')
    } catch (error) {
      if (isAxiosError(error) && error.response?.data?.code === 'INVITATION_LOGIN_REQUIRED') {
        setInvite({ ...invite, requiresLogin: true })
        setPassword('')
      }
      const message = isAxiosError(error) ? error.response?.data?.error : undefined
      setErrorMsg(message ?? 'Error al aceptar la invitación')
      setStatus('error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-primary-500 flex items-center justify-center mx-auto mb-3">
            <span className="text-white font-bold text-lg">F</span>
          </div>
          <p className="text-sm text-slate-400">Finto</p>
          <p className="text-xs text-slate-400">Gestión empresarial</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">

          {/* Loading */}
          {status === 'loading' && (
            <div className="p-8 text-center">
              <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-slate-500">Verificando invitación…</p>
            </div>
          )}

          {/* Invalid */}
          {status === 'invalid' && (
            <div className="p-8 text-center">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-3">
                <AlertCircle className="w-6 h-6 text-red-500" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">Invitación inválida</h2>
              <p className="text-sm text-slate-500 mt-2">
                Esta invitación ha expirado o ya fue utilizada.
              </p>
              <Button className="mt-6" onClick={() => nav('/login')}>
                Ir a iniciar sesión
              </Button>
            </div>
          )}

          {/* Success */}
          {status === 'success' && (
            <div className="p-8 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">{invite?.requiresLogin ? 'Invitación aceptada' : '¡Cuenta creada!'}</h2>
              <p className="text-sm text-slate-500 mt-2">
                Tu cuenta ha sido configurada exitosamente. Ya puedes iniciar sesión.
              </p>
              <Button className="mt-6 w-full" onClick={() => nav('/login')}>
                Iniciar sesión →
              </Button>
            </div>
          )}

          {/* Form */}
          {(status === 'valid' || status === 'error') && invite && (
            <div>
              <div className="px-6 pt-6 pb-4">
              <h2 className="text-lg font-bold text-slate-900">{invite.requiresLogin ? 'Vincula tu cuenta' : 'Crear tu cuenta'}</h2>
                <p className="text-sm text-slate-400 mt-1">
                  Has sido invitado a unirte a <strong className="text-slate-700">{invite.companyName || 'Finto'}</strong>
                </p>
              {invite.requiresLogin && <p className="text-sm text-slate-600 mt-2">Ingresa la contraseña de tu cuenta para aceptar la invitación.</p>}
              </div>

              <div className="px-6 pb-6 space-y-4">

                {/* Email (read-only) */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Correo electrónico</label>
                  <div className="w-full text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-slate-500">
                    {invite.email}
                  </div>
                </div>

                {/* Full name (read-only) */}
                {invite.fullName && (
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Nombre</label>
                    <div className="w-full text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-slate-500">
                      {invite.fullName}
                    </div>
                  </div>
                )}

                {/* Password */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Contraseña *</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder={invite.requiresLogin ? 'Tu contraseña actual' : 'Mínimo 6 caracteres'}
                      autoComplete={invite.requiresLogin ? 'current-password' : 'new-password'}
                      className="w-full pl-10 pr-10 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(!showPw)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {!invite.requiresLogin && password && !pwValid && (
                    <p className="text-xs text-red-500 mt-1">La contraseña debe tener al menos 6 caracteres</p>
                  )}
                </div>

                {/* Confirm password */}
                {!invite.requiresLogin && <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Confirmar contraseña *</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={confirmPw}
                      onChange={e => setConfirmPw(e.target.value)}
                      placeholder="Repite tu contraseña"
                      className="w-full pl-10 pr-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  {confirmPw && !pwMatch && (
                    <p className="text-xs text-red-500 mt-1">Las contraseñas no coinciden</p>
                  )}
                </div>}

                {/* Error */}
                {errorMsg && (
                  <div className="flex items-start gap-2 p-3 bg-red-50 rounded-lg">
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-red-600">{errorMsg}</p>
                  </div>
                )}

                {/* Submit */}
                <Button
                  className="w-full"
                  size="lg"
                  onClick={handleSubmit}
                  loading={submitting}
                  disabled={!canSubmit}
                >
                  {invite.requiresLogin ? 'Iniciar sesión y aceptar →' : 'Crear mi cuenta →'}
                </Button>
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          © {new Date().getFullYear()} Finto · Todos los derechos reservados
        </p>
      </div>
    </div>
  )
}
