import { useEffect, useState } from 'react'
import { get } from '../services/apiClient'
import { Card, StatCard, Badge, PageHeader, EmptyState, ErrorBanner, StatCardSkeleton, AlertCard } from '../components/ui'
import {
  Package,
  Boxes,
  Lock,
  AlertTriangle,
  ShoppingCart,
  Truck,
  ArrowLeftRight,
  TrendingUp,
  ArrowRight,
} from 'lucide-react'
import { Link } from 'react-router-dom'

interface RecentSO {
  id: number
  number: string
  status: string
  customer?: { name: string }
}

interface RecentPO {
  id: number
  number: string
  status: string
  supplier?: { name: string }
}

interface DashboardData {
  counts: {
    products: number
    on_hand: number
    reserved: number
    damaged: number
    pending_sales_orders: number
    pending_purchase_orders: number
    pending_transfers: number
    low_stock_products: number
  }
  recent_sales_orders: RecentSO[]
  recent_purchase_orders: RecentPO[]
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    setError(null)
    get<DashboardData>('/dashboard')
      .then(setData)
      .catch((e: unknown) => setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to load dashboard'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Operations Overview" subtitle="Live view of inventory, inbound and outbound workload." />
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)}
        </div>
      </div>
    )
  }

  if (error) return <ErrorBanner message={error} onRetry={load} />
  if (!data) return <EmptyState message="No dashboard data available." />

  const c = data.counts

  const alerts: { severity: 'warning' | 'danger' | 'info'; title: string; count: number; description: string; actionLabel: string; to: string }[] = []
  if (c.low_stock_products > 0) {
    alerts.push({
      severity: 'warning',
      title: 'Low-stock products',
      count: c.low_stock_products,
      description: 'Products at or below their reorder point need attention.',
      actionLabel: 'Review products',
      to: '/products',
    })
  }
  if (c.damaged > 0) {
    alerts.push({
      severity: 'danger',
      title: 'Damaged units',
      count: c.damaged,
      description: 'Damaged stock detected in inventory. Investigate and adjust.',
      actionLabel: 'View inventory',
      to: '/inventory',
    })
  }
  if (c.pending_purchase_orders > 0) {
    alerts.push({
      severity: 'info',
      title: 'Open purchase orders',
      count: c.pending_purchase_orders,
      description: 'Purchase orders awaiting receipt or processing.',
      actionLabel: 'View purchase orders',
      to: '/purchasing',
    })
  }
  if (c.pending_transfers > 0) {
    alerts.push({
      severity: 'info',
      title: 'Transfers in progress',
      count: c.pending_transfers,
      description: 'Stock transfers are in transit between warehouses.',
      actionLabel: 'View transfers',
      to: '/transfers',
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Operations Overview"
        subtitle="Live view of inventory, inbound and outbound workload."
      />

      {/* Primary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Total Products" value={c.products} color="blue" icon={<Package size={20} />} />
        <StatCard label="On-Hand Units" value={Number(c.on_hand).toLocaleString()} color="mint" icon={<Boxes size={20} />} />
        <StatCard label="Reserved Units" value={Number(c.reserved).toLocaleString()} color="amber" icon={<Lock size={20} />} />
        <StatCard label="Low-Stock Products" value={c.low_stock_products} color="red" icon={<AlertTriangle size={20} />} />
      </div>

      {/* Operational alerts */}
      {alerts.length > 0 && (
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-ink-muted mb-3">Alerts</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {alerts.map((a, i) => (
              <AlertCard
                key={i}
                severity={a.severity}
                title={a.title}
                count={a.count}
                description={a.description}
                actionLabel={a.actionLabel}
                to={a.to}
              />
            ))}
          </div>
        </div>
      )}

      {/* Workload KPIs */}
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-ink-muted mb-3">Workload</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard label="Open Purchase Orders" value={c.pending_purchase_orders} color="blue" icon={<ShoppingCart size={20} />} />
          <StatCard label="Pending Sales Orders" value={c.pending_sales_orders} color="amber" icon={<Truck size={20} />} />
          <StatCard label="Transfers In Progress" value={c.pending_transfers} color="violet" icon={<ArrowLeftRight size={20} />} />
          <StatCard label="Damaged Units" value={Number(c.damaged).toLocaleString()} color="slate" icon={<AlertTriangle size={20} />} />
        </div>
      </div>

      {/* Recent activity */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card>
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 className="font-semibold text-ink flex items-center gap-2 text-sm">
              <span className="w-7 h-7 rounded-lg bg-blue-soft text-blue flex items-center justify-center">
                <Truck size={15} />
              </span>
              Recent Sales Orders
            </h2>
            <Link to="/sales" className="text-xs font-semibold text-blue hover:text-blue-hover inline-flex items-center gap-1 transition">
              View all <ArrowRight size={13} />
            </Link>
          </div>
          {data.recent_sales_orders?.length > 0 ? (
            <div className="divide-y divide-border">
              {data.recent_sales_orders.map((so) => (
                <div key={so.id} className="flex items-center justify-between px-5 py-3 hover:bg-surface-subtle/60 transition">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-mono text-xs font-semibold text-ink bg-surface-subtle px-2 py-1 rounded-md">{so.number}</span>
                    <span className="text-sm text-ink-muted truncate">{so.customer?.name || '—'}</span>
                  </div>
                  <Badge status={so.status} />
                </div>
              ))}
            </div>
          ) : (
            <EmptyState message="No recent sales orders." icon={<Truck size={28} />} />
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 className="font-semibold text-ink flex items-center gap-2 text-sm">
              <span className="w-7 h-7 rounded-lg bg-amber-soft text-amber flex items-center justify-center">
                <ShoppingCart size={15} />
              </span>
              Recent Purchase Orders
            </h2>
            <Link to="/purchasing" className="text-xs font-semibold text-blue hover:text-blue-hover inline-flex items-center gap-1 transition">
              View all <ArrowRight size={13} />
            </Link>
          </div>
          {data.recent_purchase_orders?.length > 0 ? (
            <div className="divide-y divide-border">
              {data.recent_purchase_orders.map((po) => (
                <div key={po.id} className="flex items-center justify-between px-5 py-3 hover:bg-surface-subtle/60 transition">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-mono text-xs font-semibold text-ink bg-surface-subtle px-2 py-1 rounded-md">{po.number}</span>
                    <span className="text-sm text-ink-muted truncate">{po.supplier?.name || '—'}</span>
                  </div>
                  <Badge status={po.status} />
                </div>
              ))}
            </div>
          ) : (
            <EmptyState message="No recent purchase orders." icon={<ShoppingCart size={28} />} />
          )}
        </Card>
      </div>

      {/* Quick actions */}
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-ink-muted mb-3">Quick Actions</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { to: '/receiving', label: 'Receive Goods', desc: 'Create goods receipts', icon: <Package size={18} />, cls: 'text-blue bg-blue-soft' },
            { to: '/sales', label: 'Sales Orders', desc: 'Confirm and fulfill', icon: <TrendingUp size={18} />, cls: 'text-mint bg-mint-soft' },
            { to: '/transfers', label: 'New Transfer', desc: 'Move stock between warehouses', icon: <ArrowLeftRight size={18} />, cls: 'text-violet bg-violet/10' },
            { to: '/inventory', label: 'Stock Overview', desc: 'Check balances and availability', icon: <Boxes size={18} />, cls: 'text-amber bg-amber-soft' },
          ].map((a) => (
            <Link
              key={a.to}
              to={a.to}
              className="group bg-surface border border-border rounded-xl shadow-panel p-4 hover:shadow-popover hover:border-blue/40 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue"
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${a.cls}`}>{a.icon}</div>
              <p className="text-sm font-semibold text-ink group-hover:text-blue transition">{a.label}</p>
              <p className="text-xs text-ink-muted mt-0.5">{a.desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}