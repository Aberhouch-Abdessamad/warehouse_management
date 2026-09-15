import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  CheckCircle2,
  Clock,
  Check,
  Activity,
  XCircle,
  AlertTriangle,
  Circle,
  Layers,
  X,
  Search,
  Info,
} from 'lucide-react'

/* ──────────────────────────────────────────────────────────────
 * Card — surface container with subtle elevation
 * ──────────────────────────────────────────────────────────── */
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`bg-surface border border-border rounded-xl shadow-panel ${className}`}>
      {children}
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────
 * StatCard — KPI tile with accent bar and icon support
 * ──────────────────────────────────────────────────────────── */
type StatColor = 'blue' | 'mint' | 'amber' | 'red' | 'slate' | 'violet'

export function StatCard({
  label,
  value,
  color = 'blue',
  icon,
  trend,
}: {
  label: string
  value: ReactNode
  color?: StatColor
  icon?: ReactNode
  trend?: { value: string; up: boolean }
}) {
  const accent: Record<StatColor, string> = {
    blue: 'bg-blue',
    mint: 'bg-mint',
    amber: 'bg-amber',
    red: 'bg-red',
    slate: 'bg-ink-muted',
    violet: 'bg-violet',
  }
  const iconBg: Record<StatColor, string> = {
    blue: 'bg-blue-soft text-blue',
    mint: 'bg-mint-soft text-mint',
    amber: 'bg-amber-soft text-amber',
    red: 'bg-red-soft text-red',
    slate: 'bg-surface-subtle text-ink-muted',
    violet: 'bg-violet/10 text-violet',
  }

  return (
    <Card className="p-5 relative overflow-hidden">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">{label}</p>
          <p className="text-[1.75rem] font-bold text-ink mt-2 leading-tight tabular-nums">{value}</p>
          {trend && (
            <p className={`text-xs font-medium mt-2 inline-flex items-center gap-1 ${trend.up ? 'text-mint' : 'text-red'}`}>
              <Activity size={12} strokeWidth={2.5} />
              {trend.value}
            </p>
          )}
        </div>
        {icon && (
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${iconBg[color]}`}>
            {icon}
          </div>
        )}
      </div>
      <div className={`absolute bottom-0 left-0 right-0 h-0.5 ${accent[color]}`} />
    </Card>
  )
}

/* ──────────────────────────────────────────────────────────────
 * Badge — status pill with icon + color (never color-only)
 * ──────────────────────────────────────────────────────────── */
export function Badge({ status, children }: { status: string; children?: ReactNode }) {
  const map: Record<string, { cls: string; Icon: typeof Clock }> = {
    draft:               { cls: 'bg-surface-subtle text-ink-muted border-border',              Icon: Circle },
    pending:             { cls: 'bg-amber-soft text-amber border-amber/30',                     Icon: Clock },
    submitted:           { cls: 'bg-blue-soft text-blue border-blue/30',                        Icon: Clock },
    requested:           { cls: 'bg-blue-soft text-blue border-blue/30',                        Icon: Clock },
    approved:            { cls: 'bg-blue-soft text-blue border-blue/30',                        Icon: Check },
    confirmed:           { cls: 'bg-blue-soft text-blue border-blue/30',                        Icon: Check },
    allocated:           { cls: 'bg-blue-soft text-blue border-blue/30',                        Icon: Layers },
    ordered:             { cls: 'bg-blue-soft text-blue border-blue/30',                        Icon: Check },
    partially_received:  { cls: 'bg-amber-soft text-amber border-amber/30',                     Icon: Clock },
    received:            { cls: 'bg-mint-soft text-mint border-mint/30',                        Icon: CheckCircle2 },
    completed:           { cls: 'bg-mint-soft text-mint border-mint/30',                        Icon: CheckCircle2 },
    shipped:             { cls: 'bg-mint-soft text-mint border-mint/30',                        Icon: CheckCircle2 },
    delivered:           { cls: 'bg-mint-soft text-mint border-mint/30',                        Icon: CheckCircle2 },
    active:              { cls: 'bg-mint-soft text-mint border-mint/30',                        Icon: CheckCircle2 },
    picking:             { cls: 'bg-amber-soft text-amber border-amber/30',                     Icon: Activity },
    in_progress:         { cls: 'bg-amber-soft text-amber border-amber/30',                     Icon: Activity },
    in_transit:          { cls: 'bg-violet/10 text-violet border-violet/30',                    Icon: Activity },
    packed:              { cls: 'bg-violet/10 text-violet border-violet/30',                    Icon: Activity },
    picked:              { cls: 'bg-violet/10 text-violet border-violet/30',                    Icon: Activity },
    cancelled:           { cls: 'bg-surface-subtle text-ink-muted border-border',               Icon: XCircle },
    inactive:            { cls: 'bg-surface-subtle text-ink-muted border-border',               Icon: XCircle },
    damaged:             { cls: 'bg-red-soft text-red border-red/30',                           Icon: AlertTriangle },
    blocked:             { cls: 'bg-red-soft text-red border-red/30',                           Icon: AlertTriangle },
    open:                { cls: 'bg-amber-soft text-amber border-amber/30',                     Icon: Clock },
    assigned:            { cls: 'bg-blue-soft text-blue border-blue/30',                        Icon: Check },
    exception:           { cls: 'bg-red-soft text-red border-red/30',                           Icon: AlertTriangle },
  }
  const { cls, Icon } = map[status] || map.draft
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md border text-xs font-semibold ${cls}`}>
      <Icon size={12} strokeWidth={2.5} />
      {children || startCase(status)}
    </span>
  )
}

function startCase(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

/* ──────────────────────────────────────────────────────────────
 * Button — primary / secondary / danger / ghost
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
    primary:   'bg-blue hover:bg-blue-hover text-white shadow-sm shadow-blue/20',
    secondary: 'bg-surface hover:bg-surface-subtle text-ink border border-border',
    danger:    'bg-red hover:bg-red/90 text-white shadow-sm shadow-red/20',
    ghost:     'hover:bg-surface-subtle text-ink-muted hover:text-ink',
  }
  const sizes: Record<string, string> = {
    sm: 'px-3 py-1.5 text-xs rounded-lg',
    md: 'px-4 py-2 text-sm rounded-lg',
    lg: 'px-6 py-3 text-base rounded-lg',
  }
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-1.5 font-medium transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue focus-visible:ring-offset-1 disabled:opacity-50 disabled:pointer-events-none ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </button>
  )
}

/* ──────────────────────────────────────────────────────────────
 * Input — labelled text field
 * ──────────────────────────────────────────────────────────── */
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
        <span className="block text-xs font-semibold text-ink-muted mb-1.5">
          {label}
          {required && <span className="text-red ml-0.5">*</span>}
        </span>
      )}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        aria-invalid={!!error}
        className={`w-full border rounded-lg px-3.5 py-2.5 text-sm text-ink bg-surface focus:ring-2 focus:ring-blue/40 focus:border-blue outline-none transition placeholder:text-ink-muted/50 ${
          error ? 'border-red' : 'border-border'
        }`}
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
        <span className="block text-xs font-semibold text-ink-muted mb-1.5">
          {label}
          {required && <span className="text-red ml-0.5">*</span>}
        </span>
      )}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="w-full border border-border rounded-lg px-3.5 py-2.5 text-sm text-ink bg-surface focus:ring-2 focus:ring-blue/40 focus:border-blue outline-none transition"
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
 * Table — sticky-header data table with hover rows
 * ──────────────────────────────────────────────────────────── */
