import clsx from 'clsx'
import { useStation } from '../../lib/station'
import type { ComponentSpec } from '../../lib/types'
import { Frame, fmtSector } from './Frame'

// Stylised vector plan of the AWS Builder Loft, 2nd floor, 525 Market St.
const LOFT: Record<string, { x: number; y: number; w: number; h: number; label: string }> = {
  entrance: { x: 8, y: 120, w: 84, h: 118, label: 'Entrance' },
  registration: { x: 96, y: 120, w: 78, h: 118, label: 'Reg desk' },
  main_stage: { x: 178, y: 8, w: 272, h: 104, label: 'Main stage' },
  lounge: { x: 178, y: 120, w: 272, h: 118, label: 'Lounge' },
  catering_coffee_bar: { x: 458, y: 70, w: 134, h: 168, label: 'Catering / coffee' },
  network_closet: { x: 528, y: 246, w: 64, h: 60, label: 'Net closet' },
  workshop_a: { x: 178, y: 246, w: 132, h: 106, label: 'Workshop A' },
  workshop_b: { x: 318, y: 246, w: 132, h: 106, label: 'Workshop B' },
  stairwell_west: { x: 8, y: 246, w: 84, h: 106, label: 'Stair W' },
  stairwell_se: { x: 458, y: 246, w: 64, h: 106, label: 'Stair SE' },
}

const STATUS: Record<string, { fill: string; stroke: string; label: string }> = {
  breached: { fill: 'rgba(251,113,133,0.22)', stroke: 'var(--danger)', label: 'breached' },
  hazard: { fill: 'rgba(251,191,36,0.16)', stroke: 'var(--warn)', label: 'hazard' },
  isolated: { fill: 'url(#hatch)', stroke: 'var(--accent)', label: 'isolated' },
  holding: { fill: 'rgba(125,211,252,0.07)', stroke: 'rgba(125,211,252,0.45)', label: 'holding' },
  clear: { fill: 'rgba(255,255,255,0.025)', stroke: 'rgba(255,255,255,0.14)', label: 'clear' },
}

function zoneStatus(id: string, p: any, isolated: string[]) {
  if (isolated.includes(id)) return 'isolated'
  if (p.highlight_sector === id) return 'breached'
  if ((p.hazard_zones || []).includes(id)) return 'hazard'
  const z = (p.zones || []).find((z: any) => z.id === id)
  return z?.status || 'clear'
}

