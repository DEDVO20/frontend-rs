import { useState, createContext, useContext, useCallback } from 'react'
import { Button } from './Button'
import { AlertTriangle, Trash2, CheckCircle2 } from 'lucide-react'

type ConfirmType = 'danger' | 'warning' | 'info'

interface ConfirmOptions {
  title: string
  description?: string
  type?: ConfirmType
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void | Promise<void>
}

const ICONS: Record<ConfirmType, { icon: any; bg: string; color: string }> = {
  danger:  { icon: Trash2,         bg: 'bg-red-100',    color: 'text-red-600' },
  warning: { icon: AlertTriangle,  bg: 'bg-amber-100',  color: 'text-amber-600' },
  info:    { icon: CheckCircle2,   bg: 'bg-primary-100', color: 'text-primary-600' },
}

const CTX = createContext<(opts: ConfirmOptions) => void>(() => {})

export const useConfirm = () => useContext(CTX)

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null)
  const [loading, setLoading] = useState(false)

  const confirm = useCallback((o: ConfirmOptions) => setOpts(o), [])

  const handleConfirm = async () => {
    setLoading(true)
    try {
      await opts?.onConfirm()
    } finally {
      setLoading(false)
      setOpts(null)
    }
  }

  const type = opts?.type ?? 'danger'
  const { icon: Icon, bg, color } = ICONS[type]

  return (
    <CTX.Provider value={confirm}>
      {children}

      {opts && (
        <>
          <div className="fixed inset-0 bg-black/30 z-[60] backdrop-blur-sm" onClick={() => !loading && setOpts(null)} />
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">

              <div className="p-6 text-center">
                <div className={`w-14 h-14 rounded-2xl ${bg} flex items-center justify-center mx-auto mb-4`}>
                  <Icon className={`w-7 h-7 ${color}`} />
                </div>
                <h3 className="text-lg font-bold text-slate-900">{opts.title}</h3>
                {opts.description && (
                  <p className="text-sm text-slate-500 mt-2">{opts.description}</p>
                )}
              </div>

              <div className="flex gap-3 px-6 pb-6">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={() => setOpts(null)}
                  disabled={loading}
                >
                  {opts.cancelLabel ?? 'Cancelar'}
                </Button>
                <button
                  onClick={handleConfirm}
                  disabled={loading}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-60 ${
                    type === 'danger'  ? 'bg-red-500 hover:bg-red-600' :
                    type === 'warning' ? 'bg-amber-500 hover:bg-amber-600' :
                    'bg-primary-600 hover:bg-primary-700'
                  }`}
                >
                  {loading ? 'Procesando...' : opts.confirmLabel ?? 'Confirmar'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </CTX.Provider>
  )
}
