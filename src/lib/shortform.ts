import { getAccountPosts, getDiscussion, isNsfw, postKey, visible, type Post } from './hive'

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

async function latestContainer(account: string): Promise<Post | null> {
  const posts = await getAccountPosts(account, 'posts', '', 1)
  return posts[0] ?? null
}

async function sourceItems(source: ShortFormSource, observer: string, showNsfw: boolean): Promise<ShortFormItem[]> {
  const container = await latestContainer(source.account)
  if (!container) return []
  const all = await getDiscussion(container.author, container.permlink, observer)
  const root = all[postKey(container)] ?? container
  return root.replies
    .map((k) => all[k])
    .filter((p): p is Post => !!p && visible(p) && (showNsfw || !isNsfw(p)))
    .map((p) => ({ ...p, source: source.key }))
}

/** Merges each source's current container into one feed, newest first. A broken/renamed source just contributes nothing. */
export async function getShortFormFeed(observer: string, showNsfw: boolean): Promise<ShortFormItem[]> {
  const lists = await Promise.all(
    SHORT_FORM_SOURCES.map((s) => sourceItems(s, observer, showNsfw).catch(() => [] as ShortFormItem[])),
  )
  return lists.flat().sort((a, b) => (a.created < b.created ? 1 : -1))
}
