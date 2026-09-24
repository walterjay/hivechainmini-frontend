import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { APP_NAME, DEFAULT_COMMUNITIES, type CommunityRef } from '../config'
import { useCommunities } from '../state/communities'
import { useTitle } from '../lib/useTitle'

const BLURBS: Record<string, string> = {
  'hive-153850': 'Learn, share what you know, and grow alongside other newcomers.',
  'hive-194913': 'Your best shots, from phone snaps to pro gear.',
  'hive-100067': 'Recipes, restaurant finds and everything tasty.',
}

export default function Welcome() {
  const { communities, finishOnboarding } = useCommunities()
  const nav = useNavigate()
  useTitle('Welcome')
  const extras = communities.filter((c) => !DEFAULT_COMMUNITIES.some((d) => d.id === c.id))
  const options: CommunityRef[] = [...DEFAULT_COMMUNITIES, ...extras]
  const [picked, setPicked] = useState<Set<string>>(() => new Set(options.map((c) => c.id)))

  const toggle = (id: string) =>
    setPicked((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  const done = (to: string) => {
    finishOnboarding(options.filter((c) => picked.has(c.id)))
    nav(to)
  }

  return (
    <div className="mx-auto max-w-lg py-4">
      <h1 className="text-3xl font-extrabold tracking-tight">Welcome to {APP_NAME} 👋</h1>
      <p className="mt-2 text-muted">
        Hive is a community-run social network. Pick a few places to start. You can change these anytime.
      </p>
      <fieldset className="mt-6 space-y-3">
        <legend className="mb-2 text-sm font-bold tracking-wide text-muted uppercase">Pick your starting communities</legend>
        {options.map((c) => (
          <label
            key={c.id}
            className={`card flex cursor-pointer items-center gap-4 p-4 transition ${picked.has(c.id) ? 'ring-2 ring-brand' : ''}`}
          >
            <input type="checkbox" className="h-5 w-5 accent-brand" checked={picked.has(c.id)} onChange={() => toggle(c.id)} />
            <span>
              <span className="block font-bold">{c.title}</span>
              {BLURBS[c.id] && <span className="block text-sm text-muted">{BLURBS[c.id]}</span>}
            </span>
          </label>
        ))}
      </fieldset>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <button className="btn-primary flex-1" onClick={() => done('/')}>
          {picked.size ? `Start with ${picked.size} ${picked.size === 1 ? 'community' : 'communities'}` : 'Start exploring'}
        </button>
        <button className="btn-ghost flex-1" onClick={() => done('/communities')}>
          Browse more
        </button>
      </div>
      <p className="mt-6 text-center text-sm text-muted">
        Just looking? No account needed to read. <Link to="/communities" className="link" onClick={() => finishOnboarding(options.filter((c) => picked.has(c.id)))}>See all communities</Link>
      </p>
    </div>
  )
}
