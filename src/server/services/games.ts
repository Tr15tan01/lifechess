import 'server-only'
import { z } from 'zod'
import { getDb } from '../db'
import { isDuplicateKeyError } from '../db/collection'
import { summarize, type GameRow } from '@/lib/chess/stats'
import { LIFE_AREA_KEYS } from '@/lib/chess/types'

const areaCount = z.number().int().min(0).max(500)

/** Finished game as reported by the browser. Bounds keep a bad client from storing junk. */
export const gameSchema = z.object({
  id: z.string().min(8).max(64).regex(/^[a-zA-Z0-9-]+$/),
  level: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  playerColor: z.enum(['w', 'b']),
  result: z.enum(['WON', 'LOST', 'DRAWN']),
  endReason: z.enum(['CHECKMATE', 'RESIGNATION', 'STALEMATE', 'REPETITION', 'INSUFFICIENT', 'FIFTY_MOVE']).nullable(),
  moves: z.number().int().min(0).max(500),
  sans: z.array(z.string().max(12)).max(1000),
  areas: z.object(Object.fromEntries(LIFE_AREA_KEYS.map((k) => [k, areaCount])) as Record<(typeof LIFE_AREA_KEYS)[number], typeof areaCount>),
  lifeScore: z.number().int().min(0).max(100),
  tipsUsed: z.boolean(),
  durationSec: z.number().int().min(0).max(60 * 60 * 24 * 7),
  playedAt: z.number().int().positive(),
})

/** Idempotent: saving the same game twice is a no-op. */
export async function saveGame(userId: string, input: z.infer<typeof gameSchema>) {
  const db = await getDb()
  if (await db.chessGames.findOne({ _id: input.id })) return
  const { playedAt, ...rest } = input
  try {
    await db.chessGames.insertOne({ ...rest, _id: input.id, userId, createdAt: new Date(Math.min(playedAt, Date.now())) })
  } catch (err) {
    if (!isDuplicateKeyError(err)) throw err
  }
}

export async function statsFor(userId: string) {
  const docs = await (await getDb()).chessGames.find({ userId }, { sort: { createdAt: 1 }, limit: 1000 })
  const rows: GameRow[] = docs.map((d) => ({ id: d._id, createdAt: d.createdAt.toISOString(), level: d.level, result: d.result, moves: d.moves, lifeScore: d.lifeScore, areas: d.areas, tipsUsed: d.tipsUsed, durationSec: d.durationSec }))
  return { stats: summarize(rows), recent: rows.slice(-8).reverse() }
}
