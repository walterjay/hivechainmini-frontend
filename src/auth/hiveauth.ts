// Minimal HiveAuth (HAS) client, following docs.hiveauth.com (protocol v1, plus the
// session token that protocol 0.8 servers still require; the public HAS ran 0.8 on 2026-09-24).
// Payloads are AES-encrypted with an app-generated auth_key so the HAS relay
// can't read or forge them. Only posting authority is ever requested.
import AES from 'crypto-js/aes'
import Utf8 from 'crypto-js/enc-utf8'
import { APP_NAME, HIVEAUTH_HOST } from '../config'
import type { Operation } from './types'

const SUPPORTED_PROTOCOLS = [0.8, 1]
const APP_META = { name: APP_NAME, description: `${APP_NAME}: a friendly way to explore Hive` }

const enc = (data: unknown, key: string) => AES.encrypt(JSON.stringify(data), key).toString()
const dec = (data: string, key: string) => AES.decrypt(data, key).toString(Utf8)

interface HasMessage {
  cmd: string
  uuid?: string
  expire?: number
  data?: string
  error?: string
  protocol?: number
  timeout?: number
}

/** Wait until the page is on screen again (phones pause sockets while the wallet app is open). */
function whenVisible() {
  if (document.visibilityState === 'visible') return Promise.resolve()
  return new Promise<void>((resolve) => {
    const on = () => {
      if (document.visibilityState !== 'visible') return
      document.removeEventListener('visibilitychange', on)
      resolve()
    }
    document.addEventListener('visibilitychange', on)
  })
}

/**
 * Open a socket, wait for "connected", then run `send` and hand every later message to `onMsg`.
 * If the socket drops after the relay gave us a request id (typical on phones: the browser
 * is paused while the user approves in the wallet app), reconnect and re-attach to that
 * request with attach_req, so an approval made meanwhile isn't lost.
 */
function session<T>(
  send: (ws: WebSocket) => void,
  onMsg: (m: HasMessage, done: (v: T) => void, fail: (e: Error) => void) => void,
  signal?: AbortSignal,
): Promise<T> {
  return new Promise((resolve, reject) => {
    let ws: WebSocket
    let settled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let pending = '' // uuid of the request the relay is holding for us
    let expire = 0
    let retries = 0
    const finish = (fn: () => void) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      ws.onclose = null
      ws.close()
      fn()
    }
    const done = (v: T) => finish(() => resolve(v))
    const fail = (e: Error) => finish(() => reject(e))
    signal?.addEventListener('abort', () => fail(new Error('Request cancelled')))
    // Safety net; the real expiry comes from the *_wait message.
    timer = setTimeout(() => fail(new Error('HiveAuth request timed out')), 180_000)

    const reconnect = async () => {
      if (settled) return
      if (!pending || retries >= 8 || (expire && Date.now() > expire)) return fail(new Error('HiveAuth connection closed'))
      retries++
      await whenVisible()
      await new Promise((r) => setTimeout(r, Math.min(500 * retries, 3000)))
      if (!settled) open(true)
    }

    const open = (attach: boolean) => {
      ws = new WebSocket(HIVEAUTH_HOST)
      ws.onerror = () => {
        if (!pending) fail(new Error("Couldn't reach the HiveAuth service"))
      }
      ws.onclose = () => {
        if (!pending) fail(new Error('HiveAuth connection closed'))
        else reconnect()
      }
      ws.onmessage = (ev) => {
        let m: HasMessage
        try {
          m = JSON.parse(ev.data)
        } catch {
          return
        }
        if (m.cmd === 'connected') {
          if (m.protocol !== undefined && !SUPPORTED_PROTOCOLS.includes(m.protocol)) return fail(new Error('Unsupported HiveAuth version'))
          if (attach) ws.send(JSON.stringify({ cmd: 'attach_req', uuid: pending }))
          else send(ws)
          return
        }
        if (m.cmd === 'attach_ack') {
          retries = 0
          return
        }
        if (m.cmd === 'attach_nack' && m.uuid === pending) return fail(new Error('HiveAuth request expired'))
        if (m.uuid && m.cmd.endsWith('_wait')) pending = m.uuid
        if (m.expire) {
          expire = m.expire
          clearTimeout(timer)
          const ms = m.expire - Date.now()
          timer = setTimeout(() => fail(new Error('HiveAuth request expired')), Math.max(ms, 5000))
        }
        onMsg(m, done, fail)
      }
    }
    open(false)
  })
}

