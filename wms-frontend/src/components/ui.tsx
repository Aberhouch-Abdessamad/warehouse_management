import { useCallback, useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import {
  CheckCircle2, Clock, Check, Activity, XCircle, AlertTriangle, Circle, Layers, X, Search, Info,
  ShoppingCart, ArrowDownToLine, PackageCheck, Users2, Boxes, Package, ArrowLeftRight, ClipboardList,
  RotateCcw, Container, PackageOpen, Truck, HeartHandshake, Warehouse, MapPin, BarChart3, Users,
  ScrollText, Settings, Sparkles, LayoutDashboard,
} from 'lucide-react'

/* ══════════════════════════════════════════════════════════════
 * Banknbox WMS — Light Industrial 3D UI kit
 * Panels are white "slabs" with a visible bottom edge, buttons are
 * pressable keys, KPI tiles tilt toward the pointer.
 * ════════════════════════════════════════════════════════════ */

/* ──────────────────────────────────────────────────────────────
 * useTilt — pointer-driven 3D tilt (sets --rx/--ry/--mx/--my)
 * ──────────────────────────────────────────────────────────── */
export function useTilt<T extends HTMLElement>(max = 7) {
  const ref = useRef<T>(null)
  const onMouseMove = useCallback((e: React.MouseEvent<T>) => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width
    const py = (e.clientY - r.top) / r.height
    el.style.setProperty('--ry', `${(px - 0.5) * max * 2}deg`)
    el.style.setProperty('--rx', `${(0.5 - py) * max * 2}deg`)
    el.style.setProperty('--mx', `${px * 100}%`)
    el.style.setProperty('--my', `${py * 100}%`)
  }, [max])
  const onMouseLeave = useCallback(() => {
    const el = ref.current
    if (!el) return
    el.style.setProperty('--rx', '0deg')
    el.style.setProperty('--ry', '0deg')
  }, [])
  return { ref, onMouseMove, onMouseLeave }
}

