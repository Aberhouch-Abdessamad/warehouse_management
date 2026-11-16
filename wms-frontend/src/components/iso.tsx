import type { ReactNode } from 'react'

/* ══════════════════════════════════════════════════════════════
 * Tiny isometric 3D engine (SVG) — no dependencies.
 * World axes: x → right-down, y → left-down, z → up.
 * Boxes are painted in the order given, so callers emit them
 * back-to-front.
 * ════════════════════════════════════════════════════════════ */

const C = Math.cos(Math.PI / 6)
const S = Math.sin(Math.PI / 6)

export interface IsoBox {
  x: number; y: number; z: number; w: number; d: number; h: number
  color: string
  key?: string
  opacity?: number
  /** optional per-face overrides */
  top?: string; left?: string; right?: string
  stroke?: string
  className?: string
  title?: string
  onClick?: () => void
  onEnter?: () => void
  onLeave?: () => void
}

export function project(x: number, y: number, z: number, u: number) {
  return [(x - y) * C * u, (x + y) * S * u - z * u] as const
}

/* colour helpers */
function hexToRgb(hex: string) {
  const m = hex.match(/rgba?\(([^)]+)\)/)
  if (m) return m[1].split(',').slice(0, 3).map((v) => parseFloat(v))
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
export function shade(hex: string, amt: number) {
  // amt > 0 lighten toward white, < 0 darken toward black
  const [r, g, b] = hexToRgb(hex)
  const f = (c: number) => Math.round(amt >= 0 ? c + (255 - c) * amt : c * (1 + amt))
  return `rgb(${f(r)},${f(g)},${f(b)})`
}

function pts(list: (readonly [number, number])[]) {
  return list.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(' ')
}

export function boxFaces(b: IsoBox, u: number) {
  const P = (x: number, y: number, z: number) => project(x, y, z, u)
  const { x, y, z, w, d, h } = b
  const top = [P(x, y, z + h), P(x + w, y, z + h), P(x + w, y + d, z + h), P(x, y + d, z + h)]
  const left = [P(x, y + d, z), P(x + w, y + d, z), P(x + w, y + d, z + h), P(x, y + d, z + h)]
  const right = [P(x + w, y, z), P(x + w, y + d, z), P(x + w, y + d, z + h), P(x + w, y, z + h)]
  return { top, left, right }
}

export function sceneBounds(boxes: IsoBox[], u: number, pad = 8) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const b of boxes) {
    for (const [px, py] of [
      project(b.x, b.y, b.z, u), project(b.x + b.w, b.y, b.z, u), project(b.x, b.y + b.d, b.z, u), project(b.x + b.w, b.y + b.d, b.z, u),
      project(b.x, b.y, b.z + b.h, u), project(b.x + b.w, b.y, b.z + b.h, u), project(b.x, b.y + b.d, b.z + b.h, u), project(b.x + b.w, b.y + b.d, b.z + b.h, u),
    ]) {
      minX = Math.min(minX, px); maxX = Math.max(maxX, px); minY = Math.min(minY, py); maxY = Math.max(maxY, py)
    }
  }
  return { x: minX - pad, y: minY - pad, w: maxX - minX + pad * 2, h: maxY - minY + pad * 2 }
}

export function IsoBoxShape({ b, u }: { b: IsoBox; u: number }) {
  const f = boxFaces(b, u)
  const stroke = b.stroke ?? 'rgba(29,35,44,.18)'
  return (
    <g
      opacity={b.opacity ?? 1}
      className={b.className}
      onClick={b.onClick}
      onMouseEnter={b.onEnter}
      onMouseLeave={b.onLeave}
      style={b.onClick ? { cursor: 'pointer' } : undefined}
    >
      {b.title && <title>{b.title}</title>}
      <polygon points={pts(f.left)} fill={b.left ?? b.color} stroke={stroke} strokeWidth={0.6} strokeLinejoin="round" />
      <polygon points={pts(f.right)} fill={b.right ?? shade(b.color, -0.22)} stroke={stroke} strokeWidth={0.6} strokeLinejoin="round" />
      <polygon points={pts(f.top)} fill={b.top ?? shade(b.color, 0.3)} stroke={stroke} strokeWidth={0.6} strokeLinejoin="round" />
    </g>
  )
}

