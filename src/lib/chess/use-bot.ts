'use client'

import { useCallback, useEffect, useRef } from 'react'
import { chooseMove, type BotMove } from './bot'
import type { BotLevel } from './types'

type Job = { fen: string; level: BotLevel; mode: 'play' | 'hint'; res: (m: BotMove | null) => void }

/**
 * Runs the bot in a Web Worker so the board never freezes while it thinks.
 * If workers are unavailable it falls back to the main thread.
 */
export function useBot() {
  const worker = useRef<Worker | null>(null)
  const jobs = useRef(new Map<number, Job>())
  const next = useRef(0)

  const local = (j: Job) => (j.mode === 'hint' ? chooseMove(j.fen, 4, () => 0) : chooseMove(j.fen, j.level))

  useEffect(() => {
    try {
      const w = new Worker(new URL('./bot-worker.ts', import.meta.url), { type: 'module' })
      w.onmessage = (e: MessageEvent<{ id: number; move: BotMove | null }>) => {
        const j = jobs.current.get(e.data.id)
        jobs.current.delete(e.data.id)
        j?.res(e.data.move)
      }
      w.onerror = () => {
        worker.current = null
        for (const [id, j] of jobs.current) {
          jobs.current.delete(id)
          j.res(local(j))
        }
      }
      worker.current = w
      return () => {
        w.terminate()
        worker.current = null
      }
    } catch {
      worker.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return useCallback((fen: string, level: BotLevel, mode: 'play' | 'hint' = 'play') => {
    return new Promise<BotMove | null>((res) => {
      const job: Job = { fen, level, mode, res }
      const w = worker.current
      if (!w) return void setTimeout(() => res(local(job)), 30)
      const id = ++next.current
      jobs.current.set(id, job)
      w.postMessage({ id, fen, level, mode })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
