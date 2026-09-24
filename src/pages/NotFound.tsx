import { Link, Navigate, useLocation } from 'react-router'
import { EmptyState } from '../components/Status'

/** Also catches links in other Hive front ends' formats: /@user, /@user/permlink, /tag/@user/permlink. */
export default function NotFound() {
  const { pathname } = useLocation()
  const post = pathname.match(/^\/(?:[^/]+\/)?@([a-z0-9.-]+)\/([a-z0-9-]+)\/?$/)
  if (post) return <Navigate to={`/p/${post[1]}/${post[2]}`} replace />
  const user = pathname.match(/^\/@([a-z0-9.-]+)\/?$/)
  if (user) return <Navigate to={`/u/${user[1]}`} replace />
  const community = pathname.match(/^\/(?:created|trending|hot)\/(hive-\d+)\/?$/)
  if (community) return <Navigate to={`/c/${community[1]}`} replace />
  return (
    <EmptyState emoji="🧭" title="This page wandered off">
      <p>Let’s get you back somewhere friendly.</p>
      <Link to="/" className="btn-primary mt-4">
        Go Home
      </Link>
    </EmptyState>
  )
}
