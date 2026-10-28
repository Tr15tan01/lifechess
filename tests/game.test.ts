import { describe, expect, it } from 'vitest'
import { newGame, play, replay, resign, toRecord } from '@/lib/chess/game'
import { chooseMove } from '@/lib/chess/bot'
import { coachTips } from '@/lib/chess/coach'
import { summarize } from '@/lib/chess/stats'
import { LIFE_AREA_KEYS } from '@/lib/chess/types'

// Fool's mate: the player (white) loses in two moves.
function foolsMate() {
  let g = newGame(1, 'w')
  for (const [f, t] of [['f2', 'f3'], ['e7', 'e5'], ['g2', 'g4'], ['d8', 'h4']] as const) g = play(g, f, t)!
  return g
}

describe('game flow', () => {
  it('rejects illegal moves', () => {
    expect(play(newGame(3, 'w'), 'e2', 'e5')).toBeNull()
  })

  it('writes one life hint per completed turn, none for the bot opening', () => {
    let g = newGame(3, 'b')
    g = play(g, 'e2', 'e4')! // bot (white) opens
    expect(g.hints).toHaveLength(0)
    g = play(g, 'e7', 'e5')!
    g = play(g, 'g1', 'f3')!
    expect(g.hints).toHaveLength(1)
    expect(g.hints[0]!.text.length).toBeGreaterThan(10)
  })

  it('detects checkmate, scores it, and builds a record', () => {
    const g = foolsMate()
    expect(g.status).toBe('LOST')
    expect(g.endReason).toBe('CHECKMATE')
    const rec = toRecord(g)
    expect(rec.result).toBe('LOST')
    expect(rec.moves).toBe(2)
    expect(Object.keys(rec.areas).sort()).toEqual([...LIFE_AREA_KEYS].sort())
  })

  it('resigning loses the game', () => {
    expect(resign(play(newGame(3, 'w'), 'e2', 'e4')!).endReason).toBe('RESIGNATION')
  })

  it('tells the same story for the same game', () => {
    const a = play(play(newGame(3, 'w'), 'e2', 'e4')!, 'e7', 'e5')!
    const b = play(play({ ...newGame(3, 'w'), id: a.id }, 'e2', 'e4')!, 'e7', 'e5')!
    expect(b.hints).toEqual(a.hints)
  })
})

describe('bot', () => {
  it.each([1, 2, 3, 4, 5] as const)('level %i returns a legal move', (level) => {
    const fen = replay([]).fen()
    const mv = chooseMove(fen, level)!
    expect(replay([]).moves({ verbose: true }).some((m) => m.from === mv.from && m.to === mv.to)).toBe(true)
  })
})

describe('coach', () => {
  it('spots an unprotected attacked piece', () => {
    const c = replay([])
    c.load('rnb1kbnr/pppp1ppp/8/4p3/4P2q/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3')
    expect(coachTips(c, 'w', 3).join(' ')).toMatch(/unprotected|attacked/i)
  })
})

describe('stats', () => {
  it('aggregates results', () => {
    const area = Object.fromEntries(LIFE_AREA_KEYS.map((k) => [k, 2])) as never
    const row = (i: number, result: 'WON' | 'LOST' | 'DRAWN') => ({ id: `g${i}`, createdAt: new Date(2026, 0, i + 1).toISOString(), level: 3 as const, result, moves: 30, lifeScore: 60, areas: area, tipsUsed: false, durationSec: 100 })
    const s = summarize([row(1, 'WON'), row(2, 'LOST'), row(3, 'WON'), row(4, 'WON')])
    expect(s.total).toBe(4)
    expect(s.winRate).toBe(75)
    expect(s.streak).toBe(2)
    expect(s.bestLevelWon).toBe(3)
    expect(s.areas.reduce((a, x) => a + x.share, 0)).toBeGreaterThanOrEqual(99)
  })
})
