export type AgentKey = 'router' | 'sentinel' | 'archivist' | 'verifier' | 'commander'
export type Partner = 'youcom' | 'parasail' | 'crewai' | 'one' | 'scenario'

export interface Route {
  incident_class: 'haunting' | 'real_world' | 'control'
  headline: string
  severity_tier: string
  primary_sector: string
  entity_or_hazard: string
  civilians_at_risk: number
  civilian_status: string
  key_claims: string[]
  verification_queries: string[]
  lore_query: string
}

export interface Evidence {
  id: number
  kind: string
  title: string
  url: string
  description: string
  snippets: string[]
  page_age?: string
  favicon?: string
  excerpt?: string
  query?: string
}

export interface GrimoireHit {
  id: string
  kind: string
  title: string
  text: string
  efficacy: number
  similarity: number
  applies_to: string[]
}

export interface Decision {
  action: 'contain' | 'evacuate' | 'observe'
  confidence: number
  threat_level: number
  priority_sector: string
  rationale: string
  countermeasures: string[]
  dissent: string
  escalate: boolean
  civilians_plan: string
}

export interface AgentLane {
  status: 'idle' | 'thinking' | 'done' | 'error'
  model?: string
  knows?: string[]
  blind?: string[]
  tokens: string
  brief?: Record<string, unknown>
  ms?: number
  tool?: string
}

export interface Trace { partner: Partner; op: string; ms: number; detail: string; ok: boolean; t: number }

export interface ComponentSpec {
  component: string
  title?: string
  source?: AgentKey
  why?: string
  props?: Record<string, any>
}

export interface Manifest {
  station_title?: string
  theme?: string
  threat_level?: number
  summary?: string
  ui_components_ordered?: ComponentSpec[]
}

export interface WraithEvent { type: string; t?: number; run_id?: string; [k: string]: any }
