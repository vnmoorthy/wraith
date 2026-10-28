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
  const [dry, setDry] = useState(() => new URLSearchParams(location.search).get('dry') === '1')
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

  const last = op.receipts[0] || run.dispatch
  return (
    <Frame spec={spec} building={building} span={2}>
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-baseline gap-2 text-[12.5px]">
            <Radio size={13} className="translate-y-[2px] text-[var(--ok)]" />
            <span className="text-bone">To {p.channel || '#loft-incident'}</span>
            <span className="text-fog">· via One → Discord</span>
            <span className="serif ml-auto text-[13px] italic" style={{ color: urgency === 'flash' ? 'var(--danger)' : hold ? 'var(--ok)' : 'var(--warn)' }}>{urgency}</span>
          </div>
          <div className="serif max-h-48 overflow-auto whitespace-pre-wrap border-l border-[var(--hair-2)] pl-4 text-[15px] leading-[1.6] text-bone">{preview || 'Writing the message from what you have done on this station…'}</div>
          <div className="mt-2 text-[11.5px] text-fog">Rewritten live from your choices on this station: countermeasures, isolated sectors, civilians, protocol.</div>
        </div>
        <div className="flex flex-col gap-3">
          {hold && <div className="serif text-[14px] italic text-[var(--ok)]">The commander says hold. Sending this would be a false alarm.</div>}
          <label className="flex items-center gap-2 text-[12px] text-ash">
            <input type="checkbox" checked={dry} onChange={(e) => setDry(e.target.checked)} className="accent-[var(--ink)]" /> Dry run (One builds the request, does not send)
          </label>
          <button onClick={fire} disabled={state === 'sending' || oneOff}
            className={clsx('flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-[14.5px] font-medium transition-all',
              oneOff ? 'bg-black/[0.04] text-fog' :
              state === 'armed' ? 'bg-[var(--danger)] text-white' :
              'bg-[var(--ink)] text-white hover:bg-black')}>
            {state === 'sending' ? <Loader2 size={16} className="animate-spin" /> : <Send size={15} />}
            {oneOff ? 'One is switched off' : state === 'armed' ? 'Confirm: send to Discord' : state === 'sending' ? 'Sending through One…' : 'Dispatch'}
          </button>
          {state === 'armed' && <button onClick={() => setState('idle')} className="text-[12px] text-ash hover:text-bone">cancel</button>}
          {err && <div className="flex items-start gap-1.5 text-[12px] text-[var(--danger)]"><XCircle size={13} className="mt-0.5 shrink-0" />{err}</div>}
          {last && <Ladder receipt={last} />}
        </div>
      </div>
    </Frame>
  )
}

const TOOLS = ['list_one_integrations', 'find_one_actions', 'execute_one_action']

/** One's three-tool loop, step by step, with what each step returned. */
function Ladder({ receipt }: { receipt: any }) {
  const steps: any[] = receipt.steps || []
  return (
    <div className="text-[12px]">
      <div className="mb-1.5 flex items-center gap-1.5 font-medium" style={{ color: receipt.ok ? 'var(--ok)' : receipt.pending ? 'var(--warn)' : 'var(--danger)' }}>
        {receipt.ok ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
        {receipt.ok ? (receipt.dry_run ? 'Built by One, not sent (dry run)' : 'Delivered to Discord') : receipt.pending ? 'Ready — Discord not connected in One yet' : 'One could not send it'}
      </div>
      <ol className="flex flex-col gap-1">
        {TOOLS.map((tool, i) => {
          const st = steps.find((x) => x.tool === tool)
          const done = !!st && st.ok !== false
          return (
            <li key={tool} className="flex items-baseline gap-2">
              <span className="serif w-4 text-fog">{i + 1}.</span>
              <span className={clsx('font-mono text-[11px]', done ? 'text-bone' : 'text-fog')}>{tool}</span>
              <span className="ml-auto shrink-0 tabular-nums text-fog">{st ? `${st.ms} ms${st.cached ? ' · cached' : ''}` : receipt.pending && i === 2 ? 'pending' : ''}</span>
            </li>
          )
        })}
      </ol>
      {steps.map((st) => st.detail && <div key={st.tool} className="mt-1 truncate pl-6 text-[11px] text-fog" title={st.detail}>{st.detail}</div>)}
      {receipt.jump_url && <a href={receipt.jump_url} target="_blank" rel="noreferrer" className="mt-1 inline-block pl-6 text-[12px] underline decoration-[var(--hair-2)] underline-offset-4">Open in Discord ↗</a>}
    </div>
  )
}
