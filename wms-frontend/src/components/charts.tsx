import { useState } from 'react'
import { fmtCompact, fmtNum } from '../lib/errors'

/* Validated categorical pair (light surface): teal = inbound, blue = outbound. */
export const SERIES = { inbound: '#0F9F8C', outbound: '#2563EB' }

function niceMax(v: number) {
  if (v <= 0) return 10
  const pow = 10 ** Math.floor(Math.log10(v))
  const n = v / pow
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10
  return step * pow
}

/** Rounded-top column path anchored square at the baseline. */
function colPath(x: number, y: number, w: number, h: number, r = 4) {
  if (h <= 0) return ''
  const rr = Math.min(r, w / 2, h)
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`
}

export interface ThroughputPoint { date: string; inbound: number; outbound: number }

export function ThroughputChart({ data }: { data: ThroughputPoint[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const W = 720, H = 240, padL = 44, padR = 8, padT = 12, padB = 28
  const innerW = W - padL - padR, innerH = H - padT - padB
  const max = niceMax(Math.max(1, ...data.flatMap((d) => [d.inbound, d.outbound])))
  const band = innerW / Math.max(1, data.length)
  const barW = Math.min(14, (band - 8) / 2)
  const y = (v: number) => padT + innerH - (v / max) * innerH
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max)
  const totalIn = data.reduce((s, d) => s + d.inbound, 0)
  const totalOut = data.reduce((s, d) => s + d.outbound, 0)

  return (
    <div>
      <div className="flex items-center gap-5 mb-3 text-xs text-ink-muted">
        <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: SERIES.inbound }} /> Inbound <b className="text-ink tabular-nums">{fmtNum(totalIn)}</b></span>
        <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: SERIES.outbound }} /> Outbound <b className="text-ink tabular-nums">{fmtNum(totalOut)}</b></span>
        <span className="ml-auto">units · last 14 days</span>
      </div>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Inbound and outbound units per day">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="#E6ECF2" strokeWidth={1} />
              <text x={padL - 8} y={y(t) + 3.5} textAnchor="end" fontSize="10" fill="#94A3B8">{fmtCompact(t)}</text>
            </g>
          ))}
          {data.map((d, i) => {
            const x0 = padL + i * band + (band - (barW * 2 + 2)) / 2
            const label = new Date(d.date + 'T00:00:00')
            return (
              <g key={d.date} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                <rect x={padL + i * band} y={padT} width={band} height={innerH} fill={hover === i ? '#F1F5F9' : 'transparent'} />
                <path d={colPath(x0, y(d.inbound), barW, padT + innerH - y(d.inbound))} fill={SERIES.inbound} />
                <path d={colPath(x0 + barW + 2, y(d.outbound), barW, padT + innerH - y(d.outbound))} fill={SERIES.outbound} />
                {(i % 2 === 0 || data.length <= 7) && (
                  <text x={padL + i * band + band / 2} y={H - 8} textAnchor="middle" fontSize="10" fill="#94A3B8">
                    {label.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                  </text>
                )}
              </g>
            )
          })}
          <line x1={padL} x2={W - padR} y1={padT + innerH} y2={padT + innerH} stroke="#CBD5E1" strokeWidth={1} />
        </svg>
        {hover !== null && data[hover] && (
          <div
            className="absolute pointer-events-none bg-ink text-white text-xs rounded-lg px-3 py-2 shadow-popover"
            style={{ left: `${((padL + hover * band + band / 2) / W) * 100}%`, top: 0, transform: 'translateX(-50%)' }}
          >
            <p className="font-semibold mb-1">{new Date(data[hover].date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}</p>
            <p className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm" style={{ background: SERIES.inbound }} />Inbound <b className="ml-auto pl-3 tabular-nums">{fmtNum(data[hover].inbound)}</b></p>
            <p className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm" style={{ background: SERIES.outbound }} />Outbound <b className="ml-auto pl-3 tabular-nums">{fmtNum(data[hover].outbound)}</b></p>
          </div>
        )}
      </div>
    </div>
  )
}

export interface PipelineStage { status: string; count: number }

/** Horizontal fulfilment funnel – single series, value at the bar tip. */
export function PipelineBars({ data, onSelect }: { data: PipelineStage[]; onSelect?: (s: string) => void }) {
  const max = Math.max(1, ...data.map((d) => d.count))
  const labels: Record<string, string> = {
    pending: 'Awaiting confirmation', confirmed: 'Ready to pick', picking: 'Picking', picked: 'Ready to pack', packed: 'Ready to ship', shipped: 'Shipped',
  }
  return (
    <div className="space-y-2.5">
      {data.map((d) => (
        <button key={d.status} onClick={() => onSelect?.(d.status)} className="w-full group text-left" title={`${labels[d.status] ?? d.status}: ${d.count}`}>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-ink-muted group-hover:text-ink">{labels[d.status] ?? d.status}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-3 rounded-r bg-surface-subtle overflow-hidden">
              <div className="h-full rounded-r transition-all" style={{ width: `${(d.count / max) * 100}%`, background: d.status === 'shipped' ? '#0F9F8C' : '#2563EB', minWidth: d.count > 0 ? 4 : 0 }} />
            </div>
            <span className="w-8 text-right text-xs font-semibold text-ink tabular-nums">{d.count}</span>
          </div>
        </button>
      ))}
    </div>
  )
}

export function Meter({ value, max, label }: { value: number; max: number; label?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div>
      <div className="h-2 rounded-full bg-surface-subtle overflow-hidden" role="meter" aria-valuenow={value} aria-valuemax={max} aria-label={label}>
        <div className="h-full rounded-full bg-gradient-to-r from-blue to-mint" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
