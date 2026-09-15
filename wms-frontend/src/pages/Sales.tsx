import { useEffect, useState } from 'react'
import { get, getList, post } from '../services/apiClient'
import { Card, Badge, Table, Spinner, ErrorBanner, EmptyState, Button, Select, PageHeader, Pagination, Modal } from '../components/ui'
import ConfirmationDialog from '../components/ConfirmationDialog'
import { Truck, Plus, X } from 'lucide-react'

interface SalesOrder {
  id: number
  number: string
  customer_id: number
  customer?: { name: string }
  warehouse_id: number
  warehouse?: { name: string }
  status: string
  total: number | string
  order_date: string
}

interface Ref {
  id: number
  name: string
}

export default function Sales() {
  const [orders, setOrders] = useState<SalesOrder[]>([])
  const [meta, setMeta] = useState({ total: 0, current_page: 1, last_page: 1 })
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [customers, setCustomers] = useState<Ref[]>([])
  const [warehouses, setWarehouses] = useState<Ref[]>([])
  const [products, setProducts] = useState<Ref[]>([])
  const [form, setForm] = useState({ customer_id: '', warehouse_id: '' })
  const [items, setItems] = useState([{ product_id: '', quantity: '1' }])
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<{ id: number; action: string; title: string; message: string; danger?: boolean; confirmLabel?: string; variant?: 'danger' | 'primary' } | null>(null)

  const load = (p = 1) => {
    setLoading(true)
    setError(null)
    getList<SalesOrder>('/sales-orders', { page: p, per_page: 15, status: statusFilter || undefined })
      .then((resp) => {
        setOrders(resp.data)
        setMeta({ total: resp.total, current_page: resp.current_page, last_page: resp.last_page })
      })
      .catch((e) => setError(e?.response?.data?.message || 'Failed to load sales orders'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load(1) }, [statusFilter])

  useEffect(() => {
    Promise.all([
      getList<Ref>('/customers', { per_page: 100 }),
      getList<Ref>('/warehouses', { per_page: 100 }),
      getList<Ref>('/products', { per_page: 100 }),
    ]).then(([c, w, p]) => {
      setCustomers(c.data); setWarehouses(w.data); setProducts(p.data)
    }).catch(() => {})
  }, [])

  const submit = async () => {
    setSubmitting(true)
    setFormError(null)
    try {
      await post('/sales-orders', {
        customer_id: Number(form.customer_id),
        warehouse_id: Number(form.warehouse_id),
        items: items.filter((i) => i.product_id).map((i) => ({ product_id: Number(i.product_id), quantity: Number(i.quantity) })),
      })
      setShowForm(false)
      setForm({ customer_id: '', warehouse_id: '' })
      setItems([{ product_id: '', quantity: '1' }])
      load(1)
    } catch (e: unknown) {
      setFormError((e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to create SO')
    } finally {
      setSubmitting(false)
    }
  }

  const act = async (id: number, action: string) => {
    const actionsMap: Record<string, { title: string; message: string; variant?: 'danger' | 'primary'; confirmLabel?: string }> = {
      'cancel': { title: 'Cancel Sales Order', message: 'Are you sure you want to cancel this sales order? Reserved stock will be released.', variant: 'danger', confirmLabel: 'Cancel Order' },
      'ship': { title: 'Ship Sales Order', message: 'Confirm shipment of this sales order? This will deduct stock levels.', confirmLabel: 'Ship Order' },
      'mark-delivered': { title: 'Mark Delivered', message: 'Mark this order as delivered?', confirmLabel: 'Mark Delivered' },
    }
    if (action in actionsMap) {
      const cfg = actionsMap[action]
      setConfirm({ id, action, title: cfg.title, message: cfg.message, variant: cfg.variant, confirmLabel: cfg.confirmLabel })
      return
    }
    try {
      await post(`/sales-orders/${id}/${action}`)
      load(meta.current_page)
    } catch (e: unknown) {
      alert((e as { response?: { data?: { message?: string } } })?.response?.data?.message || `Failed to ${action}`)
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Sales Orders"
        subtitle={`${meta.total} sales orders`}
        actions={
          <>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-border rounded-lg px-3 py-2 text-sm text-ink bg-surface focus:ring-2 focus:ring-blue/40 focus:border-blue outline-none transition">
              <option value="">All statuses</option>
              {['pending', 'confirmed', 'picked', 'packed', 'shipped', 'delivered', 'cancelled'].map((s) => (
                <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
              ))}
            </select>
            <Button onClick={() => setShowForm(true)}><Plus size={16} /> New SO</Button>
          </>
        }
      />

      {error && <ErrorBanner message={error} />}

      <Modal open={showForm} onClose={() => setShowForm(false)} title="Create Sales Order" size="lg">
        {formError && <ErrorBanner message={formError} />}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
          <Select label="Customer" value={form.customer_id} onChange={(v) => setForm({ ...form, customer_id: v })}
            options={customers.map((c) => ({ value: c.id, label: c.name }))} />
          <Select label="Warehouse" value={form.warehouse_id} onChange={(v) => setForm({ ...form, warehouse_id: v })}
            options={warehouses.map((w) => ({ value: w.id, label: w.name }))} />
        </div>
        <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted mb-2">Line Items</p>
        <div className="space-y-2 mb-3">
          {items.map((item, i) => (
            <div key={i} className="flex gap-2">
              <select value={item.product_id}
                className="flex-1 border border-border rounded-lg px-3 py-2 text-sm text-ink bg-surface focus:ring-2 focus:ring-blue/40 focus:border-blue outline-none"
                onChange={(e) => { const c = [...items]; c[i] = { ...c[i], product_id: e.target.value }; setItems(c) }}>
                <option value="">— Select product —</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <input type="number" min="0.001" step="0.001" value={item.quantity}
                className="w-24 border border-border rounded-lg px-3 py-2 text-sm text-ink bg-surface focus:ring-2 focus:ring-blue/40 focus:border-blue outline-none"
                onChange={(e) => { const c = [...items]; c[i] = { ...c[i], quantity: e.target.value }; setItems(c) }} />
              {items.length > 1 && (
                <Button variant="ghost" size="sm" onClick={() => setItems(items.filter((_, x) => x !== i))}><X size={14} /></Button>
              )}
            </div>
          ))}
        </div>
        <Button size="sm" variant="secondary" onClick={() => setItems([...items, { product_id: '', quantity: '1' }])} className="mb-5">+ Add item</Button>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
          <Button onClick={submit} disabled={submitting || !form.customer_id || !form.warehouse_id || items.some((i) => !i.product_id)}>
            {submitting ? 'Creating…' : 'Create SO'}
          </Button>
        </div>
      </Modal>

      <Card>
        {loading ? (
          <Spinner />
        ) : orders.length === 0 ? (
          <EmptyState message="No sales orders found." icon={<Truck size={28} />} />
        ) : (
          <Table headers={['SO #', 'Customer', 'Warehouse', 'Total', 'Status', 'Actions']}>
            {orders.map((so) => (
              <tr key={so.id} className="hover:bg-surface-subtle/60 transition">
                <td className="px-4 py-3 font-mono text-xs font-semibold text-blue">{so.number}</td>
                <td className="px-4 py-3 font-medium text-ink">{so.customer?.name || '—'}</td>
                <td className="px-4 py-3 text-ink-muted">{so.warehouse?.name || '—'}</td>
                <td className="px-4 py-3 font-mono text-sm text-ink tabular-nums">${Number(so.total || 0).toFixed(2)}</td>
                <td className="px-4 py-3"><Badge status={so.status}>{so.status.replace(/_/g, ' ')}</Badge></td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    {so.status === 'pending' && (
                      <Button size="sm" onClick={() => act(so.id, 'confirm')}>Confirm</Button>
                    )}
                    {so.status === 'confirmed' && (
                      <>
                        <Button size="sm" variant="secondary" onClick={() => act(so.id, 'pick')}>Pick</Button>
                        <Button size="sm" variant="danger" onClick={() => act(so.id, 'cancel')}>Cancel</Button>
                      </>
                    )}
                    {so.status === 'packed' && (
                      <Button size="sm" onClick={() => act(so.id, 'ship')}>Ship</Button>
                    )}
                    {so.status === 'shipped' && (
                      <Button size="sm" variant="secondary" onClick={() => act(so.id, 'mark-delivered')}>Delivered</Button>
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
        confirmLabel={confirm?.confirmLabel ?? 'Confirm'}
        variant={confirm?.variant ?? 'primary'}
        onConfirm={async () => {
          if (!confirm) return
          await post(`/sales-orders/${confirm.id}/${confirm.action}`)
          load(meta.current_page)
        }}
        onCancel={() => setConfirm(null)}
      />
    </div>
  )
}