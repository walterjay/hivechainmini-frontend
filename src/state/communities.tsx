import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { DEFAULT_COMMUNITIES, type CommunityRef } from '../config'
import { listAllSubscriptions } from '../lib/hive'
import { load, save } from '../lib/storage'
import { useAuth } from './auth'

// Local choices are the source of truth. When logged in we read on-chain
// subscriptions, merge them in, and write joins/leaves on-chain best-effort.

const KEY = 'hh.communities'
const ONBOARDED_KEY = 'hh.onboarded'

interface CommunitiesValue {
  communities: CommunityRef[]
  onboarded: boolean
  finishOnboarding: (picked: CommunityRef[]) => void
  isJoined: (id: string) => boolean
  join: (c: CommunityRef) => Promise<void>
  leave: (id: string) => Promise<void>
  /** Local picks that aren't saved to the user's Hive account yet. */
  unsynced: CommunityRef[]
  syncToChain: () => Promise<boolean>
}

const Ctx = createContext<CommunitiesValue | null>(null)

const subscribeOp = (account: string, id: string, action: 'subscribe' | 'unsubscribe') =>
  ['custom_json', {
    required_auths: [],
    required_posting_auths: [account],
    id: 'community',
    json: JSON.stringify([action, { community: id }]),
  }] as [string, Record<string, unknown>]

export function CommunitiesProvider({ children }: { children: ReactNode }) {
  const { account, broadcast } = useAuth()
  const [communities, setCommunities] = useState<CommunityRef[]>(() => load(KEY, DEFAULT_COMMUNITIES))
  const [onboarded, setOnboarded] = useState(() => load(ONBOARDED_KEY, false))
  const [onChain, setOnChain] = useState<Set<string> | null>(null)
  const latest = useRef(communities)
  latest.current = communities

  const persist = (list: CommunityRef[]) => {
    setCommunities(list)
    save(KEY, list)
  }

  // Merge on-chain subscriptions into local choices whenever an account logs in.
  useEffect(() => {
    if (!account) {
      setOnChain(null)
      return
    }
    let cancelled = false
    listAllSubscriptions(account)
      .then((subs) => {
        if (cancelled) return
        setOnChain(new Set(subs.map((s) => s[0])))
        const have = new Set(latest.current.map((c) => c.id))
        const extra = subs.filter(([id]) => !have.has(id)).map(([id, title]) => ({ id, title }))
        if (extra.length) persist([...latest.current, ...extra])
        if (subs.length && !load(ONBOARDED_KEY, false)) {
          setOnboarded(true)
          save(ONBOARDED_KEY, true)
        }
      })
      .catch(() => {
        /* fail silently: local choices still work */
      })
    return () => {
      cancelled = true
    }
  }, [account])

  const finishOnboarding = useCallback((picked: CommunityRef[]) => {
    persist(picked)
    setOnboarded(true)
    save(ONBOARDED_KEY, true)
  }, [])

  const isJoined = useCallback((id: string) => communities.some((c) => c.id === id), [communities])

  const join = useCallback(
    async (c: CommunityRef) => {
      if (!latest.current.some((x) => x.id === c.id)) persist([...latest.current, c])
      if (account && onChain && !onChain.has(c.id)) {
        const ok = await broadcast([subscribeOp(account, c.id, 'subscribe')], { milestone: 'subscribe', silent: true })
        if (ok) setOnChain((s) => new Set(s).add(c.id))
      }
    },
    [account, broadcast, onChain],
  )

  const leave = useCallback(
    async (id: string) => {
      persist(latest.current.filter((c) => c.id !== id))
      if (account && onChain?.has(id)) {
        const ok = await broadcast([subscribeOp(account, id, 'unsubscribe')], { silent: true })
        if (ok)
          setOnChain((s) => {
            const n = new Set(s)
            n.delete(id)
            return n
          })
      }
    },
    [account, broadcast, onChain],
  )

  const unsynced = useMemo(
    () => (account && onChain ? communities.filter((c) => !onChain.has(c.id)) : []),
    [account, onChain, communities],
  )

  const syncToChain = useCallback(async () => {
    if (!account || !unsynced.length) return true
    const ok = await broadcast(unsynced.map((c) => subscribeOp(account, c.id, 'subscribe')), { milestone: 'subscribe' })
    if (ok) setOnChain((s) => new Set([...(s ?? []), ...unsynced.map((c) => c.id)]))
    return ok
  }, [account, unsynced, broadcast])

  const value = useMemo(
    () => ({ communities, onboarded, finishOnboarding, isJoined, join, leave, unsynced, syncToChain }),
    [communities, onboarded, finishOnboarding, isJoined, join, leave, unsynced, syncToChain],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useCommunities() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useCommunities outside CommunitiesProvider')
  return v
}
