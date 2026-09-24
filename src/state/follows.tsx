import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { rpc } from '../lib/rpc'
import { useAuth } from './auth'

// Who the logged-in user follows, loaded once so follow buttons don't each hit the API.

interface FollowsValue {
  loaded: boolean
  following: Set<string>
  isFollowing: (name: string) => boolean
  setFollowing: (name: string, on: boolean) => void
}

const Ctx = createContext<FollowsValue | null>(null)

async function loadFollowing(account: string) {
  const out = new Set<string>()
  let start = ''
  for (let page = 0; page < 10; page++) {
    const rows = await rpc<{ following: string }[]>('condenser_api.get_following', [account, start, 'blog', 1000])
    rows.forEach((r) => out.add(r.following))
    if (rows.length < 1000) break
    start = rows[rows.length - 1].following
  }
  return out
}

export function FollowsProvider({ children }: { children: ReactNode }) {
  const { account } = useAuth()
  const [following, setSet] = useState<Set<string>>(new Set())
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    setSet(new Set())
    setLoaded(false)
    if (!account) return
    let off = false
    loadFollowing(account)
      .then((s) => !off && setSet(s))
      .catch(() => {})
      .finally(() => !off && setLoaded(true))
    return () => {
      off = true
    }
  }, [account])

  const isFollowing = useCallback((n: string) => following.has(n), [following])
  const setFollowing = useCallback((n: string, on: boolean) => {
    setSet((s) => {
      const next = new Set(s)
      if (on) next.add(n)
      else next.delete(n)
      return next
    })
  }, [])

  const value = useMemo(() => ({ loaded, following, isFollowing, setFollowing }), [loaded, following, isFollowing, setFollowing])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useFollows() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useFollows outside FollowsProvider')
  return v
}
