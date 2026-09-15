import { useEffect, useState } from 'react'
import { getList } from '../services/apiClient'
import { Card, Table, TableSkeleton, ErrorBanner, EmptyState, PageHeader, Pagination, Select, Input, Badge } from '../components/ui'
import { ScrollText } from 'lucide-react'

interface AuditLog {
  id: number
  user?: { id: number; name: string; email: string } | null
  module: string
  action: string
  description?: string | null
  properties?: Record<string, unknown> | null
  created_at: string
}

export default function AuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [meta, setMeta] = useState({ total: 0, current_page: 1, last_page: 1 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [module, setModule] = useState('')
  const [action, setAction] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [search, setSearch] = useState('')

  const load = (page = 1) => {
    setLoading(true)
    setError(null)
    const params: Record<string, string | number> = { page, per_page: 20 }
    if (module) params.module = module
    if (action) params.action = action
    if (fromDate) params.from_date = fromDate
    if (toDate) params.to_date = toDate
    if (search) params.user_id = search
    getList<AuditLog>('/audit-logs', params)
      .then((resp) => {
        setLogs(resp.data)
        setMeta({ total: resp.total, current_page: resp.current_page, last_page: resp.last_page })
      })
      .catch((e: unknown) => setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to load audit logs'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load(1) }, [])

  const MODULES = ['', 'auth', 'inventory', 'products', 'purchasing', 'sales', 'transfers', 'users', 'settings', 'stock-counts', 'returns']
  const ACTIONS = ['', 'create', 'update', 'delete', 'login', 'logout', 'apply', 'confirm', 'cancel', 'ship', 'receive']

  return (
    <div className="space-y-4">
      <PageHeader title="Audit Logs" subtitle="Track all system activities and changes." />

      <Card>
        <div className="px-5 py-4 flex flex-wrap items-end gap-3 border-b border-border">
          <div className="w-40">
            <Select label="Module" value={module} onChange={setModule}
              options={MODULES.filter((m) => m !== '').map((m) => ({ value: m, label: m }))}
            />
          </div>
          <div className="w-40">
            <Select label="Action" value={action} onChange={setAction}
              options={ACTIONS.filter((a) => a !== '').map((a) => ({ value: a, label: a }))}
            />
          </div>
          <div className="w-40">
            <Input label="From Date" value={fromDate} onChange={setFromDate} type="date" />
          </div>
          <div className="w-40">
            <Input label="To Date" value={toDate} onChange={setToDate} type="date" />
          </div>
          <div className="w-32">
            <Input label="User ID" value={search} onChange={setSearch} placeholder="Filter by user" />
          </div>
        </div>

        {error && <div className="px-5 pt-4"><ErrorBanner message={error} /></div>}

        {loading ? (
          <TableSkeleton cols={5} />
        ) : logs.length === 0 ? (
          <EmptyState message="No audit log entries found." icon={<ScrollText size={28} />} />
        ) : (
          <Table headers={['Date', 'User', 'Module', 'Action', 'Description']}>
            {logs.map((log) => (
              <tr key={log.id} className="hover:bg-surface-subtle/60">
                <td className="px-4 py-3 text-xs text-ink-muted whitespace-nowrap">
                  {new Date(log.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-sm text-ink">
                  {log.user?.name ?? 'System'}
                </td>
                <td className="px-4 py-3">
                  <Badge status={log.module}>{log.module}</Badge>
                </td>
                <td className="px-4 py-3">
                  <Badge status={log.action}>{log.action}</Badge>
                </td>
                <td className="px-4 py-3 text-sm text-ink-muted max-w-md truncate">
                  {log.description ?? '—'}
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