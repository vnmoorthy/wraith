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
}

const StationCtx = createContext<Ctx | null>(null)

export const emptyOp = (): OperatorState => ({ countermeasures: [], isolated: [], civilianOverrides: {}, checklist: {}, comms: null, receipts: [] })

export function StationProvider({ run, op, setOp, xray, provenance, children }: Ctx & { children: ReactNode }) {
  const value = useMemo(() => ({ run, op, setOp, xray, provenance }), [run, op, setOp, xray, provenance])
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
  router: '#c4b5fd',
  sentinel: '#7dd3fc',
  archivist: '#f0abfc',
  verifier: '#86efac',
  commander: '#fbbf24',
}

export const AGENT_META: Record<string, { name: string; glyph: string; role: string }> = {
  router: { name: 'Router', glyph: '⟁', role: 'CrewAI Flow @router · classifies & plans tools' },
  sentinel: { name: 'Sentinel', glyph: '◉', role: 'Instruments only · EMF / thermal / motion' },
  archivist: { name: 'Archivist', glyph: '✶', role: 'Grimoire retrieval · Parasail embeddings + oracle' },
  verifier: { name: 'Verifier', glyph: '⌖', role: 'Live web · You.com search + contents' },
  commander: { name: 'Commander', glyph: '♛', role: 'Sees only the briefs · decides' },
}

export const PARTNER_META: Record<string, { name: string; color: string; what: string }> = {
  parasail: { name: 'Parasail', color: '#a78bfa', what: 'inference · streaming · json_schema · embeddings' },
  youcom: { name: 'You.com', color: '#60a5fa', what: 'live web search (highlights) + contents' },
  crewai: { name: 'CrewAI', color: '#fb923c', what: 'Flow @router + partial-knowledge agents' },
  one: { name: 'One', color: '#4ade80', what: 'real actions: Discord #loft-incident' },
  scenario: { name: 'Feed', color: '#f472b6', what: 'scenario MCP: ticks, oracle, scoreboard' },
}
