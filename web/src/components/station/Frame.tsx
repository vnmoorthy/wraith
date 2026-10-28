import clsx from 'clsx'
import type { ReactNode } from 'react'
import { AGENT_META, SOURCE_COLORS, useStation } from '../../lib/station'
import type { ComponentSpec } from '../../lib/types'

export function Frame({ spec, building, children, className, span }: {
  spec: ComponentSpec; building?: boolean; children: ReactNode; className?: string; span?: 1 | 2
}) {
  void span
  const { provenance } = useStation()
  const src = spec.source || 'commander'
  const color = SOURCE_COLORS[src] || '#161615'
  return (
    <section
      className={clsx('panel materialize relative flex flex-col', building && 'building', className)}
      style={provenance ? { borderColor: color, boxShadow: `inset 3px 0 0 ${color}` } : undefined}
    >
      <header className="flex items-baseline justify-between gap-3 px-5 pt-4">
        <span className="truncate text-[12.5px] font-medium text-ash">{spec.title || spec.component}</span>
        <span title={`${AGENT_META[src]?.name}: ${AGENT_META[src]?.role}${spec.why ? ` — ${spec.why}` : ''}`}
          className="serif shrink-0 text-[11.5px] italic" style={{ color }}>
          {building ? 'composing…' : `via ${AGENT_META[src]?.name.toLowerCase()}`}
        </span>
      </header>
      {provenance && spec.why && <div className="serif px-5 pt-1 text-[12px] italic text-fog">{spec.why}</div>}
      <div className="flex-1 px-5 pb-5 pt-3">{children}</div>
    </section>
  )
}

export function Meter({ value, color = 'var(--accent)', height = 4 }: { value: number; color?: string; height?: number }) {
  const v = Math.max(0, Math.min(1, value || 0))
  return (
    <div className="w-full overflow-hidden rounded-full bg-black/[0.06]" style={{ height }}>
      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${v * 100}%`, background: color }} />
    </div>
  )
}

export const toneColor = (tone?: string) =>
  ({ danger: 'var(--danger)', warn: 'var(--warn)', ok: 'var(--ok)', info: 'var(--info)' } as Record<string, string>)[tone || 'info'] || 'var(--info)'

export const fmtSector = (s?: string) => (s || '').replace(/_/g, ' ')
