import clsx from 'clsx'
import { useEffect, useMemo, useRef } from 'react'
import type { RunState } from '../lib/run'
import { PARTNER_META } from '../lib/station'

function highlight(text: string) {
  const out: { t: string; c: string }[] = []
  const re = /("(?:[^"\\]|\\.)*"?)(\s*:)?|(-?\d+(?:\.\d+)?)|([{}[\],])|(\s+)|([^"\d{}[\],\s]+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    if (m[1]) { out.push({ t: m[1], c: m[2] ? 'json-key' : 'json-str' }); if (m[2]) out.push({ t: m[2], c: 'json-punc' }) }
    else if (m[3]) out.push({ t: m[3], c: 'json-num' })
    else if (m[4]) out.push({ t: m[4], c: 'json-punc' })
    else out.push({ t: m[0], c: '' })
  }
  return out
}

export function XRay({ run }: { run: RunState }) {
  const box = useRef<HTMLPreElement>(null)
  useEffect(() => { if (box.current) box.current.scrollTop = box.current.scrollHeight }, [run.manifestText])
  const pretty = useMemo(() => highlight(run.manifestText.slice(-9000)), [run.manifestText])
  const streaming = run.phase === 'compiling' && !run.manifestDone
  return (
    <div className="flex h-full flex-col gap-3">
      <div className="panel flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between px-3 pt-3">
          <span className="panel-title">x-ray · raw manifest stream</span>
          <span className="font-mono text-[9.5px] text-ash">{run.manifestText.length} chars{run.manifestModel ? ` · ${run.manifestModel}` : ''}</span>
        </div>
        <div className="px-3 pt-1 font-mono text-[9.5px] text-fog">Parasail · stream:true · response_format json_schema (server-enforced)</div>
        <pre ref={box} className={clsx('m-3 min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-[var(--sunk)] p-3 font-mono text-[10.5px] leading-relaxed', streaming && 'caret')}>
          {pretty.length ? pretty.map((p, i) => <span key={i} className={p.c}>{p.t}</span>) : <span className="text-fog">waiting for the compiler…</span>}
        </pre>
      </div>
      <div className="panel flex max-h-[42%] min-h-0 flex-col">
        <div className="flex items-center justify-between px-3 pt-3">
          <span className="panel-title">partner call trace</span>
          <span className="font-mono text-[9.5px] text-ash">{run.traces.length} calls</span>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-3">
          {run.traces.map((t, i) => {
            const meta = PARTNER_META[t.partner] || { name: t.partner, color: '#999' }
            return (
              <div key={i} className="mb-1.5 rounded-md bg-[var(--sunk)] px-2 py-1.5 font-mono text-[10px]">
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: t.ok ? meta.color : 'var(--danger)' }} />
                  <span style={{ color: meta.color }}>{meta.name}</span>
                  <span className="truncate text-bone/90">{t.op}</span>
                  <span className="ml-auto shrink-0 text-ash">{t.ms}ms</span>
                </div>
                {t.detail && <div className="mt-0.5 truncate pl-3 text-fog">{t.detail}</div>}
              </div>
            )
          })}
          {!run.traces.length && <div className="font-mono text-[10px] text-fog">no calls yet</div>}
        </div>
      </div>
    </div>
  )
}

export function Timeline({ run }: { run: RunState }) {
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => { if (box.current) box.current.scrollLeft = box.current.scrollWidth }, [run.timeline.length])
  const color: Record<string, string> = { danger: 'var(--danger)', ok: 'var(--ok)', accent: 'var(--accent)', info: 'var(--info)' }
  return (
    <div ref={box} className="flex items-center gap-2 overflow-x-auto px-1 py-1">
      {run.timeline.map((e, i) => (
        <div key={i} className="flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--hair)] bg-[var(--sunk)] px-2.5 py-1 font-mono text-[10px]">
          <span className="text-fog">{(e.t / 1000).toFixed(1)}s</span>
          <span style={{ color: color[e.tone] || 'var(--info)' }}>{e.label}</span>
        </div>
      ))}
      {!run.timeline.length && <span className="font-mono text-[10px] text-fog">timeline empty — summon a war room</span>}
      {run.calls && (
        <span className="ml-auto shrink-0 font-mono text-[10px] text-ash">
          calls: {Object.entries(run.calls).filter(([, v]) => v).map(([k, v]) => `${PARTNER_META[k]?.name || k} ${v}`).join(' · ')}
        </span>
      )}
    </div>
  )
}
