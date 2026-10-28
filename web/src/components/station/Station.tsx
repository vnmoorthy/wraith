import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState, type ComponentType } from 'react'
import { api } from '../../lib/socket'
import { useStation } from '../../lib/station'
import { GhostMark } from '../Header'
import type { ComponentSpec } from '../../lib/types'
import { DispatchConsole } from './Dispatch'
import { IncidentSheet, VerdictBar } from './Sheet'
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
  const { run, summon } = useStation()
  const m = run.manifest
  // The verdict already lives in the docked bar; say it once.
  const comps = (m.ui_components_ordered || []).filter(ready).filter((c) => c.component !== 'DecisionCard' || !run.decision)
  const streaming = run.phase === 'compiling' && !run.manifestDone
  const theme = m.theme || 'spectral-goth-dark'
  const root = useRef<HTMLDivElement>(null)
  const touched = useRef(0)
  // Hold the verdict on the sheet for a beat before the station takes over.
  const [decidedAt, setDecidedAt] = useState<number | null>(null)
  const [, tick] = useState(0)
  useEffect(() => { setDecidedAt(run.decision ? Date.now() : null) }, [run.decision])
  const flipped = !!run.counterfactual?.action && run.counterfactual.action !== run.decision?.action
  const holdMs = HOLD_OVERRIDE || (flipped ? 7000 : 4200)
  const [released, setReleased] = useState(false)
  useEffect(() => setReleased(false), [run.runId])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.code === 'Space' && !(e.target as HTMLElement)?.closest('input,textarea')) { e.preventDefault(); setReleased(true) } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  const holding = !!decidedAt && !released && Date.now() - decidedAt < holdMs && !run.manifestDone
  useEffect(() => {
    if (!decidedAt) return
    const id = setTimeout(() => tick((n) => n + 1), holdMs + 50)
    return () => clearTimeout(id)
  }, [decidedAt, holdMs])

  // The camera follows the pen: keep the component being written in view, then pull back to the top.
  useEffect(() => {
    if (!streaming || !root.current || Date.now() - touched.current < 2500) return
    const cards = root.current.querySelectorAll('[data-card]')
    const last = cards[cards.length - 1] as HTMLElement | undefined
    last?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [comps.length, streaming])
  useEffect(() => {
    if (!run.manifestDone || !root.current) return
    const scroller = () => root.current?.closest('.overflow-auto')
    const a = setTimeout(() => scroller()?.scrollTo({ top: 0, behavior: 'smooth' }), 900)
    const b = setTimeout(() => { const el = scroller(); if (el && el.scrollTop > 0) el.scrollTop = 0 }, 2200)
    return () => { clearTimeout(a); clearTimeout(b) }
  }, [run.manifestDone])
  useEffect(() => {
    const scroller = root.current?.closest('.overflow-auto')
    const mark = () => { touched.current = Date.now() }
    scroller?.addEventListener('wheel', mark, { passive: true })
    return () => scroller?.removeEventListener('wheel', mark)
  }, [comps.length > 0, holding])

  if (run.phase === 'idle') return <Idle summon={summon} />
  if (!comps.length && run.manifestError && run.decision) return <IncidentSheet run={run} failed={run.manifestError} />
  if (!comps.length && run.manifestError) return <DeadStation error={run.manifestError} />
  if (!comps.length || holding) return <IncidentSheet run={run} written={comps.length} />

  const nextTick = async () => {
    const d = await api<any>('/api/fixtures')
    const t142 = d.fixtures.find((f: any) => f.id === 'outbreak-level-5:142')?.incident
    const t143 = d.fixtures.find((f: any) => f.id === 'outbreak-level-5:143')?.incident
    if (t143 && summon) summon({ ...t143, _previous: t142 })
  }
  const toDispatch = () => {
    touched.current = Date.now()
    root.current?.querySelector('[data-component="DispatchConsole"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
  return (
    <div ref={root} data-theme={theme} className="flex min-w-0 flex-col gap-4">
      <VerdictBar run={run} onDispatch={comps.some((c) => c.component === 'DispatchConsole') ? toDispatch : undefined} onNext={run.incident?.tick_id === 142 && summon && !run.replay ? nextTick : undefined} />
      {(m.station_title || m.summary) && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-end justify-between gap-4 px-1">
          <div className="min-w-0">
            <div className="mb-1 text-[12px] text-fog">{streaming ? 'Parasail is writing this station' : `Written for this incident by Parasail · ${comps.length} pieces`}</div>
            <h1 className="serif truncate text-[26px] font-medium tracking-tight text-bone">{cleanTitle(m.station_title)}</h1>
            {streaming && <div className="caret mt-1 max-w-[760px] truncate font-mono text-[12px] text-fog">json_schema · {run.manifestText.slice(-110)}</div>}
          </div>
          <div className="shrink-0 text-right text-[12px] tabular-nums text-ash">
            <div>{comps.length} components{streaming ? ' · writing' : ''}</div>
            {run.ttftMs != null && <div>first token {run.ttftMs} ms · {((run.manifestMs || 0) / 1000).toFixed(1)} s</div>}
          </div>
        </motion.div>
      )}
      <div className="grid grid-flow-row-dense grid-cols-1 gap-x-12 gap-y-4 xl:grid-cols-2 [&>*]:min-w-0">
        <AnimatePresence>
          {comps.map((c, i) => {
            const C = REGISTRY[c.component]
            const span2 = ['ThreatHeader', 'SectorMap', 'DispatchConsole'].includes(c.component)
            return (
              <div key={`${run.runId}-${i}-${c.component}`} data-card data-component={c.component} className={span2 ? 'xl:col-span-2 [&>section]:h-full' : '[&>section]:h-full'}>
                <C spec={c} building={streaming && i === comps.length - 1} />
              </div>
            )
          })}
        </AnimatePresence>
      </div>
    </div>
  )
}

const cleanTitle = (t?: string) => (t || '').replace(/^WRAITH\s*\/\/\s*/i, '').replace(/\s*[—-]\s*tick-\d+$/i, '')

const HOLD_OVERRIDE = Number(new URLSearchParams(location.search).get('hold')) || 0

const EXAMPLES: { label: string; incident: () => Promise<any> }[] = [
  { label: 'a level-5 phantom pinning four engineers in the coffee bar', incident: () => fixture('outbreak-level-5:142') },
  { label: 'a crowd that only looks like a haunting', incident: () => fixture('control-tick:900') },
  { label: 'a power cut during the finalist demos', incident: () => preset('loft-power') },
  { label: 'a checkout outage in us-east-1', incident: () => preset('us-east-1') },
  { label: 'wildfire smoke over a 300-person afterparty', incident: () => preset('wildfire') },
]

async function fixture(id: string) {
  const d = await api<any>('/api/fixtures')
  return d.fixtures.find((f: any) => f.id === id)?.incident
}
async function preset(id: string) {
  const d = await api<any>('/api/fixtures')
  const p = d.presets.find((x: any) => x.id === id)
  return p ? { text: p.text, source: 'reality' } : null
}

function Idle({ summon }: { summon?: (incident: any) => void }) {
  const go = async (e: (typeof EXAMPLES)[number]) => { const inc = await e.incident(); if (inc && summon) summon(inc) }
  return (
    <div className="flex h-full min-h-[560px] flex-col items-start justify-center px-10">
      <GhostMark size={52} className="text-bone" />
      <div className="mt-8 max-w-[600px]">
        <h2 className="serif text-[42px] font-normal leading-[1.08] tracking-tight text-bone">The war room that builds itself.</h2>
        <p className="serif mt-6 text-[19px] leading-[1.6] text-ash">
          Describe an incident. A swarm of agents — each seeing only part of the picture — reads it, checks the live web and
          argues it out. Then the interface you need is written for you, one component at a time, while you watch.
        </p>
        <p className="serif mt-6 text-[19px] leading-[1.75] text-bone">
          It can handle{' '}
          {EXAMPLES.map((e, i) => (
            <span key={e.label}>
              <span className={i === EXAMPLES.length - 1 ? 'whitespace-nowrap' : ''}>
                <button onClick={() => go(e)} className="underline decoration-[var(--hair-2)] decoration-1 underline-offset-4 transition hover:decoration-transparent hover:[background-image:linear-gradient(transparent_62%,var(--beige)_62%)]">{e.label}</button>
                {i < EXAMPLES.length - 2 ? ', ' : i === EXAMPLES.length - 2 ? ', or ' : '.'}
              </span>
            </span>
          ))}
        </p>
      </div>
    </div>
  )
}

function DeadStation({ error }: { error: string }) {
  return (
    <div className="flex min-h-[520px] flex-col items-center justify-center gap-4 text-center">
      <GhostMark size={44} className="text-fog" />
      <h2 className="serif text-[28px] text-[var(--danger)]">No station</h2>
      <p className="max-w-md font-mono text-[12px] text-ash">{error}</p>
    </div>
  )
}
