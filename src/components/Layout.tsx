import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { APP_NAME } from '../config'
import { save } from '../lib/storage'
import { useAuth } from '../state/auth'
import Avatar from './Avatar'
import LogoMark from './LogoMark'

function ThemeToggle() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))
  return (
    <button
      className="icon-btn"
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={() => {
        const next = !dark
        document.documentElement.classList.toggle('dark', next)
        save('hh.theme', next ? 'dark' : 'light')
        setDark(next)
      }}
    >
      {dark ? '☀️' : '🌙'}
    </button>
  )
}

function AccountMenu() {
  const { account, ensureLogin, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const loc = useLocation()
  const menuRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    setOpen(false)
  }, [loc.pathname])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    const onClick = (e: MouseEvent) => !menuRef.current?.contains(e.target as Node) && setOpen(false)
    document.addEventListener('keydown', onKey)
    document.addEventListener('click', onClick)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('click', onClick)
    }
  }, [open])
  if (!account)
    return (
      <button className="btn-primary btn-sm" onClick={() => ensureLogin('Log in to vote, comment, post and follow.')}>
        Log in
      </button>
    )
  return (
    <div className="relative" ref={menuRef}>
      <button className="flex items-center rounded-full focus-visible:outline-2 focus-visible:outline-brand" aria-haspopup="menu" aria-expanded={open} aria-label="Your account menu" onClick={() => setOpen((o) => !o)}>
        <Avatar account={account} size={36} />
      </button>
      {open && (
        <div role="menu" className="card absolute right-0 z-40 mt-2 w-48 overflow-hidden p-1 shadow-lg">
          <Link role="menuitem" to={`/u/${account}`} className="block rounded-2xl px-4 py-2.5 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800">
            My profile
          </Link>
          <button role="menuitem" onClick={logout} className="block w-full rounded-2xl px-4 py-2.5 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800">
            Log out
          </button>
        </div>
      )}
    </div>
  )
}

const navCls = ({ isActive }: { isActive: boolean }) =>
  `rounded-full px-4 py-2 text-sm font-semibold transition ${isActive ? 'bg-zinc-200 dark:bg-zinc-800' : 'text-muted hover:bg-zinc-100 dark:hover:bg-zinc-900'}`

const tabCls = ({ isActive }: { isActive: boolean }) =>
  `flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-semibold ${isActive ? 'text-brand' : 'text-muted'}`

export default function Layout() {
  const { account } = useAuth()
  const { pathname } = useLocation()
  // Braces matter: scrollTo returns a Promise in newer browsers, which React would treat as a cleanup.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return (
    <div className="min-h-dvh pb-20 sm:pb-0">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-full focus:bg-white focus:px-4 focus:py-2 dark:focus:bg-zinc-900">
        Skip to content
      </a>
      <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-2 px-4">
          <Link to="/" className="mr-2 flex items-center gap-2 text-lg font-extrabold tracking-tight">
            <LogoMark className="h-8 w-8" />
            {APP_NAME}
          </Link>
          <nav className="hidden items-center gap-1 sm:flex" aria-label="Main">
            <NavLink to="/" end className={navCls}>
              Home
            </NavLink>
            <NavLink to="/communities" className={navCls}>
              Communities
            </NavLink>
          </nav>
          <div className="ml-auto flex items-center gap-1">
            <Link to="/submit" className="btn-primary btn-sm hidden sm:inline-flex">
              ✏️ Write
            </Link>
            <ThemeToggle />
            <AccountMenu />
          </div>
        </div>
      </header>
      <main id="main" className={`mx-auto px-4 py-5 ${pathname.startsWith('/p/') ? 'max-w-5xl' : 'max-w-3xl'}`}>
        <Outlet />
      </main>
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-zinc-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden dark:border-zinc-800 dark:bg-zinc-950/95"
      >
        <NavLink to="/" end className={tabCls}>
          <span aria-hidden className="text-lg">🏠</span>Home
        </NavLink>
        <NavLink to="/communities" className={tabCls}>
          <span aria-hidden className="text-lg">🧭</span>Communities
        </NavLink>
        <NavLink to="/submit" className={tabCls}>
          <span aria-hidden className="text-lg">✏️</span>Write
        </NavLink>
        <NavLink to={account ? `/u/${account}` : '/following'} className={tabCls}>
          <span aria-hidden className="text-lg">🙂</span>
          {account ? 'Me' : 'Following'}
        </NavLink>
      </nav>
    </div>
  )
}
