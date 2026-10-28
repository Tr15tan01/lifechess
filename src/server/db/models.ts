import type { BotLevel, Color, EndReason, LifeArea } from '@/lib/chess/types'

export type UserDoc = {
  _id: string
  email: string
  name: string
  passwordHash: string
  createdAt: Date
  lastLoginAt: Date | null
}

export type SessionDoc = {
  _id: string
  tokenHash: string
  userId: string
  createdAt: Date
  lastSeenAt: Date
  expiresAt: Date
}

export type RateLimitDoc = { _id: string; count: number; expiresAt: Date }
export type ErrorLogDoc = { _id: string; scope: string; message: string; createdAt: Date; userId: string | null }

/** One finished game, saved only for signed-in players. `_id` is the client's game id, so a retry cannot double-count. */
export type ChessGameDoc = {
  _id: string
  userId: string
  level: BotLevel
  playerColor: Color
  result: 'WON' | 'LOST' | 'DRAWN'
  endReason: EndReason | null
  /** Player moves made. */
  moves: number
  /** SAN of every half-move, so a game can be replayed later. */
  sans: string[]
  /** Player moves per life area (derived from the piece moved). */
  areas: Record<LifeArea, number>
  /** Life-hint score earned this game, 0..100. */
  lifeScore: number
  tipsUsed: boolean
  durationSec: number
  createdAt: Date
}
