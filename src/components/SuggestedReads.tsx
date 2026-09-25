import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { IMAGE_PROXY } from '../config'
import { firstImage, getRankedPosts, postKey, visible, type Post } from '../lib/hive'
import { postPath } from './PostCard'

/** A few more posts to read next, from the same community when there is one. */
export default function SuggestedReads({ current, observer }: { current: Post; observer: string }) {
  const [posts, setPosts] = useState<Post[] | null>(null)
  const tag = current.community ?? ''
  const key = postKey(current)

  useEffect(() => {
    let off = false
    setPosts(null)
    getRankedPosts(tag, 'trending', observer, 8)
      .then((r) => {
        if (off) return
        const picks = r.filter((p) => visible(p) && postKey(p) !== key).slice(0, 3)
        setPosts(picks)
      })
      .catch(() => !off && setPosts([]))
    return () => {
      off = true
    }
  }, [tag, observer, key])

  if (!posts?.length) return null

  return (
    <div className="card mt-4 p-4 sm:p-5">
      <h2 className="mb-3 text-sm font-bold text-muted uppercase tracking-wide">Keep reading</h2>
      <ul className="space-y-3">
        {posts.map((p) => {
          const img = firstImage(p)
          return (
            <li key={postKey(p)}>
              <Link to={postPath(p)} className="group flex items-center gap-3">
                {img ? (
                  <img
                    src={`${IMAGE_PROXY}/128x128/${img}`}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    referrerPolicy="no-referrer"
                    className="h-14 w-14 shrink-0 rounded-xl bg-zinc-100 object-cover dark:bg-zinc-800"
                    onError={(e) => (e.currentTarget.style.display = 'none')}
                  />
                ) : (
                  <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-zinc-100 text-lg dark:bg-zinc-800" aria-hidden>
                    📖
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold group-hover:underline">{p.title || `Comment by @${p.author}`}</div>
                  <div className="truncate text-xs text-muted">@{p.author}</div>
                </div>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
