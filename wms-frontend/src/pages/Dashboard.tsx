import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Boxes, Lock, AlertTriangle, ShoppingCart, ArrowLeftRight, ArrowRight, DollarSign, PackageOpen,
  Sparkles, RefreshCw, ArrowDownToLine, ArrowUpFromLine, CheckCircle2, Info, XCircle, Warehouse,
  Truck, ClipboardList, PackageCheck, Activity, LayoutDashboard, Box,
} from 'lucide-react'
import { get } from '../services/apiClient'
import { Card, Badge, EmptyState, ErrorBanner, Skeleton, Tilt, CubeChip } from '../components/ui'
import {
  ThroughputChart, PipelineBars, OccupancyCube, WarehouseFloor3D, type ThroughputPoint, type PipelineStage,
} from '../components/charts'
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
  stock_out: { label: 'Shipped', tone: 'text-steel bg-steel-soft', sign: '−' },
  transfer_in: { label: 'Transfer in', tone: 'text-mint bg-mint-soft', sign: '+' },
  transfer_out: { label: 'Transfer out', tone: 'text-violet bg-violet-soft', sign: '−' },
  adjustment: { label: 'Adjustment', tone: 'text-amber bg-amber-soft', sign: '±' },
  return: { label: 'Return', tone: 'text-mint bg-mint-soft', sign: '+' },
  return_damaged: { label: 'Return (damaged)', tone: 'text-red bg-red-soft', sign: '+' },
  damage: { label: 'Damaged', tone: 'text-red bg-red-soft', sign: '−' },
}


type ChipColor = 'brand' | 'steel' | 'mint' | 'amber' | 'red' | 'violet' | 'slate'

function Kpi({ label, value, sub, icon, color, to, delay = 0 }: { label: string; value: ReactNode; sub?: ReactNode; icon: ReactNode; color: ChipColor; to?: string; delay?: number }) {
  const bar: Record<ChipColor, string> = {
    brand: 'from-brand-light to-brand', steel: 'from-steel-light to-steel', mint: 'from-mint-light to-mint',
    amber: 'from-amber-light to-[#D97706]', red: 'from-[#EF5350] to-red', violet: 'from-[#8E7CF0] to-violet', slate: 'from-[#3E5A6B] to-graphite-3',
  }
  const body = (
    <Tilt className="h-full bg-surface border border-border rounded-2xl shadow-panel hover:shadow-lift p-4 pb-5 relative overflow-hidden animate-rise" style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-ink-muted pt-1 pop-z-sm">{label}</p>
        <span className="pop-z"><CubeChip color={color} size={36}>{icon}</CubeChip></span>
      </div>
      <p className="font-display text-[28px] font-bold text-ink mt-1 leading-none tabular-nums pop-z-sm">{value}</p>
      {sub && <p className="text-xs text-ink-muted mt-2 pop-z-sm">{sub}</p>}
      <div className={`absolute bottom-0 inset-x-0 h-1 bg-gradient-to-r ${bar[color]}`} />
    </Tilt>
  )
  return to ? <Link to={to} className="block h-full focus:outline-none focus-visible:ring-4 focus-visible:ring-brand/25 rounded-2xl">{body}</Link> : body
}

function SectionTitle({ icon, title, sub, action, color = 'slate' }: { icon: ReactNode; title: string; sub?: string; action?: ReactNode; color?: ChipColor }) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3">
      <div className="flex items-center gap-2.5 min-w-0">
        <CubeChip color={color} size={30}>{icon}</CubeChip>
        <div className="min-w-0">
          <h2 className="font-display font-bold text-ink text-[15px] leading-tight">{title}</h2>
          {sub && <p className="text-[11px] text-ink-muted leading-tight truncate">{sub}</p>}
        </div>
      </div>
      {action}
    </div>
  )
}

