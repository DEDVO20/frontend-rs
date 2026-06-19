import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { TopBar } from '@/components/layout/TopBar'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { PageLoader } from '@/components/ui/Spinner'
import { Button } from '@/components/ui/Button'
import { formatRelativeTime } from '@/lib/utils'

const ACTION_COLOR: Record<string, any> = {
  create: 'green', update: 'blue', delete: 'red', login: 'teal',
  logout: 'gray', upload: 'teal', send_campaign: 'blue',
}

export function AuditPage() {
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['audit', page],
    queryFn: async () => {
      const { data } = await api.get(`/api/audit?page=${page}&limit=30`)
      return data
    },
  })

  return (
    <div>
      <TopBar title="Auditoría" subtitle="Registro de acciones del sistema" />

      <div className="p-6">
        <Card>
          <CardHeader>
            <p className="text-sm font-medium text-slate-700">{data?.total ?? 0} eventos</p>
          </CardHeader>

          {isLoading ? <CardBody><PageLoader /></CardBody> : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Acción</th>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Recurso</th>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Usuario</th>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Cuándo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {data?.data?.map((log: any) => (
                      <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-3">
                          <Badge label={log.action} color={ACTION_COLOR[log.action] ?? 'gray'} />
                        </td>
                        <td className="px-6 py-3 text-slate-600">
                          <span className="font-medium">{log.resource}</span>
                          {log.resource_id && (
                            <span className="text-xs text-slate-400 ml-1.5 font-mono">
                              {log.resource_id.substring(0, 8)}…
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-3 text-slate-500 text-xs">
                          {log.user_email ?? log.user_id?.substring(0, 8) ?? '—'}
                        </td>
                        <td className="px-6 py-3 text-slate-400 text-xs">
                          {formatRelativeTime(log.created_at)}
                        </td>
                      </tr>
                    ))}
                    {!data?.data?.length && (
                      <tr>
                        <td colSpan={4} className="px-6 py-12 text-center text-slate-400">Sin registros</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {data && data.total > 30 && (
                <div className="px-6 py-3 border-t border-slate-100 flex items-center justify-between text-sm text-slate-500">
                  <span>Página {page} de {Math.ceil(data.total / 30)}</span>
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Anterior</Button>
                    <Button variant="secondary" size="sm" disabled={page >= Math.ceil(data.total / 30)} onClick={() => setPage(p => p + 1)}>Siguiente</Button>
                  </div>
                </div>
              )}
            </>
          )}
        </Card>
      </div>
    </div>
  )
}
