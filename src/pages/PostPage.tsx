import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import Avatar from '../components/Avatar'
import Comments, { type Thread } from '../components/Comments'
import FollowButton from '../components/FollowButton'
import Markdown from '../components/Markdown'
import RewardInfo from '../components/RewardInfo'
import { EmptyState, ErrorState, Spinner } from '../components/Status'
import SuggestedReads from '../components/SuggestedReads'
import VoteButton from '../components/VoteButton'
import { getDiscussion, isNsfw, postKey, timeAgo, type Post } from '../lib/hive'
import { invalidateCache, RpcError } from '../lib/rpc'
import { SHORT_FORM_SOURCES } from '../lib/shortform'
import { useTitle } from '../lib/useTitle'
import { useAuth } from '../state/auth'
import { usePrefs } from '../state/prefs'

/** For a reply, bridge `url` looks like "/category/@root/permlink#@reply/permlink". */
function rootPathOf(p: Post) {
  const m = p.url?.match(/@([a-z0-9.-]+)\/([a-z0-9-]+)/)
  return m ? `/p/${m[1]}/${m[2]}` : null
}

/**
 * Snaps/Threads/Waves are comments on a rotating container post from a known
 * account. Walk up from `p` through `all` until we find the node whose own
 * parent is one of those accounts - that node is the snap itself, whether we
 * started there or on a deeper reply within its thread. Returns null when
 * `p` isn't part of a short-form thread at all.
 */
function findSnapRoot(p: Post, all: Record<string, Post>): Post | null {
  let cur = p
  for (let i = 0; i < 20; i++) {
    if (!cur.parent_author) return null
    if (SHORT_FORM_SOURCES.some((s) => s.account === cur.parent_author)) return cur
    const next = all[`${cur.parent_author}/${cur.parent_permlink}`]
    if (!next) return null
    cur = next
  }
  return null
}

