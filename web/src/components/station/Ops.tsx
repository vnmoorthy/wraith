import clsx from 'clsx'
import { Check, ExternalLink, Minus, Plus, ShieldCheck, ShieldAlert, ShieldQuestion, Copy } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useStation } from '../../lib/station'
import type { ComponentSpec } from '../../lib/types'
import { Frame, Meter, fmtSector } from './Frame'

export function CountermeasureSelector({ spec, building }: { spec: ComponentSpec; building?: boolean }) {
  const p = spec.props || {}
  const { op, setOp, run } = useStation()
  const max = Math.max(1, Number(p.max_select) || 2)
  const options: any[] = p.options || []
  // Start armed with what the Commander chose, so the selector and the dispatch payload always agree.
  const seeded = useRef(false)
  useEffect(() => {
    if (seeded.current || building || !options.length) return
    seeded.current = true
    const ids = new Set(options.map((o) => o.id))
    const pick = (run.decision?.countermeasures || []).filter((id) => ids.has(id))
    const fallback = options.filter((o) => o.recommended).map((o) => o.id)
    const initial = (pick.length ? pick : fallback).slice(0, max)
    if (initial.length) setOp((o) => (o.countermeasures.length ? o : { ...o, countermeasures: initial }))
  }, [building, options.length, run.decision, max, setOp])
  const pick = (id: string) =>
    setOp((o) => {
      const has = o.countermeasures.includes(id)
      const next = has ? o.countermeasures.filter((x) => x !== id) : [...o.countermeasures, id].slice(-max)
      return { ...o, countermeasures: next }
    })
  return (
    <Frame spec={spec} building={building}>
      <div className="mb-3 flex items-center justify-between font-mono text-[11px]">
        <span className="text-ash">target: <span className="text-bone">{p.target_entity || '—'}</span></span>
        <span className={clsx(op.countermeasures.length ? 'text-[var(--ok)]' : 'text-fog')}>armed {op.countermeasures.length}/{max}</span>
      </div>
      <div className="flex flex-col gap-2">
        {options.map((o) => {
          const on = op.countermeasures.includes(o.id)
          const hit = run.grimoire.find((g) => g.id === o.id)
          return (
            <button key={o.id} onClick={() => pick(o.id)}
              className={clsx('group rounded-xl border p-3 text-left transition-all',
                on ? 'border-[var(--ok)] bg-[var(--ok)]/10 ' : 'border-[var(--hair)] bg-[var(--sunk)] hover:border-[var(--hair-2)]')}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className={clsx('flex h-4 w-4 items-center justify-center rounded border', on ? 'border-[var(--ok)] bg-[var(--ok)] text-white' : 'border-[var(--hair-2)]')}>{on && <Check size={11} strokeWidth={3} />}</span>
                  <span className="text-sm font-semibold text-bone">{o.label || o.id}</span>
                  {o.recommended && <span className="rounded bg-[var(--beige)] px-1.5 py-0.5 font-mono text-[9px] uppercase text-[var(--accent)]">recommended</span>}
                </div>
                <span className="font-mono text-xs text-ash">{Math.round((Number(o.efficacy) || 0) * 100)}%</span>
              </div>
              <div className="mt-2"><Meter value={Number(o.efficacy) || 0} color={on ? 'var(--ok)' : 'var(--accent)'} height={4} /></div>
              {(o.note || hit) && <div className="mt-2 text-[11.5px] leading-snug text-ash">{o.note || hit?.text}</div>}
            </button>
          )
        })}
      </div>
    </Frame>
  )
}

const CIV_FLOW: Record<string, string> = { pinned: 'evacuating', sheltering: 'evacuating', unknown: 'evacuating', evacuating: 'safe', safe: 'safe' }

