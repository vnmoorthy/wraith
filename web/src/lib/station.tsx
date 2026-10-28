import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import type { RunState } from './run'

/** What the operator has done on the generated station. The dispatch payload is built from this. */
export interface OperatorState {
  countermeasures: string[]
  isolated: string[]
  civilianOverrides: Record<string, string>
  checklist: Record<number, boolean>
  comms: string | null
  receipts: any[]
}

interface Ctx {
  run: RunState
  op: OperatorState
  setOp: (fn: (o: OperatorState) => OperatorState) => void
  xray: boolean
  provenance: boolean
  summon?: (incident: any) => void
}

const StationCtx = createContext<Ctx | null>(null)

export const emptyOp = (): OperatorState => ({ countermeasures: [], isolated: [], civilianOverrides: {}, checklist: {}, comms: null, receipts: [] })

export function StationProvider({ run, op, setOp, xray, provenance, summon, children }: Ctx & { children: ReactNode }) {
  const value = useMemo(() => ({ run, op, setOp, xray, provenance, summon }), [run, op, setOp, xray, provenance, summon])
  return <StationCtx.Provider value={value}>{children}</StationCtx.Provider>
}

export function useStation() {
  const c = useContext(StationCtx)
  if (!c) throw new Error('useStation outside provider')
  return c
}

export function useOperator() {
  const [op, setOpRaw] = useState<OperatorState>(emptyOp())
  const setOp = (fn: (o: OperatorState) => OperatorState) => setOpRaw((o) => fn(o))
  return { op, setOp, reset: () => setOpRaw(emptyOp()) }
}

export const SOURCE_COLORS: Record<string, string> = {
  router: '#8a6f4d',
  sentinel: '#2b4e86',
  archivist: '#7a3e6e',
  verifier: '#2d6a4a',
  commander: '#a2650d',
}

export const AGENT_META: Record<string, { name: string; glyph: string; role: string }> = {
  router: { name: 'Router', glyph: '⟁', role: 'CrewAI Flow @router · classifies & plans tools' },
  sentinel: { name: 'Sentinel', glyph: '◉', role: 'Instruments only · EMF / thermal / motion' },
  archivist: { name: 'Archivist', glyph: '✶', role: 'Grimoire retrieval · Parasail embeddings + oracle' },
  verifier: { name: 'Verifier', glyph: '⌖', role: 'Live web · You.com search + contents' },
  commander: { name: 'Commander', glyph: '♛', role: 'Sees only the briefs · decides' },
}

export const PARTNER_META: Record<string, { name: string; color: string; what: string }> = {
  parasail: { name: 'Parasail', color: '#6d4fc2', what: 'inference · streaming · json_schema · embeddings' },
  youcom: { name: 'You.com', color: '#2b4e86', what: 'live web search (highlights) + contents' },
  crewai: { name: 'CrewAI', color: '#c25a1c', what: 'Flow @router + partial-knowledge agents' },
  one: { name: 'One', color: '#2d6a4a', what: 'real actions: Discord #loft-incident' },
  scenario: { name: 'Feed', color: '#a33a6b', what: 'scenario MCP: ticks, oracle, scoreboard' },
}