export default function PostPage() {
  const { author = '', permlink = '' } = useParams()
  const { account } = useAuth()
  const { showNsfw, setShowNsfw } = usePrefs()
  const [revealNsfw, setRevealNsfw] = useState(false)
  const { hash, state: navState } = useLocation()
  const justPosted = !!(navState as { justPosted?: boolean } | null)?.justPosted
  const [all, setAll] = useState<Record<string, Post> | null>(null)
  const [state, setState] = useState<'loading' | 'error' | 'missing' | 'ok'>('loading')
  const [extra, setExtra] = useState<Record<string, Post[]>>({})
  const [attempt, setAttempt] = useState(0)
  const key = `${author}/${permlink}`
  const root = all?.[key]
  useTitle(root?.title || (root ? `Comment by @${root.author}` : undefined))

  useEffect(() => {
    let off = false
    setState('loading')
    setExtra({})
    getDiscussion(author, permlink, account ?? '')
      .then((r) => {
        if (off) return
        setAll(r)
        setState(r?.[key] ? 'ok' : 'missing')
      })
      .catch((e) => !off && setState(e instanceof RpcError ? 'missing' : 'error'))
    return () => {
      off = true
    }
  }, [author, permlink, account, key, attempt])

  // A brand-new post can take a few seconds to be indexed: keep checking briefly.
  useEffect(() => {
    if (state !== 'missing' || !justPosted || attempt >= 6) return
    const t = setTimeout(() => {
      invalidateCache(permlink)
      setAttempt((a) => a + 1)
    }, 3000)
    return () => clearTimeout(t)
  }, [state, justPosted, attempt, permlink])

  useEffect(() => {
    if (state === 'ok' && hash === '#comments') document.getElementById('comments')?.scrollIntoView()
  }, [state, hash])

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

  if (state === 'loading' || (state === 'missing' && justPosted && attempt < 6))
    return <Spinner label={justPosted ? 'Your post is on its way… 🚀' : 'Opening post…'} />
  if (state === 'error') return <ErrorState onRetry={() => setAttempt((a) => a + 1)} />
  if (state === 'missing' || !root)
    return (
      <EmptyState emoji="🫥" title="We couldn’t find that post">
        <p>It may have been removed, or the link has a typo.</p>
        <Link to="/" className="btn-primary mt-4">
          Back to Home
        </Link>
      </EmptyState>
    )

  const snapRoot = findSnapRoot(root, all ?? {})
  const isSnapThread = !!snapRoot
  const isReply = root.depth > 0 && !isSnapThread
  const rootPath = isReply ? rootPathOf(root) : null
  // Viewing a nested reply within a snap's own thread: point back at the snap, not the container.
  const snapReplyBanner = isSnapThread && snapRoot !== root
  const blurred = isNsfw(root) && !showNsfw && !revealNsfw

  const article = blurred ? (
    <div className="card flex flex-col items-center gap-3 p-10 text-center">
      <div className="text-4xl" aria-hidden>
        🔞
      </div>
      <h1 className="text-lg font-bold">This post is marked sensitive (18+)</h1>
      <p className="max-w-sm text-sm text-muted">
        {root.title || 'This content'} is hidden by your content filter. You can reveal just this post, or turn sensitive content on everywhere.
      </p>
      <div className="mt-1 flex flex-wrap justify-center gap-2">
        <button className="btn-primary" onClick={() => setRevealNsfw(true)}>
          Show this post
        </button>
        <button className="btn-ghost" onClick={() => setShowNsfw(true)}>
          Always show sensitive content
        </button>
      </div>
    </div>
  ) : (
    <div className="card p-5 sm:p-7">
      <div className="mb-4 flex items-center gap-3">
        <Link to={`/u/${root.author}`} aria-label={`@${root.author}'s profile`}>
          <Avatar account={root.author} size={44} />
        </Link>
        <div className="min-w-0 flex-1 text-sm">
          <Link to={`/u/${root.author}`} className="font-bold hover:underline">
            @{root.author}
          </Link>
          <div className="text-muted">
            {root.community && root.community_title && (
              <>
                <Link to={`/c/${root.community}`} className="font-medium hover:underline">
                  {root.community_title}
                </Link>
                {' · '}
              </>
            )}
            <time dateTime={root.created + 'Z'}>{timeAgo(root.created)}</time>
          </div>
        </div>
        <FollowButton account={root.author} small />
      </div>
      {root.title && <h1 className="mb-4 text-2xl leading-tight font-extrabold tracking-tight sm:text-3xl">{root.title}</h1>}
      <Markdown source={root.body} />
      <div className="mt-6 -ml-2 flex items-center gap-2 border-t border-zinc-200 pt-3 dark:border-zinc-800">
        <VoteButton post={root} />
        <a href="#comments" className="rounded-full px-3.5 py-1.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800">
          💬 {root.children}
        </a>
        <RewardInfo post={root} />
      </div>
    </div>
  )

  return (
    <article>
      {isReply && (
        <div className="card mb-4 p-4 text-sm">
          You’re viewing a single reply.{' '}
          {rootPath && (
            <Link to={rootPath} className="link">
              See the full conversation →
            </Link>
          )}
        </div>
      )}
      {snapReplyBanner && (
        <div className="card mb-4 p-4 text-sm">
          You’re viewing a single reply.{' '}
          <Link to={`/p/${snapRoot.author}/${snapRoot.permlink}`} className="link">
            See the full conversation →
          </Link>
        </div>
      )}
      {isSnapThread ? (
        // Snaps read like Reddit: comments go straight below, not in a side column.
        <>
          {article}
          <Comments root={root} t={thread} />
        </>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)_360px] lg:items-start">
          <aside className="order-3 lg:order-1 lg:sticky lg:top-20">
            <SuggestedReads current={root} observer={account ?? ''} />
          </aside>
          <div className="order-1 min-w-0 lg:order-2">{article}</div>
          <aside className="order-2 lg:order-3 lg:sticky lg:top-20 lg:max-h-[calc(100vh-5.5rem)] lg:overflow-y-auto lg:overscroll-contain">
            <Comments root={root} t={thread} />
          </aside>
        </div>
      )}
    </article>
  )
}