export function Tilt({ children, className = '', max = 7, style }: { children: ReactNode; className?: string; max?: number; style?: CSSProperties }) {
  const t = useTilt<HTMLDivElement>(max)
  return (
    <div ref={t.ref} onMouseMove={t.onMouseMove} onMouseLeave={t.onMouseLeave} className={`tilt-3d ${className}`} style={style}>
      {children}
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────
 * IsoCube — small isometric 3D crate (SVG), used as decoration
 * ──────────────────────────────────────────────────────────── */
export function IsoCube({ size = 40, top = '#5EC9BE', left = '#0F766E', right = '#0A5A54', className = '' }: {
  size?: number; top?: string; left?: string; right?: string; className?: string
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className={className} aria-hidden>
      <path d="M20 4 L36 12 L20 20 L4 12 Z" fill={top} />
      <path d="M4 12 L20 20 L20 37 L4 29 Z" fill={left} />
      <path d="M36 12 L20 20 L20 37 L36 29 Z" fill={right} />
      <path d="M12 8 L28 16 L28 22" stroke="rgba(255,255,255,.45)" strokeWidth="1.6" fill="none" />
    </svg>
  )
}

/* ──────────────────────────────────────────────────────────────
 * Card — 3D slab container
 * ──────────────────────────────────────────────────────────── */
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`bg-surface border border-border rounded-2xl shadow-panel ${className}`}>
      {children}
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────
 * StatCard — tilting KPI tile with an extruded icon block
 * ──────────────────────────────────────────────────────────── */
type StatColor = 'blue' | 'brand' | 'steel' | 'mint' | 'amber' | 'red' | 'slate' | 'violet'

export const CHIP: Record<StatColor, { bg: string; edge: string; glow: string; bar: string }> = {
  brand:  { bg: 'linear-gradient(145deg,#14A396,#0F766E)', edge: '#0A4F4A', glow: 'rgb(15 118 110 / .5)',  bar: 'bg-brand' },
  blue:   { bg: 'linear-gradient(145deg,#5B8BBA,#2D5B88)', edge: '#1C3A58', glow: 'rgb(45 91 136 / .5)',  bar: 'bg-steel' },
  steel:  { bg: 'linear-gradient(145deg,#5B8BBA,#2D5B88)', edge: '#1C3A58', glow: 'rgb(45 91 136 / .5)',  bar: 'bg-steel' },
  mint:   { bg: 'linear-gradient(145deg,#22A55A,#15803D)', edge: '#0F5F2D', glow: 'rgb(21 128 61 / .5)', bar: 'bg-mint' },
  amber:  { bg: 'linear-gradient(145deg,#FBBF24,#D97706)', edge: '#92400E', glow: 'rgb(217 119 6 / .5)',  bar: 'bg-amber-light' },
  red:    { bg: 'linear-gradient(145deg,#EF5350,#DC2626)', edge: '#991B1B', glow: 'rgb(220 38 38 / .5)',  bar: 'bg-red' },
  violet: { bg: 'linear-gradient(145deg,#8E7CF0,#6A55CF)', edge: '#4B39A8', glow: 'rgb(106 85 207 / .5)', bar: 'bg-violet' },
  slate:  { bg: 'linear-gradient(145deg,#3E5A6B,#2A4555)', edge: '#0E1C25', glow: 'rgb(29 35 44 / .45)',  bar: 'bg-ink-muted' },
}

export function CubeChip({ color = 'brand', children, size = 40 }: { color?: StatColor; children: ReactNode; size?: number }) {
  const c = CHIP[color]
  return (
    <span
      className="cube-chip shrink-0"
      style={{ width: size, height: size, background: c.bg, ['--chip-edge' as string]: c.edge, ['--chip-glow' as string]: c.glow } as CSSProperties}
    >
      {children}
    </span>
  )
}

export function StatCard({
  label,
  value,
  color = 'brand',
  icon,
  trend,
}: {
  label: string
  value: ReactNode
  color?: StatColor
  icon?: ReactNode
  trend?: { value: string; up: boolean }
}) {
  return (
    <Tilt className="bg-surface border border-border rounded-2xl shadow-panel hover:shadow-lift p-5 relative overflow-hidden">
      <div className="flex items-start justify-between">
        <div className="flex-1 pop-z-sm">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-muted">{label}</p>
          <p className="font-display text-[1.85rem] font-bold text-ink mt-2 leading-tight tabular-nums">{value}</p>
          {trend && (
            <p className={`text-xs font-semibold mt-2 inline-flex items-center gap-1 ${trend.up ? 'text-mint' : 'text-red'}`}>
              <Activity size={12} strokeWidth={2.5} />
              {trend.value}
            </p>
          )}
        </div>
        {icon && <div className="pop-z"><CubeChip color={color}>{icon}</CubeChip></div>}
      </div>
      <div className={`absolute bottom-0 left-0 right-0 h-1 ${CHIP[color].bar}`} />
    </Tilt>
  )
}

/* ──────────────────────────────────────────────────────────────
 * Badge — status pill with icon + color (never color-only)
 * ──────────────────────────────────────────────────────────── */
export function Badge({ status, children }: { status: string; children?: ReactNode }) {
  const steel = 'bg-steel-soft text-steel border-steel/25'
  const amber = 'bg-amber-soft text-amber border-amber/30'
  const mint = 'bg-mint-soft text-mint border-mint/30'
  const violet = 'bg-violet-soft text-violet border-violet/25'
  const red = 'bg-red-soft text-red border-red/30'
  const grey = 'bg-surface-subtle text-ink-muted border-border'
  const map: Record<string, { cls: string; Icon: typeof Clock }> = {
    draft:               { cls: grey,   Icon: Circle },
    pending:             { cls: amber,  Icon: Clock },
    submitted:           { cls: steel,  Icon: Clock },
    requested:           { cls: steel,  Icon: Clock },
    approved:            { cls: steel,  Icon: Check },
    confirmed:           { cls: steel,  Icon: Check },
    allocated:           { cls: steel,  Icon: Layers },
    ordered:             { cls: steel,  Icon: Check },
    partially_received:  { cls: amber,  Icon: Clock },
    received:            { cls: mint,   Icon: CheckCircle2 },
    completed:           { cls: mint,   Icon: CheckCircle2 },
    shipped:             { cls: mint,   Icon: CheckCircle2 },
    delivered:           { cls: mint,   Icon: CheckCircle2 },
    active:              { cls: mint,   Icon: CheckCircle2 },
    picking:             { cls: 'bg-brand-soft text-brand border-brand/30', Icon: Activity },
    in_progress:         { cls: 'bg-brand-soft text-brand border-brand/30', Icon: Activity },
    in_transit:          { cls: violet, Icon: Activity },
    packed:              { cls: violet, Icon: Activity },
    picked:              { cls: violet, Icon: Activity },
    cancelled:           { cls: grey,   Icon: XCircle },
    inactive:            { cls: grey,   Icon: XCircle },
    damaged:             { cls: red,    Icon: AlertTriangle },
    blocked:             { cls: red,    Icon: AlertTriangle },
    open:                { cls: amber,  Icon: Clock },
    assigned:            { cls: steel,  Icon: Check },
    exception:           { cls: red,    Icon: AlertTriangle },
  }
  const { cls, Icon } = map[status] || map.draft
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[11px] font-bold shadow-[inset_0_1px_0_rgb(255_255_255/.7),0_1px_0_rgb(29_35_44/.06)] ${cls}`}>
      <Icon size={12} strokeWidth={2.5} />
      {children || startCase(status)}
    </span>
  )
}

function startCase(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

/* ──────────────────────────────────────────────────────────────
 * Button — 3D pressable keys
 * ──────────────────────────────────────────────────────────── */
export function Button({
  children,
  variant = 'primary',
  size = 'md',
  onClick,
  disabled,
  type = 'button',
  className = '',
}: {
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  onClick?: () => void
  disabled?: boolean
  type?: 'button' | 'submit'
  className?: string
}) {
  const variants: Record<string, string> = {
    primary:   'bg-gradient-to-b from-brand-light to-brand text-white shadow-key hover:brightness-105 active:translate-y-[3px] active:shadow-none',
    secondary: 'bg-gradient-to-b from-white to-surface-raised text-ink border border-border shadow-key-neutral hover:border-ink-subtle/60 active:translate-y-[2px] active:shadow-none',
    danger:    'bg-gradient-to-b from-[#EF4444] to-red text-white shadow-key-red hover:brightness-105 active:translate-y-[3px] active:shadow-none',
    ghost:     'hover:bg-surface-subtle text-ink-muted hover:text-ink',
  }
  const sizes: Record<string, string> = {
    sm: 'px-3 py-1.5 text-xs rounded-lg',
    md: 'px-4 py-2 text-sm rounded-xl',
    lg: 'px-6 py-3 text-base rounded-xl',
  }
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-1.5 font-semibold transition-all duration-100 focus:outline-none focus-visible:ring-4 focus-visible:ring-brand/25 disabled:opacity-50 disabled:pointer-events-none ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </button>
  )
}

/* ──────────────────────────────────────────────────────────────
 * Input — labelled text field (recessed well)
 * ──────────────────────────────────────────────────────────── */
const fieldCls =
  'w-full border rounded-xl px-3.5 py-2.5 text-sm text-ink bg-surface-raised shadow-well focus:bg-surface focus:shadow-glow focus:border-brand outline-none transition placeholder:text-ink-subtle'

export function Input({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  required,
  error,
  helper,
}: {
  label?: string
  type?: string
  value: string | number
  onChange: (v: string) => void
  placeholder?: string
  required?: boolean
  error?: string
  helper?: string
}) {
  return (
    <label className="block">
      {label && (
        <span className="block text-xs font-bold text-ink-muted mb-1.5">
          {label}
          {required && <span className="text-brand ml-0.5">*</span>}
        </span>
      )}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        aria-invalid={!!error}
        className={`${fieldCls} ${error ? 'border-red' : 'border-border'}`}
      />
      {error && <p className="text-xs text-red mt-1">{error}</p>}
      {helper && !error && <p className="text-xs text-ink-subtle mt-1">{helper}</p>}
    </label>
  )
}

/* ──────────────────────────────────────────────────────────────
 * Select — labelled dropdown
 * ──────────────────────────────────────────────────────────── */
export function Select({
  label,
  value,
  onChange,
  options,
  required,
}: {
  label?: string
  value: string | number
  onChange: (v: string) => void
  options: { value: string | number; label: string }[]
  required?: boolean
}) {
  return (
    <label className="block">
      {label && (
        <span className="block text-xs font-bold text-ink-muted mb-1.5">
          {label}
          {required && <span className="text-brand ml-0.5">*</span>}
        </span>
      )}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className={`${fieldCls} border-border`}
      >
        <option value="">— Select —</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  )
}

/* ──────────────────────────────────────────────────────────────
 * Table — data table with raised header strip and lifting rows
 * ──────────────────────────────────────────────────────────── */
export function Table({ headers, children }: { headers: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm [&_tbody_tr]:transition-colors [&_tbody_tr:hover]:bg-brand-soft/40">
        <thead>
          <tr className="text-left text-ink-muted text-[11px] uppercase tracking-[0.1em] bg-gradient-to-b from-surface-raised to-surface-subtle border-b-2 border-edge">
            {headers.map((h, i) => (
              <th key={i} className="px-4 py-3 font-bold whitespace-nowrap first:pl-5 last:pr-5">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">{children}</tbody>
      </table>
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────
 * EmptyState — placeholder for no-data (with 3D crate stack)
 * ──────────────────────────────────────────────────────────── */
export function EmptyState({ message, icon, action }: { message: string; icon?: ReactNode; action?: ReactNode }) {
  return (
    <div className="text-center py-14">
      <div className="flex justify-center mb-3">
        {icon ? (
          <span className="w-14 h-14 rounded-2xl bg-surface-subtle shadow-well flex items-center justify-center text-ink-subtle">{icon}</span>
        ) : (
          <div className="relative w-16 h-14 opacity-80">
            <IsoCube size={34} top="#E6ECEF" left="#CCD6DC" right="#B7C3CA" className="absolute left-0 bottom-0" />
            <IsoCube size={34} top="#E6ECEF" left="#CCD6DC" right="#B7C3CA" className="absolute right-0 bottom-0" />
            <IsoCube size={34} top="#CDEEEA" left="#7FD1C8" right="#4FB3A9" className="absolute left-[15px] bottom-[17px]" />
          </div>
        )}
      </div>
      <p className="text-sm text-ink-muted">{message}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────
 * Spinner — rotating 3D crate
 * ──────────────────────────────────────────────────────────── */
export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="w-9 h-9 border-[3px] border-border border-t-brand border-r-brand rounded-full animate-spin" />
      {label && <p className="text-sm text-ink-muted mt-3">{label}</p>}
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────
 * ErrorBanner — inline error display with retry
 * ──────────────────────────────────────────────────────────── */
export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="relative overflow-hidden bg-red-soft border border-red/25 text-red pl-5 pr-4 py-3 rounded-xl text-sm mb-4 flex items-start gap-2 shadow-[0_3px_0_-1px_rgb(220_38_38/.25)]">
      <span className="absolute left-0 inset-y-0 w-1.5 bg-red" />
      <AlertTriangle size={16} className="mt-0.5 shrink-0" />
      <span className="flex-1">{message}</span>
      {onRetry && (
        <button onClick={onRetry} className="text-xs font-bold text-red hover:text-red/80 underline shrink-0">
          Retry
        </button>
      )}
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────
 * PageHeader — title with an extruded module icon
 * ──────────────────────────────────────────────────────────── */
const ROUTE_ICON: Record<string, { icon: ReactNode; color: StatColor; area: string }> = {
  '/dashboard': { icon: <LayoutDashboard size={20} />, color: 'brand', area: 'Overview' },
  '/assistant': { icon: <Sparkles size={20} />, color: 'violet', area: 'Overview' },
  '/purchasing': { icon: <ShoppingCart size={20} />, color: 'mint', area: 'Inbound' },
  '/receiving': { icon: <ArrowDownToLine size={20} />, color: 'mint', area: 'Inbound' },
  '/putaway': { icon: <PackageCheck size={20} />, color: 'mint', area: 'Inbound' },
  '/suppliers': { icon: <Users2 size={20} />, color: 'mint', area: 'Inbound' },
  '/inventory': { icon: <Boxes size={20} />, color: 'brand', area: 'Inventory' },
  '/products': { icon: <Package size={20} />, color: 'brand', area: 'Inventory' },
  '/transfers': { icon: <ArrowLeftRight size={20} />, color: 'brand', area: 'Inventory' },
  '/stock-counts': { icon: <ClipboardList size={20} />, color: 'brand', area: 'Inventory' },
  '/returns': { icon: <RotateCcw size={20} />, color: 'brand', area: 'Inventory' },
  '/sales': { icon: <Container size={20} />, color: 'steel', area: 'Outbound' },
  '/picking': { icon: <PackageOpen size={20} />, color: 'steel', area: 'Outbound' },
  '/packing': { icon: <Package size={20} />, color: 'steel', area: 'Outbound' },
  '/shipping': { icon: <Truck size={20} />, color: 'steel', area: 'Outbound' },
  '/customers': { icon: <HeartHandshake size={20} />, color: 'steel', area: 'Outbound' },
  '/warehouses': { icon: <Warehouse size={20} />, color: 'slate', area: 'Facility' },
  '/locations': { icon: <MapPin size={20} />, color: 'slate', area: 'Facility' },
  '/reports': { icon: <BarChart3 size={20} />, color: 'violet', area: 'Insights & Admin' },
  '/users': { icon: <Users size={20} />, color: 'slate', area: 'Insights & Admin' },
  '/audit-logs': { icon: <ScrollText size={20} />, color: 'slate', area: 'Insights & Admin' },
  '/settings': { icon: <Settings size={20} />, color: 'slate', area: 'Insights & Admin' },
}

export function PageHeader({
  title,
  subtitle,
  actions,
  breadcrumb,
  icon,
  color,
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
  breadcrumb?: { label: string; href?: string }[]
  icon?: ReactNode
  color?: StatColor
}) {
  const { pathname } = useLocation()
  const meta = ROUTE_ICON['/' + pathname.split('/')[1]]
  const ic = icon ?? meta?.icon
  const col = color ?? meta?.color ?? 'brand'
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 animate-slide-up">
      <div className="flex items-center gap-4 min-w-0">
        {ic && (
          <Tilt max={12} className="hidden sm:block">
            <CubeChip color={col} size={52}>{ic}</CubeChip>
          </Tilt>
        )}
        <div className="min-w-0">
          {breadcrumb && breadcrumb.length > 0 ? (
            <nav aria-label="Breadcrumb" className="mb-1">
              <ol className="flex items-center gap-1.5 text-xs text-ink-subtle">
                {breadcrumb.map((b, i) => (
                  <li key={i} className="flex items-center gap-1.5">
                    {i > 0 && <span className="text-ink-subtle/50">/</span>}
                    {b.href ? (
                      <a href={b.href} className="hover:text-ink-muted transition">{b.label}</a>
                    ) : (
                      <span className="text-ink-muted font-medium">{b.label}</span>
                    )}
                  </li>
                ))}
              </ol>
            </nav>
          ) : meta?.area ? (
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand mb-0.5">{meta.area}</p>
          ) : null}
          <h1 className="font-display text-2xl font-bold text-ink tracking-tight leading-tight">{title}</h1>
          {subtitle && <p className="text-sm text-ink-muted mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────
 * Pagination — prev/next with page indicator
 * ──────────────────────────────────────────────────────────── */
export function Pagination({
  currentPage,
  lastPage,
  onChange,
}: {
  currentPage: number
  lastPage: number
  onChange: (page: number) => void
}) {
  if (lastPage <= 1) return null
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-surface-raised rounded-b-2xl">
      <Button size="sm" variant="secondary" disabled={currentPage <= 1} onClick={() => onChange(currentPage - 1)}>
        Previous
      </Button>
      <span className="text-xs text-ink-muted font-semibold">
        Page <span className="inline-flex min-w-[28px] justify-center px-2 py-0.5 rounded-md bg-surface-subtle shadow-well text-ink tabular-nums">{currentPage}</span> of {lastPage}
      </span>
      <Button size="sm" variant="secondary" disabled={currentPage >= lastPage} onClick={() => onChange(currentPage + 1)}>
        Next
      </Button>
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────
 * Modal — centered dialog with backdrop, focus trap, Escape
 * ──────────────────────────────────────────────────────────── */
export function Modal({
  open,
  onClose,
  title,
  children,
  size = 'md',
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const previousFocus = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return
    previousFocus.current = document.activeElement as HTMLElement

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
        return
      }
      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
        if (focusable.length === 0) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    focusable?.[0]?.focus()

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      previousFocus.current?.focus()
    }
  }, [open, onClose])

  if (!open) return null

  const sizes: Record<string, string> = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-graphite/45 backdrop-blur-[3px] animate-fade-in"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`bg-surface rounded-2xl border border-border shadow-popover w-full ${sizes[size]} max-h-[90vh] overflow-y-auto animate-rise`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-surface/95 backdrop-blur z-10">
          <div className="flex items-center gap-2.5">
            <span className="w-1.5 h-6 rounded-full bg-gradient-to-b from-brand-light to-brand" />
            <h3 className="font-display text-lg font-bold text-ink">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="text-ink-muted hover:text-ink transition p-1.5 rounded-lg hover:bg-surface-subtle"
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────
 * ConfirmDialog — confirmation with specific action label
 * ──────────────────────────────────────────────────────────── */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'primary',
  loading = false,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'primary' | 'danger'
  loading?: boolean
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <div className="space-y-4">
        <div className={`flex items-start gap-3 ${variant === 'danger' ? 'bg-red-soft border border-red/30' : 'bg-steel-soft border border-steel/20'} rounded-xl p-4`}>
          {variant === 'danger' ? (
            <AlertTriangle size={20} className="text-red shrink-0 mt-0.5" />
          ) : (
            <Info size={20} className="text-steel shrink-0 mt-0.5" />
          )}
          <p className="text-sm text-ink leading-relaxed">{message}</p>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={variant === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} disabled={loading}>
            {loading ? 'Processing…' : confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

/* ──────────────────────────────────────────────────────────────
 * Skeleton — loading placeholder matching content layout
 * ──────────────────────────────────────────────────────────── */
export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-gradient-to-r from-surface-subtle via-[#E6ECEF] to-surface-subtle rounded-lg ${className}`} />
  )
}

