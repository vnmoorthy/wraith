import clsx from 'clsx'
import { Film, Play, RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api } from '../lib/socket'

interface RunRow { id: string; mode: string; headline: string | null; recorded: boolean; events: number; components: number; duration_ms: number }

export function Replays({ onReplay }: { onReplay: (id: string, speed: number) => void }) {
  const [runs, setRuns] = useState<RunRow[]>([])
  const [speed, setSpeed] = useState(1)
  const [err, setErr] = useState('')
  const load = () => api<{ runs: RunRow[] }>('/api/runs').then((d) => { setRuns(d.runs); setErr('') }).catch((e) => setErr(String(e.message || e)))
  useEffect(() => { load() }, [])
  return (
    <div className="mx-auto flex h-full max-w-5xl flex-col gap-4 overflow-auto pb-6">
      <div className="panel flex items-center gap-4 p-5">
        <Film className="text-[var(--accent)]" />
        <div className="flex-1">
          <h2 className="serif text-xl font-bold text-bone">Replays</h2>
          <p className="text-[12.5px] text-ash">Every summoning is recorded event by event — agent tokens, partner calls, the manifest stream. Replays re-run that exact stream with its original timing and are always labelled REPLAY. They also work fully offline.</p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-[var(--hair)] p-1 font-mono text-[11px]">
          {[1, 2, 4].map((s) => <button key={s} onClick={() => setSpeed(s)} className={clsx('rounded px-2 py-1', speed === s ? 'bg-[var(--beige)] text-bone' : 'text-ash')}>{s}×</button>)}
        </div>
        <button onClick={load} className="text-ash hover:text-bone"><RefreshCw size={15} /></button>
      </div>
      {err && <div className="text-[12px] text-[var(--danger)]">{err}</div>}
      <div className="grid gap-3 md:grid-cols-2">
        {runs.map((r) => (
          <button key={r.id} onClick={() => onReplay(r.id, speed)} className="panel group p-4 text-left transition hover:border-[var(--hair-2)]">
            <div className="flex items-center justify-between font-mono text-[10px]">
              <span className={clsx('rounded px-1.5 py-0.5 uppercase', r.recorded ? 'bg-[var(--warn)]/12 text-[var(--warn)]' : 'bg-black/[0.04] text-ash')}>{r.recorded ? 'shipped recording' : r.mode}</span>
              <span className="text-fog">{r.id}</span>
            </div>
            <div className="mt-2 line-clamp-2 text-[14px] font-semibold text-bone">{r.headline || 'untitled incident'}</div>
            <div className="mt-2 flex items-center gap-3 font-mono text-[10.5px] text-ash">
              <span>{r.components} components</span><span>{r.events} events</span><span>{(r.duration_ms / 1000).toFixed(1)}s</span>
              <Play size={13} className="ml-auto text-[var(--accent)] opacity-0 transition group-hover:opacity-100" />
            </div>
          </button>
        ))}
      </div>
      {!runs.length && !err && <div className="panel p-8 text-center font-mono text-[12px] text-fog">no runs yet — summon a war room first</div>}
    </div>
  )
}
