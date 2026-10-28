import { AREA_LABEL, LIFE_AREAS, type ChessMoveView, type ChessStatus, type LifeArea, type LifeHint, type LifeMood, type PieceType } from './types'

/**
 * Life hints: every turn becomes one short life situation. No AI involved.
 * The text is picked from hand-written pools by what actually happened on
 * the board (which piece moved, captures, checks, castling, promotion,
 * setbacks), so the same game always tells the same story.
 */

const STEP_QUIET = [
  'You advanced in life: you finally decided to apply for the new job.',
  'A small step forward: you signed up for the course you kept postponing.',
  'You moved forward: you opened a savings plan, even a small one.',
  'You advanced a step: you booked the move to the new apartment.',
  'You made the phone call you had been avoiding. One decision, one step.',
  'Progress: you cleared the backlog and set one clear goal for the month.',
  'You advanced in life: you wrote down the plan for the next year.',
]
const STEP_DOUBLE = [
  'A bold two-step leap: you accepted the offer without waiting for the perfect moment.',
  'You took a big step at once: you handed in your notice, with a plan ready.',
  'You jumped ahead: you started the project instead of just thinking about it.',
]
const STEP_CAPTURE = [
  'You stood your ground and turned a disagreement into progress.',
  'You pushed back politely, and it moved things forward.',
]

const AREA_QUIET: Record<Exclude<LifeArea, 'steps'>, string[]> = {
  relationships: [
    'You reached out to an old friend you had lost touch with.',
    'You said yes to an invitation outside your comfort zone.',
    'A surprising connection: someone introduced you to a mentor.',
    'You made time for a family dinner, and it mattered.',
    'You listened first, and a tense conversation softened.',
  ],
  health: [
    'You started a morning routine that gives you energy.',
    'You booked the checkup you had been avoiding.',
    'A long walk cleared your head and the problem looked smaller.',
    'You chose sleep over scrolling tonight.',
    'You cooked a real meal instead of ordering in.',
  ],
  money: [
    'You paid a bill early and breathed easier.',
    'You negotiated a better rate on a recurring cost.',
    'You moved some money into a rainy-day fund.',
    'You said no to an impulse purchase.',
    'You reviewed your budget and found an easy saving.',
  ],
  career: [
    'You pitched your idea to the whole team.',
    'You took the lead on a big project.',
    'You asked for the raise you deserve, prepared and calm.',
    'You turned down a distraction to protect your best work.',
    'You found a mentor inside the company.',
  ],
  self: [
    'You took a day for yourself and recovered.',
    'You set a boundary and kept it.',
    'You stepped back to protect what matters most.',
  ],
}

const CAPTURE = [
  'You grabbed an opportunity others hesitated on.',
  'You took back what was yours: a late payment finally arrived.',
  'You seized a chance and turned it into an advantage.',
  'A lucky break, and you were ready for it.',
]
const BIG_CAPTURE = [
  'A major win: the deal you had been working on closed.',
  'Big news: you landed the opportunity you had been chasing for months.',
  'You made a decisive move and the whole situation changed in your favour.',
]
const CHECK_GIVEN = [
  'You raised the stakes: a firm, honest conversation everyone had to respond to.',
  'You set a deadline and the other side had to react.',
]
const CASTLE = ['You put your life in order: a safe base and a flexible plan.', 'You secured your foundation before taking bigger risks.']
const PROMOTION = ['A promotion! Years of small steps paid off and you stepped into a new role.', 'You earned a new title: the habit of showing up finally counted.']
const CHECK_RECEIVED = ['Pressure! Three deadlines landed on the same day.', 'An unexpected problem demanded your full attention.', 'A surprise call, and you had to respond immediately.']
const SETBACK: Record<PieceType, string[]> = {
  p: ['A small setback: a plan slipped, but you can restart it tomorrow.', 'You missed a routine this week. One slip is not a pattern.'],
  n: ['A friendship cooled after a missed call. It can still be repaired.', 'A promising connection fell through.'],
  b: ['You ignored your health this week, and it showed.', 'Burnout warning: you pushed too long without rest.'],
  r: ['An unexpected expense hit your budget.', 'A bill arrived that you had not planned for.'],
  q: ['A big career setback: an important project was cancelled.', 'You lost an opportunity you had counted on.'],
  k: ['A hard day: everything felt heavy at once.'],
}
const ENDGAME = ['A later chapter of life: fewer pieces left, clearer priorities.', 'Life got simpler: you know now what really matters.']
const END: Record<Exclude<ChessStatus, 'ACTIVE'>, string[]> = {
  WON: ['You built the life you wanted. Checkmate on the day\u2019s problems.', 'Everything came together: a good decision at every turning point.'],
  LOST: ['A hard chapter ends. Rest, review, and begin again.', 'Not every year goes your way. What did this one teach you?'],
  DRAWN: ['Balance. Neither side won, and sometimes that is life.', 'A steady year: no big wins, no big losses.'],
}

