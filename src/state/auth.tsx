import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Operation, Session } from '../auth/types'
import { keychainBroadcast } from '../auth/keychain'
import { load, save } from '../lib/storage'
import { friendlyError, isCancel } from '../lib/errors'
import { isMobile } from '../lib/device'
import { useToast } from './toast'
import LoginDialog from '../components/LoginDialog'
import Dialog from '../components/Dialog'

export type Milestone = 'vote' | 'comment' | 'post' | 'follow' | 'subscribe'

const CELEBRATIONS: Record<Milestone, string> = {
  vote: '🎉 Your first upvote! You just made someone’s day a little brighter.',
  comment: '🎉 Your first comment is live. Welcome to the conversation!',
  post: '🎉 Your first post is out in the world. Well done!',
  follow: '🎉 You followed your first person. Their posts will show up in Following.',
  subscribe: '🎉 You joined your first community on Hive!',
}

interface BroadcastOpts {
  /** Show a one-time celebration the first time this kind of action succeeds. */
  milestone?: Milestone
  /** Don't toast on error (used for background community syncs). */
  silent?: boolean
}

interface AuthValue {
  session: Session | null
  account: string | null
  /** Opens the login dialog if needed. Resolves with the account, or null if the user backs out. */
  ensureLogin: (reason?: string) => Promise<string | null>
  logout: () => void
  /** Signs and broadcasts with the posting key. Resolves true on success. */
  broadcast: (ops: Operation[] | ((account: string) => Operation[]), opts?: BroadcastOpts) => Promise<boolean>
  onLogin: (fn: (account: string) => void) => () => void
}

const AuthCtx = createContext<AuthValue | null>(null)

const SESSION_KEY = 'hh.session'
const NOTICE_KEY = 'hh.publicNoticeSeen'
/** Set once an account has approved something from this app, so the long how-to shows only at first. */
const approvedKey = (account: string) => `hh.approved.${account}`

/** What the wallet is being asked to approve right now. */
interface Waiting {
  method: 'keychain' | 'hiveauth'
  first: boolean
  uuid?: string
  link?: string
}

/** Tells the user where to approve, with a button that opens Keychain on phones. */
function ApprovalBanner({ w }: { w: Waiting }) {
  const mobile = isMobile()
  let title: string
  let tip: string | null = null
  if (w.method === 'keychain') {
    title = '🔑 Approve in the Hive Keychain window'
    if (w.first) tip = 'Tick “Do not prompt again” there and next time it goes through in one tap.'
  } else if (mobile) {
    title = '📱 Approve in Hive Keychain'
    if (w.first) tip = 'Tap the button, approve the request in Keychain, then come back to this tab.'
  } else {
    title = '📱 Open Hive Keychain on your phone to approve'
  }
  return (
    <div className="fixed inset-x-0 bottom-20 z-50 flex justify-center px-4 sm:bottom-6" role="status" aria-live="polite">
      <div className="flex max-w-md items-center gap-3 rounded-2xl bg-zinc-900 px-4 py-3 text-sm text-white shadow-lg dark:bg-zinc-100 dark:text-zinc-900">
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{title}</p>
          {tip && <p className="mt-0.5 opacity-80">{tip}</p>}
          {w.uuid && <p className="mt-0.5 text-xs opacity-60">Request {w.uuid.slice(0, 8)}</p>}
        </div>
        {w.method === 'hiveauth' && mobile && w.link && (
          <a href={w.link} className="btn-primary btn-sm shrink-0">
            Open Keychain
          </a>
        )}
      </div>
    </div>
  )
}

