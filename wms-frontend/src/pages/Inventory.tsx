import { useEffect, useState } from 'react'
import { getList } from '../services/apiClient'
import { Card, Badge, Table, TableSkeleton, ErrorBanner, EmptyState, PageHeader, Pagination, SearchInput } from '../components/ui'
import { Boxes } from 'lucide-react'

interface StockRow {
  id: number
  product_id: number
  warehouse_id: number
  bin_id: number | null
  quantity_on_hand: string | number
  quantity_reserved: string | number
  quantity_damaged: string | number
  quantity_incoming: string | number
  product?: { sku: string; name: string }
  warehouse?: { name: string; code: string }
  bin?: { code: string } | null
}

export default function Inventory() {
  const [rows, setRows] = useState<StockRow[]>([])
  const [meta, setMeta] = useState({ total: 0, current_page: 1, last_page: 1 })
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = (page = 1, q = search) => {
    setLoading(true)
    setError(null)
    getList<StockRow>('/stock', { page, per_page: 15, search: q || undefined })
      .then((resp) => {
        setRows(resp.data)
        setMeta({ total: resp.total, current_page: resp.current_page, last_page: resp.last_page })
      })
      .catch((e: unknown) => setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to load inventory'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load(1) }, [])

  const fmt = (v: string | number) => Number(v).toLocaleString()

  return (
    <div className="space-y-4">
      <PageHeader
        title="Stock Overview"
        subtitle={`${meta.total} stock balances across all warehouses`}
        actions={
          <SearchInput
            placeholder="Search by SKU or product name…"
            value={search}
            onChange={(v) => { setSearch(v); load(1, v) }}
            className="w-64"
          />
        }
      />

      {error && <ErrorBanner message={error} onRetry={() => load(meta.current_page)} />}

      <Card>
        {loading ? (
          <TableSkeleton cols={9} />
        ) : rows.length === 0 ? (
          <EmptyState message="No inventory records found." icon={<Boxes size={28} />} />
        ) : (
          <Table headers={[
            'Product',
            'SKU',
            'Warehouse',
            'Bin',
            'On Hand',
            'Reserved',
            'Damaged',
            'Incoming',
            'Available',
          ]}>
            {rows.map((r) => {
              const onHand = Number(r.quantity_on_hand)
              const reserved = Number(r.quantity_reserved)
              const damaged = Number(r.quantity_damaged)
              const available = onHand - reserved - damaged
              return (
                <tr key={r.id} className="hover:bg-surface-subtle/60 transition">
                  <td className="px-4 py-3 font-medium text-ink">{r.product?.name || `#${r.product_id}`}</td>
                  <td className="px-4 py-3 font-mono text-xs text-ink-muted">{r.product?.sku || '—'}</td>
                  <td className="px-4 py-3 text-ink-muted">{r.warehouse?.name || `WH#${r.warehouse_id}`}</td>
                  <td className="px-4 py-3 font-mono text-xs text-ink-muted">{r.bin?.code || '—'}</td>
                  <td className="px-4 py-3 font-semibold tabular-nums">{fmt(onHand)}</td>
                  <td className="px-4 py-3">
                    {reserved > 0 ? (
                      <Badge status="pending">{fmt(reserved)}</Badge>
                    ) : (
                      <span className="text-ink-muted/40 tabular-nums">0</span>
                    )}
                  </td>
                  {damaged > 0 ? (
                    <td className="px-4 py-3">
                      <Badge status="damaged">{fmt(damaged)}</Badge>
                    </td>
                  ) : (
                    <td className="px-4 py-3">
                      <span className="text-ink-muted/40 tabular-nums">0</span>
                    </td>
                  )}
                  <td className="px-4 py-3">
                    {Number(r.quantity_incoming) > 0 ? (
                      <Badge status="approved">{fmt(r.quantity_incoming)}</Badge>
                    ) : (
                      <span className="text-ink-muted/40 tabular-nums">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`font-semibold tabular-nums ${available < 0 ? 'text-red' : 'text-mint'}`}>
                      {fmt(available)}
                    </span>
                  </td>
                </tr>
              )
            })}
          </Table>
        )}
        <Pagination currentPage={meta.current_page} lastPage={meta.last_page} onChange={load} />
      </Card>
    </div>
  )
}