import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { IMAGE_PROXY } from '../config'
import { firstImage, getRankedPosts, isNsfw, postKey, visible, type Post } from '../lib/hive'
import { usePrefs } from '../state/prefs'
import { postPath } from './PostCard'

/** A few more posts to read next, from the same community when there is one. */
export default function SuggestedReads({ current, observer }: { current: Post; observer: string }) {
  const [posts, setPosts] = useState<Post[] | null>(null)
  const { showNsfw } = usePrefs()
  const tag = current.community ?? ''
  const key = postKey(current)

  useEffect(() => {
    let off = false
    setPosts(null)
    getRankedPosts(tag, 'trending', observer, 8)
      .then((r) => {
        if (off) return
        const picks = r.filter((p) => visible(p) && (showNsfw || !isNsfw(p)) && postKey(p) !== key).slice(0, 3)
        setPosts(picks)
      })
      .catch(() => !off && setPosts([]))
    return () => {
      off = true
    }
  }, [tag, observer, key, showNsfw])

  if (!posts?.length) return null

  return (
    <div className="card p-4">
      <h2 className="mb-3 text-sm font-bold text-muted uppercase tracking-wide">Keep reading</h2>
      <ul className="space-y-4">
        {posts.map((p) => {
          const img = firstImage(p)
          return (
            <li key={postKey(p)}>
              <Link to={postPath(p)} className="group block">
                {img ? (
                  <img
                    src={`${IMAGE_PROXY}/384x128/${img}`}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    referrerPolicy="no-referrer"
                    className="mb-2 h-20 w-full rounded-xl bg-zinc-100 object-cover dark:bg-zinc-800"
                    onError={(e) => (e.currentTarget.style.display = 'none')}
                  />
                ) : (
                  <span className="mb-2 grid h-20 w-full place-items-center rounded-xl bg-zinc-100 text-2xl dark:bg-zinc-800" aria-hidden>
                    📖
                  </span>
                )}
                <div className="line-clamp-2 text-sm leading-snug font-semibold group-hover:underline">{p.title || `Comment by @${p.author}`}</div>
                <div className="mt-0.5 truncate text-xs text-muted">@{p.author}</div>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
