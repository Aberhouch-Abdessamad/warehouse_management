import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ScanBarcode, Lock, Mail, AlertTriangle, Eye, EyeOff } from 'lucide-react'

export default function Login() {
  const { login, user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/dashboard'

  if (user) {
    navigate(from, { replace: true })
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await login(email, password)
      navigate(from, { replace: true })
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(msg || 'Login failed. Check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-canvas">
      {/* Left brand panel */}
      <div className="hidden lg:flex lg:w-[55%] bg-navy relative overflow-hidden">
        {/* decorative grid */}
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
        <div className="absolute -bottom-32 -right-32 w-[480px] h-[480px] rounded-full bg-blue/20 blur-3xl" />
        <div className="absolute -top-24 -left-24 w-[320px] h-[320px] rounded-full bg-violet/15 blur-3xl" />

        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue to-violet flex items-center justify-center shadow-lg shadow-blue/30">
              <ScanBarcode size={20} className="text-white" />
            </div>
            <div>
              <span className="font-bold text-lg text-white tracking-tight">WMS</span>
              <p className="text-[10px] text-white/40 font-semibold tracking-[0.14em]">WAREHOUSE OS</p>
            </div>
          </div>

          <div className="max-w-md">
            <h1 className="text-4xl font-bold text-white leading-tight tracking-tight">
              Run every warehouse<br />from one calm console.
            </h1>
            <p className="text-white/60 mt-4 text-[15px] leading-relaxed">
              Purchasing, receiving, inventory control, transfers and fulfillment —
              with atomic stock movements, full audit trails and role-scoped access.
            </p>
            <div className="grid grid-cols-3 gap-6 mt-10">
              {[
                { k: 'Ledger', v: 'Immutable' },
                { k: 'Stock ops', v: 'Atomic' },
                { k: 'Access', v: 'RBAC + scope' },
              ].map((s) => (
                <div key={s.k}>
                  <p className="text-white/40 text-[11px] font-semibold uppercase tracking-wider">{s.k}</p>
                  <p className="text-white text-sm font-semibold mt-1">{s.v}</p>
                </div>
              ))}
            </div>
          </div>

          <p className="text-white/25 text-xs">© {new Date().getFullYear()} WMS · Warehouse Management System</p>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue to-violet flex items-center justify-center">
              <ScanBarcode size={17} className="text-white" />
            </div>
            <div>
              <span className="font-bold text-ink tracking-tight">WMS</span>
              <p className="text-[9px] text-ink-muted font-semibold tracking-[0.14em]">WAREHOUSE OS</p>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-ink tracking-tight">Sign in</h2>
          <p className="text-sm text-ink-muted mt-1">Use your operator credentials to continue.</p>

          {error && (
            <div className="mt-5 bg-red-soft border border-red/30 text-red px-4 py-3 rounded-lg text-sm flex items-start gap-2">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <label className="block">
              <span className="block text-xs font-semibold text-ink-muted mb-1.5">Email</span>
              <div className="relative">
                <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted/60" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  required
                  autoComplete="email"
                  className="w-full border border-border rounded-lg pl-10 pr-3.5 py-2.5 text-sm text-ink bg-surface focus:ring-2 focus:ring-blue/40 focus:border-blue outline-none transition placeholder:text-ink-muted/50"
                />
              </div>
            </label>

            <label className="block">
              <span className="block text-xs font-semibold text-ink-muted mb-1.5">Password</span>
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted/60" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className="w-full border border-border rounded-lg pl-10 pr-10 py-2.5 text-sm text-ink bg-surface focus:ring-2 focus:ring-blue/40 focus:border-blue outline-none transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted/60 hover:text-ink transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue rounded"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </label>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="h-4 w-4 rounded border-border text-blue focus:ring-blue/40"
                />
                <span className="text-sm text-ink-muted">Remember me</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue hover:bg-blue-hover disabled:opacity-50 text-white font-semibold text-sm py-2.5 rounded-lg transition shadow-sm shadow-blue/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue focus-visible:ring-offset-1"
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 bg-blue-soft/60 border border-blue/15 rounded-lg px-4 py-3">
            <p className="text-[11px] font-semibold text-blue uppercase tracking-wider mb-0.5">Demo credentials</p>
            <p className="text-[13px] text-ink font-medium">admin@wms.test · password</p>
          </div>
        </div>
      </div>
    </div>
  )
}