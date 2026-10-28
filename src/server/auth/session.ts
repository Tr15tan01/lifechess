import 'server-only'
import { cookies } from 'next/headers'
import { cache } from 'react'
import { getDb } from '../db'
import type { UserDoc } from '../db/models'
import { isSecureCookies } from '../env'
import { randomToken, sha256 } from '../security/crypto'

/**
 * Optional accounts. The browser holds an opaque random token in an HttpOnly
 * cookie; only its SHA-256 is stored, so a database leak does not leak sessions.
 */
export const SESSION_COOKIE = 'lc_session'
const SESSION_DAYS = 30

export type SessionUser = { id: string; email: string; name: string }

export async function resolveSessionToken(token: string | undefined): Promise<SessionUser | null> {
  if (!token || token.length < 20 || token.length > 100) return null
  const db = await getDb()
  const session = await db.sessions.findOne({ tokenHash: sha256(token) })
  if (!session) return null
  if (session.expiresAt.getTime() < Date.now()) {
    await db.sessions.deleteOne({ _id: session._id })
    return null
  }
  const user = await db.users.findOne({ _id: session.userId })
  if (!user) return null
  return { id: user._id, email: user.email, name: user.name }
}

/** Cached per request. Never throws: a broken database simply means "signed out". */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  try {
    const jar = await cookies()
    return await resolveSessionToken(jar.get(SESSION_COOKIE)?.value)
  } catch {
    return null
  }
})

export async function startSession(user: Pick<UserDoc, '_id'>) {
  const db = await getDb()
  const jar = await cookies()
  const prev = jar.get(SESSION_COOKIE)?.value
  if (prev) await db.sessions.deleteOne({ tokenHash: sha256(prev) })
  const token = randomToken(32)
  const now = new Date()
  const expiresAt = new Date(now.getTime() + SESSION_DAYS * 86400 * 1000)
  await db.sessions.insertOne({ _id: crypto.randomUUID(), tokenHash: sha256(token), userId: user._id, createdAt: now, lastSeenAt: now, expiresAt })
  jar.set(SESSION_COOKIE, token, { httpOnly: true, secure: isSecureCookies(), sameSite: 'lax', path: '/', expires: expiresAt })
  await db.users.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } })
}

export async function endSession() {
  const jar = await cookies()
  const token = jar.get(SESSION_COOKIE)?.value
  if (token) await (await getDb()).sessions.deleteOne({ tokenHash: sha256(token) })
  jar.delete(SESSION_COOKIE)
}
