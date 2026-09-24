import { useState } from 'react'
import { invalidateCache } from '../lib/rpc'
import { useAuth } from '../state/auth'
import { useFollows } from '../state/follows'

const followOp = (follower: string, following: string, follow: boolean): [string, Record<string, unknown>] => [
  'custom_json',
  {
    required_auths: [],
    required_posting_auths: [follower],
    id: 'follow',
    // Per developers.hive.io: ["blog"] follows, [""] unfollows.
    json: JSON.stringify(['follow', { follower, following, what: follow ? ['blog'] : [''] }]),
  },
]

export default function FollowButton({ account: target, small = false }: { account: string; small?: boolean }) {
  const { account, broadcast, ensureLogin } = useAuth()
  const { loaded, isFollowing, setFollowing } = useFollows()
  const [busy, setBusy] = useState(false)

  if (account === target) return null
  const following = isFollowing(target)

  async function toggle() {
    const who = account ?? (await ensureLogin(`Log in to follow @${target}.`))
    if (!who || who === target) return
    const next = !following
    setBusy(true)
    setFollowing(target, next)
    const ok = await broadcast([followOp(who, target, next)], next ? { milestone: 'follow' } : {})
    if (ok) invalidateCache('"feed"')
    else setFollowing(target, !next)
    setBusy(false)
  }

  return (
    <button
      onClick={toggle}
      disabled={busy || (!!account && !loaded)}
      aria-pressed={following}
      aria-label={following ? `Unfollow @${target}` : `Follow @${target}`}
      className={`${following ? 'btn-ghost' : 'btn-primary'} ${small ? 'btn-sm' : ''}`}
    >
      {following ? 'Following' : 'Follow'}
    </button>
  )
}
