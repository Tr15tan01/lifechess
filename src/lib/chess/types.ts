/** Life Chess domain types. Isomorphic: safe for the browser and the server. */

export type Color = 'w' | 'b'
export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k'
export type ChessStatus = 'ACTIVE' | 'WON' | 'LOST' | 'DRAWN'
export type EndReason = 'CHECKMATE' | 'RESIGNATION' | 'STALEMATE' | 'REPETITION' | 'INSUFFICIENT' | 'FIFTY_MOVE'
export type BotLevel = 1 | 2 | 3 | 4 | 5

export const LEVELS_INFO: { level: BotLevel; label: string; blurb: string }[] = [
  { level: 1, label: 'Beginner', blurb: 'Plays quickly and often misses captures. Great for learning the moves.' },
  { level: 2, label: 'Casual', blurb: 'Sees simple tactics but still makes friendly mistakes.' },
  { level: 3, label: 'Club', blurb: 'Thinks two moves ahead. A fair fight for most players.' },
  { level: 4, label: 'Expert', blurb: 'Calculates three moves ahead and rarely hangs a piece.' },
  { level: 5, label: 'Master', blurb: 'Searches four moves deep with no deliberate errors.' },
]
export const levelLabel = (l: number) => LEVELS_INFO.find((x) => x.level === l)?.label ?? `Level ${l}`

/** Every piece stands for a part of your life. */
export type LifeArea = 'steps' | 'relationships' | 'health' | 'money' | 'career' | 'self'
export const LIFE_AREA_KEYS: LifeArea[] = ['steps', 'relationships', 'health', 'money', 'career', 'self']

export const LIFE_AREAS: Record<PieceType, { key: LifeArea; area: string; meaning: string }> = {
  p: { key: 'steps', area: 'Life steps', meaning: 'Small decisions that move your life forward.' },
  n: { key: 'relationships', area: 'Relationships', meaning: 'Surprising connections that reach places others cannot.' },
  b: { key: 'health', area: 'Health & growth', meaning: 'Long-range habits whose value shows over time.' },
  r: { key: 'money', area: 'Money', meaning: 'Solid and straightforward; strongest with open lines.' },
  q: { key: 'career', area: 'Career', meaning: 'Your most powerful, most flexible asset.' },
  k: { key: 'self', area: 'Wellbeing', meaning: 'Everything else exists to protect it.' },
}
export const AREA_LABEL: Record<LifeArea, string> = Object.fromEntries(Object.values(LIFE_AREAS).map((a) => [a.key, a.area])) as Record<LifeArea, string>

export const PIECE_NAMES: Record<PieceType, string> = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' }

export type ChessMoveView = {
  ply: number
  color: Color
  san: string
  from: string
  to: string
  piece: PieceType
  captured?: PieceType
  promotion?: PieceType
  /** chess.js flags: n normal, b pawn push, e en passant, c capture, p promotion, k/q castling. */
  flags: string
  check: boolean
}

export type LifeMood = 'up' | 'steady' | 'down'
export type LifeHint = { ply: number; area: LifeArea; mood: LifeMood; title: string; text: string }

export type GameRecord = {
  id: string
  level: BotLevel
  playerColor: Color
  result: 'WON' | 'LOST' | 'DRAWN'
  endReason: EndReason | null
  moves: number
  sans: string[]
  areas: Record<LifeArea, number>
  lifeScore: number
  tipsUsed: boolean
  durationSec: number
  playedAt: number
}
