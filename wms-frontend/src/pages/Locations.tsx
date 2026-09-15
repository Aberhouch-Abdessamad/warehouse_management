import { useEffect, useState } from 'react'
import { get, getList, post, del } from '../services/apiClient'
import { Card, Table, TableSkeleton, ErrorBanner, EmptyState, Button, PageHeader, Modal, Input, Select, Badge } from '../components/ui'
import { MapPin, Plus } from 'lucide-react'

interface Zone {
  id: number
  warehouse_id: number
  code: string
  name?: string | null
  warehouse?: { id: number; name: string }
}

interface Aisle { id: number; zone_id: number; code: string; zone?: { code: string } }
interface Rack { id: number; aisle_id: number; code: string; aisle?: { code: string; zone?: { code: string } } }
interface Shelf { id: number; rack_id: number; code: string; rack?: { code: string; aisle?: { code: string; zone?: { code: string } } } }
interface Bin {
  id: number
  shelf_id: number
  code: string
  type?: string | null
  is_active?: boolean
  shelf?: { code: string; rack?: { code: string; aisle?: { code: string; zone?: { code: string } } } }
}

type LocType = 'zone' | 'aisle' | 'rack' | 'shelf' | 'bin'

interface LocationRow {
  id: number
  code: string
  path: string
  type: LocType
  is_active?: boolean
}

interface Warehouse { id: number; name: string }

