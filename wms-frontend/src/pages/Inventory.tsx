import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Boxes, SlidersHorizontal, History, AlertTriangle, Download } from 'lucide-react'
import { get, getList, post } from '../services/apiClient'
import {
  Card, Badge, Table, TableSkeleton, ErrorBanner, EmptyState, PageHeader, Pagination, SearchInput,
  Button, Modal, Input, Select, Toast,
} from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { errMsg, fmtNum } from '../lib/errors'

interface StockRow {
  id: number
  product_id: number
  warehouse_id: number
  bin_id: number | null
  quantity_on_hand: string
  quantity_reserved: string
  quantity_damaged: string
  sku: string
  product_name: string
  warehouse_code: string
  warehouse_name: string
  location: string
  reorder_level: string
}
interface Movement {
  id: number; movement_type: string; quantity: string; reason: string | null; created_at: string
  product?: { sku: string; name: string }; warehouse?: { code: string }; bin?: { code: string } | null; user?: { name: string } | null
}
interface Ref { id: number; code?: string; name: string }
interface BinRef { id: number; code: string; full_code?: string }

export default function Inventory() {
  const [params, setParams] = useSearchParams()
  const { hasPermission } = useAuth()
  const [tab, setTab] = useState<'stock' | 'ledger'>('stock')
  const [rows, setRows] = useState<StockRow[]>([])
  const [moves, setMoves] = useState<Movement[]>([])
  const [meta, setMeta] = useState({ total: 0, current_page: 1, last_page: 1 })
  const [search, setSearch] = useState(params.get('search') ?? '')
  const [warehouseId, setWarehouseId] = useState('')
  const [lowOnly, setLowOnly] = useState(params.get('low_stock') === '1')
  const [warehouses, setWarehouses] = useState<Ref[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  // adjustment modal
  const [adjust, setAdjust] = useState<StockRow | null>(null)
  const [adjQty, setAdjQty] = useState('')
  const [adjReason, setAdjReason] = useState('')
  const [adjErr, setAdjErr] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [newAdj, setNewAdj] = useState(false)
  const [products, setProducts] = useState<{ id: number; sku: string; name: string }[]>([])
  const [bins, setBins] = useState<BinRef[]>([])
  const [form, setForm] = useState({ product_id: '', warehouse_id: '', bin_id: '' })

  const canAdjust = hasPermission('adjustments.create') || hasPermission('stock.adjust')

  const load = useCallback((page = 1) => {
    setLoading(true)
    setError(null)
    const req = tab === 'stock'
      ? getList<StockRow>('/stock', { page, per_page: 20, search: search || undefined, warehouse_id: warehouseId || undefined, low_stock: lowOnly ? 1 : undefined })
          .then((r) => { setRows(r.data); return r })
      : getList<Movement>('/stock-movements', { page, per_page: 20, warehouse_id: warehouseId || undefined })
          .then((r) => { setMoves(r.data); return r })
    req.then((r) => setMeta({ total: r.total, current_page: r.current_page, last_page: r.last_page }))
      .catch((e) => setError(errMsg(e, 'Failed to load inventory')))
      .finally(() => setLoading(false))
  }, [tab, search, warehouseId, lowOnly])

  useEffect(() => { const t = setTimeout(() => load(1), 250); return () => clearTimeout(t) }, [load])
  useEffect(() => {
    get<Ref[]>('/warehouses', { per_page: 100 }).then((w) => setWarehouses(Array.isArray(w) ? w : [])).catch(() => {})
  }, [])
  useEffect(() => {
    const next = new URLSearchParams()
    if (search) next.set('search', search)
    if (lowOnly) next.set('low_stock', '1')
    setParams(next, { replace: true })
  }, [search, lowOnly, setParams])

  const openNew = () => {
    setNewAdj(true)
    setAdjQty(''); setAdjReason(''); setAdjErr(null)
    setForm({ product_id: '', warehouse_id: warehouseId, bin_id: '' })
    if (products.length === 0) getList<{ id: number; sku: string; name: string }>('/products', { per_page: 100 }).then((r) => setProducts(r.data)).catch(() => {})
  }
  useEffect(() => {
    if (!newAdj || !form.warehouse_id) { setBins([]); return }
    get<BinRef[]>('/locations', { type: 'bin', warehouse_id: form.warehouse_id }).then(setBins).catch(() => setBins([]))
  }, [newAdj, form.warehouse_id])

  const saveAdjust = async () => {
    setAdjErr(null)
    const qty = Number(adjQty)
    if (!qty) return setAdjErr('Enter a non-zero quantity (negative to remove stock).')
    if (!adjReason.trim()) return setAdjErr('A reason is required for every adjustment.')
    const target = adjust
      ? { product_id: adjust.product_id, warehouse_id: adjust.warehouse_id, bin_id: adjust.bin_id }
      : { product_id: Number(form.product_id), warehouse_id: Number(form.warehouse_id), bin_id: form.bin_id ? Number(form.bin_id) : null }
    if (!target.product_id || !target.warehouse_id) return setAdjErr('Select a product and warehouse.')
    setSaving(true)
    try {
      await post('/adjustments', { ...target, signed_quantity: qty, reason: adjReason })
      setAdjust(null); setNewAdj(false)
      setToast({ msg: 'Stock adjusted and recorded in the ledger', type: 'success' })
      load(meta.current_page)
    } catch (e) {
      setAdjErr(errMsg(e, 'Adjustment failed'))
    } finally {
      setSaving(false)
    }
  }

  const exportCsv = () => {
    const header = ['SKU', 'Product', 'Warehouse', 'Location', 'On hand', 'Reserved', 'Damaged', 'Available']
    const lines = rows.map((r) => [r.sku, r.product_name, r.warehouse_code, r.location, r.quantity_on_hand, r.quantity_reserved, r.quantity_damaged,
      Number(r.quantity_on_hand) - Number(r.quantity_reserved)].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
    const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `stock_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const MOVE: Record<string, string> = {
    stock_in: 'Received', stock_out: 'Shipped', transfer_in: 'Transfer in', transfer_out: 'Transfer out', adjustment: 'Adjustment',
    return: 'Return', return_damaged: 'Return (damaged)', damage: 'Damaged', reservation: 'Reserved', reservation_release: 'Reservation released',
  }

  return (
    <div className="space-y-4">
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      <PageHeader
        title="Stock Overview"
        subtitle="Bin-level balances and the full movement ledger."
        actions={<>
          {tab === 'stock' && rows.length > 0 && <Button variant="secondary" onClick={exportCsv}><Download size={15} /> Export</Button>}
          {canAdjust && <Button onClick={openNew}><SlidersHorizontal size={15} /> New adjustment</Button>}
        </>}
      />

      <Card>
        <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-border">
          <div className="flex bg-surface-subtle rounded-lg p-0.5 mr-2">
            {([['stock', 'Balances', <Boxes key="b" size={14} />], ['ledger', 'Movement ledger', <History key="h" size={14} />]] as const).map(([k, label, icon]) => (
              <button key={k} onClick={() => setTab(k)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${tab === k ? 'bg-surface text-ink shadow-panel' : 'text-ink-muted hover:text-ink'}`}>
                {icon}{label}
              </button>
            ))}
          </div>
          {tab === 'stock' && <SearchInput placeholder="SKU, product or barcode…" value={search} onChange={setSearch} className="w-64" />}
          <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} aria-label="Warehouse"
            className="border border-border rounded-lg px-3 py-2 text-sm bg-surface text-ink">
            <option value="">All warehouses</option>
            {warehouses.map((w) => <option key={w.id} value={w.id}>{w.code} · {w.name}</option>)}
          </select>
          {tab === 'stock' && (
            <label className="inline-flex items-center gap-2 text-sm text-ink-muted ml-1 cursor-pointer">
              <input type="checkbox" checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} className="rounded border-border" />
              <AlertTriangle size={14} className="text-amber" /> Low stock only
            </label>
          )}
          <span className="ml-auto text-xs text-ink-muted">{fmtNum(meta.total)} {tab === 'stock' ? 'balances' : 'movements'}</span>
        </div>

        {error && <div className="p-4"><ErrorBanner message={error} onRetry={() => load(meta.current_page)} /></div>}

        {loading ? <TableSkeleton cols={8} /> : tab === 'stock' ? (
          rows.length === 0 ? <EmptyState message="No stock matches these filters." icon={<Boxes size={28} />} /> : (
            <Table headers={['Product', 'Warehouse', 'Location', 'On hand', 'Reserved', 'Damaged', 'Available', ...(canAdjust ? [''] : [])]}>
              {rows.map((r) => {
                const onHand = Number(r.quantity_on_hand)
                const reserved = Number(r.quantity_reserved)
                const damaged = Number(r.quantity_damaged)
                const available = onHand - reserved
                const isPool = !r.bin_id && onHand === 0 && reserved > 0
                return (
                  <tr key={r.id} className="hover:bg-surface-subtle/60 transition">
                    <td className="px-4 py-2.5 pl-5">
                      <p className="font-medium text-ink">{r.product_name}</p>
                      <p className="font-mono text-[11px] text-ink-muted">{r.sku}</p>
                    </td>
                    <td className="px-4 py-2.5 text-ink-muted"><span className="font-mono text-xs">{r.warehouse_code}</span></td>
                    <td className="px-4 py-2.5">
                      {isPool ? <span className="text-xs text-ink-muted italic">Order reservations</span>
                        : r.bin_id ? <span className="font-mono text-xs text-ink bg-surface-subtle px-1.5 py-0.5 rounded">{r.location}</span>
                        : <Badge status="pending">Staging</Badge>}
                    </td>
                    <td className="px-4 py-2.5 font-semibold tabular-nums">{fmtNum(onHand)}</td>
                    <td className="px-4 py-2.5 tabular-nums">{reserved > 0 ? <span className="text-amber font-semibold">{fmtNum(reserved)}</span> : <span className="text-ink-subtle">0</span>}</td>
                    <td className="px-4 py-2.5 tabular-nums">{damaged > 0 ? <Badge status="damaged">{fmtNum(damaged)}</Badge> : <span className="text-ink-subtle">0</span>}</td>
                    <td className="px-4 py-2.5 tabular-nums">
                      {isPool ? <span className="text-ink-subtle">—</span> : <span className={`font-semibold ${available <= 0 ? 'text-red' : 'text-mint'}`}>{fmtNum(available)}</span>}
                    </td>
                    {canAdjust && (
                      <td className="px-4 py-2.5 pr-5 text-right">
                        {!isPool && <Button size="sm" variant="ghost" onClick={() => { setAdjust(r); setAdjQty(''); setAdjReason(''); setAdjErr(null) }}>Adjust</Button>}
                      </td>
                    )}
                  </tr>
                )
              })}
            </Table>
          )
        ) : moves.length === 0 ? <EmptyState message="No movements recorded." icon={<History size={28} />} /> : (
          <Table headers={['Date', 'Type', 'Product', 'Warehouse / bin', 'Quantity', 'User', 'Reason']}>
            {moves.map((m) => (
              <tr key={m.id} className="hover:bg-surface-subtle/60">
                <td className="px-4 py-2.5 pl-5 text-xs text-ink-muted whitespace-nowrap">{new Date(m.created_at).toLocaleString()}</td>
                <td className="px-4 py-2.5 text-xs font-semibold text-ink">{MOVE[m.movement_type] ?? m.movement_type}</td>
                <td className="px-4 py-2.5"><span className="font-mono text-xs text-ink-muted mr-1">{m.product?.sku}</span>{m.product?.name}</td>
                <td className="px-4 py-2.5 font-mono text-xs text-ink-muted">{m.warehouse?.code}{m.bin ? ` / ${m.bin.code}` : ''}</td>
                <td className="px-4 py-2.5 font-semibold tabular-nums">{fmtNum(m.quantity, 3)}</td>
                <td className="px-4 py-2.5 text-xs text-ink-muted">{m.user?.name ?? '—'}</td>
                <td className="px-4 py-2.5 text-xs text-ink-muted max-w-[240px] truncate" title={m.reason ?? ''}>{m.reason ?? '—'}</td>
              </tr>
            ))}
          </Table>
        )}
        <Pagination currentPage={meta.current_page} lastPage={meta.last_page} onChange={load} />
      </Card>

      <Modal open={!!adjust || newAdj} onClose={() => { setAdjust(null); setNewAdj(false) }} title="Stock adjustment">
        <div className="space-y-4">
          {adjErr && <ErrorBanner message={adjErr} />}
          {adjust ? (
            <div className="rounded-lg bg-surface-subtle px-4 py-3 text-sm">
              <p className="font-semibold text-ink">{adjust.product_name} <span className="font-mono text-xs text-ink-muted">{adjust.sku}</span></p>
              <p className="text-xs text-ink-muted mt-0.5">{adjust.warehouse_code} · {adjust.bin_id ? adjust.location : 'Staging'} · on hand {fmtNum(adjust.quantity_on_hand)}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <Select label="Product" required value={form.product_id} onChange={(v) => setForm({ ...form, product_id: v })}
                  options={products.map((p) => ({ value: p.id, label: `${p.sku} · ${p.name}` }))} />
              </div>
              <Select label="Warehouse" required value={form.warehouse_id} onChange={(v) => setForm({ ...form, warehouse_id: v, bin_id: '' })}
                options={warehouses.map((w) => ({ value: w.id, label: `${w.code} · ${w.name}` }))} />
              <Select label="Bin (empty = staging)" value={form.bin_id} onChange={(v) => setForm({ ...form, bin_id: v })}
                options={bins.map((b) => ({ value: b.id, label: b.full_code ?? b.code }))} />
            </div>
          )}
          <Input label="Quantity change" type="number" required value={adjQty} onChange={setAdjQty} placeholder="e.g. 5 or -3"
            helper="Positive adds stock (found / correction), negative removes it (loss, write-off)." />
          <Input label="Reason" required value={adjReason} onChange={setAdjReason} placeholder="e.g. Cycle count correction, damaged in handling" />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => { setAdjust(null); setNewAdj(false) }}>Cancel</Button>
            <Button onClick={saveAdjust} disabled={saving}>{saving ? 'Saving…' : 'Post adjustment'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
