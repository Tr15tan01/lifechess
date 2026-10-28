import 'server-only'
import { z } from 'zod'
import { getDb } from '../db'
import { isDuplicateKeyError } from '../db/collection'
import type { UserDoc } from '../db/models'
import { emailSchema, hashPassword, passwordSchema, verifyPassword } from '../security/password'
import { AppError } from '../http'

export const registerSchema = z.object({
  name: z.string().trim().min(1, 'Enter a name.').max(60),
  email: emailSchema,
  password: passwordSchema,
})

export const loginSchema = z.object({ email: emailSchema, password: z.string().min(1, 'Enter your password.').max(128) })

export async function register(input: z.infer<typeof registerSchema>): Promise<UserDoc> {
  const db = await getDb()
  const user: UserDoc = { _id: crypto.randomUUID(), email: input.email, name: input.name, passwordHash: await hashPassword(input.password), createdAt: new Date(), lastLoginAt: null }
  try {
    await db.users.insertOne(user)
  } catch (err) {
    if (isDuplicateKeyError(err)) throw new AppError(409, 'EMAIL_TAKEN', 'An account with that email already exists. Try signing in.')
    throw err
  }
  return user
}

export async function authenticate(input: z.infer<typeof loginSchema>): Promise<UserDoc> {
  const user = await (await getDb()).users.findOne({ email: input.email })
  const ok = await verifyPassword(user?.passwordHash ?? null, input.password)
  if (!user || !ok) throw new AppError(401, 'BAD_CREDENTIALS', 'That email and password combination did not work.')
  return user
}
