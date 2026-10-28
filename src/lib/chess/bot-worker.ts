import { chooseMove } from './bot'
import type { BotLevel } from './types'

type Req = { id: number; fen: string; level: BotLevel; mode: 'play' | 'hint' }

self.onmessage = (e: MessageEvent<Req>) => {
  const { id, fen, level, mode } = e.data
  // A hint is the strongest reply with no deliberate mistakes.
  const move = mode === 'hint' ? chooseMove(fen, 4, () => 0) : chooseMove(fen, level)
  self.postMessage({ id, move })
}
