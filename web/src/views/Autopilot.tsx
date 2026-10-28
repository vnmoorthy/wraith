import clsx from 'clsx'
import { AlertTriangle, CheckCircle2, Loader2, Play, RefreshCw, Trophy, XCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { RunState } from '../lib/run'
import { api } from '../lib/socket'
import { SwarmPanel } from '../components/Swarm'

export interface AutoRow { tick: any; scenario: string; action?: string; decision?: any; judgment?: any; dispatch?: any; run_id?: string }
export interface AutoState { running: boolean; practice: boolean; rows: AutoRow[]; done?: any; error?: string }

export function Autopilot({ auto, run, start, team, busy }: {
  auto: AutoState; run: RunState; busy: boolean; team: string | null
  start: (opts: { practice: boolean; dispatch: boolean; compile: boolean }) => void
}) {
  const [practice, setPractice] = useState(true)
  const [dispatch, setDispatch] = useState(false)
  const [compile, setCompile] = useState(false)
  const [armed, setArmed] = useState(false)
  const [board, setBoard] = useState<any>(null)
  const [boardErr, setBoardErr] = useState('')
  const loadBoard = () => api('/api/scoreboard').then((b) => { setBoard(b); setBoardErr('') }).catch((e) => setBoardErr(String(e.message || e)))
  useEffect(() => { loadBoard() }, [])
  useEffect(() => { if (auto.done && !auto.practice) loadBoard() }, [auto.done, auto.practice])

  const go = () => {
    if (!practice && !armed) { setArmed(true); return }
    setArmed(false)
    start({ practice, dispatch, compile })
  }
  const teams: any[] = board?.teams || []
  const total = auto.rows.reduce((a, r) => a + (typeof r.judgment?.score === 'number' ? r.judgment.score : 0), 0)
  const falseAlarms = auto.rows.filter((r) => r.judgment?.false_alarm).length

  return (
    <div className="grid h-full min-h-0 grid-cols-[320px_minmax(0,1fr)_300px] gap-4">
      <div className="flex min-h-0 flex-col gap-4 overflow-auto pb-4">
        <div className="panel p-4">
          <div className="panel-title mb-3">track 1 · the exorcism protocol</div>
          <p className="text-[12.5px] leading-relaxed text-ash">The same swarm plays the venue scenario feed over MCP: pull a tick, deliberate with partial knowledge, submit <span className="text-bone">contain / evacuate / observe</span>, and escalate to Discord through One only when the threshold is real.</p>
          <div className="mt-4 flex rounded-xl border border-white/8 p-1">
            {[[true, 'Practice'], [false, 'Live feed']].map(([v, l]) => (
              <button key={String(v)} onClick={() => { setPractice(v as boolean); setArmed(false) }}
                className={clsx('flex-1 rounded-lg py-1.5 text-[12px]', practice === v ? 'bg-[var(--accent)]/15 text-bone' : 'text-ash')}>{l as string}</button>
            ))}
          </div>
          <div className="mt-2 font-mono text-[10px] leading-relaxed text-fog">
            {practice ? 'Fixtures + a local referee that follows the published doctrine. Nothing is submitted.' :
              <>Pulls real ticks and submits as <span className="text-bone">{team || 'TEAM_HANDLE unset'}</span>. One accepted answer per tick per team.</>}
          </div>
          <label className="mt-3 flex items-center gap-2 text-[12px] text-ash"><input type="checkbox" checked={dispatch} onChange={(e) => setDispatch(e.target.checked)} className="accent-[var(--accent)]" />auto-dispatch real threats to #loft-incident</label>
          <label className="mt-1.5 flex items-center gap-2 text-[12px] text-ash"><input type="checkbox" checked={compile} onChange={(e) => setCompile(e.target.checked)} className="accent-[var(--accent)]" />also compile a war room per tick (slower)</label>
          <button onClick={go} disabled={busy || (!practice && !team)}
            className={clsx('mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-3 font-display text-[12.5px] font-bold tracking-[0.24em]',
              busy ? 'bg-white/5 text-ash' : armed ? 'animate-pulse bg-[var(--danger)] text-black' : 'bg-gradient-to-r from-[var(--accent)] to-[var(--accent-2)] text-black')}>
            {auto.running ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
            {auto.running ? 'SWARM RUNNING' : armed ? 'CONFIRM LIVE RUN' : practice ? 'RUN PRACTICE' : 'RUN LIVE FEED'}
          </button>
        </div>
        <SwarmPanel run={run} />
      </div>

      <div className="flex min-h-0 flex-col gap-4 overflow-auto pb-4">
        <div className="grid grid-cols-3 gap-3">
          {[
            ['score', auto.rows.length ? `${total.toFixed(1)} / ${auto.rows.filter((r) => r.judgment).length}` : '—', 'var(--accent)'],
            ['false alarms', String(falseAlarms), falseAlarms ? 'var(--danger)' : 'var(--ok)'],
            ['escalations sent', String(auto.rows.filter((r) => r.dispatch?.receipt).length), 'var(--info)'],
          ].map(([l, v, c]) => (
            <div key={l} className="panel p-4"><div className="panel-title">{l}</div><div className="mt-1 font-mono text-3xl font-bold" style={{ color: c }}>{v}</div></div>
          ))}
        </div>
        {auto.error && <div className="panel flex items-center gap-2 p-3 text-[12.5px] text-[var(--danger)]"><AlertTriangle size={14} />{auto.error}</div>}
        {auto.rows.map((r, i) => {
          const j = r.judgment
          const good = j && typeof j.score === 'number' && j.score >= 1 && !j.false_alarm
          return (
            <div key={i} className="panel materialize p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold text-bone">tick {r.tick.tick_id}</span>
                  <span className={clsx('font-mono text-[10px] uppercase', r.scenario === 'control-tick' ? 'text-[var(--ok)]' : 'text-[var(--danger)]')}>{r.scenario}</span>
                </div>
                {!j ? <Loader2 size={14} className="animate-spin text-[var(--accent)]" /> : good ? <CheckCircle2 size={16} className="text-[var(--ok)]" /> : <XCircle size={16} className="text-[var(--warn)]" />}
              </div>
              <div className="mt-2 grid gap-1.5">
                {(r.tick.sector_reports || []).map((s: any) => (
                  <div key={s.sector} className="flex flex-wrap gap-x-3 font-mono text-[10.5px] text-ash">
                    <span className="text-bone">{s.sector}</span><span>{s.containment_state}</span><span>{s.civilian_status}</span>
                    <span>EMF {s.sensors?.emf_milligauss}</span><span>{s.sensors?.temp_c}°C</span>{s.sighting && <span>{s.sighting.entity_class} {Math.round(s.sighting.confidence * 100)}%</span>}
                  </div>
                ))}
              </div>
              {r.action && (
                <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-white/5 pt-3">
                  <span className="font-display text-lg font-bold" style={{ color: r.action === 'evacuate' ? 'var(--danger)' : r.action === 'contain' ? 'var(--warn)' : 'var(--ok)' }}>{r.action.toUpperCase()}</span>
                  {r.decision?.rationale && <span className="min-w-0 flex-1 text-[12px] text-ash">{r.decision.rationale}</span>}
                </div>
              )}
              {j && (
                <div className="mt-2 flex flex-wrap gap-2 font-mono text-[10.5px]">
                  {j.queued ? <span className="text-[var(--warn)]">queued for replay: {j.error}</span> : <>
                    <span className="rounded bg-white/5 px-2 py-0.5">score <b className="text-bone">{j.score ?? '—'}</b></span>
                    {j.expected && <span className="rounded bg-white/5 px-2 py-0.5">expected <b className="text-bone">{j.expected}</b></span>}
                    <span className={clsx('rounded px-2 py-0.5', j.false_alarm ? 'bg-[var(--danger)]/15 text-[var(--danger)]' : 'bg-[var(--ok)]/10 text-[var(--ok)]')}>{j.false_alarm ? 'FALSE ALARM' : 'no false alarm'}</span>
                    {j.referee && <span className="text-fog">{j.referee}</span>}
                    {j.expectation_source && <span className="text-fog">referee: {j.expectation_source}</span>}
                  </>}
                </div>
              )}
              {r.dispatch && (
                <div className={clsx('mt-2 rounded-lg p-2 font-mono text-[10.5px]', r.dispatch.error ? 'bg-[var(--danger)]/10 text-[var(--danger)]' : 'bg-[var(--ok)]/8 text-[var(--ok)]')}>
                  {r.dispatch.error ? `dispatch failed: ${r.dispatch.error}` : `→ #loft-incident via One ${r.dispatch.receipt?.dry_run ? '(dry run)' : ''} · message ${r.dispatch.receipt?.message_id || '—'}`}
                </div>
              )}
            </div>
          )
        })}
        {!auto.rows.length && <div className="panel flex h-60 items-center justify-center font-mono text-[12px] text-fog">press run — ticks appear here as the swarm judges them</div>}
        {auto.done && <div className="panel p-4 font-mono text-[12px] text-bone">Run complete · {auto.done.judged} ticks judged · total {Number(auto.done.total).toFixed(1)}{auto.practice ? ' (practice)' : ''}</div>}
      </div>

      <div className="panel flex min-h-0 flex-col p-4">
        <div className="flex items-center justify-between">
          <span className="panel-title flex items-center gap-1.5"><Trophy size={12} />live scoreboard</span>
          <button onClick={loadBoard} className="text-ash hover:text-bone"><RefreshCw size={13} /></button>
        </div>
        <div className="mt-1 font-mono text-[9.5px] text-fog">hack26-get-scoreboard · scenario MCP</div>
        <div className="mt-3 min-h-0 flex-1 overflow-auto">
          {boardErr && <div className="text-[11px] text-[var(--danger)]">{boardErr}</div>}
          {teams.length === 0 && !boardErr && <div className="font-mono text-[11px] text-fog">no submissions yet</div>}
          {teams.map((t: any, i: number) => (
            <div key={t.team || i} className={clsx('mb-1.5 flex items-center gap-2 rounded-lg px-2.5 py-2 font-mono text-[11px]', t.team === team ? 'border border-[var(--accent)]/50 bg-[var(--accent)]/10' : 'bg-white/[0.02]')}>
              <span className="w-5 text-fog">{i + 1}</span>
              <span className="flex-1 truncate text-bone">{t.team}</span>
              <span className="text-[var(--accent)]">{t.total_score ?? t.score ?? t.total ?? '—'}</span>
              <span className="text-ash">{t.submissions ?? ''}</span>
              {(t.false_alarms ?? 0) > 0 && <span className="text-[var(--danger)]">⚠{t.false_alarms}</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
