import { useState } from 'react'
import { ClipboardCheck, Check, X, Loader2, CircleSlash, AlertTriangle, ShieldAlert } from 'lucide-react'
import { post } from '../services/apiClient'
import { errMsg } from '../lib/errors'

/**
 * Something the AI prepared for the user:
 * - a create:        {"endpoint": "purchase-orders", "payload": {...}}
 * - an operation:    {"endpoint": "sales-orders/12/confirm", "payload": {"id": 12, "number": "SO-0009"}}
 */
export interface AiAction {
  endpoint: string
  payload: Record<string, unknown>
}

/** Create endpoints the card may POST to (whitelist; the AI only names one). */
const CREATE_ENDPOINTS: Record<string, string> = {
  'products': 'Create product',
  'purchase-orders': 'Create purchase order',
  'sales-orders': 'Create sales order',
  'adjustments': 'Record stock adjustment',
  'transfers': 'Create stock transfer',
  'suppliers': 'Create supplier',
  'customers': 'Create customer',
}

interface OperationSpec {
  title: string
  danger?: boolean
}

/**
 * Operation endpoints the card may POST to after the user confirms.
 * Every path segment is fixed, except the numeric record id, so an action can
 * never reach a route outside this list.
 */
const OPERATIONS: Array<{ match: RegExp; spec: OperationSpec }> = [
  { match: /^purchase-orders\/\d+\/submit$/, spec: { title: 'Submit purchase order' } },
  { match: /^purchase-orders\/\d+\/approve$/, spec: { title: 'Approve purchase order' } },
  { match: /^purchase-orders\/\d+\/cancel$/, spec: { title: 'Cancel purchase order', danger: true } },
  { match: /^sales-orders\/\d+\/confirm$/, spec: { title: 'Confirm sales order' } },
  { match: /^sales-orders\/\d+\/cancel$/, spec: { title: 'Cancel sales order', danger: true } },
  { match: /^transfers\/\d+\/submit$/, spec: { title: 'Submit stock transfer' } },
  { match: /^transfers\/\d+\/approve$/, spec: { title: 'Approve stock transfer' } },
]

const ID_LABELS: Record<string, string> = {
  supplier_id: 'Supplier', customer_id: 'Customer', warehouse_id: 'Warehouse',
  source_warehouse_id: 'From warehouse', destination_warehouse_id: 'To warehouse',
  product_id: 'Product', category_id: 'Category', unit_id: 'Unit', brand_id: 'Brand',
  bin_id: 'Bin',
}

const FIELD_LABELS: Record<string, string> = {
  sku: 'SKU', name: 'Name', selling_price: 'Selling price', cost_price: 'Cost price',
  min_stock: 'Min stock', reorder_level: 'Reorder level', signed_quantity: 'Quantity change',
  reason: 'Reason', notes: 'Notes', expected_delivery: 'Expected delivery',
  required_date: 'Required date', transfer_date: 'Transfer date', contact_name: 'Contact',
  phone: 'Phone', email: 'Email', code: 'Code', status: 'Status', tax_rate: 'Tax %',
  address: 'Address',
}

function label(key: string): string {
  return ID_LABELS[key] ?? FIELD_LABELS[key]
    ?? key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function value(key: string, v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  if (key.endsWith('_id') && (typeof v === 'number' || /^\d+$/.test(String(v)))) return '#' + v
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  return String(v)
}

function itemSummary(item: Record<string, unknown>): string {
  const parts: string[] = []
  if (item.product_id !== undefined) parts.push('Product #' + item.product_id)
  if (item.quantity !== undefined) parts.push('× ' + item.quantity)
  if (item.unit_cost !== undefined && item.unit_cost !== null && item.unit_cost !== '') parts.push('@ ' + item.unit_cost)
  return parts.join('  ')
}

export type AiContentPart =
  | { type: 'text'; text: string }
  | { type: 'action'; action: AiAction }

/**
 * Split an assistant reply into markdown text parts and ```action blocks.
 * Malformed action blocks stay visible as plain text.
 */
export function parseAiContent(content: string): AiContentPart[] {
  const parts: AiContentPart[] = []
  const re = /```action[ \t]*\r?\n?([\s\S]*?)```/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(content))) {
    if (m.index > last) parts.push({ type: 'text', text: content.slice(last, m.index) })
    let ok = false
    try {
      const parsed = JSON.parse(m[1].trim()) as { endpoint?: unknown; payload?: unknown }
      if (parsed && typeof parsed === 'object' && typeof parsed.endpoint === 'string'
        && parsed.payload && typeof parsed.payload === 'object' && !Array.isArray(parsed.payload)) {
        parts.push({ type: 'action', action: { endpoint: parsed.endpoint, payload: parsed.payload as Record<string, unknown> } })
        ok = true
      }
    } catch { /* shown as raw text below */ }
    if (!ok) parts.push({ type: 'text', text: content.slice(m.index, m.index + m[0].length) })
    last = m.index + m[0].length
  }
  if (last < content.length) parts.push({ type: 'text', text: content.slice(last) })
  return parts.filter((p) => p.type === 'action' || p.text.trim() !== '')
}

interface ActionCardProps {
  action: AiAction
  /** Persisted state of this proposal: null = still open. */
  state?: 'done' | 'dismissed' | null
  result?: string | null
  /** Confirmed or cancelled – the caller persists the outcome. */
  onResolved?: (state: 'done' | 'dismissed', result?: string) => void
}

interface ResolvedRow {
  label: string
  value: string
}

