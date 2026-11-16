import { useCallback, useEffect, useState } from 'react'
import { Package, Plus, Pencil, ScanBarcode, X, Trash2 } from 'lucide-react'
import { del, get, getList, post, put } from '../services/apiClient'
import {
  Card, Badge, Table, TableSkeleton, ErrorBanner, EmptyState, PageHeader, Pagination, SearchInput,
  Button, Modal, Input, Select, Toast,
} from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { errMsg, fmtNum } from '../lib/errors'

interface Product {
  id: number
  sku: string
  name: string
  description?: string | null
  category_id: number | null
  brand_id: number | null
  unit_id: number | null
  category?: { name?: string } | null
  brand?: { name?: string } | null
  unit?: { name?: string; code?: string } | null
  cost_price: string
  selling_price: string
  tax_rate: string
  min_stock: string
  max_stock: string | null
  reorder_level: string
  weight: string | null
  status: string
  on_hand: string | null
  reserved: string | null
}
interface Ref { id: number; name: string; code?: string }
interface Barcode { id: number; barcode: string; type: string }

const EMPTY = {
  sku: '', name: '', description: '', category_id: '', brand_id: '', unit_id: '', cost_price: '0', selling_price: '0',
  tax_rate: '0', min_stock: '0', max_stock: '', reorder_level: '0', weight: '', status: 'active',
}

