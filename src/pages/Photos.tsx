import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'
import Avatar from '../components/Avatar'
import Dialog from '../components/Dialog'
import FollowButton from '../components/FollowButton'
import PhotoLightbox, { fullPostLabel } from '../components/PhotoLightbox'
import { postPath } from '../components/PostCard'
import VoteButton from '../components/VoteButton'
import { IMAGE_PROXY } from '../config'
import { MIN_REPUTATION } from '../lib/photo-filters'
import { createPhotoFeed, type PhotoFilter, type PhotoItem } from '../lib/photos'
import { invalidateCache } from '../lib/rpc'
import { checkImage, loadSafetyModel } from '../lib/safety'
import { load, save } from '../lib/storage'
import { timeAgo } from '../lib/hive'
import { useTitle } from '../lib/useTitle'
import { useAuth } from '../state/auth'
import { useToast } from '../state/toast'

type Status = 'loading' | 'ready' | 'error' | 'no-checker'

const FILTERS: { id: PhotoFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'snaps', label: 'Snaps' },
  { id: 'posts', label: 'Posts' },
]

const HIDDEN_KEY = 'hh.photos.hidden'
interface Hidden {
  people: string[]
  posts: string[]
}

/**
 * One feed (per filter and viewer) kept in memory for the whole visit, so
 * leaving Photos to open a post and coming back lands on the same photo in the
 * same list. It only starts over when the user taps refresh or reloads the page.
 */
interface FeedSession {
  key: string
  feed: ReturnType<typeof createPhotoFeed>
  items: PhotoItem[]
  status: Status
  done: boolean
  busy: boolean
  heldBack: number
  /** The slide on screen when the user left. */
  index: number
  listeners: Set<() => void>
}

const sessions = new Map<string, FeedSession>()

function sessionFor(filter: PhotoFilter, observer: string): FeedSession {
  const key = `${filter}|${observer}`
  let s = sessions.get(key)
  if (!s) {
    s = { key, feed: createPhotoFeed(filter, observer), items: [], status: 'loading', done: false, busy: false, heldBack: 0, index: 0, listeners: new Set() }
    sessions.set(key, s)
  }
  return s
}

function update(s: FeedSession, patch: Partial<FeedSession>) {
  Object.assign(s, patch)
  s.listeners.forEach((fn) => fn())
}

/**
 * Loads more of the feed, only letting an item through once every one of its
 * pictures has passed the on-device safety check. Keeps going if the user
 * navigates away mid-load; stops if the feed was refreshed meanwhile.
 */
async function pump(s: FeedSession) {
  if (s.busy || s.done || s.status === 'no-checker' || s.status === 'error') return
  const alive = () => sessions.get(s.key) === s
  update(s, { busy: true })
  try {
    try {
      await loadSafetyModel()
    } catch {
      update(s, { status: 'no-checker' })
      return
    }
    let added = 0
    while (added < 6 && !s.feed.done && alive()) {
      const batch = await s.feed.next()
      // Start every check at once, then reveal in feed order.
      const checks = batch.map((it) => Promise.all(it.images.map(checkImage)))
      for (let i = 0; i < batch.length; i++) {
        const verdicts = await checks[i]
        if (verdicts.every((v) => v === 'safe')) {
          added++
          update(s, { items: [...s.items, batch[i]], status: 'ready' })
        } else if (verdicts.includes('unsafe')) update(s, { heldBack: s.heldBack + 1 })
        // A picture that didn't load is simply skipped.
      }
    }
    update(s, { done: s.feed.done, status: s.status === 'loading' ? 'ready' : s.status })
  } catch {
    update(s, { status: 'error' })
  } finally {
    update(s, { busy: false })
  }
}

function usePhotoFeed(filter: PhotoFilter, observer: string) {
  const [attempt, setAttempt] = useState(0)
  // `attempt` makes this pick up the fresh session after a refresh.
  const session = useMemo(() => sessionFor(filter, observer), [filter, observer, attempt])
  const [, rerender] = useReducer((n: number) => n + 1, 0)

  useEffect(() => {
    session.listeners.add(rerender)
    pump(session)
    return () => {
      session.listeners.delete(rerender)
    }
  }, [session])

  const reload = useCallback(() => {
    invalidateCache()
    sessions.delete(session.key)
    setAttempt((a) => a + 1)
  }, [session])

  return { session, more: () => pump(session), reload }
}

