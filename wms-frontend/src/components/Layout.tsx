import { useEffect, useRef, useState, type ReactNode } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  PackageCheck, Package, LayoutDashboard, Boxes, ShoppingCart, Truck, ArrowLeftRight,
  Settings as SettingsIcon, LogOut, Menu, X, Warehouse, Users2, HeartHandshake, Bell, ScanBarcode,
  RotateCcw, ClipboardList, BarChart3, MapPin, Users, ScrollText, PackageOpen, Search, Sparkles,
  ArrowDownToLine, Container, ChevronsLeft, ChevronsRight,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { get } from '../services/apiClient'
import { CopilotPanel, CopilotProvider, useCopilot } from './Copilot'

interface NavItem { to: string; label: string; icon: ReactNode; permission?: string | string[] }
interface NavSection { label: string; items: NavItem[] }

export const NAV_SECTIONS: NavSection[] = [
  { label: 'Overview', items: [
    { to: '/dashboard', label: 'Control Tower', icon: <LayoutDashboard size={17} />, permission: 'dashboard.view' },
    { to: '/assistant', label: 'AI Copilot', icon: <Sparkles size={17} />, permission: 'dashboard.view' },
  ] },
  { label: 'Inbound', items: [
    { to: '/purchasing', label: 'Purchase Orders', icon: <ShoppingCart size={17} />, permission: 'purchase-orders.view' },
    { to: '/receiving', label: 'Receiving', icon: <ArrowDownToLine size={17} />, permission: ['purchase-orders.receive', 'purchase-orders.view'] },
    { to: '/putaway', label: 'Putaway', icon: <PackageCheck size={17} />, permission: 'putaway.view' },
    { to: '/suppliers', label: 'Suppliers', icon: <Users2 size={17} />, permission: 'suppliers.view' },
  ] },
  { label: 'Inventory', items: [
    { to: '/inventory', label: 'Stock Overview', icon: <Boxes size={17} />, permission: 'stock.view' },
    { to: '/products', label: 'Products', icon: <Package size={17} />, permission: 'products.view' },
    { to: '/transfers', label: 'Transfers', icon: <ArrowLeftRight size={17} />, permission: 'transfers.view' },
    { to: '/stock-counts', label: 'Cycle Counts', icon: <ClipboardList size={17} />, permission: 'stock-counts.view' },
    { to: '/returns', label: 'Returns', icon: <RotateCcw size={17} />, permission: 'returns.view' },
  ] },
  { label: 'Outbound', items: [
    { to: '/sales', label: 'Sales Orders', icon: <Container size={17} />, permission: 'sales-orders.view' },
    { to: '/picking', label: 'Picking', icon: <PackageOpen size={17} />, permission: 'picking.view' },
    { to: '/packing', label: 'Packing', icon: <Package size={17} />, permission: 'packing.view' },
    { to: '/shipping', label: 'Shipping', icon: <Truck size={17} />, permission: 'shipping.view' },
    { to: '/customers', label: 'Customers', icon: <HeartHandshake size={17} />, permission: 'customers.view' },
  ] },
  { label: 'Facility', items: [
    { to: '/warehouses', label: 'Warehouses', icon: <Warehouse size={17} />, permission: 'warehouses.view' },
    { to: '/locations', label: 'Locations & Bins', icon: <MapPin size={17} />, permission: 'locations.view' },
  ] },
  { label: 'Insights & Admin', items: [
    { to: '/reports', label: 'Reports', icon: <BarChart3 size={17} />, permission: 'reports.view' },
    { to: '/users', label: 'Users & Roles', icon: <Users size={17} />, permission: 'users.view' },
    { to: '/audit-logs', label: 'Audit Trail', icon: <ScrollText size={17} />, permission: 'audit-logs.view' },
    { to: '/settings', label: 'Settings', icon: <SettingsIcon size={17} />, permission: 'settings.view' },
  ] },
]

interface LookupProduct { id: number; sku: string; name: string; selling_price: string }

