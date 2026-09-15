import { useEffect, useState } from 'react'
import { get, getList, post } from '../services/apiClient'
import { Card, Badge, Table, TableSkeleton, ErrorBanner, EmptyState, Button, PageHeader, Pagination, Modal, Input, Toast } from '../components/ui'
import { CheckCircle2, Package } from 'lucide-react'

interface PackageItem {
  id: number
  product?: { id: number; name: string; sku: string }
  quantity: string
}

interface PackageRec {
  id: number
  number: string
  status: string
  weight?: string | null
  width?: string | null
  height?: string | null
  length?: string | null
  warehouse?: { name: string } | null
  sales_order?: { id: number; number: string; customer?: { name: string } } | null
  items?: PackageItem[]
  packed_by?: { name: string } | null
}

interface SalesOrder {
  id: number
  number: string
  status: string
  customer?: { name: string }
  items?: { id: number; product_id: number; product?: { name: string; sku: string }; quantity: string }[]
}

export default function Packing() {
  const [packages, setPackages] = useState<PackageRec[]>([])
  const [meta, setMeta] = useState({ total: 0, current_page: 1, last_page: 1 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [queue, setQueue] = useState<SalesOrder[]>([])
  const [showPicker, setShowPicker] = useState(false)
  const [selected, setSelected] = useState<SalesOrder | null>(null)
  const [quantities, setQuantities] = useState<Record<number, string>>({})
  const [weight, setWeight] = useState('')
  const [length, setLength] = useState('')
  const [width, setWidth] = useState('')
  const [height, setHeight] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [taskError, setTaskError] = useState<string | null>(null)
  const [taskSuccess, setTaskSuccess] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const load = (page = 1) => {
    setLoading(true)
    setError(null)
    getList<PackageRec>('/packing', { page, per_page: 15 })
      .then((resp) => {
        setPackages(resp.data)
        setMeta({ total: resp.total, current_page: resp.current_page, last_page: resp.last_page })
      })
      .catch((e: unknown) => setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to load packages'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load(1) }, [])

  const openPicker = async () => {
    setTaskError(null)
    setTaskSuccess(null)
    setShowPicker(true)
    try {
      const resp = await getList<SalesOrder>('/sales-orders', { per_page: 100, status: 'picked' })
      setQueue(resp.data)
    } catch (e: unknown) {
      setTaskError((e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to load packing queue')
      setShowPicker(false)
    }
  }

  const selectOrder = (so: SalesOrder) => {
    setSelected(so)
    const init: Record<number, string> = {}
    so.items?.forEach((item) => { init[item.id] = String(item.quantity) })
    setQuantities(init)
  }

  const submitPack = async () => {
    if (!selected) return
    setSubmitting(true)
    setTaskError(null)
    const items = (selected.items ?? [])
      .map((item) => ({ product_id: item.product_id, quantity: Number(quantities[item.id] ?? item.quantity) }))
      .filter((i) => i.quantity > 0)
    if (items.length === 0) {
      setTaskError('Enter at least one item quantity.')
      setSubmitting(false)
      return
    }
    try {
      await post(`/packing/${selected.id}`, {
        weight: weight || undefined,
        length: length || undefined,
        width: width || undefined,
        height: height || undefined,
        items,
      })
      setTaskSuccess('Package created and order marked packed.')
      setToast('Package created and order marked packed')
      setShowPicker(false)
      setSelected(null)
      setWeight('')
      setLength('')
      setWidth('')
      setHeight('')
      load(meta.current_page)
    } catch (e: unknown) {
      setTaskError((e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to create package')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Packing"
        subtitle="Create packages for picked sales orders."
        actions={
          <Button size="md" onClick={openPicker}>
            <Package size={15} /> New Package
          </Button>
        }
      />

      {error && <ErrorBanner message={error} />}
      {taskSuccess && (
        <div className="bg-mint-soft border border-mint/30 text-mint px-4 py-3 rounded-lg text-sm flex items-center gap-2">
          <CheckCircle2 size={16} className="shrink-0" /> {taskSuccess}
        </div>
      )}

      <Card>
        {loading ? (
          <TableSkeleton cols={5} />
        ) : packages.length === 0 ? (
          <EmptyState message="No packages created yet." icon={<Package size={28} />} />
        ) : (
          <Table headers={['Number', 'Order', 'Customer', 'Items', 'Status']}>
            {packages.map((pkg) => (
              <tr key={pkg.id} className="hover:bg-surface-subtle/60">
                <td className="px-4 py-3 font-mono text-xs font-semibold text-ink">{pkg.number}</td>
                <td className="px-4 py-3 text-xs text-ink">{pkg.sales_order?.number ?? '—'}</td>
                <td className="px-4 py-3 text-ink">{pkg.sales_order?.customer?.name ?? '—'}</td>
                <td className="px-4 py-3 text-ink-muted">{pkg.items?.length ?? 0}</td>
                <td className="px-4 py-3"><Badge status={pkg.status} /></td>
              </tr>
            ))}
          </Table>
        )}
        <Pagination currentPage={meta.current_page} lastPage={meta.last_page} onChange={load} />
      </Card>

      {showPicker && (
        <Modal open={showPicker} title="Select Picked Order" onClose={() => setShowPicker(false)}>
          {taskError && <div className="mb-4"><ErrorBanner message={taskError} /></div>}
          {!selected ? (
            queue.length === 0 ? (
              <EmptyState message="No picked orders awaiting packing." icon={<CheckCircle2 size={28} />} />
            ) : (
              <div className="space-y-2">
                {queue.map((so) => (
                  <button
                    key={so.id}
                    onClick={() => selectOrder(so)}
                    className="w-full flex items-center justify-between border border-border rounded-lg px-4 py-3 text-left hover:border-blue hover:bg-blue/5 transition"
                  >
                    <div>
                      <p className="text-sm font-semibold text-ink">{so.number}</p>
                      <p className="text-xs text-ink-muted">{so.customer?.name ?? '—'} · {so.items?.length ?? 0} lines</p>
                    </div>
                    <Badge status={so.status} />
                  </button>
                ))}
              </div>
            )
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-ink">{selected.number}</p>
                  <p className="text-xs text-ink-muted">{selected.customer?.name ?? '—'}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>Back</Button>
              </div>
              <div className="space-y-2">
                {(selected.items ?? []).map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-3 border border-border rounded-lg px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-ink">{item.product?.name ?? `Product #${item.product_id}`}</p>
                      <p className="text-xs text-ink-muted font-mono">{item.product?.sku ?? '—'}</p>
                    </div>
                    <Input
                      label={undefined}
                      value={quantities[item.id] ?? String(item.quantity)}
                      onChange={(v) => setQuantities({ ...quantities, [item.id]: v })}
                      type="number"
                    />
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Weight" value={weight} onChange={setWeight} type="number" placeholder="kg" />
                <Input label="Length" value={length} onChange={setLength} type="number" placeholder="cm" />
                <Input label="Width" value={width} onChange={setWidth} type="number" placeholder="cm" />
                <Input label="Height" value={height} onChange={setHeight} type="number" placeholder="cm" />
              </div>
              <div className="flex justify-end pt-2">
                <Button size="md" onClick={submitPack} disabled={submitting}>
                  {submitting ? 'Packing…' : 'Create Package'}
                </Button>
              </div>
            </div>
          )}
        </Modal>
      )}

      {toast && <Toast message={toast} type="success" onClose={() => setToast(null)} />}
    </div>
  )
}