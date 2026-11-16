import { useCallback, useEffect, useState } from 'react'
import { PackageCheck, Plus, MapPin, ArrowRight } from 'lucide-react'
import { get, getList, post } from '../services/apiClient'
import {
  Card, Badge, Table, TableSkeleton, ErrorBanner, EmptyState, Button, PageHeader, Pagination, Modal, Select, Toast,
} from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { errMsg, fmtNum } from '../lib/errors'

interface BatchItem {
  id: number
  product_id: number
  product?: { sku: string; name: string }
  destination_bin?: { id: number; code: string } | null
  destination_bin_id: number
  quantity: string
  putaway_quantity: string
  status: string
}
interface Batch {
  id: number
  number: string
  status: string
  created_at: string
  warehouse?: { name: string; code: string }
  items?: BatchItem[]
}
interface Ref { id: number; code?: string; name: string }
interface BinRef { id: number; code: string; full_code?: string }
interface StagingRow { product_id: number; sku: string; product_name: string; quantity_on_hand: string; bin_id: number | null }

export default function Putaway() {
  const { hasPermission } = useAuth()
  const canExecute = hasPermission('putaway.execute')
  const [batches, setBatches] = useState<Batch[]>([])
  const [meta, setMeta] = useState({ total: 0, current_page: 1, last_page: 1 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  // create
  const [showForm, setShowForm] = useState(false)
  const [warehouses, setWarehouses] = useState<Ref[]>([])
  const [warehouseId, setWarehouseId] = useState('')
  const [staging, setStaging] = useState<StagingRow[]>([])
  const [bins, setBins] = useState<BinRef[]>([])
  const [lines, setLines] = useState<Record<number, { qty: string; bin: string }>>({})
  const [formErr, setFormErr] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // execute
  const [active, setActive] = useState<Batch | null>(null)
  const [execQty, setExecQty] = useState<Record<number, string>>({})
  const [execErr, setExecErr] = useState<string | null>(null)

  const load = useCallback((page = 1) => {
    setLoading(true)
    setError(null)
    getList<Batch>('/putaway', { page, per_page: 15 })
      .then((r) => { setBatches(r.data); setMeta({ total: r.total, current_page: r.current_page, last_page: r.last_page }) })
      .catch((e) => setError(errMsg(e, 'Failed to load putaway batches')))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load(1) }, [load])
  useEffect(() => { get<Ref[]>('/warehouses', { per_page: 100 }).then((w) => setWarehouses(Array.isArray(w) ? w : [])).catch(() => {}) }, [])

  useEffect(() => {
    if (!showForm || !warehouseId) { setStaging([]); setBins([]); return }
    getList<StagingRow>('/stock', { warehouse_id: warehouseId, per_page: 100 })
      .then((r) => {
        const rows = r.data.filter((x) => x.bin_id === null && Number(x.quantity_on_hand) > 0)
        setStaging(rows)
        const init: Record<number, { qty: string; bin: string }> = {}
        rows.forEach((x) => { init[x.product_id] = { qty: String(Number(x.quantity_on_hand)), bin: '' } })
        setLines(init)
      })
      .catch(() => setStaging([]))
    get<BinRef[]>('/locations', { type: 'bin', warehouse_id: warehouseId }).then(setBins).catch(() => setBins([]))
  }, [showForm, warehouseId])

  const createBatch = async () => {
    setFormErr(null)
    const items = staging
      .map((s) => ({ product_id: s.product_id, quantity: Number(lines[s.product_id]?.qty || 0), destination_bin_id: Number(lines[s.product_id]?.bin || 0) }))
      .filter((i) => i.quantity > 0)
    if (items.length === 0) return setFormErr('Enter a quantity for at least one item.')
    if (items.some((i) => !i.destination_bin_id)) return setFormErr('Choose a destination bin for every line with a quantity.')
    setSaving(true)
    try {
      await post('/putaway', { warehouse_id: Number(warehouseId), items })
      setShowForm(false)
      setToast('Putaway batch created')
      load(1)
    } catch (e) {
      setFormErr(errMsg(e, 'Could not create batch'))
    } finally {
      setSaving(false)
    }
  }

  const openBatch = async (b: Batch) => {
    setExecErr(null)
    try {
      const d = await get<Batch>(`/putaway/${b.id}`)
      setActive(d)
      const q: Record<number, string> = {}
      d.items?.forEach((i) => { q[i.id] = String(Math.max(0, Number(i.quantity) - Number(i.putaway_quantity))) })
      setExecQty(q)
    } catch (e) {
      setError(errMsg(e, 'Could not open batch'))
    }
  }

  const execute = async () => {
    if (!active) return
    const items = Object.entries(execQty).filter(([, v]) => Number(v) > 0).map(([id, v]) => ({ putaway_item_id: Number(id), putaway_quantity: Number(v) }))
    if (items.length === 0) return setExecErr('Enter at least one quantity.')
    setSaving(true)
    try {
      await post(`/putaway/${active.id}/execute`, { items })
      setActive(null)
      setToast('Stock moved from staging into storage bins')
      load(meta.current_page)
    } catch (e) {
      setExecErr(errMsg(e, 'Putaway failed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {toast && <Toast message={toast} type="success" onClose={() => setToast(null)} />}
      <PageHeader
        title="Putaway"
        subtitle="Move received goods from the dock / staging area into storage bins."
        actions={canExecute ? <Button onClick={() => { setWarehouseId(''); setFormErr(null); setShowForm(true) }}><Plus size={15} /> New putaway</Button> : undefined}
      />

      {error && <ErrorBanner message={error} onRetry={() => load(meta.current_page)} />}

      <Card>
        {loading ? <TableSkeleton cols={6} /> : batches.length === 0 ? (
          <EmptyState message="No putaway batches yet. Receive a purchase order, then create a putaway." icon={<PackageCheck size={28} />} />
        ) : (
          <Table headers={['Batch', 'Warehouse', 'Lines', 'Progress', 'Status', 'Created', '']}>
            {batches.map((b) => {
              const total = (b.items ?? []).reduce((s, i) => s + Number(i.quantity), 0)
              const done = (b.items ?? []).reduce((s, i) => s + Number(i.putaway_quantity), 0)
              return (
                <tr key={b.id} className="hover:bg-surface-subtle/60">
                  <td className="px-4 py-2.5 pl-5 font-mono text-xs font-semibold text-blue">{b.number}</td>
                  <td className="px-4 py-2.5 text-ink">{b.warehouse?.name ?? '—'}</td>
                  <td className="px-4 py-2.5 text-ink-muted">{b.items?.length ?? 0}</td>
                  <td className="px-4 py-2.5 w-40">
                    <div className="h-1.5 rounded-full bg-surface-subtle overflow-hidden"><div className="h-full bg-mint rounded-full" style={{ width: `${total ? (done / total) * 100 : 0}%` }} /></div>
                    <p className="text-[11px] text-ink-muted mt-1 tabular-nums">{fmtNum(done)} / {fmtNum(total)} units</p>
                  </td>
                  <td className="px-4 py-2.5"><Badge status={b.status} /></td>
                  <td className="px-4 py-2.5 text-xs text-ink-muted">{new Date(b.created_at).toLocaleString()}</td>
                  <td className="px-4 py-2.5 pr-5 text-right">
                    {canExecute && ['pending', 'in_progress'].includes(b.status) && <Button size="sm" onClick={() => openBatch(b)}>Put away</Button>}
                  </td>
                </tr>
              )
            })}
          </Table>
        )}
        <Pagination currentPage={meta.current_page} lastPage={meta.last_page} onChange={load} />
      </Card>

      <Modal open={showForm} onClose={() => setShowForm(false)} title="New putaway batch" size="lg">
        <div className="space-y-4">
          {formErr && <ErrorBanner message={formErr} />}
          <Select label="Warehouse" required value={warehouseId} onChange={setWarehouseId}
            options={warehouses.map((w) => ({ value: w.id, label: `${w.code ?? ''} · ${w.name}` }))} />
          {warehouseId && (staging.length === 0 ? (
            <EmptyState message="Nothing is waiting in staging for this warehouse." icon={<PackageCheck size={26} />} />
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Items in staging</p>
              {staging.map((s) => (
                <div key={s.product_id} className="flex flex-wrap items-center gap-2 border border-border rounded-lg px-3 py-2">
                  <div className="flex-1 min-w-[160px]">
                    <p className="text-sm font-medium text-ink">{s.product_name}</p>
                    <p className="text-[11px] text-ink-muted font-mono">{s.sku} · {fmtNum(s.quantity_on_hand)} in staging</p>
                  </div>
                  <input type="number" min="0" max={Number(s.quantity_on_hand)} value={lines[s.product_id]?.qty ?? ''} aria-label="Quantity"
                    onChange={(e) => setLines({ ...lines, [s.product_id]: { ...lines[s.product_id], qty: e.target.value } })}
                    className="w-20 border border-border rounded-lg px-2 py-1.5 text-sm text-right" />
                  <ArrowRight size={14} className="text-ink-subtle" />
                  <select value={lines[s.product_id]?.bin ?? ''} aria-label="Destination bin"
                    onChange={(e) => setLines({ ...lines, [s.product_id]: { ...lines[s.product_id], bin: e.target.value } })}
                    className="border border-border rounded-lg px-2 py-1.5 text-sm bg-surface max-w-[220px]">
                    <option value="">Destination bin…</option>
                    {bins.map((b) => <option key={b.id} value={b.id}>{b.full_code ?? b.code}</option>)}
                  </select>
                </div>
              ))}
            </div>
          ))}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={createBatch} disabled={saving || staging.length === 0}>{saving ? 'Creating…' : 'Create batch'}</Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!active} onClose={() => setActive(null)} title={`Put away · ${active?.number ?? ''}`}>
        <div className="space-y-3">
          {execErr && <ErrorBanner message={execErr} />}
          {active?.items?.map((i) => {
            const left = Number(i.quantity) - Number(i.putaway_quantity)
            return (
              <div key={i.id} className="flex items-center gap-3 border border-border rounded-lg px-3 py-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink truncate">{i.product?.name}</p>
                  <p className="text-[11px] text-ink-muted inline-flex items-center gap-1"><MapPin size={11} /> to {i.destination_bin?.code ?? `bin #${i.destination_bin_id}`} · {fmtNum(left)} left</p>
                </div>
                <input type="number" min="0" max={left} disabled={left <= 0} value={execQty[i.id] ?? '0'} aria-label="Quantity"
                  onChange={(e) => setExecQty({ ...execQty, [i.id]: e.target.value })}
                  className="w-24 border border-border rounded-lg px-2 py-1.5 text-sm text-right" />
              </div>
            )
          })}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => setActive(null)}>Close</Button>
            <Button onClick={execute} disabled={saving}>{saving ? 'Moving…' : 'Confirm putaway'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
