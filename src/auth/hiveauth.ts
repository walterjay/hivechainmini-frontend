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

/** Open a socket, wait for "connected", then run `send` and hand every later message to `onMsg`. */
function session<T>(
  send: (ws: WebSocket) => void,
  onMsg: (m: HasMessage, done: (v: T) => void, fail: (e: Error) => void) => void,
  signal?: AbortSignal,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(HIVEAUTH_HOST)
    let settled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const finish = (fn: () => void) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      ws.close()
      fn()
    }
    const done = (v: T) => finish(() => resolve(v))
    const fail = (e: Error) => finish(() => reject(e))
    signal?.addEventListener('abort', () => fail(new Error('Request cancelled')))
    // Safety net; the real expiry comes from the *_wait message.
    timer = setTimeout(() => fail(new Error('HiveAuth request timed out')), 180_000)
    ws.onerror = () => fail(new Error("Couldn't reach the HiveAuth service"))
    ws.onclose = () => fail(new Error('HiveAuth connection closed'))
    ws.onmessage = (ev) => {
      let m: HasMessage
      try {
        m = JSON.parse(ev.data)
      } catch {
        return
      }
      if (m.cmd === 'connected') {
        if (m.protocol !== undefined && !SUPPORTED_PROTOCOLS.includes(m.protocol)) return fail(new Error('Unsupported HiveAuth version'))
        send(ws)
        return
      }
      if (m.expire) {
        clearTimeout(timer)
        const ms = m.expire - Date.now()
        timer = setTimeout(() => fail(new Error('HiveAuth request expired')), Math.max(ms, 5000))
      }
      onMsg(m, done, fail)
    }
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

/** Ask the wallet app to sign and broadcast operations with the posting key. */
export function hiveAuthBroadcast(
  account: string,
  hasKey: string,
  token: string | undefined,
  ops: Operation[],
  onWait?: (uuid: string) => void,
) {
  let uuid = ''
  return session<void>(
    (ws) => {
      const data = enc({ key_type: 'posting', ops, broadcast: true, nonce: Date.now() }, hasKey)
      ws.send(JSON.stringify({ cmd: 'sign_req', account, data, token }))
    },
    (m, done, fail) => {
      if (m.cmd === 'sign_wait' && m.uuid) {
        uuid = m.uuid
        onWait?.(uuid)
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
