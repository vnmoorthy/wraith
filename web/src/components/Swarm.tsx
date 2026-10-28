import clsx from 'clsx'
import { Check, Loader2, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import type { RunState } from '../lib/run'
import { AGENT_META, SOURCE_COLORS } from '../lib/station'
import type { AgentKey } from '../lib/types'

const ORDER: AgentKey[] = ['router', 'sentinel', 'archivist', 'verifier', 'commander']

function summary(k: AgentKey, b: any): string {
  if (!b) return ''
  if (b.error) return b.error
  switch (k) {
    case 'router': return `${b.incident_class} · ${b.severity_tier} · ${b.entity_or_hazard} @ ${b.primary_sector}`
    case 'sentinel': return `${b.threat_signal} · signature ${b.signature_score} · ${b.trend} → ${b.recommends}`
    case 'archivist': return `${b.hostile ? 'hostile' : 'non-hostile'}, ${b.mobile ? 'mobile' : 'static'} · ${(b.best_countermeasures || []).slice(0, 2).join(', ')} → ${b.recommends}`
    case 'verifier': return `credibility ${b.credibility} · ${b.confirmed?.length || 0}✓ ${b.contradicted?.length || 0}✗ ${b.unverified?.length || 0}? → ${b.recommends}`
    case 'commander': return `${String(b.action).toUpperCase()} · ${Math.round((b.confidence || 0) * 100)}% · ${b.rationale}`
  }
  return ''
}

function Lane({ k, run }: { k: AgentKey; run: RunState }) {
  const l = run.lanes[k]
  const meta = AGENT_META[k]
  const color = SOURCE_COLORS[k]
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => { if (box.current) box.current.scrollTop = box.current.scrollHeight }, [l.tokens])
  const skipped = run.phase !== 'idle' && l.status === 'idle' && (run.phase === 'done' || run.phase === 'compiling')
  return (
    <div className={clsx('border-t border-[var(--hair)] py-3 transition-opacity first:border-t-0', skipped && 'opacity-35')}>
      <div className="flex items-baseline gap-2">
        <span className="h-2 w-2 shrink-0 translate-y-[-1px] rounded-full" style={{ background: l.status === 'idle' ? '#dcd8d0' : color }} />
        <span className="text-[14px] font-medium text-bone">{meta.name}</span>
        <span className="serif min-w-0 flex-1 truncate text-[12.5px] italic text-fog">{meta.role}</span>
        <span className="shrink-0 text-[11.5px] tabular-nums">
          {l.status === 'thinking' && <Loader2 size={12} className="animate-spin" style={{ color }} />}
          {l.status === 'done' && <span className="flex items-center gap-1 text-[var(--ok)]"><Check size={12} />{l.ms ? `${(l.ms / 1000).toFixed(1)}s` : ''}</span>}
          {l.status === 'error' && <X size={12} className="text-[var(--danger)]" />}
          {skipped && <span className="text-fog">not routed</span>}
        </span>
      </div>
      {(l.knows || l.blind) && l.status !== 'idle' && (
        <div className="mt-1.5 pl-4 text-[11.5px] leading-relaxed text-ash">
          <span className="text-fog">sees </span>{l.knows?.join(', ')}
          {l.blind?.length ? <><span className="text-fog"> · blind to </span><span className="line-through decoration-[#c9c5bc]">{l.blind.join(', ')}</span></> : null}
        </div>
      )}
      {l.status === 'thinking' && l.tokens && (
        <div ref={box} className="caret mt-1.5 max-h-14 overflow-hidden break-all pl-4 font-mono text-[10.5px] leading-snug text-fog">{l.tokens.slice(-220)}</div>
      )}
      {l.status === 'thinking' && !l.tokens && <div className="serif mt-1.5 pl-4 text-[13px] italic text-ash flicker">{l.tool || (k === 'router' ? 'reading the incident…' : 'thinking with partial knowledge…')}</div>}
      {(l.status === 'done' || l.status === 'error') && l.brief && (
        <div className={clsx('serif mt-1.5 pl-4 text-[14px] leading-snug', l.status === 'error' ? 'text-[var(--danger)]' : 'text-bone')}>{summary(k, l.brief)}</div>
      )}
      {l.model && l.status !== 'idle' && <div className="mt-1 pl-4 font-mono text-[10px] text-[#b5b2ab]">{l.model}</div>}
    </div>
  )
}

export function SwarmPanel({ run }: { run: RunState }) {
  return (
    <div className="panel flex flex-col px-4 pb-1 pt-3">
      <div className="flex items-baseline justify-between pb-1">
        <span className="text-[12.5px] font-medium text-ash">The swarm</span>
        {run.branch ? <span className="serif text-[13px] italic text-bone">routed to <span className="hl">{run.branch.replace('_', ' ')}</span></span> : <span className="serif text-[12.5px] italic text-fog">CrewAI Flow</span>}
      </div>
      {ORDER.map((k) => <Lane key={k} k={k} run={run} />)}
    </div>
  )
}
