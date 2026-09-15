import { useEffect, useState } from 'react'
import { getList, post } from '../services/apiClient'
import { Card, Badge, Table, TableSkeleton, ErrorBanner, EmptyState, Button, Input, PageHeader, Pagination, Modal, SearchInput, Toast } from '../components/ui'
import { Warehouse as WarehouseIcon, Plus } from 'lucide-react'

interface Warehouse {
  id: number
  code: string
  name: string
  address?: string
  city?: string
  country?: string
  phone?: string
  email?: string
  is_active: boolean
  allow_self_transfer: boolean
}

const emptyForm = { code: '', name: '', address: '', city: '', country: '', phone: '', email: '', allow_self_transfer: false }

export default function Warehouses() {
  const [data, setData] = useState<Warehouse[]>([])
  const [meta, setMeta] = useState({ total: 0, current_page: 1, last_page: 1 })
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const load = (page = 1, q = search) => {
    setLoading(true)
    setError(null)
    getList<Warehouse>('/warehouses', { page, per_page: 15, search: q || undefined })
      .then((resp) => {
        setData(resp.data)
        setMeta({ total: resp.total, current_page: resp.current_page, last_page: resp.last_page })
      })
      .catch((e: unknown) => setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to load warehouses'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load(1) }, [])

  const submit = async () => {
    setSubmitting(true)
    setFormError(null)
    try {
      await post('/warehouses', form)
      setShowForm(false)
      setForm(emptyForm)
      setToast('Warehouse created successfully')
      load(1)
    } catch (e: unknown) {
      setFormError((e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to create warehouse')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Warehouses"
        subtitle={`${meta.total} facilities`}
        actions={
          <>
            <SearchInput
              placeholder="Search by code or name…"
              value={search}
              onChange={(v) => { setSearch(v); load(1, v) }}
              className="w-56"
            />
            <Button onClick={() => setShowForm(true)}><Plus size={16} /> New Warehouse</Button>
          </>
        }
      />

      {error && <ErrorBanner message={error} onRetry={() => load(meta.current_page)} />}

      <Modal open={showForm} onClose={() => setShowForm(false)} title="Create Warehouse">
        {formError && <ErrorBanner message={formError} />}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
          <Input label="Code" value={form.code} onChange={(v) => setForm({ ...form, code: v })} placeholder="WH-MAIN" />
          <Input label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="Main Warehouse" />
          <Input label="Address" value={form.address} onChange={(v) => setForm({ ...form, address: v })} />
          <Input label="City" value={form.city} onChange={(v) => setForm({ ...form, city: v })} />
          <Input label="Country" value={form.country} onChange={(v) => setForm({ ...form, country: v })} />
          <Input label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
          <Input label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
          <label className="flex items-center gap-2 text-sm font-medium text-ink self-end pb-2.5">
            <input
              type="checkbox"
              checked={form.allow_self_transfer}
              onChange={(e) => setForm({ ...form, allow_self_transfer: e.target.checked })}
              className="w-4 h-4 rounded border-border accent-blue"
            />
            Allow self-transfer
          </label>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
          <Button onClick={submit} disabled={submitting || !form.code || !form.name}>
            {submitting ? 'Creating…' : 'Create Warehouse'}
          </Button>
        </div>
      </Modal>

      <Card>
        {loading ? (
          <TableSkeleton cols={7} />
        ) : data.length === 0 ? (
          <EmptyState message="No warehouses found." icon={<WarehouseIcon size={28} />} />
        ) : (
          <Table headers={['Code', 'Name', 'City', 'Country', 'Phone', 'Self-Transfer', 'Status']}>
            {data.map((w) => (
              <tr key={w.id} className="hover:bg-surface-subtle/60 transition">
                <td className="px-4 py-3 font-mono text-xs text-ink-muted whitespace-nowrap">{w.code}</td>
                <td className="px-4 py-3 font-medium text-ink">{w.name}</td>
                <td className="px-4 py-3 text-ink-muted">{w.city || '—'}</td>
                <td className="px-4 py-3 text-ink-muted">{w.country || '—'}</td>
                <td className="px-4 py-3 text-ink-muted">{w.phone || '—'}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${w.allow_self_transfer ? 'bg-blue-soft text-blue' : 'bg-surface-subtle text-ink-muted'}`}>
                    {w.allow_self_transfer ? 'Allowed' : 'Blocked'}
                  </span>
                </td>
                <td className="px-4 py-3"><Badge status={w.is_active ? 'active' : 'inactive'} /></td>
              </tr>
            ))}
          </Table>
        )}
        <Pagination currentPage={meta.current_page} lastPage={meta.last_page} onChange={load} />
      </Card>

      {toast && <Toast message={toast} type="success" onClose={() => setToast(null)} />}
    </div>
  )
}