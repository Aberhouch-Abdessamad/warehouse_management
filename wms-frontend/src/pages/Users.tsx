import { useEffect, useState } from 'react'
import { getList, post, put, del } from '../services/apiClient'
import { Card, Table, TableSkeleton, ErrorBanner, EmptyState, Button, PageHeader, Pagination, Modal, Input, Select, Badge } from '../components/ui'
import { CheckCircle2, UsersRound, ShieldAlert } from 'lucide-react'

interface Role {
  id: number
  name: string
}

interface User {
  id: number
  name: string
  email: string
  phone?: string | null
  is_active: boolean
  roles?: { id: number; name: string }[]
}

export default function Users() {
  const [users, setUsers] = useState<User[]>([])
  const [meta, setMeta] = useState({ total: 0, current_page: 1, last_page: 1 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const [roles, setRoles] = useState<Role[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', role_ids: [] as number[], is_active: true })
  const [editing, setEditing] = useState<User | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [taskError, setTaskError] = useState<string | null>(null)
  const [taskSuccess, setTaskSuccess] = useState<string | null>(null)

  const load = (page = 1) => {
    setLoading(true)
    setError(null)
    const params: Record<string, string | number> = { page, per_page: 15 }
    if (search) params.search = search
    getList<User>('/users', params)
      .then((resp) => {
        setUsers(resp.data)
        setMeta({ total: resp.total, current_page: resp.current_page, last_page: resp.last_page })
      })
      .catch((e: unknown) => setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to load users'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load(1) }, [])

  const loadRoles = async () => {
    try {
      const resp = await getList<Role>('/roles', { per_page: 100 })
      setRoles(resp.data)
    } catch {
      setRoles([])
    }
  }

  useEffect(() => { loadRoles() }, [])

  const openCreate = () => {
    setTaskError(null)
    setEditing(null)
    setForm({ name: '', email: '', password: '', phone: '', role_ids: [], is_active: true })
    setShowCreate(true)
  }

  const openEdit = (u: User) => {
    setTaskError(null)
    setEditing(u)
    setForm({ name: u.name, email: u.email, password: '', phone: u.phone ?? '', role_ids: (u.roles ?? []).map((r) => r.id), is_active: u.is_active })
    setShowCreate(true)
  }

  const submit = async () => {
    setSubmitting(true)
    setTaskError(null)
    try {
      const payload: Record<string, unknown> = {
        name: form.name,
        email: form.email,
        phone: form.phone || undefined,
        role_ids: form.role_ids,
        is_active: form.is_active,
      }
      if (!editing) {
        if (form.password.length < 8) {
          setTaskError('Password must be at least 8 characters.')
          setSubmitting(false)
          return
        }
        payload.password = form.password
        await post('/users', payload)
      } else {
        if (form.password) payload.password = form.password
        await put(`/users/${editing.id}`, payload)
      }
      setTaskSuccess(editing ? 'User updated.' : 'User created.')
      setShowCreate(false)
      load(meta.current_page)
    } catch (e: unknown) {
      setTaskError((e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to save user')
    } finally {
      setSubmitting(false)
    }
  }

  const toggleActive = async (u: User) => {
    setTaskError(null)
    try {
      await post(u.is_active ? `/users/${u.id}/deactivate` : `/users/${u.id}/activate`)
      setTaskSuccess(u.is_active ? 'User deactivated.' : 'User activated.')
      load(meta.current_page)
    } catch (e: unknown) {
      setTaskError((e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to update user status')
      load(meta.current_page)
    }
  }

  const remove = async (u: User) => {
    if (!confirm(`Delete user "${u.name}"? (Must be deactivated first.)`)) return
    setTaskError(null)
    try {
      await del(`/users/${u.id}`)
      setTaskSuccess('User deleted.')
      load(meta.current_page)
    } catch (e: unknown) {
      setTaskError((e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to delete user')
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Users"
        subtitle="Manage user accounts, roles, and access."
        actions={
          <Button size="md" onClick={openCreate}>
            <UsersRound size={15} /> New User
          </Button>
        }
      />

      {error && <ErrorBanner message={error} />}
      {taskError && (
        <div className="bg-red-soft border border-red/20 text-red px-4 py-3 rounded-lg text-sm flex items-center gap-2">
          <ShieldAlert size={16} className="shrink-0" /> {taskError}
        </div>
      )}
      {taskSuccess && (
        <div className="bg-mint-soft border border-mint/30 text-mint px-4 py-3 rounded-lg text-sm flex items-center gap-2">
          <CheckCircle2 size={16} className="shrink-0" /> {taskSuccess}
        </div>
      )}

      <Card>
        <div className="px-5 py-4 border-b border-border">
          <div className="w-72">
            <Input label="Search" value={search} onChange={(v) => { setSearch(v); load(1) }} placeholder="Search by name or email" />
          </div>
        </div>

        {loading ? (
          <TableSkeleton cols={5} />
        ) : users.length === 0 ? (
          <EmptyState message="No users found." icon={<UsersRound size={28} />} />
        ) : (
          <Table headers={['Name', 'Email', 'Roles', 'Status', 'Actions']}>
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-surface-subtle/60">
                <td className="px-4 py-3 text-sm font-semibold text-ink">{u.name}</td>
                <td className="px-4 py-3 text-sm text-ink-muted">{u.email}</td>
                <td className="px-4 py-3 text-sm text-ink-muted">{(u.roles ?? []).map((r) => r.name).join(', ') || '—'}</td>
                <td className="px-4 py-3">
                  <Badge status={u.is_active ? 'active' : 'inactive'}>
                    {u.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(u)}>Edit</Button>
                    <Button variant="ghost" size="sm" onClick={() => toggleActive(u)}>
                      {u.is_active ? 'Deactivate' : 'Activate'}
                    </Button>
                    {!u.is_active && (
                      <Button variant="ghost" size="sm" onClick={() => remove(u)}>Delete</Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        )}
        <Pagination currentPage={meta.current_page} lastPage={meta.last_page} onChange={load} />
      </Card>

      {showCreate && (
        <Modal open={showCreate} title={editing ? `Edit ${editing.name}` : 'New User'} onClose={() => setShowCreate(false)}>
          {taskError && <div className="mb-4"><ErrorBanner message={taskError} /></div>}
          <div className="space-y-4">
            <Input label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
            <Input label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} type="email" required />
            <Input
              label={editing ? 'New Password (optional)' : 'Password'}
              value={form.password}
              onChange={(v) => setForm({ ...form, password: v })}
              type="password"
              placeholder="At least 8 characters"
              required={!editing}
            />
            <Input label="Phone (optional)" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
            <Select
              label="Roles"
              value={form.role_ids[0] ?? ''}
              onChange={(v) => setForm({ ...form, role_ids: v ? [Number(v)] : [] })}
              options={roles.map((r) => ({ value: r.id, label: r.name }))}
            />
            {editing && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  className="w-4 h-4 rounded border-border text-blue focus:ring-blue/40"
                />
                <label htmlFor="is_active" className="text-sm text-ink">Active</label>
              </div>
            )}
            <div className="flex justify-end pt-2">
              <Button size="md" onClick={submit} disabled={submitting}>
                {submitting ? 'Saving…' : editing ? 'Save Changes' : 'Create User'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}