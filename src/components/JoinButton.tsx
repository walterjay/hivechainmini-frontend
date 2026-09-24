import type { CommunityRef } from '../config'
import { useCommunities } from '../state/communities'
import { useToast } from '../state/toast'

export default function JoinButton({ community, small = false }: { community: CommunityRef; small?: boolean }) {
  const { isJoined, join, leave } = useCommunities()
  const toast = useToast()
  const joined = isJoined(community.id)
  return (
    <button
      className={`${joined ? 'btn-ghost' : 'btn-primary'} ${small ? 'btn-sm' : ''}`}
      aria-pressed={joined}
      aria-label={joined ? `Leave ${community.title}` : `Join ${community.title}`}
      onClick={() => {
        if (joined) {
          leave(community.id)
          toast(`You left ${community.title}.`)
        } else {
          join(community)
          toast(`Joined ${community.title}! Its posts will show on Home.`)
        }
      }}
    >
      {joined ? 'Joined' : 'Join'}
    </button>
  )
}