export function Table({ headers, children }: { headers: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-surface-subtle text-left text-ink-muted text-xs uppercase tracking-wider border-b border-border">
            {headers.map((h, i) => (
              <th key={i} className="px-4 py-3 font-semibold whitespace-nowrap first:pl-5 last:pr-5">
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
 * EmptyState — placeholder for no-data
 * ──────────────────────────────────────────────────────────── */
export function EmptyState({ message, icon, action }: { message: string; icon?: ReactNode; action?: ReactNode }) {
  return (
    <div className="text-center py-16">
      {icon && <div className="flex justify-center mb-3 text-ink-muted/40">{icon}</div>}
      <p className="text-sm text-ink-muted">{message}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────
 * Spinner — centered loading indicator
 * ──────────────────────────────────────────────────────────── */
export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="w-8 h-8 border-2 border-border border-t-blue rounded-full animate-spin" />
      {label && <p className="text-sm text-ink-muted mt-3">{label}</p>}
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────
 * ErrorBanner — inline error display with retry
 * ──────────────────────────────────────────────────────────── */
export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="bg-red-soft border border-red/30 text-red px-4 py-3 rounded-lg text-sm mb-4 flex items-start gap-2">
      <AlertTriangle size={16} className="mt-0.5 shrink-0" />
      <span className="flex-1">{message}</span>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-xs font-semibold text-red hover:text-red/80 underline shrink-0"
        >
          Retry
        </button>
      )}
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────
 * PageHeader — consistent page title + actions row
 * ──────────────────────────────────────────────────────────── */
export function PageHeader({
  title,
  subtitle,
  actions,
  breadcrumb,
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
  breadcrumb?: { label: string; href?: string }[]
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-1">
      <div>
        {breadcrumb && breadcrumb.length > 0 && (
          <nav aria-label="Breadcrumb" className="mb-1.5">
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
        )}
        <h1 className="text-2xl font-bold text-ink tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-ink-muted mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
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
    <div className="flex items-center justify-between px-4 py-3 border-t border-border">
      <Button size="sm" variant="secondary" disabled={currentPage <= 1} onClick={() => onChange(currentPage - 1)}>
        Previous
      </Button>
      <span className="text-sm text-ink-muted font-medium">
        Page {currentPage} of {lastPage}
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`bg-surface rounded-xl shadow-popover w-full ${sizes[size]} max-h-[90vh] overflow-y-auto animate-slide-up`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-surface z-10">
          <h3 className="text-lg font-bold text-ink">{title}</h3>
          <button
            onClick={onClose}
            className="text-ink-muted hover:text-ink transition p-1 rounded-lg hover:bg-surface-subtle"
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
        <div className={`flex items-start gap-3 ${variant === 'danger' ? 'bg-red-soft border border-red/30' : 'bg-blue-soft border border-blue/20'} rounded-lg p-4`}>
          {variant === 'danger' ? (
            <AlertTriangle size={20} className="text-red shrink-0 mt-0.5" />
          ) : (
            <Info size={20} className="text-blue shrink-0 mt-0.5" />
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
    <div className={`animate-pulse bg-surface-subtle rounded-md ${className}`} />
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
        <Skeleton className="w-10 h-10 rounded-lg" />
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

  const config: Record<ToastType, { cls: string; Icon: typeof Info }> = {
    success: { cls: 'bg-mint-soft border-mint/30 text-mint', Icon: CheckCircle2 },
    error:   { cls: 'bg-red-soft border-red/30 text-red',     Icon: AlertTriangle },
    info:    { cls: 'bg-blue-soft border-blue/30 text-blue',  Icon: Info },
    warning: { cls: 'bg-amber-soft border-amber/30 text-amber', Icon: Clock },
  }
  const { cls, Icon } = config[type]

  return (
    <div
      className={`fixed bottom-4 right-4 z-[60] flex items-center gap-2.5 ${cls} border rounded-lg shadow-popover px-4 py-3 text-sm font-medium animate-slide-up`}
      role="status"
      aria-live="polite"
    >
      <Icon size={16} className="shrink-0" />
      <span>{message}</span>
      {onClose && (
        <button onClick={onClose} className="ml-2 opacity-60 hover:opacity-100 transition" aria-label="Dismiss">
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
      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted/60 pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-ink bg-surface focus:ring-2 focus:ring-blue/40 focus:border-blue outline-none transition placeholder:text-ink-muted/50"
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
  const styles: Record<string, { border: string; bg: string; text: string; Icon: typeof AlertTriangle }> = {
    warning: { border: 'border-amber/30', bg: 'bg-amber-soft', text: 'text-amber', Icon: AlertTriangle },
    danger:  { border: 'border-red/30', bg: 'bg-red-soft', text: 'text-red', Icon: AlertTriangle },
    info:    { border: 'border-blue/20', bg: 'bg-blue-soft', text: 'text-blue', Icon: Info },
  }
  const { border, bg, text, Icon } = styles[severity]

  const content = (
    <Card className={`p-4 ${border} border-l-4 border-l-${severity === 'danger' ? 'red' : severity === 'warning' ? 'amber' : 'blue'}`}>
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-lg ${bg} ${text} flex items-center justify-center shrink-0`}>
          <Icon size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-ink">{title}</p>
            {count !== undefined && (
              <span className={`text-xs font-bold ${text} ${bg} px-2 py-0.5 rounded-md`}>{count}</span>
            )}
          </div>
          <p className="text-xs text-ink-muted mt-0.5 leading-relaxed">{description}</p>
          {actionLabel && (onAction || to) && (
            to ? (
              <a href={to} className={`text-xs font-semibold ${text} hover:underline mt-2 inline-flex items-center gap-1`}>
                {actionLabel}
              </a>
            ) : (
              <button onClick={onAction} className={`text-xs font-semibold ${text} hover:underline mt-2 inline-flex items-center gap-1`}>
                {actionLabel}
              </button>
            )
          )}
        </div>
      </div>
    </Card>
  )

  return content
}