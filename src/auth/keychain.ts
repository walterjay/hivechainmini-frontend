import { APP_NAME } from '../config'
import { currentNode } from '../lib/rpc'
import type { Operation } from './types'

interface KeychainResponse {
  success: boolean
  error?: string
  message?: string
  result?: unknown
}
type Cb = (r: KeychainResponse) => void

interface HiveKeychain {
  requestHandshake(cb: () => void): void
  requestSignBuffer(account: string | null, message: string, key: 'Posting', cb: Cb, rpc?: string | null, title?: string): void
  requestBroadcast(account: string, operations: Operation[], key: 'Posting', cb: Cb, rpc?: string | null): void
}

declare global {
  interface Window {
    hive_keychain?: HiveKeychain
  }
}

/** Keychain injects itself after page load, so give it a moment. */
export async function hasKeychain(waitMs = 1500): Promise<boolean> {
  const start = Date.now()
  while (!window.hive_keychain && Date.now() - start < waitMs) {
    await new Promise((r) => setTimeout(r, 100))
  }
  if (!window.hive_keychain) return false
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(false), 1000)
    window.hive_keychain!.requestHandshake(() => {
      clearTimeout(t)
      resolve(true)
    })
  })
}

function toError(r: KeychainResponse) {
  return new Error(r.message || (typeof r.error === 'string' ? r.error : 'Keychain request failed'))
}

/** Prove the user controls the account by signing a short message with the posting key. */
export function keychainLogin(account: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const kc = window.hive_keychain
    if (!kc) return reject(new Error('Hive Keychain not found'))
    const msg = `Log in to ${APP_NAME} as @${account} at ${new Date().toISOString()}`
    kc.requestSignBuffer(account, msg, 'Posting', (r) => (r.success ? resolve() : reject(toError(r))), null, `Log in to ${APP_NAME}`)
  })
}

export function keychainBroadcast(account: string, ops: Operation[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const kc = window.hive_keychain
    if (!kc) return reject(new Error('Hive Keychain not found'))
    kc.requestBroadcast(account, ops, 'Posting', (r) => (r.success ? resolve() : reject(toError(r))), currentNode())
  })
}

/**
 * Signs a photo for upload to images.hive.blog, which checks a posting-key
 * signature over "ImageSigningChallenge" + the file bytes. Keychain turns a
 * JSON-serialised Node Buffer back into raw bytes before hashing, which is how
 * hive.blog itself sends images to Keychain.
 */
export function keychainSignImage(account: string, bytes: Uint8Array): Promise<string> {
  return new Promise((resolve, reject) => {
    const kc = window.hive_keychain
    if (!kc) return reject(new Error('Hive Keychain not found'))
    const prefix = new TextEncoder().encode('ImageSigningChallenge')
    const all = new Uint8Array(prefix.length + bytes.length)
    all.set(prefix)
    all.set(bytes, prefix.length)
    const message = JSON.stringify({ type: 'Buffer', data: Array.from(all) })
    kc.requestSignBuffer(account, message, 'Posting', (r) => (r.success ? resolve(String(r.result)) : reject(toError(r))), null, 'Upload a photo')
  })
}
