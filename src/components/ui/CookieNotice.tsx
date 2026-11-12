import { useState } from 'react'
import { Cookie } from 'lucide-react'
import { router } from '@/router'

// Aviso informativo: Finto solo usa cookies y almacenamiento local estrictamente
// necesarios o funcionales (sesión, tema), por lo que no se requiere un
// consentimiento previo con opción de rechazo. Si se agregan cookies de
// analítica o marketing, este componente debe pasar a pedir consentimiento.
const STORAGE_KEY = 'finto-cookie-notice'
const NOTICE_VERSION = '1'

function wasDismissed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === NOTICE_VERSION
  } catch {
    return false
  }
}

export function CookieNotice() {
  const [visible, setVisible] = useState(() => !wasDismissed())

  if (!visible) return null

  const dismiss = () => {
    try { localStorage.setItem(STORAGE_KEY, NOTICE_VERSION) } catch { /* modo privado */ }
    setVisible(false)
  }

  const openPolicy = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    void router.navigate('/politica-cookies')
  }

  return (
    <div
      role="region"
      aria-label="Aviso de cookies"
      className="fixed inset-x-0 bottom-0 z-50 p-4 sm:p-5 pointer-events-none"
    >
      <div className="pointer-events-auto max-w-3xl mx-auto bg-white dark:bg-navy-900 border border-sand-300/70 dark:border-white/10 shadow-xl rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-start gap-3 flex-1">
          <Cookie className="w-5 h-5 shrink-0 mt-0.5 text-brand-600" aria-hidden="true" />
          <p className="text-sm text-navy-900/80 dark:text-cream-100/80 leading-relaxed">
            Usamos cookies y almacenamiento local estrictamente necesarios para mantener tu sesión
            segura y recordar tus preferencias. No usamos cookies publicitarias ni de rastreo.{' '}
            <a
              href="/politica-cookies"
              onClick={openPolicy}
              className="font-semibold text-brand-600 hover:text-brand-700 underline underline-offset-2"
            >
              Política de cookies
            </a>
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="self-end sm:self-auto shrink-0 text-sm font-semibold bg-brand-600 hover:bg-brand-700 text-white px-5 py-2 rounded-full transition-colors"
        >
          Entendido
        </button>
      </div>
    </div>
  )
}
