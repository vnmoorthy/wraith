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
    <div className={clsx('rounded-xl border p-2.5 transition-all', l.status === 'thinking' ? 'border-white/15 bg-white/[0.03]' : 'border-white/5 bg-white/[0.012]', skipped && 'opacity-40')}
      style={l.status === 'thinking' ? { boxShadow: `0 0 28px -12px ${color}` } : undefined}>
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-lg text-[13px]" style={{ background: `${color}18`, color }}>{meta.glyph}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[12.5px] font-semibold text-bone">{meta.name}</span>
            {l.model && <span className="truncate font-mono text-[9px] text-fog">{l.model}</span>}
          </div>
          <div className="truncate font-mono text-[9.5px] text-ash">{meta.role}</div>
        </div>
        <span className="shrink-0">
          {l.status === 'thinking' && <Loader2 size={13} className="animate-spin" style={{ color }} />}
          {l.status === 'done' && <span className="flex items-center gap-1 font-mono text-[9.5px] text-[var(--ok)]"><Check size={12} />{l.ms ? `${(l.ms / 1000).toFixed(1)}s` : ''}</span>}
          {l.status === 'error' && <X size={13} className="text-[var(--danger)]" />}
          {skipped && <span className="font-mono text-[9px] text-fog">not routed</span>}
        </span>
      </div>
      {(l.knows || l.blind) && l.status !== 'idle' && (
        <div className="mt-2 flex flex-wrap gap-1">
          {l.knows?.map((x) => <span key={x} className="rounded px-1.5 py-0.5 font-mono text-[9px]" style={{ background: `${color}14`, color }}>{x}</span>)}
          {l.blind?.map((x) => <span key={x} className="rounded bg-white/[0.03] px-1.5 py-0.5 font-mono text-[9px] text-fog line-through decoration-fog/60">{x}</span>)}
        </div>
      )}
      {l.status === 'thinking' && l.tokens && (
        <div ref={box} className="caret mt-2 max-h-16 overflow-hidden break-all font-mono text-[10px] leading-snug text-ash">{l.tokens.slice(-260)}</div>
      )}
      {l.status === 'thinking' && !l.tokens && <div className="mt-2 font-mono text-[10px] text-fog flicker">{l.tool || (k === 'router' ? 'classifying…' : 'thinking with partial knowledge…')}</div>}
      {(l.status === 'done' || l.status === 'error') && l.brief && (
        <div className={clsx('mt-2 text-[11px] leading-snug', l.status === 'error' ? 'text-[var(--danger)]' : 'text-bone/85')}>{summary(k, l.brief)}</div>
      )}
    </div>
  )
}

export function SwarmPanel({ run }: { run: RunState }) {
  return (
    <div className="panel flex flex-col gap-2 p-3">
      <div className="flex items-center justify-between">
        <span className="panel-title">the swarm · crewai flow</span>
        {run.branch && <span className="rounded bg-[var(--accent)]/12 px-1.5 py-0.5 font-mono text-[9.5px] text-[var(--accent)]">branch: {run.branch}</span>}
      </div>
      {ORDER.map((k) => <Lane key={k} k={k} run={run} />)}
    </div>
  )
}
