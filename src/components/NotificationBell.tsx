import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { getNotifications, notificationIcon, notificationPath, timeAgo, type Notification } from '../lib/hive'
import { load, save } from '../lib/storage'
import { useAuth } from '../state/auth'

const POLL_MS = 60_000

export default function NotificationBell() {
  const { account } = useAuth()
  const [items, setItems] = useState<Notification[] | null>(null)
  const [seenId, setSeenId] = useState(0)
  const [open, setOpen] = useState(false)
  const loc = useLocation()
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setSeenId(account ? load(`hh.notifSeen.${account}`, 0) : 0)
  }, [account])

  useEffect(() => {
    if (!account) return
    let off = false
    const poll = () => {
      getNotifications(account, 30)
        .then((r) => !off && setItems(r))
        .catch(() => {})
    }
    poll()
    const t = setInterval(poll, POLL_MS)
    return () => {
      off = true
      clearInterval(t)
    }
  }, [account])

  useEffect(() => {
    setOpen(false)
  }, [loc.pathname])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    const onClick = (e: MouseEvent) => !menuRef.current?.contains(e.target as Node) && setOpen(false)
    document.addEventListener('keydown', onKey)
    document.addEventListener('click', onClick)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('click', onClick)
    }
  }, [open])

  if (!account) return null

  const unread = items?.filter((n) => n.id > seenId).length ?? 0

  const markSeen = () => {
    if (!items?.length) return
    const newest = Math.max(...items.map((n) => n.id))
    setSeenId(newest)
    save(`hh.notifSeen.${account}`, newest)
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        className="icon-btn relative"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        onClick={() => {
          const next = !open
          setOpen(next)
          if (next) markSeen()
        }}
      >
        🔔
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div role="menu" className="card absolute right-0 z-40 mt-2 max-h-96 w-80 overflow-y-auto p-1 shadow-lg">
          {!items ? (
            <p className="p-4 text-center text-sm text-muted">Loading…</p>
          ) : items.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted">No notifications yet.</p>
          ) : (
            items.map((n) => {
              const path = notificationPath(n)
              const body = (
                <>
                  <span className="text-base" aria-hidden>
                    {notificationIcon(n.type)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm">{n.msg}</span>
                    <span className="block text-xs text-muted">{timeAgo(n.date)}</span>
                  </span>
                </>
              )
              return path ? (
                <Link
                  key={n.id}
                  role="menuitem"
                  to={path}
                  className="flex items-start gap-2.5 rounded-2xl px-3 py-2.5 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  {body}
                </Link>
              ) : (
                <div key={n.id} role="menuitem" className="flex items-start gap-2.5 rounded-2xl px-3 py-2.5">
                  {body}
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
