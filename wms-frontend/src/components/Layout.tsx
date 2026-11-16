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
import { IsoCube } from './ui'

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
        className="w-full bg-surface-subtle shadow-well border border-transparent rounded-xl pl-9 pr-14 py-2.5 text-[13px] text-ink placeholder:text-ink-subtle focus:bg-surface focus:border-brand focus:shadow-glow outline-none transition"
      />
      <kbd className="hidden md:block absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-ink-muted border border-border rounded-md px-1.5 py-0.5 bg-surface shadow-[0_2px_0_#CDD6DC]">Ctrl K</kbd>
      {open && results.length > 0 && (
        <div className="absolute top-full mt-2 left-0 right-0 bg-surface border border-border rounded-2xl shadow-popover overflow-hidden z-50 animate-slide-up">
          {results.map((r) => (
            <button key={r.id} onMouseDown={() => go(r.sku)}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-brand-soft/60">
              <ScanBarcode size={14} className="text-ink-subtle" />
              <span className="font-mono text-xs text-brand font-semibold">{r.sku}</span>
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
    <div className="flex h-screen floor-bg">
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 ${collapsed ? 'lg:w-[72px]' : 'lg:w-64'} w-64 graphite-bg text-white flex flex-col transition-all duration-200 shadow-[6px_0_24px_-12px_rgba(0,0,0,.5)] ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex items-center gap-2.5 px-4 h-16 shrink-0">
          <div className="w-10 h-10 shrink-0 drop-shadow-[0_6px_8px_rgba(0,0,0,.35)]">
            <IsoCube size={40} />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="font-display font-bold text-[16px] leading-tight tracking-tight">Banknbox <span className="text-brand-light">WMS</span></p>
              <p className="text-[10px] text-white/45 leading-tight font-semibold tracking-[0.14em]">WAREHOUSE OS</p>
            </div>
          )}
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden ml-auto text-white/60 hover:text-white" aria-label="Close menu">
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-4">
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
                        isActive ? 'bg-brand text-white shadow-[inset_0_1px_0_rgba(255,255,255,.15),0_2px_0_#0A4F4A]' : 'text-white/60 hover:bg-white/[0.06] hover:text-white'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        
                        <span className={isActive ? 'text-white' : 'text-white/45 group-hover:text-white/90'}>{item.icon}</span>
                        <span className={collapsed ? 'lg:hidden' : ''}>{item.label}</span>
                        {item.to === '/assistant' && !collapsed && (
                          <span className="ml-auto text-[9px] font-bold tracking-wider bg-violet text-white px-1.5 py-0.5 rounded shadow-[0_2px_0_#4B39A8]">AI</span>
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
          <div className={`flex items-center gap-2.5 rounded-xl px-2 py-2 bg-white/[0.04] border border-white/[0.06] ${collapsed ? 'lg:justify-center' : ''}`}>
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-light to-brand flex items-center justify-center text-[11px] font-bold shrink-0 shadow-[inset_0_1px_0_rgba(255,255,255,.3),0_2px_0_#0A4F4A]">{initials}</div>
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

      {sidebarOpen && <div className="fixed inset-0 bg-graphite/60 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="relative z-20 h-16 bg-surface/85 backdrop-blur-md border-b border-border shadow-[0_3px_0_-1px_#CDD6DC,0_12px_24px_-18px_rgba(29,35,44,.35)] flex items-center gap-3 px-4 lg:px-6 shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-ink-muted p-1.5 rounded-lg hover:bg-surface-subtle" aria-label="Open menu">
            <Menu size={20} />
          </button>
          <GlobalSearch />
          <div className="ml-auto flex items-center gap-1.5">
            {hasPermission('dashboard.view') && (
              <button
                onClick={() => setCopilotOpen(!copilotOpen)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-semibold text-white bg-gradient-to-b from-[#8E7CF0] to-violet shadow-[inset_0_1px_0_rgba(255,255,255,.25),0_3px_0_#4B39A8,0_8px_16px_-8px_rgba(106,85,207,.6)] hover:brightness-105 active:translate-y-[3px] active:shadow-none transition-all duration-100"
              >
                <Sparkles size={15} /> <span className="hidden sm:inline">Ask Copilot</span>
              </button>
            )}
            <button className="relative p-2 rounded-xl bg-surface border border-border shadow-key-neutral text-ink-muted hover:text-ink active:translate-y-[2px] active:shadow-none transition-all duration-100" aria-label="Notifications">
              <Bell size={18} />
              {notifCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-brand text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white">
                  {notifCount > 99 ? '99+' : notifCount}
                </span>
              )}
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-7">
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
