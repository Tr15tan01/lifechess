import Link from 'next/link'
import { Logo } from '@/components/brand/logo'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { getSessionUser } from '@/server/auth/session'
import { SignOutButton } from '@/components/auth/sign-out-button'

export async function SiteHeader() {
  const user = await getSessionUser()
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[110rem] items-center justify-between gap-4 px-4 sm:px-8">
        <Link href="/" aria-label="Life Chess home">
          <Logo />
        </Link>
        <nav aria-label="Main" className="flex items-center gap-1 text-sm">
          <Link href="/" className="rounded-full px-3 py-1.5 text-ink-2 hover:bg-surface-2 hover:text-ink">Play</Link>
          <Link href="/stats" className="rounded-full px-3 py-1.5 text-ink-2 hover:bg-surface-2 hover:text-ink">Stats</Link>
          <ThemeToggle />
          {user ? (
            <>
              <span className="ml-2 hidden max-w-32 truncate text-ink-3 sm:inline" title={user.email}>{user.name}</span>
              <SignOutButton />
            </>
          ) : (
            <Link href="/login" className="ml-1 rounded-full border border-line-strong px-4 py-1.5 text-ink hover:border-gold/60">Sign in</Link>
          )}
        </nav>
      </div>
    </header>
  )
}
