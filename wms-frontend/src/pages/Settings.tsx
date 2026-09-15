import { useEffect, useState } from 'react'
import { get, getList, post } from '../services/apiClient'
import { Card, Table, Spinner, ErrorBanner, EmptyState, Button, Badge, PageHeader } from '../components/ui'
import ConfirmationDialog from '../components/ConfirmationDialog'
import { Settings as SettingsIcon } from 'lucide-react'

interface RoleRef {
  id: number
  name: string
}
interface User {
  id: number
  name: string
  email: string
  is_active: boolean
  roles?: RoleRef[]
}

export default function Settings() {
  const [tab, setTab] = useState<'users' | 'roles'>('users')
  const [users, setUsers] = useState<User[]>([])
  const [roles, setRoles] = useState<RoleRef[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<{ u: User; action: string; title: string; message: string } | null>(null)

  const load = () => {
    setLoading(true); setError(null)
    Promise.all([
      getList<User>('/users', { per_page: 100 }),
      get<RoleRef[]>('/roles'),
    ])
      .then(([u, r]) => { setUsers(u.data); setRoles(r) })
      .catch((e) => setError(e?.response?.data?.message || 'Failed to load settings'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const toggleActive = async (u: User) => {
    const action = u.is_active ? 'deactivate' : 'activate'
    setConfirm({
      u,
      action,
      title: `${u.is_active ? 'Deactivate' : 'Activate'} User`,
      message: `Are you sure you want to ${action} ${u.name}?`,
    })
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Settings"
        subtitle="Manage users and roles"
      />

      <div className="flex gap-2 border-b border-border">
        {(['users', 'roles'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition ${tab === t ? 'border-blue text-blue' : 'border-transparent text-ink-muted hover:text-ink'}`}
          >
            {t === 'users' ? 'Users' : 'Roles'}
          </button>
        ))}
      </div>

      {error && <ErrorBanner message={error} />}

      {loading ? (
        <Spinner />
      ) : tab === 'users' ? (
        <Card>
          {users.length === 0 ? (
            <EmptyState message="No users found." icon={<SettingsIcon size={28} />} />
          ) : (
            <Table headers={['Name', 'Email', 'Roles', 'Status', 'Actions']}>
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-surface-subtle/60 transition">
                  <td className="px-4 py-3 font-medium text-ink">{u.name}</td>
                  <td className="px-4 py-3 text-ink-muted">{u.email}</td>
                  <td className="px-4 py-3 text-xs text-ink-muted">{u.roles?.map((r) => r.name).join(', ') || '—'}</td>
                  <td className="px-4 py-3">
                    <Badge status={u.is_active ? 'active' : 'inactive'}>{u.is_active ? 'Active' : 'Inactive'}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Button size="sm" variant={u.is_active ? 'danger' : 'primary'} onClick={() => toggleActive(u)}>
                      {u.is_active ? 'Deactivate' : 'Activate'}
                    </Button>
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      ) : (
        <Card>
          {roles.length === 0 ? (
            <EmptyState message="No roles found." icon={<SettingsIcon size={28} />} />
          ) : (
            <Table headers={['Role', 'Users']}>
              {roles.map((r) => (
                <tr key={r.id} className="hover:bg-surface-subtle/60 transition">
                  <td className="px-4 py-3 font-medium text-ink">{r.name}</td>
                  <td className="px-4 py-3 text-ink-muted">
                    {users.filter((u) => u.roles?.some((ur) => ur.id === r.id)).length} users
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      )}

      <ConfirmationDialog
        open={confirm !== null}
        title={confirm?.title ?? ''}
        message={confirm?.message ?? ''}
        confirmLabel="Confirm"
        variant={confirm?.action === 'deactivate' ? 'danger' : 'primary'}
        onConfirm={async () => {
          if (!confirm) return
          await post(`/users/${confirm.u.id}/${confirm.action}`)
          setConfirm(null)
          load()
        }}
        onCancel={() => setConfirm(null)}
      />
    </div>
  )
}