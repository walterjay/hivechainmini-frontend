import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import JoinButton from '../components/JoinButton'
import { CardSkeleton, EmptyState, ErrorState } from '../components/Status'
import { listCommunities, type Community } from '../lib/hive'
import { invalidateCache } from '../lib/rpc'
import { useTitle } from '../lib/useTitle'
import { useAuth } from '../state/auth'
import { useCommunities } from '../state/communities'
import { usePrefs } from '../state/prefs'
import { Tabs } from './Home'

const fmt = new Intl.NumberFormat('en', { notation: 'compact' })

export default function Communities() {
  const { account } = useAuth()
  const { communities: mine } = useCommunities()
  const { showNsfw } = usePrefs()
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [list, setList] = useState<Community[] | null>(null)
  const [error, setError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useTitle('Communities')

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300)
    return () => clearTimeout(t)
  }, [query])

  useEffect(() => {
    let off = false
    setList(null)
    setError(false)
    listCommunities(debounced, account ?? '', 50)
      .then((r) => !off && setList(r.filter((c) => showNsfw || !c.is_nsfw)))
      .catch(() => !off && setError(true))
    return () => {
      off = true
    }
  }, [debounced, account, attempt, showNsfw])

  return (
    <>
      <Tabs />
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Communities</h1>
          <p className="mt-1 text-sm text-muted">Join the ones you like. Their posts show up on your Home feed.</p>
        </div>
        <button
          className="icon-btn shrink-0"
          aria-label="Refresh"
          title="Refresh"
          onClick={() => {
            invalidateCache()
            setAttempt((a) => a + 1)
          }}
        >
          🔄
        </button>
      </div>

      {mine.length > 0 && (
        <section className="mt-5" aria-labelledby="mine">
          <h2 id="mine" className="mb-2 text-sm font-bold tracking-wide text-muted uppercase">
            Your communities
          </h2>
          <ul className="flex flex-wrap gap-2">
            {mine.map((c) => (
              <li key={c.id}>
                <Link to={`/c/${c.id}`} className="inline-block rounded-full bg-white px-4 py-1.5 text-sm font-semibold ring-1 ring-zinc-200 hover:bg-zinc-100 dark:bg-zinc-900 dark:ring-zinc-800 dark:hover:bg-zinc-800">
                  {c.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-6">
        <label htmlFor="community-search" className="sr-only">
          Search communities
        </label>
        <input
          id="community-search"
          type="search"
          className="input"
          placeholder="🔍 Search communities (try “art”, “travel”, “gaming”)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="mt-4">
        {error ? (
          <ErrorState onRetry={() => setAttempt((a) => a + 1)} />
        ) : !list ? (
          <CardSkeleton count={4} />
        ) : !list.length ? (
          <EmptyState emoji="🔍" title="No communities match that">
            <p>Try a shorter or different word.</p>
          </EmptyState>
        ) : (
          <ul className="space-y-3">
            {list.map((c) => (
              <li key={c.name} className="card flex items-start gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <Link to={`/c/${c.name}`} className="font-bold hover:underline">
                    {c.title}
                  </Link>
                  <p className="text-xs text-muted">{fmt.format(c.subscribers)} members</p>
                  {c.about && <p className="mt-1 line-clamp-2 text-sm text-muted">{c.about}</p>}
                </div>
                <JoinButton community={{ id: c.name, title: c.title }} small />
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}