export function SectorMap({ spec, building }: { spec: ComponentSpec; building?: boolean }) {
  const p = spec.props || {}
  const { op, setOp } = useStation()
  const isolated: string[] = Array.from(new Set([...(p.isolated_zones || []), ...op.isolated]))
  const toggle = (id: string) =>
    setOp((o) => ({ ...o, isolated: o.isolated.includes(id) ? o.isolated.filter((z) => z !== id) : [...o.isolated, id] }))
  const civilians: any[] = p.civilians || []
  const generic = p.layout === 'generic' || !Object.keys(LOFT).includes(p.highlight_sector || 'entrance')

  return (
    <Frame spec={spec} building={building} span={2}>
      {!generic ? (
        <svg viewBox="0 0 600 360" className="mx-auto block h-auto max-h-[400px] w-full max-w-[760px] select-none">
          <defs>
            <pattern id="hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="8" height="8" fill="rgba(167,139,250,0.08)" />
              <line x1="0" y1="0" x2="0" y2="8" stroke="var(--accent)" strokeOpacity="0.45" strokeWidth="2" />
            </pattern>
            <filter id="glow"><feGaussianBlur stdDeviation="4" /></filter>
          </defs>
          <rect x="2" y="2" width="596" height="356" rx="10" fill="none" stroke="rgba(255,255,255,0.08)" />
          {Object.entries(LOFT).map(([id, r]) => {
            const st = zoneStatus(id, p, isolated)
            const s = STATUS[st] || STATUS.clear
            return (
              <g key={id} onClick={() => toggle(id)} className="cursor-pointer">
                {st === 'breached' && <rect x={r.x} y={r.y} width={r.w} height={r.h} rx="8" fill="var(--danger)" opacity="0.35" filter="url(#glow)" className="animate-pulse" />}
                <rect x={r.x} y={r.y} width={r.w} height={r.h} rx="8" fill={s.fill} stroke={s.stroke} strokeWidth={st === 'clear' ? 1 : 1.6}
                  className="transition-all duration-300 hover:brightness-150" />
                <text x={r.x + 7} y={r.y + 16} fontSize={r.w < 90 ? 8.5 : 10} fill="rgba(236,231,246,0.85)" fontFamily="JetBrains Mono">{r.label}</text>
                {st !== 'clear' && <text x={r.x + 7} y={r.y + 29} fontSize="8.5" fill={s.stroke} fontFamily="JetBrains Mono" letterSpacing="1">{s.label.toUpperCase()}</text>}
              </g>
            )
          })}
          {civilians.map((c, i) => {
            const r = LOFT[c.sector]
            if (!r) return null
            const status = op.civilianOverrides[c.sector] || c.status
            const color = status === 'safe' ? 'var(--ok)' : status === 'evacuating' ? 'var(--warn)' : 'var(--bone, #ece7f6)'
            return (
              <g key={i}>
                {Array.from({ length: Math.min(12, Number(c.count) || 0) }).map((_, j) => (
                  <circle key={j} cx={r.x + 16 + (j % 6) * 13} cy={r.y + r.h - 22 + Math.floor(j / 6) * 12} r="4.2" fill={color} opacity="0.95">
                    <animate attributeName="opacity" values="1;0.4;1" dur={`${1.2 + j * 0.13}s`} repeatCount="indefinite" />
                  </circle>
                ))}
                <text x={r.x + r.w - 8} y={r.y + r.h - 10} textAnchor="end" fontSize="10" fill={color} fontFamily="JetBrains Mono">{c.count} {status}</text>
              </g>
            )
          })}
          {(p.exits || ['stairwell_west', 'stairwell_se']).map((e: string) => {
            const r = LOFT[e]
            if (!r) return null
            return <text key={e} x={r.x + r.w / 2} y={r.y + r.h / 2 + 8} textAnchor="middle" fontSize="20" fill="var(--ok)">⇲</text>
          })}
        </svg>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(p.zones || []).map((z: any) => {
            const st = zoneStatus(z.id, p, isolated)
            const s = STATUS[st] || STATUS.clear
            return (
              <button key={z.id} onClick={() => toggle(z.id)}
                className={clsx('rounded-xl border p-3 text-left transition hover:brightness-125', st === 'breached' && 'animate-pulse')}
                style={{ borderColor: s.stroke, background: st === 'isolated' ? 'rgba(167,139,250,0.1)' : s.fill }}>
                <div className="truncate font-mono text-[11px] text-bone">{z.label || fmtSector(z.id)}</div>
                <div className="mt-1 font-mono text-[10px] uppercase tracking-wider" style={{ color: s.stroke }}>{s.label}</div>
                {civilians.filter((c) => c.sector === z.id).map((c, i) => (
                  <div key={i} className="mt-1 font-mono text-[10px] text-ash">{c.count} {op.civilianOverrides[c.sector] || c.status}</div>
                ))}
              </button>
            )
          })}
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-3 font-mono text-[10px] text-ash">
        {Object.entries(STATUS).map(([k, s]) => (
          <span key={k} className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm border" style={{ borderColor: s.stroke, background: k === 'isolated' ? 'rgba(167,139,250,0.3)' : s.fill }} />{k}</span>
        ))}
        <span className="ml-auto text-fog">click a sector to isolate it · {isolated.length} isolated</span>
      </div>
    </Frame>
  )
}
