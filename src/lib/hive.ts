import { cachedRpc, rpc } from './rpc'

// Only the fields the app uses. Reward fields exist on the API objects but are
// deliberately left out of these types so they can't be rendered by accident.

export interface Vote {
  voter: string
  rshares: number
}

export interface Post {
  author: string
  permlink: string
  title: string
  body: string
  category: string
  community?: string
  community_title?: string
  created: string
  depth: number
  children: number
  parent_author?: string
  parent_permlink?: string
  active_votes: Vote[]
  replies: string[]
  json_metadata: { image?: string[]; tags?: string[]; [k: string]: unknown }
  stats?: { gray?: boolean; hide?: boolean; is_pinned?: boolean; total_votes?: number }
  author_reputation?: number
  url?: string
}

export interface Community {
  name: string
  title: string
  about: string
  description?: string
  subscribers: number
  num_authors?: number
  is_nsfw?: boolean
  context?: { subscribed?: boolean; role?: string }
}

export interface Profile {
  name: string
  created: string
  post_count: number
  reputation: number
  metadata: { profile?: { name?: string; about?: string; profile_image?: string; cover_image?: string; location?: string; website?: string } }
  stats: { followers: number; following: number }
  context?: { followed?: boolean; muted?: boolean }
}

export type RankedSort = 'hot' | 'created' | 'trending'

export const postKey = (p: { author: string; permlink: string }) => `${p.author}/${p.permlink}`

/** Upvotes only; downvotes never count and never show. */
export function upvoteCount(p: Post) {
  return p.active_votes.filter((v) => v.rshares >= 0).length
}

export function hasVoted(p: Post, account?: string | null) {
  return !!account && p.active_votes.some((v) => v.voter === account && v.rshares >= 0)
}

/** Keep newcomer feeds friendly: skip hidden or greyed-out (muted, low reputation) posts. */
export function visible(p: Post) {
  return !p.stats?.hide && !p.stats?.gray
}

export function getRankedPosts(tag: string, sort: RankedSort, observer = '', limit = 20, start?: Post) {
  return cachedRpc<Post[]>('bridge.get_ranked_posts', {
    sort,
    tag,
    observer,
    limit,
    start_author: start?.author ?? '',
    start_permlink: start?.permlink ?? '',
  })
}

export function getAccountPosts(
  account: string,
  sort: 'feed' | 'posts' | 'comments' | 'blog',
  observer = '',
  limit = 20,
  start?: Post,
) {
  return cachedRpc<Post[]>('bridge.get_account_posts', {
    sort,
    account,
    observer,
    limit,
    start_author: start?.author ?? '',
    start_permlink: start?.permlink ?? '',
  })
}

/** Returns a map keyed "author/permlink"; each entry lists its replies' keys. */
export function getDiscussion(author: string, permlink: string, observer = '') {
  return cachedRpc<Record<string, Post>>('bridge.get_discussion', { author, permlink, observer }, 15_000)
}

export function getCommunity(name: string, observer = '') {
  return cachedRpc<Community | null>('bridge.get_community', { name, observer }, 300_000)
}

export function listCommunities(query: string, observer = '', limit = 50) {
  return cachedRpc<Community[]>(
    'bridge.list_communities',
    { query: query || null, limit, sort: 'rank', observer, last: '' },
    300_000,
  )
}

/** [community id, title, role, custom title] */
export function listAllSubscriptions(account: string) {
  return rpc<[string, string, string, string][]>('bridge.list_all_subscriptions', { account })
}

export function getProfile(account: string, observer = '') {
  return cachedRpc<Profile | null>('bridge.get_profile', { account, observer }, 30_000)
}

/** Check whether a permlink is already used by this author (for post permlink generation). */
export async function contentExists(author: string, permlink: string) {
  try {
    const r = await rpc<{ author?: string } | null>('bridge.get_post', { author, permlink, observer: '' })
    return !!r?.author
  } catch {
    return false
  }
}

export function avatarUrl(account: string, size: 'small' | 'medium' | 'large' = 'small') {
  return `https://images.hive.blog/u/${account}/avatar/${size}`
}

/** Short plain-text summary for cards. */
export function summary(body: string, max = 180) {
  const text = body
    .replace(/<[^>]*>/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/\S*\.(?:png|jpe?g|gif|webp)\)?/gi, ' ')
    .replace(/[#*_>`~|-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return text.length > max ? text.slice(0, max).replace(/\s\S*$/, '') + '…' : text
}

export function firstImage(p: Post): string | undefined {
  const img = p.json_metadata?.image?.[0]
  if (typeof img === 'string' && /^https?:\/\//.test(img)) return img
  const m = p.body.match(/https?:\/\/\S+\.(?:jpe?g|png|gif|webp)/i)
  return m?.[0]
}

export function timeAgo(iso: string) {
  const then = new Date(iso.endsWith('Z') ? iso : iso + 'Z').getTime()
  const s = Math.max(0, (Date.now() - then) / 1000)
  if (s < 60) return 'just now'
  const units: [number, string][] = [
    [60, 'minute'],
    [3600, 'hour'],
    [86400, 'day'],
    [604800, 'week'],
    [2629800, 'month'],
    [31557600, 'year'],
  ]
  let label = ''
  for (const [sec, name] of units) {
    if (s >= sec) {
      const n = Math.floor(s / sec)
      label = `${n} ${name}${n === 1 ? '' : 's'} ago`
    }
  }
  return label
}
