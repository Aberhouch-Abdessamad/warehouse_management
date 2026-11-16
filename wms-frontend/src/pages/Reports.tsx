import { useEffect, useState } from 'react'
import { api } from '../api'
import { get, getList } from '../services/apiClient'
import { Card, Table, TableSkeleton, ErrorBanner, EmptyState, Button, PageHeader, Select, Input, Badge } from '../components/ui'
import { BarChart3, Download } from 'lucide-react'

interface Warehouse {
  id: number
  name: string
}

type ReportType = 'stock' | 'stock_movement' | 'sales' | 'purchase' | 'valuation' | 'low_stock'

const REPORT_TYPES: { value: ReportType; label: string }[] = [
  { value: 'stock', label: 'Stock Report' },
  { value: 'stock_movement', label: 'Stock Movement' },
  { value: 'sales', label: 'Sales Report' },
  { value: 'purchase', label: 'Purchase Report' },
  { value: 'valuation', label: 'Inventory Valuation' },
  { value: 'low_stock', label: 'Low Stock' },
]

function getHeaderFor(type: ReportType): string[] {
  switch (type) {
    case 'stock':
      return ['SKU', 'Product', 'Warehouse', 'On Hand', 'Reserved', 'Damaged']
    case 'stock_movement':
      return ['SKU', 'Product', 'Movement Type', 'Movements', 'Total Qty']
    case 'sales':
      return ['Order #', 'Customer', 'Order Date', 'Status', 'Subtotal', 'Tax', 'Total']
    case 'purchase':
      return ['PO #', 'Supplier', 'Order Date', 'Status', 'Subtotal', 'Tax', 'Total']
    case 'valuation':
      return ['SKU', 'Product', 'Cost', 'On Hand', 'Stock Value']
    case 'low_stock':
      return ['SKU', 'Product', 'Warehouse', 'On Hand', 'Reorder', 'Min Stock']
  }
}

export default function Reports() {
  const [type, setType] = useState<ReportType>('stock')
  const [warehouseId, setWarehouseId] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [loadedOnce, setLoadedOnce] = useState(false)

  const loadWarehouses = async () => {
    try {
      const resp = await getList<Warehouse>('/warehouses', { per_page: 100 })
      setWarehouses(resp.data)
    } catch {
      setWarehouses([])
    }
  }

  const runReport = async () => {
    setLoading(true)
    setError(null)
    try {
      const params: Record<string, string> = { type }
      if (warehouseId) params.warehouse_id = warehouseId
      if (fromDate) params.from_date = fromDate
      if (toDate) params.to_date = toDate
      const resp = await get<Record<string, unknown>[]>(`/reports`, params)
      setRows(resp ?? [])
      setLoadedOnce(true)
    } catch (e: unknown) {
      setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to generate report')
    } finally {
      setLoading(false)
    }
  }

  const exportCsv = async () => {
    try {
      const params = new URLSearchParams({ type, format: 'csv' })
      if (warehouseId) params.set('warehouse_id', warehouseId)
      if (fromDate) params.set('from_date', fromDate)
      if (toDate) params.set('to_date', toDate)
      const res = await api.get(`/reports/export?${params.toString()}`, { responseType: 'blob', headers: { Accept: 'text/csv' } })
      if (res.status === 204) throw new Error('No data to export for these filters.')
      const blob = res.data as Blob
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${type}_report.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e: unknown) {
      setError((e as Error).message || 'Export failed')
    }
  }

  useEffect(() => { loadWarehouses() }, [])

  const headers = getHeaderFor(type)

  return (
    <div className="space-y-4">
      <PageHeader
        title="Reports"
        subtitle="Generate operational reports and export to CSV."
        actions={rows.length > 0 && loadedOnce ? (
          <Button size="md" onClick={exportCsv}>
            <Download size={15} /> Export CSV
          </Button>
        ) : undefined}
      />

      <Card>
        <div className="px-5 py-4 flex flex-wrap items-end gap-3">
          <div className="w-48">
            <Select
              label="Report Type"
              value={type}
              onChange={(v) => { setType(v as ReportType); setRows([]); setLoadedOnce(false) }}
              options={REPORT_TYPES}
            />
          </div>
          {(type === 'stock_movement' || type === 'sales' || type === 'purchase') && (
            <>
              <div className="w-40">
                <Input label="From Date" value={fromDate} onChange={setFromDate} type="date" />
              </div>
              <div className="w-40">
                <Input label="To Date" value={toDate} onChange={setToDate} type="date" />
              </div>
            </>
          )}
          <div className="w-52">
            <Select
              label="Warehouse"
              value={warehouseId}
              onChange={setWarehouseId}
              options={warehouses.map((w) => ({ value: w.id, label: w.name }))}
            />
          </div>
          <Button size="md" onClick={runReport} disabled={loading}>
            <BarChart3 size={15} /> {loading ? 'Running…' : 'Generate'}
          </Button>
        </div>

        {error && <div className="px-5 pb-4"><ErrorBanner message={error} /></div>}

        {!loadedOnce ? (
          <div className="px-5 pb-6 flex items-center justify-center py-10">
            <EmptyState message="Select a report type and click Generate." icon={<BarChart3 size={28} />} />
          </div>
        ) : loading ? (
          <TableSkeleton cols={headers.length} />
        ) : rows.length === 0 ? (
          <div className="px-5 pb-6 flex items-center justify-center py-10">
            <EmptyState message={`No data for ${REPORT_TYPES.find((t) => t.value === type)?.label.toLowerCase()}.`} icon={<BarChart3 size={28} />} />
          </div>
        ) : (
          <Table headers={headers}>
            {rows.map((row, i) => (
              <tr key={i} className="hover:bg-surface-subtle/60">
                {headers.map((h, j) => {
                  const key = Object.keys(row)[j]
                  const val = key != null ? (row[key] as string | number) : ''
                  return (
                    <td key={h} className="px-4 py-3 text-ink text-sm">
                      {typeof val === 'number' ? val.toLocaleString() : val}
                    </td>
                  )
                })}
              </tr>
            ))}
          </Table>
        )}
      </Card>

    </div>
  )
}