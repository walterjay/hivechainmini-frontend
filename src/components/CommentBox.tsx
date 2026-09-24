import { useId, useState } from 'react'
import { APP_ID, COMMENT_SOFT_CAP } from '../config'
import type { Post } from '../lib/hive'
import { replyPermlink } from '../lib/permlink'
import { invalidateCache } from '../lib/rpc'
import { useAuth } from '../state/auth'
import Markdown from './Markdown'

/** Build a local stand-in for a just-sent comment so it shows immediately. */
function optimistic(parent: Post, author: string, permlink: string, body: string): Post {
  return {
    author,
    permlink,
    title: '',
    body,
    category: parent.category,
    community: parent.community,
    created: new Date().toISOString().slice(0, 19),
    depth: parent.depth + 1,
    children: 0,
    parent_author: parent.author,
    parent_permlink: parent.permlink,
    active_votes: [],
    replies: [],
    json_metadata: {},
  }
}

export default function CommentBox({
  parent,
  onPosted,
  onRemoved,
  onCancel,
  autoFocus = false,
  placeholder = 'Say something kind…',
}: {
  parent: Post
  onPosted: (c: Post) => void
  onRemoved: (c: Post) => void
  onCancel?: () => void
  autoFocus?: boolean
  placeholder?: string
}) {
  const { account, ensureLogin, broadcast } = useAuth()
  const [body, setBody] = useState('')
  const [preview, setPreview] = useState(false)
  const [busy, setBusy] = useState(false)
  const id = useId()
  const len = body.trim().length
  const over = len > COMMENT_SOFT_CAP

  async function submit() {
    if (!len || busy) return
    const who = account ?? (await ensureLogin('Log in to join the conversation.'))
    if (!who) return
    setBusy(true)
    const permlink = replyPermlink(parent.author)
    const text = body.trim()
    const draft = optimistic(parent, who, permlink, text)
    onPosted(draft)
    setBody('')
    setPreview(false)
    const ok = await broadcast(
      [
        [
          'comment',
          {
            parent_author: parent.author,
            parent_permlink: parent.permlink,
            author: who,
            permlink,
            title: '',
            body: text,
            json_metadata: JSON.stringify({ app: APP_ID, format: 'markdown', tags: parent.community ? [parent.community] : [] }),
          },
        ],
      ],
      { milestone: 'comment' },
    )
    if (ok) {
      onPosted({ ...draft, url: `/@${who}/${permlink}` })
      invalidateCache('get_discussion')
      onCancel?.()
    } else {
      onRemoved(draft)
      setBody(text)
    }
    setBusy(false)
  }

  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <label htmlFor={id} className="sr-only">
        Write a comment
      </label>
      {preview ? (
        <div className="min-h-24 rounded-2xl border border-zinc-300 p-4 dark:border-zinc-700">
          {len ? <Markdown source={body} /> : <p className="text-muted">Nothing to preview yet.</p>}
        </div>
      ) : (
        <textarea
          id={id}
          className="input min-h-24 resize-y"
          value={body}
          placeholder={placeholder}
          autoFocus={autoFocus}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit()
          }}
        />
      )}
      <div className="flex flex-wrap items-center gap-2">
        <span className={`text-xs ${over ? 'font-semibold text-amber-700 dark:text-amber-300' : 'text-muted'}`} aria-live="polite">
          {over ? `${len} characters, a bit long for a comment. Maybe trim it?` : `${len} / ${COMMENT_SOFT_CAP}`}
        </span>
        <div className="ml-auto flex gap-2">
          {onCancel && (
            <button type="button" className="btn-ghost btn-sm" onClick={onCancel}>
              Cancel
            </button>
          )}
          <button type="button" className="btn-ghost btn-sm" onClick={() => setPreview((p) => !p)} aria-pressed={preview}>
            {preview ? 'Edit' : 'Preview'}
          </button>
          <button type="submit" className="btn-primary btn-sm" disabled={!len || busy}>
            {busy ? 'Sending…' : 'Reply'}
          </button>
        </div>
      </div>
    </form>
  )
}