function LinkPill({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="shrink-0 text-[11px] font-bold text-brand bg-brand-soft hover:bg-brand hover:text-white border border-brand/20 rounded-lg px-2.5 py-1 inline-flex items-center gap-1 transition-colors">
      {children}
    </Link>
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

  const icon = { critical: <XCircle size={14} />, warning: <AlertTriangle size={14} />, info: <Info size={14} />, success: <CheckCircle2 size={14} /> }
  const chip: Record<string, ChipColor> = { critical: 'red', warning: 'amber', info: 'steel', success: 'mint' }

  return (
    <Card className="overflow-hidden h-full flex flex-col">
      <div className="relative px-5 pt-4 pb-4 flex items-center gap-2.5 graphite-bg text-white">
        <span className="relative"><CubeChip color="violet" size={34}><Sparkles size={16} /></CubeChip></span>
        <div className="relative flex-1">
          <h2 className="font-display font-bold text-[15px] leading-tight">AI Insights</h2>
          <p className="text-[11px] text-white/60 leading-tight flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${data?.source === 'ai' ? 'bg-mint-light animate-pulse' : 'bg-amber-light'}`} />
            {data?.source === 'ai' ? 'Generated by AI from live data' : 'Rule-based (AI unreachable)'}
          </p>
        </div>
        <button onClick={() => load(true)} className="relative p-2 rounded-lg text-white/70 hover:bg-white/10 hover:text-white" aria-label="Refresh insights" title="Refresh">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>
      <div className="flex-1 p-3 space-y-2 bg-surface-raised">
        {loading && !data ? (
          <div className="p-2 space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14" />)}</div>
        ) : !data?.insights?.length ? (
          <EmptyState message="No insights available." />
        ) : data.insights.map((ins, i) => (
          <div key={i} className="group flex gap-3 p-3 rounded-xl bg-surface border border-border shadow-[0_2px_0_#E3E9ED] hover:-translate-y-0.5 hover:shadow-panel hover:border-violet/30 transition-all cursor-pointer"
            onClick={() => navigate(ACTION_ROUTES[ins.action] ?? '/dashboard')} title="Open the module">
            <CubeChip color={chip[ins.severity] ?? 'steel'} size={28}>{icon[ins.severity] ?? icon.info}</CubeChip>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-bold text-ink leading-snug">{ins.title}</p>
              <p className="text-xs text-ink-muted leading-relaxed">{ins.detail}</p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); handleWithCopilot(ins) }}
              className="self-center shrink-0 flex items-center gap-1 text-[11px] font-bold text-violet px-2 py-1 rounded-lg bg-violet-soft hover:bg-violet hover:text-white transition opacity-70 group-hover:opacity-100"
              title="Let the AI Copilot handle this insight">
              <Sparkles size={12} /> Handle
            </button>
          </div>
        ))}
      </div>
      <button
        onClick={() => { setOpen(true); send('Give me a short operations briefing for today: risks, priorities and what to do first.') }}
        className="text-xs font-bold text-violet hover:bg-violet-soft px-5 py-3 border-t border-border text-left flex items-center gap-1.5 bg-surface"
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
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 animate-slide-up">
        <div className="flex items-center gap-4">
          <Tilt max={12} className="hidden sm:block"><CubeChip color="brand" size={54}><LayoutDashboard size={22} /></CubeChip></Tilt>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand">
              {new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
            <h1 className="font-display text-[28px] font-bold text-ink tracking-tight leading-tight">{greeting}, {user?.name?.split(' ')[0]}</h1>
            <p className="text-sm text-ink-muted">Warehouse control tower — live stock, flow and fulfilment status.</p>
          </div>
        </div>
        <div className="flex flex-col items-start md:items-end gap-1.5">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Warehouse size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand pointer-events-none" />
              <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} aria-label="Warehouse"
                className="pl-8 pr-8 py-2.5 text-sm font-semibold border border-border rounded-xl bg-surface text-ink shadow-key-neutral focus:shadow-glow focus:border-brand outline-none">
                <option value="">All warehouses</option>
                {warehouses.map((w) => <option key={w.id} value={w.id}>{w.code} · {w.name}</option>)}
              </select>
            </div>
            <button onClick={() => { setLoading(true); load() }} className="p-2.5 rounded-xl border border-border bg-surface text-ink-muted hover:text-brand shadow-key-neutral active:translate-y-[2px] active:shadow-none transition-all duration-100" aria-label="Refresh">
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
          {updatedAt && (
            <p className="text-[11px] text-ink-subtle flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-mint animate-pulse" /> Live · updated {updatedAt.toLocaleTimeString()} · auto-refresh every minute
            </p>
          )}
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 gap-4">
        {!c ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[118px] rounded-2xl" />) : (
          <>
            <Kpi delay={0} label="Inventory value" value={fmtMoney(c.stock_value)} sub={`${fmtNum(c.products)} SKUs in catalogue`} icon={<DollarSign size={17} />} color="mint" to="/reports" />
            <Kpi delay={50} label="Available units" value={fmtNum(c.available)} sub={<>{fmtNum(c.on_hand)} on hand · {fmtNum(c.reserved)} reserved</>} icon={<Boxes size={17} />} color="brand" to="/inventory" />
            <Kpi delay={100} label="Open orders" value={fmtNum(c.pending_sales_orders)} sub={`${c.open_pick_lists} pick lists open`} icon={<PackageOpen size={17} />} color="steel" to="/sales" />
            <Kpi delay={150} label="Inbound POs" value={fmtNum(c.pending_purchase_orders)} sub={`${c.open_putaway} putaway batches open`} icon={<ShoppingCart size={17} />} color="violet" to="/purchasing" />
            <Kpi delay={200} label="Low stock" value={fmtNum(c.low_stock_products)} sub={c.out_of_stock_products > 0 ? <span className="text-red font-bold">{c.out_of_stock_products} out of stock</span> : 'No stock-outs'} icon={<AlertTriangle size={17} />} color={c.out_of_stock_products > 0 ? 'red' : 'amber'} to="/inventory?low_stock=1" />
            <Kpi delay={250} label="Transfers" value={fmtNum(c.pending_transfers)} sub="in progress between sites" icon={<ArrowLeftRight size={17} />} color="slate" to="/transfers" />
          </>
        )}
      </div>

      {/* 3D floor + AI */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="xl:col-span-2 overflow-hidden">
          <SectionTitle color="brand" icon={<Box size={15} />} title="3D warehouse floor" sub="One rack per site · filled slots show relative on-hand volume · click a rack to filter"
            action={hasPermission('locations.view') ? <LinkPill to="/locations">Locations <ArrowRight size={12} /></LinkPill> : undefined} />
          <div className="grid md:grid-cols-[1fr_210px] gap-0 border-t border-border">
            <div className="px-4 py-5 bg-gradient-to-b from-surface-raised to-surface-subtle/60 min-h-[260px] flex items-center">
              {!data ? <Skeleton className="h-60 w-full" /> : data.warehouses.length === 0 ? (
                <div className="w-full"><EmptyState message="No warehouses configured yet." /></div>
              ) : (
                <div className="w-full">
                  <WarehouseFloor3D sites={data.warehouses} selectedId={warehouseId} onSelect={setWarehouseId} stagingUnits={c?.staging_units ?? 0} />
                </div>
              )}
            </div>
            <div className="border-t md:border-t-0 md:border-l border-border p-4 flex md:flex-col items-center md:items-stretch gap-4 bg-surface">
              {c ? (
                <>
                  <div className="flex flex-col items-center">
                    <OccupancyCube pct={binPct} size={110} />
                    <p className="font-display text-2xl font-bold text-ink tabular-nums mt-1">{binPct}%</p>
                    <p className="text-[11px] text-ink-muted">bin occupancy · {fmtNum(c.occupied_bins)}/{fmtNum(c.total_bins)}</p>
                  </div>
                  <div className="flex-1 grid grid-cols-1 gap-2 w-full">
                    <div className="rounded-xl bg-mint-soft border border-mint/20 px-3 py-2 shadow-[0_2px_0_rgb(21_128_61/.15)]">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-mint flex items-center gap-1"><ArrowDownToLine size={12} /> Received today</p>
                      <p className="font-display text-lg font-bold text-ink tabular-nums">{fmtNum(c.today_received)}</p>
                    </div>
                    <div className="rounded-xl bg-steel-soft border border-steel/20 px-3 py-2 shadow-[0_2px_0_rgb(45_91_136/.15)]">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-steel flex items-center gap-1"><ArrowUpFromLine size={12} /> Shipped today</p>
                      <p className="font-display text-lg font-bold text-ink tabular-nums">{fmtNum(c.today_shipped)}</p>
                    </div>
                    {c.staging_units > 0 && (
                      <Link to="/putaway" className="rounded-xl bg-amber-soft border border-amber/25 px-3 py-2 hover:-translate-y-0.5 transition shadow-[0_2px_0_rgb(180_83_9/.15)]">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-amber flex items-center gap-1"><PackageCheck size={12} /> In staging</p>
                        <p className="font-display text-lg font-bold text-ink tabular-nums">{fmtNum(c.staging_units)} <span className="text-[11px] font-sans font-medium text-ink-muted">units to put away</span></p>
                      </Link>
                    )}
                  </div>
                </>
              ) : <Skeleton className="h-60 w-full" />}
            </div>
          </div>
        </Card>
        <AiInsights warehouseId={warehouseId} />
      </div>

      {/* Throughput + pipeline */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="xl:col-span-2">
          <SectionTitle color="mint" icon={<Activity size={15} />} title="Warehouse throughput" sub="Units received vs. shipped per day" />
          <div className="px-5 pb-5">{data ? <ThroughputChart data={data.throughput} /> : <Skeleton className="h-60" />}</div>
        </Card>
        <Card>
          <SectionTitle color="steel" icon={<Truck size={15} />} title="Fulfilment pipeline" sub="Sales orders by stage · click to act" action={<LinkPill to="/sales">Orders <ArrowRight size={12} /></LinkPill>} />
          <div className="px-5 pb-5">
            {data ? <PipelineBars data={data.pipeline} onSelect={(s) => navigate(
              s === 'confirmed' || s === 'picking' ? '/picking' : s === 'picked' ? '/packing' : s === 'packed' ? '/shipping' : '/sales',
            )} /> : <Skeleton className="h-48" />}
          </div>
        </Card>
      </div>

      {/* Replenishment / activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 min-[1760px]:grid-cols-4 gap-4">
        <Card>
          <SectionTitle color="amber" icon={<AlertTriangle size={15} />} title="Replenishment needed" action={<LinkPill to="/purchasing">Create PO</LinkPill>} />
          {!data ? <div className="px-5 pb-5"><Skeleton className="h-48" /></div> : data.low_stock_items.length === 0 ? (
            <EmptyState message="All SKUs are above their reorder level." icon={<CheckCircle2 size={26} />} />
          ) : (
            <div className="px-3 pb-3 space-y-1.5">
              {data.low_stock_items.map((p) => {
                const pct = p.reorder_level > 0 ? Math.max(0, Math.min(100, (p.available / p.reorder_level) * 100)) : 0
                const out = p.available <= 0
                return (
                  <div key={`${p.id}-${p.warehouse}`} className="px-2.5 py-2 rounded-xl hover:bg-surface-subtle transition">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-ink truncate">{p.name}</p>
                        <p className="text-[11px] text-ink-muted font-mono">{p.sku}{p.warehouse ? ` · ${p.warehouse}` : ''}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`font-display text-sm font-bold tabular-nums ${out ? 'text-red' : 'text-amber'}`}>{fmtNum(p.available)}</p>
                        <p className="text-[10px] text-ink-muted">reorder at {fmtNum(p.reorder_level)}</p>
                      </div>
                    </div>
                    <div className="h-2 mt-1.5 rounded-full well overflow-hidden">
                      <div className={`h-full rounded-full ${out ? 'bg-red' : 'bg-gradient-to-r from-amber-light to-[#D97706]'}`} style={{ width: `${Math.max(pct, out ? 100 : 4)}%`, opacity: out ? 0.35 : 1 }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>

        <Card>
          <SectionTitle color="brand" icon={<ClipboardList size={15} />} title="Live stock movements" action={<LinkPill to="/inventory">Stock</LinkPill>} />
          {!data ? <div className="px-5 pb-5"><Skeleton className="h-48" /></div> : data.recent_movements.length === 0 ? (
            <EmptyState message="No movements yet." />
          ) : (
            <ul className="px-3 pb-3 space-y-1">
              {data.recent_movements.map((m) => {
                const meta = MOVE_LABEL[m.movement_type] ?? { label: m.movement_type, tone: 'text-ink-muted bg-surface-subtle', sign: '' }
                return (
                  <li key={m.id} className="px-2.5 py-2 rounded-xl flex items-center gap-3 hover:bg-surface-subtle transition">
                    <span className={`text-[9.5px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md ${meta.tone}`}>{meta.label}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] text-ink truncate"><span className="font-mono text-xs text-ink-muted">{m.product?.sku}</span> {m.product?.name}</p>
                      <p className="text-[11px] text-ink-subtle">{m.warehouse?.code}{m.bin ? ` / ${m.bin.code}` : ' / staging'} · {new Date(m.created_at).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                    <span className="font-display text-sm font-bold text-ink tabular-nums">{meta.sign}{fmtNum(m.quantity)}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>

        {[
          { title: 'Recent sales orders', icon: <Truck size={15} />, color: 'steel' as const, to: '/sales', rows: data?.recent_sales_orders, party: (o: Order) => o.customer?.name },
          { title: 'Recent purchase orders', icon: <ShoppingCart size={15} />, color: 'mint' as const, to: '/purchasing', rows: data?.recent_purchase_orders, party: (o: Order) => o.supplier?.name },
        ].map((block) => (
          <Card key={block.title}>
            <SectionTitle color={block.color} icon={block.icon} title={block.title} action={<LinkPill to={block.to}>View all <ArrowRight size={12} /></LinkPill>} />
            {!block.rows ? <div className="px-5 pb-5"><Skeleton className="h-48" /></div> : block.rows.length === 0 ? (
              <EmptyState message="Nothing yet." />
            ) : (
              <div className="px-3 pb-3 space-y-1">
                {block.rows.map((o) => (
                  <div key={o.id} className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl hover:bg-surface-subtle transition">
                    <div className="min-w-0">
                      <p className="font-mono text-xs font-bold text-ink">{o.number}</p>
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
        <Card className="relative overflow-hidden p-4 pl-6 flex items-center gap-3">
          <span className="absolute left-0 inset-y-0 w-1.5 bg-red" />
          <CubeChip color="red" size={32}><Lock size={15} /></CubeChip>
          <p className="text-sm text-ink flex-1"><b>{fmtNum(c.damaged)}</b> damaged units are quarantined. Inspect and write off or return them to the supplier.</p>
          <Link to="/inventory" className="text-xs font-bold text-red hover:underline">Review</Link>
        </Card>
      )}
    </div>
  )
}
