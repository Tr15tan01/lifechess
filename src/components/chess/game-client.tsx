'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Square } from 'chess.js'
import { Box, Flag, Grid3x3, Lightbulb, RotateCcw, Sparkles } from 'lucide-react'
import { LEVELS_INFO, LIFE_AREAS, levelLabel, type BotLevel, type Color, type LifeHint } from '@/lib/chess/types'
import { coachTips } from '@/lib/chess/coach'
import { newGame, play, replay, resign, toRecord, type Game } from '@/lib/chess/game'
import { useBot } from '@/lib/chess/use-bot'
import { trackPieces } from '@/lib/chess/pieces'
import { DEFAULT_SETTINGS, loadGame, loadHistory, loadSettings, saveGame, saveHistory, saveSettings, type HistoryItem, type Settings } from '@/lib/storage'
import { api } from '@/lib/api-client'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/button'
import { Badge, Meter, Panel, PanelTitle } from '@/components/ui/misc'
import { Dialog, DialogClose } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import { Board2D } from './board-2d'

const Board3D = dynamic(() => import('./board-3d'), { ssr: false, loading: () => <div className="size-full animate-pulse rounded-[14px] bg-surface-2" aria-hidden /> })

const END_TEXT = { CHECKMATE: 'by checkmate', RESIGNATION: 'by resignation', STALEMATE: 'by stalemate', REPETITION: 'by repetition', INSUFFICIENT: 'by insufficient material', FIFTY_MOVE: 'by the fifty-move rule' } as const
const MOOD_STYLE = { up: 'border-ok/50 bg-ok/10', steady: 'border-line-strong bg-surface-2/60', down: 'border-bad/50 bg-bad/10' } as const
const MOOD_LABEL = { up: 'Good news', steady: 'Life goes on', down: 'Setback' } as const

function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas')
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="flex w-full items-center justify-between gap-4 rounded-[12px] border border-line px-3.5 py-2.5 text-left transition-colors hover:border-gold/50">
      <span>
        <span className="block text-sm font-medium text-ink">{label}</span>
        <span className="block text-[12.5px] text-ink-3">{hint}</span>
      </span>
      <span className={cn('relative h-6 w-10 shrink-0 rounded-full transition-colors', checked ? 'bg-gold' : 'bg-surface-3')} aria-hidden>
        <span className={cn('absolute top-0.5 size-5 rounded-full bg-white shadow transition-[left]', checked ? 'left-[18px]' : 'left-0.5')} />
      </span>
    </button>
  )
}

function resolveColor(c: Settings['color']): Color {
  return c === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : c
}

