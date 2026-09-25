import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import Avatar from '../components/Avatar'
import { postPath } from '../components/PostCard'
import { CardSkeleton, EmptyState, ErrorState } from '../components/Status'
import { IMAGE_PROXY } from '../config'
import { firstImage, summary, timeAgo } from '../lib/hive'
import { getShortFormFeed, SHORT_FORM_SOURCES, type ShortFormItem } from '../lib/shortform'
import { useTitle } from '../lib/useTitle'
import { useAuth } from '../state/auth'
import { usePrefs } from '../state/prefs'

export default function Snaps() {
  useTitle('Snaps')
  const { account } = useAuth()
  const { showNsfw } = usePrefs()
  const [items, setItems] = useState<ShortFormItem[] | null>(null)
  const [error, setError] = useState(false)
  const [only, setOnly] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let off = false
    setItems(null)
    setError(false)
    getShortFormFeed(account ?? '', showNsfw)
      .then((r) => !off && setItems(r))
      .catch(() => !off && setError(true))
    return () => {
      off = true
    }
  }, [account, showNsfw, attempt])

  const shown = only ? items?.filter((p) => p.source === only) : items

  return (
    <>
      <div className="mb-1 flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold tracking-tight">Snaps</h1>
        <p className="text-sm text-muted">Quick, short-form posts from across Hive — Snaps, Threads and Waves, newest first.</p>
      </div>

      <div className="my-4 flex flex-wrap gap-1" role="group" aria-label="Filter by source">
        <button className={`chip ${only === null ? 'chip-on' : 'chip-off'}`} onClick={() => setOnly(null)}>
          All
        </button>
        {SHORT_FORM_SOURCES.map((s) => (
          <button key={s.key} className={`chip ${only === s.key ? 'chip-on' : 'chip-off'}`} onClick={() => setOnly(s.key)}>
            {s.icon} {s.label}
          </button>
        ))}
      </div>

      {error && !items ? (
        <ErrorState onRetry={() => setAttempt((a) => a + 1)} />
      ) : !items ? (
        <CardSkeleton />
      ) : shown && shown.length === 0 ? (
        <EmptyState emoji="🌙" title="Nothing here right now">
          <p>These feeds rotate every few hours. Check back soon, or try a different source.</p>
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {shown!.map((p) => {
            const source = SHORT_FORM_SOURCES.find((s) => s.key === p.source)
            const img = firstImage(p)
            const text = summary(p.body, 220)
            return (
              <li key={`${p.source}-${p.author}-${p.permlink}`} className="card p-4">
                <Link to={postPath(p)} className="group flex gap-3">
                  <Link to={`/u/${p.author}`} aria-hidden tabIndex={-1} className="shrink-0">
                    <Avatar account={p.author} size={40} />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-1.5 text-sm">
                      <span className="font-semibold">@{p.author}</span>
                      <span className="text-muted">·</span>
                      <span className="text-muted">
                        {source ? `${source.icon} ${source.label}` : ''} · {timeAgo(p.created)}
                      </span>
                    </div>
                    {text && <p className="mt-1 text-sm group-hover:underline">{text}</p>}
                    {img && (
                      <img
                        src={`${IMAGE_PROXY}/512x0/${img}`}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        referrerPolicy="no-referrer"
                        className="mt-2 max-h-64 w-full rounded-xl bg-zinc-100 object-cover dark:bg-zinc-800"
                        onError={(e) => (e.currentTarget.style.display = 'none')}
                      />
                    )}
                    <div className="mt-2 text-xs text-muted">💬 {p.children}</div>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
