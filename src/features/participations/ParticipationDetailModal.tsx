import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

import { Button } from '@/components/ui/Button'

import { toast } from 'sonner'
import { X, ArrowLeftRight, Unlink, Plus, Layers } from 'lucide-react'
import { fmtMoney, INV_STATUS } from './format'
import { AssignedDocsBalance, DetailField, DetailStage } from './shared'

import { UnlinkSaleInvoiceModal, UnlinkPaymentModal, UnlinkEgressModal } from './UnlinkModals'
import { ReallocatePaymentModal, LinkPaymentToInvoiceModal } from './PaymentLinkModals'
import { AvailableDocumentsPicker } from './AvailableDocumentsPicker'

export function ParticipationDetailModal({
  item: initialItem,
  onClose,
  onOpenManualPayment,
}: {
  item: any
  onClose: () => void
  onOpenManualPayment?: (data: any) => void
}) {
  const qc = useQueryClient()
  const [item, setItem] = useState(initialItem)
  const [editingStage, setEditingStage] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<Record<string, any>>({})
  const [reallocateOpen, setReallocateOpen] = useState(false)
  const [linkOpen, setLinkOpen] = useState(false)
  const [unlinkOpen, setUnlinkOpen] = useState(false)
  const [unlinkEgressOpen, setUnlinkEgressOpen] = useState(false)
  const [unlinkFvOpen, setUnlinkFvOpen] = useState(false)

  useEffect(() => {
    setItem(initialItem)
  }, [initialItem])

  // Validar contra el servidor al abrir: si la OC ya no existe (p. ej. la lista
  // quedó en caché tras un import/limpieza que la regeneró o eliminó), avisar y
  // cerrar en vez de dejar editar un id inexistente (que luego daría 404 al guardar).
  useEffect(() => {
    const idToCheck = initialItem?.id || initialItem?._raw?.id || initialItem?.invoice_id
    if (!idToCheck) return
    let cancelled = false
    ;(async () => {
      try {
        const { data } = await api.get(`/api/participations/invoices/${idToCheck}`)
        if (!cancelled && data) setItem((prev: any) => ({ ...prev, ...data }))
      } catch (err: any) {
        if (!cancelled && err?.response?.status === 404) {
          toast.error('Esta OC ya no existe (la lista estaba desactualizada). Se actualizó; vuelve a abrirla.')
          qc.removeQueries({ queryKey: ['participations'] })
          qc.refetchQueries({ queryKey: ['participations'] })
          onClose()
        }
      }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialItem?.id])

  const clientNit = item.companies?.nit || item.client_nit || ''
  const clientName = item.companies?.name || item.client_name || ''
  const p = item.participation ?? {}
  const thirdPartyNit = p.third_party?.identification || item.nit_tercero || ''
  const thirdPartyName = p.third_party?.name || item.tercero || ''

  const st = INV_STATUS[item.status] ?? INV_STATUS.pending_third_invoice
  const inv = Number(item.finto_invoice_value ?? 0)
  const collected = Number(item.collected ?? 0)
  const pct = inv > 0 ? Math.min(100, Math.round(collected / inv * 100)) : 0

  const RANK: Record<string, number> = {
    pending_invoice: 1, pending_third_invoice: 2,
    value_difference: 3, pending_payment: 4, complete: 5,
  }
  const rank = RANK[item.status] ?? 2
  const saleDone      = rank >= 2 || !!item.finto_invoice
  const collectDone   = inv > 0 && collected + 0.01 >= inv
  const purchaseDone  = rank >= 3 || !!item.third_party_invoice || !!item.payment_order
  const paymentDone   = rank >= 5 || !!item.egress_voucher


  const currentInvoiceId = item?.id || item?._raw?.id || item?.invoice_id || initialItem?.id || initialItem?._raw?.id
  const purchaseOrder = item?.purchase_order || initialItem?.purchase_order || ''

  // Tras asignar un documento (RC/FC/RP) se relee la OC: sus valores salen de las
  // asignaciones. La etapa sigue abierta para ver el saldo que quedó en el selector.
  const reloadItem = async () => {
    if (!currentInvoiceId) return
    try {
      const { data } = await api.get(`/api/participations/invoices/${currentInvoiceId}`)
      if (data) {
        setItem((prev: any) => ({ ...prev, ...data }))
        // Refresca los campos abiertos con lo asignado, para que "Guardar" no lo pise con valores viejos
        setEditForm(prev => Object.fromEntries(Object.keys(prev).map(k => [k, data[k] ?? ''])))
      }
    } catch { /* la lista ya se invalidó; el detalle se refresca al reabrir */ }
  }
  const partValue = Number(item.participation_value ?? 0)
  const allocateProps = (pending: number) =>
    purchaseOrder ? { purchaseOrder, pending: Math.max(0, Math.round(pending * 100) / 100), onDone: reloadItem } : undefined

  const updateMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (!currentInvoiceId) throw new Error('ID de factura no disponible para actualizar')
      const { data } = await api.patch(`/api/participations/invoices/${currentInvoiceId}`, payload)
      return data
    },
    onSuccess: (updated: any) => {
      setItem((prev: any) => ({ ...prev, ...updated }))
      setEditingStage(null)
      toast.success('Etapa actualizada correctamente')
      qc.invalidateQueries({ queryKey: ['participations'] })
    },
    onError: (err: any) => {
      if (err?.response?.status === 404) {
        toast.error('Esta OC ya no existe en el sistema (la lista estaba desactualizada). Se actualizó la lista; vuelve a abrir la OC correcta.')
        qc.removeQueries({ queryKey: ['participations'] })
        qc.refetchQueries({ queryKey: ['participations'] })
        onClose()
        return
      }
      toast.error(err.response?.data?.error ?? err.message ?? 'Error al actualizar la etapa')
    },
  })

  // Vincula la FV por NÚMERO de OC (purchase_order), no por id interno. Así el
  // servidor resuelve la OC actual y no falla aunque la lista tenga un id viejo.
  const linkFvMutation = useMutation({
    mutationFn: async (payload: { finto_invoice: string | null; finto_invoice_date: string | null; finto_invoice_value: number }) => {
      const po = item?.purchase_order || initialItem?.purchase_order
      if (!po) throw new Error('Número de OC no disponible')
      const { data } = await api.post('/api/participations/link-sale-invoice', { purchase_order: po, ...payload })
      return data
    },
    onSuccess: (updated: any) => {
      setItem(updated)
      setEditingStage(null)
      toast.success('Factura de venta vinculada correctamente')
      qc.removeQueries({ queryKey: ['participations'] })
      qc.refetchQueries({ queryKey: ['participations'] })
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error ?? err.message ?? 'Error al vincular la factura de venta')
    },
  })

  const handleSaveStage = () => {
    if (editingStage === 2) {
      const fv = editForm.finto_invoice?.trim() || null
      linkFvMutation.mutate({
        finto_invoice: fv,
        finto_invoice_date: fv ? (editForm.finto_invoice_date || null) : null,
        finto_invoice_value: fv ? (Number(editForm.finto_invoice_value) || 0) : 0,
      })
      return
    }
    const payload: Record<string, any> = {}
    if (editingStage === 1) {
      const v = Number(editForm.participation_value)
      if (editForm.participation_value === '' || !Number.isFinite(v) || v < 0) {
        toast.error('Escribe un valor de participación válido (0 o más)')
        return
      }
      payload.participation_value = v
    } else if (editingStage === 3) {
      if (editForm.cash_receipts !== undefined) payload.cash_receipts = editForm.cash_receipts.trim() || null
      if (editForm.cash_receipt_date !== undefined) payload.cash_receipt_date = editForm.cash_receipt_date || null
      if (editForm.collected !== undefined && editForm.collected !== '') {
        payload.collected = Number(editForm.collected) || 0
      }
    } else if (editingStage === 4) {
      if (editForm.third_party_invoice !== undefined) payload.third_party_invoice = editForm.third_party_invoice.trim() || null
      if (editForm.third_party_invoice_date !== undefined) payload.third_party_invoice_date = editForm.third_party_invoice_date || null
      if (editForm.third_party_invoice_value !== undefined) {
        payload.third_party_invoice_value = editForm.third_party_invoice_value !== '' ? Number(editForm.third_party_invoice_value) : null
      }
      if (editForm.payment_order !== undefined) payload.payment_order = editForm.payment_order.trim() || null
      if (editForm.payment_order_date !== undefined) payload.payment_order_date = editForm.payment_order_date || null
    } else if (editingStage === 5) {
      if (editForm.egress_voucher !== undefined) payload.egress_voucher = editForm.egress_voucher.trim() || null
      if (editForm.egress_voucher_date !== undefined) payload.egress_voucher_date = editForm.egress_voucher_date || null
      if (editForm.egress_voucher_value !== undefined) {
        payload.egress_voucher_value = editForm.egress_voucher_value !== '' ? Number(editForm.egress_voucher_value) : null
      }
    }
    updateMutation.mutate(payload)
  }

  const reloadInvoice = async () => {
    if (!currentInvoiceId) return
    try {
      const { data } = await api.get(`/api/participations/invoices/${currentInvoiceId}`)
      if (data) setItem((prev: any) => ({ ...prev, ...data }))
    } catch { /* ignore */ }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span className="font-mono text-sm text-slate-600">{item.purchase_order}</span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
            </h3>
            <p className="text-xs text-slate-400">{clientName || '—'} · {thirdPartyName || 'sin tercero'}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-slim px-6 py-5 space-y-3">
          {/* Etapa 1: OC — solo la participación causada es editable */}
          <DetailStage
            n={1}
            title="Generación · OC"
            done
            editable
            isEditing={editingStage === 1}
            onToggleEdit={() => {
              if (editingStage === 1) setEditingStage(null)
              else {
                setEditForm({ participation_value: item.participation_value ?? '' })
                setEditingStage(1)
              }
            }}
          >
            <DetailField label="Orden de compra" value={item.purchase_order} mono />
            <DetailField label="Periodo" value={item.period ?? '—'} />
            <DetailField label="Servicio" value={p.company_service?.services?.name ?? '—'} />
            {editingStage === 1 ? (
              <div className="space-y-3 pt-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Participación causada ($)</label>
                  <input
                    type="number"
                    step="any"
                    min={0}
                    value={editForm.participation_value ?? ''}
                    onChange={e => setEditForm(f => ({ ...f, participation_value: e.target.value }))}
                    className="w-full text-xs font-semibold px-2.5 py-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Queda fija: los próximos imports y cambios de % no la recalculan. La partición tributaria y el disponible se recalculan con este valor.
                  </p>
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <Button size="sm" variant="secondary" onClick={() => setEditingStage(null)}>Cancelar</Button>
                  <Button size="sm" loading={updateMutation.isPending} onClick={handleSaveStage}>Guardar cambios</Button>
                </div>
              </div>
            ) : (
              <DetailField
                label={item.participation_value_manual ? 'Participación causada (ajustada a mano)' : 'Participación causada'}
                value={fmtMoney(Number(item.participation_value ?? 0))}
              />
            )}
          </DetailStage>

          {/* Etapa 2: Venta Finto */}
          <DetailStage
            n={2}
            title="Venta (factura Finto)"
            done={saleDone}
            editable
            isEditing={editingStage === 2}
            onToggleEdit={() => {
              if (editingStage === 2) setEditingStage(null)
              else {
                setEditForm({
                  finto_invoice: item.finto_invoice ?? '',
                  finto_invoice_date: item.finto_invoice_date ?? '',
                  finto_invoice_value: item.finto_invoice_value ?? '',
                })
                setEditingStage(2)
              }
            }}
          >
            {editingStage === 2 ? (
              <div className="space-y-3">
                <AvailableDocumentsPicker
                  docType="FV"
                  nit={clientNit}
                  title="Facturas de venta de este cliente en SIIGO:"
                  // Una FV puede repartirse entre varias OC: se asigna una parte y el
                  // resto queda disponible para las demás.
                  allocate={allocateProps(0)}
                  onSelect={(doc) => {
                    setEditForm(f => ({
                      ...f,
                      finto_invoice: doc.comprobante,
                      finto_invoice_date: doc.doc_date || f.finto_invoice_date || '',
                      finto_invoice_value: Number(doc.amount ?? 0),
                    }))
                    toast.info(`Datos cargados de la factura ${doc.comprobante}`)
                  }}
                />
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-semibold text-slate-500">Factura de venta (FV)</label>
                    {editForm.finto_invoice && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditForm(f => ({
                            ...f,
                            finto_invoice: '',
                            finto_invoice_date: '',
                            finto_invoice_value: '',
                          }))
                        }}
                        className="text-[10px] text-rose-600 hover:text-rose-700 font-semibold"
                      >
                        Limpiar / Quitar FV
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={editForm.finto_invoice ?? ''}
                    onChange={e => setEditForm(f => ({ ...f, finto_invoice: e.target.value }))}
                    placeholder="ej: FV-4-1234"
                    className="w-full text-xs font-semibold px-2.5 py-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">Fecha factura</label>
                    <input
                      type="date"
                      value={editForm.finto_invoice_date ?? ''}
                      onChange={e => setEditForm(f => ({ ...f, finto_invoice_date: e.target.value }))}
                      className="w-full text-xs font-semibold px-2.5 py-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">Valor factura ($)</label>
                    <input
                      type="number"
                      step="any"
                      value={editForm.finto_invoice_value ?? ''}
                      onChange={e => setEditForm(f => ({ ...f, finto_invoice_value: e.target.value }))}
                      placeholder="0"
                      className="w-full text-xs font-semibold px-2.5 py-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <Button size="sm" variant="secondary" onClick={() => setEditingStage(null)}>Cancelar</Button>
                  <Button size="sm" loading={updateMutation.isPending || linkFvMutation.isPending} onClick={handleSaveStage}>Guardar cambios</Button>
                </div>
              </div>
            ) : (
              <>
                <DetailField label="Factura de venta" value={item.finto_invoice ?? 'Pendiente'} />
                <AssignedDocsBalance docType="FV" nit={clientNit} comprobantes={item.finto_invoice} />
                <DetailField label="Fecha" value={item.finto_invoice_date ?? '—'} />
                <DetailField label="Valor factura" value={item.finto_invoice ? fmtMoney(inv) : "—"} />
                {item.finto_invoice && (
                  <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setUnlinkFvOpen(true)}
                      className="text-[11px] font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors"
                    >
                      <Unlink className="w-3 h-3 text-rose-600" /> Desvincular factura (FV)
                    </button>
                  </div>
                )}
              </>
            )}
          </DetailStage>

          {/* Etapa 3: Recaudo CxC */}
          <DetailStage
            n={3}
            title="Recaudo del cliente (CxC · RC)"
            done={collectDone}
            editable
            isEditing={editingStage === 3}
            onToggleEdit={() => {
              if (editingStage === 3) setEditingStage(null)
              else {
                setEditForm({
                  cash_receipts: item.cash_receipts ?? '',
                  cash_receipt_date: item.cash_receipt_date ?? '',
                  collected: item.collected ?? '',
                })
                setEditingStage(3)
              }
            }}
          >
            {editingStage === 3 ? (
              <div className="space-y-3">
                <AvailableDocumentsPicker
                  docType="RC"
                  nit={clientNit}
                  title="Recibos de caja de este cliente en SIIGO:"
                  allocate={allocateProps(inv - collected)}
                  onSelect={(doc) => {
                    const invVal = Number(item.finto_invoice_value ?? 0)
                    const curColl = Number(item.collected ?? 0)
                    const needed = Math.max(0, invVal - curColl)
                    const docAvail = Number(doc.saldo ?? doc.amount ?? 0)
                    const toApply = needed > 0 ? Math.min(docAvail, needed) : docAvail
                    setEditForm(f => ({
                      ...f,
                      cash_receipts: doc.comprobante,
                      cash_receipt_date: doc.doc_date || f.cash_receipt_date || '',
                      collected: toApply,
                    }))
                    if (needed > 0 && docAvail > needed) {
                      toast.info(`Se asignaron ${fmtMoney(toApply)} a esta factura. Quedan ${fmtMoney(docAvail - toApply)} disponibles de este recibo para otras facturas.`)
                    } else {
                      toast.info(`Datos cargados del recibo ${doc.comprobante}`)
                    }
                  }}
                />

                {/* Enlace para distribución multi-factura si el pago cubre varias */}
                <div className="flex items-center justify-between p-2.5 bg-purple-50 border border-purple-200 rounded-xl text-xs">
                  <div className="flex items-center gap-1.5 text-purple-900 font-medium text-[11px]">
                    <Layers className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                    <span>¿Un pago cubre varias facturas de este cliente?</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onClose()
                      onOpenManualPayment?.({
                        comprobante: editForm.cash_receipts || item.cash_receipts || '',
                        clientNit,
                        clientName,
                        amount: Number(editForm.collected || 0),
                      })
                    }}
                    className="text-[11px] font-bold text-purple-700 hover:text-purple-900 bg-white border border-purple-200 hover:bg-purple-100/50 px-2.5 py-1 rounded-lg transition-colors shadow-xs"
                  >
                    Distribuir en varias facturas →
                  </button>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Recibo(s) de caja (RC)</label>
                  <input
                    type="text"
                    value={editForm.cash_receipts ?? ''}
                    onChange={e => setEditForm(f => ({ ...f, cash_receipts: e.target.value }))}
                    placeholder="ej: RC-1-53, RC-1-80"
                    className="w-full text-xs font-semibold px-2.5 py-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">Fecha de recaudo</label>
                    <input
                      type="date"
                      value={editForm.cash_receipt_date ?? ''}
                      onChange={e => setEditForm(f => ({ ...f, cash_receipt_date: e.target.value }))}
                      className="w-full text-xs font-semibold px-2.5 py-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">Valor recaudado ($)</label>
                    <input
                      type="number"
                      step="any"
                      value={editForm.collected ?? ''}
                      onChange={e => setEditForm(f => ({ ...f, collected: e.target.value }))}
                      placeholder="0"
                      className="w-full text-xs font-semibold px-2.5 py-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <Button size="sm" variant="secondary" onClick={() => setEditingStage(null)}>Cancelar</Button>
                  <Button size="sm" loading={updateMutation.isPending} onClick={handleSaveStage}>Guardar cambios</Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <DetailField label="Recibo de caja (RC)" value={item.cash_receipts ?? 'Pendiente'} mono />
                <AssignedDocsBalance docType="RC" nit={clientNit} comprobantes={item.cash_receipts} />
                <DetailField label="Fecha de recaudo (RC)" value={item.cash_receipt_date ?? (item.cash_receipts ? 'Sin fecha' : '—')} />
                <DetailField label="Recaudado" value={`${fmtMoney(collected)}${inv > 0 ? ` · ${pct}%` : ''}`} />
                {Number(item.collection_taxes?.total ?? 0) > 0 && (
                  <>
                    <DetailField label="Retefuente (RC)" value={fmtMoney(Number(item.collection_taxes.income ?? 0))} />
                    <DetailField label="ReteICA (RC)" value={fmtMoney(Number(item.collection_taxes.ica ?? 0))} />
                    <DetailField label="ReteIVA (RC)" value={fmtMoney(Number(item.collection_taxes.iva ?? 0))} />
                    <DetailField label="Impuestos retenidos (RC)" value={fmtMoney(Number(item.collection_taxes.total ?? 0))} />
                  </>
                )}
                <DetailField label="Disponible para el tercero" value={fmtMoney(Number(item.available_for_payment ?? 0))} />

                {/* Acciones manuales de recaudo */}
                <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100">
                  {collected > 0 && (
                    <>
                      <button
                        type="button"
                        onClick={() => setReallocateOpen(true)}
                        className="text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors"
                      >
                        <ArrowLeftRight className="w-3 h-3 text-blue-600" /> Reasignar a otra factura
                      </button>
                      <button
                        type="button"
                        onClick={() => setUnlinkOpen(true)}
                        className="text-[11px] font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors"
                      >
                        <Unlink className="w-3 h-3 text-rose-600" /> Desvincular recaudo
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => setLinkOpen(true)}
                    className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors"
                  >
                    <Plus className="w-3 h-3 text-emerald-600" /> Vincular pago manual
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onClose()
                      onOpenManualPayment?.({
                        comprobante: item.cash_receipts || '',
                        clientNit,
                        clientName,
                        amount: 0,
                      })
                    }}
                    className="text-[11px] font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors"
                  >
                    <Layers className="w-3 h-3 text-purple-600" /> Distribuir pago en varias facturas
                  </button>
                </div>
              </div>
            )}
          </DetailStage>

          {/* Etapa 4: Factura de compra tercero + OP */}
          <DetailStage
            n={4}
            title="Factura de compra + Orden de Pago"
            done={purchaseDone}
            editable
            isEditing={editingStage === 4}
            onToggleEdit={() => {
              if (editingStage === 4) setEditingStage(null)
              else {
                setEditForm({
                  third_party_invoice: item.third_party_invoice ?? '',
                  third_party_invoice_date: item.third_party_invoice_date ?? '',
                  third_party_invoice_value: item.third_party_invoice_value ?? '',
                  payment_order: item.payment_order ?? '',
                  payment_order_date: item.payment_order_date ?? '',
                })
                setEditingStage(4)
              }
            }}
          >
            {editingStage === 4 ? (
              <div className="space-y-3">
                <AvailableDocumentsPicker
                  docType="FC"
                  nit={thirdPartyNit}
                  title="Facturas de compra del tercero en SIIGO:"
                  allocate={allocateProps(partValue - Number(item.third_party_invoice_value ?? 0))}
                  onSelect={(doc) => {
                    setEditForm(f => ({
                      ...f,
                      third_party_invoice: doc.comprobante,
                      third_party_invoice_date: doc.doc_date || f.third_party_invoice_date || '',
                      third_party_invoice_value: Number(doc.amount ?? 0),
                    }))
                    toast.info(`Datos cargados de la factura ${doc.comprobante}`)
                  }}
                />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">Factura tercero (FC)</label>
                    <input
                      type="text"
                      value={editForm.third_party_invoice ?? ''}
                      onChange={e => setEditForm(f => ({ ...f, third_party_invoice: e.target.value }))}
                      placeholder="ej: FC-1234"
                      className="w-full text-xs font-semibold px-2.5 py-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">Fecha factura tercero</label>
                    <input
                      type="date"
                      value={editForm.third_party_invoice_date ?? ''}
                      onChange={e => setEditForm(f => ({ ...f, third_party_invoice_date: e.target.value }))}
                      className="w-full text-xs font-semibold px-2.5 py-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">Valor factura tercero ($)</label>
                    <input
                      type="number"
                      step="any"
                      value={editForm.third_party_invoice_value ?? ''}
                      onChange={e => setEditForm(f => ({ ...f, third_party_invoice_value: e.target.value }))}
                      placeholder="0"
                      className="w-full text-xs font-semibold px-2.5 py-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">Orden de pago (OP)</label>
                    <input
                      type="text"
                      value={editForm.payment_order ?? ''}
                      onChange={e => setEditForm(f => ({ ...f, payment_order: e.target.value }))}
                      placeholder="ej: OP-202608-000001"
                      className="w-full text-xs font-semibold px-2.5 py-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="col-start-2">
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">Fecha orden de pago</label>
                    <input
                      type="date"
                      value={editForm.payment_order_date ?? ''}
                      onChange={e => setEditForm(f => ({ ...f, payment_order_date: e.target.value }))}
                      className="w-full text-xs font-semibold px-2.5 py-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <Button size="sm" variant="secondary" onClick={() => setEditingStage(null)}>Cancelar</Button>
                  <Button size="sm" loading={updateMutation.isPending} onClick={handleSaveStage}>Guardar cambios</Button>
                </div>
              </div>
            ) : (
              <>
                <DetailField label="Factura del tercero" value={item.third_party_invoice ?? (purchaseDone ? 'No registrada (pago directo)' : 'Pendiente')} />
                <AssignedDocsBalance docType="FC" nit={thirdPartyNit} comprobantes={item.third_party_invoice} />
                <DetailField label="Fecha factura tercero" value={item.third_party_invoice_date ?? (item.third_party_invoice ? 'Sin fecha' : '—')} />
                <DetailField label="Valor" value={item.third_party_invoice_value != null ? fmtMoney(Number(item.third_party_invoice_value)) : '—'} />
                <DetailField label="Orden de pago" value={item.payment_order ?? '—'} mono />
                <DetailField label="Fecha orden de pago" value={item.payment_order_date ?? (item.payment_order ? 'Sin fecha' : '—')} />
              </>
            )}
          </DetailStage>

          {/* Etapa 5: Pago al tercero RP */}
          <DetailStage
            n={5}
            title="Pago al tercero (egreso · RP)"
            done={paymentDone}
            editable
            isEditing={editingStage === 5}
            onToggleEdit={() => {
              if (editingStage === 5) setEditingStage(null)
              else {
                setEditForm({
                  egress_voucher: item.egress_voucher ?? '',
                  egress_voucher_date: item.egress_voucher_date ?? '',
                  egress_voucher_value: item.egress_voucher_value ?? '',
                })
                setEditingStage(5)
              }
            }}
          >
            {editingStage === 5 ? (
              <div className="space-y-3">
                <AvailableDocumentsPicker
                  docType="RP"
                  nit={thirdPartyNit}
                  title="Comprobantes de egreso / pagos en SIIGO:"
                  // Tope: lo que se le debe al tercero (giro neto total − pagado), calculado en el servidor
                  allocate={allocateProps(item.pay_pending != null
                    ? Number(item.pay_pending)
                    : Number(item.tax_partition?.breakdown?.finalTotal ?? partValue) - Number(item.egress_voucher_value ?? 0))}
                  onSelect={(doc) => {
                    setEditForm(f => ({
                      ...f,
                      egress_voucher: doc.comprobante,
                      egress_voucher_date: doc.doc_date || f.egress_voucher_date || '',
                      egress_voucher_value: Number(doc.saldo ?? doc.amount ?? 0),
                    }))
                    toast.info(`Datos cargados del pago ${doc.comprobante}`)
                  }}
                />
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Comprobante de egreso (RP)</label>
                  <input
                    type="text"
                    value={editForm.egress_voucher ?? ''}
                    onChange={e => setEditForm(f => ({ ...f, egress_voucher: e.target.value }))}
                    placeholder="ej: RP-1-456"
                    className="w-full text-xs font-semibold px-2.5 py-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">Fecha de pago</label>
                    <input
                      type="date"
                      value={editForm.egress_voucher_date ?? ''}
                      onChange={e => setEditForm(f => ({ ...f, egress_voucher_date: e.target.value }))}
                      className="w-full text-xs font-semibold px-2.5 py-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">Valor pagado ($)</label>
                    <input
                      type="number"
                      step="any"
                      value={editForm.egress_voucher_value ?? ''}
                      onChange={e => setEditForm(f => ({ ...f, egress_voucher_value: e.target.value }))}
                      placeholder="0"
                      className="w-full text-xs font-semibold px-2.5 py-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <Button size="sm" variant="secondary" onClick={() => setEditingStage(null)}>Cancelar</Button>
                  <Button size="sm" loading={updateMutation.isPending} onClick={handleSaveStage}>Guardar cambios</Button>
                </div>
              </div>
            ) : (
              <>
                <DetailField label="Comprobante de egreso (RP)" value={item.egress_voucher ?? (paymentDone ? 'Registrado' : 'Pendiente')} mono />
                <AssignedDocsBalance docType="RP" nit={thirdPartyNit} comprobantes={item.egress_voucher} />
                <DetailField label="Fecha de pago (RP)" value={item.egress_voucher_date ?? (item.egress_voucher ? 'Sin fecha' : '—')} />
                <DetailField label="Valor pagado" value={item.egress_voucher_value != null ? fmtMoney(Number(item.egress_voucher_value)) : '—'} />

                {/* Acción manual: desvincular el pago al tercero (RP) */}
                {item.egress_voucher && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setUnlinkEgressOpen(true)}
                      className="text-[11px] font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors"
                    >
                      <Unlink className="w-3 h-3 text-rose-600" /> Desvincular pago (RP)
                    </button>
                  </div>
                )}
              </>
            )}
          </DetailStage>


          {item.tax_partition && (
            <div className="border border-primary-200 rounded-xl overflow-hidden">
              <div className="px-4 py-2 bg-primary-50 flex items-center gap-2">
                <span className="text-xs font-bold text-primary-700 uppercase tracking-wider">Partición tributaria</span>
                {!item.tax_partition.has_profile && (
                  <span className="text-[10px] text-amber-600 ml-auto">Tercero sin perfil — cálculo neutro</span>
                )}
              </div>
              <div className="px-4 py-3 grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">Pagar al tercero</p>
                  <p className="text-sm font-bold text-emerald-700">{fmtMoney(item.tax_partition.payThirdParty)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">Nos deben</p>
                  <p className="text-sm font-bold text-blue-700">{fmtMoney(item.tax_partition.owedToUs)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">Queda en Finto</p>
                  <p className="text-sm font-bold text-primary-700">{fmtMoney(item.tax_partition.staysInFinto)}</p>
                </div>
              </div>
              {item.tax_partition.breakdown && (
                <div className="px-4 pb-3 pt-1 border-t border-slate-100">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">
                    Desglose sobre la participación · recaudo {Math.round((item.tax_partition.collectionRatio ?? 0) * 100)}%
                  </p>
                  <DetailField label="IVA factura" value={fmtMoney(item.tax_partition.breakdown.invoiceIva)} />
                  <DetailField label="Retención fuente" value={fmtMoney(item.tax_partition.breakdown.incomeWithholding.amount)} />
                  <DetailField label="Retención ICA" value={fmtMoney(item.tax_partition.breakdown.icaWithholding.amount)} />
                  <DetailField label="Retención IVA" value={fmtMoney(item.tax_partition.breakdown.ivaWithholding.amount)} />
                  {item.contract_type === 'mandato' && (
                    <DetailField label={`Comisión${item.percentage > 0 ? ` (${Number(item.percentage)}%)` : ''} + IVA`} value={fmtMoney(item.tax_partition.breakdown.commissionTotal)} />
                  )}
                  <DetailField label="Giro final (100% recaudo)" value={fmtMoney(item.tax_partition.breakdown.finalTotal)} />
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end px-6 py-4 border-t border-slate-100 shrink-0">
          <Button variant="secondary" onClick={onClose}>Cerrar</Button>
        </div>
      </div>

      {/* Sub-modales de recaudo y factura */}
      {reallocateOpen && (
        <ReallocatePaymentModal
          fromInvoice={item}
          clientNit={clientNit}
          clientName={clientName}
          onClose={() => setReallocateOpen(false)}
          onSuccess={() => reloadInvoice()}
        />
      )}

      {unlinkOpen && (
        <UnlinkPaymentModal
          invoice={item}
          onClose={() => setUnlinkOpen(false)}
          onSuccess={() => reloadInvoice()}
        />
      )}

      {linkOpen && (
        <LinkPaymentToInvoiceModal
          invoice={item}
          clientNit={clientNit}
          clientName={clientName}
          onClose={() => setLinkOpen(false)}
          onSuccess={() => reloadInvoice()}
          onOpenManualPayment={(data) => {
            setLinkOpen(false)
            onClose()
            onOpenManualPayment?.(data)
          }}
        />
      )}

      {unlinkEgressOpen && (
        <UnlinkEgressModal
          invoice={item}
          onClose={() => setUnlinkEgressOpen(false)}
          onSuccess={() => reloadInvoice()}
        />
      )}

      {unlinkFvOpen && (
        <UnlinkSaleInvoiceModal
          item={item}
          onClose={() => setUnlinkFvOpen(false)}
          onSuccess={() => reloadInvoice()}
        />
      )}
    </div>
  )
}
