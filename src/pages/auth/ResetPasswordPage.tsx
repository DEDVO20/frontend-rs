import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
const BASE = import.meta.env.VITE_API_URL || ''
import { Button } from '@/components/ui/Button'
import { CheckCircle2, AlertCircle, Lock, Eye, EyeOff } from 'lucide-react'

export function ResetPasswordPage() {
  const nav = useNavigate()
  const [status, setStatus] = useState<'form' | 'success' | 'error' | 'invalid'>('form')
  const [password, setPassword] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [accessToken, setAccessToken] = useState('')

  useEffect(() => {
    // Supabase puts tokens in the URL hash: #access_token=xxx&type=recovery
    const hash = window.location.hash.substring(1)
    const params = new URLSearchParams(hash)
    const token = params.get('access_token')
    const type = params.get('type')

    // Check query param ?token=xxx (Zavu flow)
    const query = new URLSearchParams(window.location.search)
    const qToken = query.get('token') ?? query.get('access_token')

    if (qToken) {
      setAccessToken(qToken)
    } else if (token && type === 'recovery') {
      // Supabase hash fragment flow (legacy)
      setAccessToken(token)
    } else {
      setStatus('invalid')
    }
  }, [])

  const pwValid = password.length >= 8
  const pwMatch = password === confirmPw
  const canSubmit = pwValid && pwMatch && !submitting && accessToken

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    setErrorMsg('')
    try {
      await axios.post(`${BASE}/auth/reset-password`, {
        access_token: accessToken,
        password,
      })
      setStatus('success')
    } catch (e: any) {
      setErrorMsg(e.response?.data?.error ?? 'Error al restablecer la contraseña')
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
            <span className="text-white font-bold text-lg">RS</span>
          </div>
          <p className="text-sm text-slate-400">RS Back Office</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">

          {/* Invalid token */}
          {status === 'invalid' && (
            <div className="p-8 text-center">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-3">
                <AlertCircle className="w-6 h-6 text-red-500" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">Enlace inválido</h2>
              <p className="text-sm text-slate-500 mt-2">
                Este enlace de recuperación ha expirado o ya fue utilizado.
              </p>
              <Button className="mt-6" onClick={() => nav('/forgot-password')}>
                Solicitar nuevo enlace
              </Button>
            </div>
          )}

          {/* Success */}
          {status === 'success' && (
            <div className="p-8 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">Contraseña actualizada</h2>
              <p className="text-sm text-slate-500 mt-2">
                Tu contraseña ha sido restablecida exitosamente. Ya puedes iniciar sesión.
              </p>
              <Button className="mt-6 w-full" onClick={() => nav('/login')}>
                Iniciar sesión →
              </Button>
            </div>
          )}

          {/* Form */}
          {(status === 'form' || status === 'error') && accessToken && (
            <div>
              <div className="px-6 pt-6 pb-4">
                <h2 className="text-lg font-bold text-slate-900">Restablecer contraseña</h2>
                <p className="text-sm text-slate-400 mt-1">Ingresa tu nueva contraseña</p>
              </div>

              <div className="px-6 pb-6 space-y-4">

                {/* Password */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Nueva contraseña *</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Mínimo 8 caracteres"
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
                  {password && !pwValid && (
                    <p className="text-xs text-red-500 mt-1">La contraseña debe tener al menos 8 caracteres</p>
                  )}
                </div>

                {/* Confirm */}
                <div>
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
                </div>

                {/* Error */}
                {errorMsg && (
                  <div className="flex items-start gap-2 p-3 bg-red-50 rounded-lg">
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-red-600">{errorMsg}</p>
                  </div>
                )}

                <Button
                  className="w-full"
                  size="lg"
                  onClick={handleSubmit}
                  loading={submitting}
                  disabled={!canSubmit}
                >
                  Restablecer contraseña →
                </Button>
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          © {new Date().getFullYear()} RS Back Office · Todos los derechos reservados
        </p>
      </div>
    </div>
  )
}
