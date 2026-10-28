import { parse, Allow } from 'partial-json'
import type { AgentKey, AgentLane, Decision, Evidence, GrimoireHit, Manifest, Route, Trace, WraithEvent } from './types'

export interface RunState {
  runId?: string
  incident?: any
  ablate: Record<string, boolean>
  phase: 'idle' | 'routing' | 'intel' | 'deliberating' | 'deciding' | 'compiling' | 'done' | 'error'
  route?: Route | null
  branch?: string | null
  lanes: Record<AgentKey, AgentLane>
  evidence: Evidence[]
  grimoire: GrimoireHit[]
  oracle?: string | null
  sectorScores: any[]
  decision?: Decision
  counterfactual?: { action: string; confidence?: number; rationale?: string } | null
  dispatch?: any
  manifestText: string
  manifest: Manifest
  manifestDone: boolean
  manifestError?: string
  manifestMs?: number
  ttftMs?: number
  manifestModel?: string
  traces: Trace[]
  timeline: { t: number; label: string; tone: string }[]
  calls?: Record<string, number>
  totalMs?: number
  error?: string
  replay?: boolean
  startedAt?: number
}

const lane = (): AgentLane => ({ status: 'idle', tokens: '' })

export const emptyRun = (): RunState => ({
  ablate: {},
  phase: 'idle',
  lanes: { router: lane(), sentinel: lane(), archivist: lane(), verifier: lane(), commander: lane() },
  evidence: [],
  grimoire: [],
  sectorScores: [],
  manifestText: '',
  manifest: {},
  manifestDone: false,
  traces: [],
  timeline: [],
})

function tl(s: RunState, t: number | undefined, label: string, tone = 'info') {
  s.timeline = [...s.timeline, { t: t ?? 0, label, tone }]
}

function safeParse(text: string): Manifest {
  try {
    const v = parse(text, Allow.ALL)
    return v && typeof v === 'object' ? (v as Manifest) : {}
  } catch {
    return {}
  }
}

export function reduce(prev: RunState, e: WraithEvent): RunState {
  const s: RunState = { ...prev, lanes: { ...prev.lanes } }
  switch (e.type) {
    case 'run.start': {
      const fresh = emptyRun()
      fresh.runId = e.run_id
      fresh.incident = e.incident
      fresh.ablate = e.ablate || {}
      fresh.phase = 'routing'
      fresh.replay = prev.replay
      fresh.startedAt = Date.now()
      fresh.lanes.router = { status: 'thinking', tokens: '', model: e.models?.router || e.models?.swarm, knows: ['the raw incident'], blind: ['everything else'] }
      tl(fresh, e.t, 'Incident received — routing', 'info')
      return fresh
    }
    case 'route': {
      s.route = e.route
      s.branch = e.branch
      s.lanes.router = { ...s.lanes.router, status: e.route ? 'done' : 'error', brief: e.route || { error: e.error } }
      s.phase = e.route ? 'intel' : 'compiling'
      if (e.error) tl(s, e.t, e.error, 'danger')
      else tl(s, e.t, `Flow @router → ${e.branch} branch`, 'accent')
      return s
    }
    case 'intel': {
      const intel = e.intel || {}
      if (e.agent === 'verifier') s.evidence = intel.evidence || []
      if (e.agent === 'archivist') { s.grimoire = intel.grimoire || []; s.oracle = intel.oracle }
      if (e.agent === 'sentinel') s.sectorScores = intel.sector_scores || []
      tl(s, e.t, `${e.agent} tools returned`, 'info')
      return s
    }
    case 'agent.tools': {
      const k = e.agent as AgentKey
      s.lanes[k] = { ...s.lanes[k], status: 'thinking', tokens: '', tool: e.label }
      return s
    }
    case 'agent.start': {
      const k = e.agent as AgentKey
      s.lanes[k] = { status: 'thinking', tokens: '', model: e.model, knows: e.knows, blind: e.blind, tool: undefined }
      s.phase = k === 'commander' ? 'deciding' : 'deliberating'
      return s
    }
    case 'agent.token': {
      const k = e.agent as AgentKey
      const l = s.lanes[k] || lane()
      s.lanes[k] = { ...l, tokens: (l.tokens + e.delta).slice(-1600) }
      return s
    }
    case 'agent.done': {
      const k = e.agent as AgentKey
      s.lanes[k] = { ...s.lanes[k], status: e.ok ? 'done' : 'error', brief: e.brief, ms: e.ms }
      tl(s, e.t, `${k} brief in ${(e.ms / 1000).toFixed(1)}s`, e.ok ? 'ok' : 'danger')
      return s
    }
    case 'decision': {
      s.decision = e.decision
      tl(s, e.t, `Commander: ${e.decision.action.toUpperCase()} (${Math.round(e.decision.confidence * 100)}%)`, 'accent')
      return s
    }
    case 'counterfactual': {
      s.counterfactual = e.decision
      tl(s, e.t, `Without You.com the commander would say ${e.decision?.action}`, 'info')
      return s
    }
    case 'dispatch': {
      s.dispatch = { ...e.receipt, content: e.content }
      tl(s, e.t, e.receipt?.ok ? 'Dispatched through One' : 'One: dispatch pending', e.receipt?.ok ? 'ok' : 'info')
      return s
    }
    case 'manifest.start': {
      s.phase = 'compiling'
      s.manifestModel = e.model
      s.manifestText = ''
      s.manifest = {}
      tl(s, e.t, 'Interface compiler streaming', 'accent')
      return s
    }
    case 'manifest.delta': {
      s.manifestText = prev.manifestText + e.delta
      // re-parse at most on structural characters to keep it cheap
      if (/[}\]",]/.test(e.delta) || s.manifestText.length - prev.manifestText.length > 40) s.manifest = safeParse(s.manifestText)
      return s
    }
    case 'manifest.done': {
      s.manifest = e.manifest
      s.manifestDone = true
      s.manifestMs = e.ms
      s.ttftMs = e.ttft_ms
      tl(s, e.t, `Station compiled: ${e.manifest.ui_components_ordered?.length ?? 0} components`, 'ok')
      return s
    }
    case 'manifest.error': {
      s.manifestError = e.error
      s.manifestDone = true
      tl(s, e.t, e.error, 'danger')
      return s
    }
    case 'trace': {
      s.traces = [...s.traces, { partner: e.partner, op: e.op, ms: e.ms, detail: e.detail, ok: e.ok, t: e.t ?? 0 }]
      return s
    }
    case 'error': {
      s.error = e.error
      s.phase = 'error'
      tl(s, e.t, e.error, 'danger')
      return s
    }
    case 'run.done': {
      s.calls = e.calls
      s.totalMs = e.ms
      if (s.phase !== 'error') s.phase = 'done'
      if (s.manifestText && !s.manifestDone) s.manifest = safeParse(s.manifestText)
      tl(s, e.t, `Run complete in ${(e.ms / 1000).toFixed(1)}s`, 'ok')
      return s
    }
    default:
      return prev
  }
}
