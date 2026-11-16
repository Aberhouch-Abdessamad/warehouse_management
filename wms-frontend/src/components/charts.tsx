import { useMemo, useState } from 'react'
import { fmtCompact, fmtNum } from '../lib/errors'
import { IsoBoxShape, project, rackBoxes, sceneBounds, shade, type IsoBox } from './iso'

/* Categorical pair on the light-industrial surface: teal = inbound, steel = outbound. */
export const SERIES = { inbound: '#15803D', outbound: '#2D5B88' }
const BRAND = '#0F766E'
const GRID = '#E3E9ED'
const AXIS = '#94A3AD'

function niceMax(v: number) {
  if (v <= 0) return 10
  const pow = 10 ** Math.floor(Math.log10(v))
  const n = v / pow
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10
  return step * pow
}

/** Extruded (oblique-projection) column: front face + top + right side. */
function Bar3D({ x, y, w, h, dx, dy, color, active }: { x: number; y: number; w: number; h: number; dx: number; dy: number; color: string; active?: boolean }) {
  if (h <= 0.5) {
    return <path d={`M${x},${y + h} l${dx},${dy} h${w} l${-dx},${-dy} Z`} fill={shade(color, 0.55)} opacity={0.7} />
  }
  const front = `M${x},${y} h${w} v${h} h${-w} Z`
  const top = `M${x},${y} l${dx},${dy} h${w} l${-dx},${-dy} Z`
  const side = `M${x + w},${y} l${dx},${dy} v${h} l${-dx},${-dy} Z`
  return (
    <g style={{ filter: active ? 'brightness(1.08)' : undefined }}>
      <path d={side} fill={shade(color, -0.3)} />
      <path d={front} fill={`url(#g-${color.slice(1)})`} />
      <path d={top} fill={shade(color, 0.35)} />
    </g>
  )
}

