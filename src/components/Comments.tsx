import { useState } from 'react'
import { Link } from 'react-router'
import { postKey, timeAgo, upvoteCount, type Post } from '../lib/hive'
import Avatar from './Avatar'
import CommentBox from './CommentBox'
import Markdown from './Markdown'
import VoteButton from './VoteButton'
import RewardInfo from './RewardInfo'
import { postPath } from './PostCard'

const MAX_DEPTH = 6

export interface Thread {
  all: Record<string, Post>
  /** Comments added in this session, keyed by parent. Entries without a url are still sending. */
  extra: Record<string, Post[]>
  add: (c: Post) => void
  remove: (c: Post) => void
}

export function childrenOf(p: Post, t: Thread): Post[] {
  const fromApi = p.replies.map((k) => t.all[k]).filter((c): c is Post => !!c && !c.stats?.hide)
  fromApi.sort((a, b) => upvoteCount(b) - upvoteCount(a) || a.created.localeCompare(b.created))
  const mine = t.extra[postKey(p)] ?? []
  return [...mine, ...fromApi.filter((c) => !mine.some((m) => m.permlink === c.permlink && m.author === c.author))]
}

function CommentItem({ c, t, level }: { c: Post; t: Thread; level: number }) {
  const [replying, setReplying] = useState(false)
  const [collapsed, setCollapsed] = useState(!!c.stats?.gray)
  const kids = childrenOf(c, t)
  const pending = !c.url
  return (
    <li className={level > 0 ? 'border-l-2 border-zinc-200 pl-3 sm:pl-4 dark:border-zinc-800' : ''}>
      <div className="py-3">
        <div className="flex items-center gap-2 text-sm">
          <Link to={`/u/${c.author}`} className="flex items-center gap-2 font-semibold hover:underline">
            <Avatar account={c.author} size={24} />@{c.author}
          </Link>
          <span className="text-muted">· {pending ? 'sending…' : timeAgo(c.created)}</span>
          {c.stats?.gray && (
            <button className="ml-auto text-xs text-muted underline" onClick={() => setCollapsed((x) => !x)}>
              {collapsed ? 'Show hidden comment' : 'Hide'}
            </button>
          )}
        </div>
        {!collapsed && (
          <>
            <Markdown source={c.body} className="prose-sm mt-1" />
            {!pending && (
              <div className="-ml-2 mt-1 flex items-center gap-1">
                <VoteButton post={c} compact />
                <button className="rounded-full px-2.5 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800" onClick={() => setReplying((r) => !r)} aria-expanded={replying}>
                  Reply
                </button>
                <RewardInfo post={c} />
              </div>
            )}
            {replying && (
              <div className="mt-2">
                <CommentBox parent={c} onPosted={t.add} onRemoved={t.remove} onCancel={() => setReplying(false)} autoFocus placeholder={`Reply to @${c.author}…`} />
              </div>
            )}
          </>
        )}
      </div>
      {kids.length > 0 &&
        (level + 1 >= MAX_DEPTH ? (
          <Link to={postPath(c)} className="mb-3 inline-block text-sm font-semibold text-brand hover:underline">
            Continue this thread ({kids.length} {kids.length === 1 ? 'reply' : 'replies'}) →
          </Link>
        ) : (
          <ul>
            {kids.map((k) => (
              <CommentItem key={postKey(k)} c={k} t={t} level={level + 1} />
            ))}
          </ul>
        ))}
    </li>
  )
}

export default function Comments({ root, t }: { root: Post; t: Thread }) {
  const kids = childrenOf(root, t)
  return (
    <section id="comments" aria-labelledby="comments-h" className="mt-6">
      <h2 id="comments-h" className="mb-3 text-lg font-bold">
        {kids.length ? `Comments (${Math.max(root.children, kids.length)})` : 'Comments'}
      </h2>
      <div className="card p-4">
        <CommentBox parent={root} onPosted={t.add} onRemoved={t.remove} />
      </div>
      {kids.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">No comments yet. Start the conversation! 💬</p>
      ) : (
        <ul className="mt-2">
          {kids.map((k) => (
            <CommentItem key={postKey(k)} c={k} t={t} level={0} />
          ))}
        </ul>
      )}
    </section>
  )
}
