import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

import { Button } from '@/components/ui/Button'
import { PageLoader } from '@/components/ui/Spinner'

import { toast } from 'sonner'
import { X, CheckCircle2, RotateCcw } from 'lucide-react'
import { fmtMoney } from './format'

export function ManualPaymentModal({
  data: initialData,
  onClose,
}: {
  data: { comprobante: string; clientNit?: string; clientName?: string; amount: number; fvRef?: string }
  onClose: () => void
}) {
  const qc = useQueryClient()
  const clientNit = initialData.clientNit || ''
  const [comprobante, setComprobante] = useState(initialData.comprobante || '')
  const [totalAmount, setTotalAmount] = useState<number>(Number(initialData.amount ?? 0))

  const [allocations, setAllocations] = useState<Record<string, number>>({})

  const { data: openInvoices, isLoading } = useQuery({
    queryKey: ['participations', 'client-pending-invoices', clientNit],
    enabled: !!clientNit,
    queryFn: async () => {
      const { data } = await api.get(`/api/participations/client-pending-invoices?nit=${encodeURIComponent(clientNit)}`)
      return (data ?? []) as any[]
    },
  })

  // Consultar recibos no cruzados del cliente por si necesita seleccionar uno o cambiar
  const { data: uncrossedReceipts } = useQuery({
    queryKey: ['participations', 'client-uncrossed-receipts', clientNit],
    enabled: !!clientNit,
    queryFn: async () => {
      const { data } = await api.get(`/api/participations/client-uncrossed-receipts?nit=${encodeURIComponent(clientNit)}`)
      return (data ?? []) as any[]
    },
  })

  // Pre-llenar totalAmount y comprobante si vinieron vacíos
  useEffect(() => {
    if (totalAmount <= 0 && uncrossedReceipts && uncrossedReceipts.length > 0) {
      if (comprobante) {
        const cNorm = String(comprobante).toLowerCase().replace(/[^a-z0-9]/g, '')
        const found = uncrossedReceipts.find((r: any) =>
          String(r.comprobante ?? '').toLowerCase().replace(/[^a-z0-9]/g, '') === cNorm
        )
        if (found) {
          setTotalAmount(Number(found.saldo ?? found.amount ?? 0))
          return
        }
      }
      if (!comprobante && uncrossedReceipts[0]) {
        setComprobante(uncrossedReceipts[0].comprobante)
        setTotalAmount(Number(uncrossedReceipts[0].saldo ?? uncrossedReceipts[0].amount ?? 0))
      }
    }
  }, [uncrossedReceipts, comprobante, totalAmount])

  const roundMoney = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

  // Autollenar con orden FIFO (factura más antigua primero)
  const autoFillFifo = () => {
    if (!openInvoices?.length) return
    let remaining = totalAmount
    const newAlloc: Record<string, number> = {}

    const sorted = [...openInvoices].sort((a, b) =>
      String(a.finto_invoice_date ?? a.period ?? '').localeCompare(String(b.finto_invoice_date ?? b.period ?? ''))
    )

    for (const inv of sorted) {
      if (remaining <= 0.01) break
      const bal = Number(inv.balance ?? 0)
      if (bal <= 0) continue
      const toApply = roundMoney(Math.min(remaining, bal))
      newAlloc[inv.id] = toApply
      remaining = roundMoney(remaining - toApply)
    }

    setAllocations(newAlloc)
  }

  // Pre-llenar automáticamente al cargar las facturas
  useEffect(() => {
    if (openInvoices && openInvoices.length > 0 && Object.keys(allocations).length === 0 && totalAmount > 0) {
      autoFillFifo()
    }
  }, [openInvoices, totalAmount])

  const currentTotal = roundMoney(Object.values(allocations).reduce((a, b) => a + (Number(b) || 0), 0))
  const remainingTotal = roundMoney(Math.max(0, totalAmount - currentTotal))
  const isOverAllocated = currentTotal > totalAmount + 0.01

  const applyMutation = useMutation({
    mutationFn: async () => {
      const allocList = Object.entries(allocations)
        .filter(([_, val]) => val > 0)
        .map(([invoice_id, amount]) => ({ invoice_id, amount }))

      const { data } = await api.post('/api/participations/apply-manual-payment', {
        comprobante,
        client_nit: clientNit,
        allocations: allocList,
      })
      return data
    },
    onSuccess: (res: any) => {
      toast.success(`Recaudo aplicado correctamente a ${res.invoices?.length ?? 0} factura(s)`)
      qc.invalidateQueries({ queryKey: ['participations'] })
      onClose()
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error ?? 'Error al aplicar el recaudo')
    },
  })

  const setInvoiceAmount = (id: string, val: number) => {
    setAllocations(prev => {
      const copy = { ...prev }
      if (val <= 0) delete copy[id]
      else copy[id] = roundMoney(val)
      return copy
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-700">RC</span>
              <h3 className="text-base font-bold text-slate-900">Aplicación Manual de Recaudo</h3>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Comprobante <b>{comprobante || 'Sin definir'}</b> · Cliente: <b>{initialData.clientName || clientNit || '—'}</b> (NIT: {clientNit || '—'})
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto scrollbar-slim px-6 py-5 space-y-4">
          {/* Selector de comprobante y monto si se desea ajustar */}
          <div className="flex flex-wrap items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
            <div className="flex-1 min-w-[220px]">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Comprobante de Recaudo (RC)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={comprobante}
                  onChange={e => setComprobante(e.target.value)}
                  placeholder="ej: RC-1-53"
                  className="w-full text-xs font-semibold px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-primary-500"
                />
                {uncrossedReceipts && uncrossedReceipts.length > 0 && (
                  <select
                    value=""
                    onChange={e => {
                      const sel = uncrossedReceipts.find((r: any) => r.comprobante === e.target.value)
                      if (sel) {
                        setComprobante(sel.comprobante)
                        setTotalAmount(Number(sel.saldo ?? sel.amount ?? 0))
                        setAllocations({})
                      }
                    }}
                    className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-600 focus:outline-none"
                  >
                    <option value="">Elegir de SIIGO…</option>
                    {uncrossedReceipts.map((r: any) => (
                      <option key={r.id} value={r.comprobante}>
                        {r.comprobante} · {fmtMoney(Number(r.saldo ?? r.amount ?? 0))}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
            <div className="w-36">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Monto del Pago ($)
              </label>
              <input
                type="number"
                step="any"
                value={totalAmount || ''}
                onChange={e => {
                  setTotalAmount(Number(e.target.value) || 0)
                  setAllocations({})
                }}
                placeholder="0"
                className="w-full text-xs font-semibold px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          {/* Card de resumen del monto */}
          <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Recibo</p>
              <p className="text-sm font-bold text-slate-800">{fmtMoney(totalAmount)}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Asignado</p>
              <p className={`text-sm font-bold ${isOverAllocated ? 'text-rose-600' : 'text-emerald-600'}`}>
                {fmtMoney(currentTotal)}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Por Asignar</p>
              <p className="text-sm font-bold text-slate-600">{fmtMoney(remainingTotal)}</p>
            </div>
          </div>

          {/* Acciones de llenado rápido */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700">Facturas Pendientes del Cliente (FIFO):</span>
            <Button size="sm" variant="secondary" onClick={autoFillFifo} disabled={isLoading || !openInvoices?.length}>
              <RotateCcw className="w-3 h-3" /> Autollenar FIFO (Más antigua primero)
            </Button>
          </div>

          {isLoading ? (
            <div className="py-12 text-center text-slate-400"><PageLoader /></div>
          ) : !openInvoices?.length ? (
            <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-100">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700">Sin facturas pendientes con saldo</p>
              <p className="text-xs text-slate-400">Todas las facturas de este cliente se encuentran completamente pagadas o no hay facturas configuradas para este NIT.</p>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                  <tr>
                    <th className="px-3 py-2 text-left">Factura</th>
                    <th className="px-3 py-2 text-left">Fecha / Mes</th>
                    <th className="px-3 py-2 text-right">Valor Total</th>
                    <th className="px-3 py-2 text-right">Recaudado</th>
                    <th className="px-3 py-2 text-right">Saldo Pend.</th>
                    <th className="px-3 py-2 text-right w-36">Abonar ($)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {openInvoices.map((inv: any) => {
                    const allocatedVal = allocations[inv.id] || 0
                    return (
                      <tr key={inv.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-3 py-2 font-mono font-medium text-slate-800 whitespace-nowrap">
                          {inv.finto_invoice || '—'}
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-500 whitespace-nowrap">
                          {inv.finto_invoice_date || inv.period || '—'}
                        </td>
                        <td className="px-3 py-2 text-right text-slate-600 whitespace-nowrap">
                          {fmtMoney(inv.finto_invoice_value)}
                        </td>
                        <td className="px-3 py-2 text-right text-emerald-600 whitespace-nowrap">
                          {fmtMoney(inv.collected)}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-slate-800 whitespace-nowrap">
                          {fmtMoney(inv.balance)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <input
                              type="number"
                              min="0"
                              max={inv.balance}
                              step="any"
                              value={allocatedVal || ''}
                              onChange={e => setInvoiceAmount(inv.id, Number(e.target.value) || 0)}
                              placeholder="0"
                              className="w-24 text-right text-xs font-semibold px-2 py-1 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                            />
                            <button
                              type="button"
                              onClick={() => setInvoiceAmount(inv.id, inv.balance)}
                              title="Asignar saldo completo"
                              className="text-[10px] font-bold text-primary-600 hover:text-primary-700 px-1.5 py-0.5 rounded bg-primary-50 hover:bg-primary-100"
                            >
                              Max
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {isOverAllocated && (
            <p className="text-xs text-rose-600 font-medium">
              ⚠️ El valor asignado ({fmtMoney(currentTotal)}) supera el monto disponible del recibo ({fmtMoney(totalAmount)}).
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-100 shrink-0 bg-slate-50 rounded-b-2xl">
          <Button variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
          <Button
            size="sm"
            loading={applyMutation.isPending}
            disabled={currentTotal <= 0 || isOverAllocated}
            onClick={() => applyMutation.mutate()}
          >
            Confirmar y Aplicar Recaudo
          </Button>
        </div>
      </div>
    </div>
  )
}
