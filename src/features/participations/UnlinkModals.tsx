import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

import { Button } from '@/components/ui/Button'

import { toast } from 'sonner'
import { X, Unlink } from 'lucide-react'
import { fmtMoney } from './format'

export function UnlinkSaleInvoiceModal({
  item,
  onClose,
  onSuccess,
}: {
  item: any
  onClose: () => void
  onSuccess: () => void
}) {
  const [unlinkReceipts, setUnlinkReceipts] = useState(false)
  const qc = useQueryClient()
  const collected = Number(item?.collected ?? 0)
  const invId = item?.id || item?._raw?.id || item?.invoice_id

  const mutation = useMutation({
    mutationFn: async () => {
      if (!invId) throw new Error('ID de factura no disponible para desvincular')
      const { data } = await api.post('/api/participations/unlink-sale-invoice', {
        invoice_id: invId,
        unlink_receipts: unlinkReceipts,
      })
      return data
    },
    onSuccess: () => {
      toast.success('Factura de venta desvinculada de la orden de compra')
      qc.invalidateQueries({ queryKey: ['participations'] })
      onSuccess()
      onClose()
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error ?? err.message ?? 'Error al desvincular la factura')
    },
  })

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-xs" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-rose-600 font-bold">
            <Unlink className="w-5 h-5" />
            <h3 className="text-base text-slate-900">Desvincular Factura de Venta (FV)</h3>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4" /></button>
        </div>

        <p className="text-xs text-slate-500">
          Se quitará la factura de venta <strong className="font-mono text-slate-800">{item.finto_invoice}</strong> ({fmtMoney(Number(item.finto_invoice_value ?? 0))}) de la orden <strong className="font-mono text-slate-800">{item.purchase_order}</strong>.
        </p>

        <div className="p-3 bg-slate-50 rounded-xl space-y-2 text-xs text-slate-600 border border-slate-200">
          <p>• La orden de compra regresará al estado <strong>Pendiente de factura</strong>.</p>
          <p>• La factura <span className="font-mono font-semibold">{item.finto_invoice}</span> quedará liberada en SIIGO para poder asignarse a otra OC.</p>
          {collected > 0 && (
            <div className="mt-2 pt-2 border-t border-slate-200">
              <p className="text-amber-800 font-medium mb-1.5">
                Esta OC tiene actualmente un recaudo registrado de <strong>{fmtMoney(collected)}</strong>.
              </p>
              <label className="flex items-center gap-2 cursor-pointer select-none text-slate-700">
                <input
                  type="checkbox"
                  checked={unlinkReceipts}
                  onChange={e => setUnlinkReceipts(e.target.checked)}
                  className="rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                />
                <span>Desvincular y liberar también los recibos de caja asociados</span>
              </label>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <Button variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
          <Button
            variant="danger"
            size="sm"
            loading={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            Confirmar Desvinculación
          </Button>
        </div>
      </div>
    </div>
  )
}

export function UnlinkPaymentModal({
  invoice,
  onClose,
  onSuccess,
}: {
  invoice: any
  onClose: () => void
  onSuccess: (newCollected: number) => void
}) {
  const qc = useQueryClient()
  const collected = Number(invoice.collected ?? 0)
  const receipts = String(invoice.cash_receipts ?? '').split(',').map(s => s.trim()).filter(Boolean)
  const [selectedReceipt, setSelectedReceipt] = useState(receipts[0] ?? '')
  const [amount, setAmount] = useState<number>(collected)

  const unlinkMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/api/participations/unlink-payment', {
        invoice_id: invoice.id,
        amount: Number(amount),
        comprobante: selectedReceipt,
      })
      return data
    },
    onSuccess: (res: any) => {
      toast.success('Recaudo desvinculado correctamente')
      qc.invalidateQueries({ queryKey: ['participations'] })
      onSuccess(res.collected)
      onClose()
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error ?? 'Error al desvincular el recaudo')
    },
  })

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-xs" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-rose-600 font-bold">
            <Unlink className="w-5 h-5" />
            <h3 className="text-base text-slate-900">Desvincular Recaudo</h3>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4" /></button>
        </div>

        <p className="text-xs text-slate-500">
          Al desvincular este pago, el saldo se restará de la factura <b>{invoice.finto_invoice || invoice.purchase_order}</b> y el recibo de caja quedará nuevamente libre en el sistema (Cruce / Pagos) para poder asociarse a la factura correcta.
        </p>

        <div className="space-y-3 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Comprobante a desvincular</label>
            {receipts.length > 1 ? (
              <select
                value={selectedReceipt}
                onChange={e => setSelectedReceipt(e.target.value)}
                className="w-full text-xs font-semibold px-2 py-1.5 border border-slate-200 rounded-lg bg-white"
              >
                {receipts.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            ) : (
              <input
                type="text"
                value={selectedReceipt}
                onChange={e => setSelectedReceipt(e.target.value)}
                className="w-full text-xs font-semibold px-2 py-1.5 border border-slate-200 rounded-lg bg-white"
              />
            )}
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Monto a retirar ($)</label>
            <input
              type="number"
              min="0.01"
              max={collected}
              step="any"
              value={amount || ''}
              onChange={e => setAmount(Number(e.target.value) || 0)}
              className="w-full text-xs font-semibold px-2 py-1.5 border border-slate-200 rounded-lg bg-white"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
          <Button
            size="sm"
            variant="danger"
            loading={unlinkMutation.isPending}
            disabled={!selectedReceipt.trim() || amount <= 0 || amount > collected + 0.01}
            onClick={() => unlinkMutation.mutate()}
          >
            Confirmar Desvinculación
          </Button>
        </div>
      </div>
    </div>
  )
}

