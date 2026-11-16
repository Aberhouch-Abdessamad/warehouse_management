import { useEffect, useState } from 'react'
import { getList, get, post, del } from '../services/apiClient'
import { Card, Badge, Table, Spinner, ErrorBanner, EmptyState, Button, Input, Select, PageHeader, Pagination, Modal } from '../components/ui'
import { ClipboardCheck, Search, Plus, Trash2, CheckCircle2, Play } from 'lucide-react'

interface StockCountItem {
  id: number
  product_id: number
  product?: { id: number; name: string; sku: string }
  bin_id: number | null
  system_quantity: string
  counted_quantity: string | null
  variance: string
  notes?: string
}

interface StockCount {
  id: number
  number: string
  warehouse_id: number
  warehouse?: { id: number; name: string }
  type: string
  status: string
  created_at: string
  counted_at?: string | null
  notes?: string
  items?: StockCountItem[]
}

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

export default function StockCountPage() {
  const [data, setData] = useState<StockCount[]>([])
  const [meta, setMeta] = useState({ total: 0, current_page: 1, last_page: 1 })
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [form, setForm] = useState({ warehouse_id: '', type: 'cycle', notes: '' })
  const [lineItems, setLineItems] = useState<{ product_id: string; bin_id: string; system_quantity: string }[]>([
    { product_id: '', bin_id: '', system_quantity: '' },
  ])

  const [detail, setDetail] = useState<StockCount | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [applyLoading, setApplyLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [recordForm, setRecordForm] = useState<Record<number, string>>({})

  const load = (page = 1, q = search) => {
    setLoading(true)
    setError(null)
    getList<StockCount>('/stock-counts', { page, per_page: 15, number: q || undefined })
      .then((r) => {
        setData(r.data)
        setMeta({ total: r.total, current_page: r.current_page, last_page: r.last_page })
      })
      .catch((e: unknown) => setError(errorMessage(e)))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load(1)
    get<Warehouse[]>('/warehouses', { per_page: 100 }).then((d) => setWarehouses(Array.isArray(d) ? d : [])).catch(() => {})
    get<Product[]>('/products', { per_page: 100 }).then((d) => setProducts(Array.isArray(d) ? d : [])).catch(() => {})
  }, [])

  const addLine = () => setLineItems([...lineItems, { product_id: '', bin_id: '', system_quantity: '' }])
  const removeLine = (idx: number) => setLineItems(lineItems.filter((_, i) => i !== idx))

  const submit = async () => {
    setSubmitting(true)
    setFormError(null)
    const items = lineItems
      .filter((li) => li.product_id)
      .map((li) => ({
        product_id: Number(li.product_id),
        bin_id: li.bin_id ? Number(li.bin_id) : undefined,
        system_quantity: li.system_quantity ? Number(li.system_quantity) : undefined,
      }))
    if (items.length === 0) {
      setFormError('At least one item is required.')
      setSubmitting(false)
      return
    }
    try {
      await post('/stock-counts', {
        warehouse_id: Number(form.warehouse_id),
        type: form.type || undefined,
        notes: form.notes || undefined,
        items,
      })
      setShowForm(false)
      setForm({ warehouse_id: '', type: 'cycle', notes: '' })
      setLineItems([{ product_id: '', bin_id: '', system_quantity: '' }])
      load(1)
    } catch (e: unknown) {
      setFormError(errorMessage(e))
    } finally {
      setSubmitting(false)
    }
  }

  const openDetail = async (sc: StockCount) => {
    setDetailLoading(true)
    try {
      const d = await get<StockCount>(`/stock-counts/${sc.id}`)
      setDetail(d)
      const initial: Record<number, string> = {}
      ;(d.items ?? []).forEach((item) => {
        initial[item.id] = item.counted_quantity ?? ''
      })
      setRecordForm(initial)
    } catch (e: unknown) {
      alert(errorMessage(e))
    } finally {
      setDetailLoading(false)
    }
  }

  const recordCount = async () => {
    if (!detail) return
    setSubmitting(true)
    setFormError(null)
    try {
      const items = Object.entries(recordForm).map(([itemId, qty]) => ({
        stock_count_item_id: Number(itemId),
        counted_quantity: qty === '' ? null : Number(qty),
      }))
      await post(`/stock-counts/${detail.id}/record`, { items })
      const refreshed = await get<StockCount>(`/stock-counts/${detail.id}`)
      setDetail(refreshed)
    } catch (e: unknown) {
      setFormError(errorMessage(e))
    } finally {
      setSubmitting(false)
    }
  }

  const applyCount = async () => {
    if (!detail) return
    setApplyLoading(true)
    try {
      await post(`/stock-counts/${detail.id}/apply`)
      setDetail(null)
      load(1)
    } catch (e: unknown) {
      alert(errorMessage(e))
    } finally {
      setApplyLoading(false)
    }
  }

  const deleteCount = async (sc: StockCount) => {
    if (!confirm(`Delete stock count ${sc.number}?`)) return
    setDeleteLoading(true)
    try {
      await del(`/stock-counts/${sc.id}`)
      load(1)
    } catch (e: unknown) {
      alert(errorMessage(e))
    } finally {
      setDeleteLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Stock Counts"
        subtitle={`${meta.total} counts`}
        actions={
          <>
            <div className="relative w-56">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted/60" />
              <input
                type="text"
                placeholder="Search by number…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); load(1, e.target.value) }}
                className="w-full border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-ink bg-surface focus:ring-2 focus:ring-brand/40 focus:border-brand outline-none transition placeholder:text-ink-muted/50"
              />
            </div>
            <Button onClick={() => setShowForm(true)}><Plus size={16} /> New Count</Button>
          </>
        }
      />

      {error && <ErrorBanner message={error} />}

      <Card>
        {loading ? <Spinner /> : data.length === 0 ? (
          <EmptyState message="No stock counts found." icon={<ClipboardCheck size={28} />} />
        ) : (
          <Table headers={['Number', 'Warehouse', 'Type', 'Status', 'Created', 'Actions']}>
            {data.map((sc) => (
              <tr key={sc.id} className="hover:bg-surface-subtle/60 transition cursor-pointer" onClick={() => openDetail(sc)}>
                <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">{sc.number}</td>
                <td className="px-4 py-3 text-ink">{sc.warehouse?.name ?? '—'}</td>
                <td className="px-4 py-3 text-ink-muted capitalize">{sc.type}</td>
                <td className="px-4 py-3"><Badge status={sc.status}>{sc.status}</Badge></td>
                <td className="px-4 py-3 text-xs text-ink-muted">{new Date(sc.created_at).toLocaleDateString()}</td>
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <div className="flex gap-1">
                    <Button size="sm" variant="secondary" onClick={() => openDetail(sc)}>View</Button>
                    {sc.status === 'open' && (
                      <Button size="sm" variant="danger" onClick={() => deleteCount(sc)} disabled={deleteLoading}>
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
      <Modal open={showForm} onClose={() => setShowForm(false)} title="Create Stock Count" size="xl">
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
            label="Type"
            value={form.type}
            onChange={(v) => setForm({ ...form, type: v })}
            options={[{ value: 'cycle', label: 'Cycle' }, { value: 'physical', label: 'Physical' }]}
          />
          <Input label="Notes (optional)" value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} />
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
                <div className="col-span-3">
                  <Input
                    label={idx === 0 ? 'Bin ID (optional)' : undefined}
                    value={li.bin_id}
                    onChange={(v) => { const copy = [...lineItems]; copy[idx].bin_id = v; setLineItems(copy) }}
                    placeholder="—"
                  />
                </div>
                <div className="col-span-2">
                  <Input
                    label={idx === 0 ? 'System Qty' : undefined}
                    type="number"
                    value={li.system_quantity}
                    onChange={(v) => { const copy = [...lineItems]; copy[idx].system_quantity = v; setLineItems(copy) }}
                    placeholder="Auto"
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
            {submitting ? 'Creating…' : 'Create Stock Count'}
          </Button>
        </div>
      </Modal>

      {/* Detail / Record / Apply Modal */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail ? `Stock Count ${detail.number}` : ''} size="xl">
        {detailLoading ? <Spinner /> : detail && (
          <>
            {formError && <ErrorBanner message={formError} />}
            <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
              <div><span className="text-ink-muted">Status:</span> <Badge status={detail.status}>{detail.status}</Badge></div>
              <div><span className="text-ink-muted">Warehouse:</span> {detail.warehouse?.name ?? '—'}</div>
              <div><span className="text-ink-muted">Type:</span> <span className="capitalize">{detail.type}</span></div>
              <div><span className="text-ink-muted">Created:</span> {new Date(detail.created_at).toLocaleDateString()}</div>
            </div>

            <Table headers={['Product', 'Bin', 'System Qty', 'Counted Qty', 'Variance']}>
              {(detail.items ?? []).map((item) => (
                <tr key={item.id} className="border-b border-border">
                  <td className="px-4 py-2 text-ink">{item.product?.name ?? `Product #${item.product_id}`}</td>
                  <td className="px-4 py-2 text-ink-muted">{item.bin_id ?? '—'}</td>
                  <td className="px-4 py-2 text-ink-muted text-right tabular-nums">{item.system_quantity}</td>
                  <td className="px-4 py-2">
                    {detail.status === 'open' ? (
                      <input
                        type="number"
                        value={recordForm[item.id] ?? ''}
                        onChange={(e) => setRecordForm({ ...recordForm, [item.id]: e.target.value })}
                        placeholder="—"
                        className="w-24 border border-border rounded-lg px-2.5 py-1.5 text-sm text-ink focus:ring-2 focus:ring-brand/40 focus:border-brand outline-none transition tabular-nums"
                      />
                    ) : (
                      <span className="tabular-nums">{item.counted_quantity ?? '—'}</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    <span className={Number(item.variance) < 0 ? 'text-red' : Number(item.variance) > 0 ? 'text-mint' : 'text-ink-muted'}>
                      {item.variance}
                    </span>
                  </td>
                </tr>
              ))}
            </Table>

            <div className="flex justify-between items-center mt-4">
              <Button variant="secondary" onClick={() => setDetail(null)}>Close</Button>
              <div className="flex gap-2">
                {detail.status === 'open' && (
                  <Button variant="secondary" onClick={recordCount} disabled={submitting}>
                    <Play size={16} /> {submitting ? 'Saving…' : 'Save Counts'}
                  </Button>
                )}
                {(detail.status === 'open' || detail.status === 'counted') && (
                  <Button onClick={applyCount} disabled={applyLoading}>
                    <CheckCircle2 size={16} /> {applyLoading ? 'Applying…' : 'Apply to Inventory'}
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}