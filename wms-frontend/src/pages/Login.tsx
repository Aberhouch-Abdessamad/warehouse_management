import { useMemo, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import {
  Lock, Mail, AlertTriangle, Eye, EyeOff, ArrowRight, ScanBarcode, Loader2, KeyRound,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { IsoCube, Tilt, CubeChip } from '../components/ui'
import { IsoBoxShape, rackBoxes, sceneBounds, seeded, project, type IsoBox } from '../components/iso'

const DEMO_ACCOUNTS = [
  { role: 'Admin', email: 'admin@wms.test' },
  { role: 'Manager', email: 'manager@wms.test' },
  { role: 'Floor staff', email: 'staff@wms.test' },
  { role: 'Purchasing', email: 'purchasing@wms.test' },
  { role: 'Sales', email: 'sales@wms.test' },
]

const U = 15
const KRAFT = ['#C9A27A', '#BF9566', '#D4B08A']

/* Decorative isometric warehouse: racks, pallets and a moving forklift. */
function WarehouseScene() {
  const { scene, forklift, bounds } = useMemo(() => {
    const rnd = seeded(42)
    const crate = () => {
      const r = rnd()
      return r < 0.18 ? '#0F766E' : r < 0.3 ? '#2D5B88' : r < 0.36 ? '#15803D' : KRAFT[Math.floor(rnd() * 3)]
    }
    const fills = (n: number, empty = 0.18) => Array.from({ length: n }, () => (rnd() < empty ? 0 : 0.55 + rnd() * 0.45))

    const floor: IsoBox[] = [
      { key: 'floor', x: -1.2, y: -1.2, z: -0.35, w: 19.4, d: 12.6, h: 0.35, color: '#D5DEE3', top: '#E8EEF1', left: '#CCD6DC', right: '#B7C3CA', stroke: 'rgba(29,35,44,.12)' },
      { key: 'lane1', x: -0.6, y: 3.0, z: 0, w: 18.2, d: 0.14, h: 0.01, color: '#F2B705', top: '#F2B705', stroke: 'none' },
      { key: 'lane2', x: -0.6, y: 5.9, z: 0, w: 18.2, d: 0.14, h: 0.01, color: '#F2B705', top: '#F2B705', stroke: 'none' },
      { key: 'dock', x: 15.6, y: 7.4, z: 0, w: 2.2, d: 3.4, h: 0.01, color: '#0F766E', top: 'rgba(15,118,110,.18)', stroke: 'rgba(15,118,110,.6)' },
    ]
    const rackA = rackBoxes({ x: 0, y: 0, bays: 4, levels: 4, fills: fills(16), crate, keyPrefix: 'A' })
    const rackB = rackBoxes({ x: 9.4, y: 0, bays: 3, levels: 4, fills: fills(12), crate, keyPrefix: 'B' })
    const pallet = (x: number, y: number, k: string, stack: number): IsoBox[] => {
      const out: IsoBox[] = [{ key: `${k}-p`, x, y, z: 0, w: 1.6, d: 1.4, h: 0.18, color: '#B98552' }]
      for (let i = 0; i < stack; i++) out.push({ key: `${k}-b${i}`, x: x + 0.1, y: y + 0.1, z: 0.18 + i * 0.62, w: 1.4, d: 1.2, h: 0.6, color: KRAFT[i % 3] })
      return out
    }
    const aisle = [...pallet(3.2, 3.9, 'p1', 2), ...pallet(5.4, 4.1, 'p2', 1)]
    const rackC = rackBoxes({ x: 0, y: 7.2, bays: 4, levels: 3, fills: fills(12, 0.25), crate, keyPrefix: 'C', beam: '#2D5B88' })
    const dockStack = [...pallet(15.9, 7.8, 'd1', 3), ...pallet(15.9, 9.5, 'd2', 2)]

    const fx = 11.6, fy = 3.8
    const lift: IsoBox[] = [
      { key: 'f-pal', x: fx - 1.9, y: fy + 0.05, z: 0.42, w: 1.5, d: 1.3, h: 0.14, color: '#B98552' },
      { key: 'f-crate', x: fx - 1.8, y: fy + 0.15, z: 0.56, w: 1.3, d: 1.1, h: 0.9, color: '#0F766E' },
      { key: 'f-fork1', x: fx - 2.0, y: fy + 0.25, z: 0.32, w: 1.8, d: 0.16, h: 0.08, color: '#3A4554' },
      { key: 'f-fork2', x: fx - 2.0, y: fy + 1.0, z: 0.32, w: 1.8, d: 0.16, h: 0.08, color: '#3A4554' },
      { key: 'f-mast', x: fx - 0.25, y: fy + 0.1, z: 0.1, w: 0.22, d: 1.2, h: 3.0, color: '#2A4555' },
      { key: 'f-wb', x: fx + 1.5, y: fy - 0.02, z: 0, w: 0.6, d: 0.2, h: 0.5, color: '#142028' },
      { key: 'f-body', x: fx, y: fy, z: 0.2, w: 2.3, d: 1.4, h: 1.0, color: '#F2B705' },
      { key: 'f-cw', x: fx + 1.8, y: fy, z: 0.2, w: 0.5, d: 1.4, h: 1.25, color: '#2A4555' },
      { key: 'f-seat', x: fx + 1.0, y: fy + 0.35, z: 1.2, w: 0.6, d: 0.7, h: 0.45, color: '#142028' },
      { key: 'f-post1', x: fx + 0.2, y: fy + 1.25, z: 1.2, w: 0.1, d: 0.1, h: 1.4, color: '#142028' },
      { key: 'f-post2', x: fx + 1.9, y: fy + 1.25, z: 1.2, w: 0.1, d: 0.1, h: 1.4, color: '#142028' },
      { key: 'f-roof', x: fx + 0.15, y: fy + 0.05, z: 2.6, w: 1.95, d: 1.35, h: 0.1, color: '#2A4555' },
      { key: 'f-wf1', x: fx + 0.2, y: fy + 1.25, z: 0, w: 0.6, d: 0.22, h: 0.5, color: '#142028' },
      { key: 'f-wf2', x: fx + 1.5, y: fy + 1.25, z: 0, w: 0.6, d: 0.22, h: 0.5, color: '#142028' },
    ]
    const scene = [...floor, ...rackA, ...rackB, ...aisle, ...rackC, ...dockStack]
    return { scene, forklift: lift, bounds: sceneBounds([...scene, ...lift], U, 10) }
  }, [])

  const [dx, dy] = project(-4.5, 0, 0, U)
  return (
    <svg viewBox={`${bounds.x} ${bounds.y} ${bounds.w} ${bounds.h}`} className="w-full h-auto max-h-[58vh] drop-shadow-[0_30px_30px_rgba(29,35,44,.22)]" role="img" aria-label="Isometric warehouse illustration">
      <style>{`
        @keyframes forkliftDrive { 0%,12% { transform: translate(0,0) } 45%,62% { transform: translate(${dx.toFixed(1)}px,${dy.toFixed(1)}px) } 95%,100% { transform: translate(0,0) } }
        .forklift { animation: forkliftDrive 11s ease-in-out infinite; }
        @keyframes beacon { 0%,100% { opacity: .25 } 50% { opacity: 1 } }
        .beacon { animation: beacon 1.1s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .forklift, .beacon { animation: none } }
      `}</style>
      {scene.map((b) => <IsoBoxShape key={b.key} b={b} u={U} />)}
      <g className="forklift">
        {forklift.map((b) => <IsoBoxShape key={b.key} b={b} u={U} />)}
        {(() => { const [bx, by] = project(11.6 + 1.1, 3.8 + 0.7, 2.75, U); return <circle className="beacon" cx={bx} cy={by} r={3.2} fill="#14A396" /> })()}
      </g>
    </svg>
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

  const inputCls =
    'w-full h-12 border border-border rounded-xl text-[15px] text-ink bg-surface-raised shadow-well focus:bg-surface focus:shadow-glow focus:border-brand outline-none transition placeholder:text-ink-subtle'

  return (
    <div className="min-h-screen flex bg-surface-raised overflow-hidden">
      {/* ── Brand / 3D scene ──────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[57%] lg:h-screen lg:sticky lg:top-0 relative bg-gradient-to-br from-brand-soft via-[#EAF3F4] to-[#E4ECF1]">
        <div className="absolute -top-32 -left-24 w-[520px] h-[520px] rounded-full bg-brand/15 blur-[110px]" />
        <div className="absolute bottom-0 right-10 w-[420px] h-[420px] rounded-full bg-steel/10 blur-[110px]" />

        <div className="relative z-10 flex flex-col w-full px-12 xl:px-16 py-8">
          <div className="flex items-center gap-3">
            <IsoCube size={44} className="drop-shadow-[0_8px_10px_rgba(15,118,110,.35)]" />
            <div>
              <p className="font-display font-bold text-xl text-ink tracking-tight leading-tight">Banknbox <span className="text-brand">WMS</span></p>
              <p className="text-[10px] text-ink-muted font-bold tracking-[0.2em]">WAREHOUSE OS</p>
            </div>
          </div>

          <div className="mt-8 max-w-xl animate-slide-up">
            <h1 className="font-display text-[38px] xl:text-[42px] font-bold text-ink leading-[1.08] tracking-tight">
              Every bin, order and pallet —{' '}
              <span className="bg-gradient-to-r from-brand to-[#2F6F9F] bg-clip-text text-transparent">under control.</span>
            </h1>
            <p className="text-ink-muted mt-3 text-[15px] leading-relaxed max-w-lg">
              Receive, put away, pick, pack and ship — with live bin-level stock across every site.
            </p>
          </div>

          <div className="flex-1 flex items-center justify-center py-4 min-h-0">
            <Tilt max={5} className="relative w-full max-w-[640px]">
              <WarehouseScene />
            </Tilt>
          </div>

          <p className="text-[11px] text-ink-subtle">© {new Date().getFullYear()} Banknbox · Warehouse Management System</p>
        </div>
      </div>

      {/* ── Form panel ────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 relative">
        <div className="w-full max-w-[440px] animate-rise">
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <IsoCube size={40} />
            <div>
              <p className="font-display font-bold text-ink tracking-tight leading-tight">Banknbox <span className="text-brand">WMS</span></p>
              <p className="text-[9px] text-ink-muted font-bold tracking-[0.2em]">WAREHOUSE OS</p>
            </div>
          </div>

          <div className="relative bg-surface border border-border rounded-3xl shadow-popover">
            <div className="p-8 sm:p-9">
              <CubeChip color="brand" size={50}><KeyRound size={22} /></CubeChip>
              <h2 className="font-display text-[30px] font-bold text-ink tracking-tight leading-tight mt-5">Welcome back</h2>
              <p className="text-sm text-ink-muted mt-1">Sign in to your warehouse workspace.</p>

              {error && (
                <div role="alert" className="mt-6 bg-red-soft border border-red/30 text-red px-4 py-3 rounded-xl text-sm flex items-start gap-2.5">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="mt-7 space-y-5" noValidate={false}>
                <label className="block">
                  <span className="block text-[13px] font-bold text-ink mb-1.5">Work email</span>
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
                      className={`${inputCls} pl-11 pr-4`}
                    />
                  </div>
                </label>

                <label className="block">
                  <span className="block text-[13px] font-bold text-ink mb-1.5">Password</span>
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
                      className={`${inputCls} pl-11 pr-12`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg text-ink-subtle hover:text-ink hover:bg-surface-subtle transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {capsLock && <p className="text-xs text-amber font-semibold mt-1.5">Caps Lock is on</p>}
                </label>

                <button
                  type="submit"
                  disabled={loading || !email || !password}
                  className="group w-full h-12 inline-flex items-center justify-center gap-2 bg-gradient-to-b from-brand-light to-brand text-white font-bold text-[15px] rounded-xl shadow-key hover:brightness-105 active:translate-y-[3px] active:shadow-none transition-all duration-100 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-4 focus-visible:ring-brand/30"
                >
                  {loading ? <><Loader2 size={17} className="animate-spin" /> Signing in…</> : <>Sign in <ArrowRight size={17} className="transition-transform group-hover:translate-x-0.5" /></>}
                </button>
              </form>

              <div className="mt-8">
                <div className="flex items-center gap-3 mb-3">
                  <span className="h-px flex-1 bg-border" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-ink-subtle">Demo accounts</span>
                  <span className="h-px flex-1 bg-border" />
                </div>
                <div className="flex flex-wrap gap-2">
                  {DEMO_ACCOUNTS.map((a) => (
                    <button
                      key={a.email}
                      type="button"
                      onClick={() => fillDemo(a.email)}
                      className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all duration-100 active:translate-y-[2px] active:shadow-none ${
                        email === a.email
                          ? 'border-brand bg-brand-soft text-brand shadow-[0_2px_0_rgb(15_118_110/.45)]'
                          : 'border-border text-ink-muted hover:text-ink bg-surface shadow-key-neutral'
                      }`}
                      title={`${a.email} · password`}
                    >
                      {a.role}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-ink-subtle mt-2.5">Click a role to fill its credentials — each role sees only the modules it is allowed to use.</p>
              </div>
            </div>
          </div>

          <p className="mt-6 text-xs text-ink-muted flex items-center justify-center gap-1.5">
            <ScanBarcode size={13} /> Forgot your password? Ask your warehouse administrator to reset it.
          </p>
        </div>
      </div>
    </div>
  )
}
