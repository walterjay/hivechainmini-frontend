import { useEffect, useState } from 'react'
import { VOTE_WEIGHT_PERCENT } from '../config'
import { hasVoted, upvoteCount, type Post } from '../lib/hive'
import { invalidateCache } from '../lib/rpc'
import { useAuth } from '../state/auth'

/** One-tap upvote with an optimistic count. No downvotes, ever. */
/** `overlay` is the big icon-over-count version used on top of full-screen photos. */
export default function VoteButton({ post, compact = false, overlay = false }: { post: Post; compact?: boolean; overlay?: boolean }) {
  const { account, broadcast, ensureLogin } = useAuth()
  const [voted, setVoted] = useState(() => hasVoted(post, account))
  const [count, setCount] = useState(() => upvoteCount(post))
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setVoted(hasVoted(post, account))
    setCount(upvoteCount(post))
  }, [post, account])

  async function vote() {
    if (busy) return
    const who = account ?? (await ensureLogin('Log in to upvote posts you enjoy.'))
    if (!who) return
    if (hasVoted(post, who) || voted) return
    setBusy(true)
    setVoted(true)
    setCount((c) => c + 1)
    const ok = await broadcast(
      [['vote', { voter: who, author: post.author, permlink: post.permlink, weight: Math.round(VOTE_WEIGHT_PERCENT * 100) }]],
      { milestone: 'vote' },
    )
    if (ok) invalidateCache(post.permlink)
    else {
      setVoted(false)
      setCount((c) => c - 1)
    }
    setBusy(false)
  }

  const arrow = (
    <svg viewBox="0 0 24 24" className={overlay ? 'h-6 w-6' : compact ? 'h-4 w-4' : 'h-5 w-5'} fill={voted ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 4 4 13h5v7h6v-7h5z" strokeLinejoin="round" />
    </svg>
  )

  if (overlay)
    return (
      <button
        onClick={vote}
        disabled={busy}
        aria-pressed={voted}
        aria-label={voted ? `Upvoted, ${count} upvotes` : `Upvote, ${count} upvotes`}
        className="flex flex-col items-center gap-1 text-xs font-semibold text-white focus-visible:outline-2 focus-visible:outline-white"
      >
        <span className={`grid h-12 w-12 place-items-center rounded-full backdrop-blur ${voted ? 'bg-brand text-white' : 'bg-black/35 hover:bg-black/50'}`}>{arrow}</span>
        {count}
      </button>
    )

  return (
    <button
      onClick={vote}
      disabled={busy}
      aria-pressed={voted}
      aria-label={voted ? `Upvoted, ${count} upvotes` : `Upvote, ${count} upvotes`}
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold transition focus-visible:outline-2 focus-visible:outline-brand ${
        compact ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-sm'
      } ${voted ? 'bg-brand-soft text-brand' : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800'}`}
    >
      {arrow}
      {count}
    </button>
  )
}
