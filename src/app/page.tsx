import { GameClient } from '@/components/chess/game-client'
import { getSessionUser } from '@/server/auth/session'

export default async function Home() {
  const user = await getSessionUser()
  return (
    <main id="main" className="mx-auto max-w-[110rem]">
      <GameClient user={user ? { name: user.name } : null} />
    </main>
  )
}
