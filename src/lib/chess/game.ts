import { Chess } from 'chess.js'
import { LIFE_AREAS, LIFE_AREA_KEYS, type BotLevel, type ChessMoveView, type ChessStatus, type Color, type EndReason, type GameRecord, type LifeArea, type LifeHint, type PieceType } from './types'
import { lifeHint, nextScore } from './life'

/** The whole game lives in the browser; it is just data, so it fits in localStorage. */
export type Game = {
  id: string
  level: BotLevel
  color: Color
  moves: ChessMoveView[]
  hints: LifeHint[]
  score: number
  status: ChessStatus
  endReason: EndReason | null
  startedAt: number
  tipsUsed: boolean
}

export function newGame(level: BotLevel, color: Color): Game {
  return { id: crypto.randomUUID(), level, color, moves: [], hints: [], score: 50, status: 'ACTIVE', endReason: null, startedAt: Date.now(), tipsUsed: false }
}

export function replay(moves: ChessMoveView[]): Chess {
  const c = new Chess()
  for (const m of moves) c.move({ from: m.from, to: m.to, promotion: m.promotion })
  return c
}

const VALUE: Record<PieceType, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 }

export function material(chess: Chess, color: Color): number {
  let s = 0
  for (const row of chess.board()) for (const p of row) if (p) s += (p.color === color ? 1 : -1) * VALUE[p.type as PieceType]
  return s
}

function nonPawnPieces(chess: Chess): number {
  let n = 0
  for (const row of chess.board()) for (const p of row) if (p && p.type !== 'p' && p.type !== 'k') n++
  return n
}

export const isEndgame = (chess: Chess) => nonPawnPieces(chess) <= 6

export function toView(m: { color: Color; san: string; from: string; to: string; piece: string; captured?: string; promotion?: string; flags: string }, ply: number): ChessMoveView {
  return { ply, color: m.color, san: m.san, from: m.from, to: m.to, piece: m.piece as PieceType, captured: m.captured as PieceType | undefined, promotion: m.promotion as PieceType | undefined, flags: m.flags, check: /[+#]$/.test(m.san) }
}

/** Outcome of the position, from the player's point of view. */
export function outcome(chess: Chess, player: Color): { status: ChessStatus; endReason: EndReason | null } {
  if (chess.isCheckmate()) return { status: chess.turn() === player ? 'LOST' : 'WON', endReason: 'CHECKMATE' }
  if (chess.isStalemate()) return { status: 'DRAWN', endReason: 'STALEMATE' }
  if (chess.isInsufficientMaterial()) return { status: 'DRAWN', endReason: 'INSUFFICIENT' }
  if (chess.isThreefoldRepetition()) return { status: 'DRAWN', endReason: 'REPETITION' }
  if (chess.isDraw()) return { status: 'DRAWN', endReason: 'FIFTY_MOVE' }
  return { status: 'ACTIVE', endReason: null }
}

/** Play a half-move for whoever's turn it is. Returns null when the move is illegal. */
export function play(game: Game, from: string, to: string, promotion?: string): Game | null {
  const chess = replay(game.moves)
  let m
  try {
    m = chess.move({ from, to, promotion })
  } catch {
    return null
  }
  const moves = [...game.moves, toView(m, game.moves.length)]
  const out = outcome(chess, game.color)
  let next: Game = { ...game, moves, status: out.status, endReason: out.endReason }
  // A turn is complete when the bot has answered, or the game just ended.
  const botJustMoved = m.color !== game.color
  if (botJustMoved || out.status !== 'ACTIVE') next = completeTurn(next)
  return next
}

/** Turns the latest player move (plus the bot's reply, if any) into a life hint. */
function completeTurn(game: Game): Game {
  const last = game.moves.at(-1)!
  const botMoved = last.color !== game.color
  const player = botMoved ? game.moves.at(-2) : last
  if (!player || player.color !== game.color) return game // bot opened the game: nothing to narrate yet
  const bot = botMoved ? last : null
  const before = replay(game.moves.slice(0, game.moves.indexOf(player)))
  const after = replay(game.moves)
  const playerMoveNumber = game.moves.filter((m) => m.color === game.color).length
  const alreadyEnd = isEndgame(before)
  const hint = lifeHint(
    { gameId: game.id, ply: player.ply, player, bot, net: material(after, game.color) - material(before, game.color), playerMoveNumber, enteredEndgame: isEndgame(after), alreadyInEndgame: alreadyEnd, status: game.status },
    game.hints,
  )
  return { ...game, hints: [...game.hints, hint], score: nextScore(game.score, hint, game.status) }
}

export function resign(game: Game): Game {
  const last = game.moves.at(-1)
  const hint: LifeHint = { ply: last?.ply ?? 0, area: 'self', mood: 'down', title: 'Wellbeing', text: 'You stepped away from this chapter. Sometimes that is the wisest move.' }
  return { ...game, status: 'LOST', endReason: 'RESIGNATION', hints: [...game.hints, hint], score: nextScore(game.score, hint, 'LOST') }
}

export function toRecord(game: Game, now = Date.now()): GameRecord {
  const areas = Object.fromEntries(LIFE_AREA_KEYS.map((k) => [k, 0])) as Record<LifeArea, number>
  for (const m of game.moves) if (m.color === game.color) areas[LIFE_AREAS[m.piece].key]++
  return {
    id: game.id,
    level: game.level,
    playerColor: game.color,
    result: game.status === 'WON' ? 'WON' : game.status === 'LOST' ? 'LOST' : 'DRAWN',
    endReason: game.endReason,
    moves: game.moves.filter((m) => m.color === game.color).length,
    sans: game.moves.map((m) => m.san),
    areas,
    lifeScore: game.score,
    tipsUsed: game.tipsUsed,
    durationSec: Math.max(0, Math.round((now - game.startedAt) / 1000)),
    playedAt: now,
  }
}
