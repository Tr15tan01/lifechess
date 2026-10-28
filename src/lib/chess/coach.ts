import type { Chess, Square } from 'chess.js'
import { PIECE_NAMES, type Color, type PieceType } from './types'

const VALUE: Record<PieceType, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 }
const FILES = 'abcdefgh'
const GENERAL = [
  'Before every move, ask: what does my opponent threaten now?',
  'Knights and bishops belong in play before the queen goes out.',
  'Trade pieces when you are ahead; keep them on when you are behind.',
  'Rooks work best on open files. Look for one.',
  'Protect your king first. Everything else can be repaired.',
  'If you cannot find a plan, improve your worst-placed piece.',
]

function pieces(chess: Chess, color: Color) {
  const out: { type: PieceType; square: Square }[] = []
  for (const r of chess.board()) for (const p of r) if (p && p.color === color) out.push({ type: p.type as PieceType, square: p.square })
  return out
}

/**
 * Rule-based coaching for the side to move. Pure chess.js, no engine and no
 * AI: it spots hanging pieces, checks, development and king safety.
 */
export function coachTips(chess: Chess, me: Color, playerMoveNumber: number): string[] {
  const opp: Color = me === 'w' ? 'b' : 'w'
  const tips: string[] = []

  if (chess.inCheck()) tips.push('You are in check. Move the king, block the attack, or capture the checking piece.')

  const mine = pieces(chess, me)
  const theirs = pieces(chess, opp)

  for (const p of mine) {
    if (p.type === 'k') continue
    if (chess.isAttacked(p.square, opp) && !chess.isAttacked(p.square, me)) tips.push(`Your ${PIECE_NAMES[p.type]} on ${p.square} is attacked and unprotected. Move it or defend it.`)
  }
  const wins = theirs
    .filter((p) => p.type !== 'k' && chess.isAttacked(p.square, me) && !chess.isAttacked(p.square, opp))
    .sort((a, b) => VALUE[b.type] - VALUE[a.type])
  if (wins[0]) tips.push(`Their ${PIECE_NAMES[wins[0].type]} on ${wins[0].square} is unprotected, and you can attack it.`)

  const centre = me === 'w' ? ['d4', 'e4'] : ['d5', 'e5']
  const hasCentre = centre.some((sq) => {
    const p = chess.get(sq as Square)
    return p?.type === 'p' && p.color === me
  })
  if (playerMoveNumber <= 6) {
    if (!hasCentre) tips.push(`Claim the centre with a pawn on ${centre[1]} or ${centre[0]}.`)
    const homeRank = me === 'w' ? '1' : '8'
    const undeveloped = mine.filter((p) => (p.type === 'n' || p.type === 'b') && p.square[1] === homeRank).length
    if (undeveloped >= 2) tips.push('Develop your knights and bishops before moving the same piece twice.')
  }
  if (playerMoveNumber >= 4 && chess.moves().some((m) => m.startsWith('O-O'))) tips.push('You can castle now. It tucks your king away and wakes up a rook.')

  const heavy = mine.filter((p) => p.type !== 'p' && p.type !== 'k').length + theirs.filter((p) => p.type !== 'p' && p.type !== 'k').length
  if (heavy <= 4) tips.push('Endgame: bring your king toward the centre and push your passed pawns.')

  tips.push(GENERAL[(playerMoveNumber + FILES.length) % GENERAL.length]!)
  return [...new Set(tips)].slice(0, 3)
}
