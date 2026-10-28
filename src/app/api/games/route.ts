import { route, readJson } from '@/server/http'
import { enforce, RULES } from '@/server/security/rate-limit'
import { gameSchema, saveGame } from '@/server/services/games'

/** Save a finished game to the signed-in player's account. */
export const POST = route({ auth: true }, async ({ req, user }) => {
  await enforce(RULES.save, user!.id)
  await saveGame(user!.id, await readJson(req, gameSchema))
  return { ok: true }
})
