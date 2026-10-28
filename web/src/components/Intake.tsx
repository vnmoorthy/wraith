import clsx from 'clsx'
import { Ghost, Globe2, Loader2, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api } from '../lib/socket'

interface Fixture { id: string; scenario: string; label: string; incident: any }
interface Preset { id: string; label: string; text: string }

export function Intake({ onSummon, busy }: { onSummon: (incident: any) => void; busy: boolean }) {
  const [tab, setTab] = useState<'venue' | 'reality'>('venue')
  const [fixtures, setFixtures] = useState<Fixture[]>([])
  const [presets, setPresets] = useState<Preset[]>([])
  const [picked, setPicked] = useState<string>('')
  const [text, setText] = useState('')

  useEffect(() => {
    api<{ fixtures: Fixture[]; presets: Preset[] }>('/api/fixtures').then((d) => {
      setFixtures(d.fixtures); setPresets(d.presets)
      setPicked(d.fixtures[0]?.id || '')
    }).catch(() => {})
  }, [])

  const fixture = fixtures.find((f) => f.id === picked)
  const describe = (f: Fixture) => {
    const i = f.incident
    if (i.raw_incident_stream) return i.raw_incident_stream
    const rs = i.sector_reports || []
    return rs.map((r: any) => `${r.sector.replace(/_/g, ' ')}: ${r.containment_state}, ${r.civilian_status}, EMF ${r.sensors?.emf_milligauss}mG, ${r.sensors?.temp_c}°C${r.sighting ? `, ${r.sighting.entity_class} (${Math.round(r.sighting.confidence * 100)}%)` : ''}`).join(' · ')
  }
  const go = () => {
    if (busy) return
    if (tab === 'venue' && fixture) onSummon(fixture.incident)
    if (tab === 'reality' && text.trim()) onSummon({ text: text.trim(), source: 'reality' })
  }

  return (
    <div className="panel flex flex-col">
      <div className="flex border-b border-white/5 p-1.5">
        {([['venue', 'Venue feed', Ghost], ['reality', 'Reality mode', Globe2]] as const).map(([id, label, Icon]) => (
          <button key={id} onClick={() => setTab(id)}
            className={clsx('flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-[12px] font-medium', tab === id ? 'bg-[var(--accent)]/12 text-bone' : 'text-ash hover:text-bone')}>
            <Icon size={13} />{label}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-2 p-3">
        {tab === 'venue' ? (
          <>
            <div className="panel-title">scenario fixtures · same contract as the live feed</div>
            {fixtures.map((f) => (
              <button key={f.id} onClick={() => setPicked(f.id)}
                className={clsx('rounded-xl border p-2.5 text-left transition', picked === f.id ? 'border-[var(--accent)]/60 bg-[var(--accent)]/8' : 'border-white/5 bg-white/[0.015] hover:border-white/15')}>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] font-bold text-bone">{f.label}</span>
                  <span className={clsx('font-mono text-[9px] uppercase', f.scenario === 'control-tick' ? 'text-[var(--ok)]' : 'text-[var(--danger)]')}>{f.scenario}</span>
                </div>
                <div className="mt-1 line-clamp-2 text-[11px] leading-snug text-ash">{describe(f)}</div>
              </button>
            ))}
          </>
        ) : (
          <>
            <div className="panel-title">any incident, in plain english</div>
            <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Describe what is happening, paste a raw log, or pick a preset…"
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) go() }}
              className="h-32 w-full resize-none rounded-xl border border-white/10 bg-black/30 p-3 text-[12.5px] leading-relaxed text-bone outline-none placeholder:text-fog focus:border-[var(--accent)]" />
            <div className="flex flex-wrap gap-1.5">
              {presets.map((p) => (
                <button key={p.id} onClick={() => setText(p.text)} className="rounded-full border border-white/10 px-2.5 py-1 font-mono text-[10px] text-ash hover:border-[var(--accent)] hover:text-bone">{p.label}</button>
              ))}
            </div>
          </>
        )}
        <button onClick={go} disabled={busy || (tab === 'reality' && !text.trim())}
          className={clsx('mt-1 flex items-center justify-center gap-2 rounded-xl py-3 font-display text-[13px] font-bold tracking-[0.28em] transition',
            busy ? 'bg-white/5 text-ash' : 'bg-gradient-to-r from-[var(--accent)] to-[var(--accent-2)] text-black shadow-[0_0_40px_-10px_var(--accent)] hover:brightness-110')}>
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
          {busy ? 'SUMMONING' : 'SUMMON WAR ROOM'}
        </button>
        <div className="text-center font-mono text-[9.5px] text-fog">⌘↵ to summon · every run is recorded for replay</div>
      </div>
    </div>
  )
}