export function IsoScene({
  boxes, u = 16, className = '', children, bounds, label,
}: {
  boxes: IsoBox[]; u?: number; className?: string; children?: ReactNode; bounds?: { x: number; y: number; w: number; h: number }; label?: string
}) {
  const bb = bounds ?? sceneBounds(boxes, u)
  return (
    <svg viewBox={`${bb.x} ${bb.y} ${bb.w} ${bb.h}`} className={className} role="img" aria-label={label}>
      {boxes.map((b, i) => <IsoBoxShape key={b.key ?? i} b={b} u={u} />)}
      {children}
    </svg>
  )
}

/* ──────────────────────────────────────────────────────────────
 * Rack builder — pallet rack with bays × levels; `fills` (0..1)
 * per slot decides whether a crate is stored and how tall.
 * ──────────────────────────────────────────────────────────── */
export interface RackOpts {
  x: number; y: number
  bays: number; levels: number
  bayW?: number; depth?: number; levelH?: number
  fills: number[] // length bays*levels, row-major from bottom level
  crate: (slot: number, fill: number) => string
  frame?: string; beam?: string
  keyPrefix?: string
  highlight?: boolean
}

export function rackBoxes(o: RackOpts): IsoBox[] {
  const bayW = o.bayW ?? 2, depth = o.depth ?? 1.6, levelH = o.levelH ?? 1.5
  const frame = o.frame ?? '#3A4554'
  const beam = o.beam ?? '#0F766E'
  const W = o.bays * bayW, H = o.levels * levelH + 0.2
  const t = 0.14
  const k = o.keyPrefix ?? 'r'
  const out: IsoBox[] = []
  // back uprights (far corners)
  out.push({ key: `${k}-u0`, x: o.x, y: o.y, z: 0, w: t, d: t, h: H, color: frame })
  for (let i = 1; i <= o.bays; i++) out.push({ key: `${k}-ub${i}`, x: o.x + i * bayW - t, y: o.y, z: 0, w: t, d: t, h: H, color: frame })
  for (let l = 0; l < o.levels; l++) {
    const z = l * levelH + 0.12
    // shelf deck
    out.push({ key: `${k}-deck${l}`, x: o.x, y: o.y, z, w: W, d: depth, h: 0.1, color: '#C3CED5', top: '#D7E0E5' })
    for (let b = 0; b < o.bays; b++) {
      const slot = l * o.bays + b
      const f = o.fills[slot] ?? 0
      if (f > 0.02) {
        const ch = Math.max(0.35, (levelH - 0.35) * Math.min(1, f))
        out.push({
          key: `${k}-c${slot}`,
          x: o.x + b * bayW + 0.25, y: o.y + 0.2, z: z + 0.1,
          w: bayW - 0.5, d: depth - 0.4, h: ch,
          color: o.crate(slot, f),
        })
      }
    }
    // front beam (orange step beam)
    out.push({ key: `${k}-beam${l}`, x: o.x, y: o.y + depth - 0.08, z: z - 0.08, w: W, d: 0.1, h: 0.2, color: beam })
  }
  // front uprights (near corners)
  out.push({ key: `${k}-ul`, x: o.x, y: o.y + depth - t, z: 0, w: t, d: t, h: H, color: frame })
  for (let i = 1; i <= o.bays; i++) out.push({ key: `${k}-uf${i}`, x: o.x + i * bayW - t, y: o.y + depth - t, z: 0, w: t, d: t, h: H, color: frame })
  return out
}

/** Deterministic pseudo-random for stable decorative scenes. */
export function seeded(seed: number) {
  let s = seed % 2147483647
  if (s <= 0) s += 2147483646
  return () => (s = (s * 16807) % 2147483647) / 2147483647
}
