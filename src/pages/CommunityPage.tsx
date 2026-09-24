import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import Feed from '../components/Feed'
import JoinButton from '../components/JoinButton'
import { EmptyState } from '../components/Status'
import { communityFeed } from '../lib/feeds'
import { getCommunity, type Community } from '../lib/hive'
import { useTitle } from '../lib/useTitle'
import { useAuth } from '../state/auth'

const fmt = new Intl.NumberFormat('en', { notation: 'compact' })

export default function CommunityPage() {
  const { id = '' } = useParams()
  const { account } = useAuth()
  const [params, setParams] = useSearchParams()
  const sort = params.get('sort') === 'new' ? 'created' : 'hot'
  const [info, setInfo] = useState<Community | null | undefined>(undefined)
  useTitle(info?.title)

  useEffect(() => {
    let off = false
    setInfo(undefined)
    getCommunity(id, account ?? '')
      .then((c) => !off && setInfo(c))
      .catch(() => !off && setInfo(null))
    return () => {
      off = true
    }
  }, [id, account])

  const loader = useMemo(() => communityFeed(id, sort, account ?? ''), [id, sort, account])

  if (!/^hive-\d+$/.test(id)) {
    return (
      <EmptyState emoji="🧭" title="That community doesn’t exist">
        <Link to="/communities" className="btn-primary mt-4">
          Browse communities
        </Link>
      </EmptyState>
    )
  }

  return (
    <>
      <section className="card mb-4 p-5">
        <div className="flex items-start gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-extrabold tracking-tight">{info?.title ?? (info === null ? id : '…')}</h1>
            {info && <p className="text-sm text-muted">{fmt.format(info.subscribers)} members</p>}
          </div>
          {info && <JoinButton community={{ id, title: info.title }} />}
        </div>
        {info?.about && <p className="mt-3 text-sm">{info.about}</p>}
        <Link to={`/submit?community=${id}`} className="btn-ghost btn-sm mt-4">
          ✏️ Write a post here
        </Link>
      </section>
      <div className="mb-4 flex gap-1" role="group" aria-label="Sort posts">
        {(['hot', 'created'] as const).map((s) => (
          <button
            key={s}
            aria-pressed={sort === s}
            className={`chip ${sort === s ? 'chip-on' : 'chip-off'}`}
            onClick={() => setParams(s === 'hot' ? {} : { sort: 'new' }, { replace: true })}
          >
            {s === 'hot' ? '🔥 Hot' : '✨ New'}
          </button>
        ))}
      </div>
      <Feed
        resetKey={`${id}|${sort}|${account ?? ''}`}
        loadPage={loader}
        showCommunity={false}
        empty={
          <EmptyState emoji="🌱" title="No posts here yet">
            <p>Be the first to share something!</p>
          </EmptyState>
        }
      />
    </>
  )
}
