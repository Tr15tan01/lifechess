import { route, readJson } from '@/server/http'
import { register, registerSchema } from '@/server/services/accounts'
import { startSession } from '@/server/auth/session'
import { enforce, RULES } from '@/server/security/rate-limit'

export const POST = route({}, async ({ req, ip }) => {
  await enforce(RULES.register, ip)
  await startSession(await register(await readJson(req, registerSchema)))
  return { ok: true }
})
