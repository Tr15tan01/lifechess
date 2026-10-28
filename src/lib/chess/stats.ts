import { AREA_LABEL, LEVELS_INFO, LIFE_AREA_KEYS, levelLabel, type BotLevel, type LifeArea } from './types'

/** Pure aggregation of saved games into everything the stats page draws. */
export type GameRow = {
  id: string
  createdAt: string
  level: BotLevel
  result: 'WON' | 'LOST' | 'DRAWN'
  moves: number
  lifeScore: number
  areas: Record<LifeArea, number>
  tipsUsed: boolean
  durationSec: number
}

export type Stats = {
  total: number
  won: number
  lost: number
  drawn: number
  winRate: number
  avgMoves: number
  avgLife: number
  bestLevelWon: BotLevel | null
  streak: number
  byLevel: { level: BotLevel; name: string; won: number; drawn: number; lost: number }[]
  trend: { n: number; date: string; rolling: number }[]
  lifeScores: { n: number; date: string; score: number; level: string }[]
  weekly: { week: string; games: number }[]
  areas: { area: LifeArea; label: string; moves: number; share: number }[]
}

const WINDOW = 5
const points = (r: GameRow['result']) => (r === 'WON' ? 1 : r === 'DRAWN' ? 0.5 : 0)

function weekStart(iso: string): string {
  const d = new Date(iso)
  const day = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - day)
  return d.toISOString().slice(0, 10)
}

export function summarize(rows: GameRow[]): Stats {
  const sorted = [...rows].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const won = sorted.filter((r) => r.result === 'WON').length
  const lost = sorted.filter((r) => r.result === 'LOST').length
  const drawn = sorted.length - won - lost
  const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : 0)

  let streak = 0
  for (let i = sorted.length - 1; i >= 0 && sorted[i]!.result === 'WON'; i--) streak++

  const wonLevels = sorted.filter((r) => r.result === 'WON').map((r) => r.level)
  const areaTotals = Object.fromEntries(LIFE_AREA_KEYS.map((k) => [k, 0])) as Record<LifeArea, number>
  for (const r of sorted) for (const k of LIFE_AREA_KEYS) areaTotals[k] += r.areas[k] ?? 0
  const allMoves = LIFE_AREA_KEYS.reduce((s, k) => s + areaTotals[k], 0)

  const weeks = new Map<string, number>()
  for (const r of sorted) weeks.set(weekStart(r.createdAt), (weeks.get(weekStart(r.createdAt)) ?? 0) + 1)

  return {
    total: sorted.length,
    won,
    lost,
    drawn,
    winRate: sorted.length ? Math.round(((won + drawn * 0.5) / sorted.length) * 100) : 0,
    avgMoves: avg(sorted.map((r) => r.moves)),
    avgLife: avg(sorted.map((r) => r.lifeScore)),
    bestLevelWon: wonLevels.length ? (Math.max(...wonLevels) as BotLevel) : null,
    streak,
    byLevel: LEVELS_INFO.map(({ level, label }) => {
      const g = sorted.filter((r) => r.level === level)
      return { level, name: label, won: g.filter((r) => r.result === 'WON').length, drawn: g.filter((r) => r.result === 'DRAWN').length, lost: g.filter((r) => r.result === 'LOST').length }
    }),
    trend: sorted.map((r, i) => {
      const w = sorted.slice(Math.max(0, i - WINDOW + 1), i + 1)
      return { n: i + 1, date: r.createdAt, rolling: Math.round((w.reduce((s, x) => s + points(x.result), 0) / w.length) * 100) }
    }),
    lifeScores: sorted.map((r, i) => ({ n: i + 1, date: r.createdAt, score: r.lifeScore, level: levelLabel(r.level) })),
    weekly: [...weeks].map(([week, games]) => ({ week, games })),
    areas: LIFE_AREA_KEYS.map((k) => ({ area: k, label: AREA_LABEL[k], moves: areaTotals[k], share: allMoves ? Math.round((areaTotals[k] / allMoves) * 100) : 0 })),
  }
}
