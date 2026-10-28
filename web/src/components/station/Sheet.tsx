import clsx from 'clsx'
import { parse, Allow } from 'partial-json'
import { useEffect, useState } from 'react'
import type { RunState } from '../../lib/run'
import { SOURCE_COLORS } from '../../lib/station'
import type { AgentKey } from '../../lib/types'

const SCOUTS: { key: AgentKey; name: string; field: string; tool: string }[] = [
  { key: 'sentinel', name: 'Sentinel', field: 'reading', tool: 'instruments' },
  { key: 'archivist', name: 'Archivist', field: 'doctrine', tool: 'grimoire · BGE-M3' },
  { key: 'verifier', name: 'Verifier', field: 'note', tool: 'live web · You.com' },
]

const PHASES = [
  ['routing', 'Read'], ['intel', 'Gather'], ['deliberating', 'Deliberate'], ['deciding', 'Decide'], ['compiling', 'Compose'],
] as const

const ACTION_COLOR: Record<string, string> = { evacuate: 'var(--danger)', contain: 'var(--warn)', observe: 'var(--ok)' }
const cap = (s?: string) => (s ? s[0].toUpperCase() + s.slice(1) : '')

/** What an agent has written so far, parsed from its partial JSON stream. */
function partialBrief(run: RunState, k: AgentKey): Record<string, any> {
  const l = run.lanes[k]
  if (l.brief && !('error' in l.brief)) return l.brief as Record<string, any>
  if (!l.tokens) return {}
  try {
    const v = parse(l.tokens, Allow.ALL)
    return v && typeof v === 'object' ? v : {}
  } catch {
    return {}
  }
}

/** How the commander's call relates to the three votes. */
export function resolution(run: RunState): string {
  const d = run.decision
  if (!d) return ''
  const votes = SCOUTS.map((s) => partialBrief(run, s.key).recommends).filter(Boolean) as string[]
  if (!votes.length) return 'Decided on the briefs it had.'
  const tally: Record<string, number> = {}
  votes.forEach((v) => { tally[v] = (tally[v] || 0) + 1 })
  const top = Object.entries(tally).sort((a, b) => b[1] - a[1])
  if (top.length === 1) return top[0][0] === d.action ? `Unanimous — all ${votes.length} agents said ${top[0][0]}.` : `Overruled a unanimous ${top[0][0]}.`
  if (top.length === votes.length && votes.length === 3) return `Three agents, three answers — the commander broke the tie.`
  if (top[0][0] === d.action) return `Sided with the ${top[0][1]}–${votes.length - top[0][1]} majority.`
  return `Overruled the ${top[0][1]}–${votes.length - top[0][1]} majority.`
}

function useClock(run: RunState) {
  const [now, setNow] = useState(Date.now())
  const running = run.phase !== 'idle' && run.phase !== 'done' && run.phase !== 'error'
  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setNow(Date.now()), 100)
    return () => clearInterval(id)
  }, [running])
  if (run.totalMs) return run.totalMs / 1000
  return run.startedAt ? (now - run.startedAt) / 1000 : 0
}

function Counterfactual({ run, compact }: { run: RunState; compact?: boolean }) {
  const d = run.decision
  const alt = run.counterfactual
  if (!d || !alt?.action) return null
  const changed = alt.action !== d.action
  return (
    <div className={clsx('serif text-ash', compact ? 'text-[13.5px]' : 'text-[16px]')}>
      Without the live web, the commander would have said{' '}
      <span style={{ color: ACTION_COLOR[alt.action] }}>{alt.action}</span>
      {typeof alt.confidence === 'number' && <> ({Math.round(alt.confidence * 100)}%)</>}.{' '}
      {changed ? <span className="hl text-bone">You.com changed the decision.</span> : <span>You.com {d.confidence > (alt.confidence ?? 0) ? 'raised its confidence' : 'confirmed it'}.</span>}
    </div>
  )
}

