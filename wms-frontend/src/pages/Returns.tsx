import { useEffect, useState } from 'react'
import { getList, get, post, del } from '../services/apiClient'
import { Card, Badge, Table, TableSkeleton, ErrorBanner, EmptyState, Button, Input, Select, PageHeader, Pagination, Modal, SearchInput, Toast, ConfirmDialog } from '../components/ui'
import { RotateCcw, Plus, Trash2, CheckCircle2 } from 'lucide-react'

interface ReturnItem {
  id: number
  product_id: number
  product?: { id: number; name: string; sku: string }
  quantity: string
  condition: string
  reason?: string
}

interface ReturnOrder {
  id: number
  number: string
  customer_id: number | null
  customer?: { id: number; name: string }
  warehouse_id: number
  warehouse?: { id: number; name: string }
  status: string
  reason?: string
  created_at: string
  items?: ReturnItem[]
}

interface Customer { id: number; name: string }
interface Warehouse { id: number; name: string }
interface Product { id: number; name: string; sku: string }

function errorMessage(e: unknown): string {
  const err = e as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } }
  const data = err?.response?.data
  if (data?.errors) {
    return Object.entries(data.errors).map(([f, m]) => `${f}: ${m.join(', ')}`).join('; ')
  }
  return data?.message || 'Operation failed'
}

