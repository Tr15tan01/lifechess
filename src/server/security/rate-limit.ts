import 'server-only'
import { getDb } from '../db'

/**
 * Fixed-window rate limiter backed by MongoDB (shared across instances).
 * Each window document carries a TTL so storage stays bounded.
 */
export type LimitRule = { bucket: string; limit: number; windowSec: number }

export const RULES = {
  login: { bucket: 'login', limit: 8, windowSec: 15 * 60 },
  register: { bucket: 'register', limit: 5, windowSec: 60 * 60 },
  save: { bucket: 'save', limit: 60, windowSec: 60 },
} satisfies Record<string, LimitRule>

export type LimitResult = { ok: boolean; remaining: number; retryAfterSec: number }

export async function rateLimit(rule: LimitRule, key: string): Promise<LimitResult> {
  const db = await getDb()
  const now = Date.now()
  const windowStart = Math.floor(now / (rule.windowSec * 1000)) * rule.windowSec * 1000
  const id = `${rule.bucket}:${key}:${windowStart}`
  const expiresAt = new Date(windowStart + rule.windowSec * 1000)
  const doc = await db.rateLimits.findOneAndUpdate(
    { _id: id },
    { $inc: { count: 1 }, $setOnInsert: { expiresAt } },
    { upsert: true, returnDocument: 'after' },
  )
  const count = doc?.count ?? 1
  return {
    ok: count <= rule.limit,
    remaining: Math.max(0, rule.limit - count),
    retryAfterSec: Math.ceil((expiresAt.getTime() - now) / 1000),
  }
}

export class RateLimitedError extends Error {
  constructor(public readonly retryAfterSec: number) {
    super('Too many requests')
    this.name = 'RateLimitedError'
  }
}

export async function enforce(rule: LimitRule, key: string) {
  const r = await rateLimit(rule, key)
  if (!r.ok) throw new RateLimitedError(r.retryAfterSec)
}
