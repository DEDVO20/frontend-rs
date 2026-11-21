import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

import { Button } from '@/components/ui/Button'
import { PageLoader } from '@/components/ui/Spinner'

import { toast } from 'sonner'

import { fmtMoney } from './format'

export function AvailableDocumentsPicker({
  docType,
  nit,
  title,
  onSelect,
  allocate,
}: {
  docType: 'FV' | 'RC' | 'FC' | 'RP'
  nit: string
  title: string
  onSelect?: (doc: any) => void
  /** RC/FC/RP: asigna una parte (o todo) del documento a la OC y deja el resto
   *  disponible para otras. `pending` = lo que le falta a esta OC. */
  allocate?: { purchaseOrder: string; pending: number; onDone: () => void }
}) {
  const qc = useQueryClient()
  const [pickId, setPickId] = useState<string | null>(null)
  const [amount, setAmount] = useState('')
  const allocMutation = useMutation({
    // FV: se reparte entre OC (assign-sale-invoice); RC/FC/RP: asignaciones de dinero.
    mutationFn: async (vars: { doc: any; amount: number; avail: number }) => (docType === 'FV'
      ? await api.post('/api/participations/assign-sale-invoice', {
          purchase_order: allocate!.purchaseOrder, finto_invoice: vars.doc.comprobante, amount: vars.amount,
        })
      : await api.post('/api/participations/allocations', {
          source_doc_type: docType, source_comprobante: vars.doc.comprobante,
          purchase_order: allocate!.purchaseOrder, amount: vars.amount,
          source_nit: vars.doc.tercero_nit || undefined,
        })).data,
    onSuccess: (res: any, vars) => {
      const applied = Number(res?.applied ?? 0)
      const left = res?.remaining != null ? Number(res.remaining) : Math.max(0, Math.round((vars.avail - applied) * 100) / 100)
      toast.success(
        `Asignado ${fmtMoney(applied)} de ${vars.doc.comprobante}`,
        { description: left > 0.01 ? `Quedan ${fmtMoney(left)} disponibles para otra OC.` : 'El documento quedó sin saldo disponible.', duration: 6000 },
      )
      setPickId(null)
      qc.invalidateQueries({ queryKey: ['participations'] })
      allocate?.onDone()
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'No se pudo asignar el documento'),
  })

  const { data: docs, isLoading } = useQuery({
    queryKey: ['participations', 'available-documents', docType, nit],
    enabled: !!nit,
    queryFn: async () => {
      const { data } = await api.get(`/api/participations/available-documents?doc_type=${docType}&nit=${encodeURIComponent(nit)}`)
      return (data ?? []) as any[]
    },
  })

  if (!nit) {
    return (
      <p className="text-[11px] text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-2">
        Sin NIT registrado para buscar comprobantes de tipo {docType} en SIIGO.
      </p>
    )
  }

  if (isLoading) {
    return <div className="py-2 text-center text-slate-400 text-xs"><PageLoader /></div>
  }

  if (!docs || docs.length === 0) {
    return (
      <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-500 text-[11px]">
        No se encontraron comprobantes tipo <b>{docType}</b> en SIIGO para el NIT <b>{nit}</b>. Puedes digitar los valores manualmente abajo.
      </div>
    )
  }

  return (
    <div className="space-y-1.5 bg-slate-50 p-2.5 border border-slate-200 rounded-xl">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold text-slate-700">{title}</span>
        <span className="text-[10px] text-slate-400 font-medium">{docs.length} encontrado(s) en SIIGO</span>
      </div>
      {/* Lista compacta (sin tabla ancha) para que el botón Asignar siempre quede visible */}
      <div className="border border-slate-200 rounded-lg max-h-56 overflow-y-auto overflow-x-hidden scrollbar-slim bg-white divide-y divide-slate-100">
        {docs.map((d: any) => {
          // Con saldo por asignar: RC/FC/RP y también la FV (se reparte entre OC)
          const isMoney = d.doc_type === 'RC' || d.doc_type === 'FC' || d.doc_type === 'RP' || d.doc_type === 'FV'
          const total = Number(d.amount ?? 0)
          const avail = isMoney ? Number(d.available ?? d.saldo ?? total) : total
          // Recaudo (RC) y pago (RP): tope = el menor entre el saldo del documento y
          // lo que le falta a esta OC (por recaudar de la factura / por pagarle al tercero).
          const isPay = docType === 'RP'
          const capByInvoice = (docType === 'RC' || isPay) && !!allocate
          const invoicePending = capByInvoice ? Math.max(0, allocate!.pending) : Infinity
          const maxAllowed = Math.round(Math.min(avail, invoicePending) * 100) / 100
          const invoiceFull = capByInvoice && invoicePending <= 0.01
          const noBalance = (isMoney && avail <= 0.01) || invoiceFull
          const picking = pickId === d.id
          // Desglose de la FV: base + IVA − retenciones = valor (lo que paga el cliente)
          const fvRet = Number(d.tax_income_withholding ?? 0) + Number(d.tax_ica_withholding ?? 0) + Number(d.tax_iva_withholding ?? 0)
          const fvBreak = d.doc_type === 'FV' && (Number(d.vat_amount ?? 0) > 0 || fvRet > 0)
          return (
            <div key={d.id} className="px-2.5 py-1.5 hover:bg-slate-50/70 transition-colors">
              <div className="flex items-center gap-2 min-w-0">
                <div className="min-w-0 flex-1">
                  <div className="font-mono font-bold text-xs text-slate-800 truncate">{d.comprobante}</div>
                  <div className="text-[10px] text-slate-400">{d.doc_date || d.period || '—'}</div>
                  {fvBreak && (
                    <div className="text-[10px] text-slate-400 truncate" title="Base + IVA − retenciones = lo que paga el cliente">
                      Base {fmtMoney(Number(d.base_amount ?? 0))}
                      {Number(d.vat_amount ?? 0) > 0 && <span className="text-emerald-600"> +IVA {fmtMoney(Number(d.vat_amount))}</span>}
                      {fvRet > 0 && <span className="text-red-500"> −Ret. {fmtMoney(fvRet)}</span>}
                    </div>
                  )}
                  {/* A qué OC está asignado (OC sin FV en ámbar: posible recibo "pegado") */}
                  {(d.holders ?? []).length > 0 && (
                    <div className="text-[10px] text-slate-400 leading-snug">
                      Asignado a:{' '}
                      {(d.holders as any[]).map((h, i) => (
                        <span key={i} className={h.finto_invoice ? '' : 'text-amber-700 font-medium'}>
                          {i > 0 && ' · '}{h.purchase_order} ({h.finto_invoice ?? 'sin FV'}) {fmtMoney(Number(h.amount))}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="text-right shrink-0">
                  {isMoney ? (
                    <>
                      <div className={`text-xs font-semibold ${noBalance ? 'text-slate-400' : 'text-emerald-700'}`}>Disp. {fmtMoney(avail)}</div>
                      {avail + 0.01 < total && <div className="text-[10px] text-slate-400">de {fmtMoney(total)}</div>}
                    </>
                  ) : (
                    <div className="text-xs font-semibold text-slate-700">{fmtMoney(total)}</div>
                  )}
                </div>
                <button
                  type="button"
                  disabled={noBalance}
                  onClick={() => {
                    if (allocate && isMoney) {
                      setPickId(picking ? null : d.id)
                      const suggested = capByInvoice ? maxAllowed : (allocate.pending > 0 ? Math.min(avail, allocate.pending) : avail)
                      setAmount(String(Math.round(suggested * 100) / 100))
                    } else onSelect?.(d)
                  }}
                  className="shrink-0 text-[10px] font-bold text-primary-600 hover:text-primary-700 px-2 py-1 rounded bg-primary-50 hover:bg-primary-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {invoiceFull ? (isPay ? 'Tercero pagado' : 'Factura recaudada') : noBalance ? 'Sin saldo' : 'Asignar'}
                </button>
              </div>
              {picking && allocate && (
                <div className="mt-1.5 flex items-center gap-1.5">
                  <input
                    type="number" step="any" min="0" value={amount} autoFocus
                    onChange={e => setAmount(e.target.value)}
                    className="flex-1 min-w-0 text-xs font-semibold px-2 py-1 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                  <Button size="sm" loading={allocMutation.isPending}
                    onClick={() => {
                      const v = Number(amount)
                      if (!(v > 0)) { toast.error('Monto inválido'); return }
                      if (v > avail + 0.01) { toast.error(`Supera el saldo disponible del ${isPay ? 'pago' : 'recibo'} (${fmtMoney(avail)})`); return }
                      if (capByInvoice && v > invoicePending + 0.01) {
                        toast.error(isPay ? `Supera lo que se le debe al tercero (${fmtMoney(invoicePending)})` : `Supera lo que falta por recaudar de la factura (${fmtMoney(invoicePending)})`)
                        return
                      }
                      allocMutation.mutate({ doc: d, amount: v, avail })
                    }}>
                    Confirmar
                  </Button>
                  <button type="button" onClick={() => setPickId(null)} className="text-[11px] text-slate-500 hover:text-slate-700 px-1">Cancelar</button>
                </div>
              )}
              {picking && capByInvoice && (
                <div className="mt-1 text-[10px] text-slate-500">
                  Máximo: <b>{fmtMoney(maxAllowed)}</b> ({isPay
                    ? <>saldo del pago {fmtMoney(avail)} · se le debe al tercero {fmtMoney(invoicePending)}</>
                    : <>saldo del recibo {fmtMoney(avail)} · falta por recaudar de la factura {fmtMoney(invoicePending)}</>})
                </div>
              )}
              {picking && allocate && Number(amount) > 0 && Number(amount) < avail && (
                <div className="mt-1 text-[10px] text-slate-500">Quedarán {fmtMoney(Math.round((avail - Number(amount)) * 100) / 100)} disponibles para otra OC.</div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
