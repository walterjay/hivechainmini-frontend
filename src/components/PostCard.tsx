import { Link } from 'react-router'
import { IMAGE_PROXY } from '../config'
import { firstImage, summary, timeAgo, type Post } from '../lib/hive'
import Avatar from './Avatar'
import VoteButton from './VoteButton'
import FollowButton from './FollowButton'
import RewardInfo from './RewardInfo'

export const postPath = (p: { author: string; permlink: string }) => `/p/${p.author}/${p.permlink}`

export default function PostCard({ post, showCommunity = true, showFollow = true }: { post: Post; showCommunity?: boolean; showFollow?: boolean }) {
  const img = firstImage(post)
  const text = summary(post.body)
  return (
    <article className="card p-4 sm:p-5">
      <header className="mb-2 flex items-center gap-2.5 text-sm">
        <Link to={`/u/${post.author}`} aria-hidden tabIndex={-1}>
          <Avatar account={post.author} size={32} />
        </Link>
        <div className="min-w-0 flex-1 leading-tight">
          <Link to={`/u/${post.author}`} className="block truncate font-semibold hover:underline">
            @{post.author}
          </Link>
          <span className="block truncate text-xs text-muted">
            {showCommunity && post.community && post.community_title && (
              <>
                <Link to={`/c/${post.community}`} className="font-medium hover:underline">
                  {post.community_title}
                </Link>
                {' · '}
              </>
            )}
            <time dateTime={post.created + 'Z'}>{timeAgo(post.created)}</time>
            {post.stats?.is_pinned && ' · 📌 Pinned'}
          </span>
        </div>
        {showFollow && (
          <span className="shrink-0">
            <FollowButton account={post.author} small />
          </span>
        )}
      </header>
      <Link to={postPath(post)} className="group flex gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg leading-snug font-bold group-hover:underline sm:text-xl">
            {post.depth > 0 ? `Replied to @${post.parent_author}` : post.title}
          </h2>
          {text && <p className="mt-1 line-clamp-3 text-sm text-muted">{text}</p>}
        </div>
        {img && (
          <img
            src={`${IMAGE_PROXY}/256x0/${img}`}
            alt=""
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            className="h-20 w-20 shrink-0 rounded-2xl bg-zinc-100 object-cover sm:h-24 sm:w-24 dark:bg-zinc-800"
            onError={(e) => (e.currentTarget.style.display = 'none')}
          />
        )}
      </Link>
      <footer className="mt-3 -ml-2 flex items-center gap-1">
        <VoteButton post={post} />
        <Link
          to={postPath(post) + '#comments'}
          className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          aria-label={`${post.children} comments`}
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M4 5h16v11H9l-5 4z" strokeLinejoin="round" />
          </svg>
          {post.children}
        </Link>
        <RewardInfo post={post} />
      </footer>
    </article>
  )
}
