import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { postKey, visible, type Post } from '../lib/hive'
import PostCard from './PostCard'
import { CardSkeleton, ErrorState } from './Status'

export interface FeedPage {
  posts: Post[]
  done: boolean
}

/**
 * Generic paged feed. `loadPage(first)` is called with first=true on reset and
 * false for "load more"; it owns its own cursor(s). Change `resetKey` to reload.
 */
export default function Feed({
  resetKey,
  loadPage,
  empty,
  showCommunity = true,
  showFollow = true,
}: {
  resetKey: string
  loadPage: (first: boolean) => Promise<FeedPage>
  empty: ReactNode
  showCommunity?: boolean
  showFollow?: boolean
}) {
  const [posts, setPosts] = useState<Post[] | null>(null)
  const [done, setDone] = useState(false)
  const [error, setError] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const gen = useRef(0)
  const loader = useRef(loadPage)
  loader.current = loadPage

  const run = useCallback(async (first: boolean) => {
    const g = first ? ++gen.current : gen.current
    if (first) {
      setPosts(null)
      setDone(false)
    }
    setError(false)
    setLoadingMore(!first)
    try {
      const page = await loader.current(first)
      if (g !== gen.current) return
      setPosts((prev) => {
        const seen = new Set((first ? [] : (prev ?? [])).map(postKey))
        const fresh = page.posts.filter((p) => visible(p) && !seen.has(postKey(p)) && seen.add(postKey(p)))
        return first ? fresh : [...(prev ?? []), ...fresh]
      })
      setDone(page.done)
    } catch {
      if (g === gen.current) setError(true)
    } finally {
      if (g === gen.current) setLoadingMore(false)
    }
  }, [])

  useEffect(() => {
    run(true)
  }, [resetKey, run])

  if (error && !posts) return <ErrorState onRetry={() => run(true)} />
  if (!posts) return <CardSkeleton />
  if (!posts.length && done) return <>{empty}</>

  return (
    <div className="space-y-3">
      {posts.map((p) => (
        <PostCard key={postKey(p)} post={p} showCommunity={showCommunity} showFollow={showFollow} />
      ))}
      {error && <ErrorState onRetry={() => run(false)} />}
      {!done && !error && (
        <div className="flex justify-center pt-2 pb-6">
          <button className="btn-ghost" onClick={() => run(false)} disabled={loadingMore}>
            {loadingMore ? 'Loading…' : 'Show more'}
          </button>
        </div>
      )}
      {done && posts.length > 0 && <p className="py-6 text-center text-sm text-muted">You’re all caught up ✨</p>}
    </div>
  )
}
