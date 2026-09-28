import { useEffect, useId, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { APP_ID } from '../config'
import { friendlyError, isCancel } from '../lib/errors'
import { replyPermlink } from '../lib/permlink'
import { invalidateCache } from '../lib/rpc'
import { isSafeCanvas } from '../lib/safety'
import { latestContainer, SHORT_FORM_SOURCES } from '../lib/shortform'
import { preparePhoto, uploadPhoto, type PreparedPhoto } from '../lib/upload'
import { useTitle } from '../lib/useTitle'
import { useAuth } from '../state/auth'
import { useToast } from '../state/toast'

/** Photos are shared as a snap, so they also show up in Snaps and in other Hive apps. */
const DESTINATIONS = SHORT_FORM_SOURCES.filter((s) => s.key === 'snaps' || s.key === 'waves')
const CAPTION_MAX = 300

type Check = 'checking' | 'ok' | 'blocked' | 'error' | 'unavailable'

export default function NewPhoto() {
  useTitle('New photo')
  const { account, session, ensureLogin, broadcast } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const fileInput = useRef<HTMLInputElement>(null)
  const captionId = useId()
  const [photo, setPhoto] = useState<PreparedPhoto | null>(null)
  const [check, setCheck] = useState<Check>('checking')
  const [caption, setCaption] = useState('')
  const [dest, setDest] = useState(DESTINATIONS[0])
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

  const needsKeychain = session?.method === 'hiveauth'
  const canPost = !!photo && check === 'ok' && !step && !needsKeychain

  async function post() {
    if (!photo || !canPost) return
    const who = account ?? (await ensureLogin('Log in to share a photo.'))
    if (!who) return
    if (!window.hive_keychain) {
      toast('Uploading photos needs the Hive Keychain browser extension for now.', 'error')
      return
    }
    try {
      setStep('upload')
      const url = uploaded?.blob === photo.blob ? uploaded.url : await uploadPhoto(who, photo.blob)
      setUploaded({ blob: photo.blob, url })
      setStep('post')
      const container = await latestContainer(dest.account)
      if (!container) throw new Error('network: no container')
      const text = caption.trim()
      const permlink = replyPermlink(container.author)
      const ok = await broadcast(
        [
          [
            'comment',
            {
              parent_author: container.author,
              parent_permlink: container.permlink,
              author: who,
              permlink,
              title: '',
              body: `${text ? text + '\n\n' : ''}![photo](${url})`,
              json_metadata: JSON.stringify({
                app: APP_ID,
                format: 'markdown',
                tags: [...(container.community ? [container.community] : []), 'photo'],
                image: [url],
              }),
            },
          ],
        ],
        { milestone: 'post' },
      )
      if (!ok) return
      invalidateCache('get_discussion')
      toast('📷 Your photo is live! It can take a minute to show up in the feed.')
      navigate('/photos')
    } catch (e) {
      toast(friendlyError(e), isCancel(e) ? 'info' : 'error')
    } finally {
      setStep(null)
    }
  }

  return (
    <>
      <h1 className="text-2xl font-extrabold tracking-tight">New photo</h1>
      <p className="mt-1 text-sm text-muted">One picture and a few words. It’s shared as a snap, so it shows in Photos and Snaps.</p>

      <div className="card mt-4 space-y-4 p-4 sm:p-5">
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
        {!photo ? (
          <button
            className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-zinc-300 text-muted transition hover:border-brand hover:text-brand dark:border-zinc-700"
            onClick={() => fileInput.current?.click()}
          >
            <span className="text-4xl" aria-hidden>
              📷
            </span>
            <span className="font-semibold">{check === 'error' ? 'That file didn’t work. Try another photo' : 'Choose a photo'}</span>
            <span className="text-xs">JPEG, PNG or WebP</span>
          </button>
        ) : (
          <div className="space-y-2">
            <div className="relative overflow-hidden rounded-2xl bg-black">
              <img
                src={photo.previewUrl}
                alt="Your photo"
                className={`mx-auto max-h-[60vh] w-auto object-contain ${check === 'ok' ? '' : 'blur-2xl'}`}
              />
              {check !== 'ok' && (
                <div className="absolute inset-0 grid place-items-center p-6 text-center text-white" role="status">
                  {check === 'checking' ? (
                    <span className="text-sm font-semibold">🛡️ Checking your photo…</span>
                  ) : check === 'unavailable' ? (
                    <span className="max-w-xs text-sm font-semibold">
                      The safety check couldn’t start in this browser, so photos can’t be shared from here right now. Try reloading the page.
                    </span>
                  ) : (
                    <span className="max-w-xs text-sm font-semibold">
                      This photo can’t be shared in Photos. It may show nudity or adult content, and Photos is for everyone. Try a
                      different one.
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center justify-between gap-2 text-xs text-muted">
              <span>{check === 'ok' ? '🛡️ Safety check passed · location data removed' : ''}</span>
              <button className="btn-ghost btn-sm" onClick={() => fileInput.current?.click()} disabled={!!step}>
                Change photo
              </button>
            </div>
          </div>
        )}

        <div>
          <label htmlFor={captionId} className="mb-1 block text-sm font-semibold">
            Say something about it <span className="font-normal text-muted">(optional)</span>
          </label>
          <textarea
            id={captionId}
            className="input min-h-20 resize-y"
            maxLength={CAPTION_MAX}
            value={caption}
            placeholder="Where was this? What made you take it?"
            onChange={(e) => setCaption(e.target.value)}
          />
          <p className="mt-1 text-right text-xs text-muted">
            {caption.trim().length} / {CAPTION_MAX}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Share to">
          <span className="mr-1 text-sm font-semibold">Share to</span>
          {DESTINATIONS.map((d) => (
            <button key={d.key} className={`chip ${dest.key === d.key ? 'chip-on' : 'chip-off'}`} aria-pressed={dest.key === d.key} onClick={() => setDest(d)}>
              {d.icon} {d.label}
            </button>
          ))}
        </div>

        {needsKeychain && (
          <p className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-950 dark:text-amber-50">
            Uploading photos needs Hive Keychain for now. HiveAuth can’t sign picture uploads yet. You can still browse and upvote photos.
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Link to="/photos" className="btn-ghost">
            Cancel
          </Link>
          <button className="btn-primary" disabled={!canPost} onClick={post}>
            {step === 'upload' ? 'Uploading…' : step === 'post' ? 'Posting…' : 'Share photo'}
          </button>
        </div>
      </div>
    </>
  )
}