export interface AuthWait {
  uuid: string
  /** Deep link for the wallet app; render as a QR code too. */
  link: string
  expire: number
}

/** Ask the user's wallet app to approve a login. `onWait` receives the QR/deep-link data. */
export function hiveAuthLogin(account: string, onWait: (w: AuthWait) => void, signal?: AbortSignal) {
  const key = crypto.randomUUID()
  let uuid = ''
  return session<{ hasKey: string; expire: number; token?: string }>(
    (ws) => {
      const challenge = { key_type: 'posting', challenge: JSON.stringify({ login: account, ts: Date.now() }) }
      ws.send(JSON.stringify({ cmd: 'auth_req', account, data: enc({ app: APP_META, challenge }, key) }))
    },
    (m, done, fail) => {
      if (m.cmd === 'auth_wait' && m.uuid) {
        uuid = m.uuid
        const payload = btoa(JSON.stringify({ account, uuid, key, host: HIVEAUTH_HOST }))
        onWait({ uuid, link: `has://auth_req/${payload}`, expire: m.expire ?? Date.now() + 60_000 })
      } else if (m.uuid !== uuid) {
        return // not ours
      } else if (m.cmd === 'auth_ack' && m.data) {
        try {
          const data = JSON.parse(dec(m.data, key)) as { expire: number; token?: string }
          done({ hasKey: key, expire: data.expire, token: data.token })
        } catch {
          /* couldn't decrypt: ignore, per protocol */
        }
      } else if (m.cmd === 'auth_nack') {
        if (m.data && dec(m.data, key) === uuid) fail(new Error('Login was declined'))
      } else if (m.cmd === 'auth_err') {
        fail(new Error(m.error ? safeDec(m.error, key) : 'HiveAuth login failed'))
      }
    },
    signal,
  )
}

function safeDec(s: string, key: string) {
  try {
    return dec(s, key) || s
  } catch {
    return s
  }
}

export interface SignWait {
  uuid: string
  /** Brings the wallet app (Hive Keychain mobile) to the front, where the request is waiting. */
  link: string
}

/** Ask the wallet app to sign and broadcast operations with the posting key. */
export function hiveAuthBroadcast(account: string, hasKey: string, token: string | undefined, ops: Operation[], onWait?: (w: SignWait) => void) {
  let uuid = ''
  return session<void>(
    (ws) => {
      const data = enc({ key_type: 'posting', ops, broadcast: true, nonce: Date.now() }, hasKey)
      ws.send(JSON.stringify({ cmd: 'sign_req', account, data, token }))
    },
    (m, done, fail) => {
      if (m.cmd === 'sign_wait' && m.uuid) {
        uuid = m.uuid
        // Any has:// link opens Keychain mobile; it then picks the request up from the relay.
        // No keys in here: the payload only says which request to look at.
        const payload = btoa(JSON.stringify({ account, uuid, host: HIVEAUTH_HOST }))
        onWait?.({ uuid, link: `has://sign_req/${payload}` })
      } else if (m.uuid !== uuid) {
        return
      } else if (m.cmd === 'sign_ack') {
        done()
      } else if (m.cmd === 'sign_nack') {
        fail(new Error('Request was declined'))
      } else if (m.cmd === 'sign_err') {
        fail(new Error(m.error ? safeDec(m.error, hasKey) : 'HiveAuth request failed'))
      }
    },
  )
}
