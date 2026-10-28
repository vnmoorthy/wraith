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
      <div className="flex gap-5 px-4 pt-3.5">
        {([['venue', 'Venue feed', Ghost], ['reality', 'Real world', Globe2]] as const).map(([id, label, Icon]) => (
          <button key={id} onClick={() => setTab(id)}
            className={clsx('flex items-center gap-1.5 text-[13.5px]', tab === id ? 'hl text-bone' : 'text-ash hover:text-bone')}>
            <Icon size={13} />{label}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-2 p-4 pt-3">
        {tab === 'venue' ? (
          <>
            <div className="serif text-[12.5px] italic text-fog">The venue’s own fixtures, same contract as the live feed.</div>
            {fixtures.map((f) => (
              <button key={f.id} onClick={() => setPicked(f.id)}
                className={clsx('rounded-lg border px-3 py-2.5 text-left transition', picked === f.id ? 'border-[var(--ink)] bg-white' : 'border-[var(--hair)] bg-white hover:border-[var(--hair-2)]')}>
                <div className="flex items-baseline justify-between">
                  <span className="text-[13px] font-medium text-bone">{f.label}</span>
                  <span className={clsx('serif text-[12px] italic', f.scenario === 'control-tick' ? 'text-[var(--ok)]' : 'text-[var(--danger)]')}>{f.scenario.replace(/-/g, ' ')}</span>
                </div>
                <div className="mt-1 line-clamp-2 text-[11.5px] leading-snug text-ash">{describe(f)}</div>
              </button>
            ))}
          </>
        ) : (
          <>
            <div className="serif text-[12.5px] italic text-fog">Any incident, in plain English.</div>
            <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Describe what is happening, paste a raw log, or pick a preset…"
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) go() }}
              className="serif h-36 w-full resize-none rounded-lg border border-[var(--hair-2)] bg-white p-3 text-[15px] leading-relaxed text-bone outline-none placeholder:text-fog focus:border-[var(--ink)]" />
            <div className="flex flex-wrap gap-1.5">
              {presets.map((p) => (
                <button key={p.id} onClick={() => setText(p.text)} className="rounded-full border border-[var(--hair-2)] px-2.5 py-1 font-mono text-[10px] text-ash hover:border-[var(--accent)] hover:text-bone">{p.label}</button>
              ))}
            </div>
          </>
        )}
        <button onClick={go} disabled={busy || (tab === 'reality' && !text.trim())}
          className={clsx('mt-1 flex items-center justify-center gap-2 rounded-lg py-3 text-[14.5px] font-medium transition',
            busy ? 'bg-black/[0.04] text-ash' : 'bg-[var(--ink)] text-white hover:bg-black')}>
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
          {busy ? 'Summoning…' : 'Summon the war room'}
        </button>
        <div className="text-center text-[11.5px] text-fog">⌘↵ to summon · every run is recorded</div>
      </div>
    </div>
  )
}
