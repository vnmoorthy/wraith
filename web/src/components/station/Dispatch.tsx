import clsx from 'clsx'
import { CheckCircle2, Loader2, Radio, Send, XCircle } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { api } from '../../lib/socket'
import { useStation } from '../../lib/station'
import type { ComponentSpec } from '../../lib/types'
import { Frame } from './Frame'

export function useDispatchBody() {
  const { run, op } = useStation()
  const d = run.decision
  const route = run.route
  const civ = (() => {
    const base = route?.civilian_status || ''
    const moved = Object.entries(op.civilianOverrides).map(([s, st]) => `${s.replace(/_/g, ' ')} → ${st}`)
    return [base, ...moved].filter(Boolean).join('; ')
  })()
  const checklistDone = Object.values(op.checklist).filter(Boolean).length
  const steps = (run.manifest.ui_components_ordered || []).find((c) => c.component === 'ProtocolChecklist')?.props?.steps?.length || 0
  return useMemo(() => ({
    run_id: run.runId,
    sector: d?.priority_sector || route?.primary_sector || 'unknown',
    action: d?.action || 'observe',
    rationale: d?.rationale || route?.headline || '',
    countermeasures: op.countermeasures.length ? op.countermeasures : (d?.countermeasures || []).slice(0, 2),
    civilians: civ,
    isolated_zones: op.isolated,
    confidence: d?.confidence ?? null,
    threat_level: d?.threat_level ?? null,
    citations: run.evidence.slice(0, 2).map((e) => e.url),
    checklist: steps ? `${checklistDone}/${steps} steps done` : '',
    headline: route?.headline || '',
  }), [run.runId, d, route, op, civ, checklistDone, steps, run.evidence])
}

export function DispatchConsole({ spec, building }: { spec: ComponentSpec; building?: boolean }) {
  const p = spec.props || {}
  const { run, setOp, op } = useStation()
  const body = useDispatchBody()
  const [preview, setPreview] = useState('')
  const [dry, setDry] = useState(false)
  const [state, setState] = useState<'idle' | 'armed' | 'sending' | 'sent' | 'error'>('idle')
  const [err, setErr] = useState('')
  const oneOff = !!run.ablate?.one
  const urgency = p.urgency || 'priority'
  const hold = urgency === 'hold' || run.decision?.escalate === false

  useEffect(() => {
    const t = setTimeout(() => {
      api<{ content: string }>('/api/dispatch/preview', { ...body, urgency }).then((r) => setPreview(r.content)).catch(() => {})
    }, 180)
    return () => clearTimeout(t)
  }, [body, urgency])

  const fire = async () => {
    if (state === 'idle' || state === 'sent' || state === 'error') { setState('armed'); return }
    if (state !== 'armed') return
    setState('sending'); setErr('')
    try {
      const r = await api<any>('/api/dispatch', { ...body, urgency, dry_run: dry, one_disabled: oneOff })
      setOp((o) => ({ ...o, receipts: [{ ...r.receipt, content: r.content, at: new Date().toLocaleTimeString() }, ...o.receipts] }))
      setState('sent')
    } catch (e: any) {
      setErr(String(e.message || e)); setState('error')
    }
  }

  const last = op.receipts[0]
  return (
    <Frame spec={spec} building={building} span={2} className={clsx(!hold && 'ring-1 ring-[var(--accent)]/30')}>
      <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2 font-mono text-[11px]">
            <Radio size={13} className="text-[#4ade80]" />
            <span className="text-bone">{p.channel || '#loft-incident'}</span>
            <span className="text-fog">via One · discord · execute_one_action</span>
            <span className={clsx('ml-auto rounded px-1.5 py-0.5 text-[10px] font-bold uppercase', urgency === 'flash' ? 'bg-[var(--danger)]/15 text-[var(--danger)]' : hold ? 'bg-white/5 text-ash' : 'bg-[var(--warn)]/15 text-[var(--warn)]')}>{urgency}</span>
          </div>
          <pre className="max-h-44 overflow-auto whitespace-pre-wrap rounded-xl border border-white/8 bg-black/40 p-3 font-mono text-[11.5px] leading-relaxed text-[#d9f99d]">{preview || '…building payload from station state'}</pre>
          <div className="mt-1.5 font-mono text-[10px] text-fog">payload is rebuilt live from what you select on this station — countermeasures, isolated sectors, civilians, checklist</div>
        </div>
        <div className="flex flex-col justify-between gap-3">
          {hold && <div className="rounded-lg border border-[var(--ok)]/30 bg-[var(--ok)]/5 p-2 text-[11.5px] text-[var(--ok)]">Commander says hold: escalating this would be a false alarm. You can still send manually.</div>}
          <label className="flex items-center gap-2 font-mono text-[11px] text-ash">
            <input type="checkbox" checked={dry} onChange={(e) => setDry(e.target.checked)} className="accent-[var(--accent)]" /> dry run (One builds the request, does not send)
          </label>
          <button onClick={fire} disabled={state === 'sending' || oneOff}
            className={clsx('flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-display text-sm font-bold tracking-[0.2em] transition-all',
              oneOff ? 'bg-white/5 text-fog' :
              state === 'armed' ? 'animate-pulse bg-[var(--danger)] text-black shadow-[0_0_40px_-6px_var(--danger)]' :
              'bg-[var(--accent)] text-black shadow-[0_0_30px_-8px_var(--accent)] hover:brightness-110')}>
            {state === 'sending' ? <Loader2 size={16} className="animate-spin" /> : <Send size={15} />}
            {oneOff ? 'ONE OFFLINE' : state === 'armed' ? 'CONFIRM DISPATCH' : state === 'sending' ? 'DISPATCHING' : 'DISPATCH'}
          </button>
          {state === 'armed' && <button onClick={() => setState('idle')} className="font-mono text-[10px] text-ash hover:text-bone">cancel</button>}
          {err && <div className="flex items-start gap-1.5 text-[11px] text-[var(--danger)]"><XCircle size={13} className="mt-0.5 shrink-0" />{err}</div>}
          {last && (
            <div className="rounded-lg border border-[var(--ok)]/30 bg-[var(--ok)]/5 p-2 font-mono text-[10.5px] text-[var(--ok)]">
              <div className="flex items-center gap-1 font-bold"><CheckCircle2 size={12} /> {last.dry_run ? 'DRY RUN OK' : 'DELIVERED'} · {last.at}</div>
              {last.message_id && <div className="truncate text-bone/80">message {last.message_id}</div>}
              <div className="truncate text-ash">{last.action_title || last.action_id} · {last.latency_ms}ms</div>
            </div>
          )}
        </div>
      </div>
    </Frame>
  )
}
