import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import Markdown from '../components/Markdown'
import { EmptyState } from '../components/Status'
import { APP_ID, POST_SOFT_CAP, type CommunityRef } from '../config'
import { getCommunity } from '../lib/hive'
import { postPermlink } from '../lib/permlink'
import { invalidateCache, rpc } from '../lib/rpc'
import { load, save } from '../lib/storage'
import { useTitle } from '../lib/useTitle'
import { useAuth } from '../state/auth'
import { useCommunities } from '../state/communities'

const DRAFT_KEY = 'hh.draft'
interface Draft {
  title: string
  body: string
  community: string
  tags: string
}

function parseTags(s: string) {
  return [...new Set(s.toLowerCase().split(/[\s,#]+/).map((t) => t.replace(/[^a-z0-9-]/g, '')).filter((t) => t && t.length <= 24))].slice(0, 5)
}

function imagesIn(body: string) {
  return [...body.matchAll(/https:\/\/[^\s)"'<>]+\.(?:jpe?g|png|gif|webp)/gi)].map((m) => m[0]).slice(0, 5)
}

/** Hivemind indexes new posts a few seconds after they're broadcast. */
async function waitForPost(author: string, permlink: string) {
  for (let i = 0; i < 8; i++) {
    await new Promise((r) => setTimeout(r, 1500))
    try {
      const p = await rpc<{ author?: string } | null>('bridge.get_post', { author, permlink, observer: '' })
      if (p?.author) return
    } catch {
      /* not indexed yet */
    }
  }
}

export default function Submit() {
  const { account, ensureLogin, broadcast } = useAuth()
  const { communities } = useCommunities()
  const [params] = useSearchParams()
  const nav = useNavigate()
  useTitle('Write a post')

  const [draft, setDraft] = useState<Draft>(() => {
    const d = load<Draft>(DRAFT_KEY, { title: '', body: '', community: '', tags: '' })
    return { ...d, community: params.get('community') || d.community || communities[0]?.id || '' }
  })
  const [extraCommunity, setExtraCommunity] = useState<CommunityRef | null>(null)
  const [tab, setTab] = useState<'write' | 'preview'>('write')
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    save(DRAFT_KEY, draft)
  }, [draft])

  // A community passed in the URL that the user hasn't joined still gets a proper name.
  useEffect(() => {
    const id = draft.community
    if (!id || communities.some((c) => c.id === id)) return
    getCommunity(id).then((c) => c && setExtraCommunity({ id, title: c.title })).catch(() => {})
  }, [draft.community, communities])

  const options = useMemo(
    () => (extraCommunity && !communities.some((c) => c.id === extraCommunity.id) ? [...communities, extraCommunity] : communities),
    [communities, extraCommunity],
  )

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }))
  const len = draft.body.trim().length
  const over = len > POST_SOFT_CAP
  const canPost = draft.title.trim().length > 0 && len > 0 && !!draft.community && !busy

  async function publish() {
    if (!canPost) return
    const who = account ?? (await ensureLogin('Log in to share your post.'))
    if (!who) return
    setBusy('Getting your post ready…')
    const title = draft.title.trim().slice(0, 255)
    const permlink = await postPermlink(who, title)
    const tags = [draft.community, ...parseTags(draft.tags).filter((t) => t !== draft.community)]
    setBusy('Waiting for your approval…')
    const ok = await broadcast(
      [
        [
          'comment',
          {
            parent_author: '',
            parent_permlink: draft.community,
            author: who,
            permlink,
            title,
            body: draft.body.trim(),
            json_metadata: JSON.stringify({ app: APP_ID, format: 'markdown', tags, image: imagesIn(draft.body) }),
          },
        ],
      ],
      { milestone: 'post' },
    )
    if (!ok) {
      setBusy(null)
      return
    }
    setBusy('Publishing…')
    await waitForPost(who, permlink)
    invalidateCache('get_ranked_posts', 'get_account_posts')
    save(DRAFT_KEY, null)
    nav(`/p/${who}/${permlink}`, { state: { justPosted: true } })
  }

  if (!options.length) {
    return (
      <EmptyState emoji="🧭" title="Join a community first">
        <p>Posts live in communities. Pick one or two you like, then come back to write.</p>
        <Link to="/communities" className="btn-primary mt-4">
          Find communities
        </Link>
      </EmptyState>
    )
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        publish()
      }}
      className="space-y-4"
    >
      <h1 className="text-2xl font-extrabold tracking-tight">Write a post ✏️</h1>

      <div>
        <label htmlFor="p-community" className="mb-1 block text-sm font-semibold">
          Community
        </label>
        <select id="p-community" className="input" value={draft.community} onChange={(e) => set('community', e.target.value)}>
          {options.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="p-title" className="mb-1 block text-sm font-semibold">
          Title
        </label>
        <input id="p-title" className="input text-lg font-semibold" maxLength={255} value={draft.title} onChange={(e) => set('title', e.target.value)} placeholder="Give it a friendly title" />
      </div>

      <div>
        <div className="mb-1 flex items-end justify-between">
          <label htmlFor="p-body" className="text-sm font-semibold">
            Your post
          </label>
          <div className="flex gap-1 lg:hidden" role="tablist" aria-label="Editor view">
            {(['write', 'preview'] as const).map((t) => (
              <button type="button" key={t} role="tab" aria-selected={tab === t} className={`chip py-1 text-xs ${tab === t ? 'chip-on' : 'chip-off'}`} onClick={() => setTab(t)}>
                {t === 'write' ? 'Write' : 'Preview'}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <textarea
            id="p-body"
            className={`input min-h-80 resize-y font-mono text-sm ${tab === 'preview' ? 'hidden lg:block' : ''}`}
            value={draft.body}
            onChange={(e) => set('body', e.target.value)}
            placeholder={'Write in plain text or markdown.\n\n**bold**, *italic*, ## Heading\n\nAdd a picture by pasting its link:\n![my photo](https://…/photo.jpg)'}
          />
          <div className={`card min-h-80 overflow-auto p-4 ${tab === 'write' ? 'hidden lg:block' : ''}`} aria-label="Preview">
            {len ? <Markdown source={draft.body} /> : <p className="text-sm text-muted">Your preview shows up here.</p>}
          </div>
        </div>
        <p className={`mt-1 text-xs ${over ? 'font-semibold text-amber-700 dark:text-amber-300' : 'text-muted'}`} aria-live="polite">
          {over ? `${len.toLocaleString()} characters. That’s a long one! Shorter posts often get more readers.` : `${len.toLocaleString()} / ${POST_SOFT_CAP.toLocaleString()} characters`}
        </p>
      </div>

      <div>
        <label htmlFor="p-tags" className="mb-1 block text-sm font-semibold">
          Tags <span className="font-normal text-muted">(optional, up to 5)</span>
        </label>
        <input id="p-tags" className="input" value={draft.tags} onChange={(e) => set('tags', e.target.value)} placeholder="e.g. introduction, cooking, travel" />
      </div>

      <div className="flex items-center justify-end gap-3 pb-6">
        {busy && (
          <span className="text-sm text-muted" role="status">
            {busy}
          </span>
        )}
        <button type="submit" className="btn-primary" disabled={!canPost}>
          Publish
        </button>
      </div>
    </form>
  )
}