export function UnlinkEgressModal({
  invoice,
  onClose,
  onSuccess,
}: {
  invoice: any
  onClose: () => void
  onSuccess: (newPaid: number) => void
}) {
  const qc = useQueryClient()
  const paid = Number(invoice.egress_voucher_value ?? 0)
  const vouchers = String(invoice.egress_voucher ?? '').split(',').map((s: string) => s.trim()).filter(Boolean)
  const [selectedVoucher, setSelectedVoucher] = useState(vouchers[0] ?? '')
  const [amount, setAmount] = useState<number>(paid)

  const unlinkMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/api/participations/unlink-egress', {
        invoice_id: invoice.id,
        amount: Number(amount),
        comprobante: selectedVoucher,
      })
      return data
    },
    onSuccess: (res: any) => {
      toast.success('Pago al tercero desvinculado correctamente')
      qc.invalidateQueries({ queryKey: ['participations'] })
      onSuccess(res.egress_voucher_value)
      onClose()
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error ?? 'Error al desvincular el pago')
    },
  })

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-xs" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-rose-600 font-bold">
            <Unlink className="w-5 h-5" />
            <h3 className="text-base text-slate-900">Desvincular Pago al Tercero (RP)</h3>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4" /></button>
        </div>

        <p className="text-xs text-slate-500">
          Al desvincular este egreso, el valor se restará de la factura <b>{invoice.finto_invoice || invoice.purchase_order}</b> y el comprobante de pago quedará nuevamente libre en el sistema (Saldos) para poder asociarse a la factura correcta.
        </p>

        <div className="space-y-3 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Comprobante a desvincular</label>
            {vouchers.length > 1 ? (
              <select
                value={selectedVoucher}
                onChange={e => setSelectedVoucher(e.target.value)}
                className="w-full text-xs font-semibold px-2 py-1.5 border border-slate-200 rounded-lg bg-white"
              >
                {vouchers.map((r: string) => <option key={r} value={r}>{r}</option>)}
              </select>
            ) : (
              <input
                type="text"
                value={selectedVoucher}
                onChange={e => setSelectedVoucher(e.target.value)}
                className="w-full text-xs font-semibold px-2 py-1.5 border border-slate-200 rounded-lg bg-white"
              />
            )}
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Monto a retirar ($)</label>
            <input
              type="number"
              min="0.01"
              max={paid}
              step="any"
              value={amount || ''}
              onChange={e => setAmount(Number(e.target.value) || 0)}
              className="w-full text-xs font-semibold px-2 py-1.5 border border-slate-200 rounded-lg bg-white"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
          <Button
            size="sm"
            variant="danger"
            loading={unlinkMutation.isPending}
            disabled={!selectedVoucher.trim() || amount <= 0 || amount > paid + 0.01}
            onClick={() => unlinkMutation.mutate()}
          >
            Confirmar Desvinculación
          </Button>
        </div>
      </div>
    </div>
  )
}
