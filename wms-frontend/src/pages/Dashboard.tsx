import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Boxes, Lock, AlertTriangle, ShoppingCart, ArrowLeftRight, ArrowRight, DollarSign, PackageOpen,
  Sparkles, RefreshCw, ArrowDownToLine, ArrowUpFromLine, CheckCircle2, Info, XCircle, Warehouse,
  Grid3x3, Truck, ClipboardList, PackageCheck, Activity,
} from 'lucide-react'
import { get } from '../services/apiClient'
import { Card, Badge, EmptyState, ErrorBanner, Skeleton } from '../components/ui'
import { ThroughputChart, PipelineBars, Meter, type ThroughputPoint, type PipelineStage } from '../components/charts'
import { useAuth } from '../context/AuthContext'
import { useCopilot } from '../components/Copilot'
import { errMsg, fmtMoney, fmtNum } from '../lib/errors'

interface Order { id: number; number: string; status: string; total?: string; created_at?: string; customer?: { name: string }; supplier?: { name: string } }
interface Movement {
  id: number; movement_type: string; quantity: string; created_at: string
  product?: { sku: string; name: string }; warehouse?: { code: string }; bin?: { code: string } | null; user?: { name: string } | null
}
interface LowStock { id: number; sku: string; name: string; warehouse: string | null; on_hand: number; available: number; reorder_level: number }
interface WarehouseCard { id: number; code: string; name: string; on_hand: number; reserved: number; skus: number; open_orders: number }
interface DashboardData {
  counts: {
    products: number; on_hand: number; reserved: number; available: number; damaged: number; stock_value: number
    pending_sales_orders: number; pending_purchase_orders: number; pending_transfers: number
    low_stock_products: number; out_of_stock_products: number; open_pick_lists: number; open_putaway: number
    total_bins: number; occupied_bins: number; staging_units: number; today_shipped: number; today_received: number
  }
  low_stock_items: LowStock[]
  pipeline: PipelineStage[]
  throughput: ThroughputPoint[]
  warehouses: WarehouseCard[]
  recent_sales_orders: Order[]
  recent_purchase_orders: Order[]
  recent_movements: Movement[]
}
interface Insight { severity: 'critical' | 'warning' | 'info' | 'success'; title: string; detail: string; action: string }
interface InsightResp { source: 'ai' | 'rules'; insights: Insight[]; generated_at: string }

const ACTION_ROUTES: Record<string, string> = {
  purchasing: '/purchasing', inventory: '/inventory', picking: '/picking', packing: '/packing', shipping: '/shipping',
  transfers: '/transfers', 'stock-counts': '/stock-counts', reports: '/reports', receiving: '/receiving', putaway: '/putaway', dashboard: '/dashboard',
}

const MOVE_LABEL: Record<string, { label: string; tone: string; sign: string }> = {
  stock_in: { label: 'Received', tone: 'text-mint bg-mint-soft', sign: '+' },
  stock_out: { label: 'Shipped', tone: 'text-blue bg-blue-soft', sign: '−' },
  transfer_in: { label: 'Transfer in', tone: 'text-mint bg-mint-soft', sign: '+' },
  transfer_out: { label: 'Transfer out', tone: 'text-violet bg-violet/10', sign: '−' },
  adjustment: { label: 'Adjustment', tone: 'text-amber bg-amber-soft', sign: '±' },
  return: { label: 'Return', tone: 'text-mint bg-mint-soft', sign: '+' },
  return_damaged: { label: 'Return (damaged)', tone: 'text-red bg-red-soft', sign: '+' },
  damage: { label: 'Damaged', tone: 'text-red bg-red-soft', sign: '−' },
}