function initialSession(): Session | null {
  const s = load<Session | null>(SESSION_KEY, null)
  if (s?.method === 'hiveauth' && (!s.expire || s.expire < Date.now())) return null
  return s
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const toast = useToast()
  const [session, setSession] = useState<Session | null>(initialSession)
  const [loginReason, setLoginReason] = useState<string | null>(null)
  const loginResolver = useRef<((a: string | null) => void) | null>(null)
  const [noticeOpen, setNoticeOpen] = useState(false)
  const noticeResolver = useRef<((ok: boolean) => void) | null>(null)
  const [waiting, setWaiting] = useState<Waiting | null>(null)
  const loginListeners = useRef(new Set<(a: string) => void>())

  const ensureLogin = useCallback(
    (reason?: string) => {
      if (session) return Promise.resolve(session.account)
      setLoginReason(reason ?? 'Log in to join in.')
      return new Promise<string | null>((resolve) => {
        loginResolver.current = resolve
      })
    },
    [session],
  )

  const finishLogin = (s: Session | null) => {
    setLoginReason(null)
    if (s) {
      setSession(s)
      save(SESSION_KEY, s)
      loginListeners.current.forEach((fn) => fn(s.account))
      toast(`Welcome, @${s.account}! 👋`)
    }
    loginResolver.current?.(s?.account ?? null)
    loginResolver.current = null
  }

  const logout = useCallback(() => {
    setSession(null)
    save(SESSION_KEY, null)
    toast('You’re logged out. Come back soon!')
  }, [toast])

  const confirmPublic = () => {
    if (load(NOTICE_KEY, false)) return Promise.resolve(true)
    setNoticeOpen(true)
    return new Promise<boolean>((resolve) => {
      noticeResolver.current = resolve
    })
  }

  const closeNotice = (ok: boolean) => {
    if (ok) save(NOTICE_KEY, true)
    setNoticeOpen(false)
    noticeResolver.current?.(ok)
    noticeResolver.current = null
  }

  const broadcast = useCallback<AuthValue['broadcast']>(
    async (opsOrFn, opts = {}) => {
      const account = session?.account ?? (await ensureLogin())
      if (!account) return false
      const s = session ?? load<Session | null>(SESSION_KEY, null)
      if (!s) return false
      const ops = typeof opsOrFn === 'function' ? opsOrFn(account) : opsOrFn
      // The "public and permanent" notice is about writing; votes, follows and joins skip it.
      if (ops.some(([type]) => type === 'comment') && !(await confirmPublic())) return false
      const first = !load(approvedKey(account), false)
      // Keychain answers at once when the user ticked "Do not prompt again", so only
      // show the banner if it's actually waiting on them.
      const keychainTimer = s.method === 'keychain' ? window.setTimeout(() => setWaiting({ method: 'keychain', first }), 700) : undefined
      try {
        if (s.method === 'keychain') {
          await keychainBroadcast(account, ops)
        } else {
          if (!s.hasKey || !s.expire || s.expire < Date.now()) {
            setSession(null)
            save(SESSION_KEY, null)
            throw new Error('Your HiveAuth session expired. Please log in again.')
          }
          const { hiveAuthBroadcast } = await import('../auth/hiveauth')
          await hiveAuthBroadcast(account, s.hasKey, s.hasToken, ops, (w) => setWaiting({ method: 'hiveauth', first, ...w }))
        }
        save(approvedKey(account), true)
        if (opts.milestone) celebrate(account, opts.milestone)
        return true
      } catch (e) {
        if (!opts.silent) {
          const text = /session expired/i.test(String((e as Error)?.message)) ? (e as Error).message : friendlyError(e)
          toast(text, isCancel(e) ? 'info' : 'error')
        }
        return false
      } finally {
        clearTimeout(keychainTimer)
        setWaiting(null)
      }
    },
    [session, ensureLogin, toast],
  )

  const celebrate = (account: string, m: Milestone) => {
    const key = `hh.milestones.${account}`
    const done = load<string[]>(key, [])
    if (done.includes(m)) return
    save(key, [...done, m])
    toast(CELEBRATIONS[m], 'celebrate')
  }

  const onLogin = useCallback((fn: (a: string) => void) => {
    loginListeners.current.add(fn)
    return () => {
      loginListeners.current.delete(fn)
    }
  }, [])

  const value = useMemo<AuthValue>(
    () => ({ session, account: session?.account ?? null, ensureLogin, logout, broadcast, onLogin }),
    [session, ensureLogin, logout, broadcast, onLogin],
  )

  return (
    <AuthCtx.Provider value={value}>
      {children}
      {loginReason !== null && <LoginDialog reason={loginReason} onDone={finishLogin} />}
      {noticeOpen && (
        <Dialog title="Before you share" onClose={() => closeNotice(false)}>
          <p className="text-base">Posts and comments on Hive are public and permanent.</p>
          <div className="mt-6 flex justify-end gap-2">
            <button className="btn-ghost" onClick={() => closeNotice(false)}>
              Not now
            </button>
            <button className="btn-primary" onClick={() => closeNotice(true)} autoFocus>
              Got it
            </button>
          </div>
        </Dialog>
      )}
      {waiting && <ApprovalBanner w={waiting} />}
    </AuthCtx.Provider>
  )
}

export function useAuth() {
  const v = useContext(AuthCtx)
  if (!v) throw new Error('useAuth outside AuthProvider')
  return v
}