export function GameClient({ user }: { user: { name: string } | null }) {
  const toast = useToast()
  const askBot = useBot()
  const [ready, setReady] = useState(false)
  const [webgl, setWebgl] = useState(true)
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [game, setGame] = useState<Game | null>(null)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [promo, setPromo] = useState<{ from: string; to: string } | null>(null)
  const [thinking, setThinking] = useState(false)
  const [hintMove, setHintMove] = useState<{ from: string; to: string } | null>(null)
  const botKey = useRef<string | null>(null)
  const finalized = useRef(new Set<string>())

  // ── Load everything from localStorage once ──
  useEffect(() => {
    const s = loadSettings()
    const h = loadHistory()
    setWebgl(webglAvailable())
    setSettings(s)
    setHistory(h)
    h.forEach((x) => finalized.current.add(x.id))
    setGame(loadGame() ?? newGame(s.level, resolveColor(s.color)))
    setReady(true)
  }, [])

  const updateSettings = (patch: Partial<Settings>) => {
    const next = { ...settings, ...patch }
    setSettings(next)
    saveSettings(next)
  }

  useEffect(() => {
    if (game) saveGame(game)
  }, [game])

  const chess = useMemo(() => replay(game?.moves ?? []), [game?.moves])
  const active = game?.status === 'ACTIVE'
  const botTurn = Boolean(game && active && chess.turn() !== game.color)
  const myTurn = Boolean(game && active && !botTurn)
  const legal = useMemo(() => (myTurn ? chess.moves({ verbose: true }) : []), [chess, myTurn])
  const targets = selected ? legal.filter((m) => m.from === selected).map((m) => m.to) : []
  const pieces = useMemo(() => trackPieces(game?.moves ?? []), [game?.moves])
  const last = game?.moves.at(-1)
  const checkSquare = useMemo(() => {
    if (!chess.inCheck()) return null
    for (const row of chess.board()) for (const p of row) if (p && p.type === 'k' && p.color === chess.turn()) return p.square
    return null
  }, [chess])

  // ── The bot answers on a worker thread ──
  useEffect(() => {
    if (!ready || !game || !botTurn) return
    const key = `${game.id}:${game.moves.length}`
    if (botKey.current === key) return
    botKey.current = key
    setThinking(true)
    const started = Date.now()
    const fen = chess.fen()
    void askBot(fen, game.level).then(async (mv) => {
      await new Promise((r) => setTimeout(r, Math.max(0, 450 - (Date.now() - started))))
      setThinking(false)
      if (!mv) return
      setGame((g) => (g && g.id === game.id && g.moves.length === game.moves.length ? (play(g, mv.from, mv.to, mv.promotion) ?? g) : g))
    })
  }, [ready, game, botTurn, chess, askBot])

  // ── Save finished games: locally always, to the account when signed in ──
  const upload = useCallback(
    async (item: HistoryItem) => {
      const { synced: _synced, ...record } = item
      await api('/api/games', { body: record })
      setHistory((h) => {
        const next = h.map((x) => (x.id === item.id ? { ...x, synced: true } : x))
        saveHistory(next)
        return next
      })
    },
    [],
  )

  useEffect(() => {
    if (!game || game.status === 'ACTIVE' || finalized.current.has(game.id)) return
    finalized.current.add(game.id)
    const item: HistoryItem = { ...toRecord(game), synced: false }
    setHistory((h) => {
      const next = [...h, item]
      saveHistory(next)
      return next
    })
    if (user) upload(item).catch(() => toast('Could not save this game to your account yet. It will retry next time you open the app.', 'info'))
  }, [game, user, upload, toast])

  useEffect(() => {
    if (!ready || !user) return
    const pending = history.filter((h) => !h.synced).slice(0, 25)
    if (!pending.length) return
    let alive = true
    void (async () => {
      for (const item of pending) {
        if (!alive) return
        try {
          await upload(item)
        } catch {
          return
        }
      }
    })()
    return () => {
      alive = false
    }
    // Only when the account or the loaded history changes, not after each upload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, user])

  // ── Actions ──
  const startNew = () => {
    if (game && game.status === 'ACTIVE' && game.moves.length > 2 && !window.confirm('Abandon the current game? It will not be counted.')) return
    botKey.current = null
    setSelected(null)
    setHintMove(null)
    setThinking(false)
    setGame(newGame(settings.level, resolveColor(settings.color)))
  }

  const move = (from: string, to: string, promotion?: string) => {
    setSelected(null)
    setHintMove(null)
    setGame((g) => (g ? (play(g, from, to, promotion) ?? g) : g))
  }

  const onSquare = (sq: string) => {
    if (!myTurn || !game) return
    if (selected && targets.includes(sq)) {
      if (legal.some((m) => m.from === selected && m.to === sq && m.promotion)) setPromo({ from: selected, to: sq })
      else move(selected, sq)
      return
    }
    const p = chess.get(sq as Square)
    setSelected(p && p.color === game.color && sq !== selected ? sq : null)
  }

  const showBest = async () => {
    if (!game || !myTurn) return
    setGame({ ...game, tipsUsed: true })
    const mv = await askBot(chess.fen(), game.level, 'hint')
    if (mv) setHintMove({ from: mv.from, to: mv.to })
  }

  const doResign = () => {
    if (game && game.status === 'ACTIVE' && window.confirm('Resign this game?')) setGame(resign(game))
  }

  if (!ready || !game) {
    return (
      <div className="grid gap-6 px-4 pb-16 pt-6 sm:px-8 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="aspect-square w-full animate-pulse rounded-[14px] bg-surface-2" />
        <div className="h-96 animate-pulse rounded-[14px] bg-surface-2" />
      </div>
    )
  }

  const boardMode = webgl ? settings.board : '2d'
  const playerMoves = game.moves.filter((m) => m.color === game.color).length
  const tips = settings.tips && myTurn ? coachTips(chess, game.color, playerMoves + 1) : []
  const latest: LifeHint | undefined = game.hints.at(-1)
  const ended = game.status !== 'ACTIVE'
  const boardProps = { pieces, orientation: game.color, selected, targets, lastMove: last ? { from: last.from, to: last.to } : null, checkSquare, hint: settings.tips ? hintMove : null, interactive: myTurn, onSquare }
  const wins = history.filter((h) => h.result === 'WON').length
  const losses = history.filter((h) => h.result === 'LOST').length
  const draws = history.length - wins - losses
  const status = ended
    ? `${game.status === 'WON' ? 'You won' : game.status === 'LOST' ? 'You lost' : 'Draw'} ${game.endReason ? END_TEXT[game.endReason] : ''}`
    : thinking
      ? 'Your opponent is thinking…'
      : chess.inCheck() && myTurn
        ? 'Check! Protect your king.'
        : myTurn
          ? 'Your move'
          : 'Waiting…'

  const pairs: [string | undefined, string | undefined][] = []
  const sans = game.moves.map((m) => m.san)
  for (let i = 0; i < sans.length; i += 2) pairs.push([sans[i], sans[i + 1]])

  return (
    <div className="grid gap-6 px-4 pb-16 pt-6 sm:px-8 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="mx-auto w-full min-w-0 max-w-[min(100%,82dvh)] space-y-4 xl:max-w-none">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-display text-2xl leading-tight" aria-live="polite">{status}</p>
            <p className="text-[13px] text-ink-3">
              {levelLabel(game.level)} opponent · you play {game.color === 'w' ? 'White' : 'Black'}
            </p>
          </div>
          <div role="radiogroup" aria-label="Board view" className="inline-flex rounded-full border border-line-strong p-0.5">
            {(
              [
                ['3d', '3D', Box],
                ['2d', '2D', Grid3x3],
              ] as const
            ).map(([m, label, Icon]) => (
              <button key={m} type="button" role="radio" aria-checked={boardMode === m} disabled={m === '3d' && !webgl} onClick={() => updateSettings({ board: m })} className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] transition-colors disabled:opacity-40', boardMode === m ? 'bg-gold text-gold-ink' : 'text-ink-2 hover:text-ink')}>
                <Icon className="size-3.5" aria-hidden /> {label}
              </button>
            ))}
          </div>
        </div>

        <div className="relative aspect-square w-full">{boardMode === '3d' ? <Board3D {...boardProps} className="size-full" /> : <Board2D {...boardProps} />}</div>

        {settings.hints && latest && (
          <div key={latest.ply + latest.text} className={cn('animate-rise rounded-[14px] border px-4 py-3.5', MOOD_STYLE[latest.mood])} aria-live="polite">
            <p className="flex items-center gap-2 text-[12px] font-medium uppercase tracking-wide text-ink-3">
              <Sparkles className="size-3.5 text-gold" aria-hidden /> {latest.title} · {MOOD_LABEL[latest.mood]}
            </p>
            <p className="mt-1 font-display text-[1.2rem] leading-snug text-ink">{latest.text}</p>
          </div>
        )}

        {ended && (
          <Panel className="animate-rise">
            <PanelTitle>{game.status === 'WON' ? 'A good year' : game.status === 'LOST' ? 'A hard chapter' : 'A balanced one'}</PanelTitle>
            <p className="text-sm text-ink-2">Final life score: <span className="font-medium text-ink">{game.score}/100</span> after {playerMoves} moves.</p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button onClick={startNew}>Play again</Button>
              {user ? (
                <Link href="/stats" className="text-sm text-gold hover:underline">See your charts</Link>
              ) : (
                <Link href="/register" className="text-sm text-gold hover:underline">Create a free account to save progress and see charts</Link>
              )}
            </div>
          </Panel>
        )}
      </div>

      <aside className="min-w-0 space-y-4">
        <Panel>
          <PanelTitle action={<Badge tone="gold">Life {game.score}</Badge>}>Your game</PanelTitle>
          <Meter value={game.score} label="Life score" tone={game.score >= 50 ? 'ok' : 'bad'} />
          <p className="mt-2 text-[12.5px] text-ink-3">Your life score rises with good moves and falls with setbacks.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={startNew}><RotateCcw className="size-3.5" aria-hidden /> New game</Button>
            <Button variant="ghost" size="sm" onClick={doResign} disabled={!active || game.moves.length === 0}><Flag className="size-3.5" aria-hidden /> Resign</Button>
          </div>
        </Panel>

        <Panel>
          <PanelTitle>Next game</PanelTitle>
          <div role="radiogroup" aria-label="Difficulty" className="grid grid-cols-5 gap-1">
            {LEVELS_INFO.map((l) => (
              <button key={l.level} type="button" role="radio" aria-checked={settings.level === l.level} onClick={() => updateSettings({ level: l.level as BotLevel })} className={cn('rounded-[10px] border px-1 py-2 text-center text-[12px] leading-tight transition-colors', settings.level === l.level ? 'border-gold bg-gold/15 text-ink' : 'border-line text-ink-2 hover:border-gold/50')}>
                <span className="block font-display text-base">{l.level}</span>
                {l.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[12.5px] text-ink-3">{LEVELS_INFO.find((l) => l.level === settings.level)?.blurb}</p>
          <div role="radiogroup" aria-label="Your colour" className="mt-4 inline-flex rounded-full border border-line-strong p-0.5">
            {(['w', 'b', 'random'] as const).map((c) => (
              <button key={c} type="button" role="radio" aria-checked={settings.color === c} onClick={() => updateSettings({ color: c })} className={cn('rounded-full px-3 py-1 text-[13px] transition-colors', settings.color === c ? 'bg-gold text-gold-ink' : 'text-ink-2 hover:text-ink')}>
                {c === 'w' ? 'White' : c === 'b' ? 'Black' : 'Random'}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[12.5px] text-ink-3">Applies when you start a new game.</p>
        </Panel>

        <Panel>
          <PanelTitle>Helpers</PanelTitle>
          <div className="space-y-2">
            <Toggle label="Coaching tips" hint="Warns about hanging pieces, checks and opening basics." checked={settings.tips} onChange={(v) => { updateSettings({ tips: v }); if (!v) setHintMove(null) }} />
            <Toggle label="Life hints" hint="Each move becomes a small life situation." checked={settings.hints} onChange={(v) => updateSettings({ hints: v })} />
          </div>
        </Panel>

        {settings.tips && (
          <Panel>
            <PanelTitle action={<Button variant="secondary" size="sm" onClick={() => void showBest()} disabled={!myTurn}><Lightbulb className="size-3.5" aria-hidden /> Best move</Button>}>Coach</PanelTitle>
            {tips.length ? (
              <ul className="space-y-2 text-sm text-ink-2">
                {tips.map((t) => (
                  <li key={t} className="rounded-[10px] bg-surface-2/60 px-3 py-2">{t}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-3">{ended ? 'The game is over. Start a new one for more tips.' : 'Tips appear on your turn.'}</p>
            )}
            {hintMove && <p className="mt-3 text-[12.5px] text-ink-3">The suggested move is highlighted in green on the board. Using it is marked in your stats.</p>}
          </Panel>
        )}

        {settings.hints && game.hints.length > 1 && (
          <Panel>
            <PanelTitle>Life journal</PanelTitle>
            <ol className="max-h-64 space-y-2.5 overflow-y-auto pr-1 text-sm">
              {[...game.hints].reverse().slice(1, 10).map((h) => (
                <li key={`${h.ply}-${h.text}`} className="border-l-2 border-line-strong pl-3">
                  <span className="text-[12px] text-ink-3">{h.title}</span>
                  <p className="text-ink-2">{h.text}</p>
                </li>
              ))}
            </ol>
          </Panel>
        )}

        <Panel>
          <PanelTitle action={<span className="text-[12.5px] text-ink-3">{wins}W · {draws}D · {losses}L</span>}>Moves</PanelTitle>
          {pairs.length ? (
            <ol className="grid max-h-40 grid-cols-2 gap-x-4 gap-y-1 overflow-y-auto text-[13px] tabular text-ink-2">
              {pairs.map(([a, b], i) => (
                <li key={i} className="flex gap-2">
                  <span className="w-5 text-ink-3">{i + 1}.</span>
                  <span>{a}</span>
                  <span>{b}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-ink-3">No moves yet. {LIFE_AREAS.p.area}: every pawn is a small decision.</p>
          )}
          {!user && <p className="mt-4 text-[12.5px] text-ink-3">Playing as a guest. Games are kept in this browser. <Link href="/register" className="text-gold hover:underline">Sign in</Link> to save progress and see charts.</p>}
        </Panel>
      </aside>

      <Dialog open={Boolean(promo)} onOpenChange={(o) => !o && setPromo(null)} title="Promote your pawn" description="Choose the piece it becomes.">
        <div className="grid grid-cols-4 gap-2">
          {(
            [
              ['q', 'Queen'],
              ['r', 'Rook'],
              ['b', 'Bishop'],
              ['n', 'Knight'],
            ] as const
          ).map(([p, name]) => (
            <DialogClose key={p} asChild>
              <Button
                variant="secondary"
                onClick={() => {
                  if (promo) move(promo.from, promo.to, p)
                  setPromo(null)
                }}
              >
                {name}
              </Button>
            </DialogClose>
          ))}
        </div>
      </Dialog>
    </div>
  )
}
