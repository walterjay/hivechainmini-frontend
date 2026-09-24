import { getAccountPosts, getRankedPosts, type Post } from './hive'
import type { FeedPage } from '../components/Feed'

const PAGE = 20

/** Paged feed of a single bridge list, tracking the last post as the cursor. */
export function singleFeed(fetch: (start?: Post) => Promise<Post[]>) {
  let cursor: Post | undefined
  let done = false
  return async (first: boolean): Promise<FeedPage> => {
    if (first) {
      cursor = undefined
      done = false
    }
    if (done) return { posts: [], done }
    // After the first page the API repeats the cursor post as the first item.
    const raw = await fetch(cursor)
    const posts = cursor ? raw.filter((p) => !(p.author === cursor!.author && p.permlink === cursor!.permlink)) : raw
    done = raw.length < PAGE
    cursor = raw[raw.length - 1] ?? cursor
    return { posts, done }
  }
}

export const communityFeed = (id: string, sort: 'hot' | 'created', observer: string) =>
  singleFeed((start) => getRankedPosts(id, sort, observer, PAGE, start))

export const accountFeed = (account: string, sort: 'feed' | 'posts' | 'comments', observer: string) =>
  singleFeed((start) => getAccountPosts(account, sort, observer, PAGE, start))

/**
 * Home: fetch each followed community, then merge.
 * New = newest first; Hot = round-robin through each community's own hot order.
 * Pinned posts are skipped here (they show on the community page).
 */
export function mergedFeed(ids: string[], sort: 'hot' | 'created', observer: string) {
  let pagers = ids.map((id) => communityFeed(id, sort, observer))
  return async (first: boolean): Promise<FeedPage> => {
    if (first) pagers = ids.map((id) => communityFeed(id, sort, observer))
    const pages = await Promise.allSettled(pagers.map((p) => p(first)))
    const ok = pages.filter((r): r is PromiseFulfilledResult<FeedPage> => r.status === 'fulfilled')
    if (!ok.length && pages.length) throw new Error('All community feeds failed')
    const lists = ok.map((r) => r.value.posts.filter((p) => !p.stats?.is_pinned))
    let posts: Post[]
    if (sort === 'created') {
      posts = lists.flat().sort((a, b) => b.created.localeCompare(a.created))
    } else {
      posts = []
      for (let i = 0; i < Math.max(0, ...lists.map((l) => l.length)); i++) {
        for (const l of lists) if (l[i]) posts.push(l[i])
      }
    }
    return { posts, done: ok.every((r) => r.value.done) && ok.length === pages.length }
  }
}
