import { useEffect, useState, type MouseEvent } from 'react'
import { Link } from 'react-router'
import Avatar from '../components/Avatar'
import { postPath } from '../components/PostCard'
import SnapModal from '../components/SnapModal'
import { CardSkeleton, EmptyState, ErrorState } from '../components/Status'
import { IMAGE_PROXY } from '../config'
import { firstImage, summary, timeAgo } from '../lib/hive'
import { invalidateCache } from '../lib/rpc'
import { getOnFireFeed, getShortFormFeed, SHORT_FORM_SOURCES, type ShortFormItem } from '../lib/shortform'
import { useTitle } from '../lib/useTitle'
import { useAuth } from '../state/auth'
import { usePrefs } from '../state/prefs'

type View = 'new' | 'fire'

/** Left-click opens the item in the modal; a modified/middle/right click behaves like a normal link. */
function openInModal(e: MouseEvent, onOpen: () => void) {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
  e.preventDefault()
  onOpen()
}

export default function Snaps() {
  useTitle('Snaps')
  const { account } = useAuth()
  const { showNsfw } = usePrefs()
  const [view, setView] = useState<View>('new')
  const [items, setItems] = useState<ShortFormItem[] | null>(null)
  const [error, setError] = useState(false)
  const [only, setOnly] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [open, setOpen] = useState<ShortFormItem | null>(null)

  useEffect(() => {
    let off = false
    setItems(null)
    setError(false)
    const load = view === 'fire' ? getOnFireFeed(account ?? '', showNsfw) : getShortFormFeed(account ?? '', showNsfw)
    load.then((r) => !off && setItems(r)).catch(() => !off && setError(true))
    return () => {
      off = true
    }
  }, [account, showNsfw, view, attempt])

  const shown = only ? items?.filter((p) => p.source === only) : items

  return (
    <>
      <div className="mb-1 flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-extrabold tracking-tight">Snaps</h1>
          <p className="text-sm text-muted">
            {view === 'fire'
              ? 'The most-replied-to snaps from the last few days, busiest first.'
              : 'Quick, short-form posts from across Hive — Snaps, Threads and Waves, newest first.'}
          </p>
        </div>
        <Link to="/snaps/new" className="btn-primary btn-sm shrink-0">
          + New snap
        </Link>
      </div>

      <div className="my-4 flex flex-wrap items-center gap-1" role="group" aria-label="View">
        <button className={`chip ${view === 'new' ? 'chip-on' : 'chip-off'}`} onClick={() => setView('new')}>
          🕒 New
        </button>
        <button className={`chip ${view === 'fire' ? 'chip-on' : 'chip-off'}`} onClick={() => setView('fire')}>
          🔥 On Fire
        </button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-1" role="group" aria-label="Filter by source">
        <button className={`chip ${only === null ? 'chip-on' : 'chip-off'}`} onClick={() => setOnly(null)}>
          All
        </button>
        {SHORT_FORM_SOURCES.map((s) => (
          <button key={s.key} className={`chip ${only === s.key ? 'chip-on' : 'chip-off'}`} onClick={() => setOnly(s.key)}>
            {s.icon} {s.label}
          </button>
        ))}
        <button
          className="icon-btn ml-auto"
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

      {error && !items ? (
        <ErrorState onRetry={() => setAttempt((a) => a + 1)} />
      ) : !items ? (
        <CardSkeleton />
      ) : shown && shown.length === 0 ? (
        <EmptyState emoji="🌙" title="Nothing here right now">
          <p>{view === 'fire' ? 'Nothing has picked up much conversation lately.' : 'These feeds rotate every few hours. Check back soon, or try a different source.'}</p>
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {shown!.map((p) => {
            const source = SHORT_FORM_SOURCES.find((s) => s.key === p.source)
            const img = firstImage(p)
            const text = summary(p.body, 220)
            return (
              <li key={`${p.source}-${p.author}-${p.permlink}`} className="card p-4">
                <div className="mb-2 flex items-center gap-2.5 text-sm">
                  <Link to={`/u/${p.author}`} aria-hidden tabIndex={-1} className="shrink-0">
                    <Avatar account={p.author} size={32} />
                  </Link>
                  <div className="min-w-0 flex-1 leading-tight">
                    <Link to={`/u/${p.author}`} className="block truncate font-semibold hover:underline">
                      @{p.author}
                    </Link>
                    <span className="block truncate text-xs text-muted">
                      {source ? `${source.icon} ${source.label}` : ''} · {timeAgo(p.created)}
                    </span>
                  </div>
                </div>
                <Link to={postPath(p)} className="group block" onClick={(e) => openInModal(e, () => setOpen(p))}>
                  {text && <p className="text-sm group-hover:underline">{text}</p>}
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
                  <div className={`mt-2 text-xs ${view === 'fire' ? 'font-bold text-brand' : 'text-muted'}`}>💬 {p.children}</div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}

      {open && <SnapModal author={open.author} permlink={open.permlink} onClose={() => setOpen(null)} />}
    </>
  )
}
