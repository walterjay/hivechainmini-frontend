import { useEffect, useRef, useState } from 'react'
import Dialog from './Dialog'
import { APP_NAME } from '../config'
import { hasKeychain, keychainLogin } from '../auth/keychain'
import type { Session } from '../auth/types'
import { getProfile } from '../lib/hive'
import { friendlyError, isCancel } from '../lib/errors'

const isMobile = () => /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
const ACCOUNT_RE = /^[a-z][a-z0-9-.]{2,15}$/

export default function LoginDialog({ reason, onDone }: { reason: string; onDone: (s: Session | null) => void }) {
  const [name, setName] = useState('')
  const [keychain, setKeychain] = useState<boolean | null>(null)
  const [busy, setBusy] = useState<'keychain' | 'hiveauth' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [qr, setQr] = useState<{ img: string; link: string; uuid: string } | null>(null)
  const abort = useRef<AbortController | null>(null)
  const mobile = isMobile()

  useEffect(() => {
    hasKeychain().then(setKeychain)
    return () => abort.current?.abort()
  }, [])

  const account = name.trim().replace(/^@/, '').toLowerCase()

  async function checkAccount() {
    if (!ACCOUNT_RE.test(account)) {
      setError('That doesn’t look like a Hive username. Usernames are lowercase, 3–16 characters.')
      return false
    }
    try {
      const p = await getProfile(account)
      if (!p) {
        setError(`We couldn’t find @${account} on Hive. Check the spelling?`)
        return false
      }
    } catch {
      setError(`We couldn’t find @${account} on Hive. Check the spelling?`)
      return false
    }
    return true
  }

  async function withKeychain() {
    setError(null)
    setBusy('keychain')
    try {
      if (!(await checkAccount())) return
      await keychainLogin(account)
      onDone({ account, method: 'keychain' })
    } catch (e) {
      setError(isCancel(e) ? 'Login cancelled. Try again whenever you’re ready.' : friendlyError(e))
    } finally {
      setBusy(null)
    }
  }

  async function withHiveAuth() {
    setError(null)
    setBusy('hiveauth')
    abort.current = new AbortController()
    try {
      if (!(await checkAccount())) return
      const [{ hiveAuthLogin }, QRCode] = await Promise.all([import('../auth/hiveauth'), import('qrcode')])
      const res = await hiveAuthLogin(
        account,
        async (w) => {
          const img = await QRCode.toDataURL(w.link, { margin: 1, width: 240 })
          setQr({ img, link: w.link, uuid: w.uuid })
        },
        abort.current.signal,
      )
      onDone({ account, method: 'hiveauth', hasKey: res.hasKey, hasToken: res.token, expire: res.expire })
    } catch (e) {
      if (!abort.current?.signal.aborted) setError(isCancel(e) ? 'Login declined. Try again whenever you’re ready.' : friendlyError(e))
    } finally {
      setBusy(null)
      setQr(null)
    }
  }

  const close = () => {
    abort.current?.abort()
    onDone(null)
  }

  if (qr) {
    return (
      <Dialog title="Approve on your phone" onClose={close}>
        <p className="text-sm text-muted">
          {mobile ? 'Tap the button to open your wallet app and approve.' : 'Scan this code with a HiveAuth wallet app (like Hive Keychain for mobile), then approve.'}
        </p>
        {!mobile && <img src={qr.img} alt="HiveAuth login QR code" className="mx-auto my-4 h-60 w-60 rounded-xl bg-white p-2" />}
        <a href={qr.link} className="btn-primary mt-4 flex w-full justify-center">
          Open wallet app
        </a>
        <p className="mt-3 text-center text-xs text-muted">Request {qr.uuid.slice(0, 8)} · waiting for approval…</p>
      </Dialog>
    )
  }

  const noMethod = keychain === false && !mobile

  return (
    <Dialog title={`Log in to ${APP_NAME}`} onClose={close}>
      <p className="mb-4 text-sm text-muted">{reason}</p>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (keychain && !mobile) withKeychain()
          else withHiveAuth()
        }}
      >
        <label htmlFor="hh-username" className="mb-1 block text-sm font-semibold">
          Your Hive username
        </label>
        <div className="flex items-center rounded-xl border border-zinc-300 bg-white px-3 focus-within:ring-2 focus-within:ring-brand dark:border-zinc-700 dark:bg-zinc-950">
          <span className="text-muted" aria-hidden>
            @
          </span>
          <input
            id="hh-username"
            className="w-full bg-transparent px-1 py-3 outline-none"
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="username"
            spellCheck={false}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="username"
            autoFocus
          />
        </div>
        {error && (
          <p className="mt-2 text-sm text-rose-700 dark:text-rose-300" role="alert">
            {error}
          </p>
        )}
        <div className="mt-4 flex flex-col gap-2">
          {keychain && (
            <button type="button" className={mobile ? 'btn-ghost' : 'btn-primary'} disabled={!!busy || !account} onClick={withKeychain}>
              {busy === 'keychain' ? 'Check your Keychain window…' : 'Log in with Hive Keychain'}
            </button>
          )}
          <button
            type="button"
            className={keychain && !mobile ? 'btn-ghost' : 'btn-primary'}
            disabled={!!busy || !account}
            onClick={withHiveAuth}
          >
            {busy === 'hiveauth' ? 'Connecting…' : 'Log in with HiveAuth (phone)'}
          </button>
        </div>
      </form>
      <div className="mt-5 space-y-2 rounded-2xl bg-zinc-100 p-4 text-sm dark:bg-zinc-800">
        {noMethod && (
          <p>
            <strong>No login helper found on this browser.</strong> Install the free{' '}
            <a className="link" href="https://hive-keychain.com" target="_blank" rel="noopener noreferrer">
              Hive Keychain
            </a>{' '}
            extension, then reload this page. Or use HiveAuth with the Hive Keychain app on your phone.
          </p>
        )}
        {mobile && keychain === false && (
          <p>
            To log in on your phone, install the free{' '}
            <a className="link" href="https://hive-keychain.com" target="_blank" rel="noopener noreferrer">
              Hive Keychain app
            </a>{' '}
            and add your account, then use HiveAuth above.
          </p>
        )}
        <p className="text-muted">
          🔒 {APP_NAME} never sees or stores your keys. Your wallet app signs everything and only posting permission is ever used.
        </p>
        <p className="text-muted">
          New to Hive?{' '}
          <a className="link" href="https://signup.hive.io" target="_blank" rel="noopener noreferrer">
            Get a free account
          </a>
          .
        </p>
      </div>
    </Dialog>
  )
}