function BarGradients({ colors }: { colors: string[] }) {
  return (
    <defs>
      {colors.map((c) => (
        <linearGradient key={c} id={`g-${c.slice(1)}`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor={shade(c, 0.12)} />
          <stop offset="1" stopColor={c} />
        </linearGradient>
      ))}
    </defs>
  )
}

export interface ThroughputPoint { date: string; inbound: number; outbound: number }

export function ThroughputChart({ data }: { data: ThroughputPoint[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const W = 760, H = 280, padL = 44, padR = 22, padT = 26, padB = 30
  const dx = 7, dy = -6
  const innerW = W - padL - padR - dx, innerH = H - padT - padB
  const max = niceMax(Math.max(1, ...data.flatMap((d) => [d.inbound, d.outbound])))
  const band = innerW / Math.max(1, data.length)
  const barW = Math.min(16, (band - 10) / 2)
  const y = (v: number) => padT + innerH - (v / max) * innerH
  const base = padT + innerH
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max)
  const totalIn = data.reduce((s, d) => s + d.inbound, 0)
  const totalOut = data.reduce((s, d) => s + d.outbound, 0)

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mb-2 text-xs text-ink-muted">
        <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-[3px] shadow-[0_2px_0_#0F5F2D]" style={{ background: SERIES.inbound }} /> Inbound <b className="text-ink tabular-nums">{fmtNum(totalIn)}</b></span>
        <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-[3px] shadow-[0_2px_0_#1C3A58]" style={{ background: SERIES.outbound }} /> Outbound <b className="text-ink tabular-nums">{fmtNum(totalOut)}</b></span>
        <span className="ml-auto">units · last 14 days</span>
      </div>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Inbound and outbound units per day">
          <BarGradients colors={[SERIES.inbound, SERIES.outbound]} />
          {/* back wall + floor */}
          <path d={`M${padL + dx},${padT + dy} H${W - padR} V${base + dy} H${padL + dx} Z`} fill="#F8FAFB" />
          <path d={`M${padL},${base} l${dx},${dy} H${W - padR} l${-dx},${-dy} Z`} fill="#EBF0F3" />
          <path d={`M${padL},${padT} l${dx},${dy} V${base + dy} l${-dx},${-dy} Z`} fill="#F1F5F7" />
          {ticks.map((t) => (
            <g key={t}>
              <path d={`M${padL},${y(t)} l${dx},${dy} H${W - padR}`} stroke={GRID} strokeWidth={1} fill="none" />
              <text x={padL - 8} y={y(t) + 3.5} textAnchor="end" fontSize="10" fill={AXIS}>{fmtCompact(t)}</text>
            </g>
          ))}
          {data.map((d, i) => {
            const x0 = padL + i * band + (band - (barW * 2 + 3)) / 2
            const label = new Date(d.date + 'T00:00:00')
            const on = hover === i
            return (
              <g key={d.date} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                <rect x={padL + i * band} y={padT + dy} width={band} height={innerH - dy} fill={on ? 'rgba(15,118,110,.06)' : 'transparent'} rx={4} />
                <Bar3D x={x0} y={y(d.inbound)} w={barW} h={base - y(d.inbound)} dx={dx} dy={dy} color={SERIES.inbound} active={on} />
                <Bar3D x={x0 + barW + 3} y={y(d.outbound)} w={barW} h={base - y(d.outbound)} dx={dx} dy={dy} color={SERIES.outbound} active={on} />
                {(i % 2 === 0 || data.length <= 7) && (
                  <text x={padL + i * band + band / 2} y={H - 8} textAnchor="middle" fontSize="10" fill={on ? BRAND : AXIS} fontWeight={on ? 700 : 400}>
                    {label.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                  </text>
                )}
              </g>
            )
          })}
          <line x1={padL} x2={W - padR - dx} y1={base} y2={base} stroke="#C3CED5" strokeWidth={1.2} />
        </svg>
        {hover !== null && data[hover] && (
          <div
            className="absolute pointer-events-none bg-graphite text-white text-xs rounded-xl px-3 py-2 shadow-popover border border-white/10"
            style={{ left: `${((padL + hover * band + band / 2) / W) * 100}%`, top: 0, transform: 'translateX(-50%)' }}
          >
            <p className="font-bold mb-1">{new Date(data[hover].date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}</p>
            <p className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm" style={{ background: '#22A55A' }} />Inbound <b className="ml-auto pl-3 tabular-nums">{fmtNum(data[hover].inbound)}</b></p>
            <p className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm" style={{ background: '#5B8BBA' }} />Outbound <b className="ml-auto pl-3 tabular-nums">{fmtNum(data[hover].outbound)}</b></p>
          </div>
        )}
      </div>
    </div>
  )
}

export interface PipelineStage { status: string; count: number }

/** Fulfilment funnel as extruded 3D conveyor bars — value at the bar tip. */
export function PipelineBars({ data, onSelect }: { data: PipelineStage[]; onSelect?: (s: string) => void }) {
  const max = Math.max(1, ...data.map((d) => d.count))
  const labels: Record<string, string> = {
    pending: 'Awaiting confirmation', confirmed: 'Ready to pick', picking: 'Picking', picked: 'Ready to pack', packed: 'Ready to ship', shipped: 'Shipped',
  }
  return (
    <div className="space-y-2.5">
      {data.map((d) => {
        const pct = (d.count / max) * 100
        const color = d.status === 'shipped' ? '#15803D' : BRAND
        return (
          <button key={d.status} onClick={() => onSelect?.(d.status)} className="w-full group text-left" title={`${labels[d.status] ?? d.status}: ${d.count}`}>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-ink-muted font-medium group-hover:text-ink">{labels[d.status] ?? d.status}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 relative h-4">
                {/* recessed lane */}
                <div className="absolute inset-0 top-1 rounded-md bg-surface-subtle shadow-well" />
                {d.count > 0 && (
                  <div
                    className="absolute left-0 top-1 bottom-0 rounded-[4px] transition-all duration-500 group-hover:-translate-y-0.5"
                    style={{
                      width: `max(${pct}%, 10px)`,
                      background: `linear-gradient(180deg, ${shade(color, 0.18)}, ${color})`,
                      boxShadow: `inset 0 1px 0 rgba(255,255,255,.35), 2px -2px 0 ${shade(color, 0.35)}, 4px -4px 0 ${shade(color, -0.25)}, 0 6px 10px -4px ${shade(color, -0.2)}`,
                    }}
                  />
                )}
              </div>
              <span className="w-8 text-right text-xs font-bold text-ink tabular-nums">{d.count}</span>
            </div>
          </button>
        )
      })}
    </div>
  )
}

export function Meter({ value, max, label }: { value: number; max: number; label?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div className="h-3 rounded-full well overflow-hidden" role="meter" aria-valuenow={value} aria-valuemax={max} aria-label={label}>
      <div className="h-full rounded-full bg-gradient-to-b from-brand-light to-brand shadow-[inset_0_1px_0_rgba(255,255,255,.4)]" style={{ width: `${pct}%` }} />
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────
 * OccupancyCube — isometric glass container filled to `pct`
 * ──────────────────────────────────────────────────────────── */
export function OccupancyCube({ pct, size = 130 }: { pct: number; size?: number }) {
  const p = Math.max(0, Math.min(100, pct)) / 100
  const color = p > 0.9 ? '#DC2626' : p > 0.75 ? '#0F766E' : '#15803D'
  const u = 18
  const H = 4.2
  const boxes: IsoBox[] = [
    { key: 'base', x: -0.3, y: -0.3, z: -0.3, w: 3.6, d: 3.6, h: 0.3, color: '#C3CED5', top: '#D7E0E5' },
  ]
  // stacked layers so the fill reads as stacked pallets
  const layers = Math.max(0, Math.round(p * 6))
  for (let i = 0; i < layers; i++) {
    const h = (H / 6) * 0.92
    boxes.push({ key: `l${i}`, x: 0.12, y: 0.12, z: i * (H / 6), w: 2.76, d: 2.76, h, color: i === layers - 1 ? color : shade(color, -0.025 * (layers - 1 - i)) })
  }
  const glass: IsoBox = { key: 'glass', x: 0, y: 0, z: 0, w: 3, d: 3, h: H, color: '#FFFFFF', left: 'rgba(255,255,255,.28)', right: 'rgba(230,226,218,.32)', top: 'rgba(255,255,255,.35)', stroke: 'rgba(29,35,44,.35)' }
  const bb = sceneBounds([...boxes, glass], u, 4)
  return (
    <svg viewBox={`${bb.x} ${bb.y} ${bb.w} ${bb.h}`} width={size} className="drop-shadow-[0_14px_14px_rgba(29,35,44,.18)]" role="img" aria-label={`Bin occupancy ${Math.round(p * 100)}%`}>
      {boxes.map((b) => <IsoBoxShape key={b.key} b={b} u={u} />)}
      <IsoBoxShape b={glass} u={u} />
    </svg>
  )
}

/* ──────────────────────────────────────────────────────────────
 * WarehouseFloor3D — one pallet rack per site; filled slots are
 * proportional to that site's on-hand units (relative volume).
 * ──────────────────────────────────────────────────────────── */
export interface FloorSite { id: number; code: string; name: string; on_hand: number; skus: number; open_orders: number }

const KRAFT = ['#C9A27A', '#BF9566', '#D4B08A']

export function WarehouseFloor3D({ sites, selectedId, onSelect, stagingUnits = 0 }: {
  sites: FloorSite[]; selectedId?: string; onSelect?: (id: string) => void; stagingUnits?: number
}) {
  const [hover, setHover] = useState<number | null>(null)
  const u = 15
  const bays = 3, levels = 4, bayW = 2, depth = 1.6
  const rackW = bays * bayW
  const gapX = 3.4, gapY = 4.8
  const cols = Math.max(1, Math.min(4, sites.length))

  const { boxes, labels, bounds } = useMemo(() => {
    const maxOn = Math.max(1, ...sites.map((s) => s.on_hand))
    const rows = Math.max(1, Math.ceil(sites.length / cols))
    const floorW = cols * rackW + (cols - 1) * gapX + 2.4
    const floorD = rows * gapY + 2.2
    const out: IsoBox[] = [
      { key: 'floor', x: -1.2, y: -1.2, z: -0.3, w: floorW, d: floorD, h: 0.3, color: '#D5DEE3', top: '#EAF0F3', left: '#CCD6DC', right: '#B7C3CA', stroke: 'rgba(29,35,44,.1)' },
    ]
    const labels: { id: number; x: number; y: number; site: FloorSite; pct: number }[] = []
    sites.forEach((s, i) => {
      const r = Math.floor(i / cols), c = i % cols
      const x = c * (rackW + gapX), y = r * gapY
      const sel = selectedId === String(s.id)
      const hov = hover === s.id
      const share = s.on_hand / maxOn
      const nFill = s.on_hand > 0 ? Math.max(1, Math.round(share * bays * levels)) : 0
      // footprint pad (lane marking)
      out.push({ key: `pad${s.id}`, x: x - 0.4, y: y - 0.3, z: 0, w: rackW + 0.8, d: depth + 1.4, h: 0.01, color: sel ? BRAND : '#F2B705', top: sel ? 'rgba(15,118,110,.22)' : hov ? 'rgba(242,183,5,.22)' : 'rgba(242,183,5,.10)', stroke: sel ? 'rgba(15,118,110,.8)' : 'rgba(168,116,0,.35)' })
      const fills = Array.from({ length: bays * levels }, (_, k) => (k < nFill ? 0.6 + ((k * 37 + s.id * 11) % 40) / 100 : 0))
      const rack = rackBoxes({
        x, y, bays, levels, bayW, depth, fills, keyPrefix: `s${s.id}`,
        beam: sel ? BRAND : '#2D5B88',
        frame: '#3A4554',
        crate: (slot) => (sel ? (slot % 3 === 1 ? '#14A396' : BRAND) : KRAFT[(slot + s.id) % 3]),
      }).map((b) => ({
        ...b,
        onClick: () => onSelect?.(sel ? '' : String(s.id)),
        onEnter: () => setHover(s.id),
        onLeave: () => setHover(null),
        title: `${s.code} · ${s.name}`,
      }))
      out.push(...rack)
      const [lx, ly] = project(x + rackW / 2, y + depth / 2, levels * 1.5 + 0.6, u)
      labels.push({ id: s.id, x: lx, y: ly, site: s, pct: Math.round(share * 100) })
    })
    if (stagingUnits > 0) {
      const sx = -0.6, sy = rows * gapY - 1.6
      const stacks = Math.min(4, Math.max(1, Math.ceil(stagingUnits / 50)))
      for (let k = 0; k < stacks; k++) {
        out.push({ key: `sp${k}`, x: sx + k * 1.9, y: sy, z: 0, w: 1.6, d: 1.3, h: 0.16, color: '#B98552' })
        out.push({ key: `sb${k}`, x: sx + k * 1.9 + 0.1, y: sy + 0.1, z: 0.16, w: 1.4, d: 1.1, h: 0.7, color: '#F2B705' })
      }
    }
    return { boxes: out, labels, bounds: sceneBounds(out, u, 14) }
  }, [sites, selectedId, hover, cols, onSelect, stagingUnits, rackW])

  return (
    <div className="relative">
      <svg viewBox={`${bounds.x} ${bounds.y} ${bounds.w} ${bounds.h}`} className="w-full h-auto max-h-[360px] drop-shadow-[0_24px_24px_rgba(29,35,44,.16)]" role="img" aria-label="3D warehouse floor — one rack per site">
        {boxes.map((b) => <IsoBoxShape key={b.key} b={b} u={u} />)}
      </svg>
      {labels.map((l) => {
        const sel = selectedId === String(l.id)
        return (
          <button
            key={l.id}
            onClick={() => onSelect?.(sel ? '' : String(l.id))}
            onMouseEnter={() => setHover(l.id)}
            onMouseLeave={() => setHover(null)}
            className={`absolute -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-xl border px-2.5 py-1 text-left transition-all duration-150 ${
              sel ? 'bg-brand text-white border-brand-deep shadow-key-sm' : hover === l.id ? 'bg-surface text-ink border-brand/40 shadow-popover -translate-y-[calc(100%+3px)]' : 'bg-surface/95 text-ink border-border shadow-panel'
            }`}
            style={{ left: `${((l.x - bounds.x) / bounds.w) * 100}%`, top: `${((l.y - bounds.y) / bounds.h) * 100}%` }}
          >
            <span className="block text-[11px] font-bold leading-tight"><span className="font-mono">{l.site.code}</span> · {fmtCompact(l.site.on_hand)} units</span>
            <span className={`block text-[10px] leading-tight ${sel ? 'text-white/80' : 'text-ink-muted'}`}>{l.site.skus} SKUs · {l.site.open_orders} open orders</span>
          </button>
        )
      })}
    </div>
  )
}
