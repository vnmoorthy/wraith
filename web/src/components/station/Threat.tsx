import clsx from 'clsx'
import { useEffect, useRef, useState } from 'react'
import type { ComponentSpec } from '../../lib/types'
import { Frame, Meter, fmtSector, toneColor } from './Frame'

export function ThreatHeader({ spec, building }: { spec: ComponentSpec; building?: boolean }) {
  const p = spec.props || {}
  const level = Math.max(1, Math.min(5, Number(p.threat_level) || 1))
  const hot = level >= 4
  return (
    <Frame spec={spec} building={building} span={2} className={clsx(hot && 'ring-1 ring-[var(--danger)]/40')}>
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {p.severity_tier && (
              <span className={clsx('rounded px-2 py-0.5 font-mono text-[11px] font-bold tracking-widest', hot ? 'bg-[var(--danger)]/15 text-[var(--danger)]' : 'bg-black/[0.04] text-[var(--accent)]')}>
                {hot && <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--danger)] align-middle" />}
                {p.severity_tier}
              </span>
            )}
            {p.entity && <span className="rounded bg-black/[0.04] px-2 py-0.5 font-mono text-[11px] text-bone/80">{p.entity}</span>}
            {p.incident_id && <span className="font-mono text-[11px] text-fog">#{p.incident_id}</span>}
          </div>
          <h2 className="serif text-[30px] font-medium leading-[1.1] tracking-tight text-bone md:text-[36px]">{p.headline || '…'}</h2>
        </div>
        <div className="flex shrink-0 items-end gap-6">
          <div>
            <div className="panel-title mb-1">threat level</div>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-6 w-[5px] rounded-full transition-all duration-500"
                  style={{ background: i <= level ? (level >= 4 ? 'var(--danger)' : level >= 3 ? 'var(--warn)' : 'var(--ok)') : 'var(--hair)', transitionDelay: `${i * 90}ms` }} />
              ))}
            </div>
          </div>
          {typeof p.confidence === 'number' && (
            <div className="w-28">
              <div className="panel-title mb-1">confidence</div>
              <div className="mb-1 font-mono text-xl font-bold">{Math.round(p.confidence * 100)}%</div>
              <Meter value={p.confidence} />
            </div>
          )}
        </div>
      </div>
    </Frame>
  )
}

export function EMFRadar({ spec, building }: { spec: ComponentSpec; building?: boolean }) {
  const p = spec.props || {}
  const value = Number(p.current_value) || 0
  const color = p.status === 'danger' ? 'var(--danger)' : p.status === 'warning' ? 'var(--warn)' : 'var(--ok)'
  const blips = Math.min(9, Math.max(1, Math.round(value / 14)))
  return (
    <Frame spec={spec} building={building}>
      <div className="flex items-center gap-5">
        <svg viewBox="0 0 200 200" className="h-40 w-40 shrink-0">
          <defs>
            <radialGradient id="rg" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={color} stopOpacity="0.07" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </radialGradient>
            <linearGradient id="sweep" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={color} stopOpacity="0" />
              <stop offset="100%" stopColor={color} stopOpacity="0.28" />
            </linearGradient>
          </defs>
          <circle cx="100" cy="100" r="96" fill="url(#rg)" stroke={color} strokeOpacity="0.35" />
          {[72, 48, 24].map((r) => <circle key={r} cx="100" cy="100" r={r} fill="none" stroke={color} strokeOpacity="0.18" />)}
          <line x1="4" y1="100" x2="196" y2="100" stroke={color} strokeOpacity="0.12" />
          <line x1="100" y1="4" x2="100" y2="196" stroke={color} strokeOpacity="0.12" />
          <g className="radar-sweep" style={{ animationDuration: `${Math.max(0.8, (Number(p.refresh_rate_ms) || 100) / 40)}s` }}>
            <path d="M100 100 L196 100 A96 96 0 0 0 168 32 Z" fill="url(#sweep)" />
          </g>
          {Array.from({ length: blips }).map((_, i) => {
            const a = (i * 137.5 * Math.PI) / 180
            const r = 20 + ((i * 29) % 70)
            return (
              <g key={i}>
                <circle cx={100 + Math.cos(a) * r} cy={100 + Math.sin(a) * r} r="3" fill={color} />
                <circle cx={100 + Math.cos(a) * r} cy={100 + Math.sin(a) * r} r="6" fill="none" stroke={color} className="pulse-ring" style={{ transformOrigin: `${100 + Math.cos(a) * r}px ${100 + Math.sin(a) * r}px`, animationDelay: `${i * 0.3}s` }} />
              </g>
            )
          })}
        </svg>
        <div>
          <div className="serif text-[64px] font-light leading-none tabular-nums" style={{ color }}>{value}</div>
          <div className="font-mono text-xs text-ash">milligauss · {fmtSector(p.sector)}</div>
          <div className="mt-3 flex items-center gap-2">
            <span className="serif text-[15px] italic" style={{ color }}>{p.status || '—'}</span>
            {typeof p.trend === 'number' && p.trend !== 0 && (
              <span className="font-mono text-xs" style={{ color: p.trend > 0 ? 'var(--danger)' : 'var(--ok)' }}>{p.trend > 0 ? '▲' : '▼'} {Math.abs(p.trend)} since last tick</span>
            )}
          </div>
          <div className="mt-2 font-mono text-[10px] text-fog">baseline 6 mG · refresh {p.refresh_rate_ms ?? '—'}ms</div>
        </div>
      </div>
    </Frame>
  )
}

