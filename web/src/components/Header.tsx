import clsx from 'clsx'
import { Eye, Fingerprint, Radio, Repeat, Swords } from 'lucide-react'
import { PARTNER_META } from '../lib/station'

export type View = 'warroom' | 'autopilot' | 'replays'

export function Header({ view, setView, health, ablate, toggleAblate, xray, setXray, provenance, setProvenance, connected, replay }: {
  view: View; setView: (v: View) => void
  health: Record<string, { ok: boolean; ms: number; detail: string }> | null
  ablate: Record<string, boolean>; toggleAblate: (p: string) => void
  xray: boolean; setXray: (b: boolean) => void
  provenance: boolean; setProvenance: (b: boolean) => void
  connected: boolean; replay: boolean
}) {
  const tabs: { id: View; label: string; icon: any }[] = [
    { id: 'warroom', label: 'War Room', icon: Swords },
    { id: 'autopilot', label: 'Autopilot', icon: Radio },
    { id: 'replays', label: 'Replays', icon: Repeat },
  ]
  return (
    <header className="relative z-20 flex items-center gap-4 border-b border-white/5 bg-black/40 px-5 py-2.5 backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <div className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--accent)]/40 bg-[var(--accent)]/10 text-lg shadow-[0_0_24px_-6px_var(--accent)]">
          <span className="flicker">👻</span>
        </div>
        <div className="leading-none">
          <div className="font-display text-[19px] font-black tracking-[0.32em] text-bone glow-text">WRAITH</div>
          <div className="mt-0.5 hidden whitespace-nowrap font-mono text-[9px] tracking-[0.18em] text-ash 2xl:block">THE WAR ROOM THAT BUILDS ITSELF</div>
        </div>
      </div>

      <nav className="ml-4 flex items-center gap-1 rounded-xl border border-white/5 bg-white/[0.02] p-1">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setView(t.id)}
            className={clsx('flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition',
              view === t.id ? 'bg-[var(--accent)]/15 text-bone shadow-[inset_0_0_0_1px_var(--edge)]' : 'text-ash hover:text-bone')}>
            <t.icon size={13} />{t.label}
          </button>
        ))}
      </nav>

      {replay && <span className="whitespace-nowrap rounded-md border border-[var(--warn)]/50 bg-[var(--warn)]/10 px-2 py-1 font-mono text-[10px] font-bold tracking-widest text-[var(--warn)]">REPLAY · RECORDED RUN</span>}

      <div className="ml-auto flex items-center gap-1.5">
        {['parasail', 'youcom', 'crewai', 'one', 'scenario'].map((p) => {
          const meta = PARTNER_META[p]
          const h = health?.[p]
          const off = ablate[p]
          const canAblate = p !== 'scenario'
          return (
            <button key={p} onClick={() => canAblate && toggleAblate(p)}
              title={`${meta.name}: ${meta.what}\n${h ? (h.ok ? '✓ ' : '✗ ') + h.detail + ` (${h.ms}ms)` : 'checking…'}${canAblate ? '\nclick to ablate (switch off) this partner for the next run' : ''}`}
              className={clsx('group flex items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 py-1 font-mono text-[10.5px] transition',
                off ? 'border-[var(--danger)]/50 bg-[var(--danger)]/10 text-[var(--danger)] line-through' : 'border-white/8 bg-white/[0.02] text-bone hover:border-white/20')}>
              <span className={clsx('h-1.5 w-1.5 rounded-full', !h ? 'bg-fog animate-pulse' : h.ok ? '' : 'bg-[var(--danger)]')}
                style={h?.ok && !off ? { background: meta.color, boxShadow: `0 0 8px ${meta.color}` } : undefined} />
              {meta.name}
            </button>
          )
        })}
        <div className="mx-1 h-5 w-px bg-white/10" />
        <button onClick={() => setProvenance(!provenance)} title="Colour every component by the agent whose intel built it"
          className={clsx('flex items-center gap-1 whitespace-nowrap rounded-lg border px-2.5 py-1 font-mono text-[10.5px]', provenance ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-white/8 text-ash hover:text-bone')}>
          <Fingerprint size={12} />provenance
        </button>
        <button onClick={() => setXray(!xray)} title="Show the raw schema-locked manifest streaming from Parasail"
          className={clsx('flex items-center gap-1 whitespace-nowrap rounded-lg border px-2.5 py-1 font-mono text-[10.5px]', xray ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-white/8 text-ash hover:text-bone')}>
          <Eye size={12} />x-ray
        </button>
        <span title={connected ? 'swarm socket connected' : 'reconnecting…'} className={clsx('ml-1 h-2 w-2 rounded-full', connected ? 'bg-[var(--ok)]' : 'animate-pulse bg-[var(--danger)]')} />
      </div>
    </header>
  )
}
