import { useEffect, useState } from 'react'
import { get, getList, post } from '../services/apiClient'
import { Card, Badge, Table, TableSkeleton, ErrorBanner, EmptyState, Button, Select, PageHeader, Pagination, Modal, SearchInput, Toast, ConfirmDialog } from '../components/ui'
import { ArrowLeftRight, Plus, X } from 'lucide-react'

interface Transfer {
  id: number
  number: string
  source_warehouse_id: number
  source_warehouse?: { name: string }
  destination_warehouse_id: number
  destination_warehouse?: { name: string }
  status: string
  created_at: string
  items?: { id: number; product_id: number; quantity: string; picked_quantity: string; received_quantity: string; product?: { sku: string; name: string } }[]
}

interface Ref { id: number; name: string }

export default function Transfers() {
  const [transfers, setTransfers] = useState<Transfer[]>([])
  const [meta, setMeta] = useState({ total: 0, current_page: 1, last_page: 1 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [warehouses, setWarehouses] = useState<Ref[]>([])
  const [products, setProducts] = useState<Ref[]>([])
  const [form, setForm] = useState({ source_warehouse_id: '', destination_warehouse_id: '' })
  const [items, setItems] = useState([{ product_id: '', quantity: '1' }])
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [toastType, setToastType] = useState<'success' | 'error'>('success')
  const [cancelTarget, setCancelTarget] = useState<{ id: number; number: string } | null>(null)
  const [task, setTask] = useState<{ t: Transfer; mode: 'pick' | 'receive' } | null>(null)
  const [taskQty, setTaskQty] = useState<Record<number, string>>({})
  const [taskErr, setTaskErr] = useState<string | null>(null)

  const openTask = (t: Transfer, mode: 'pick' | 'receive') => {
    const q: Record<number, string> = {}
    t.items?.forEach((i) => {
      const left = mode === 'pick' ? Number(i.quantity) - Number(i.picked_quantity) : Number(i.picked_quantity) - Number(i.received_quantity)
      q[i.id] = String(Math.max(0, left))
    })
    setTaskQty(q)
    setTaskErr(null)
    setTask({ t, mode })
  }

  const submitTask = async () => {
    if (!task) return
    const key = task.mode === 'pick' ? 'transfer_item_id' : 'transfer_item_id'
    const items = Object.entries(taskQty).filter(([, v]) => Number(v) > 0).map(([id, v]) => ({ [key]: Number(id), quantity: Number(v) }))
    if (items.length === 0) return setTaskErr('Enter at least one quantity.')
    setSubmitting(true)
    try {
      await post(`/transfers/${task.t.id}/${task.mode}`, { items })
      setToastType('success')
      setToast(task.mode === 'pick' ? 'Items picked from source bins' : 'Items received into destination warehouse')
      setTask(null)
      load(meta.current_page)
    } catch (e: unknown) {
      setTaskErr((e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Action failed')
    } finally {
      setSubmitting(false)
    }
  }

  const load = (p = 1) => {
    setLoading(true)
    setError(null)
    getList<Transfer>('/transfers', { page: p, per_page: 15 })
      .then((resp) => {
        setTransfers(resp.data)
        setMeta({ total: resp.total, current_page: resp.current_page, last_page: resp.last_page })
      })
      .catch((e) => setError(e?.response?.data?.message || 'Failed to load transfers'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load(1) }, [])

  useEffect(() => {
    Promise.all([
      getList<Ref>('/warehouses', { per_page: 100 }),
      getList<Ref>('/products', { per_page: 100 }),
    ])
      .then(([w, p]) => { setWarehouses(w.data); setProducts(p.data) })
      .catch(() => {})
  }, [])

  const submit = async () => {
    setSubmitting(true); setFormError(null)
    try {
      await post('/transfers', {
        source_warehouse_id: Number(form.source_warehouse_id),
        destination_warehouse_id: Number(form.destination_warehouse_id),
        items: items.filter((i) => i.product_id).map((i) => ({
          product_id: Number(i.product_id),
          quantity: Number(i.quantity),
        })),
      })
      setShowForm(false)
      setForm({ source_warehouse_id: '', destination_warehouse_id: '' })
      setItems([{ product_id: '', quantity: '1' }])
      setToast('Transfer created successfully')
      load(1)
    } catch (e: unknown) {
      setFormError(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          'Failed to create transfer'
      )
    } finally {
      setSubmitting(false)
    }
  }

  const act = async (id: number, action: string) => {
    try {
      await post(`/transfers/${id}/${action}`)
      setToastType('success')
      setToast(`Transfer ${action.replace('-', ' ')} successful`)
      load(meta.current_page)
    } catch (e: unknown) {
      setToast((e as { response?: { data?: { message?: string } } })?.response?.data?.message || `Failed to ${action}`)
      setToastType('error')
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Transfers"
        subtitle={`${meta.total} inter-warehouse transfers`}
        actions={
          <Button onClick={() => setShowForm(true)}><Plus size={16} /> New Transfer</Button>
        }
      />

      {error && <ErrorBanner message={error} />}

      <Modal open={showForm} onClose={() => setShowForm(false)} title="Create Transfer" size="lg">
        {formError && <ErrorBanner message={formError} />}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
          <Select label="From Warehouse" value={form.source_warehouse_id} onChange={(v) => setForm({ ...form, source_warehouse_id: v })}
            options={warehouses.map((w) => ({ value: w.id, label: w.name }))} />
          <Select label="To Warehouse" value={form.destination_warehouse_id} onChange={(v) => setForm({ ...form, destination_warehouse_id: v })}
            options={warehouses.filter((w) => Number(w.id) !== Number(form.source_warehouse_id)).map((w) => ({ value: w.id, label: w.name }))} />
        </div>
        <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted mb-2">Items</p>
        <div className="space-y-2 mb-3">
          {items.map((item, i) => (
            <div key={i} className="flex gap-2">
              <select value={item.product_id}
                className="flex-1 border border-border rounded-lg px-3 py-2 text-sm text-ink bg-surface focus:ring-2 focus:ring-brand/40 focus:border-brand outline-none"
                onChange={(e) => {
                  const c = [...items]; c[i] = { ...c[i], product_id: e.target.value }
                  setItems(c)
                }}>
                <option value="">— Select product —</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <input type="number" min="0.001" step="0.001" value={item.quantity}
                className="w-24 border border-border rounded-lg px-3 py-2 text-sm text-ink bg-surface focus:ring-2 focus:ring-brand/40 focus:border-brand outline-none"
                onChange={(e) => {
                  const c = [...items]; c[i] = { ...c[i], quantity: e.target.value }
                  setItems(c)
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
          <Button onClick={submit} disabled={submitting || !form.source_warehouse_id || !form.destination_warehouse_id || items.some((i) => !i.product_id)}>
            {submitting ? 'Creating…' : 'Create Transfer'}
          </Button>
        </div>
      </Modal>

      <Modal open={!!task} onClose={() => setTask(null)} title={task ? `${task.mode === 'pick' ? 'Pick' : 'Receive'} · ${task.t.number}` : ''}>
        {taskErr && <ErrorBanner message={taskErr} />}
        <p className="text-xs text-ink-muted mb-3">
          {task?.mode === 'pick'
            ? `Stock is taken from the bins holding it in ${task?.t.source_warehouse?.name ?? 'the source warehouse'} (largest first).`
            : `Received stock lands in the staging area of ${task?.t.destination_warehouse?.name ?? 'the destination'} — create a putaway batch to shelve it.`}
        </p>
        <div className="space-y-2 mb-4">
          {task?.t.items?.map((i) => {
            const left = task.mode === 'pick' ? Number(i.quantity) - Number(i.picked_quantity) : Number(i.picked_quantity) - Number(i.received_quantity)
            return (
              <div key={i.id} className="flex items-center gap-3 border border-border rounded-lg px-3 py-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink truncate">{i.product?.name ?? `Product #${i.product_id}`}</p>
                  <p className="text-[11px] text-ink-muted font-mono">{i.product?.sku} · {left} remaining</p>
                </div>
                <input type="number" min="0" max={left} value={taskQty[i.id] ?? '0'} disabled={left <= 0}
                  onChange={(e) => setTaskQty({ ...taskQty, [i.id]: e.target.value })}
                  className="w-24 border border-border rounded-lg px-2 py-1.5 text-sm text-right" aria-label="Quantity" />
              </div>
            )
          })}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setTask(null)}>Cancel</Button>
          <Button onClick={submitTask} disabled={submitting}>{submitting ? 'Saving…' : task?.mode === 'pick' ? 'Confirm pick' : 'Confirm receipt'}</Button>
        </div>
      </Modal>

      <Card>
        {loading ? (
          <TableSkeleton cols={7} />
        ) : transfers.length === 0 ? (
          <EmptyState message="No transfers found." icon={<ArrowLeftRight size={28} />} />
        ) : (
          <Table headers={['Transfer #', 'From', 'To', 'Status', 'Items', 'Created', 'Actions']}>
            {transfers.map((t) => (
              <tr key={t.id} className="hover:bg-surface-subtle/60 transition">
                <td className="px-4 py-3 font-mono text-xs font-semibold text-brand">{t.number}</td>
                <td className="px-4 py-3 font-medium text-ink">{t.source_warehouse?.name || '—'}</td>
                <td className="px-4 py-3 font-medium text-ink">{t.destination_warehouse?.name || '—'}</td>
                <td className="px-4 py-3"><Badge status={t.status}>{t.status.replace(/_/g, ' ')}</Badge></td>
                <td className="px-4 py-3 text-ink-muted tabular-nums">{t.items?.length || 0}</td>
                <td className="px-4 py-3 text-xs text-ink-muted">{new Date(t.created_at).toLocaleDateString()}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    {t.status === 'draft' && <Button size="sm" variant="secondary" onClick={() => act(t.id, 'submit')}>Submit</Button>}
                    {t.status === 'requested' && <Button size="sm" onClick={() => act(t.id, 'approve')}>Approve</Button>}
                    {t.status === 'approved' && <Button size="sm" variant="secondary" onClick={() => act(t.id, 'start-picking')}>Start Pick</Button>}
                    {t.status === 'picking' && (t.items ?? []).some((i) => Number(i.picked_quantity) < Number(i.quantity)) && (
                      <Button size="sm" variant="secondary" onClick={() => openTask(t, 'pick')}>Pick</Button>
                    )}
                    {t.status === 'picking' && (t.items ?? []).every((i) => Number(i.picked_quantity) >= Number(i.quantity)) && (
                      <Button size="sm" onClick={() => act(t.id, 'ship')}>Dispatch</Button>
                    )}
                    {['in_transit', 'partially_received'].includes(t.status) && <Button size="sm" onClick={() => openTask(t, 'receive')}>Receive</Button>}
                    {['draft', 'requested', 'approved', 'picking'].includes(t.status) && <Button size="sm" variant="danger" onClick={() => setCancelTarget({ id: t.id, number: t.number })}>Cancel</Button>}
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        )}
        <Pagination currentPage={meta.current_page} lastPage={meta.last_page} onChange={load} />
      </Card>
    </div>
  )
}