export default function Returns() {
  const [data, setData] = useState<ReturnOrder[]>([])
  const [meta, setMeta] = useState({ total: 0, current_page: 1, last_page: 1 })
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [form, setForm] = useState({
    warehouse_id: '',
    customer_id: '',
    reason: '',
  })
  const [lineItems, setLineItems] = useState<{ product_id: string; quantity: string; condition: string }[]>([
    { product_id: '', quantity: '', condition: 'resalable' },
  ])

  const [detail, setDetail] = useState<ReturnOrder | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [applyLoading, setApplyLoading] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ReturnOrder | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const load = (page = 1, q = search) => {
    setLoading(true)
    setError(null)
    getList<ReturnOrder>('/return-orders', { page, per_page: 15, number: q || undefined })
      .then((r) => {
        setData(r.data)
        setMeta({ total: r.total, current_page: r.current_page, last_page: r.last_page })
      })
      .catch((e: unknown) => setError(errorMessage(e)))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load(1)
    get<Customer[]>('/customers', { per_page: 100 }).then((d) => setCustomers(Array.isArray(d) ? d : [])).catch(() => {})
    get<Warehouse[]>('/warehouses', { per_page: 100 }).then((d) => setWarehouses(Array.isArray(d) ? d : [])).catch(() => {})
    get<Product[]>('/products', { per_page: 100 }).then((d) => setProducts(Array.isArray(d) ? d : [])).catch(() => {})
  }, [])

  const addLine = () => setLineItems([...lineItems, { product_id: '', quantity: '', condition: 'resalable' }])

  const removeLine = (idx: number) => setLineItems(lineItems.filter((_, i) => i !== idx))

  const submit = async () => {
    setSubmitting(true)
    setFormError(null)
    const items = lineItems
      .filter((li) => li.product_id && li.quantity)
      .map((li) => ({ product_id: Number(li.product_id), quantity: Number(li.quantity), condition: li.condition }))
    if (items.length === 0) {
      setFormError('At least one item is required.')
      setSubmitting(false)
      return
    }
    try {
      await post('/return-orders', {
        warehouse_id: Number(form.warehouse_id),
        customer_id: form.customer_id ? Number(form.customer_id) : undefined,
        reason: form.reason || undefined,
        items,
      })
      setShowForm(false)
      setForm({ warehouse_id: '', customer_id: '', reason: '' })
      setLineItems([{ product_id: '', quantity: '', condition: 'resalable' }])
      load(1)
    } catch (e: unknown) {
      setFormError(errorMessage(e))
    } finally {
      setSubmitting(false)
    }
  }

  const openDetail = async (ro: ReturnOrder) => {
    setDetailLoading(true)
    try {
      const d = await get<ReturnOrder>(`/return-orders/${ro.id}`)
      setDetail(d)
    } catch (e: unknown) {
      alert(errorMessage(e))
    } finally {
      setDetailLoading(false)
    }
  }

  const applyReturn = async () => {
    if (!detail) return
    setApplyLoading(true)
    try {
      await post(`/return-orders/${detail.id}/apply`)
      setDetail(null)
      load(1)
    } catch (e: unknown) {
      alert(errorMessage(e))
    } finally {
      setApplyLoading(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    try {
      await del(`/return-orders/${deleteTarget.id}`)
      setToast('Return order deleted')
      setDeleteTarget(null)
      load(1)
    } catch (e: unknown) {
      setToast(errorMessage(e))
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Returns"
        subtitle={`${meta.total} return orders`}
        actions={
          <>
            <SearchInput
              placeholder="Search by number…"
              value={search}
              onChange={(v) => { setSearch(v); load(1, v) }}
              className="w-56"
            />
            <Button onClick={() => setShowForm(true)}><Plus size={16} /> New Return</Button>
          </>
        }
      />

      {error && <ErrorBanner message={error} />}

      <Card>
        {loading ? <TableSkeleton cols={6} /> : data.length === 0 ? (
          <EmptyState message="No return orders found." icon={<RotateCcw size={28} />} />
        ) : (
          <Table headers={['Number', 'Customer', 'Warehouse', 'Status', 'Created', 'Actions']}>
            {data.map((ro) => (
              <tr key={ro.id} className="hover:bg-surface-subtle/60 transition cursor-pointer" onClick={() => openDetail(ro)}>
                <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">{ro.number}</td>
                <td className="px-4 py-3 text-ink">{ro.customer?.name ?? '—'}</td>
                <td className="px-4 py-3 text-ink-muted">{ro.warehouse?.name ?? '—'}</td>
                <td className="px-4 py-3"><Badge status={ro.status}>{ro.status}</Badge></td>
                <td className="px-4 py-3 text-xs text-ink-muted">{new Date(ro.created_at).toLocaleDateString()}</td>
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <div className="flex gap-1">
                    <Button size="sm" variant="secondary" onClick={() => openDetail(ro)}>View</Button>
                    {ro.status === 'draft' && (
                      <Button size="sm" variant="danger" onClick={() => setDeleteTarget(ro)}>
                        <Trash2 size={14} />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        )}
        <Pagination currentPage={meta.current_page} lastPage={meta.last_page} onChange={load} />
      </Card>

      {/* Create Modal */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title="Create Return Order" size="xl">
        {formError && <ErrorBanner message={formError} />}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <Select
            label="Warehouse"
            value={form.warehouse_id}
            onChange={(v) => setForm({ ...form, warehouse_id: v })}
            options={warehouses.map((w) => ({ value: w.id, label: w.name }))}
            required
          />
          <Select
            label="Customer (optional)"
            value={form.customer_id}
            onChange={(v) => setForm({ ...form, customer_id: v })}
            options={customers.map((c) => ({ value: c.id, label: c.name }))}
          />
          <Input label="Reason (optional)" value={form.reason} onChange={(v) => setForm({ ...form, reason: v })} />
        </div>

        <div className="mb-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-ink">Items</span>
            <Button size="sm" variant="secondary" onClick={addLine}><Plus size={14} /> Add Line</Button>
          </div>
          <div className="space-y-2">
            {lineItems.map((li, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-6">
                  <Select
                    label={idx === 0 ? 'Product' : undefined}
                    value={li.product_id}
                    onChange={(v) => { const copy = [...lineItems]; copy[idx].product_id = v; setLineItems(copy) }}
                    options={products.map((p) => ({ value: p.id, label: `${p.sku} — ${p.name}` }))}
                  />
                </div>
                <div className="col-span-2">
                  <Input
                    label={idx === 0 ? 'Qty' : undefined}
                    type="number"
                    value={li.quantity}
                    onChange={(v) => { const copy = [...lineItems]; copy[idx].quantity = v; setLineItems(copy) }}
                    placeholder="0"
                  />
                </div>
                <div className="col-span-3">
                  <Select
                    label={idx === 0 ? 'Condition' : undefined}
                    value={li.condition}
                    onChange={(v) => { const copy = [...lineItems]; copy[idx].condition = v; setLineItems(copy) }}
                    options={[
                      { value: 'resalable', label: 'Resalable' },
                      { value: 'damaged', label: 'Damaged' },
                      { value: 'scrapped', label: 'Scrapped' },
                    ]}
                  />
                </div>
                <div className="col-span-1">
                  {lineItems.length > 1 && (
                    <Button size="sm" variant="ghost" onClick={() => removeLine(idx)}><Trash2 size={14} /></Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
          <Button onClick={submit} disabled={submitting || !form.warehouse_id}>
            {submitting ? 'Creating…' : 'Create Return Order'}
          </Button>
        </div>
      </Modal>

      {/* Detail Modal */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail ? `Return ${detail.number}` : ''} size="lg">
        {detailLoading ? <TableSkeleton cols={3} /> : detail && (
          <>
            <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
              <div><span className="text-ink-muted">Status:</span> <Badge status={detail.status}>{detail.status}</Badge></div>
              <div><span className="text-ink-muted">Customer:</span> {detail.customer?.name ?? '—'}</div>
              <div><span className="text-ink-muted">Warehouse:</span> {detail.warehouse?.name ?? '—'}</div>
              <div><span className="text-ink-muted">Reason:</span> {detail.reason ?? '—'}</div>
            </div>
            <Table headers={['Product', 'Qty', 'Condition']}>
              {(detail.items ?? []).map((item) => (
                <tr key={item.id} className="border-b border-border">
                  <td className="px-4 py-2 text-ink">{item.product?.name ?? `Product #${item.product_id}`}</td>
                  <td className="px-4 py-2 text-ink-muted">{item.quantity}</td>
                  <td className="px-4 py-2"><Badge status={item.condition === 'resalable' ? 'active' : item.condition === 'damaged' ? 'damaged' : 'cancelled'}>{item.condition}</Badge></td>
                </tr>
              ))}
            </Table>
            {detail.status === 'draft' && (
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="secondary" onClick={() => setDetail(null)}>Close</Button>
                <Button onClick={applyReturn} disabled={applyLoading}>
                  <CheckCircle2 size={16} /> {applyLoading ? 'Applying…' : 'Apply Return'}
                </Button>
              </div>
            )}
          </>
        )}
      </Modal>
    </div>
  )
}