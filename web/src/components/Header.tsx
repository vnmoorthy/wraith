import clsx from 'clsx'
import { PARTNER_META } from '../lib/station'

export type View = 'warroom' | 'autopilot' | 'replays'

/** The mark: a ghost drawn in one ink line. */
export function GhostMark({ size = 26, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-hidden>
      <path d="M8 27.5V14a8 8 0 0 1 16 0v13.5l-2.6-1.9-2.7 2-2.7-2-2.7 2-2.7-2z" fill="none" stroke="currentColor"
        strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx="13" cy="14.2" r="1.25" fill="currentColor" />
      <circle cx="19" cy="14.2" r="1.25" fill="currentColor" />
    </svg>
  )
}

export function Header({ view, setView, health, ablate, toggleAblate, xray, setXray, provenance, setProvenance, connected, replay }: {
  view: View; setView: (v: View) => void
  health: Record<string, { ok: boolean; ms: number; detail: string }> | null
  ablate: Record<string, boolean>; toggleAblate: (p: string) => void
  xray: boolean; setXray: (b: boolean) => void
  provenance: boolean; setProvenance: (b: boolean) => void
  connected: boolean; replay: boolean
}) {
  const tabs: { id: View; label: string }[] = [
    { id: 'warroom', label: 'War room' },
    { id: 'autopilot', label: 'Autopilot' },
    { id: 'replays', label: 'Replays' },
  ]
  return (
    <header className="relative z-20 flex items-center gap-6 border-b border-[var(--hair)] bg-white px-6 py-3">
      <div className="flex items-center gap-2.5">
        <GhostMark size={26} className="text-bone" />
        <span className="serif text-[22px] font-medium tracking-tight text-bone">Wraith</span>
        <span className="hidden whitespace-nowrap pl-2 text-[12.5px] text-fog 2xl:inline">the war room that builds itself</span>
      </div>

      <nav className="flex items-center gap-5">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setView(t.id)}
            className={clsx('whitespace-nowrap text-[14px] transition', view === t.id ? 'hl text-bone' : 'text-ash hover:text-bone')}>
            {t.label}
          </button>
        ))}
      </nav>

      {replay && <span className="whitespace-nowrap rounded-full bg-[var(--beige)] px-2.5 py-0.5 text-[11.5px] font-medium text-[var(--beige-ink)]">Replay · recorded run</span>}

      <div className="ml-auto flex items-center gap-4">
        {['parasail', 'youcom', 'crewai', 'one', 'scenario'].map((p) => {
          const meta = PARTNER_META[p]
          const h = health?.[p]
          const off = ablate[p]
          const canAblate = p !== 'scenario'
          return (
            <button key={p} onClick={() => canAblate && toggleAblate(p)}
              title={`${meta.name}: ${meta.what}\n${h ? (h.ok ? '✓ ' : '✗ ') + h.detail + ` (${h.ms}ms)` : 'checking…'}${canAblate ? '\nclick to switch this partner off for the next run' : ''}`}
              className={clsx('flex items-center gap-1.5 whitespace-nowrap text-[12.5px] transition',
                off ? 'text-[var(--danger)] line-through' : 'text-ash hover:text-bone')}>
              <span className={clsx('h-1.5 w-1.5 rounded-full', !h && 'animate-pulse')}
                style={{ background: off ? 'var(--danger)' : !h ? '#d6d3cc' : h.ok ? 'var(--ok)' : 'var(--danger)' }} />
              {meta.name}
            </button>
          )
        })}
        <span className="h-4 w-px bg-[var(--hair-2)]" />
        <button onClick={() => setProvenance(!provenance)} title="Mark every component with the agent whose intel built it"
          className={clsx('whitespace-nowrap text-[12.5px]', provenance ? 'hl text-bone' : 'text-ash hover:text-bone')}>Provenance</button>
        <button onClick={() => setXray(!xray)} title="Show the raw schema-locked manifest streaming from Parasail"
          className={clsx('whitespace-nowrap text-[12.5px]', xray ? 'hl text-bone' : 'text-ash hover:text-bone')}>X-ray</button>
        <span title={connected ? 'connected to the swarm' : 'reconnecting…'} className="h-1.5 w-1.5 rounded-full" style={{ background: connected ? 'var(--ok)' : 'var(--danger)' }} />
      </div>
    </header>
  )
}
