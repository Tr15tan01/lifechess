import type { Metadata, Viewport } from 'next'
import { cookies } from 'next/headers'
import '@fontsource-variable/newsreader/opsz.css'
import '@fontsource-variable/newsreader/opsz-italic.css'
import '@fontsource/ibm-plex-sans/400.css'
import '@fontsource/ibm-plex-sans/500.css'
import '@fontsource/ibm-plex-sans/600.css'
import './globals.css'
import { ToastProvider } from '@/components/ui/toast'
import { SiteHeader } from '@/components/layout/site-header'

export const metadata: Metadata = {
  title: { default: 'Life Chess: play chess, live a little', template: '%s · Life Chess' },
  description: 'A beautiful 3D chess game where every move becomes a small life situation. Five difficulty levels, optional coaching tips, and charts of your progress.',
  applicationName: 'Life Chess',
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#12151c' },
    { media: '(prefers-color-scheme: light)', color: '#f3eee3' },
  ],
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = (await cookies()).get('lc_theme')?.value === 'light' ? 'light' : 'dark'
  return (
    <html lang="en" data-theme={theme} suppressHydrationWarning>
      <body>
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-full focus:bg-gold focus:px-4 focus:py-2 focus:text-gold-ink">
          Skip to content
        </a>
        <ToastProvider>
          <SiteHeader />
          {children}
        </ToastProvider>
      </body>
    </html>
  )
}