export default function Locations() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [warehouseId, setWarehouseId] = useState('')
  const [rows, setRows] = useState<LocationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [zones, setZones] = useState<Zone[]>([])
  const [aisles, setAisles] = useState<Aisle[]>([])
  const [racks, setRacks] = useState<Rack[]>([])
  const [shelves, setShelves] = useState<Shelf[]>([])

  const [showCreate, setShowCreate] = useState(false)
  const [createType, setCreateType] = useState<LocType>('bin')
  const [form, setForm] = useState({ code: '', name: '', parent_id: '' })
  const [submitting, setSubmitting] = useState(false)
  const [taskError, setTaskError] = useState<string | null>(null)
  const [taskSuccess, setTaskSuccess] = useState<string | null>(null)

  const loadWarehouses = async () => {
    try {
      const resp = await getList<Warehouse>('/warehouses', { per_page: 100 })
      setWarehouses(resp.data)
      if (resp.data.length > 0 && !warehouseId) setWarehouseId(String(resp.data[0].id))
    } catch {
      setWarehouses([])
    }
  }

  const load = async () => {
    if (!warehouseId) { setRows([]); setLoading(false); return }
    setLoading(true)
    setError(null)
    try {
      const [zData, aData, rData, sData, bData] = await Promise.all([
        get<Zone[]>('/locations', { warehouse_id: warehouseId, type: 'zone' }),
        get<Aisle[]>('/locations', { warehouse_id: warehouseId, type: 'aisle' }),
        get<Rack[]>('/locations', { warehouse_id: warehouseId, type: 'rack' }),
        get<Shelf[]>('/locations', { warehouse_id: warehouseId, type: 'shelf' }),
        get<Bin[]>('/locations', { warehouse_id: warehouseId, type: 'bin' }),
      ])
      setZones(zData ?? [])
      setAisles(aData ?? [])
      setRacks(rData ?? [])
      setShelves(sData ?? [])

      const all: LocationRow[] = [
        ...(zData ?? []).map((z) => ({ id: z.id, code: z.code, path: z.warehouse?.name ?? '', type: 'zone' as const })),
        ...(aData ?? []).map((a) => ({ id: a.id, code: a.code, path: a.zone?.code ?? '', type: 'aisle' as const })),
        ...(rData ?? []).map((r) => ({ id: r.id, code: r.code, path: [r.aisle?.zone?.code, r.aisle?.code].filter(Boolean).join(' › '), type: 'rack' as const })),
        ...(sData ?? []).map((s) => ({ id: s.id, code: s.code, path: [s.rack?.aisle?.zone?.code, s.rack?.aisle?.code, s.rack?.code].filter(Boolean).join(' › '), type: 'shelf' as const })),
        ...(bData ?? []).map((b) => ({
          id: b.id,
          code: b.code,
          path: [b.shelf?.rack?.aisle?.zone?.code, b.shelf?.rack?.aisle?.code, b.shelf?.rack?.code, b.shelf?.code].filter(Boolean).join(' › '),
          type: 'bin' as const,
          is_active: b.is_active,
        })),
      ]
      setRows(all)
    } catch (e: unknown) {
      setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to load locations')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadWarehouses() }, [])
  useEffect(() => { if (warehouseId) load() }, [warehouseId])

  const openCreate = () => {
    setTaskError(null)
    setForm({ code: '', name: '', parent_id: '' })
    setCreateType('bin')
    setShowCreate(true)
  }

  const parentOptions = (): { value: string | number; label: string }[] => {
    switch (createType) {
      case 'aisle': return zones.map((z) => ({ value: z.id, label: `Zone: ${z.code}` }))
      case 'rack': return aisles.map((a) => ({ value: a.id, label: `Aisle: ${a.code}` }))
      case 'shelf': return racks.map((r) => ({ value: r.id, label: `Rack: ${r.code}` }))
      case 'bin': return shelves.map((s) => ({ value: s.id, label: `Shelf: ${s.code}` }))
      default: return []
    }
  }

  const submitCreate = async () => {
    setSubmitting(true)
    setTaskError(null)
    try {
      const payload: Record<string, unknown> = {
        type: createType,
        code: form.code,
        name: form.name || undefined,
      }
      if (createType === 'zone') {
        payload.warehouse_id = Number(warehouseId)
      } else {
        if (!form.parent_id) {
          setTaskError('A parent location is required.')
          setSubmitting(false)
          return
        }
        payload.parent_id = Number(form.parent_id)
      }
      await post('/locations', payload)
      setTaskSuccess('Location created.')
      setShowCreate(false)
      await load()
    } catch (e: unknown) {
      setTaskError((e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to create location')
    } finally {
      setSubmitting(false)
    }
  }

  const locTypeOptions = [
    { value: 'zone', label: 'Zone' },
    { value: 'aisle', label: 'Aisle' },
    { value: 'rack', label: 'Rack' },
    { value: 'shelf', label: 'Shelf' },
    { value: 'bin', label: 'Bin' },
  ]

  return (
    <div className="space-y-4">
      <PageHeader
        title="Locations"
        subtitle="Manage warehouse zones, aisles, racks, shelves, and bins."
        actions={
          <Button size="md" onClick={openCreate}>
            <Plus size={15} /> New Location
          </Button>
        }
      />

      {error && <ErrorBanner message={error} />}
      {taskSuccess && (
        <div className="bg-mint-soft border border-mint/30 text-mint px-4 py-3 rounded-lg text-sm flex items-center gap-2">
          {taskSuccess}
        </div>
      )}

      <Card>
        <div className="px-5 py-4 border-b border-border">
          <div className="w-64">
            <Select
              label="Warehouse"
              value={warehouseId}
              onChange={setWarehouseId}
              options={warehouses.map((w) => ({ value: w.id, label: w.name }))}
            />
          </div>
        </div>

        {loading ? (
          <TableSkeleton cols={5} />
        ) : rows.length === 0 ? (
          <EmptyState message="No locations found for this warehouse." icon={<MapPin size={28} />} />
        ) : (
          <Table headers={['Code', 'Type', 'Path', 'Active', '']}>
            {rows.map((row) => (
              <tr key={`${row.type}-${row.id}`} className="hover:bg-surface-subtle/60">
                <td className="px-4 py-3 font-mono text-xs font-semibold text-ink">{row.code}</td>
                <td className="px-4 py-3"><Badge status={row.type}>{row.type}</Badge></td>
                <td className="px-4 py-3 text-sm text-ink-muted">{row.path || '—'}</td>
                <td className="px-4 py-3">
                  {row.type === 'bin' ? (row.is_active ? 'Yes' : 'No') : '—'}
                </td>
                <td className="px-4 py-3 text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      if (!confirm(`Delete ${row.type} ${row.code}?`)) return
                      try {
                        await del(`/locations/${row.type}-${row.id}`)
                        setTaskSuccess('Location deleted.')
                        await load()
                      } catch (e: unknown) {
                        setTaskError((e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to delete location')
                      }
                    }}
                  >
                    Delete
                  </Button>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Modal open={showCreate} title="Create Location" onClose={() => setShowCreate(false)}>
        {taskError && <div className="mb-4"><ErrorBanner message={taskError} /></div>}
        <div className="space-y-4">
          <Select
            label="Location Type"
            value={createType}
            onChange={(v) => setCreateType(v as LocType)}
            options={locTypeOptions}
          />
          {createType !== 'zone' && (
            <Select
              label="Parent"
              value={form.parent_id}
              onChange={(v) => setForm({ ...form, parent_id: v })}
              options={parentOptions()}
            />
          )}
          <Input label="Code" value={form.code} onChange={(v) => setForm({ ...form, code: v })} placeholder="e.g. Z-A1 / A-01 / R-01" required />
          {(createType === 'zone' || createType === 'aisle') && (
            <Input label="Name (optional)" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
          )}
          <div className="flex justify-end pt-2">
            <Button size="md" onClick={submitCreate} disabled={submitting}>
              {submitting ? 'Creating…' : 'Create Location'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}