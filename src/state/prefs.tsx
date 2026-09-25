import { createContext, useContext, useState, type ReactNode } from 'react'
import { load, save } from '../lib/storage'

interface PrefsValue {
  /** Sensitive (18+) content is hidden by default; the user can opt back in. */
  showNsfw: boolean
  setShowNsfw: (v: boolean) => void
}

const PrefsCtx = createContext<PrefsValue | null>(null)

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [showNsfw, setShowNsfwState] = useState(() => load('hh.showNsfw', false))
  const setShowNsfw = (v: boolean) => {
    setShowNsfwState(v)
    save('hh.showNsfw', v)
  }
  return <PrefsCtx.Provider value={{ showNsfw, setShowNsfw }}>{children}</PrefsCtx.Provider>
}

export function usePrefs() {
  const v = useContext(PrefsCtx)
  if (!v) throw new Error('usePrefs must be used within PrefsProvider')
  return v
}