function GlobalSearch() {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [results, setResults] = useState<LookupProduct[]>([])
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const { hasPermission } = useAuth()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); inputRef.current?.focus() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (q.trim().length < 2 || !hasPermission('products.view')) { setResults([]); return }
    const t = setTimeout(() => {
      get<LookupProduct[]>('/products/lookup', { q: q.trim() }).then((r) => setResults(r.slice(0, 8))).catch(() => setResults([]))
    }, 220)
    return () => clearTimeout(t)
  }, [q, hasPermission])

  const go = (sku: string) => {
    setOpen(false)
    setQ('')
    navigate(`/inventory?search=${encodeURIComponent(sku)}`)
  }

  return (
    <div className="relative flex-1 max-w-md">
      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle pointer-events-none" />
      <input
        ref={inputRef}
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && q.trim()) go(results[0]?.sku ?? q.trim())
          if (e.key === 'Escape') (e.target as HTMLInputElement).blur()
        }}
        placeholder="Scan barcode or search SKU / product…"
        aria-label="Search products"
        className="w-full bg-surface-subtle border border-transparent rounded-lg pl-9 pr-14 py-2 text-[13px] text-ink placeholder:text-ink-subtle focus:bg-surface focus:border-blue focus:ring-2 focus:ring-blue/20 outline-none transition"
      />
      <kbd className="hidden md:block absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-ink-subtle border border-border rounded px-1.5 py-0.5 bg-surface">Ctrl K</kbd>
      {open && results.length > 0 && (
        <div className="absolute top-full mt-1.5 left-0 right-0 bg-surface border border-border rounded-xl shadow-popover overflow-hidden z-50">
          {results.map((r) => (
            <button key={r.id} onMouseDown={() => go(r.sku)}
              className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-surface-subtle">
              <ScanBarcode size={14} className="text-ink-subtle" />
              <span className="font-mono text-xs text-blue font-semibold">{r.sku}</span>
              <span className="text-sm text-ink truncate">{r.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function Shell() {
  const { user, logout, hasPermission } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { setOpen: setCopilotOpen, open: copilotOpen } = useCopilot()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [notifCount, setNotifCount] = useState(0)

  useEffect(() => {
    get<{ count: number }>('/notifications/unread-count').then((r) => setNotifCount(r.count)).catch(() => {})
  }, [location.pathname])

  const can = (p?: string | string[]) => !p || (Array.isArray(p) ? p.some(hasPermission) : hasPermission(p))
  const visibleSections = NAV_SECTIONS
    .map((s) => ({ ...s, items: s.items.filter((i) => can(i.permission)) }))
    .filter((s) => s.items.length > 0)

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  const initials = (user?.name ?? '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()

  return (
    <div className="flex h-screen bg-canvas">
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 ${collapsed ? 'lg:w-[72px]' : 'lg:w-64'} w-64 bg-[#0B1B33] text-white flex flex-col transition-all duration-200 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex items-center gap-2.5 px-4 h-16 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue to-mint flex items-center justify-center shadow-lg shadow-blue/30 shrink-0">
            <Warehouse size={18} />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="font-bold text-[15px] leading-tight tracking-tight">Banknbox WMS</p>
              <p className="text-[10px] text-white/45 leading-tight font-semibold tracking-[0.14em]">WAREHOUSE OS</p>
            </div>
          )}
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden ml-auto text-white/60 hover:text-white" aria-label="Close menu">
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-2 px-3 space-y-4">
          {visibleSections.map((section) => (
            <div key={section.label}>
              {!collapsed && (
                <p className="px-2.5 pb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white/30">{section.label}</p>
              )}
              <div className="space-y-0.5">
                {section.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    title={collapsed ? item.label : undefined}
                    onClick={() => setSidebarOpen(false)}
                    className={({ isActive }) =>
                      `group relative flex items-center gap-3 ${collapsed ? 'lg:justify-center' : ''} px-2.5 py-2 rounded-lg text-[13px] font-medium transition-all ${
                        isActive ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/[0.06] hover:text-white'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-gradient-to-b from-blue to-mint" />}
                        <span className={isActive ? 'text-mint' : 'text-white/45 group-hover:text-white/90'}>{item.icon}</span>
                        <span className={collapsed ? 'lg:hidden' : ''}>{item.label}</span>
                        {item.to === '/assistant' && !collapsed && (
                          <span className="ml-auto text-[9px] font-bold tracking-wider bg-violet/80 text-white px-1.5 py-0.5 rounded">AI</span>
                        )}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-white/10 p-3 shrink-0 space-y-1">
          <button onClick={() => setCollapsed((c) => !c)} className="hidden lg:flex w-full items-center gap-2 px-2.5 py-1.5 rounded-lg text-[12px] text-white/45 hover:text-white hover:bg-white/[0.06]">
            {collapsed ? <ChevronsRight size={15} /> : <><ChevronsLeft size={15} /> Collapse</>}
          </button>
          <div className={`flex items-center gap-2.5 rounded-lg px-2 py-2 ${collapsed ? 'lg:justify-center' : ''}`}>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue to-violet flex items-center justify-center text-[11px] font-bold shrink-0">{initials}</div>
            <div className={`flex-1 min-w-0 ${collapsed ? 'lg:hidden' : ''}`}>
              <p className="text-[13px] font-semibold truncate">{user?.name}</p>
              <p className="text-[10px] text-white/45 truncate capitalize">{user?.roles?.map((r) => r.replace(/_/g, ' ')).join(', ')}</p>
            </div>
            <button onClick={handleLogout} className={`text-white/45 hover:text-red transition ${collapsed ? 'lg:hidden' : ''}`} title="Sign out" aria-label="Sign out">
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      {sidebarOpen && <div className="fixed inset-0 bg-ink/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="h-16 bg-surface/90 backdrop-blur border-b border-border flex items-center gap-3 px-4 lg:px-6 shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-ink-muted p-1.5 rounded-lg hover:bg-surface-subtle" aria-label="Open menu">
            <Menu size={20} />
          </button>
          <GlobalSearch />
          <div className="ml-auto flex items-center gap-1.5">
            {hasPermission('dashboard.view') && (
              <button
                onClick={() => setCopilotOpen(!copilotOpen)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-semibold text-white bg-gradient-to-r from-violet to-blue shadow-sm shadow-violet/30 hover:opacity-95 transition"
              >
                <Sparkles size={15} /> <span className="hidden sm:inline">Ask Copilot</span>
              </button>
            )}
            <button className="relative p-2 rounded-lg hover:bg-surface-subtle text-ink-muted hover:text-ink transition" aria-label="Notifications">
              <Bell size={18} />
              {notifCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red text-white text-[10px] font-bold flex items-center justify-center">
                  {notifCount > 99 ? '99+' : notifCount}
                </span>
              )}
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6 bg-canvas">
          <div className="max-w-[1600px] mx-auto">
            <Outlet />
          </div>
        </main>
      </div>

      <CopilotPanel onExpand={() => navigate('/assistant')} />
    </div>
  )
}

export default function Layout() {
  return (
    <CopilotProvider>
      <Shell />
    </CopilotProvider>
  )
}
