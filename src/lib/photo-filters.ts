import type { Post } from './hive'

// The rules deciding what may appear in Photos. No runtime imports, so
// `npm test` can run them straight under Node.
//
// Photos is strict on purpose: it shows pictures full screen to people who
// are new to Hive, so anything doubtful is left out. These rules are the
// cheap first pass; every image that survives them is also scanned on the
// device (lib/safety.ts) before it is shown.

/**
 * Hive reputation starts at 25 and only drops below it when other users
 * flag the account. The one untagged nude seen in snaps during testing came
 * from a day-old account at reputation 11.
 */
export const MIN_REPUTATION = 25

/** Photos per post shown in the swipe carousel (each one is safety-checked). */
export const MAX_IMAGES = 4

/**
 * Hive's own image hosts. Uploads there are signed with the poster's key,
 * so the picture is tied to their account. Anything hot-linked from
 * elsewhere is skipped.
 */
const TRUSTED_HOST = /^https:\/\/(?:files\.peakd\.com|images\.hive\.blog\/(?:DQm|p\/)|images\.ecency\.com|i\.ecency\.com|cdn\.liketu\.com)\//i

/** Animated images and video thumbnails: Photos is for still pictures. */
const NOT_A_PHOTO = /\.gif(?:[?#]|$)|giphy\.com|tenor\.com|klipy\.com|3speak\.|youtube\.com|youtu\.be|ytimg\.com/i
const VIDEO_IN_BODY = /3speak\.tv\/(?:watch|embed)|play\.3speak\.tv|youtube\.com\/(?:watch|embed|shorts)|youtu\.be\/|\.mp4\b/i

/** Games and auto-posters that fill snaps with screenshots and status cards. */
const BOT_APPS = /^(?:hivegrove|mydempire|zingit|scrobblelife|slothbuzz|hivesuite|terracore|actifit|hiveword)\b/i
const BOT_TAGS = new Set([
  'hivegrove',
  'mydempire',
  'scrobblelife',
  'dailyreport',
  'splinterlands',
  'sunflowerland',
  'satsman',
  'hpud',
  'hpu',
  'terracore',
  'holozing',
  'dcrops',
  'actifit',
  'hiveword',
])

/** Default file names of screenshots; in snaps these are almost never photos. */
const SCREENSHOT_ALT = /^(?:image\.png|screenshot.*|screen ?shot.*|captura.*|capture.*)$/i

export interface FoundImage {
  url: string
  alt: string
}

/** Every image referenced by a post: markdown, <img> tags, bare links and json_metadata. */
export function findImages(p: Pick<Post, 'body' | 'json_metadata'>): FoundImage[] {
  const found: FoundImage[] = []
  const body = p.body ?? ''
  for (const m of body.matchAll(/!\[([^\]]*)\]\((\S+?)(?:\s+"[^"]*")?\)/g)) found.push({ url: m[2], alt: m[1] })
  for (const m of body.matchAll(/<img\b[^>]*>/gi)) {
    const src = m[0].match(/\bsrc=["']([^"']+)["']/i)?.[1]
    if (src) found.push({ url: src, alt: m[0].match(/\balt=["']([^"']*)["']/i)?.[1] ?? '' })
  }
  for (const m of body.matchAll(/^\s*(https:\/\/\S+)\s*$/gm)) if (TRUSTED_HOST.test(m[1])) found.push({ url: m[1], alt: '' })
  const meta = p.json_metadata?.image
  if (Array.isArray(meta)) for (const u of meta) if (typeof u === 'string') found.push({ url: u, alt: '' })

  const byUrl = new Map<string, FoundImage>()
  for (const img of found) {
    const seen = byUrl.get(img.url)
    if (!seen) byUrl.set(img.url, img)
    else if (!seen.alt && img.alt) seen.alt = img.alt
  }
  return [...byUrl.values()].filter((i) => i.url.startsWith('https://') && !NOT_A_PHOTO.test(i.url))
}

/** Metadata tags plus #hashtags written in the text (some apps only do the latter). */
function tagsOf(p: Post): string[] {
  const t = p.json_metadata?.tags
  const meta = Array.isArray(t) ? t.filter((x): x is string => typeof x === 'string') : []
  const inText = [...(p.body ?? '').matchAll(/(?:^|\s)#([a-z0-9-]+)/gi)].map((m) => m[1])
  return [...meta, ...inText].map((x) => x.toLowerCase())
}

export type NoiseReason = 'low-reputation' | 'bot' | 'video'
export type RejectReason = NoiseReason | 'no-photo'

/**
 * Why a short post is noise rather than something a person wrote for
 * people: flagged accounts, game and auto-poster updates, and video promos
 * (which the app can't play). Used by both Snaps and Photos.
 */
export function noiseReason(p: Post): NoiseReason | null {
  if ((p.author_reputation ?? 0) < MIN_REPUTATION) return 'low-reputation'
  const app = p.json_metadata?.app
  if (typeof app === 'string' && BOT_APPS.test(app)) return 'bot'
  if (tagsOf(p).some((t) => BOT_TAGS.has(t))) return 'bot'
  if (VIDEO_IN_BODY.test(p.body ?? '')) return 'video'
  return null
}

/**
 * Why a post can't go into Photos, or null if it can (still pending the
 * on-device image check). NSFW tags, NSFW communities and posts that
 * communities have muted are handled by hive.ts `visible` / `isNsfw`.
 */
export function rejectReason(p: Post): RejectReason | null {
  return noiseReason(p) ?? (photoImages(p).length === 0 ? 'no-photo' : null)
}

/** The pictures to show for a post: trusted hosts only, screenshots dropped from snaps. */
export function photoImages(p: Post): string[] {
  const isSnap = p.depth > 0
  return findImages(p)
    .filter((i) => TRUSTED_HOST.test(i.url) && !(isSnap && SCREENSHOT_ALT.test(i.alt.trim())))
    .map((i) => i.url)
    .slice(0, MAX_IMAGES)
}

export interface SafetyScores {
  Drawing?: number
  Hentai?: number
  Neutral?: number
  Porn?: number
  Sexy?: number
}

/**
 * The on-device model's verdict. Deliberately cautious: a beach photo may be
 * held back now and then, which is better than one explicit picture slipping
 * through in a feed made for newcomers.
 */
export function looksUnsafe(s: SafetyScores): boolean {
  const porn = s.Porn ?? 0
  const hentai = s.Hentai ?? 0
  const sexy = s.Sexy ?? 0
  return porn >= 0.15 || hentai >= 0.2 || sexy >= 0.35 || porn + hentai + sexy >= 0.45
}
