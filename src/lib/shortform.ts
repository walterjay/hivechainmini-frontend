import { getAccountPosts, getDiscussion, isNsfw, postKey, visible, type Post } from './hive'
import { noiseReason } from './photo-filters'

export interface ShortFormSource {
  key: string
  label: string
  icon: string
  /** Publishes rotating "container" posts; short items are top-level replies to the latest one. */
  account: string
}

/**
 * Snaps, Threads and Waves are all the same shape under the hood: short posts
 * stored as comments under a container post that a fixed account republishes
 * every so often. No single feed lists all three, so we find each one's
 * current container and merge their replies ourselves.
 */
export const SHORT_FORM_SOURCES: ShortFormSource[] = [
  { key: 'snaps', label: 'Snaps', icon: '📸', account: 'peak.snaps' },
  { key: 'threads', label: 'Threads', icon: '🧵', account: 'leothreads' },
  { key: 'waves', label: 'Waves', icon: '🌊', account: 'ecency.waves' },
]

export interface ShortFormItem extends Post {
  source: string
}

/** The source's current container post - a new snap is posted as a top-level reply to this. */
export async function latestContainer(account: string): Promise<Post | null> {
  const posts = await getAccountPosts(account, 'posts', '', 1)
  return posts[0] ?? null
}

function ageMs(iso: string) {
  return Date.now() - new Date(iso.endsWith('Z') ? iso : iso + 'Z').getTime()
}

/** Runs `fn` over `items` with at most `limit` in flight at once - a bit kinder to free public API nodes. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let i = 0
  async function worker() {
    while (i < items.length) {
      const idx = i++
      results[idx] = await fn(items[idx])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

async function containerReplies(
  container: Post,
  source: ShortFormSource,
  observer: string,
  showNsfw: boolean,
): Promise<ShortFormItem[]> {
  const all = await getDiscussion(container.author, container.permlink, observer)
  const root = all[postKey(container)] ?? container
  return root.replies
    .map((k) => all[k])
    .filter((p): p is Post => !!p && visible(p) && (showNsfw || !isNsfw(p)) && !noiseReason(p))
    .map((p) => ({ ...p, source: source.key }))
}

/** Merges each source's current container into one feed, newest first. A broken/renamed source just contributes nothing. */
export async function getShortFormFeed(observer: string, showNsfw: boolean): Promise<ShortFormItem[]> {
  const lists = await Promise.all(
    SHORT_FORM_SOURCES.map(async (source) => {
      try {
        const container = await latestContainer(source.account)
        return container ? await containerReplies(container, source, observer, showNsfw) : []
      } catch {
        return [] as ShortFormItem[]
      }
    }),
  )
  return lists.flat().sort((a, b) => (a.created < b.created ? 1 : -1))
}

const ON_FIRE_MAX_CONTAINERS = 8

/** Every container a source published within `windowMs`, newest first, up to a small cap. */
async function recentContainers(account: string, windowMs: number): Promise<Post[]> {
  const out: Post[] = []
  let cursor: Post | undefined
  while (out.length < ON_FIRE_MAX_CONTAINERS) {
    const raw = await getAccountPosts(account, 'posts', '', 10, cursor)
    const page = cursor ? raw.filter((p) => postKey(p) !== postKey(cursor!)) : raw
    if (!page.length) break
    for (const p of page) {
      if (ageMs(p.created) > windowMs) return out
      out.push(p)
      if (out.length >= ON_FIRE_MAX_CONTAINERS) return out
    }
    cursor = raw[raw.length - 1]
    if (raw.length < 10) break
  }
  return out
}

/**
 * The busiest snaps from the last `days` days, across all sources, most-replied first.
 * Only looks back over a handful of each source's recent containers (ON_FIRE_MAX_CONTAINERS),
 * so on a very active source this may not truly reach back the full week - a deliberate
 * tradeoff to avoid hammering free public API nodes with dozens of requests.
 */
export async function getOnFireFeed(observer: string, showNsfw: boolean, days = 7): Promise<ShortFormItem[]> {
  const windowMs = days * 24 * 60 * 60 * 1000
  const lists = await Promise.all(
    SHORT_FORM_SOURCES.map(async (source) => {
      try {
        const containers = await recentContainers(source.account, windowMs)
        const perContainer = await mapLimit(containers, 3, (c) =>
          containerReplies(c, source, observer, showNsfw).catch(() => [] as ShortFormItem[]),
        )
        return perContainer.flat()
      } catch {
        return [] as ShortFormItem[]
      }
    }),
  )
  return lists.flat().sort((a, b) => b.children - a.children)
}
