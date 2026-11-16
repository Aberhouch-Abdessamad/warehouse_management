import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import {
  Warehouse, Lock, Mail, AlertTriangle, Eye, EyeOff, ArrowRight, Sparkles, ScanBarcode,
  ShieldCheck, Boxes, Truck, Loader2, KeyRound,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const DEMO_ACCOUNTS = [
  { role: 'Admin', email: 'admin@wms.test' },
  { role: 'Manager', email: 'manager@wms.test' },
  { role: 'Floor staff', email: 'staff@wms.test' },
  { role: 'Purchasing', email: 'purchasing@wms.test' },
  { role: 'Sales', email: 'sales@wms.test' },
]

/* Decorative rack: bins fill and empty in a slow wave. */
function RackIllustration() {
  const levels = [
    [0.9, 0.6, 0.0, 0.8, 0.4, 1.0],
    [0.3, 1.0, 0.7, 0.0, 0.9, 0.5],
    [1.0, 0.2, 0.8, 0.6, 0.0, 0.7],
    [0.6, 0.8, 0.4, 1.0, 0.7, 0.2],
  ]
  return (
    <div className="relative rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-sm p-5 shadow-2xl shadow-black/30">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-mint animate-pulse" />
          <span className="text-[11px] font-semibold tracking-[0.14em] text-white/60">ZONE A · AISLE 01</span>
        </div>
        <span className="text-[10px] font-mono text-white/35">R-01 → R-04</span>
      </div>
      <div className="space-y-2.5">
        {levels.map((row, r) => (
          <div key={r} className="grid grid-cols-6 gap-2">
            {row.map((fill, c) => (
              <div key={c} className="relative h-9 rounded-md bg-white/[0.06] border border-white/[0.08] overflow-hidden">
                <div
                  className="absolute bottom-0 inset-x-0 rounded-sm login-bin"
                  style={{
                    height: `${fill * 100}%`,
                    background: fill > 0.85 ? 'linear-gradient(180deg,#2DD4BF,#0F9F8C)' : 'linear-gradient(180deg,#60A5FA,#2563EB)',
                    opacity: fill === 0 ? 0 : 0.85,
                    animationDelay: `${(r * 6 + c) * 0.35}s`,
                  }}
                />
                <span className="absolute z-10 top-0.5 left-1 text-[8px] font-mono text-white/60">B-{String(r * 6 + c + 1).padStart(2, '0')}</span>
              </div>
            ))}
          </div>
        ))}
        <div className="h-1.5 rounded-full bg-white/10" />
      </div>
      <div className="absolute -right-5 -bottom-6 flex items-center gap-2.5 bg-white text-ink rounded-xl px-3.5 py-2.5 shadow-xl">
        <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet to-blue text-white flex items-center justify-center"><Sparkles size={14} /></span>
        <div>
          <p className="text-[11px] font-bold leading-tight">WMS Copilot</p>
          <p className="text-[10px] text-ink-muted leading-tight">Reorder, pick & bin advice</p>
        </div>
      </div>
    </div>
  )
}

export default function Login() {
  const { login, user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [capsLock, setCapsLock] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/dashboard'

  if (user) return <Navigate to={from} replace />

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await login(email.trim(), password)
      navigate(from, { replace: true })
    } catch (err: unknown) {
      const e2 = err as { response?: { status?: number; data?: { message?: string; errors?: Record<string, string[]> } } }
      const first = e2.response?.data?.errors ? Object.values(e2.response.data.errors).flat()[0] : null
      setError(
        e2.response?.status === 429 ? 'Too many attempts. Please wait a minute and try again.'
          : !e2.response ? 'Cannot reach the server. Check that the backend is running.'
          : first || e2.response?.data?.message || 'Sign-in failed. Check your credentials.',
      )
    } finally {
      setLoading(false)
    }
  }

  const fillDemo = (demoEmail: string) => {
    setEmail(demoEmail)
    setPassword('password')
    setError(null)
  }

  return (
    <div className="min-h-screen flex bg-canvas">
      <style>{`
        @keyframes binWave { 0%,100% { transform: scaleY(1) } 50% { transform: scaleY(.55) } }
        .login-bin { transform-origin: bottom; animation: binWave 7s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .login-bin { animation: none } }
      `}</style>

      {/* ── Brand panel ───────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[54%] relative overflow-hidden bg-[#0B1B33]">
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)',
            backgroundSize: '56px 56px',
            maskImage: 'radial-gradient(ellipse at 30% 40%, black 30%, transparent 75%)',
          }}
        />
        <div className="absolute -top-40 -left-32 w-[520px] h-[520px] rounded-full bg-blue/25 blur-[120px]" />
        <div className="absolute -bottom-40 right-0 w-[460px] h-[460px] rounded-full bg-mint/20 blur-[120px]" />

        <div className="relative z-10 flex flex-col justify-between w-full px-14 py-12">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue to-mint flex items-center justify-center shadow-lg shadow-blue/30">
              <Warehouse size={21} className="text-white" />
            </div>
            <div>
              <p className="font-bold text-lg text-white tracking-tight leading-tight">Banknbox WMS</p>
              <p className="text-[10px] text-white/45 font-semibold tracking-[0.16em]">WAREHOUSE OS</p>
            </div>
          </div>

          <div>
            <div className="max-w-xl">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-mint bg-mint/10 border border-mint/20 rounded-full px-3 py-1">
                <Sparkles size={12} /> Now with an AI Copilot
              </span>
              <h1 className="text-[38px] xl:text-[42px] font-bold text-white leading-[1.1] tracking-tight mt-5">
                Every bin, order and pallet —{' '}
                <span className="bg-gradient-to-r from-blue-300 via-sky-300 to-teal-300 bg-clip-text text-transparent">under control.</span>
              </h1>
              <p className="text-white/60 mt-4 text-[15px] leading-relaxed max-w-lg">
                Receive, put away, pick, pack and ship across all your sites with live bin-level stock,
                a full audit trail and an AI assistant that knows your warehouse.
              </p>
            </div>
            <div className="mt-10 flex items-center gap-12">
              <ul className="space-y-3.5 flex-1 min-w-0 max-w-sm">
                {[
                  { icon: <Boxes size={15} />, text: 'Bin-level inventory with reservations and cycle counts' },
                  { icon: <Truck size={15} />, text: 'Guided inbound & outbound flows for the floor team' },
                  { icon: <ShieldCheck size={15} />, text: 'Role-based access and an immutable stock ledger' },
                ].map((f) => (
                  <li key={f.text} className="flex items-center gap-3 text-sm text-white/75">
                    <span className="w-7 h-7 rounded-lg bg-white/[0.07] border border-white/10 text-mint flex items-center justify-center shrink-0">{f.icon}</span>
                    {f.text}
                  </li>
                ))}
              </ul>
              <div className="hidden xl:block w-[320px] shrink-0">
                <RackIllustration />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-white/30">
            <span>© {new Date().getFullYear()} Banknbox · Warehouse Management System</span>
            <span className="inline-flex items-center gap-1.5"><ShieldCheck size={13} /> Encrypted session</span>
          </div>
        </div>
      </div>

      {/* ── Form panel ────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 relative">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue via-sky-400 to-mint lg:hidden" />
        <div className="w-full max-w-[400px]">
          <div className="lg:hidden flex items-center gap-2.5 mb-10">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue to-mint flex items-center justify-center">
              <Warehouse size={19} className="text-white" />
            </div>
            <div>
              <p className="font-bold text-ink tracking-tight leading-tight">Banknbox WMS</p>
              <p className="text-[9px] text-ink-muted font-semibold tracking-[0.16em]">WAREHOUSE OS</p>
            </div>
          </div>

          <div className="w-12 h-12 rounded-2xl bg-blue-soft text-blue flex items-center justify-center mb-5">
            <KeyRound size={22} />
          </div>
          <h2 className="text-[28px] font-bold text-ink tracking-tight leading-tight">Welcome back</h2>
          <p className="text-sm text-ink-muted mt-1.5">Sign in to your warehouse workspace.</p>

          {error && (
            <div role="alert" className="mt-6 bg-red-soft border border-red/30 text-red px-4 py-3 rounded-xl text-sm flex items-start gap-2.5">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-7 space-y-5" noValidate={false}>
            <label className="block">
              <span className="block text-[13px] font-semibold text-ink mb-1.5">Work email</span>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-subtle pointer-events-none" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  required
                  autoFocus
                  autoComplete="email"
                  className="w-full h-12 border border-border rounded-xl pl-11 pr-4 text-[15px] text-ink bg-surface shadow-sm focus:ring-4 focus:ring-blue/15 focus:border-blue outline-none transition placeholder:text-ink-subtle"
                />
              </div>
            </label>

            <label className="block">
              <span className="block text-[13px] font-semibold text-ink mb-1.5">Password</span>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-subtle pointer-events-none" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyUp={(e) => setCapsLock(e.getModifierState('CapsLock'))}
                  onBlur={() => setCapsLock(false)}
                  placeholder="Enter your password"
                  required
                  autoComplete="current-password"
                  className="w-full h-12 border border-border rounded-xl pl-11 pr-12 text-[15px] text-ink bg-surface shadow-sm focus:ring-4 focus:ring-blue/15 focus:border-blue outline-none transition placeholder:text-ink-subtle"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg text-ink-subtle hover:text-ink hover:bg-surface-subtle transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {capsLock && <p className="text-xs text-amber font-medium mt-1.5">Caps Lock is on</p>}
            </label>

            <button
              type="submit"
              disabled={loading || !email || !password}
              className="group w-full h-12 inline-flex items-center justify-center gap-2 bg-gradient-to-r from-blue to-[#1E5BD8] hover:to-blue-hover disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-[15px] rounded-xl transition shadow-lg shadow-blue/25 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue/30"
            >
              {loading ? <><Loader2 size={17} className="animate-spin" /> Signing in…</> : <>Sign in <ArrowRight size={17} className="transition-transform group-hover:translate-x-0.5" /></>}
            </button>
          </form>

          <div className="mt-8">
            <div className="flex items-center gap-3 mb-3">
              <span className="h-px flex-1 bg-border" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">Demo accounts</span>
              <span className="h-px flex-1 bg-border" />
            </div>
            <div className="flex flex-wrap gap-2">
              {DEMO_ACCOUNTS.map((a) => (
                <button
                  key={a.email}
                  type="button"
                  onClick={() => fillDemo(a.email)}
                  className={`text-xs font-medium px-3 py-1.5 rounded-full border transition ${
                    email === a.email ? 'border-blue bg-blue-soft text-blue' : 'border-border text-ink-muted hover:border-blue/40 hover:text-ink bg-surface'
                  }`}
                  title={`${a.email} · password`}
                >
                  {a.role}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-ink-subtle mt-2.5">Click a role to fill its credentials — each role sees only the modules it is allowed to use.</p>
          </div>

          <p className="mt-10 text-xs text-ink-subtle flex items-center gap-1.5">
            <ScanBarcode size={13} /> Forgot your password? Ask your warehouse administrator to reset it.
          </p>
        </div>
      </div>
    </div>
  )
}
