import { useEffect, useState } from 'react'
import { getList } from '../services/apiClient'
import { Card, Badge, Table, TableSkeleton, ErrorBanner, EmptyState, PageHeader, Pagination, SearchInput } from '../components/ui'
import { Package } from 'lucide-react'

interface Product {
  id: number
  sku: string
  name: string
  category?: { name?: string } | null
  brand?: { name?: string } | null
  unit?: { name?: string } | null
  price: string | number
  cost_price: string | number
  current_stock: string | number
  status: string
  reorder_point: string | number
}

export default function Products() {
  const [data, setData] = useState<Product[]>([])
  const [meta, setMeta] = useState({ total: 0, current_page: 1, last_page: 1 })
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = (page = 1, q = search) => {
    setLoading(true)
    setError(null)
    getList<Product>('/products', { page, per_page: 15, search: q || undefined })
      .then((resp) => {
        setData(resp.data)
        setMeta({ total: resp.total, current_page: resp.current_page, last_page: resp.last_page })
      })
      .catch((e: unknown) => setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to load products'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load(1) }, [])

  return (
    <div className="space-y-4">
      <PageHeader
        title="Products"
        subtitle={`${meta.total} products managed`}
        actions={
          <SearchInput
            placeholder="Search SKU or name…"
            value={search}
            onChange={(v) => { setSearch(v); load(1, v) }}
            className="w-56"
          />
        }
      />

      {error && <ErrorBanner message={error} />}

      <Card>
         {loading ? (
           <TableSkeleton cols={7} />
         ) : data.length === 0 ? (
           <EmptyState message="No products found." icon={<Package size={28} />} />
         ) : (
           <Table headers={['SKU', 'Name', 'Category', 'Brand', 'Price', 'Stock', 'Status']}>
             {data.map((p) => {
               const stock = Number(p.current_stock)
               const reorder = Number(p.reorder_point)
               const lowStock = stock <= reorder
               return (
                 <tr key={p.id} className="hover:bg-surface-subtle/60 transition">
                   <td className="px-4 py-3 font-mono text-xs text-ink-muted whitespace-nowrap">{p.sku}</td>
                   <td className="px-4 py-3 font-medium text-ink">{p.name}</td>
                   <td className="px-4 py-3 text-ink-muted">{p.category?.name || '—'}</td>
                   <td className="px-4 py-3 text-ink-muted">{p.brand?.name || '—'}</td>
                   <td className="px-4 py-3 font-mono text-sm text-ink tabular-nums">
                     ${typeof p.price === 'number' ? p.price.toFixed(2) : Number(p.price).toFixed(2)}
                   </td>
                   <td className="px-4 py-3">
                     <span className={`font-semibold tabular-nums ${lowStock ? 'text-red' : 'text-ink'}`}>
                       {stock.toLocaleString()}
                     </span>
                     {lowStock && stock > 0 && (
                       <span className="ml-1.5 text-[10px] text-amber font-semibold uppercase">Low</span>
                     )}
                   </td>
                   <td className="px-4 py-3"><Badge status={p.status}>{p.status}</Badge></td>
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