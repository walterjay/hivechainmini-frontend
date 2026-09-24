// Central app settings. Change the name here and it updates everywhere.
// Keep this file free of browser APIs: vite.config.ts imports it too.

export const APP_NAME = 'Hive Chain Mini'
/** Written into json_metadata.app on everything the app broadcasts. */
export const APP_ID = 'hivechainmini/0.1'

/**
 * Token values (payouts, rewards, prices) are never shown while this is false.
 * Flip to true to reveal them later; see components/RewardInfo.tsx.
 */
export const SHOW_REWARDS = false

/** Upvote strength, 1-100. */
export const VOTE_WEIGHT_PERCENT = 100

/** Soft cap for new posts, in characters. */
export const POST_SOFT_CAP = 5000
export const COMMENT_SOFT_CAP = 2000

export interface CommunityRef {
  id: string
  title: string
}

/** Checked 2026-09-24 via bridge.list_communities: all active, thousands of subscribers. */
export const DEFAULT_COMMUNITIES: CommunityRef[] = [
  { id: 'hive-153850', title: 'Hive Learners' },
  { id: 'hive-194913', title: 'Photography Lovers' },
  { id: 'hive-100067', title: 'Hive Food' },
]

/** Public API nodes, tried in order with failover. All send CORS headers. */
export const API_NODES = [
  'https://api.deathwing.me',
  'https://api.openhive.network',
  'https://rpc.mahdiyari.info',
  'https://techcoderx.com',
  'https://api.hive.blog',
  'https://api.syncad.com',
]
export const NODE_TIMEOUT_MS = 5000
export const FEED_CACHE_TTL_MS = 60_000

export const HIVEAUTH_HOST = 'wss://hive-auth.arcange.eu'
export const IMAGE_PROXY = 'https://images.hive.blog'
