import { useEffect, useState } from 'react'
import { get, getList, post } from '../services/apiClient'
import { Card, Badge, Table, TableSkeleton, ErrorBanner, EmptyState, Button, PageHeader, Pagination, Toast } from '../components/ui'
import { ScanBarcode, MapPin, Package, CheckCircle2 } from 'lucide-react'

interface PickItem {
  id: number
  product_id: number
  product?: { id: number; name: string; sku: string }
  bin?: { id: number; code: string } | null
  bin_id?: number | null
  bin_stock?: { bin_id: number; code: string; on_hand: number }[]
  required_quantity: string
  picked_quantity: string
  status: string
}

interface PickList {
  id: number
  number: string
  status: string
  warehouse?: { name: string }
  sales_order?: { number: string; customer?: { name: string } }
  items?: PickItem[]
}

interface SalesOrder {
  id: number
  number: string
  status: string
  customer?: { name: string }
  warehouse?: { name: string }
  items?: { id: number; product?: { name: string; sku: string }; quantity: string }[]
}

export default function Picking() {
  const [orders, setOrders] = useState<SalesOrder[]>([])
  const [meta, setMeta] = useState({ total: 0, current_page: 1, last_page: 1 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [active, setActive] = useState<SalesOrder | null>(null)
  const [pickList, setPickList] = useState<PickList | null>(null)
  const [pickedQty, setPickedQty] = useState<Record<number, string>>({})
  const [pickBin, setPickBin] = useState<Record<number, string>>({})

  const initFrom = (pl: PickList) => {
    const q: Record<number, string> = {}
    const b: Record<number, string> = {}
    pl.items?.forEach((item) => {
      q[item.id] = String(Math.max(0, Number(item.required_quantity) - Number(item.picked_quantity)))
      b[item.id] = item.bin_id ? String(item.bin_id) : ''
    })
    setPickedQty(q)
    setPickBin(b)
  }
  const [submitting, setSubmitting] = useState(false)
  const [taskError, setTaskError] = useState<string | null>(null)
  const [taskSuccess, setTaskSuccess] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const load = (page = 1) => {
    setLoading(true)
    setError(null)
    getList<SalesOrder>('/sales-orders', { page, per_page: 15, status: 'confirmed,picking' })
      .then((resp) => {
        setOrders(resp.data)
        setMeta({ total: resp.total, current_page: resp.current_page, last_page: resp.last_page })
      })
      .catch((e: unknown) => setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to load picking queue'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load(1) }, [])

  const openTask = async (so: SalesOrder) => {
    setTaskError(null)
    setTaskSuccess(null)
    setActive(so)
    try {
      const resp = await get<PickList>(`/picking/${so.id}`)
      setPickList(resp)
      initFrom(resp)
    } catch (e: unknown) {
      setTaskError((e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to load pick list')
      setActive(null)
    }
  }

  const submitPick = async () => {
    if (!active || !pickList) return
    setSubmitting(true)
    setTaskError(null)
    try {
      const items = (pickList.items ?? [])
        .filter((i) => Number(pickedQty[i.id]) > 0)
        .map((i) => ({
          pick_list_item_id: i.id,
          picked_quantity: Number(pickedQty[i.id]),
          bin_id: pickBin[i.id] ? Number(pickBin[i.id]) : null,
        }))
      if (items.length === 0) {
        setTaskError('Enter at least one picked quantity.')
        setSubmitting(false)
        return
      }
      const updated = await post<PickList>(`/picking/${active.id}/pick`, { items })
      if (updated?.status === 'completed') {
        setToast(`${active.number} fully picked — ready for packing`)
        setActive(null)
        setPickList(null)
        load(meta.current_page)
        return
      }
      setTaskSuccess('Picks recorded. Remaining lines are still open.')
      setToast('Picks recorded successfully')
      await loadPickList(active.id)
    } catch (e: unknown) {
      setTaskError((e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to record picks')
    } finally {
      setSubmitting(false)
    }
  }

  const loadPickList = async (soId: number) => {
    const resp = await get<PickList>(`/picking/${soId}`)
    setPickList(resp)
    initFrom(resp)
  }

  const complete = async () => {
    if (!active) return
    setSubmitting(true)
    setTaskError(null)
    try {
      await post(`/picking/${active.id}/complete`)
      setTaskSuccess('Pick list completed. Order is ready for packing.')
      setToast('Pick list completed — order ready for packing')
      setActive(null)
      setPickList(null)
      load(meta.current_page)
    } catch (e: unknown) {
      setTaskError((e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to complete picking')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Picking" subtitle="Pick confirmed orders from their suggested bins. Stock leaves the bin when the order ships." />

      {error && <ErrorBanner message={error} onRetry={() => load(meta.current_page)} />}

      {active ? (
        <Card>
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-soft text-amber flex items-center justify-center">
                <Package size={20} />
              </div>
              <div>
                <p className="font-semibold text-ink text-sm">{active.number} · {active.customer?.name ?? '—'}</p>
                <p className="text-xs text-ink-muted">Pick list {pickList?.number ?? '—'} · {pickList?.warehouse?.name ?? ''}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {pickList && <Badge status={pickList.status} />}
              <Button variant="ghost" size="sm" onClick={() => { setActive(null); setPickList(null) }}>Close</Button>
            </div>
          </div>

          {taskError && <div className="px-5 pt-4"><ErrorBanner message={taskError} /></div>}
          {taskSuccess && (
            <div className="px-5 pt-4">
              <div className="bg-mint-soft border border-mint/30 text-mint px-4 py-3 rounded-lg text-sm mb-4 flex items-center gap-2">
                <CheckCircle2 size={16} className="shrink-0" /> {taskSuccess}
              </div>
            </div>
          )}

          <div className="px-5 py-4">
            <div className="flex items-center gap-2 mb-4">
              <ScanBarcode size={16} className="text-ink-muted" />
              <span className="text-xs font-semibold text-ink-muted uppercase tracking-wider">Pick lines</span>
            </div>
            <div className="space-y-2">
              {(pickList?.items ?? []).map((item) => {
                const req = Number(item.required_quantity)
                const done = Number(item.picked_quantity)
                const remaining = Math.max(0, req - done)
                const isDone = remaining === 0
                return (
                  <div key={item.id} className={`border rounded-lg p-3 ${isDone ? 'bg-mint-soft/40 border-mint/30' : 'border-border'}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-ink">{item.product?.name ?? `Product #${item.product_id}`}</p>
                        <p className="text-xs text-ink-muted font-mono">{item.product?.sku ?? '—'}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {!isDone && (item.bin_stock?.length ?? 0) > 0 ? (
                          <label className="inline-flex items-center gap-1 text-xs text-ink-muted">
                            <MapPin size={12} />
                            <select value={pickBin[item.id] ?? ''} onChange={(e) => setPickBin({ ...pickBin, [item.id]: e.target.value })}
                              className="border border-border rounded-md px-1.5 py-1 text-xs text-ink bg-surface" aria-label="Pick from bin">
                              {item.bin_stock!.map((b) => <option key={b.bin_id} value={b.bin_id}>{b.code} · {b.on_hand} on hand</option>)}
                            </select>
                          </label>
                        ) : item.bin && (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-ink bg-surface-subtle px-2 py-1 rounded-md">
                            <MapPin size={12} /> {item.bin.code}
                          </span>
                        )}
                        <span className="text-xs text-ink-muted tabular-nums">{done}/{req}</span>
                        <input
                          type="number"
                          min="0"
                          max={remaining}
                          step="1"
                          value={pickedQty[item.id] ?? '0'}
                          onChange={(e) => setPickedQty({ ...pickedQty, [item.id]: e.target.value })}
                          disabled={isDone}
                          className="w-20 border border-border rounded-lg px-2 py-1.5 text-sm text-ink text-right focus:ring-2 focus:ring-blue/40 focus:border-blue outline-none"
                        />
                      </div>
                    </div>
                    <div className="mt-2 h-1.5 bg-surface-subtle rounded-full overflow-hidden">
                      <div className="h-full bg-mint rounded-full transition-all" style={{ width: `${req > 0 ? Math.min(100, (done / req) * 100) : 0}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="flex items-center justify-between px-5 py-4 border-t border-border bg-surface-subtle/50">
            <p className="text-xs text-ink-muted">
              {pickList?.items?.filter((i) => Number(i.picked_quantity) >= Number(i.required_quantity)).length ?? 0} of {pickList?.items?.length ?? 0} lines complete
            </p>
            <div className="flex gap-2">
              <Button variant="secondary" size="md" onClick={submitPick} disabled={submitting}>
                {submitting ? 'Saving…' : 'Record Picks'}
              </Button>
              <Button size="md" onClick={complete} disabled={submitting}>
                Complete Picking
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <Card>
          {loading ? (
            <TableSkeleton cols={5} />
          ) : orders.length === 0 ? (
            <EmptyState message="No confirmed orders awaiting picking." icon={<CheckCircle2 size={28} />} />
          ) : (
            <Table headers={['Order', 'Customer', 'Lines', 'Status', '']}>
              {orders.map((so) => (
                <tr key={so.id} className="hover:bg-surface-subtle/60">
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-ink">{so.number}</td>
                  <td className="px-4 py-3 text-ink">{so.customer?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-ink-muted">{so.items?.length ?? '—'}</td>
                  <td className="px-4 py-3"><Badge status={so.status} /></td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" onClick={() => openTask(so)}>{so.status === 'picking' ? 'Continue' : 'Start picking'}</Button>
                  </td>
                </tr>
              ))}
            </Table>
          )}
          <Pagination currentPage={meta.current_page} lastPage={meta.last_page} onChange={load} />
        </Card>
      )}

      {toast && <Toast message={toast} type="success" onClose={() => setToast(null)} />}
    </div>
  )
}