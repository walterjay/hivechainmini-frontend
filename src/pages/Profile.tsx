import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router'
import Avatar from '../components/Avatar'
import Feed from '../components/Feed'
import FollowButton from '../components/FollowButton'
import { EmptyState, ErrorState, Spinner } from '../components/Status'
import { accountFeed } from '../lib/feeds'
import { getProfile, type Profile as P } from '../lib/hive'
import { useTitle } from '../lib/useTitle'
import { useAuth } from '../state/auth'

const fmt = new Intl.NumberFormat('en', { notation: 'compact' })

export default function Profile() {
  const { account: name = '' } = useParams()
  const { account } = useAuth()
  const [profile, setProfile] = useState<P | null | undefined>(undefined)
  const [error, setError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [tab, setTab] = useState<'posts' | 'comments'>('posts')
  const display = profile?.metadata?.profile?.name?.trim() || name
  useTitle(profile ? display : undefined)

  useEffect(() => {
    let off = false
    setProfile(undefined)
    setError(false)
    setTab('posts')
    getProfile(name, account ?? '')
      .then((p) => !off && setProfile(p))
      .catch(() => !off && setError(true))
    return () => {
      off = true
    }
  }, [name, account, attempt])

  const loader = useMemo(() => accountFeed(name, tab, account ?? ''), [name, tab, account])

  if (error) return <ErrorState onRetry={() => setAttempt((a) => a + 1)} />
  if (profile === undefined) return <Spinner label="Loading profile…" />
  if (profile === null) return <EmptyState emoji="🫥" title={`We couldn’t find @${name}`} />

  const about = profile.metadata?.profile?.about?.trim()
  const isMe = account === name

  return (
    <>
      <section className="card mb-4 p-5 sm:p-6">
        <div className="flex items-center gap-4">
          <Avatar account={name} size={72} />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-extrabold tracking-tight">{display}</h1>
            <p className="text-sm text-muted">@{name}</p>
          </div>
          <FollowButton account={name} />
        </div>
        {about && <p className="mt-4 whitespace-pre-line">{about}</p>}
        <p className="mt-3 text-sm text-muted">
          <strong className="text-zinc-900 dark:text-zinc-100">{fmt.format(profile.stats.followers)}</strong> followers ·{' '}
          <strong className="text-zinc-900 dark:text-zinc-100">{fmt.format(profile.stats.following)}</strong> following ·{' '}
          joined {new Date(profile.created + 'Z').toLocaleDateString('en', { month: 'long', year: 'numeric' })}
        </p>
      </section>
      <div className="mb-4 flex gap-1" role="tablist" aria-label="Activity">
        {(['posts', 'comments'] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={`chip ${tab === t ? 'chip-on' : 'chip-off'}`} onClick={() => setTab(t)}>
            {t === 'posts' ? 'Posts' : 'Comments'}
          </button>
        ))}
      </div>
      <Feed
        resetKey={`${name}|${tab}|${account ?? ''}`}
        loadPage={loader}
        showFollow={false}
        empty={
          <EmptyState emoji={tab === 'posts' ? '📝' : '💬'} title={tab === 'posts' ? 'No posts yet' : 'No comments yet'}>
            {isMe && <p>{tab === 'posts' ? 'Your first post is just a tap away. Say hello!' : 'Find a post you like and say something nice.'}</p>}
          </EmptyState>
        }
      />
    </>
  )
}
