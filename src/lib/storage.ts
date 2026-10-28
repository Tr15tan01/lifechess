'use client'

import type { BotLevel, Color, GameRecord } from '@/lib/chess/types'
import type { Game } from '@/lib/chess/game'

/** Everything except signed-in progress lives in localStorage. Every access is guarded: storage can be blocked. */
export type Settings = { level: BotLevel; color: Color | 'random'; tips: boolean; hints: boolean; board: '3d' | '2d' }
export type HistoryItem = GameRecord & { synced: boolean }

export const DEFAULT_SETTINGS: Settings = { level: 3, color: 'w', tips: true, hints: true, board: '3d' }

const K = { settings: 'lc-settings', game: 'lc-game', history: 'lc-history' }
const MAX_HISTORY = 100

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? ({ ...(typeof fallback === 'object' && !Array.isArray(fallback) ? fallback : {}), ...JSON.parse(raw) } as T) : fallback
  } catch {
    return fallback
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage unavailable or full */
  }
}

export const loadSettings = (): Settings => read(K.settings, DEFAULT_SETTINGS)
export const saveSettings = (s: Settings) => write(K.settings, s)

export function loadGame(): Game | null {
  try {
    const raw = localStorage.getItem(K.game)
    const g = raw ? (JSON.parse(raw) as Game) : null
    return g && Array.isArray(g.moves) && Array.isArray(g.hints) ? g : null
  } catch {
    return null
  }
}
export const saveGame = (g: Game) => write(K.game, g)

export function loadHistory(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(K.history)
    const list = raw ? (JSON.parse(raw) as HistoryItem[]) : []
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}
export function saveHistory(list: HistoryItem[]) {
  write(K.history, list.slice(-MAX_HISTORY))
}
