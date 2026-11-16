import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { get, getList, post } from '../services/apiClient'
import { Card, Badge, Table, Spinner, ErrorBanner, EmptyState, Button, Select, PageHeader, Pagination, Modal } from '../components/ui'
import ConfirmationDialog from '../components/ConfirmationDialog'
import { ShoppingCart, Plus, X } from 'lucide-react'

interface PurchaseOrder {
  id: number
  number: string
  supplier_id: number
  supplier?: { name: string }
  warehouse_id: number
  warehouse?: { name: string }
  status: string
  total: number | string
  expected_at: string | null
  created_at: string
}

interface Ref {
  id: number
  name: string
}

export default function Purchasing() {
  const navigate = useNavigate()
  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [meta, setMeta] = useState({ total: 0, current_page: 1, last_page: 1 })
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [suppliers, setSuppliers] = useState<Ref[]>([])
  const [warehouses, setWarehouses] = useState<Ref[]>([])
  const [products, setProducts] = useState<Ref[]>([])
  const [form, setForm] = useState({ supplier_id: '', warehouse_id: '', notes: '' })
  const [items, setItems] = useState([{ product_id: '', quantity: '1' }])
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<{ id: number; action: string; title: string; message: string } | null>(null)

  const load = (p = 1) => {
    setLoading(true)
    setError(null)
    getList<PurchaseOrder>('/purchase-orders', {
      page: p, per_page: 15,
      status: statusFilter || undefined,
    })
      .then((resp) => {
        setOrders(resp.data)
        setMeta({ total: resp.total, current_page: resp.current_page, last_page: resp.last_page })
      })
      .catch((e) => setError(e?.response?.data?.message || 'Failed to load purchase orders'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load(1) }, [statusFilter])

  useEffect(() => {
    Promise.all([
      getList<Ref>('/suppliers', { per_page: 100 }),
      getList<Ref>('/warehouses', { per_page: 100 }),
      getList<Ref>('/products', { per_page: 100 }),
    ])
      .then(([s, w, p]) => {
        setSuppliers(s.data)
        setWarehouses(w.data)
        setProducts(p.data)
      })
      .catch(() => {})
  }, [])

  const submit = async () => {
    setSubmitting(true)
    setFormError(null)
    try {
      await post('/purchase-orders', {
        supplier_id: Number(form.supplier_id),
        warehouse_id: Number(form.warehouse_id),
        notes: form.notes || undefined,
        items: items
          .filter((i) => i.product_id)
          .map((i) => ({ product_id: Number(i.product_id), quantity: Number(i.quantity) })),
      })
      setShowForm(false)
      setForm({ supplier_id: '', warehouse_id: '', notes: '' })
      setItems([{ product_id: '', quantity: '1' }])
      load(1)
    } catch (e: unknown) {
      setFormError((e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to create PO')
    } finally {
      setSubmitting(false)
    }
  }

  const act = async (id: number, action: string) => {
    try {
      await post(`/purchase-orders/${id}/${action}`)
      load(meta.current_page)
    } catch (e: unknown) {
      alert((e as { response?: { data?: { message?: string } } })?.response?.data?.message || `Failed to ${action}`)
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Purchase Orders"
        subtitle={`${meta.total} purchase orders`}
        actions={
          <>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-border rounded-lg px-3 py-2 text-sm text-ink bg-surface focus:ring-2 focus:ring-brand/40 focus:border-brand outline-none transition"
            >
              <option value="">All statuses</option>
              {['draft', 'submitted', 'approved', 'partially_received', 'received', 'cancelled'].map((s) => (
                <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
              ))}
            </select>
            <Button onClick={() => setShowForm(true)}><Plus size={16} /> New PO</Button>
          </>
        }
      />

      {error && <ErrorBanner message={error} />}

      <Modal open={showForm} onClose={() => setShowForm(false)} title="Create Purchase Order" size="lg">
        {formError && <ErrorBanner message={formError} />}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
          <Select label="Supplier" value={form.supplier_id} onChange={(v) => setForm({ ...form, supplier_id: v })}
            options={suppliers.map((s) => ({ value: s.id, label: s.name }))} />
          <Select label="Warehouse" value={form.warehouse_id} onChange={(v) => setForm({ ...form, warehouse_id: v })}
            options={warehouses.map((w) => ({ value: w.id, label: w.name }))} />
        </div>
        <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted mb-2">Line Items</p>
        <div className="space-y-2 mb-3">
          {items.map((item, i) => (
            <div key={i} className="flex gap-2">
              <select value={item.product_id}
                className="flex-1 border border-border rounded-lg px-3 py-2 text-sm text-ink bg-surface focus:ring-2 focus:ring-brand/40 focus:border-brand outline-none"
                onChange={(e) => {
                  const c = [...items]; c[i] = { ...c[i], product_id: e.target.value }; setItems(c)
                }}>
                <option value="">— Select product —</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <input type="number" min="0.001" step="0.001" value={item.quantity}
                className="w-24 border border-border rounded-lg px-3 py-2 text-sm text-ink bg-surface focus:ring-2 focus:ring-brand/40 focus:border-brand outline-none"
                onChange={(e) => {
                  const c = [...items]; c[i] = { ...c[i], quantity: e.target.value }; setItems(c)
                }} />
              {items.length > 1 && (
                <Button variant="ghost" size="sm" onClick={() => setItems(items.filter((_, x) => x !== i))}>
                  <X size={14} />
                </Button>
              )}
            </div>
          ))}
        </div>
        <Button size="sm" variant="secondary" onClick={() => setItems([...items, { product_id: '', quantity: '1' }])} className="mb-5">
          + Add item
        </Button>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
          <Button onClick={submit} disabled={submitting || !form.supplier_id || !form.warehouse_id || items.some((i) => !i.product_id)}>
            {submitting ? 'Creating…' : 'Create PO'}
          </Button>
        </div>
      </Modal>

      <Card>
        {loading ? (
          <Spinner />
        ) : orders.length === 0 ? (
          <EmptyState message="No purchase orders found." icon={<ShoppingCart size={28} />} />
        ) : (
          <Table headers={['PO #', 'Supplier', 'Warehouse', 'Total', 'Status', 'Actions']}>
            {orders.map((po) => (
              <tr key={po.id} className="hover:bg-surface-subtle/60 transition">
                <td className="px-4 py-3 font-mono text-xs font-semibold text-brand">{po.number}</td>
                <td className="px-4 py-3 font-medium text-ink">{po.supplier?.name || '—'}</td>
                <td className="px-4 py-3 text-ink-muted">{po.warehouse?.name || '—'}</td>
                <td className="px-4 py-3 font-mono text-sm text-ink tabular-nums">${Number(po.total || 0).toFixed(2)}</td>
                <td className="px-4 py-3"><Badge status={po.status}>{po.status.replace(/_/g, ' ')}</Badge></td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    {po.status === 'draft' && (
                      <Button size="sm" variant="secondary" onClick={() => act(po.id, 'submit')}>Submit</Button>
                    )}
                    {po.status === 'submitted' && (
                      <Button size="sm" onClick={() => act(po.id, 'approve')}>Approve</Button>
                    )}
                    {(po.status === 'approved' || po.status === 'partially_received') && (
                      <Button size="sm" variant="secondary" onClick={() => navigate('/receiving')}>Receive</Button>
                    )}
                    {['draft', 'submitted', 'approved'].includes(po.status) && (
                      <Button size="sm" variant="danger" onClick={() => setConfirm({
                        id: po.id,
                        action: 'cancel',
                        title: 'Cancel Purchase Order',
                        message: `Cancel PO ${po.number}? This cannot be undone.`,
                      })}>Cancel</Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        )}
        <Pagination currentPage={meta.current_page} lastPage={meta.last_page} onChange={load} />
      </Card>

      <ConfirmationDialog
        open={confirm !== null}
        title={confirm?.title ?? ''}
        message={confirm?.message ?? ''}
        confirmLabel="Cancel Order"
        variant="danger"
        onConfirm={async () => {
          if (!confirm) return
          await post(`/purchase-orders/${confirm.id}/${confirm.action}`)
          load(meta.current_page)
        }}
        onCancel={() => setConfirm(null)}
      />
    </div>
  )
}