/**
 * Confirmation card for an AI-proposed create or operation. Nothing is written
 * until the user presses Confirm; the request then runs through the normal
 * permission-checked API with the user's own token.
 */
export default function ActionCard({ action, state = null, result = null, onResolved }: ActionCardProps) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const op = OPERATIONS.find((o) => o.match.test(action.endpoint))
  const createTitle = CREATE_ENDPOINTS[action.endpoint]
  const danger = op?.spec.danger === true

  if (!op && !createTitle) {
    return (
      <div className="my-2 rounded-xl border border-amber/40 bg-amber-soft/60 px-3 py-2.5 text-[12.5px]">
        <p className="flex items-center gap-2 font-semibold text-ink">
          <ShieldAlert size={14} className="text-amber shrink-0" /> Action blocked
        </p>
        <p className="text-ink-muted mt-1">
          The AI tried to use “{action.endpoint}”, which is not an approved action. Nothing was saved.
        </p>
      </div>
    )
  }

  let rows: ResolvedRow[]
  if (op) {
    const pathId = action.endpoint.match(/\d+/)?.[0]
    rows = [
      { label: 'Record', value: action.payload.number ? String(action.payload.number) : '—' },
      { label: 'ID', value: action.payload.id !== undefined ? '#' + String(action.payload.id) : pathId ? '#' + pathId : '—' },
    ]
    if (action.payload.reason !== undefined && action.payload.reason !== null && action.payload.reason !== '') {
      rows.push({ label: 'Reason', value: String(action.payload.reason) })
    }
    if (action.payload.notes !== undefined && action.payload.notes !== null && action.payload.notes !== '') {
      rows.push({ label: 'Notes', value: String(action.payload.notes) })
    }
  } else {
    const entries = Object.entries(action.payload).filter(([k]) => k !== 'items')
    const items = Array.isArray(action.payload.items) ? (action.payload.items as Record<string, unknown>[]) : null
    rows = entries.map(([k, v]) => ({ label: label(k), value: value(k, v) }))
    if (items) {
      for (const [i, it] of items.entries()) {
        rows.push({ label: items.length > 1 ? `Item ${i + 1}` : 'Item', value: itemSummary(it) })
      }
    }
  }

  const title = op ? op.spec.title : createTitle

  const confirm = async () => {
    setSaving(true)
    setError(null)
    try {
      const data = await post<Record<string, unknown> | null>(action.endpoint, action.payload)
      const created = data && typeof data === 'object'
        ? (data.number ?? data.sku ?? data.name ?? (data.id ? '#' + data.id : null))
        : null
      onResolved?.('done', created !== null && created !== undefined ? String(created) : undefined)
    } catch (e) {
      setError(errMsg(e, 'Could not save. Check the details in the relevant screen and try again.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={`my-2 rounded-xl overflow-hidden text-[12.5px] ${
      danger ? 'border border-red/30 bg-red-soft/40' : 'border border-violet/30 bg-violet/5'
    }`}>
      <div className={`flex items-center gap-2 px-3 py-2 border-b ${
        danger ? 'border-red/20 bg-red/10' : 'border-violet/20 bg-violet/10'
      }`}>
        <ClipboardCheck size={14} className={`${danger ? 'text-red' : 'text-violet'} shrink-0`} />
        <p className="font-semibold text-ink">{title}</p>
        {!state && !saving && (
          <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-surface border border-border text-ink-muted shrink-0">
            nothing changed yet
          </span>
        )}
      </div>

      <div className="px-3 py-2 space-y-1">
        {rows.map((r, i) => (
          <div key={i} className="flex gap-3">
            <span className="text-ink-muted shrink-0">{r.label}:</span>
            <span className="text-ink font-medium break-all">{r.value}</span>
          </div>
        ))}
        {danger && !state && !saving && (
          <p className="pt-1 text-[11px] text-red font-medium">This cannot be undone — confirm carefully.</p>
        )}
      </div>

      {saving && (
        <p className="flex items-center gap-1.5 px-3 pb-2.5 text-[11px] text-ink-muted">
          <Loader2 size={12} className={`animate-spin ${danger ? 'text-red' : 'text-violet'}`} /> Saving…
        </p>
      )}

      {state === 'done' && (
        <p className="flex items-center gap-1.5 px-3 pb-2.5 text-[11px] text-mint font-medium">
          <Check size={13} /> Done{result ? ` — ${result}` : ''}
        </p>
      )}
      {state === 'dismissed' && (
        <p className="flex items-center gap-1.5 px-3 pb-2.5 text-[11px] text-ink-muted">
          <CircleSlash size={13} /> Dismissed — nothing was changed.
        </p>
      )}

      {!state && !saving && (
        <div className="flex items-center gap-2 px-3 pb-2.5">
          <button onClick={confirm}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-[11.5px] font-medium hover:opacity-90 transition ${
              danger ? 'bg-red' : 'bg-gradient-to-br from-violet to-blue'
            }`}>
            <Check size={13} /> Confirm
          </button>
          <button onClick={() => onResolved?.('dismissed')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-ink-muted text-[11.5px] hover:text-red hover:border-red/40 transition">
            <X size={13} /> Dismiss
          </button>
        </div>
      )}

      {error && (
        <p className="flex items-start gap-1.5 px-3 pb-2.5 text-[11px] text-red">
          <AlertTriangle size={12} className="mt-0.5 shrink-0" /> {error}
        </p>
      )}
    </div>
  )
}
