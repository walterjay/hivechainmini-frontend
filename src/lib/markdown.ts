import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { IMAGE_PROXY } from '../config'

marked.setOptions({ gfm: true, breaks: true })

const HIVE_FRONTENDS = /^https?:\/\/(?:www\.)?(?:hive\.blog|peakd\.com|ecency\.com|inleo\.io)\/(?:[^/]+\/)?@([a-z0-9.-]+)(?:\/([a-z0-9-]+))?\/?$/i

/** Point links to other Hive front ends back into this app. */
function internalize(href: string): string | null {
  const m = href.match(HIVE_FRONTENDS)
  if (!m) return null
  return m[2] ? `/p/${m[1]}/${m[2]}` : `/u/${m[1]}`
}

function proxied(src: string) {
  if (src.startsWith(IMAGE_PROXY)) return src
  return `${IMAGE_PROXY}/768x0/${src}`
}

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    const href = node.getAttribute('href') ?? ''
    const inner = internalize(href)
    if (inner) {
      node.setAttribute('href', inner)
      node.removeAttribute('target')
    } else if (/^https?:/i.test(href)) {
      node.setAttribute('target', '_blank')
      node.setAttribute('rel', 'noopener noreferrer nofollow ugc')
    }
  }
  if (node.tagName === 'IMG') {
    const src = node.getAttribute('src') ?? ''
    if (!/^https:\/\//i.test(src)) node.remove()
    else {
      node.setAttribute('src', proxied(src))
      node.setAttribute('loading', 'lazy')
      node.setAttribute('decoding', 'async')
      node.setAttribute('referrerpolicy', 'no-referrer')
      if (!node.getAttribute('alt')) node.setAttribute('alt', '')
    }
  }
})

const PURIFY_CONFIG = {
  FORBID_TAGS: ['script', 'style', 'iframe', 'frame', 'object', 'embed', 'form', 'input', 'button', 'textarea', 'select', 'link', 'meta', 'base', 'svg', 'math'],
  FORBID_ATTR: ['style', 'class', 'id', 'srcset'],
  // Only web links, mail links and in-app paths. Blocks javascript:, data:, vbscript:, etc.
  ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|\/(?!\/)|#)/i,
}

/** Hive-flavoured tweaks before markdown: bare image URLs become images, @names become links. */
function preprocess(src: string) {
  return src
    .replace(/(^|\s)(https?:\/\/\S+\.(?:jpe?g|png|gif|webp)(?:\?\S*)?)(?=\s|$)/gim, '$1![]($2)')
    .replace(/(^|[\s(])@([a-z][a-z0-9.-]{2,15})\b/g, '$1[@$2](/u/$2)')
}

export function renderMarkdown(src: string): string {
  const html = marked.parse(preprocess(src ?? ''), { async: false }) as string
  return DOMPurify.sanitize(html, PURIFY_CONFIG) as string
}