export function CivilianTracker({ spec, building }: { spec: ComponentSpec; building?: boolean }) {
  const p = spec.props || {}
  const { op, setOp } = useStation()
  const groups: any[] = p.groups || []
  const statusOf = (g: any) => op.civilianOverrides[g.sector] || g.status
  const total = groups.reduce((a, g) => a + (Number(g.count) || 0), 0)
  const safe = groups.filter((g) => statusOf(g) === 'safe').reduce((a, g) => a + (Number(g.count) || 0), 0)
  const color = (s: string) => ({ pinned: 'var(--danger)', sheltering: 'var(--warn)', evacuating: 'var(--warn)', safe: 'var(--ok)' } as any)[s] || 'var(--ash)'
  return (
    <Frame spec={spec} building={building}>
      <div className="mb-3 flex items-end justify-between">
        <div>
          <div className="font-mono text-3xl font-bold tabular-nums text-bone">{safe}<span className="text-base text-ash">/{total}</span></div>
          <div className="panel-title">civilians safe</div>
        </div>
        <div className="w-32"><Meter value={total ? safe / total : 0} color="var(--ok)" /></div>
      </div>
      <div className="flex flex-col gap-2">
        {groups.map((g, i) => {
          const s = statusOf(g)
          return (
            <div key={i} className="flex items-center justify-between gap-2 rounded-lg border border-[var(--hair)] bg-[var(--sunk)] px-3 py-2">
              <div className="min-w-0">
                <div className="truncate text-sm text-bone">{g.count} · {g.label}</div>
                <div className="font-mono text-[10px] text-ash">{fmtSector(g.sector)}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] font-bold uppercase" style={{ color: color(s) }}>{s}</span>
                {s !== 'safe' && (
                  <button onClick={() => setOp((o) => ({ ...o, civilianOverrides: { ...o.civilianOverrides, [g.sector]: CIV_FLOW[s] || 'safe' } }))}
                    className="rounded-md border border-[var(--hair-2)] px-2 py-1 font-mono text-[10px] text-bone hover:border-[var(--accent)] hover:text-[var(--accent)]">
                    {s === 'evacuating' ? 'mark safe' : 'begin evac'}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
      {p.evac_route && <div className="mt-3 rounded-lg bg-[var(--ok)]/5 px-3 py-2 font-mono text-[11px] text-[var(--ok)]">⇲ {p.evac_route}</div>}
    </Frame>
  )
}

const VERDICT = {
  confirmed: { icon: ShieldCheck, color: 'var(--ok)' },
  contradicted: { icon: ShieldAlert, color: 'var(--danger)' },
  unverified: { icon: ShieldQuestion, color: 'var(--warn)' },
} as const

const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, '') } catch { return u } }

export function EvidenceRail({ spec, building }: { spec: ComponentSpec; building?: boolean }) {
  const { run } = useStation()
  const claims: any[] = spec.props?.claims || []
  return (
    <Frame spec={spec} building={building}>
      <div className="mb-3 flex items-center justify-between font-mono text-[10px] text-ash">
        <span>grounded by <span className="text-[var(--info)]">You.com</span> · search highlights + contents</span>
        <span>{run.evidence.length} sources</span>
      </div>
      {run.evidence.length === 0 && <div className="rounded-lg border border-dashed border-[var(--hair-2)] p-3 text-xs text-fog">No live evidence. Severity is unverified.</div>}
      <div className="flex flex-col gap-3">
        {claims.map((c, i) => {
          const v = (VERDICT as any)[c.verdict] || VERDICT.unverified
          const Icon = v.icon
          const ev = (c.evidence_ids || []).map((id: number) => run.evidence.find((e) => e.id === id)).filter(Boolean)
          return (
            <div key={i} className="rounded-xl border border-[var(--hair)] bg-[var(--sunk)] p-3">
              <div className="flex items-start gap-2">
                <Icon size={16} style={{ color: v.color }} className="mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] leading-snug text-bone">{c.claim}</div>
                  <div className="mt-0.5 font-mono text-[10px] font-bold uppercase" style={{ color: v.color }}>{c.verdict}</div>
                </div>
              </div>
              {ev.map((e: any) => (
                <a key={e.id} href={e.url} target="_blank" rel="noreferrer" className="mt-2 block rounded-lg border border-[var(--hair)] bg-[var(--sunk)] p-2 transition hover:border-[var(--hair-2)]">
                  <div className="flex items-center gap-1.5 font-mono text-[10px] text-[var(--info)]">
                    <span className="rounded bg-[var(--sunk)] px-1">[{e.id}]</span>{host(e.url)}<ExternalLink size={10} />
                    {e.page_age && <span className="ml-auto text-fog">{String(e.page_age).slice(0, 10)}</span>}
                  </div>
                  <div className="mt-1 truncate text-[12px] text-bone/90">{e.title}</div>
                  {(e.snippets?.[0] || e.description) && <div className="mt-1 line-clamp-2 text-[11px] italic leading-snug text-ash">“{e.snippets?.[0] || e.description}”</div>}
                </a>
              ))}
            </div>
          )
        })}
      </div>
    </Frame>
  )
}

export function GrimoireHits({ spec, building }: { spec: ComponentSpec; building?: boolean }) {
  const { run } = useStation()
  const ids: string[] = spec.props?.entry_ids || []
  const hits = ids.map((id) => run.grimoire.find((g) => g.id === id)).filter(Boolean) as any[]
  const shown = hits.length ? hits : run.grimoire.slice(0, 3)
  return (
    <Frame spec={spec} building={building}>
      <div className="mb-3 font-mono text-[10px] text-ash">retrieved by <span className="text-[#6d4fc2]">Parasail BGE-M3</span> embeddings · cosine similarity</div>
      <div className="flex flex-col gap-2">
        {shown.map((h) => (
          <div key={h.id} className="rounded-xl border border-[var(--hair)] bg-[var(--sunk)] p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-bone">{h.title}</span>
              <span className="rounded bg-black/[0.04] px-1.5 font-mono text-[9px] uppercase text-ash">{h.kind}</span>
            </div>
            <div className="mt-2 flex items-center gap-2"><Meter value={h.similarity} color="#7a3e6e" height={4} /><span className="font-mono text-[10px] text-[#7a3e6e]">{h.similarity.toFixed(3)}</span></div>
            <div className="mt-2 text-[11.5px] leading-snug text-ash">{h.text}</div>
          </div>
        ))}
      </div>
      {spec.props?.why && <div className="mt-2 text-[11px] text-fog">{spec.props.why}</div>}
    </Frame>
  )
}

export function ProtocolChecklist({ spec, building }: { spec: ComponentSpec; building?: boolean }) {
  const { op, setOp } = useStation()
  const steps: any[] = spec.props?.steps || []
  const done = steps.filter((_, i) => op.checklist[i]).length
  return (
    <Frame spec={spec} building={building}>
      <div className="mb-3 flex items-center gap-3"><Meter value={steps.length ? done / steps.length : 0} color="var(--ok)" /><span className="shrink-0 font-mono text-xs text-ash">{done}/{steps.length}</span></div>
      <ol className="flex flex-col gap-1.5">
        {steps.map((s, i) => {
          const on = !!op.checklist[i]
          return (
            <li key={i}>
              <button onClick={() => setOp((o) => ({ ...o, checklist: { ...o.checklist, [i]: !o.checklist[i] } }))}
                className={clsx('flex w-full items-start gap-2.5 rounded-lg px-2 py-1.5 text-left transition hover:bg-[var(--sunk)]', on && 'opacity-60')}>
                <span className={clsx('mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border', on ? 'border-[var(--ok)] bg-[var(--ok)] text-white' : s.critical ? 'border-[var(--danger)]' : 'border-[var(--hair-2)]')}>{on && <Check size={11} strokeWidth={3} />}</span>
                <span className="min-w-0 flex-1">
                  <span className={clsx('text-[13px] text-bone', on && 'line-through')}>{s.label}</span>
                  <span className="ml-2 font-mono text-[10px] text-ash">{s.owner}</span>
                  {s.critical && <span className="ml-2 font-mono text-[9px] uppercase text-[var(--danger)]">critical</span>}
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </Frame>
  )
}

export function DecisionCard({ spec, building }: { spec: ComponentSpec; building?: boolean }) {
  const p = spec.props || {}
  const { run } = useStation()
  const color = p.action === 'evacuate' ? 'var(--danger)' : p.action === 'contain' ? 'var(--warn)' : 'var(--ok)'
  const votes = (['sentinel', 'archivist', 'verifier'] as const).map((k) => [k, (run.lanes[k].brief as any)?.recommends]).filter(([, v]) => v)
  return (
    <Frame spec={spec} building={building}>
      <div className="flex items-center gap-4">
        <div className="serif text-[46px] font-medium italic leading-none" style={{ color }}>{p.action ? p.action[0].toUpperCase() + p.action.slice(1) : '…'}</div>
        {typeof p.confidence === 'number' && <div className="flex-1"><div className="mb-1 font-mono text-[10px] text-ash">confidence {Math.round(p.confidence * 100)}%</div><Meter value={p.confidence} color={color} /></div>}
      </div>
      {p.rationale && <p className="serif mt-4 text-[17px] leading-snug text-bone">{p.rationale}</p>}
      {votes.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {votes.map(([k, v]) => (
            <span key={k as string} className={clsx('rounded-full border px-2 py-0.5 font-mono text-[10px]', v === p.action ? 'border-[var(--ok)]/40 text-[var(--ok)]' : 'border-[var(--warn)]/40 text-[var(--warn)]')}>
              {k}: {v as string}
            </span>
          ))}
        </div>
      )}
      {p.dissent && <div className="serif mt-3 border-l-2 border-[var(--hair-2)] pl-3 text-[14px] italic text-ash">{p.dissent}</div>}
    </Frame>
  )
}

export function CommsDraft({ spec, building }: { spec: ComponentSpec; building?: boolean }) {
  const p = spec.props || {}
  const { op, setOp } = useStation()
  const [copied, setCopied] = useState(false)
  const text = op.comms ?? p.message ?? ''
  return (
    <Frame spec={spec} building={building}>
      <div className="mb-2 font-mono text-[10px] text-ash">audience: <span className="text-bone">{p.audience || 'all'}</span></div>
      <textarea value={text} onChange={(e) => setOp((o) => ({ ...o, comms: e.target.value }))}
        className="h-28 w-full resize-none rounded-lg border border-[var(--hair-2)] bg-[var(--sunk)] p-3 text-[13px] leading-relaxed text-bone outline-none focus:border-[var(--accent)]" />
      <div className="mt-2 flex justify-end">
        <button onClick={() => { navigator.clipboard?.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1200) }}
          className="flex items-center gap-1 rounded-md border border-[var(--hair-2)] px-2 py-1 font-mono text-[10px] text-ash hover:text-bone"><Copy size={11} />{copied ? 'copied' : 'copy'}</button>
      </div>
    </Frame>
  )
}

export function ResourceBoard({ spec, building }: { spec: ComponentSpec; building?: boolean }) {
  const rs: any[] = spec.props?.resources || []
  const [deployed, setDeployed] = useState<Record<number, number>>({})
  return (
    <Frame spec={spec} building={building}>
      <div className="flex flex-col gap-2">
        {rs.map((r, i) => {
          const d = deployed[i] ?? (Number(r.deployed) || 0)
          const avail = Number(r.available) || 0
          return (
            <div key={i} className="flex items-center gap-3 rounded-lg border border-[var(--hair)] bg-[var(--sunk)] px-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm text-bone">{r.label}</div>
                <Meter value={avail ? d / avail : 0} height={3} />
              </div>
              <button onClick={() => setDeployed((x) => ({ ...x, [i]: Math.max(0, d - 1) }))} className="rounded border border-[var(--hair-2)] p-1 text-ash hover:text-bone"><Minus size={12} /></button>
              <span className="w-14 text-center font-mono text-xs text-bone">{d}/{avail}</span>
              <button onClick={() => setDeployed((x) => ({ ...x, [i]: Math.min(avail, d + 1) }))} className="rounded border border-[var(--hair-2)] p-1 text-ash hover:text-bone"><Plus size={12} /></button>
            </div>
          )
        })}
      </div>
    </Frame>
  )
}
