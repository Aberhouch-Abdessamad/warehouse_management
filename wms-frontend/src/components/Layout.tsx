import type { ReactNode } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  PackageCheck,
  Package,
  LayoutDashboard,
  Boxes,
  ShoppingCart,
  Truck,
  ArrowLeftRight,
  Settings as SettingsIcon,
  LogOut,
  Menu,
  X,
  Warehouse,
  Users2,
  HeartHandshake,
  Bell,
  ScanBarcode,
  RotateCcw,
  ClipboardList,
  BarChart3,
  MapPin,
  Users,
  ScrollText,
  PackageOpen,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { get } from '../services/apiClient'

interface NavItem {
  to: string
  label: string
  icon: ReactNode
  permission?: string
}

interface NavSection {
  label: string
  items: NavItem[]
}

export default function Layout({ children }: { children?: ReactNode }) {
  const { user, logout, hasPermission } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [notifCount, setNotifCount] = useState(0)

  useEffect(() => {
    get<{ count: number }>('/notifications/unread-count')
      .then((r) => setNotifCount(r.count))
      .catch(() => {})
  }, [])

  const sections: NavSection[] = [
    {
      label: 'Overview',
      items: [
        {
          to: '/dashboard',
          label: 'Dashboard',
          icon: <LayoutDashboard size={17} />,
          permission: 'dashboard.view',
        },
      ],
    },
    {
      label: 'Inventory',
      items: [
        {
          to: '/products',
          label: 'Products',
          icon: <Package size={17} />,
          permission: 'products.view',
        },
        {
          to: '/inventory',
          label: 'Stock Overview',
          icon: <Boxes size={17} />,
          permission: 'stock.view',
        },
        {
          to: '/transfers',
          label: 'Transfers',
          icon: <ArrowLeftRight size={17} />,
          permission: 'transfers.view',
        },
        {
          to: '/putaway',
          label: 'Putaway',
          icon: <PackageCheck size={17} />,
          permission: 'putaway.view',
        },
        {
          to: '/returns',
          label: 'Returns',
          icon: <RotateCcw size={17} />,
          permission: 'returns.view',
        },
        {
          to: '/stock-counts',
          label: 'Stock Counts',
          icon: <ClipboardList size={17} />,
          permission: 'stock-counts.view',
        },
      ],
    },
    {
      label: 'Warehouses',
      items: [
        {
          to: '/warehouses',
          label: 'Warehouses',
          icon: <Warehouse size={17} />,
          permission: 'warehouses.view',
        },
        {
          to: '/locations',
          label: 'Locations',
          icon: <MapPin size={17} />,
          permission: 'locations.view',
        },
      ],
    },
    {
      label: 'Purchasing',
      items: [
        {
          to: '/suppliers',
          label: 'Suppliers',
          icon: <Users2 size={17} />,
          permission: 'suppliers.view',
        },
        {
          to: '/purchasing',
          label: 'Purchase Orders',
          icon: <ShoppingCart size={17} />,
          permission: 'purchase-orders.view',
        },
        {
          to: '/receiving',
          label: 'Receiving',
          icon: <PackageCheck size={17} />,
          permission: 'receiving.view',
        },
      ],
    },
    {
      label: 'Sales & Fulfillment',
      items: [
        {
          to: '/customers',
          label: 'Customers',
          icon: <HeartHandshake size={17} />,
          permission: 'customers.view',
        },
        {
          to: '/sales',
          label: 'Sales Orders',
          icon: <Truck size={17} />,
          permission: 'sales-orders.view',
        },
        {
          to: '/picking',
          label: 'Picking',
          icon: <PackageOpen size={17} />,
          permission: 'picking.view',
        },
        {
          to: '/packing',
          label: 'Packing',
          icon: <Package size={17} />,
          permission: 'packing.view',
        },
        {
          to: '/shipping',
          label: 'Shipping',
          icon: <Truck size={17} />,
          permission: 'shipping.view',
        },
      ],
    },
    {
      label: 'Reports & Analytics',
      items: [
        {
          to: '/reports',
          label: 'Reports',
          icon: <BarChart3 size={17} />,
          permission: 'reports.view',
        },
      ],
    },
    {
      label: 'Administration',
      items: [
        {
          to: '/users',
          label: 'Users',
          icon: <Users size={17} />,
          permission: 'users.view',
        },
        {
          to: '/audit-logs',
          label: 'Audit Logs',
          icon: <ScrollText size={17} />,
          permission: 'audit-logs.view',
        },
        {
          to: '/settings',
          label: 'Settings',
          icon: <SettingsIcon size={17} />,
          permission: 'settings.view',
        },
      ],
    }
  ]

  const visibleSections = sections
    .map((s) => ({
      ...s,
      items: s.items.filter((i) => !i.permission || hasPermission(i.permission)),
    }))
    .filter((s) => s.items.length > 0)

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex h-screen bg-canvas">
      {/* ── Sidebar ─────────────────────────────────────────── */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-60 bg-navy text-white flex flex-col transition-transform duration-200 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex items-center justify-between px-5 h-14 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue to-violet flex items-center justify-center shadow-lg shadow-blue/30">
              <ScanBarcode size={16} />
            </div>
            <div>
              <span className="font-bold text-[15px] leading-tight tracking-tight">WMS</span>
              <p className="text-[10px] text-white/40 leading-tight font-medium tracking-wide">WAREHOUSE OS</p>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden ml-2 text-white/60 hover:text-white"
              aria-label="Close menu"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-5">
          {visibleSections.map((section) => (
            <div key={section.label}>
              <p className="px-2.5 pb-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-white/35">
                {section.label}
              </p>
              <div className="space-y-0.5">
                {section.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setSidebarOpen(false)}
                    className={({ isActive }) =>
                      `group flex items-center gap-3 px-2.5 py-[7px] rounded-lg text-[13px] font-medium transition-all ${
                        isActive
                          ? 'bg-blue text-white shadow-sm shadow-blue/40'
                          : 'text-white/65 hover:bg-white/[0.07] hover:text-white'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <span className={isActive ? 'text-white' : 'text-white/50 group-hover:text-white/90'}>{item.icon}</span>
                        {item.label}
                        {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-white/90" />}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-white/10 p-3 shrink-0">
          <div className="flex items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-white/[0.07] transition">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue to-violet flex items-center justify-center shadow-lg shadow-blue/30">
              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue to-violet flex items-center justify-center text-xs font-bold">
                {user?.name?.charAt(0).toUpperCase() ?? '?'}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold truncate">{user?.name}</p>
              <p className="text-[10px] text-white/40 truncate">{user?.roles?.join(', ')}</p>
            </div>
            <button
              onClick={handleLogout}
              className="text-white/40 hover:text-red transition"
              title="Logout"
              aria-label="Logout"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Mobile overlay ──────────────────────────────────── */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-ink/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── Main ────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-14 bg-surface border-b border-border flex items-center gap-3 px-4 lg:px-6 shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-ink-muted p-1.5 rounded-lg hover:bg-surface-subtle transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>

          <div className="flex items-center gap-2 flex-1 min-w-0">
            <ScanBarcode size={15} className="text-ink-subtle hidden sm:block shrink-0" />
            <span className="text-[13px] text-ink-muted truncate">
              Quick scan and search across the warehouse
            </span>
          </div>

          <div className="ml-auto flex items-center gap-1">
            <button
              className="relative p-2 rounded-lg hover:bg-surface-subtle text-ink-muted hover:text-ink transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue"
              aria-label="Notifications"
            >
              <Bell size={17} />
              {notifCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red text-white text-[10px] font-bold flex items-center justify-center">
                  {notifCount > 99 ? '99+' : notifCount}
                </span>
              )}
            </button>
            <div className="hidden lg:block w-px h-6 bg-border mx-1.5" />
            <div className="hidden lg:flex items-center gap-2 pr-1">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue to-violet text-white flex items-center justify-center text-[11px] font-bold">
                {user?.name?.charAt(0).toUpperCase() ?? '?'}
              </div>
              <span className="text-[13px] font-medium text-ink">{user?.name}</span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 bg-canvas">
          <Outlet />
        </main>
      </div>
    </div>
  )
}