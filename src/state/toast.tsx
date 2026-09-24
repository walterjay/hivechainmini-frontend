import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

type Kind = 'info' | 'error' | 'celebrate'
interface Toast {
  id: number
  text: string
  kind: Kind
}

const ToastCtx = createContext<(text: string, kind?: Kind) => void>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const push = useCallback((text: string, kind: Kind = 'info') => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t.slice(-2), { id, text, kind }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'celebrate' ? 6000 : 4500)
  }, [])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4 sm:bottom-6"
        role="status"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto max-w-md rounded-2xl px-4 py-3 text-sm font-medium shadow-lg ${
              t.kind === 'error'
                ? 'bg-rose-50 text-rose-900 ring-1 ring-rose-200 dark:bg-rose-950 dark:text-rose-100 dark:ring-rose-800'
                : t.kind === 'celebrate'
                  ? 'bg-amber-50 text-amber-950 ring-1 ring-amber-200 dark:bg-amber-950 dark:text-amber-50 dark:ring-amber-700'
                  : 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
            }`}
          >
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

export const useToast = () => useContext(ToastCtx)
