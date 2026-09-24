/** A Hive operation, e.g. ['vote', {...}]. */
export type Operation = [string, Record<string, unknown>]

export type LoginMethod = 'keychain' | 'hiveauth'

export interface Session {
  account: string
  method: LoginMethod
  /** HiveAuth only: session encryption key shared with the wallet app (not a Hive key). */
  hasKey?: string
  /** HiveAuth only: session token (needed by protocol 0.8 servers). */
  hasToken?: string
  /** HiveAuth only: ms timestamp when the session ends. */
  expire?: number
}
