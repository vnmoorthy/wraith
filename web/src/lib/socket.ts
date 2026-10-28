import { useEffect, useRef, useState, useCallback } from 'react'
import type { WraithEvent } from './types'

type Handler = (e: WraithEvent) => void

/** One WebSocket to the swarm, reconnecting on drop. */
export function useSwarmSocket(onEvent: Handler) {
  const ws = useRef<WebSocket | null>(null)
  const handler = useRef(onEvent)
  handler.current = onEvent
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    if (STATIC) return
    let alive = true
    let retry: number | undefined
    const open = () => {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws'
      const sock = new WebSocket(`${proto}://${location.host}/ws`)
      ws.current = sock
      sock.onopen = () => setConnected(true)
      sock.onclose = () => {
        setConnected(false)
        if (alive) retry = window.setTimeout(open, 1500)
      }
      sock.onerror = () => sock.close()
      sock.onmessage = (m) => {
        try { handler.current(JSON.parse(m.data)) } catch { /* ignore malformed */ }
      }
    }
    open()
    const ping = window.setInterval(() => ws.current?.readyState === 1 && ws.current.send('{"type":"ping"}'), 20000)
    return () => { alive = false; clearTimeout(retry); clearInterval(ping); ws.current?.close() }
  }, [])

  const send = useCallback((msg: object) => {
    if (ws.current?.readyState === 1) { ws.current.send(JSON.stringify(msg)); return true }
    return false
  }, [])

  return { connected, send }
}

/** Hosted replay viewer (GitHub Pages): no backend, recordings are static JSON next to the app. */
export const STATIC = import.meta.env.VITE_STATIC === '1'

async function staticApi(path: string, body?: object): Promise<any> {
  const get = (f: string) => fetch(`recordings/${f}`).then((r) => { if (!r.ok) throw new Error(`${r.status}`); return r.json() })
  if (path === '/api/runs') return get('index.json')
  if (path.startsWith('/api/runs/')) return get(`${path.split('/').pop()}.json`)
  if (path === '/api/fixtures') return get('fixtures.json')
  if (path === '/api/status') return { static: true, team: null }
  if (path === '/api/health') return Object.fromEntries(['parasail', 'youcom', 'crewai', 'one', 'scenario'].map((p) => [p, { ok: true, ms: 0, detail: 'recorded run' }]))
  if (path === '/api/dispatch/preview') return { content: '(hosted replay viewer: run ./run.sh locally to dispatch through One)' }
  void body
  throw new Error('This is the hosted replay viewer. Clone the repo and ./run.sh to summon and dispatch live.')
}

export async function api<T = any>(path: string, body?: object): Promise<T> {
  if (STATIC) return staticApi(path, body) as Promise<T>
  const res = await fetch(path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : undefined)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.detail || `${res.status}`)
  return data as T
}