export function IncidentSheet({ run }: { run: RunState }) {
  const t = useClock(run)
  const route = run.route
  const d = run.decision
  const incident = run.incident?.raw_incident_stream || run.incident?.text || (run.incident?.sector_reports
    ? run.incident.sector_reports.map((r: any) => `${r.sector.replace(/_/g, ' ')}: ${r.containment_state}, ${r.civilian_status}, EMF ${r.sensors?.emf_milligauss} mG, ${r.sensors?.temp_c}°C${r.sighting ? `, ${r.sighting.entity_class} at ${Math.round(r.sighting.confidence * 100)}%` : ''}`).join('. ')
    : '')
  const phaseIdx = PHASES.findIndex(([p]) => p === run.phase)
  const youcomCalls = run.traces.filter((x) => x.partner === 'youcom').length
  return (
    <div className="mx-auto max-w-[980px] px-2 pb-16 pt-4">
      <div className="flex items-baseline justify-between">
        <div className="flex items-baseline gap-5 text-[13px]">
          {PHASES.map(([p, label], i) => (
            <span key={p} className={clsx('transition-colors', i === phaseIdx ? 'hl text-bone' : i < phaseIdx || run.phase === 'done' ? 'text-ash' : 'text-[#c8c5be]')}>{label}</span>
          ))}
        </div>
        <span className="serif text-[34px] font-light tabular-nums text-bone">{t.toFixed(1)}<span className="text-[18px] text-fog">s</span></span>
      </div>

      {!route && <p className={clsx('serif mt-8 text-[22px] leading-[1.5] text-bone', run.phase === 'routing' && 'hl hl-anim')}>{incident}</p>}
      {route && (
        <div className="mt-6">
          <h2 className="serif text-[42px] font-normal leading-[1.08] tracking-tight text-bone">{route.headline}</h2>
          <div className="mt-3 text-[13.5px] text-ash">
            Routed to <span className="hl text-bone">{route.incident_class.replace('_', ' ')}</span> · {route.severity_tier.replace('_', ' ').toLowerCase()} · {route.primary_sector.replace(/_/g, ' ')}
            {route.civilians_at_risk > 0 && <> · <span style={{ color: 'var(--danger)' }}>{route.civilians_at_risk} people at risk</span></>}
          </div>
        </div>
      )}

      {route && (
        <div className="mt-10 grid grid-cols-3 gap-8">
          {SCOUTS.map(({ key, name, field, tool }) => {
            const lane = run.lanes[key]
            const b = partialBrief(run, key)
            const color = SOURCE_COLORS[key]
            const skipped = run.branch === 'control' && key === 'verifier'
            const sentence = b[field] || b.reading || b.note || b.doctrine || ''
            return (
              <div key={key} className={clsx('border-t pt-4', skipped && 'opacity-35')} style={{ borderColor: lane.status === 'idle' ? 'var(--hair)' : color }}>
                <div className="flex items-baseline justify-between">
                  <span className="text-[15px] font-medium text-bone">{name}</span>
                  <span className="serif text-[12.5px] italic text-fog">{tool}</span>
                </div>
                <div className="mt-1 text-[12px] text-fog">
                  {lane.knows ? <>sees {lane.knows.slice(0, 2).join(', ')} · <span className="line-through decoration-[#c9c5bc]">{(lane.blind || []).slice(0, 2).join(', ')}</span></> : skipped ? 'not consulted on a control event' : ' '}
                </div>
                <div className="serif mt-3 min-h-[96px] text-[16.5px] leading-[1.45] text-bone">
                  {sentence ? <span className={clsx(lane.status === 'thinking' && 'caret')}>{sentence}</span>
                    : <span className="italic text-fog flicker">{skipped ? '' : lane.tool || (lane.status === 'thinking' ? 'thinking with partial knowledge…' : 'waiting for its tools…')}</span>}
                </div>
                {key === 'verifier' && youcomCalls > 0 && <div className="mt-2 text-[11.5px] text-fog">{youcomCalls} You.com calls · {run.evidence.length} sources</div>}
                {key === 'archivist' && run.grimoire.length > 0 && <div className="mt-2 text-[11.5px] text-fog">{run.grimoire.length} grimoire hits · top {run.grimoire[0]?.similarity?.toFixed(2)}</div>}
                {key === 'sentinel' && run.sectorScores.length > 0 && <div className="mt-2 text-[11.5px] text-fog">signature {run.sectorScores[0]?.signature_score} · {run.sectorScores[0]?.verdict}</div>}
                <div className="mt-3 h-7">
                  {b.recommends && <span className="serif text-[22px] italic" style={{ color: ACTION_COLOR[b.recommends] }}>{b.recommends}</span>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {route && (
        <div className="mt-10 border-t border-[var(--ink)] pt-5">
          <div className="flex items-baseline justify-between">
            <span className="text-[15px] font-medium text-bone">Commander</span>
            <span className="serif text-[12.5px] italic text-fog">sees only the three briefs</span>
          </div>
          {!d ? (
            <div className="serif mt-4 text-[22px] italic text-fog flicker">{run.lanes.commander.status === 'thinking' ? 'weighing the briefs under doctrine…' : 'waiting for the briefs…'}</div>
          ) : (
            <div className="mt-3">
              <div className="flex items-baseline gap-5">
                <span className="serif text-[76px] font-normal italic leading-none" style={{ color: ACTION_COLOR[d.action] }}>
                  <span className="hl hl-anim">{cap(d.action)}.</span>
                </span>
                <span className="text-[14px] text-ash">{Math.round(d.confidence * 100)}% confidence · threat {d.threat_level}/5</span>
              </div>
              <p className="serif mt-4 text-[20px] leading-snug text-bone">{d.rationale}</p>
              <p className="serif mt-2 text-[16px] italic text-ash">{resolution(run)} {d.dissent}</p>
              <div className="mt-3"><Counterfactual run={run} /></div>
            </div>
          )}
        </div>
      )}

      {run.phase === 'compiling' && <div className="serif mt-10 text-[20px] italic text-ash">Composing the interface for this incident<span className="caret" /></div>}
    </div>
  )
}

/** Once the station starts assembling, the verdict docks above it. */
export function VerdictBar({ run, onDispatch }: { run: RunState; onDispatch: () => void }) {
  const d = run.decision
  if (!d) return null
  return (
    <div className="sticky top-0 z-10 -mx-1 mb-4 border-b border-[var(--hair)] bg-white/95 px-1 pb-3 pt-1 backdrop-blur">
      <div className="flex items-end gap-6">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-3">
            <span className="serif text-[40px] italic leading-none" style={{ color: ACTION_COLOR[d.action] }}>{cap(d.action)}.</span>
            <span className="text-[13px] text-ash">{Math.round(d.confidence * 100)}% · threat {d.threat_level}/5 · {d.priority_sector.replace(/_/g, ' ')}</span>
          </div>
          <p className="serif mt-1.5 truncate text-[16px] text-bone">{d.rationale}</p>
          <div className="mt-0.5 truncate"><span className="serif text-[13.5px] italic text-ash">{resolution(run)}</span> <Counterfactual run={run} compact /></div>
        </div>
        {d.escalate !== false && (
          <button onClick={onDispatch} className="shrink-0 rounded-lg bg-[var(--ink)] px-4 py-2.5 text-[14px] font-medium text-white hover:bg-black">Dispatch ↓</button>
        )}
      </div>
    </div>
  )
}
