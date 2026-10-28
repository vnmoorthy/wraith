import clsx from 'clsx'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Header, type View } from './components/Header'
import { Intake } from './components/Intake'
import { Station } from './components/station/Station'
import { SwarmPanel } from './components/Swarm'
import { Timeline, XRay } from './components/XRay'
import { emptyRun, reduce, type RunState } from './lib/run'
import { STATIC, api, useSwarmSocket } from './lib/socket'
import { StationProvider, emptyOp, type OperatorState } from './lib/station'
import type { WraithEvent } from './lib/types'
import { Autopilot, type AutoState } from './views/Autopilot'
import { Replays } from './views/Replays'

export default function App() {
  const [view, setView] = useState<View>('warroom')
  const [run, setRun] = useState<RunState>(emptyRun())
  const [autoRun, setAutoRun] = useState<RunState>(emptyRun())
  const [auto, setAuto] = useState<AutoState>({ running: false, practice: true, rows: [] })
  const [op, setOpState] = useState<OperatorState>(emptyOp())
  const [xray, setXray] = useState(true)
  const [provenance, setProvenance] = useState(false)
  const [ablate, setAblate] = useState<Record<string, boolean>>({})
  const [health, setHealth] = useState<any>(null)
  const [status, setStatus] = useState<any>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const mode = useRef<'warroom' | 'autopilot'>('warroom')
  const timers = useRef<number[]>([])

  const setOp = useCallback((fn: (o: OperatorState) => OperatorState) => setOpState((o) => fn(o)), [])

  const onEvent = useCallback((e: WraithEvent) => {
    if (e.type === 'busy') { setNotice(e.error); setTimeout(() => setNotice(''), 3000); return }
    if (e.type === 'pong') return
    if (e.type.startsWith('autopilot.')) {
      setAuto((a) => {
        switch (e.type) {
          case 'autopilot.start': return { running: true, practice: e.practice, rows: [] }
          case 'autopilot.tick': return { ...a, rows: [...a.rows, { tick: e.tick, scenario: e.scenario }] }
          case 'autopilot.judgment': return { ...a, rows: a.rows.map((r) => r.tick.tick_id === e.tick_id && !r.judgment ? { ...r, action: e.action, decision: e.decision, judgment: e.judgment, run_id: e.run_id } : r) }
          case 'autopilot.dispatch': return { ...a, rows: a.rows.map((r) => r.tick.tick_id === e.tick_id ? { ...r, dispatch: e } : r) }
          case 'autopilot.error': setBusy(false); return { ...a, running: false, error: e.error }
          case 'autopilot.done': setBusy(false); return { ...a, running: false, done: e }
        }
        return a
      })
      return
    }
    if (mode.current === 'autopilot') { setAutoRun((s) => reduce(s, e)); return }
    if (e.type === 'run.start') setOpState(emptyOp())
    setRun((s) => reduce(s, e))
    if (e.type === 'run.done') setBusy(false)
  }, [])

  const { connected, send } = useSwarmSocket(onEvent)

  useEffect(() => {
    api('/api/status').then(setStatus).catch(() => {})
    const poll = () => api('/api/health').then(setHealth).catch(() => {})
    poll()
    const t = setInterval(poll, 60000)
    return () => clearInterval(t)
  }, [])

  const stopReplay = () => { timers.current.forEach(clearTimeout); timers.current = [] }

  const summon = (incident: any) => {
    if (STATIC) { setNotice('Hosted replay viewer — clone the repo and run ./run.sh to summon live'); setTimeout(() => setNotice(''), 4000); return }
    stopReplay()
    mode.current = 'warroom'
    setRun({ ...emptyRun(), replay: false, phase: 'routing' })
    setBusy(true)
    if (!send({ type: 'summon', incident, ablate })) { setBusy(false); setNotice('swarm socket not connected') }
  }

  const startAutopilot = (opts: { practice: boolean; dispatch: boolean; compile: boolean }) => {
    stopReplay()
    mode.current = 'autopilot'
    setAutoRun(emptyRun())
    setBusy(true)
    if (!send({ type: 'autopilot', ...opts, ablate })) { setBusy(false); setNotice('swarm socket not connected') }
  }

  const replay = async (id: string, speed: number) => {
    stopReplay()
    const d = await api<any>(`/api/runs/${id}`)
    mode.current = 'warroom'
    setView('warroom')
    setRun({ ...emptyRun(), replay: true })
    setOpState(emptyOp())
    for (const e of d.events as WraithEvent[]) {
      timers.current.push(window.setTimeout(() => setRun((s) => ({ ...reduce(s, e), replay: true })), (e.t || 0) / speed))
    }
  }

  useEffect(() => {
    const q = new URLSearchParams(location.search)
    const id = q.get('replay')
    if (id) replay(id, Number(q.get('speed')) || 1).catch(() => setNotice('replay not found'))
    else if (STATIC) api<any>('/api/runs').then((d) => { const first = d.runs.find((r: any) => r.components > 0); if (first) replay(first.id, 1) }).catch(() => {})
    if (q.get('xray') === '0') setXray(false)
    if (q.get('provenance') === '1') setProvenance(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggleAblate = (p: string) => setAblate((a) => ({ ...a, [p]: !a[p] }))
  const anyOff = Object.values(ablate).some(Boolean)

  return (
    <div className="fog flex h-full flex-col">
      <div className="scanlines" />
      <Header view={view} setView={setView} health={health} ablate={ablate} toggleAblate={toggleAblate}
        xray={xray} setXray={setXray} provenance={provenance} setProvenance={setProvenance} connected={connected} replay={!!run.replay && view === 'warroom'} />
      {STATIC && (
        <div className="relative z-10 border-b border-[var(--warn)]/30 bg-[var(--warn)]/10 px-5 py-1.5 text-center font-mono text-[11px] text-[var(--warn)]">
          HOSTED REPLAY VIEWER — these are recordings of real runs, re-streamed with their original timing. To summon live: <a className="underline" href="https://github.com/vnmoorthy/wraith">clone the repo</a> and run ./run.sh
        </div>
      )}
      {anyOff && (
        <div className="relative z-10 border-b border-[var(--danger)]/30 bg-[var(--danger)]/10 px-5 py-1.5 font-mono text-[11px] text-[var(--danger)]">
          ABLATION ACTIVE — next run without: {Object.entries(ablate).filter(([, v]) => v).map(([k]) => k).join(', ')}. Watch what breaks.
        </div>
      )}
      {notice && <div className="absolute left-1/2 top-16 z-50 -translate-x-1/2 rounded-lg border border-[var(--warn)]/40 bg-black/80 px-4 py-2 font-mono text-[12px] text-[var(--warn)]">{notice}</div>}

      <main className="relative z-10 min-h-0 flex-1 p-4">
        {view === 'warroom' && (
          <StationProvider run={run} op={op} setOp={setOp} xray={xray} provenance={provenance}>
            <div className={clsx('grid h-full min-h-0 gap-4', xray ? 'grid-cols-[300px_minmax(0,1fr)_340px]' : 'grid-cols-[300px_minmax(0,1fr)]')}>
              <aside className="flex min-h-0 min-w-0 flex-col gap-4 overflow-auto pb-2">
                <Intake onSummon={summon} busy={busy} />
                <SwarmPanel run={run} />
              </aside>
              <section className="flex min-h-0 min-w-0 flex-col gap-3">
                <div className="min-h-0 flex-1 overflow-auto pr-1"><Station /></div>
                <div className="panel shrink-0 px-2 py-1"><Timeline run={run} /></div>
              </section>
              {xray && <aside className="min-h-0"><XRay run={run} /></aside>}
            </div>
          </StationProvider>
        )}
        {view === 'autopilot' && <Autopilot auto={auto} run={autoRun} start={startAutopilot} team={status?.team ?? null} busy={busy} />}
        {view === 'replays' && <Replays onReplay={replay} />}
      </main>
    </div>
  )
}