export function TableSkeleton({ rows = 5, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="p-4 space-y-3">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton
              key={c}
              className={`h-5 ${c === 0 ? 'w-24' : c === cols - 1 ? 'w-20' : 'w-32'}`}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

export function StatCardSkeleton() {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-7 w-16" />
        </div>
        <Skeleton className="w-10 h-10 rounded-xl" />
      </div>
    </Card>
  )
}

/* ──────────────────────────────────────────────────────────────
 * Toast — temporary status message
 * ──────────────────────────────────────────────────────────── */
type ToastType = 'success' | 'error' | 'info' | 'warning'

export function Toast({
  message,
  type = 'info',
  onClose,
  duration = 4000,
}: {
  message: string
  type?: ToastType
  onClose?: () => void
  duration?: number
}) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose?.()
    }, duration)
    return () => clearTimeout(timer)
  }, [duration, onClose])

  const config: Record<ToastType, { chip: StatColor; Icon: typeof Info }> = {
    success: { chip: 'mint', Icon: CheckCircle2 },
    error:   { chip: 'red', Icon: AlertTriangle },
    info:    { chip: 'steel', Icon: Info },
    warning: { chip: 'amber', Icon: Clock },
  }
  const { chip, Icon } = config[type]

  return (
    <div
      className="fixed bottom-5 right-5 z-[60] flex items-center gap-3 bg-surface border border-border rounded-2xl shadow-popover pl-2.5 pr-4 py-2.5 text-sm font-semibold text-ink animate-rise"
      role="status"
      aria-live="polite"
    >
      <CubeChip color={chip} size={30}><Icon size={15} /></CubeChip>
      <span>{message}</span>
      {onClose && (
        <button onClick={onClose} className="ml-2 text-ink-subtle hover:text-ink transition" aria-label="Dismiss">
          <X size={14} />
        </button>
      )}
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────
 * SearchInput — search field with icon and accessible label
 * ──────────────────────────────────────────────────────────── */
export function SearchInput({
  placeholder,
  value,
  onChange,
  className = '',
}: {
  placeholder?: string
  value: string
  onChange: (v: string) => void
  className?: string
}) {
  return (
    <div className={`relative ${className}`}>
      <label className="sr-only">Search</label>
      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-border rounded-xl pl-9 pr-3 py-2 text-sm text-ink bg-surface-raised shadow-well focus:bg-surface focus:shadow-glow focus:border-brand outline-none transition placeholder:text-ink-subtle"
      />
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────
 * AlertCard — alert for low-stock, pending approvals, exceptions
 * ──────────────────────────────────────────────────────────── */
export function AlertCard({
  severity,
  title,
  count,
  description,
  actionLabel,
  onAction,
  to,
}: {
  severity: 'warning' | 'danger' | 'info'
  title: string
  count?: number
  description: string
  actionLabel?: string
  onAction?: () => void
  to?: string
}) {
  const styles: Record<string, { chip: StatColor; text: string; bg: string; Icon: typeof AlertTriangle }> = {
    warning: { chip: 'amber', text: 'text-amber', bg: 'bg-amber-soft', Icon: AlertTriangle },
    danger:  { chip: 'red', text: 'text-red', bg: 'bg-red-soft', Icon: AlertTriangle },
    info:    { chip: 'steel', text: 'text-steel', bg: 'bg-steel-soft', Icon: Info },
  }
  const { chip, text, bg, Icon } = styles[severity]

  return (
    <Card className="p-4 lift-3d">
      <div className="flex items-start gap-3">
        <CubeChip color={chip} size={36}><Icon size={17} /></CubeChip>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-ink">{title}</p>
            {count !== undefined && (
              <span className={`text-xs font-bold ${text} ${bg} px-2 py-0.5 rounded-md`}>{count}</span>
            )}
          </div>
          <p className="text-xs text-ink-muted mt-0.5 leading-relaxed">{description}</p>
          {actionLabel && (onAction || to) && (
            to ? (
              <a href={to} className={`text-xs font-bold ${text} hover:underline mt-2 inline-flex items-center gap-1`}>
                {actionLabel}
              </a>
            ) : (
              <button onClick={onAction} className={`text-xs font-bold ${text} hover:underline mt-2 inline-flex items-center gap-1`}>
                {actionLabel}
              </button>
            )
          )}
        </div>
      </div>
    </Card>
  )
}
