import { useEffect, useState } from 'react'
import { get, getList, post } from '../services/apiClient'
import { Card, Badge, Table, TableSkeleton, ErrorBanner, EmptyState, Button, PageHeader, Pagination, Modal, Input, Toast } from '../components/ui'
import { CheckCircle2, Truck } from 'lucide-react'

interface Shipment {
  id: number
  number: string
  status: string
  carrier?: string | null
  tracking_number?: string | null
  shipped_at?: string | null
  warehouse?: { name: string } | null
  sales_order?: { id: number; number: string; customer?: { name: string } } | null
  items?: { id: number; product?: { name: string; sku: string }; quantity: string }[]
}

interface SalesOrder {
  id: number
  number: string
  status: string
  customer?: { name: string }
  warehouse?: { name: string }
}

export default function Shipping() {
  const [shipments, setShipments] = useState<Shipment[]>([])
  const [meta, setMeta] = useState({ total: 0, current_page: 1, last_page: 1 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showPicker, setShowPicker] = useState(false)
  const [queue, setQueue] = useState<SalesOrder[]>([])
  const [selected, setSelected] = useState<SalesOrder | null>(null)
  const [carrier, setCarrier] = useState('')
  const [tracking, setTracking] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [taskError, setTaskError] = useState<string | null>(null)
  const [taskSuccess, setTaskSuccess] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const load = (page = 1) => {
    setLoading(true)
    setError(null)
    getList<Shipment>('/shipping', { page, per_page: 15 })
      .then((resp) => {
        setShipments(resp.data)
        setMeta({ total: resp.total, current_page: resp.current_page, last_page: resp.last_page })
      })
      .catch((e: unknown) => setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to load shipments'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load(1) }, [])

  const openPicker = async () => {
    setTaskError(null)
    setTaskSuccess(null)
    setShowPicker(true)
    try {
      const resp = await getList<SalesOrder>('/sales-orders', { per_page: 100, status: 'packed' })
      setQueue(resp.data)
      if (resp.data.length === 0) {
        setTaskError('No packed orders awaiting shipment.')
      }
    } catch (e: unknown) {
      setTaskError((e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to load shipping queue')
      setShowPicker(false)
    }
  }

  const ship = async () => {
    if (!selected) return
    setSubmitting(true)
    setTaskError(null)
    try {
      await post(`/shipping/${selected.id}`, {
        carrier: carrier || undefined,
        tracking_number: tracking || undefined,
      })
      setTaskSuccess('Order shipped. Stock deducted from inventory.')
      setToast('Order shipped — stock deducted from inventory')
      setShowPicker(false)
      setSelected(null)
      setCarrier('')
      setTracking('')
      load(meta.current_page)
    } catch (e: unknown) {
      setTaskError((e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to ship order')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Shipping"
        subtitle="Dispatch packed orders and deduct stock."
        actions={
          <Button size="md" onClick={openPicker}>
            <Truck size={15} /> Ship Order
</Button>
        }
      />

      {error && <ErrorBanner message={error} />}
      {taskSuccess && (
        <div className="bg-mint-soft border border-mint/30 text-mint px-4 py-3 rounded-lg text-sm flex items-center gap-2">
          <CheckCircle2 size={16} className="shrink-0" /> {taskSuccess}
        </div>
      )}

      <Card>
        {loading ? (
          <TableSkeleton cols={6} />
        ) : shipments.length === 0 ? (
          <EmptyState message="No shipments recorded yet." icon={<Truck size={28} />} />
        ) : (
          <Table headers={['Number', 'Order', 'Customer', 'Carrier', 'Tracking', 'Status']}>
            {shipments.map((s) => (
              <tr key={s.id} className="hover:bg-surface-subtle/60">
                <td className="px-4 py-3 font-mono text-xs font-semibold text-ink">{s.number}</td>
                <td className="px-4 py-3 text-xs text-ink">{s.sales_order?.number ?? '—'}</td>
                <td className="px-4 py-3 text-ink">{s.sales_order?.customer?.name ?? '—'}</td>
                <td className="px-4 py-3 text-ink">{s.carrier ?? '—'}</td>
                <td className="px-4 py-3 font-mono text-xs text-ink-muted">{s.tracking_number ?? '—'}</td>
                <td className="px-4 py-3"><Badge status={s.status} /></td>
              </tr>
            ))}
          </Table>
        )}
        <Pagination currentPage={meta.current_page} lastPage={meta.last_page} onChange={load} />
      </Card>

      {showPicker && (
        <Modal open={showPicker} title="Ship Packed Order" onClose={() => setShowPicker(false)}>
          {taskError && <div className="mb-4"><ErrorBanner message={taskError} /></div>}
          {!selected ? (
            queue.length === 0 ? (
              <EmptyState message="No packed orders awaiting shipment." icon={<CheckCircle2 size={28} />} />
            ) : (
              <div className="space-y-2">
                {queue.map((so) => (
                  <button
                    key={so.id}
                    onClick={() => setSelected(so)}
                    className="w-full flex items-center justify-between border border-border rounded-lg px-4 py-3 text-left hover:border-blue hover:bg-blue/5 transition"
                  >
                    <div>
                      <p className="text-sm font-semibold text-ink">{so.number}</p>
                      <p className="text-xs text-ink-muted">{so.customer?.name ?? '—'} · {so.warehouse?.name ?? '—'}</p>
                    </div>
                    <Badge status={so.status} />
                  </button>
                ))}
              </div>
            )
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-ink">{selected.number}</p>
                  <p className="text-xs text-ink-muted">{selected.customer?.name ?? '—'}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>Back</Button>
              </div>
              <Input label="Carrier" value={carrier} onChange={setCarrier} placeholder="e.g. DHL, FedEx, UPS" />
              <Input label="Tracking Number" value={tracking} onChange={setTracking} placeholder="Tracking reference" />
              <div className="flex justify-end pt-2">
                <Button size="md" onClick={ship} disabled={submitting}>
                  {submitting ? 'Shipping…' : 'Confirm Shipment'}
                </Button>
              </div>
            </div>
          )}
        </Modal>
      )}

      {toast && <Toast message={toast} type="success" onClose={() => setToast(null)} />}
    </div>
  )
}