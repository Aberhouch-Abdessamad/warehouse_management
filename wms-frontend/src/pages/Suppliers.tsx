import { useEffect, useState } from 'react'
import { getList, post } from '../services/apiClient'
import { Card, Badge, Table, TableSkeleton, ErrorBanner, EmptyState, Button, Input, PageHeader, Pagination, Modal, SearchInput, Toast } from '../components/ui'
import { Users2, Plus } from 'lucide-react'

interface Supplier {
  id: number
  code: string
  name: string
  tax_id: string
  contact_name?: string
  email?: string
  phone?: string
  address?: string
  is_active: boolean
}

const emptyForm = { code: '', name: '', tax_id: '', contact_name: '', email: '', phone: '', address: '' }

function errorMessage(e: unknown): string {
  const err = e as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } }
  const data = err?.response?.data
  if (data?.errors) {
    return Object.entries(data.errors)
      .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
      .join('; ')
  }
  return data?.message || 'Operation failed'
}

export default function Suppliers() {
  const [data, setData] = useState<Supplier[]>([])
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
    getList<Supplier>('/suppliers', { page, per_page: 15, search: q || undefined })
      .then((resp) => {
        setData(resp.data)
        setMeta({ total: resp.total, current_page: resp.current_page, last_page: resp.last_page })
      })
      .catch((e: unknown) => setError(errorMessage(e)))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load(1) }, [])

  const submit = async () => {
    setSubmitting(true)
    setFormError(null)
    const payload: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(form)) {
      if (value !== '') payload[key] = value
    }
    try {
      await post('/suppliers', payload)
      setShowForm(false)
      setForm(emptyForm)
      setToast('Supplier created successfully')
      load(1)
    } catch (e: unknown) {
      setFormError(errorMessage(e))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Suppliers"
        subtitle={`${meta.total} suppliers`}
        actions={
          <>
            <SearchInput
              placeholder="Search by code or name…"
              value={search}
              onChange={(v) => { setSearch(v); load(1, v) }}
              className="w-56"
            />
            <Button onClick={() => setShowForm(true)}><Plus size={16} /> New Supplier</Button>
          </>
        }
      />

      {error && <ErrorBanner message={error} onRetry={() => load(meta.current_page)} />}

      <Modal open={showForm} onClose={() => setShowForm(false)} title="Create Supplier">
        {formError && <ErrorBanner message={formError} />}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
          <Input label="Code" value={form.code} onChange={(v) => setForm({ ...form, code: v })} placeholder="SUP-001" required />
          <Input label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="Acme Corp" required />
          <Input label="Tax ID" value={form.tax_id} onChange={(v) => setForm({ ...form, tax_id: v })} />
          <Input label="Contact Name" value={form.contact_name} onChange={(v) => setForm({ ...form, contact_name: v })} />
          <Input label="Email" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
          <Input label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
          <div className="md:col-span-2"><Input label="Address" value={form.address} onChange={(v) => setForm({ ...form, address: v })} /></div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
          <Button onClick={submit} disabled={submitting || !form.code || !form.name}>
            {submitting ? 'Creating…' : 'Create Supplier'}
          </Button>
        </div>
      </Modal>

      <Card>
        {loading ? (
          <TableSkeleton cols={7} />
        ) : data.length === 0 ? (
          <EmptyState message="No suppliers found." icon={<Users2 size={28} />} />
        ) : (
          <Table headers={['Code', 'Name', 'Tax ID', 'Contact', 'Email', 'Phone', 'Status']}>
            {data.map((s) => (
              <tr key={s.id} className="hover:bg-surface-subtle/60 transition">
                <td className="px-4 py-3 font-mono text-xs text-ink-muted whitespace-nowrap">{s.code}</td>
                <td className="px-4 py-3 font-medium text-ink">{s.name}</td>
                <td className="px-4 py-3 text-ink-muted">{s.tax_id || '—'}</td>
                <td className="px-4 py-3 text-ink-muted">{s.contact_name || '—'}</td>
                <td className="px-4 py-3 text-ink-muted">{s.email || '—'}</td>
                <td className="px-4 py-3 text-ink-muted">{s.phone || '—'}</td>
                <td className="px-4 py-3"><Badge status={s.is_active ? 'active' : 'inactive'} /></td>
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