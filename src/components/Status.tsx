import type { ReactNode } from 'react'

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-10 text-muted" role="status">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-300 border-t-brand" aria-hidden />
      <span className="text-sm">{label}</span>
    </div>
  )
}

export function CardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="card animate-pulse p-5">
          <div className="mb-3 h-3 w-1/3 rounded bg-zinc-200 dark:bg-zinc-800" />
          <div className="mb-2 h-5 w-3/4 rounded bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-3 w-full rounded bg-zinc-200 dark:bg-zinc-800" />
        </div>
      ))}
    </div>
  )
}

export function EmptyState({ emoji, title, children }: { emoji: string; title: string; children?: ReactNode }) {
  return (
    <div className="card px-6 py-12 text-center">
      <div className="mb-3 text-4xl" aria-hidden>
        {emoji}
      </div>
      <h2 className="text-lg font-bold">{title}</h2>
      {children && <div className="mx-auto mt-2 max-w-sm text-sm text-muted">{children}</div>}
    </div>
  )
}

export function ErrorState({ onRetry }: { onRetry?: () => void }) {
  return (
    <EmptyState emoji="🌧️" title="We couldn’t load this right now">
      <p>The Hive network is a little busy. It usually clears up in a moment.</p>
      {onRetry && (
        <button className="btn-ghost mt-4" onClick={onRetry}>
          Try again
        </button>
      )}
    </EmptyState>
  )
}
