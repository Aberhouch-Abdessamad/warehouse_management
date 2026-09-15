import { useEffect, useState } from 'react'
import { getList, get, post } from '../services/apiClient'
import { Card, Badge, Table, Spinner, ErrorBanner, EmptyState, Button, Input, Select, Pagination, Modal } from '../components/ui'
import { Package } from 'lucide-react'

interface Batch {
  id: number
  number: string
  status: string
  created_at: string
  completed_at?: string | null
  warehouse?: { name: string }
  items?: { id: number; product_id: number; quantity: string; putaway_quantity: string; status: string }[]
}

export default function Putaway() {
  const [batches, setBatches] = useState<Batch[]>([])
  const [meta, setMeta] = useState({ total: 0, current_page: 1, last_page: 1 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ warehouse_id: '', goods_receipt_id: '' })
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null)
  const [executing, setExecuting] = useState(false)

  const load = (page = 1) => {
    setLoading(true)
    setError(null)
    getList<Batch>('/putaway', { page, per_page: 10 })
      .then(r => {
        setBatches(r.data)
        setMeta({ total: r.total, current_page: r.current_page, last_page: r.last_page })
      })
      .catch(e => setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to load batches'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load(1) }, [])

  const submitBatch = async () => {
    setSubmitting(true)
    setFormError(null)
    try {
      await post('/putaway', {
        warehouse_id: form.warehouse_id || null,
        goods_receipt_id: form.goods_receipt_id || null,
        items: [],
      })
      setShowForm(false)
      setForm({ warehouse_id: '', goods_receipt_id: '' })
      load(1)
    } catch (e: unknown) {
      setFormError((e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Create failed')
    } finally {
      setSubmitting(false)
    }
  }

  const executeAll = async () => {
    if (!selectedBatch?.items?.length) return
    setExecuting(true)
    try {
      const items = selectedBatch.items.map(i => ({
        putaway_item_id: i.id,
        putaway_quantity: Number(i.putaway_quantity) || 0,
      }))
      await post(`/putaway/${selectedBatch.id}/execute`, { items })
      setSelectedBatch(null)
      load(1)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Execute failed'
      alert(msg)
    } finally {
      setExecuting(false)
    }
  }

  const openBatch = async (b: Batch) => {
    try {
      const detail = await get<Batch>(`/putaway/${b.id}`)
      setSelectedBatch(detail)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to load batch'
      alert(msg)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">Putaway</h1>
          <p className="text-sm text-ink-muted">Receive goods from receiving dock to storage bins.</p>
        </div>
        <div className="flex gap-2">
          <Badge status="active">Batches: {meta.total}</Badge>
          <Button onClick={() => setShowForm(true)}>New Batch</Button>
        </div>
      </div>

      {error && <ErrorBanner message={error} />}

      <Card>
        {loading ? <Spinner /> : batches.length === 0 ? (
          <EmptyState message="No putaway batches found." icon={<Package size={28} />} />
        ) : (
          <Table headers={['Batch #', 'Warehouse', 'Status', 'Created', 'Actions']}>
            {batches.map(b => (
              <tr key={b.id} className="hover:bg-surface-subtle/60 transition">
                <td className="px-3 py-2 font-mono text-xs">{b.number}</td>
                <td className="px-3 py-2 text-ink">{b.warehouse?.name ?? '—'}</td>
                <td className="px-3 py-2"><Badge status={b.status}>{b.status}</Badge></td>
                <td className="px-3 py-2 text-xs text-ink-muted">{new Date(b.created_at).toLocaleDateString()}</td>
                <td className="px-3 py-2 flex gap-1">
                  {b.status === 'pending' && (
                    <Button size="sm" variant="secondary" onClick={() => openBatch(b)}>Execute</Button>
                  )}
                </td>
              </tr>
            ))}
          </Table>
        )}
        <Pagination currentPage={meta.current_page} lastPage={meta.last_page} onChange={load} />
      </Card>

      {selectedBatch && (
        <Card className="border-blue-200">
          <div className="flex items-center justify-between mb-3">
            <strong>Execute Batch {selectedBatch.number}</strong>
            <Button size="sm" variant="secondary" onClick={() => setSelectedBatch(null)}>Cancel</Button>
          </div>
          <p className="text-sm text-ink-muted mb-3">{selectedBatch.items?.length ?? 0} item(s) ready to put away.</p>
          <div className="flex justify-end gap-2 mt-3">
            <Button onClick={executeAll} disabled={executing}>
              {executing ? 'Putting away…' : 'Execute Putaway'}
            </Button>
          </div>
        </Card>
      )}

      <Modal open={showForm} onClose={() => setShowForm(false)} title="Create New Batch">
        {formError && <ErrorBanner message={formError} />}
        <Input
          label="Warehouse"
          value={form.warehouse_id}
          onChange={v => setForm({ ...form, warehouse_id: v })}
          placeholder="Warehouse ID (optional — auto-selected if blank)"
        />
        <Input
          label="Goods Receipt"
          value={form.goods_receipt_id}
          onChange={v => setForm({ ...form, goods_receipt_id: v })}
          placeholder="Goods Receipt ID (optional)"
        />
        <p className="text-xs text-ink-muted mt-1">Items are attached after creation via the receiving flow.</p>
        <div className="flex justify-end gap-2 mt-3">
          <Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
          <Button onClick={submitBatch} disabled={submitting}>{submitting ? 'Creating…' : 'Create'}</Button>
        </div>
      </Modal>
    </div>
  )
}