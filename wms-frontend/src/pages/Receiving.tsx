import { useEffect, useState } from 'react'
import { getList, post } from '../services/apiClient'
import { Card, Badge, Table, TableSkeleton, ErrorBanner, EmptyState, Button, Input, Select, PageHeader, Pagination, Modal, SearchInput, Toast } from '../components/ui'
import { PackageCheck, Plus } from 'lucide-react'

interface GoodsReceipt {
  id: number
  number: string
  purchase_order_id: number
  purchase_order?: { number: string; supplier?: { name: string } }
  warehouse?: { name: string }
  received_by?: { name: string }
  status: string
  received_at: string
  items?: { id: number; product_id: number; product?: { name: string; sku: string }; quantity: number }[]
}

interface PurchaseOrder {
  id: number
  number: string
  supplier?: { name: string }
  warehouse?: { name: string }
  status: string
  items?: { id: number; product_id: number; product?: { name: string; sku: string }; quantity: number; received_quantity: number }[]
}

export default function Receiving() {
  const [data, setData] = useState<GoodsReceipt[]>([])
  const [meta, setMeta] = useState({ total: 0, current_page: 1, last_page: 1 })
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [pos, setPOs] = useState<PurchaseOrder[]>([])
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null)
  const [receiveQtys, setReceiveQtys] = useState<Record<number, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const load = (page = 1, q = search) => {
    setLoading(true)
    setError(null)
    getList<GoodsReceipt>('/goods-receipts', { page, per_page: 15, search: q || undefined })
      .then((resp) => {
        setData(resp.data)
        setMeta({ total: resp.total, current_page: resp.current_page, last_page: resp.last_page })
      })
      .catch((e: unknown) => setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to load receipts'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load(1) }, [])

  const loadPOs = () => {
    getList<PurchaseOrder>('/purchase-orders', { per_page: 100, status: 'approved,partially_received' })
      .then((resp) => setPOs(resp.data))
      .catch(() => {})
  }

  const selectPO = (poId: string) => {
    const po = pos.find((p) => p.id === Number(poId))
    setSelectedPO(po || null)
    if (po) {
      const init: Record<number, string> = {}
      po.items?.forEach((item) => { init[item.id] = String(item.quantity - item.received_quantity) })
      setReceiveQtys(init)
    }
  }

  const submitReceive = async () => {
    if (!selectedPO) return
    setSubmitting(true)
    setFormError(null)
    try {
      const receipts = Object.entries(receiveQtys)
        .filter(([, qty]) => Number(qty) > 0)
        .map(([itemId, qty]) => ({ purchase_order_item_id: Number(itemId), quantity: Number(qty) }))
      if (receipts.length === 0) {
        setFormError('Enter at least one quantity to receive.')
        setSubmitting(false)
        return
      }
      await post(`/purchase-orders/${selectedPO.id}/receive`, { items: receipts })
      setShowForm(false)
      setSelectedPO(null)
      setReceiveQtys({})
      load(1)
    } catch (e: unknown) {
      setFormError((e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to receive goods')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Receiving"
        subtitle={`${meta.total} goods receipts`}
        actions={
          <>
            <SearchInput
              placeholder="Search by PO number…"
              value={search}
              onChange={(v) => { setSearch(v); load(1, v) }}
              className="w-56"
            />
            <Button onClick={() => { setShowForm(true); loadPOs() }}><Plus size={16} /> New Receipt</Button>
          </>
        }
      />

      {error && <ErrorBanner message={error} onRetry={() => load(meta.current_page)} />}

      <Modal open={showForm} onClose={() => setShowForm(false)} title="Receive Goods" size="lg">
        {formError && <ErrorBanner message={formError} />}
        <div className="mb-4">
          <Select
            label="Purchase Order (Approved)"
            value={selectedPO?.id ?? ''}
            onChange={selectPO}
            options={pos.map((p) => ({ value: p.id, label: `${p.number} — ${p.supplier?.name ?? ''}` }))}
          />
        </div>
        {selectedPO && (
          <>
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted mb-2">Line Items</p>
            <div className="space-y-2 mb-4">
              {selectedPO.items?.map((item) => {
                const remaining = item.quantity - item.received_quantity
                return (
                  <div key={item.id} className="flex items-center gap-3 py-2 border-b border-border">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-ink">{item.product?.name ?? `Product #${item.product_id}`}</p>
                      <p className="text-xs text-ink-muted">Ordered: {item.quantity} · Received: {item.received_quantity} · Remaining: {remaining}</p>
                    </div>
                    <input
                      type="number"
                      min="0"
                      max={remaining}
                      step="0.001"
                      value={receiveQtys[item.id] ?? ''}
                      onChange={(e) => setReceiveQtys({ ...receiveQtys, [item.id]: e.target.value })}
                      className="w-28 border border-border rounded-lg px-3 py-2 text-sm text-ink bg-surface focus:ring-2 focus:ring-blue/40 focus:border-blue outline-none"
                      placeholder="Qty"
                    />
                  </div>
                )
              })}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button onClick={submitReceive} disabled={submitting}>
                {submitting ? 'Receiving…' : 'Confirm Receipt'}
              </Button>
            </div>
          </>
        )}
      </Modal>

      <Card>
        {loading ? (
          <TableSkeleton cols={7} />
        ) : data.length === 0 ? (
          <EmptyState message="No goods receipts found." icon={<PackageCheck size={28} />} />
        ) : (
          <Table headers={['GR #', 'PO #', 'Supplier', 'Warehouse', 'Received By', 'Date', 'Status']}>
            {data.map((gr) => (
              <tr key={gr.id} className="hover:bg-surface-subtle/60 transition">
                <td className="px-4 py-3 font-mono text-xs text-ink-muted">{gr.number}</td>
                <td className="px-4 py-3 font-mono text-xs text-ink-muted">{gr.purchase_order?.number ?? '—'}</td>
                <td className="px-4 py-3 font-medium text-ink">{gr.purchase_order?.supplier?.name ?? '—'}</td>
                <td className="px-4 py-3 text-ink-muted">{gr.warehouse?.name ?? '—'}</td>
                <td className="px-4 py-3 text-ink-muted">{gr.received_by?.name ?? '—'}</td>
                <td className="px-4 py-3 text-ink-muted">{gr.received_at ? new Date(gr.received_at).toLocaleDateString() : '—'}</td>
                <td className="px-4 py-3"><Badge status={gr.status}>{gr.status}</Badge></td>
              </tr>
            ))}
          </Table>
        )}
        <Pagination currentPage={meta.current_page} lastPage={meta.last_page} onChange={load} />
      </Card>
    </div>
  )
}