const railBtn = 'grid h-12 w-12 place-items-center rounded-full bg-black/35 text-xl backdrop-blur hover:bg-black/50 focus-visible:outline-2 focus-visible:outline-white'

function MoreMenu({ item, onHide }: { item: PhotoItem; onHide: (what: 'post' | 'person') => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('click', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('click', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])
  const itemCls = 'block w-full rounded-2xl px-4 py-2.5 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800'
  return (
    <div className="relative" ref={ref}>
      <button className={railBtn} aria-label="More options" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        ⋯
      </button>
      {open && (
        <div role="menu" className="card absolute right-14 bottom-0 z-20 w-60 overflow-hidden p-1 text-zinc-900 shadow-lg dark:text-zinc-100">
          <Link role="menuitem" to={postPath(item.post)} className={itemCls}>
            📄 Open the full post
          </Link>
          <button role="menuitem" className={itemCls} onClick={() => onHide('post')}>
            🙈 Hide this photo
          </button>
          <button role="menuitem" className={itemCls} onClick={() => onHide('person')}>
            🚫 Hide photos from @{item.post.author}
          </button>
        </div>
      )}
    </div>
  )
}

function Slide({ item, eager, onHide }: { item: PhotoItem; eager: boolean; onHide: (what: 'post' | 'person') => void }) {
  const toast = useToast()
  const [pic, setPic] = useState(0)
  const [expanded, setExpanded] = useState(false)
  const [viewing, setViewing] = useState<number | null>(null)
  const p = item.post
  const alt = item.title || item.caption.slice(0, 120) || `Photo by @${p.author}`

  async function share() {
    const url = location.origin + postPath(p)
    try {
      if (navigator.share) await navigator.share({ url, title: item.title || `Photo by @${p.author}` })
      else {
        await navigator.clipboard.writeText(url)
        toast('Link copied 📋')
      }
    } catch {
      /* the user closed the share sheet */
    }
  }

  return (
    <section aria-label={`Photo by @${p.author}`} className="flex h-full snap-start snap-always items-center justify-center sm:py-4">
      <div className="relative h-full w-full overflow-hidden bg-black sm:aspect-[3/4] sm:w-auto sm:max-w-full sm:rounded-3xl">
        <div
          className="flex h-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none]"
          onScroll={(e) => setPic(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
        >
          {item.images.map((url, i) => (
            <div key={url} className="relative h-full w-full shrink-0 snap-center">
              <img
                aria-hidden
                alt=""
                src={`${IMAGE_PROXY}/64x0/${url}`}
                referrerPolicy="no-referrer"
                className="absolute inset-0 h-full w-full scale-110 object-cover opacity-50 blur-2xl"
              />
              <button className="relative block h-full w-full cursor-zoom-in" aria-label="View photo full screen" onClick={() => setViewing(i)}>
                <img
                  src={`${IMAGE_PROXY}/1080x0/${url}`}
                  alt={item.images.length > 1 ? `${alt} (${i + 1} of ${item.images.length})` : alt}
                  loading={eager && i === 0 ? 'eager' : 'lazy'}
                  decoding="async"
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-contain"
                />
              </button>
            </div>
          ))}
        </div>

        {item.images.length > 1 && (
          <div className="pointer-events-none absolute inset-x-0 top-16 flex justify-center gap-1.5" aria-hidden>
            {item.images.map((u, i) => (
              <span key={u} className={`h-1.5 rounded-full transition-all ${i === pic ? 'w-4 bg-white' : 'w-1.5 bg-white/50'}`} />
            ))}
          </div>
        )}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent px-4 pt-20 pr-20 pb-4 text-white">
          <div className="pointer-events-auto flex items-center gap-2">
            <Link to={`/u/${p.author}`} className="flex min-w-0 items-center gap-2 font-semibold hover:underline">
              <Avatar account={p.author} size={36} className="ring-2 ring-white/70" />
              <span className="truncate">@{p.author}</span>
            </Link>
            <FollowButton account={p.author} small />
          </div>
          <p className="mt-1 text-xs text-white/70">
            {item.via} · {timeAgo(p.created)}
          </p>
          {item.title && (
            <Link to={postPath(p)} className="pointer-events-auto mt-2 block leading-snug font-bold hover:underline">
              {item.title}
            </Link>
          )}
          {item.caption && (
            <button
              className={`pointer-events-auto mt-1 block w-full text-left text-sm ${expanded ? 'max-h-40 overflow-y-auto' : 'line-clamp-2'}`}
              aria-expanded={expanded}
              onClick={() => setExpanded((e) => !e)}
            >
              {item.caption}
            </button>
          )}
          <Link
            to={postPath(p)}
            className="pointer-events-auto mt-3 inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-zinc-900 shadow hover:bg-zinc-200 focus-visible:outline-2 focus-visible:outline-white"
          >
            {fullPostLabel(item)} →
          </Link>
        </div>

        <span className="pointer-events-none absolute top-16 right-3 rounded-full bg-black/45 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur" aria-hidden>
          ⤢ Tap to enlarge
        </span>

        {viewing !== null && <PhotoLightbox item={item} start={viewing} onClose={() => setViewing(null)} />}

        <div className="absolute right-3 bottom-6 flex flex-col items-center gap-4 text-white">
          <VoteButton post={p} overlay />
          <Link to={postPath(p)} className="flex flex-col items-center gap-1 text-xs font-semibold" aria-label={`${p.children} comments`}>
            <span className={railBtn} aria-hidden>
              💬
            </span>
            {p.children}
          </Link>
          <button className={railBtn} aria-label="Share" onClick={share}>
            ↗️
          </button>
          <MoreMenu item={item} onHide={onHide} />
        </div>
      </div>
    </section>
  )
}

function TailSlide({ children }: { children: ReactNode }) {
  return <section className="flex h-full snap-start flex-col items-center justify-center gap-3 px-8 text-center text-white">{children}</section>
}

function SafetyInfo({ heldBack, onClose }: { heldBack: number; onClose: () => void }) {
  return (
    <Dialog title="🛡️ How Photos stays safe" onClose={onClose}>
      <div className="space-y-3 text-sm">
        <p>Photos is for everyone, so it’s strict about what it shows. Every picture goes through these checks first:</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Posts marked 18+, from 18+ communities, or hidden by community moderators are skipped.</li>
          <li>People whose reputation has dropped below {MIN_REPUTATION} (other users flagged them) are skipped.</li>
          <li>Only photos uploaded to Hive’s own image hosts, no videos, GIFs, game or bot posts.</li>
          <li>
            Each picture is scanned <strong>on your device</strong> by a small AI model before it appears. Nothing is sent anywhere for
            this.
          </li>
        </ul>
        <p className="text-muted">
          {heldBack > 0 ? `${heldBack} post${heldBack === 1 ? '' : 's'} held back by the scan so far.` : 'Nothing held back by the scan yet.'}
        </p>
        <p className="text-muted">No filter is perfect. If something slips through, tap ⋯ and hide the photo or the person.</p>
      </div>
    </Dialog>
  )
}

export default function Photos() {
  useTitle('Photos')
  const { account } = useAuth()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const filter = FILTERS.find((f) => f.id === params.get('from'))?.id ?? 'all'
  const { session, more, reload } = usePhotoFeed(filter, account ?? '')
  const { items, status, done, busy, heldBack } = session
  const [hidden, setHidden] = useState<Hidden>(() => load(HIDDEN_KEY, { people: [], posts: [] }))
  const [info, setInfo] = useState(false)
  const [index, setIndex] = useState(0)
  const scroller = useRef<HTMLDivElement>(null)

  const shown = items.filter((it) => !hidden.people.includes(it.post.author) && !hidden.posts.includes(it.key))

  // Back on the photo the user left from (top for a new or refreshed feed).
  useLayoutEffect(() => {
    const el = scroller.current
    if (el) el.scrollTop = session.index * el.clientHeight
    setIndex(session.index)
  }, [session])

  // Keep a few checked photos ready ahead of the one on screen.
  useEffect(() => {
    if (status === 'ready' && !done && !busy && shown.length - index < 5) more()
  }, [status, done, busy, shown.length, index, more])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = scroller.current
      if (!el || (e.target as HTMLElement).closest('input, textarea, dialog, [role="menu"]')) return
      const dir = e.key === 'ArrowDown' || e.key === 'j' ? 1 : e.key === 'ArrowUp' || e.key === 'k' ? -1 : 0
      if (!dir) return
      e.preventDefault()
      el.scrollBy({ top: dir * el.clientHeight, behavior: 'smooth' })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function hide(item: PhotoItem, what: 'post' | 'person') {
    const next =
      what === 'post'
        ? { ...hidden, posts: [...hidden.posts, item.key].slice(-500) }
        : { ...hidden, people: [...new Set([...hidden.people, item.post.author])] }
    setHidden(next)
    save(HIDDEN_KEY, next)
    toast(what === 'post' ? 'Photo hidden.' : `You won’t see photos from @${item.post.author} here anymore.`)
  }

  const chip = (on: boolean) =>
    `rounded-full px-3.5 py-1.5 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-white ${
      on ? 'bg-white text-zinc-900' : 'text-white/85 hover:bg-white/15'
    }`

  return (
    <div className="fixed inset-x-0 top-14 bottom-[calc(3.75rem+1px+env(safe-area-inset-bottom))] bg-zinc-950 sm:bottom-0">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center gap-1 bg-gradient-to-b from-black/60 to-transparent px-3 pt-3 pb-6">
        <div className="pointer-events-auto flex gap-1" role="group" aria-label="Show">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              className={chip(filter === f.id)}
              aria-pressed={filter === f.id}
              onClick={() => setParams(f.id === 'all' ? {} : { from: f.id }, { replace: true })}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="pointer-events-auto ml-auto flex items-center gap-1">
          <button className="grid h-9 w-9 place-items-center rounded-full text-lg hover:bg-white/15" aria-label="How Photos stays safe" onClick={() => setInfo(true)}>
            🛡️
          </button>
          <button className="grid h-9 w-9 place-items-center rounded-full text-lg hover:bg-white/15" aria-label="Refresh" onClick={reload}>
            🔄
          </button>
          <Link to="/photos/new" className="btn-primary btn-sm whitespace-nowrap">
            + Photo
          </Link>
        </div>
      </div>

      <div
        ref={scroller}
        onScroll={(e) => {
          const i = Math.round(e.currentTarget.scrollTop / e.currentTarget.clientHeight)
          session.index = i
          setIndex(i)
        }}
        className="h-full snap-y snap-mandatory overflow-y-auto overscroll-contain [scrollbar-width:none]"
      >
        {shown.map((it, i) => (
          <Slide key={it.key} item={it} eager={Math.abs(i - index) < 2} onHide={(what) => hide(it, what)} />
        ))}

        {status === 'no-checker' ? (
          <TailSlide>
            <div className="text-4xl">🛡️</div>
            <h2 className="text-lg font-bold">Photos needs its safety check</h2>
            <p className="max-w-sm text-sm text-white/70">
              Every picture is checked on your device before it’s shown, and that check couldn’t start in this browser. Try reloading, or
              use Snaps and Posts instead.
            </p>
            <button className="btn-ghost mt-2" onClick={reload}>
              Try again
            </button>
          </TailSlide>
        ) : status === 'error' && shown.length === 0 ? (
          <TailSlide>
            <div className="text-4xl">🌧️</div>
            <h2 className="text-lg font-bold">We couldn’t load photos right now</h2>
            <p className="text-sm text-white/70">The Hive network is a little busy. It usually clears up in a moment.</p>
            <button className="btn-ghost mt-2" onClick={reload}>
              Try again
            </button>
          </TailSlide>
        ) : done ? (
          <TailSlide>
            <div className="text-4xl">🎉</div>
            <h2 className="text-lg font-bold">You’re all caught up</h2>
            <p className="text-sm text-white/70">That’s everything from the last few days.</p>
            <Link to="/photos/new" className="btn-primary mt-2">
              Share a photo
            </Link>
          </TailSlide>
        ) : null}
      </div>

      {/* Loading states sit outside the scroller: a snap point there would be re-snapped to as photos are added above it. */}
      {shown.length === 0 && (status === 'loading' || status === 'ready') && !done && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white" role="status">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-hidden />
          <p className="text-sm text-white/70">Finding photos and checking they’re safe…</p>
        </div>
      )}
      {shown.length > 0 && busy && index >= shown.length - 1 && (
        <div className="pointer-events-none absolute inset-x-0 top-24 flex justify-center" role="status">
          <span className="rounded-full bg-black/60 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur">Loading more photos…</span>
        </div>
      )}

      {info && <SafetyInfo heldBack={heldBack} onClose={() => setInfo(false)} />}
    </div>
  )
}
