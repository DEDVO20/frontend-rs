import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

import { Button } from '@/components/ui/Button'
import { PageLoader } from '@/components/ui/Spinner'

import { toast } from 'sonner'
import { X, ArrowLeftRight, Plus, Layers } from 'lucide-react'
import { fmtMoney } from './format'

export function ReallocatePaymentModal({
  fromInvoice,
  clientNit,
  clientName,
  onClose,
  onSuccess,
}: {
  fromInvoice: any
  clientNit: string
  clientName: string
  onClose: () => void
  onSuccess: (res: any) => void
}) {
  const qc = useQueryClient()
  const fromColl = Number(fromInvoice.collected ?? 0)
  const receipts = String(fromInvoice.cash_receipts ?? '').split(',').map(s => s.trim()).filter(Boolean)
  const [selectedReceipt, setSelectedReceipt] = useState(receipts[0] ?? '')
  const [targetInvoiceId, setTargetInvoiceId] = useState<string>('')
  const [transferAmount, setTransferAmount] = useState<number>(fromColl)

  const { data: openInvoices, isLoading } = useQuery({
    queryKey: ['participations', 'client-pending-invoices', clientNit],
    enabled: !!clientNit,
    queryFn: async () => {
      const { data } = await api.get(`/api/participations/client-pending-invoices?nit=${encodeURIComponent(clientNit)}`)
      return (data ?? []) as any[]
    },
  })

  const otherInvoices = (openInvoices ?? []).filter(inv => inv.id !== fromInvoice.id)
  const targetInvoice = otherInvoices.find(i => i.id === targetInvoiceId)

  useEffect(() => {
    if (otherInvoices.length > 0 && !targetInvoiceId) {
      setTargetInvoiceId(otherInvoices[0].id)
      const bal = Number(otherInvoices[0].balance ?? 0)
      if (bal > 0) {
        setTransferAmount(Math.min(fromColl, bal))
      }
    }
  }, [otherInvoices])

  const reallocateMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/api/participations/reallocate-payment', {
        from_invoice_id: fromInvoice.id,
        to_invoice_id:   targetInvoiceId,
        amount:          Number(transferAmount),
        comprobante:     selectedReceipt || undefined,
      })
      return data
    },
    onSuccess: (res: any) => {
      toast.success(`Pago reasignado correctamente a ${res.to_invoice || 'la factura de destino'}`)
      qc.invalidateQueries({ queryKey: ['participations'] })
      onSuccess(res)
      onClose()
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error ?? 'Error al reasignar el pago')
    },
  })

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-xs" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-blue-600 font-bold">
            <ArrowLeftRight className="w-5 h-5" />
            <h3 className="text-base text-slate-900">Reasignar Recaudo a Otra Factura</h3>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4" /></button>
        </div>

        <p className="text-xs text-slate-500">
          Mueve el pago aplicado erróneamente en esta factura a otra factura del cliente <b>{clientName || clientNit}</b>.
        </p>

        {/* Origen */}
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-400 font-medium">Factura origen:</span>
            <span className="font-bold text-slate-800 font-mono">{fromInvoice.finto_invoice || fromInvoice.purchase_order} ({fromInvoice.period ?? '—'})</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400 font-medium">Recaudado actual en origen:</span>
            <span className="font-bold text-emerald-600">{fmtMoney(fromColl)}</span>
          </div>
        </div>

        {/* Destino */}
        <div className="space-y-3 text-xs">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">Factura destino del cliente:</label>
            {isLoading ? (
              <div className="py-4 text-center text-slate-400"><PageLoader /></div>
            ) : otherInvoices.length === 0 ? (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-xs">
                No hay otras facturas con saldo pendiente para este cliente.
              </div>
            ) : (
              <select
                value={targetInvoiceId}
                onChange={e => {
                  setTargetInvoiceId(e.target.value)
                  const chosen = otherInvoices.find(i => i.id === e.target.value)
                  if (chosen) setTransferAmount(Math.min(fromColl, Number(chosen.balance ?? fromColl)))
                }}
                className="w-full text-xs font-semibold px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500"
              >
                {otherInvoices.map(inv => (
                  <option key={inv.id} value={inv.id}>
                    {inv.finto_invoice || inv.purchase_order} — {inv.finto_invoice_date || inv.period} — Saldo: {fmtMoney(inv.balance)}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Comprobante (RC):</label>
              <input
                type="text"
                value={selectedReceipt}
                onChange={e => setSelectedReceipt(e.target.value)}
                placeholder="ej: RC-1-53"
                className="w-full text-xs font-semibold px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Monto a transferir ($):</label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="0.01"
                  max={fromColl}
                  step="any"
                  value={transferAmount || ''}
                  onChange={e => setTransferAmount(Number(e.target.value) || 0)}
                  placeholder="0"
                  className="w-full text-xs font-semibold px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500"
                />
                <button
                  type="button"
                  onClick={() => setTransferAmount(targetInvoice ? Math.min(fromColl, Number(targetInvoice.balance ?? fromColl)) : fromColl)}
                  className="text-[10px] font-bold text-primary-600 bg-primary-50 hover:bg-primary-100 px-2 py-2 rounded-lg"
                >
                  Max
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <Button variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
          <Button
            size="sm"
            loading={reallocateMutation.isPending}
            disabled={!targetInvoiceId || transferAmount <= 0 || transferAmount > fromColl + 0.01}
            onClick={() => reallocateMutation.mutate()}
          >
            Confirmar Reasignación
          </Button>
        </div>
      </div>
    </div>
  )
}

export function LinkPaymentToInvoiceModal({
  invoice,
  clientNit,
  clientName,
  onClose,
  onSuccess,
  onOpenManualPayment,
}: {
  invoice: any
  clientNit: string
  clientName: string
  onClose: () => void
  onSuccess: () => void
  onOpenManualPayment?: (data: any) => void
}) {
  const qc = useQueryClient()
  const invVal = Number(invoice.finto_invoice_value ?? 0)
  const coll = Number(invoice.collected ?? 0)
  const balance = Math.max(0, invVal - coll)

  const [comprobante, setComprobante] = useState('')
  const [amount, setAmount] = useState<number>(balance)

  const { data: uncrossed } = useQuery({
    queryKey: ['participations', 'client-uncrossed-receipts', clientNit],
    enabled: !!clientNit,
    queryFn: async () => {
      const { data } = await api.get(`/api/participations/client-uncrossed-receipts?nit=${encodeURIComponent(clientNit)}`)
      return (data ?? []) as any[]
    },
  })

  const linkMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/api/participations/apply-manual-payment', {
        comprobante,
        client_nit: clientNit,
        allocations: [{ invoice_id: invoice.id, amount: Number(amount) }],
      })
      return data
    },
    onSuccess: () => {
      toast.success(`Pago vinculado correctamente a ${invoice.finto_invoice || invoice.purchase_order}`)
      qc.invalidateQueries({ queryKey: ['participations'] })
      onSuccess()
      onClose()
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error ?? 'Error al vincular el pago')
    },
  })

  const handleSelectRc = (rc: any) => {
    setComprobante(rc.comprobante)
    const rcAvail = Number(rc.saldo ?? rc.amount ?? 0)
    setAmount(Math.min(rcAvail, balance > 0 ? balance : rcAvail))
  }

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-xs" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-emerald-600 font-bold">
            <Plus className="w-5 h-5" />
            <h3 className="text-base text-slate-900">Vincular Pago Manual / Recibo</h3>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4" /></button>
        </div>

        <p className="text-xs text-slate-500">
          Factura: <b>{invoice.finto_invoice || invoice.purchase_order}</b> · Cliente: <b>{clientName || clientNit}</b>
        </p>

        {/* Resumen factura */}
        <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Valor Factura</p>
            <p className="font-bold text-slate-800">{fmtMoney(invVal)}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Recaudado</p>
            <p className="font-bold text-emerald-600">{fmtMoney(coll)}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Saldo Pendiente</p>
            <p className="font-bold text-slate-800">{fmtMoney(balance)}</p>
          </div>
        </div>

        {/* Recibos no cruzados disponibles en SIIGO */}
        {uncrossed && uncrossed.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[11px] font-bold text-slate-700">Recibos de caja pendientes de este cliente (SIIGO):</p>
            <div className="border border-slate-200 rounded-xl overflow-hidden max-h-36 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase">
                  <tr>
                    <th className="px-2.5 py-1.5 text-left">RC</th>
                    <th className="px-2.5 py-1.5 text-left">Fecha</th>
                    <th className="px-2.5 py-1.5 text-right">Saldo Disp.</th>
                    <th className="px-2.5 py-1.5 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {uncrossed.map((rc: any) => (
                    <tr key={rc.id} className="hover:bg-slate-50/60">
                      <td className="px-2.5 py-1 font-mono font-medium">{rc.comprobante}</td>
                      <td className="px-2.5 py-1 text-slate-500">{rc.doc_date || rc.period || '—'}</td>
                      <td className="px-2.5 py-1 text-right font-semibold text-emerald-600">{fmtMoney(Number(rc.saldo ?? rc.amount ?? 0))}</td>
                      <td className="px-2.5 py-1 text-right">
                        <button
                          type="button"
                          onClick={() => handleSelectRc(rc)}
                          className="text-[10px] font-bold text-primary-600 hover:text-primary-700 px-2 py-0.5 rounded bg-primary-50 hover:bg-primary-100"
                        >
                          Usar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Inputs comprobante y monto */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">Comprobante de recaudo (RC):</label>
            <input
              type="text"
              value={comprobante}
              onChange={e => setComprobante(e.target.value)}
              placeholder="ej: RC-1-53"
              className="w-full text-xs font-semibold px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">Monto a aplicar ($):</label>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min="0.01"
                step="any"
                value={amount || ''}
                onChange={e => setAmount(Number(e.target.value) || 0)}
                placeholder="0"
                className="w-full text-xs font-semibold px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500"
              />
              <button
                type="button"
                onClick={() => setAmount(balance)}
                className="text-[10px] font-bold text-primary-600 bg-primary-50 hover:bg-primary-100 px-2 py-2 rounded-lg"
              >
                Max
              </button>
            </div>
          </div>
        </div>

        {/* Enlace para distribución multi-factura */}
        <div className="flex items-center justify-between p-2.5 bg-purple-50 border border-purple-200 rounded-xl text-xs">
          <div className="flex items-center gap-1.5 text-purple-900 font-medium text-[11px]">
            <Layers className="w-3.5 h-3.5 text-purple-600 shrink-0" />
            <span>¿Este pago cubre varias facturas de este cliente?</span>
          </div>
          <button
            type="button"
            onClick={() => {
              onClose()
              onOpenManualPayment?.({
                comprobante: comprobante.trim(),
                clientNit,
                clientName,
                amount: Number(amount) || 0,
              })
            }}
            className="text-[11px] font-bold text-purple-700 hover:text-purple-900 bg-white border border-purple-200 hover:bg-purple-100/50 px-2.5 py-1 rounded-lg transition-colors shadow-xs"
          >
            Distribuir en varias facturas →
          </button>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <Button variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
          <Button
            size="sm"
            loading={linkMutation.isPending}
            disabled={!comprobante.trim() || amount <= 0}
            onClick={() => linkMutation.mutate()}
          >
            Vincular Recaudo
          </Button>
        </div>
      </div>
    </div>
  )
}
