import { useEffect, type MouseEvent } from 'react'
import { Link } from 'react-router'
import { timeAgo } from '../lib/hive'
import { useDiscussion } from '../lib/useDiscussion'
import { useAuth } from '../state/auth'
import Avatar from './Avatar'
import Comments from './Comments'
import FollowButton from './FollowButton'
import Markdown from './Markdown'
import RewardInfo from './RewardInfo'
import { EmptyState, ErrorState, Spinner } from './Status'
import VoteButton from './VoteButton'

/** Left-click opens the item in the modal; a modified/middle/right click behaves like a normal link. */
export function openInModal(e: MouseEvent, onOpen: () => void) {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
  e.preventDefault()
  onOpen()
}

/** A snap opened over the feed instead of navigating away, so closing it resumes right where you were. */
export default function SnapModal({ author, permlink, onClose }: { author: string; permlink: string; onClose: () => void }) {
  const { account } = useAuth()
  const { root, thread, state, retry } = useDiscussion(author, permlink, account ?? '')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4 pt-10 sm:pt-16"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="card relative mx-auto w-full max-w-lg p-5 sm:p-6 lg:max-w-4xl lg:p-8"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Snap"
      >
        <button className="icon-btn absolute top-3 right-3" aria-label="Close" onClick={onClose}>
          ✕
        </button>

        {state === 'loading' ? (
          <Spinner label="Opening…" />
        ) : state === 'error' ? (
          <ErrorState onRetry={retry} />
        ) : state === 'missing' || !root ? (
          <EmptyState emoji="🫥" title="We couldn’t find that">
            <p>It may have been removed.</p>
          </EmptyState>
        ) : (
          <>
            <div className="mb-3 flex items-center gap-3 pr-8">
              <Link to={`/u/${root.author}`} aria-label={`@${root.author}'s profile`}>
                <Avatar account={root.author} size={40} />
              </Link>
              <div className="min-w-0 flex-1 text-sm">
                <Link to={`/u/${root.author}`} className="font-bold hover:underline">
                  @{root.author}
                </Link>
                <div className="text-muted">
                  <time dateTime={root.created + 'Z'}>{timeAgo(root.created)}</time>
                </div>
              </div>
              <FollowButton account={root.author} small />
            </div>
            <Markdown source={root.body} />
            <div className="mt-4 -ml-2 flex items-center gap-2 border-t border-zinc-200 pt-3 dark:border-zinc-800">
              <VoteButton post={root} />
              <span className="rounded-full px-3.5 py-1.5 text-sm font-semibold text-zinc-700 dark:text-zinc-300">💬 {root.children}</span>
              <RewardInfo post={root} />
            </div>
            <div className="mt-2">
              <Comments root={root} t={thread} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
