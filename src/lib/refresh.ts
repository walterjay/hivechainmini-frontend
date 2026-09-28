import { useEffect, useRef } from 'react'
import { invalidateCache } from './rpc'

// Tapping the tab you're already on refreshes it, like most apps, so pages
// don't each need their own refresh button.

const EVENT = 'hh:refresh'

export function requestRefresh() {
  window.scrollTo({ top: 0 })
  window.dispatchEvent(new Event(EVENT))
}

/** Runs `fn` (after clearing cached API responses) whenever the current tab is tapped again. */
export function useRefresh(fn: () => void) {
  const latest = useRef(fn)
  latest.current = fn
  useEffect(() => {
    const onRefresh = () => {
      invalidateCache()
      latest.current()
    }
    window.addEventListener(EVENT, onRefresh)
    return () => window.removeEventListener(EVENT, onRefresh)
  }, [])
}
