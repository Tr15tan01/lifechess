import 'server-only'
import type { Document } from 'mongodb'
import { env } from '../env'
import type { BaseDoc, Coll, IndexSpec } from './collection'
import { MemoryCollection, registerMemoryIndexes } from './memory'
import { MongoCollection, mongoClient } from './mongo'
import type * as M from './models'

/** MongoDB is the real store; `memory://` is an in-process store for local demos. */
const INDEXES: Record<string, IndexSpec[]> = {
  users: [{ keys: { email: 1 }, unique: true }],
  sessions: [{ keys: { tokenHash: 1 }, unique: true }, { keys: { userId: 1 } }, { keys: { expiresAt: 1 }, expireAfterSeconds: 0 }],
  chess_games: [{ keys: { userId: 1, createdAt: -1 } }],
  rate_limits: [{ keys: { expiresAt: 1 }, expireAfterSeconds: 0 }],
  error_logs: [{ keys: { createdAt: 1 }, expireAfterSeconds: 60 * 60 * 24 * 30 }],
}

export type Db = {
  users: Coll<M.UserDoc>
  sessions: Coll<M.SessionDoc>
  chessGames: Coll<M.ChessGameDoc>
  rateLimits: Coll<M.RateLimitDoc>
  errors: Coll<M.ErrorLogDoc>
}

const NAMES: Record<keyof Db, string> = { users: 'users', sessions: 'sessions', chessGames: 'chess_games', rateLimits: 'rate_limits', errors: 'error_logs' }

const g = globalThis as unknown as { __lifechessDb?: Promise<Db> }

function dbNameFromUrl(url: string): string {
  try {
    return new URL(url).pathname.replace(/^\//, '') || 'lifechess'
  } catch {
    return 'lifechess'
  }
}

async function build(): Promise<Db> {
  const url = env().DATABASE_URL
  const out = {} as Record<keyof Db, Coll<BaseDoc>>
  if (url.startsWith('memory://')) {
    for (const [key, name] of Object.entries(NAMES) as [keyof Db, string][]) {
      registerMemoryIndexes(name, INDEXES[name] ?? [])
      out[key] = new MemoryCollection(name)
    }
    return out as unknown as Db
  }
  const client = await mongoClient(url)
  const mdb = client.db(dbNameFromUrl(url))
  for (const [key, name] of Object.entries(NAMES) as [keyof Db, string][]) out[key] = new MongoCollection(mdb.collection<BaseDoc>(name))
  await Promise.all(
    Object.entries(INDEXES).flatMap(([name, specs]) =>
      specs.map((s) =>
        mdb
          .collection(name)
          .createIndex(s.keys, { unique: s.unique, expireAfterSeconds: s.expireAfterSeconds, partialFilterExpression: s.partial as Document | undefined })
          .catch((err: unknown) => console.error(`[db] index on ${name} failed`, err instanceof Error ? err.message : err)),
      ),
    ),
  )
  return out as unknown as Db
}

export function getDb(): Promise<Db> {
  g.__lifechessDb ??= build().catch((err) => {
    g.__lifechessDb = undefined
    throw err
  })
  return g.__lifechessDb
}