export default function Products() {
  const { hasPermission } = useAuth()
  const [data, setData] = useState<Product[]>([])
  const [meta, setMeta] = useState({ total: 0, current_page: 1, last_page: 1 })
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  const [editing, setEditing] = useState<Product | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ ...EMPTY })
  const [formErr, setFormErr] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [refs, setRefs] = useState<{ categories: Ref[]; brands: Ref[]; units: Ref[] }>({ categories: [], brands: [], units: [] })

  const [barcodeFor, setBarcodeFor] = useState<Product | null>(null)
  const [barcodes, setBarcodes] = useState<Barcode[]>([])
  const [newCode, setNewCode] = useState('')
  const [codeErr, setCodeErr] = useState<string | null>(null)

  const load = useCallback((page = 1) => {
    setLoading(true)
    setError(null)
    getList<Product>('/products', { page, per_page: 15, search: search || undefined, sort_by: 'sku', sort_order: 'asc' })
      .then((resp) => {
        setData(resp.data)
        setMeta({ total: resp.total, current_page: resp.current_page, last_page: resp.last_page })
      })
      .catch((e) => setError(errMsg(e, 'Failed to load products')))
      .finally(() => setLoading(false))
  }, [search])

  useEffect(() => { const t = setTimeout(() => load(1), 250); return () => clearTimeout(t) }, [load])

  const loadRefs = () => {
    if (refs.categories.length) return
    Promise.all([get<Ref[]>('/categories'), get<Ref[]>('/brands'), get<Ref[]>('/units')])
      .then(([categories, brands, units]) => setRefs({ categories, brands, units }))
      .catch(() => {})
  }

  const openCreate = () => {
    loadRefs()
    setEditing(null)
    setForm({ ...EMPTY })
    setFormErr(null)
    setShowForm(true)
  }
  const openEdit = (p: Product) => {
    loadRefs()
    setEditing(p)
    setForm({
      sku: p.sku, name: p.name, description: p.description ?? '', category_id: p.category_id ? String(p.category_id) : '',
      brand_id: p.brand_id ? String(p.brand_id) : '', unit_id: p.unit_id ? String(p.unit_id) : '', cost_price: String(Number(p.cost_price)),
      selling_price: String(Number(p.selling_price)), tax_rate: String(Number(p.tax_rate)), min_stock: String(Number(p.min_stock)),
      max_stock: p.max_stock !== null ? String(Number(p.max_stock)) : '', reorder_level: String(Number(p.reorder_level)),
      weight: p.weight !== null ? String(Number(p.weight)) : '', status: p.status,
    })
    setFormErr(null)
    setShowForm(true)
  }

  const save = async () => {
    setFormErr(null)
    if (!form.sku.trim() || !form.name.trim()) return setFormErr('SKU and name are required.')
    const payload: Record<string, unknown> = { ...form }
    for (const k of ['category_id', 'brand_id', 'unit_id', 'max_stock', 'weight']) if (payload[k] === '') payload[k] = null
    setSaving(true)
    try {
      if (editing) await put(`/products/${editing.id}`, payload)
      else await post('/products', payload)
      setShowForm(false)
      setToast({ msg: editing ? 'Product updated' : 'Product created', type: 'success' })
      load(meta.current_page)
    } catch (e) {
      setFormErr(errMsg(e, 'Could not save product'))
    } finally {
      setSaving(false)
    }
  }

  const remove = async (p: Product) => {
    if (!window.confirm(`Delete ${p.sku}? This cannot be undone.`)) return
    try {
      await del(`/products/${p.id}`)
      setToast({ msg: 'Product deleted', type: 'success' })
      load(meta.current_page)
    } catch (e) {
      setToast({ msg: errMsg(e, 'Delete failed'), type: 'error' })
    }
  }

  const openBarcodes = (p: Product) => {
    setBarcodeFor(p)
    setNewCode('')
    setCodeErr(null)
    get<Barcode[]>(`/products/${p.id}/barcodes`).then(setBarcodes).catch(() => setBarcodes([]))
  }
  const addBarcode = async () => {
    if (!barcodeFor || !newCode.trim()) return
    setCodeErr(null)
    try {
      await post(`/products/${barcodeFor.id}/barcodes`, { barcode: newCode.trim(), type: 'code128' })
      setNewCode('')
      setBarcodes(await get<Barcode[]>(`/products/${barcodeFor.id}/barcodes`))
    } catch (e) {
      setCodeErr(errMsg(e, 'Could not add barcode'))
    }
  }
  const removeBarcode = async (b: Barcode) => {
    if (!barcodeFor) return
    await del(`/products/${barcodeFor.id}/barcodes/${b.id}`).catch(() => {})
    setBarcodes((list) => list.filter((x) => x.id !== b.id))
  }

  const f = (k: keyof typeof EMPTY) => (v: string) => setForm((s) => ({ ...s, [k]: v }))
  const canEdit = hasPermission('products.update')

  return (
    <div className="space-y-4">
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      <PageHeader
        title="Products"
        subtitle={`${fmtNum(meta.total)} SKUs in the item master`}
        actions={<>
          <SearchInput placeholder="SKU, name or barcode…" value={search} onChange={setSearch} className="w-60" />
          {hasPermission('products.create') && <Button onClick={openCreate}><Plus size={15} /> New product</Button>}
        </>}
      />

      {error && <ErrorBanner message={error} onRetry={() => load(meta.current_page)} />}

      <Card>
        {loading ? <TableSkeleton cols={8} /> : data.length === 0 ? (
          <EmptyState message="No products found." icon={<Package size={28} />} />
        ) : (
          <Table headers={['SKU', 'Product', 'Category', 'Cost', 'Price', 'On hand', 'Reorder at', 'Status', '']}>
            {data.map((p) => {
              const available = Number(p.on_hand ?? 0) - Number(p.reserved ?? 0)
              const reorder = Number(p.reorder_level)
              const low = available <= reorder
              return (
                <tr key={p.id} className="hover:bg-surface-subtle/60 transition">
                  <td className="px-4 py-2.5 pl-5 font-mono text-xs text-brand font-semibold whitespace-nowrap">{p.sku}</td>
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-ink">{p.name}</p>
                    <p className="text-[11px] text-ink-muted">{p.brand?.name ?? '—'} · {p.unit?.name ?? 'unit'}</p>
                  </td>
                  <td className="px-4 py-2.5 text-ink-muted">{p.category?.name || '—'}</td>
                  <td className="px-4 py-2.5 tabular-nums text-ink-muted">${Number(p.cost_price).toFixed(2)}</td>
                  <td className="px-4 py-2.5 tabular-nums text-ink">${Number(p.selling_price).toFixed(2)}</td>
                  <td className="px-4 py-2.5">
                    <span className={`font-semibold tabular-nums ${low ? (available <= 0 ? 'text-red' : 'text-amber') : 'text-ink'}`}>{fmtNum(p.on_hand ?? 0)}</span>
                    {Number(p.reserved) > 0 && <span className="text-[11px] text-ink-muted ml-1">({fmtNum(p.reserved)} res.)</span>}
                    {low && <span className="ml-1.5 text-[10px] text-amber font-bold uppercase">Low</span>}
                  </td>
                  <td className="px-4 py-2.5 tabular-nums text-ink-muted">{fmtNum(reorder)}</td>
                  <td className="px-4 py-2.5"><Badge status={p.status} /></td>
                  <td className="px-4 py-2.5 pr-5">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => openBarcodes(p)} className="p-1.5 rounded-lg text-ink-muted hover:bg-surface-subtle hover:text-ink" title="Barcodes" aria-label="Barcodes"><ScanBarcode size={15} /></button>
                      {canEdit && <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg text-ink-muted hover:bg-surface-subtle hover:text-ink" title="Edit" aria-label="Edit"><Pencil size={15} /></button>}
                      {hasPermission('products.delete') && <button onClick={() => remove(p)} className="p-1.5 rounded-lg text-ink-muted hover:bg-red-soft hover:text-red" title="Delete" aria-label="Delete"><Trash2 size={15} /></button>}
                    </div>
                  </td>
                </tr>
              )
            })}
          </Table>
        )}
        <Pagination currentPage={meta.current_page} lastPage={meta.last_page} onChange={load} />
      </Card>

      <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? `Edit ${editing.sku}` : 'New product'} size="lg">
        <div className="space-y-4">
          {formErr && <ErrorBanner message={formErr} />}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input label="SKU" required value={form.sku} onChange={f('sku')} />
            <div className="sm:col-span-2"><Input label="Name" required value={form.name} onChange={f('name')} /></div>
            <Select label="Category" value={form.category_id} onChange={f('category_id')} options={refs.categories.map((c) => ({ value: c.id, label: c.name }))} />
            <Select label="Brand" value={form.brand_id} onChange={f('brand_id')} options={refs.brands.map((c) => ({ value: c.id, label: c.name }))} />
            <Select label="Unit of measure" value={form.unit_id} onChange={f('unit_id')} options={refs.units.map((c) => ({ value: c.id, label: c.name }))} />
            <Input label="Cost price" type="number" value={form.cost_price} onChange={f('cost_price')} />
            <Input label="Selling price" type="number" required value={form.selling_price} onChange={f('selling_price')} />
            <Input label="Tax rate %" type="number" value={form.tax_rate} onChange={f('tax_rate')} />
            <Input label="Min stock" type="number" value={form.min_stock} onChange={f('min_stock')} />
            <Input label="Reorder level" type="number" value={form.reorder_level} onChange={f('reorder_level')} helper="Low-stock alert threshold" />
            <Input label="Max stock" type="number" value={form.max_stock} onChange={f('max_stock')} helper="Used for reorder suggestions" />
            <Input label="Weight (kg)" type="number" value={form.weight} onChange={f('weight')} />
            <Select label="Status" value={form.status} onChange={f('status')} options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }, { value: 'discontinued', label: 'Discontinued' }]} />
          </div>
          <label className="block">
            <span className="block text-xs font-semibold text-ink-muted mb-1.5">Description</span>
            <textarea value={form.description} onChange={(e) => f('description')(e.target.value)} rows={2}
              className="w-full border border-border rounded-lg px-3.5 py-2.5 text-sm text-ink bg-surface focus:ring-2 focus:ring-brand/40 focus:border-brand outline-none" />
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Create product'}</Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!barcodeFor} onClose={() => setBarcodeFor(null)} title={`Barcodes · ${barcodeFor?.sku ?? ''}`}>
        <div className="space-y-3">
          {codeErr && <ErrorBanner message={codeErr} />}
          {barcodes.length === 0 ? <p className="text-sm text-ink-muted">No barcodes yet. Scanning the SKU still works.</p> : (
            <ul className="divide-y divide-border border border-border rounded-lg">
              {barcodes.map((b) => (
                <li key={b.id} className="flex items-center gap-2 px-3 py-2">
                  <ScanBarcode size={14} className="text-ink-subtle" />
                  <span className="font-mono text-sm text-ink flex-1">{b.barcode}</span>
                  <span className="text-[11px] uppercase text-ink-muted">{b.type}</span>
                  {canEdit && <button onClick={() => removeBarcode(b)} className="p-1 text-ink-muted hover:text-red" aria-label="Remove barcode"><X size={14} /></button>}
                </li>
              ))}
            </ul>
          )}
          {canEdit && (
            <div className="flex gap-2">
              <input value={newCode} onChange={(e) => setNewCode(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addBarcode()}
                placeholder="Scan or type a barcode…" className="flex-1 border border-border rounded-lg px-3 py-2 text-sm font-mono" />
              <Button onClick={addBarcode} disabled={!newCode.trim()}>Add</Button>
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
