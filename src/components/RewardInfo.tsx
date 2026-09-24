import { SHOW_REWARDS } from '../config'
import type { Post } from '../lib/hive'

/**
 * The only place token value could ever be rendered. While SHOW_REWARDS is
 * false this renders nothing, and the bundler drops the body entirely.
 */
export default function RewardInfo({ post }: { post: Post }) {
  if (!SHOW_REWARDS) return null
  const value = (post as unknown as Record<string, string>)['pending_payout_value']
  return value ? <span className="text-muted">{value}</span> : null
}
