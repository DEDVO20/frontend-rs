import { useState } from 'react'
import { isAxiosError } from 'axios'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useEmailList } from '@/lib/useEmailList'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { EmailListInput } from '@/components/ui/EmailListInput'
import { toast } from 'sonner'
import { Mail, Save, AlertTriangle } from 'lucide-react'

type Provider = 'zavu' | 'resend'

type EmailSettings = {
  provider: Provider
  bcc: string[]
  resendConfigured: boolean
  canEdit: boolean
}

const PROVIDERS: { key: Provider; name: string; description: string }[] = [
  { key: 'zavu',   name: 'Zavu',   description: 'Proveedor actual. No permite copias ocultas.' },
  { key: 'resend', name: 'Resend', description: 'Permite enviar copias ocultas (CCO).' },
]

export function EmailSettingsCard() {
  const { data, isLoading, isError, error } = useQuery<EmailSettings>({
    queryKey: ['settings-email'],
    queryFn: async () => (await api.get('/api/settings/email')).data,
    retry: false,
  })

  // Sin permiso sobre el módulo de configuración: la tarjeta no se muestra
  if (isAxiosError(error) && error.response?.status === 403) return null

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center shrink-0">
            <Mail className="w-5 h-5 text-primary-500" />
          </div>
          <div>
            <p className="font-semibold text-slate-800 text-sm">Envío de correos</p>
            <p className="text-xs text-slate-400 mt-0.5">
              Proveedor con el que la plataforma envía los correos. SMS y WhatsApp no cambian.
            </p>
          </div>
        </div>
      </CardHeader>

      <CardBody className="space-y-5">
        {isLoading ? (
          <div className="py-6 flex justify-center"><Spinner /></div>
        ) : isError || !data ? (
          <p className="text-sm text-red-500">No se pudo cargar la configuración de correo.</p>
        ) : (
          // La key reinicia el formulario cuando llegan datos frescos del servidor
          <EmailSettingsForm key={`${data.provider}|${data.bcc.join(',')}`} data={data} />
        )}
      </CardBody>
    </Card>
  )
}

function EmailSettingsForm({ data }: { data: EmailSettings }) {
  const canEdit = data.canEdit
  const qc = useQueryClient()
  const [provider, setProvider] = useState<Provider>(data.provider)
  const bcc = useEmailList(data.bcc)

  const saveMut = useMutation({
    mutationFn: async (payload: { provider: Provider; bcc: string[] }) =>
      (await api.put('/api/settings/email', payload)).data,
    onSuccess: () => {
      toast.success('Configuración de correo actualizada')
      qc.invalidateQueries({ queryKey: ['settings-email'] })
    },
    onError: (e) => toast.error((isAxiosError(e) && e.response?.data?.error) || 'Error al guardar'),
  })

  function save() {
    // Incluye lo que quedó escrito sin confirmar con Enter
    const list = bcc.commit()
    if (!list) return
    saveMut.mutate({ provider, bcc: list })
  }

  const dirty = (
    provider !== data.provider ||
    bcc.list.join(',') !== data.bcc.join(',') ||
    bcc.input.trim() !== ''
  )

  return (
    <>
      <div>
        <p className="text-sm font-medium text-slate-700 mb-2">Proveedor</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="radiogroup" aria-label="Proveedor de correo">
          {PROVIDERS.map(p => {
            const unavailable = p.key === 'resend' && !data.resendConfigured
            const active = provider === p.key
            return (
              <button
                key={p.key}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={!canEdit || unavailable}
                onClick={() => setProvider(p.key)}
                className={cn(
                  'text-left p-4 rounded-xl border transition-all disabled:cursor-not-allowed',
                  active
                    ? 'border-primary-500 bg-primary-50 ring-1 ring-primary-500'
                    : 'border-slate-200 bg-white hover:border-primary-300 disabled:opacity-60 disabled:hover:border-slate-200',
                )}
              >
                <div className="flex items-center gap-2">
                  <span className={cn(
                    'w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0',
                    active ? 'border-primary-600' : 'border-slate-300',
                  )}>
                    {active && <span className="w-2 h-2 rounded-full bg-primary-600" />}
                  </span>
                  <span className="font-semibold text-slate-800 text-sm">{p.name}</span>
                </div>
                <p className="text-xs text-slate-500 mt-1.5 ml-6">{p.description}</p>
              </button>
            )
          })}
        </div>

        {!data.resendConfigured && (
          <p className="flex items-start gap-1.5 text-xs text-amber-600 mt-2">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            Resend no está disponible: faltan RESEND_API_KEY y RESEND_FROM en el servidor.
          </p>
        )}
      </div>

      <div>
        <label htmlFor="email-bcc" className="text-sm font-medium text-slate-700">
          Copias ocultas (CCO)
        </label>
        <div className="mt-1">
          <EmailListInput
            id="email-bcc"
            state={bcc}
            disabled={!canEdit}
            placeholder="copias@tudominio.com"
            hint="Reciben una copia oculta de todos los correos que envía la plataforma. Escribe un correo y presiona Enter."
          />
        </div>
        {provider === 'zavu' && bcc.list.length > 0 && (
          <p className="flex items-start gap-1.5 text-xs text-amber-600 mt-2">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            Con Zavu las copias ocultas no se envían. Se guardan y se aplican al cambiar a Resend.
          </p>
        )}
      </div>

      {canEdit && (
        <div className="flex justify-end">
          <Button onClick={save} loading={saveMut.isPending} disabled={!dirty}>
            {!saveMut.isPending && <Save className="w-4 h-4" />}
            Guardar cambios
          </Button>
        </div>
      )}
    </>
  )
}
