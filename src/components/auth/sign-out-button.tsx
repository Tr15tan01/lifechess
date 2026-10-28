'use client'

import { useRouter } from 'next/navigation'
import { api } from '@/lib/api-client'

export function SignOutButton() {
  const router = useRouter()
  return (
    <button
      type="button"
      className="rounded-full px-3 py-1.5 text-ink-2 hover:bg-surface-2 hover:text-ink"
      onClick={async () => {
        await api('/api/auth/logout', { method: 'POST', body: {} }).catch(() => {})
        router.refresh()
      }}
    >
      Sign out
    </button>
  )
}