export function StatGrid({ spec, building }: { spec: ComponentSpec; building?: boolean }) {
  const stats: any[] = spec.props?.stats || []
  return (
    <Frame spec={spec} building={building}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {stats.map((s, i) => (
          <div key={i} className="rounded-xl border border-[var(--hair)] bg-[var(--sunk)] p-3">
            <div className="panel-title truncate">{s.label}</div>
            <div className="mt-1 font-mono text-2xl font-bold tabular-nums" style={{ color: toneColor(s.tone) }}>
              {s.value}<span className="ml-1 text-xs font-normal text-ash">{s.unit}</span>
            </div>
          </div>
        ))}
      </div>
    </Frame>
  )
}

export function TelemetryChart({ spec, building }: { spec: ComponentSpec; building?: boolean }) {
  const series: any[] = spec.props?.series || []
  const colors = ['var(--danger)', 'var(--info)', 'var(--warn)', 'var(--ok)']
  return (
    <Frame spec={spec} building={building}>
      <div className="flex flex-col gap-4">
        {series.map((s, i) => {
          const vals: number[] = (s.values || []).map(Number).filter((n: number) => Number.isFinite(n))
          if (vals.length < 2) return <div key={i} className="font-mono text-xs text-fog">{s.label}: awaiting points…</div>
          const all = [...vals, Number(s.danger_threshold) || vals[0]]
          const min = Math.min(...all), max = Math.max(...all), span = max - min || 1
          const pts = vals.map((v, j) => `${(j / (vals.length - 1)) * 300},${70 - ((v - min) / span) * 60}`).join(' ')
          const ty = 70 - (((Number(s.danger_threshold) || min) - min) / span) * 60
          const c = colors[i % colors.length]
          return (
            <div key={i}>
              <div className="mb-1 flex items-baseline justify-between">
                <span className="font-mono text-[11px] text-ash">{s.label}</span>
                <span className="font-mono text-sm font-bold" style={{ color: c }}>{vals[vals.length - 1]} {s.unit}</span>
              </div>
              <svg viewBox="0 0 300 76" className="h-16 w-full" preserveAspectRatio="none">
                {s.danger_threshold != null && <line x1="0" x2="300" y1={ty} y2={ty} stroke="var(--danger)" strokeDasharray="4 4" strokeOpacity="0.5" />}
                <polyline points={`0,76 ${pts} 300,76`} fill={c} fillOpacity="0.08" stroke="none" />
                <polyline points={pts} fill="none" stroke={c} strokeWidth="2" strokeLinejoin="round"  />
              </svg>
            </div>
          )
        })}
      </div>
    </Frame>
  )
}

/** Fades a number in from 0 for the first render. */
export function useCountUp(target: number, ms = 700) {
  const [v, setV] = useState(0)
  const raf = useRef<number>(0)
  useEffect(() => {
    const t0 = performance.now()
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / ms)
      setV(target * (1 - Math.pow(1 - k, 3)))
      if (k < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [target, ms])
  return v
}
