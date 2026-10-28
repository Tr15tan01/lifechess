import Link from 'next/link'
import { Logo } from '@/components/brand/logo'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { getSessionUser } from '@/server/auth/session'
import { SignOutButton } from '@/components/auth/sign-out-button'

export async function SiteHeader() {
  const user = await getSessionUser()
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[110rem] items-center justify-between gap-2 px-3 sm:h-16 sm:gap-4 sm:px-6 lg:px-8">
        <Link href="/" aria-label="Life Chess home" className="shrink-0 whitespace-nowrap">
          <Logo className="[&_svg]:size-6 sm:[&_svg]:size-7 [&>span:last-child]:text-[1.15rem] sm:[&>span:last-child]:text-[1.35rem]" />
        </Link>
        <nav aria-label="Main" className="flex min-w-0 items-center gap-0.5 whitespace-nowrap text-[13px] sm:gap-1 sm:text-sm">
          <Link href="/" className="rounded-full px-2.5 py-1.5 text-ink-2 hover:bg-surface-2 hover:text-ink sm:px-3">Play</Link>
          <Link href="/stats" className="rounded-full px-2.5 py-1.5 text-ink-2 hover:bg-surface-2 hover:text-ink sm:px-3">Stats</Link>
          <ThemeToggle />
          {user ? (
            <>
              <span className="ml-2 hidden max-w-32 truncate text-ink-3 sm:inline" title={user.email}>{user.name}</span>
              <SignOutButton />
            </>
          ) : (
            <Link href="/login" className="ml-1 shrink-0 rounded-full border border-line-strong px-3 py-1 text-ink hover:border-gold/60 sm:px-4 sm:py-1.5">Sign in</Link>
          )}
        </nav>
      </div>
    </header>
  )
}
