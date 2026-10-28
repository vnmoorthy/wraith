import { AnimatePresence, motion } from 'motion/react'
import type { ComponentType } from 'react'
import { useStation } from '../../lib/station'
import type { ComponentSpec } from '../../lib/types'
import { DispatchConsole } from './Dispatch'
import { SectorMap } from './Map'
import { CivilianTracker, CommsDraft, CountermeasureSelector, DecisionCard, EvidenceRail, GrimoireHits, ProtocolChecklist, ResourceBoard } from './Ops'
import { EMFRadar, StatGrid, TelemetryChart, ThreatHeader } from './Threat'

const REGISTRY: Record<string, ComponentType<{ spec: ComponentSpec; building?: boolean }>> = {
  ThreatHeader, EMFRadar, SectorMap, CountermeasureSelector, CivilianTracker, TelemetryChart, EvidenceRail,
  GrimoireHits, ProtocolChecklist, DecisionCard, DispatchConsole, StatGrid, CommsDraft, ResourceBoard,
}

/** A component is renderable once its name and a props object have arrived in the stream. */
function ready(c: ComponentSpec | undefined) {
  return !!c && typeof c.component === 'string' && !!REGISTRY[c.component] && !!c.props && typeof c.props === 'object'
}

export function Station() {
  const { run } = useStation()
  const m = run.manifest
  const comps = (m.ui_components_ordered || []).filter(ready)
  const streaming = run.phase === 'compiling' && !run.manifestDone
  const theme = m.theme || 'spectral-goth-dark'

  if (run.phase === 'idle') return <Summoning idle />
  if (!comps.length && run.manifestError) return <DeadStation error={run.manifestError} />
  if (!comps.length) return <Summoning phase={run.phase} />

  return (
    <div data-theme={theme} className="flex min-w-0 flex-col gap-4">
      {(m.station_title || m.summary) && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-end justify-between gap-4 px-1">
          <div className="min-w-0">
            <div className="panel-title mb-1 accent">generated station · {theme}</div>
            <h1 className="truncate font-display text-xl font-bold text-bone">{m.station_title}</h1>
            {m.summary && <p className="mt-1 line-clamp-2 max-w-3xl text-[13px] text-ash">{m.summary}</p>}
          </div>
          <div className="shrink-0 text-right font-mono text-[10px] text-ash">
            <div>{comps.length} components{streaming ? ' · streaming' : ''}</div>
            {run.ttftMs != null && <div>first token {run.ttftMs}ms · {((run.manifestMs || 0) / 1000).toFixed(1)}s total</div>}
          </div>
        </motion.div>
      )}
      <div className="grid grid-flow-row-dense grid-cols-1 gap-4 xl:grid-cols-2 [&>*]:min-w-0">
        <AnimatePresence>
          {comps.map((c, i) => {
            const C = REGISTRY[c.component]
            return <C key={`${run.runId}-${i}-${c.component}`} spec={c} building={streaming && i === comps.length - 1} />
          })}
        </AnimatePresence>
      </div>
    </div>
  )
}

const RUNES = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ'

function Summoning({ idle, phase }: { idle?: boolean; phase?: string }) {
  const label: Record<string, string> = {
    routing: 'The Flow is routing the incident…',
    intel: 'Agents are gathering intel…',
    deliberating: 'The swarm is deliberating…',
    deciding: 'The Commander is deciding…',
    compiling: 'Compiling the interface…',
    done: 'Run finished without a station.',
    error: 'The summoning failed.',
  }
  return (
    <div className="flex h-full min-h-[520px] flex-col items-center justify-center gap-6 text-center">
      <div className="relative h-44 w-44">
        <div className="absolute inset-0 rounded-full border border-[var(--accent)]/30 radar-sweep" style={{ animationDuration: idle ? '24s' : '6s' }}>
          {RUNES.split('').map((r, i) => (
            <span key={i} className="absolute left-1/2 top-1/2 font-mono text-[12px] text-[var(--accent)]/60"
              style={{ transform: `rotate(${(i / RUNES.length) * 360}deg) translateY(-84px)` }}>{r}</span>
          ))}
        </div>
        <div className="absolute inset-6 rounded-full border border-[var(--accent)]/15" />
        <div className="absolute inset-0 flex items-center justify-center text-6xl flicker">👻</div>
      </div>
      {idle ? (
        <div className="max-w-md">
          <h2 className="font-display text-3xl font-bold text-bone glow-text">The war room that builds itself</h2>
          <p className="mt-3 text-[14px] leading-relaxed text-ash">
            Feed WRAITH an incident — a haunting from the venue feed or a real emergency in plain English. A CrewAI swarm with partial
            knowledge deliberates, and Parasail streams a bespoke, operable command station into existence, component by component.
          </p>
        </div>
      ) : (
        <div className="font-mono text-sm text-[var(--accent)] flicker">{label[phase || 'routing']}</div>
      )}
    </div>
  )
}

function DeadStation({ error }: { error: string }) {
  return (
    <div className="flex min-h-[520px] flex-col items-center justify-center gap-4 text-center">
      <div className="text-6xl grayscale">💀</div>
      <h2 className="font-display text-2xl font-bold text-[var(--danger)]">No station</h2>
      <p className="max-w-md font-mono text-[12px] text-ash">{error}</p>
    </div>
  )
}
