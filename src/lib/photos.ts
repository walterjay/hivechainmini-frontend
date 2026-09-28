import { getAccountPosts, getCommunity, getDiscussion, getRankedPosts, isNsfw, postKey, summary, visible, type Post } from './hive'
import { photoImages, rejectReason } from './photo-filters'

export type PhotoFilter = 'all' | 'snaps' | 'posts'

export interface PhotoItem {
  key: string
  post: Post
  images: string[]
  /** Posts only: the post title. */
  title: string
  caption: string
  /** Where it came from, for the little label: "⚡ Snaps", "📷 Photography Lovers"… */
  via: string
}

/**
 * Snap-style sources whose pictures we show. Threads (leothreads) is left out:
 * most of its images are hot-linked from outside Hive (X, screenshot hosts).
 */
const SNAP_SOURCES = [
  { account: 'peak.snaps', container: /^snap-container-/, label: '⚡ Snaps' },
  { account: 'ecency.waves', container: /^waves-/, label: '🌊 Waves' },
]

/** Regular posts: the Photography Lovers community plus the photo tags. */
const POST_TAGS = ['hive-194913', 'photography', 'liketu']

/** One time-ordered source. `frontier` is the oldest time loaded so far; nothing newer is still unseen. */
interface Stream {
  frontier: string | null
  done: boolean
  loadNext(): Promise<Post[]>
}

function snapStream(src: (typeof SNAP_SOURCES)[number], observer: string): Stream {
  let containers: Post[] | null = null
  let i = 0
  const s: Stream = {
    frontier: null,
    done: false,
    async loadNext() {
      containers ??= (await getAccountPosts(src.account, 'posts', '', 10)).filter((p) => src.container.test(p.permlink))
      const c = containers[i++]
      if (!c) {
        s.done = true
        return []
      }
      if (i >= containers.length) s.done = true
      const all = await getDiscussion(c.author, c.permlink, observer)
      const root = all[postKey(c)] ?? c
      // Every snap in a container is newer than the container itself.
      s.frontier = c.created
      return root.replies.map((k) => all[k]).filter((p): p is Post => !!p)
    },
  }
  return s
}

function tagStream(tag: string, observer: string): Stream {
  let last: Post | undefined
  const s: Stream = {
    frontier: null,
    done: false,
    async loadNext() {
      const page = await getRankedPosts(tag, 'created', observer, 20, last)
      const fresh = last ? page.slice(1) : page
      if (page.length < 20 || !fresh.length) s.done = true
      if (fresh.length) {
        last = fresh[fresh.length - 1]
        s.frontier = last.created
      }
      return fresh
    },
  }
  return s
}

const nsfwCommunity = new Map<string, Promise<boolean>>()
function isNsfwCommunity(id: string) {
  let v = nsfwCommunity.get(id)
  if (!v) {
    // Unknown means unsafe: if the community can't be looked up, skip its posts.
    v = getCommunity(id)
      .then((c) => !!c?.is_nsfw)
      .catch(() => true)
    nsfwCommunity.set(id, v)
  }
  return v
}

function toItem(p: Post, via: string): PhotoItem {
  const isSnap = p.depth > 0
  return {
    key: postKey(p),
    post: p,
    images: photoImages(p),
    title: isSnap ? '' : p.title,
    caption: summary(p.body, isSnap ? 400 : 160),
    via,
  }
}

/**
 * A merged, newest-first feed of photo snaps and photo posts that passed the
 * metadata rules. Call `next()` for more; the images still need the on-device
 * check before they're shown.
 */
export function createPhotoFeed(filter: PhotoFilter, observer: string) {
  const streams: { s: Stream; via: (p: Post) => string }[] = []
  if (filter !== 'posts') for (const src of SNAP_SOURCES) streams.push({ s: snapStream(src, observer), via: () => src.label })
  if (filter !== 'snaps')
    for (const tag of POST_TAGS) streams.push({ s: tagStream(tag, observer), via: (p) => `📷 ${p.community_title || `#${tag}`}` })

  const seen = new Set<string>()
  let buffer: PhotoItem[] = []

  async function accept(p: Post, via: string): Promise<PhotoItem | null> {
    if (seen.has(postKey(p))) return null
    seen.add(postKey(p))
    if (!visible(p) || isNsfw(p) || rejectReason(p)) return null
    if (p.community && (await isNsfwCommunity(p.community))) return null
    return toItem(p, via)
  }

  /** Buffered items newer than every live stream's frontier: nothing unseen can come before them. */
  function ready() {
    const bound = streams.reduce<string>((m, e) => (!e.s.done && e.s.frontier && e.s.frontier > m ? e.s.frontier : m), '')
    buffer.sort((a, b) => (a.post.created < b.post.created ? 1 : -1))
    const n = buffer.findIndex((x) => x.post.created < bound)
    return n === -1 ? buffer : buffer.slice(0, n)
  }

  async function load(entry: (typeof streams)[number]) {
    const posts = await entry.s.loadNext()
    const items = await Promise.all(posts.map((p) => accept(p, entry.via(p))))
    buffer.push(...items.filter((x): x is PhotoItem => !!x))
  }

  return {
    get done() {
      return buffer.length === 0 && streams.every((e) => e.s.done)
    },
    /** The next items in time order (may be empty if nothing passed yet; call again unless `done`). */
    async next(): Promise<PhotoItem[]> {
      // Load every stream once so each has a frontier.
      const fresh = streams.filter((e) => e.s.frontier === null && !e.s.done)
      if (fresh.length) {
        const results = await Promise.allSettled(fresh.map(load))
        // A broken source just drops out; if all of them fail, report it.
        results.forEach((r, i) => r.status === 'rejected' && (fresh[i].s.done = true))
        if (results.every((r) => r.status === 'rejected') && buffer.length === 0 && fresh.length === streams.length)
          throw (results[0] as PromiseRejectedResult).reason
      }
      for (let rounds = 0; rounds < 4 && ready().length < 6; rounds++) {
        const live = streams.filter((e) => !e.s.done)
        if (!live.length) break
        // Pull more from the stream holding the bound back.
        const lagging = live.reduce((a, b) => ((a.s.frontier ?? '') >= (b.s.frontier ?? '') ? a : b))
        try {
          await load(lagging)
        } catch {
          lagging.s.done = true
        }
      }
      const out = ready()
      buffer = buffer.slice(out.length)
      return out
    },
  }
}
