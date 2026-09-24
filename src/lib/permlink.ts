import { contentExists } from './hive'

export function slugify(title: string) {
  return (
    title
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60)
      .replace(/-+$/, '') || 'post'
  )
}

/** A valid, unique post permlink: slug of the title, suffixed if already used. */
export async function postPermlink(author: string, title: string) {
  const base = slugify(title)
  if (!(await contentExists(author, base))) return base
  return `${base}-${Date.now().toString(36)}`
}

/** Comment permlinks follow the common "re-<parent author>-<timestamp>" pattern. */
export function replyPermlink(parentAuthor: string) {
  const who = parentAuthor.replace(/[^a-z0-9-]/g, '')
  return `re-${who}-${Date.now().toString(36)}`.slice(0, 255)
}
