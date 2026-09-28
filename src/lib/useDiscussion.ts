import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Thread } from '../components/Comments'
import { getDiscussion, postKey, type Post } from './hive'
import { RpcError } from './rpc'

/** Loads a post/comment plus its whole discussion tree, and tracks locally-added replies. */
export function useDiscussion(author: string, permlink: string, observer: string) {
  const [all, setAll] = useState<Record<string, Post> | null>(null)
  const [state, setState] = useState<'loading' | 'error' | 'missing' | 'ok'>('loading')
  const [extra, setExtra] = useState<Record<string, Post[]>>({})
  const [attempt, setAttempt] = useState(0)
  const key = `${author}/${permlink}`
  const root = all?.[key]

  useEffect(() => {
    let off = false
    setState('loading')
    setExtra({})
    getDiscussion(author, permlink, observer)
      .then((r) => {
        if (off) return
        setAll(r)
        setState(r?.[key] ? 'ok' : 'missing')
      })
      .catch((e) => !off && setState(e instanceof RpcError ? 'missing' : 'error'))
    return () => {
      off = true
    }
  }, [author, permlink, observer, key, attempt])

  const add = useCallback((c: Post) => {
    const parent = `${c.parent_author}/${c.parent_permlink}`
    // Upsert: the same comment arrives again (with a url) once it's confirmed.
    setExtra((x) => {
      const list = x[parent] ?? []
      const i = list.findIndex((m) => postKey(m) === postKey(c))
      return { ...x, [parent]: i >= 0 ? list.map((m, j) => (j === i ? c : m)) : [c, ...list] }
    })
  }, [])
  const remove = useCallback((c: Post) => {
    const parent = `${c.parent_author}/${c.parent_permlink}`
    setExtra((x) => ({ ...x, [parent]: (x[parent] ?? []).filter((m) => postKey(m) !== postKey(c)) }))
  }, [])
  const thread = useMemo<Thread>(() => ({ all: all ?? {}, extra, add, remove }), [all, extra, add, remove])

  return { root, all, thread, state, attempt, retry: () => setAttempt((a) => a + 1) }
}
