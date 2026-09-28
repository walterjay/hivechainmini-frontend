/** Hive tags are lowercase letters, digits and dashes. Longer ones get dropped by indexers. */
const MAX_TAG_LENGTH = 24
export const MAX_SNAP_TAGS = 10

/**
 * The #hashtags in a text, lowercased and without duplicates, in order of appearance.
 * A hashtag must start the text or follow whitespace, so URL fragments and
 * markdown headings ("# Title") don't count.
 */
export function hashtags(text: string): string[] {
  const found = new Set<string>()
  for (const m of text.matchAll(/(?:^|\s)#([a-z0-9][a-z0-9-]*)/gi)) {
    const tag = m[1].toLowerCase().replace(/-+$/, '')
    if (tag.length <= MAX_TAG_LENGTH) found.add(tag)
  }
  return [...found]
}

/**
 * Tags for a snap, in the same shape PeakD writes them: "snaps" first, then the
 * hashtags from the text, so tag pages and searches in other Hive apps find it.
 */
export function snapTags(body: string, hasPhoto: boolean): string[] {
  const tags = new Set(['snaps', ...(hasPhoto ? ['photo'] : []), ...hashtags(body)])
  return [...tags].slice(0, MAX_SNAP_TAGS)
}
