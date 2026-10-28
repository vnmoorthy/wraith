import clsx from 'clsx'
import type { ReactNode } from 'react'
import { AGENT_META, SOURCE_COLORS, useStation } from '../../lib/station'
import type { ComponentSpec } from '../../lib/types'

export function Frame({ spec, building, children, className, span }: {
  spec: ComponentSpec; building?: boolean; children: ReactNode; className?: string; span?: 1 | 2
}) {
  const { provenance } = useStation()
  const src = spec.source || 'commander'
  const color = SOURCE_COLORS[src] || '#a78bfa'
  return (
    <section
      className={clsx('panel materialize relative flex flex-col', building && 'building', span === 2 && 'xl:col-span-2', className)}
      style={provenance ? { borderColor: color, boxShadow: `0 0 0 1px ${color}55, 0 0 32px -10px ${color}` } : undefined}
    >
      <header className="flex items-center justify-between gap-2 px-4 pt-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="panel-title truncate">{spec.title || spec.component}</span>
          {building && <span className="font-mono text-[10px] text-[var(--accent)] flicker">compiling…</span>}
        </div>
        <span
          title={`${AGENT_META[src]?.name}: ${AGENT_META[src]?.role}${spec.why ? ` — ${spec.why}` : ''}`}
          className="shrink-0 rounded-full border px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-wider"
          style={{ color, borderColor: `${color}55`, background: `${color}12` }}
        >
          {AGENT_META[src]?.glyph} {src}
        </span>
      </header>
      {provenance && spec.why && <div className="px-4 pt-1 font-mono text-[10px] text-ash">why: {spec.why}</div>}
      <div className="flex-1 px-4 pb-4 pt-3">{children}</div>
    </section>
  )
}

export function Meter({ value, color = 'var(--accent)', height = 6 }: { value: number; color?: string; height?: number }) {
  const v = Math.max(0, Math.min(1, value || 0))
  return (
    <div className="w-full overflow-hidden rounded-full bg-white/5" style={{ height }}>
      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${v * 100}%`, background: color, boxShadow: `0 0 12px ${color}` }} />
    </div>
  )
}

export const toneColor = (tone?: string) =>
  ({ danger: 'var(--danger)', warn: 'var(--warn)', ok: 'var(--ok)', info: 'var(--info)' } as Record<string, string>)[tone || 'info'] || 'var(--info)'

export const fmtSector = (s?: string) => (s || '').replace(/_/g, ' ')
