import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import CommentBox from '../components/CommentBox'
import { ErrorState, Spinner } from '../components/Status'
import type { Post } from '../lib/hive'
import { latestContainer, SHORT_FORM_SOURCES, type ShortFormSource } from '../lib/shortform'
import { useTitle } from '../lib/useTitle'

export default function NewSnap() {
  useTitle('New snap')
  const navigate = useNavigate()
  const [source, setSource] = useState<ShortFormSource>(SHORT_FORM_SOURCES[0])
  const [container, setContainer] = useState<Post | null | undefined>(undefined)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let off = false
    setContainer(undefined)
    latestContainer(source.account)
      .then((c) => !off && setContainer(c))
      .catch(() => !off && setContainer(null))
    return () => {
      off = true
    }
  }, [source, attempt])

  return (
    <>
      <h1 className="text-2xl font-extrabold tracking-tight">New snap</h1>
      <p className="mt-1 text-sm text-muted">A quick, short-form update — no title needed.</p>

      <div className="my-4 flex flex-wrap gap-1" role="group" aria-label="Post to">
        {SHORT_FORM_SOURCES.map((s) => (
          <button key={s.key} className={`chip ${source.key === s.key ? 'chip-on' : 'chip-off'}`} onClick={() => setSource(s)}>
            {s.icon} {s.label}
          </button>
        ))}
      </div>

      <div className="card p-4 sm:p-5">
        {container === undefined ? (
          <Spinner label="Getting things ready…" />
        ) : container === null ? (
          <ErrorState onRetry={() => setAttempt((a) => a + 1)} />
        ) : (
          <CommentBox
            key={`${source.key}-${container.author}-${container.permlink}`}
            parent={container}
            placeholder={`What's happening? Posts to ${source.label}.`}
            submitLabel="Post it"
            autoFocus
            onPosted={(c) => c.url && navigate('/snaps')}
            onRemoved={() => {}}
          />
        )}
      </div>
    </>
  )
}
