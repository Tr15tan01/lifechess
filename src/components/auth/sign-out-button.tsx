'use client'

import { useRouter } from 'next/navigation'
import { api } from '@/lib/api-client'

export function SignOutButton() {
  const router = useRouter()
  return (
    <button
      type="button"
      className="shrink-0 whitespace-nowrap rounded-full px-2.5 py-1.5 text-ink-2 sm:px-3 hover:bg-surface-2 hover:text-ink"
      onClick={async () => {
        await api('/api/auth/logout', { method: 'POST', body: {} }).catch(() => {})
        router.refresh()
      }}
    >
      Sign out
    </button>
  )
}
