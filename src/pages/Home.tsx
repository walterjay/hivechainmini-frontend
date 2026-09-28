import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useLocation, useSearchParams } from 'react-router'
import Feed from '../components/Feed'
import FollowButton from '../components/FollowButton'
import Avatar from '../components/Avatar'
import { EmptyState, Spinner } from '../components/Status'
import { accountFeed, mergedFeed } from '../lib/feeds'
import { getRankedPosts, visible } from '../lib/hive'
import { requestRefresh, useRefresh } from '../lib/refresh'
import { useTitle } from '../lib/useTitle'
import { useAuth } from '../state/auth'
import { useCommunities } from '../state/communities'
import { useFollows } from '../state/follows'

export function useSort(): 'hot' | 'created' {
  const [params] = useSearchParams()
  return params.get('sort') === 'new' ? 'created' : 'hot'
}

function SyncBanner() {
  const { unsynced, syncToChain } = useCommunities()
  const [hidden, setHidden] = useState(false)
  const [busy, setBusy] = useState(false)
  if (!unsynced.length || hidden) return null
  return (
    <div className="card mb-4 flex flex-col gap-3 p-4 text-sm sm:flex-row sm:items-center">
      <p className="flex-1">
        Save {unsynced.length === 1 ? unsynced[0].title : `your ${unsynced.length} communities`} to your Hive account, so they follow you to other Hive apps too.
      </p>
      <div className="flex gap-2">
        <button className="btn-ghost btn-sm" onClick={() => setHidden(true)}>
          Not now
        </button>
        <button
          className="btn-primary btn-sm"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            await syncToChain()
            setBusy(false)
          }}
        >
          Save
        </button>
      </div>
    </div>
  )
}

/**
 * The one row of choices for the Posts area. Tapping the chip you're already
 * on refreshes it.
 */
export function PostsNav() {
  const { pathname, search } = useLocation()
  const isNew = new URLSearchParams(search).get('sort') === 'new'
  const items = [
    { to: '/posts', label: '🔥 Hot', on: pathname === '/posts' && !isNew },
    { to: '/posts?sort=new', label: '✨ New', on: pathname === '/posts' && isNew },
    { to: '/following', label: '🙂 Following', on: pathname === '/following' },
    { to: '/communities', label: '🧭 Communities', on: pathname === '/communities' },
  ]
  return (
    <nav className="-mx-4 mb-4 flex gap-1 overflow-x-auto px-4 [scrollbar-width:none]" aria-label="Posts">
      {items.map((it) => (
        <Link
          key={it.to}
          to={it.to}
          replace
          aria-current={it.on ? 'page' : undefined}
          className={`chip shrink-0 whitespace-nowrap ${it.on ? 'chip-on' : 'chip-off'}`}
          onClick={(e) => {
            if (!it.on) return
            e.preventDefault()
            requestRefresh()
          }}
        >
          {it.label}
        </Link>
      ))}
    </nav>
  )
}

export default function Home() {
  const { onboarded, communities } = useCommunities()
  const { account } = useAuth()
  const sort = useSort()
  const [nonce, setNonce] = useState(0)
  useTitle()
  const ids = communities.map((c) => c.id)
  const key = `${ids.join(',')}|${sort}|${account ?? ''}|${nonce}`
  const loader = useMemo(() => mergedFeed(ids, sort, account ?? ''), [key])
  useRefresh(() => setNonce((n) => n + 1))

  if (!onboarded) return <Navigate to="/welcome" replace />

  return (
    <>
      <h1 className="sr-only">Posts</h1>
      <PostsNav />
      <SyncBanner />
      {communities.length === 0 ? (
        <EmptyState emoji="🧭" title="Your Home is ready to fill up">
          <p>Join a few communities and their posts will show up here.</p>
          <Link to="/communities" className="btn-primary mt-4">
            Find communities
          </Link>
        </EmptyState>
      ) : (
        <Feed
          resetKey={key}
          loadPage={loader}
          empty={
            <EmptyState emoji="🌱" title="It’s quiet here right now">
              <p>Try switching to New, or join a few more communities.</p>
            </EmptyState>
          }
        />
      )}
    </>
  )
}

function SuggestedPeople() {
  const { communities } = useCommunities()
  const { account } = useAuth()
  const [people, setPeople] = useState<string[] | null>(null)
  useEffect(() => {
    let off = false
    Promise.allSettled(communities.slice(0, 5).map((c) => getRankedPosts(c.id, 'created', account ?? '', 20)))
      .then((res) => {
        const names: string[] = []
        for (const r of res) if (r.status === 'fulfilled') for (const p of r.value) if (visible(p) && !p.stats?.is_pinned && p.author !== account && !names.includes(p.author)) names.push(p.author)
        if (!off) setPeople(names.slice(0, 8))
      })
    return () => {
      off = true
    }
  }, [communities, account])
  if (!people) return <Spinner label="Finding friendly people…" />
  if (!people.length) return null
  return (
    <ul className="mt-4 grid gap-2 text-left sm:grid-cols-2">
      {people.map((n) => (
        <li key={n} className="card flex items-center gap-3 p-3">
          <Link to={`/u/${n}`} className="flex min-w-0 flex-1 items-center gap-2 font-semibold hover:underline">
            <Avatar account={n} size={36} />
            <span className="truncate">@{n}</span>
          </Link>
          <FollowButton account={n} small />
        </li>
      ))}
    </ul>
  )
}

export function Following() {
  const { account, ensureLogin } = useAuth()
  const { loaded, following } = useFollows()
  const [nonce, setNonce] = useState(0)
  useTitle('Following')
  const loader = useMemo(() => (account ? accountFeed(account, 'feed', account) : null), [account])
  useRefresh(() => setNonce((n) => n + 1))

  let body
  if (!account) {
    body = (
      <EmptyState emoji="👋" title="See posts from people you follow">
        <p>Log in to build your own feed of favorite people. Browsing everything else works without an account.</p>
        <button className="btn-primary mt-4" onClick={() => ensureLogin('Log in to see posts from people you follow.')}>
          Log in
        </button>
      </EmptyState>
    )
  } else if (!loaded) {
    body = <Spinner />
  } else if (following.size === 0) {
    body = (
      <div className="card px-5 py-8 text-center">
        <div className="mb-2 text-4xl" aria-hidden>
          🤝
        </div>
        <h2 className="text-lg font-bold">Your Following feed starts with one tap</h2>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted">Here are some people posting in your communities lately. Follow anyone who looks interesting!</p>
        <SuggestedPeople />
      </div>
    )
  } else {
    body = (
      <>
        <Feed
          resetKey={`feed|${account}|${following.size}|${nonce}`}
          loadPage={loader!}
          empty={
            <EmptyState emoji="🌱" title="No new posts yet">
              <p>The people you follow haven’t posted lately. Check back soon!</p>
            </EmptyState>
          }
        />
      </>
    )
  }

  return (
    <>
      <h1 className="sr-only">Following</h1>
      <PostsNav />
      {body}
    </>
  )
}