/** Deterministic string hash so a game always tells the same story. */
export function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function pick(pool: string[], seed: number, recent: Set<string>): string {
  const fresh = pool.filter((t) => !recent.has(t))
  const from = fresh.length ? fresh : pool
  return from[seed % from.length]!
}

export type TurnFacts = {
  gameId: string
  ply: number
  player: ChessMoveView
  bot: ChessMoveView | null
  /** Material change over the whole turn, from the player's side, in pawns. */
  net: number
  playerMoveNumber: number
  enteredEndgame: boolean
  status: ChessStatus
  alreadyInEndgame: boolean
}

const MAJOR: PieceType[] = ['q', 'r']

export function lifeHint(f: TurnFacts, history: LifeHint[]): LifeHint {
  const recent = new Set(history.slice(-8).map((h) => h.text))
  const seed = hash(`${f.gameId}:${f.ply}`)
  const p = f.player
  const mk = (area: LifeArea, mood: LifeMood, text: string): LifeHint => ({ ply: f.ply, area, mood, title: AREA_LABEL[area], text })
  const pieceArea = LIFE_AREAS[p.piece].key

  if (f.status !== 'ACTIVE') return mk(pieceArea, f.status === 'WON' ? 'up' : f.status === 'LOST' ? 'down' : 'steady', pick(END[f.status], seed, recent))
  if (p.promotion) return mk('career', 'up', pick(PROMOTION, seed, recent))
  if (f.bot?.captured && f.net < 0) {
    const lost = f.bot.captured
    return mk(LIFE_AREAS[lost].key, 'down', pick(SETBACK[lost], seed, recent))
  }
  if (p.captured) {
    if (MAJOR.includes(p.captured) && f.net > 1) return mk(LIFE_AREAS[p.captured].key, 'up', pick(BIG_CAPTURE, seed, recent))
    if (p.piece === 'p') return mk('steps', 'up', pick(STEP_CAPTURE, seed, recent))
    return mk(pieceArea, 'up', pick(CAPTURE, seed, recent))
  }
  if (p.check) return mk(pieceArea, 'up', pick(CHECK_GIVEN, seed, recent))
  if (p.flags.includes('k') || p.flags.includes('q')) return mk('self', 'up', pick(CASTLE, seed, recent))
  if (f.bot?.check) return mk('self', 'down', pick(CHECK_RECEIVED, seed, recent))
  if (f.enteredEndgame && !f.alreadyInEndgame) return mk('self', 'steady', pick(ENDGAME, seed, recent))
  if (p.piece === 'p') return mk('steps', 'steady', pick(p.flags.includes('b') ? STEP_DOUBLE : STEP_QUIET, seed, recent))
  const area = LIFE_AREAS[p.piece].key as Exclude<LifeArea, 'steps'>
  return mk(area, 'steady', pick(AREA_QUIET[area], seed, recent))
}

/** Running life score, 0..100. Good turns lift it, setbacks cost more than steady turns earn. */
export function nextScore(score: number, hint: LifeHint, status: ChessStatus): number {
  let s = score + (hint.mood === 'up' ? 5 : hint.mood === 'down' ? -6 : 1)
  if (status === 'WON') s += 15
  if (status === 'LOST') s -= 10
  return Math.max(0, Math.min(100, s))
}