function Kpi({ label, value, sub, icon, tone, to }: { label: string; value: ReactNode; sub?: ReactNode; icon: ReactNode; tone: string; to?: string }) {
  const body = (
    <Card className="p-4 h-full hover:shadow-popover hover:border-blue/30 transition">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">{label}</p>
        <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${tone}`}>{icon}</span>
      </div>
      <p className="text-[26px] font-bold text-ink mt-1.5 leading-none tabular-nums">{value}</p>
      {sub && <p className="text-xs text-ink-muted mt-2">{sub}</p>}
    </Card>
  )
  return to ? <Link to={to} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-blue rounded-xl">{body}</Link> : body
}

function SectionTitle({ icon, title, action }: { icon: ReactNode; title: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between px-5 pt-4 pb-3">
      <h2 className="font-semibold text-ink text-sm flex items-center gap-2"><span className="text-ink-subtle">{icon}</span>{title}</h2>
      {action}
    </div>
  )
}

function AiInsights({ warehouseId }: { warehouseId: string }) {
  const [data, setData] = useState<InsightResp | null>(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const { setOpen, send } = useCopilot()

  const load = useCallback((refresh = false) => {
    setLoading(true)
    get<InsightResp>('/ai/insights', { warehouse_id: warehouseId || undefined, refresh: refresh ? 1 : undefined })
      .then(setData).catch(() => setData(null)).finally(() => setLoading(false))
  }, [warehouseId])
  useEffect(() => { load() }, [load])

  const handleWithCopilot = (ins: Insight) => {
    setOpen(true)
    send(`On the dashboard you flagged: "${ins.title}" — ${ins.detail}. Take care of this for me: check the live data and prepare exactly what is needed (for example a replenishment purchase order, a stock adjustment, or an operation on an existing order) and show me the action card to confirm.`)
  }

  const icon = { critical: <XCircle size={15} />, warning: <AlertTriangle size={15} />, info: <Info size={15} />, success: <CheckCircle2 size={15} /> }
  const tone = { critical: 'text-red bg-red-soft', warning: 'text-amber bg-amber-soft', info: 'text-blue bg-blue-soft', success: 'text-mint bg-mint-soft' }

  return (
    <Card className="overflow-hidden h-full flex flex-col">
      <div className="px-5 pt-4 pb-3 flex items-center gap-2 bg-gradient-to-r from-violet/[0.07] to-blue/[0.05] border-b border-border">
        <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet to-blue text-white flex items-center justify-center"><Sparkles size={14} /></span>
        <div className="flex-1">
          <h2 className="font-semibold text-ink text-sm leading-tight">AI Insights</h2>
          <p className="text-[11px] text-ink-muted leading-tight">
            {data?.source === 'ai' ? 'Generated by AI from live data' : 'Rule-based (AI unreachable)'}
          </p>
        </div>
        <button onClick={() => load(true)} className="p-1.5 rounded-lg text-ink-muted hover:bg-surface hover:text-ink" aria-label="Refresh insights" title="Refresh">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>
      <div className="flex-1 divide-y divide-border">
        {loading && !data ? (
          <div className="p-5 space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : !data?.insights?.length ? (
          <EmptyState message="No insights available." />
        ) : data.insights.map((ins, i) => (
          <div key={i} className="group flex gap-3 px-5 py-3 hover:bg-surface-subtle/60 transition cursor-pointer"
            onClick={() => navigate(ACTION_ROUTES[ins.action] ?? '/dashboard')} title="Open the module">
            <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${tone[ins.severity] ?? tone.info}`}>{icon[ins.severity] ?? icon.info}</span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-ink">{ins.title}</p>
              <p className="text-xs text-ink-muted leading-relaxed">{ins.detail}</p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); handleWithCopilot(ins) }}
              className="self-center shrink-0 flex items-center gap-1 text-[11px] font-semibold text-violet px-2 py-1 rounded-lg hover:bg-violet/10 transition opacity-60 group-hover:opacity-100"
              title="Let the AI Copilot handle this insight">
              <Sparkles size={13} /> Handle
            </button>
          </div>
        ))}
      </div>
      <button
        onClick={() => { setOpen(true); send('Give me a short operations briefing for today: risks, priorities and what to do first.') }}
        className="text-xs font-semibold text-violet hover:bg-violet/5 px-5 py-3 border-t border-border text-left flex items-center gap-1.5"
      >
        <Sparkles size={13} /> Ask Copilot for a full briefing <ArrowRight size={13} />
      </button>
    </Card>
  )
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [warehouses, setWarehouses] = useState<{ id: number; code: string; name: string }[]>([])
  const [warehouseId, setWarehouseId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  const { user, hasPermission } = useAuth()
  const navigate = useNavigate()

  const load = useCallback(() => {
    setError(null)
    get<DashboardData>('/dashboard', { warehouse_id: warehouseId || undefined })
      .then((d) => { setData(d); setUpdatedAt(new Date()) })
      .catch((e) => setError(errMsg(e, 'Failed to load dashboard')))
      .finally(() => setLoading(false))
  }, [warehouseId])

  useEffect(() => { setLoading(true); load() }, [load])
  useEffect(() => { const t = setInterval(load, 60000); return () => clearInterval(t) }, [load])
  useEffect(() => {
    get<{ id: number; code: string; name: string }[]>('/warehouses', { per_page: 100 }).then((w) => setWarehouses(Array.isArray(w) ? w : [])).catch(() => {})
  }, [])

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  if (error && !data) return <ErrorBanner message={error} onRetry={load} />

  const c = data?.counts
  const binPct = c && c.total_bins ? Math.round((c.occupied_bins / c.total_bins) * 100) : 0

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-ink-muted">{new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
          <h1 className="text-2xl font-bold text-ink tracking-tight">{greeting}, {user?.name?.split(' ')[0]}</h1>
          <p className="text-sm text-ink-muted">Warehouse control tower — live stock, flow and fulfilment status.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Warehouse size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle pointer-events-none" />
            <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} aria-label="Warehouse"
              className="pl-8 pr-8 py-2 text-sm border border-border rounded-lg bg-surface text-ink focus:ring-2 focus:ring-blue/30 outline-none">
              <option value="">All warehouses</option>
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.code} · {w.name}</option>)}
            </select>
          </div>
          <button onClick={() => { setLoading(true); load() }} className="p-2 rounded-lg border border-border bg-surface text-ink-muted hover:text-ink" aria-label="Refresh">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>
      {updatedAt && <p className="text-[11px] text-ink-subtle -mt-3">Updated {updatedAt.toLocaleTimeString()} · auto-refresh every minute</p>}

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 gap-3">
        {!c ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[106px] rounded-xl" />) : (
          <>
            <Kpi label="Inventory value" value={fmtMoney(c.stock_value)} sub={`${fmtNum(c.products)} SKUs in catalogue`} icon={<DollarSign size={16} />} tone="bg-mint-soft text-mint" to="/reports" />
            <Kpi label="Available units" value={fmtNum(c.available)} sub={<>{fmtNum(c.on_hand)} on hand · {fmtNum(c.reserved)} reserved</>} icon={<Boxes size={16} />} tone="bg-blue-soft text-blue" to="/inventory" />
            <Kpi label="Open orders" value={fmtNum(c.pending_sales_orders)} sub={`${c.open_pick_lists} pick lists open`} icon={<PackageOpen size={16} />} tone="bg-violet/10 text-violet" to="/sales" />
            <Kpi label="Inbound POs" value={fmtNum(c.pending_purchase_orders)} sub={`${c.open_putaway} putaway batches open`} icon={<ShoppingCart size={16} />} tone="bg-blue-soft text-blue" to="/purchasing" />
            <Kpi label="Low stock" value={fmtNum(c.low_stock_products)} sub={c.out_of_stock_products > 0 ? <span className="text-red font-semibold">{c.out_of_stock_products} out of stock</span> : 'No stock-outs'} icon={<AlertTriangle size={16} />} tone="bg-amber-soft text-amber" to="/inventory?low_stock=1" />
            <Kpi label="Transfers" value={fmtNum(c.pending_transfers)} sub="in progress between sites" icon={<ArrowLeftRight size={16} />} tone="bg-surface-subtle text-ink-muted" to="/transfers" />
          </>
        )}
      </div>

      {/* Flow + AI */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="xl:col-span-2">
          <SectionTitle icon={<Activity size={15} />} title="Warehouse throughput" action={
            c && <div className="flex gap-4 text-xs text-ink-muted">
              <span className="inline-flex items-center gap-1"><ArrowDownToLine size={13} className="text-mint" /> Today in <b className="text-ink tabular-nums">{fmtNum(c.today_received)}</b></span>
              <span className="inline-flex items-center gap-1"><ArrowUpFromLine size={13} className="text-blue" /> Shipped today <b className="text-ink tabular-nums">{c.today_shipped}</b></span>
            </div>
          } />
          <div className="px-5 pb-5">{data ? <ThroughputChart data={data.throughput} /> : <Skeleton className="h-56" />}</div>
        </Card>
        <AiInsights warehouseId={warehouseId} />
      </div>

      {/* Pipeline / storage / low stock */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        <Card>
          <SectionTitle icon={<Truck size={15} />} title="Fulfilment pipeline" action={<Link to="/sales" className="text-xs font-semibold text-blue hover:underline">Orders</Link>} />
          <div className="px-5 pb-5">
            {data ? <PipelineBars data={data.pipeline} onSelect={(s) => navigate(
              s === 'confirmed' || s === 'picking' ? '/picking' : s === 'picked' ? '/packing' : s === 'packed' ? '/shipping' : '/sales',
            )} /> : <Skeleton className="h-48" />}
          </div>
        </Card>

        <Card>
          <SectionTitle icon={<Grid3x3 size={15} />} title="Storage & sites" action={hasPermission('locations.view') ? <Link to="/locations" className="text-xs font-semibold text-blue hover:underline">Locations</Link> : undefined} />
          <div className="px-5 pb-5 space-y-4">
            {c ? (
              <>
                <div>
                  <div className="flex items-baseline justify-between mb-1.5">
                    <span className="text-xs text-ink-muted">Bin occupancy</span>
                    <span className="text-sm font-bold text-ink tabular-nums">{binPct}% <span className="text-xs font-normal text-ink-muted">({c.occupied_bins}/{c.total_bins} bins)</span></span>
                  </div>
                  <Meter value={c.occupied_bins} max={c.total_bins} label="Bin occupancy" />
                  {c.staging_units > 0 && (
                    <Link to="/putaway" className="mt-2 text-xs text-amber font-medium inline-flex items-center gap-1 hover:underline">
                      <PackageCheck size={13} /> {fmtNum(c.staging_units)} units waiting in staging for putaway
                    </Link>
                  )}
                </div>
                <div className="space-y-2">
                  {data!.warehouses.map((w) => (
                    <button key={w.id} onClick={() => setWarehouseId(String(w.id))}
                      className={`w-full text-left rounded-lg border px-3 py-2.5 transition ${String(w.id) === warehouseId ? 'border-blue bg-blue-soft/40' : 'border-border hover:border-blue/40'}`}>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-ink truncate"><span className="font-mono text-xs text-ink-muted mr-1.5">{w.code}</span>{w.name}</span>
                      </div>
                      <div className="flex gap-4 mt-1 text-xs text-ink-muted tabular-nums">
                        <span><b className="text-ink">{fmtNum(w.on_hand)}</b> on hand</span>
                        <span><b className="text-ink">{w.skus}</b> SKUs</span>
                        <span><b className="text-ink">{w.open_orders}</b> open orders</span>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            ) : <Skeleton className="h-48" />}
          </div>
        </Card>

        <Card className="lg:col-span-2 xl:col-span-1">
          <SectionTitle icon={<AlertTriangle size={15} />} title="Replenishment needed" action={<Link to="/purchasing" className="text-xs font-semibold text-blue hover:underline">Create PO</Link>} />
          {!data ? <div className="px-5 pb-5"><Skeleton className="h-48" /></div> : data.low_stock_items.length === 0 ? (
            <EmptyState message="All SKUs are above their reorder level." icon={<CheckCircle2 size={26} />} />
          ) : (
            <div className="divide-y divide-border">
              {data.low_stock_items.map((p) => {
                const pct = p.reorder_level > 0 ? Math.max(0, Math.min(100, (p.available / p.reorder_level) * 100)) : 0
                return (
                  <div key={`${p.id}-${p.warehouse}`} className="px-5 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ink truncate">{p.name}</p>
                        <p className="text-[11px] text-ink-muted font-mono">{p.sku}{p.warehouse ? ` · ${p.warehouse}` : ''}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-sm font-bold tabular-nums ${p.available <= 0 ? 'text-red' : 'text-amber'}`}>{fmtNum(p.available)}</p>
                        <p className="text-[11px] text-ink-muted">reorder at {fmtNum(p.reorder_level)}</p>
                      </div>
                    </div>
                    <div className="h-1.5 mt-1.5 rounded-full bg-surface-subtle overflow-hidden">
                      <div className={`h-full rounded-full ${p.available <= 0 ? 'bg-red' : 'bg-amber'}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Activity */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="xl:col-span-1">
          <SectionTitle icon={<ClipboardList size={15} />} title="Live stock movements" action={<Link to="/inventory" className="text-xs font-semibold text-blue hover:underline">Stock</Link>} />
          {!data ? <div className="px-5 pb-5"><Skeleton className="h-48" /></div> : data.recent_movements.length === 0 ? (
            <EmptyState message="No movements yet." />
          ) : (
            <ul className="divide-y divide-border">
              {data.recent_movements.map((m) => {
                const meta = MOVE_LABEL[m.movement_type] ?? { label: m.movement_type, tone: 'text-ink-muted bg-surface-subtle', sign: '' }
                return (
                  <li key={m.id} className="px-5 py-2.5 flex items-center gap-3">
                    <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${meta.tone}`}>{meta.label}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] text-ink truncate"><span className="font-mono text-xs text-ink-muted">{m.product?.sku}</span> {m.product?.name}</p>
                      <p className="text-[11px] text-ink-subtle">{m.warehouse?.code}{m.bin ? ` / ${m.bin.code}` : ' / staging'} · {new Date(m.created_at).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                    <span className="text-sm font-semibold text-ink tabular-nums">{meta.sign}{fmtNum(m.quantity)}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>

        {[
          { title: 'Recent sales orders', icon: <Truck size={15} />, to: '/sales', rows: data?.recent_sales_orders, party: (o: Order) => o.customer?.name },
          { title: 'Recent purchase orders', icon: <ShoppingCart size={15} />, to: '/purchasing', rows: data?.recent_purchase_orders, party: (o: Order) => o.supplier?.name },
        ].map((block) => (
          <Card key={block.title}>
            <SectionTitle icon={block.icon} title={block.title} action={
              <Link to={block.to} className="text-xs font-semibold text-blue hover:underline inline-flex items-center gap-1">View all <ArrowRight size={12} /></Link>
            } />
            {!block.rows ? <div className="px-5 pb-5"><Skeleton className="h-48" /></div> : block.rows.length === 0 ? (
              <EmptyState message="Nothing yet." />
            ) : (
              <div className="divide-y divide-border">
                {block.rows.map((o) => (
                  <div key={o.id} className="flex items-center justify-between gap-2 px-5 py-2.5">
                    <div className="min-w-0">
                      <p className="font-mono text-xs font-semibold text-ink">{o.number}</p>
                      <p className="text-xs text-ink-muted truncate">{block.party(o) || '—'}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {o.total && <span className="text-xs text-ink-muted tabular-nums">{fmtMoney(o.total)}</span>}
                      <Badge status={o.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        ))}
      </div>

      {c && c.damaged > 0 && (
        <Card className="p-4 border-l-4 border-l-red flex items-center gap-3">
          <Lock size={16} className="text-red" />
          <p className="text-sm text-ink flex-1"><b>{fmtNum(c.damaged)}</b> damaged units are quarantined. Inspect and write off or return them to the supplier.</p>
          <Link to="/inventory" className="text-xs font-semibold text-red hover:underline">Review</Link>
        </Card>
      )}
    </div>
  )
}
