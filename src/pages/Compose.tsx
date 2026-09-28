import { useEffect, useId, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { APP_ID, COMMENT_SOFT_CAP } from '../config'
import { friendlyError, isCancel } from '../lib/errors'
import { snapTags } from '../lib/hashtags'
import { replyPermlink } from '../lib/permlink'
import { invalidateCache } from '../lib/rpc'
import { isSafeCanvas } from '../lib/safety'
import { latestContainer, SHORT_FORM_SOURCES } from '../lib/shortform'
import { preparePhoto, uploadPhoto, type PreparedPhoto } from '../lib/upload'
import { useTitle } from '../lib/useTitle'
import { useAuth } from '../state/auth'
import { useToast } from '../state/toast'

/**
 * Everything short goes out as a snap on PeakD's Snaps: the widest-read of the
 * short-form feeds, so it also shows in other Hive apps. No need to ask.
 */
const DESTINATION = SHORT_FORM_SOURCES[0].account

type Check = 'checking' | 'ok' | 'blocked' | 'error' | 'unavailable'

/** The one composer: a few words, a photo, or both. Longer articles go to /submit. */
export default function Compose() {
  useTitle('New')
  const { account, session, ensureLogin, broadcast } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const fileInput = useRef<HTMLInputElement>(null)
  const textId = useId()
  const [text, setText] = useState('')
  const [photo, setPhoto] = useState<PreparedPhoto | null>(null)
  const [check, setCheck] = useState<Check>('ok')
  const [step, setStep] = useState<null | 'upload' | 'post'>(null)
  // Kept after a successful upload so a failed post can be retried without uploading again.
  const [uploaded, setUploaded] = useState<{ blob: Blob; url: string } | null>(null)

  useEffect(() => () => void (photo && URL.revokeObjectURL(photo.previewUrl)), [photo])

  async function pick(file: File | undefined) {
    if (!file) return
    setCheck('checking')
    setUploaded(null)
    let p: PreparedPhoto
    try {
      p = await preparePhoto(file)
    } catch {
      setPhoto(null)
      setCheck('error')
      return
    }
    setPhoto(p)
    try {
      setCheck((await isSafeCanvas(p.canvas)) ? 'ok' : 'blocked')
    } catch {
      setCheck('unavailable')
    }
  }

  function removePhoto() {
    setPhoto(null)
    setCheck('ok')
    setUploaded(null)
  }

  const body = text.trim()
  const photoNeedsKeychain = !!photo && session?.method === 'hiveauth'
  const canPost = (body.length > 0 || !!photo) && (!photo || check === 'ok') && !step && !photoNeedsKeychain

  async function post() {
    if (!canPost) return
    const who = account ?? (await ensureLogin('Log in to share.'))
    if (!who) return
    if (photo && !window.hive_keychain) {
      toast('Sharing photos needs the Hive Keychain browser extension for now.', 'error')
      return
    }
    try {
      let url: string | null = null
      if (photo) {
        setStep('upload')
        url = uploaded?.blob === photo.blob ? uploaded.url : await uploadPhoto(who, photo.blob)
        setUploaded({ blob: photo.blob, url })
      }
      setStep('post')
      const container = await latestContainer(DESTINATION)
      if (!container) throw new Error('network: no container')
      const ok = await broadcast(
        [
          [
            'comment',
            {
              parent_author: container.author,
              parent_permlink: container.permlink,
              author: who,
              permlink: replyPermlink(container.author),
              title: '',
              body: [body, url && `![photo](${url})`].filter(Boolean).join('\n\n'),
              json_metadata: JSON.stringify({
                app: APP_ID,
                format: 'markdown',
                tags: snapTags(body, !!url),
                ...(url ? { image: [url] } : {}),
              }),
            },
          ],
        ],
        { milestone: 'post' },
      )
      if (!ok) return
      invalidateCache('get_discussion')
      toast(url ? '📷 Your photo is live! It can take a minute to show up.' : '🎉 Shared! It can take a minute to show up.')
      navigate(url ? '/photos' : '/')
    } catch (e) {
      toast(friendlyError(e), isCancel(e) ? 'info' : 'error')
    } finally {
      setStep(null)
    }
  }

  const overlay: Partial<Record<Check, string>> = {
    checking: '🛡️ Checking your photo…',
    blocked: 'This photo can’t be shared. It may show nudity or adult content, and this app is for everyone. Try a different one.',
    unavailable: 'The photo safety check couldn’t start in this browser, so photos can’t be shared from here right now. Try reloading.',
  }

  return (
    <>
      <h1 className="sr-only">Share something new</h1>
      <div className="card space-y-3 p-4 sm:p-5">
        <label htmlFor={textId} className="sr-only">
          What’s new?
        </label>
        <textarea
          id={textId}
          className="input min-h-28 resize-y border-0 px-1 text-lg focus:ring-0"
          value={text}
          placeholder="What’s new?"
          autoFocus
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) post()
          }}
        />

        <input
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          aria-label="Choose a photo"
          onChange={(e) => {
            pick(e.target.files?.[0])
            e.target.value = ''
          }}
        />
        {photo && (
          <div className="relative overflow-hidden rounded-2xl bg-black">
            <img src={photo.previewUrl} alt="Your photo" className={`mx-auto max-h-[50vh] w-auto object-contain ${check === 'ok' ? '' : 'blur-2xl'}`} />
            {overlay[check] && (
              <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm font-semibold text-white" role="status">
                <span className="max-w-xs">{overlay[check]}</span>
              </div>
            )}
            <button
              className="absolute top-2 right-2 grid h-9 w-9 place-items-center rounded-full bg-black/60 text-white hover:bg-black/80"
              aria-label="Remove photo"
              onClick={removePhoto}
              disabled={!!step}
            >
              ✕
            </button>
          </div>
        )}
        {check === 'error' && <p className="text-sm text-rose-700 dark:text-rose-300">That file didn’t work. Try another photo.</p>}
        {photoNeedsKeychain && (
          <p className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-950 dark:text-amber-50">
            Sharing photos needs Hive Keychain for now. HiveAuth can’t sign picture uploads yet, but you can still share text.
          </p>
        )}

        <div className="flex items-center gap-2 border-t border-zinc-200 pt-3 dark:border-zinc-800">
          <button className="btn-ghost btn-sm" onClick={() => fileInput.current?.click()} disabled={!!step}>
            📷 {photo ? 'Change photo' : 'Add a photo'}
          </button>
          {body.length > COMMENT_SOFT_CAP * 0.8 && (
            <span className={`text-xs ${body.length > COMMENT_SOFT_CAP ? 'font-semibold text-amber-700 dark:text-amber-300' : 'text-muted'}`}>
              {body.length} / {COMMENT_SOFT_CAP}
            </span>
          )}
          <button className="btn-primary ml-auto" disabled={!canPost} onClick={post}>
            {step === 'upload' ? 'Uploading…' : step === 'post' ? 'Sharing…' : 'Share'}
          </button>
        </div>
      </div>

      <p className="mt-4 text-center text-sm text-muted">
        Got more to say?{' '}
        <Link to="/submit" className="link">
          Write a longer post with a title →
        </Link>
      </p>
    </>
  )
}
