import { API_NODES, FEED_CACHE_TTL_MS, NODE_TIMEOUT_MS } from '../config'

/** A JSON-RPC error returned by the node itself (not a network problem). */
export class RpcError extends Error {
  code: number
  data?: unknown
  constructor(message: string, code: number, data?: unknown) {
    super(message)
    this.name = 'RpcError'
    this.code = code
    this.data = data
  }
}

// Node order is kept per session: a node that fails is moved to the back.
const nodes = [...API_NODES]

function demote(node: string) {
  const i = nodes.indexOf(node)
  if (i >= 0 && nodes.length > 1) {
    nodes.splice(i, 1)
    nodes.push(node)
  }
}

// Errors that mean "this node is struggling", so another node may succeed.
const NODE_TROUBLE = /timeout|timed out|too many|rate limit|unavailable|bad gateway|internal error|upstream|connection/i

async function callNode(node: string, method: string, params: unknown, signal?: AbortSignal) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), NODE_TIMEOUT_MS)
  const onAbort = () => ctrl.abort()
  signal?.addEventListener('abort', onAbort)
  try {
    const res = await fetch(node, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method, params, id: 1 }),
      signal: ctrl.signal,
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    if (json.error) {
      const err = new RpcError(json.error.message ?? 'Unknown error', json.error.code ?? 0, json.error.data)
      if (NODE_TROUBLE.test(err.message)) throw Object.assign(new Error(err.message), { retry: true })
      throw err
    }
    return json.result
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}

/** Call a Hive API method, failing over across public nodes. */
export async function rpc<T>(method: string, params: unknown, signal?: AbortSignal): Promise<T> {
  let lastErr: unknown
  for (const node of [...nodes]) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    try {
      return (await callNode(node, method, params, signal)) as T
    } catch (e) {
      if (e instanceof RpcError) throw e // the request itself is bad; another node won't help
      if (signal?.aborted) throw e
      lastErr = e
      demote(node)
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('All Hive nodes are unreachable')
}

// Light in-memory cache for read calls, keyed by method + params.
const cache = new Map<string, { at: number; value: Promise<unknown> }>()

export function cachedRpc<T>(method: string, params: unknown, ttl = FEED_CACHE_TTL_MS): Promise<T> {
  const key = method + JSON.stringify(params)
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < ttl) return hit.value as Promise<T>
  const value = rpc<T>(method, params)
  cache.set(key, { at: Date.now(), value })
  value.catch(() => cache.delete(key))
  return value
}

/** Drop cached entries whose method+params contain any of the given strings (or everything). */
export function invalidateCache(...needles: string[]) {
  for (const key of cache.keys()) {
    if (needles.length === 0 || needles.some((n) => key.includes(n))) cache.delete(key)
  }
}

/** The node currently preferred, passed to Keychain so it broadcasts through a working node. */
export function currentNode() {
  return nodes[0]
}
