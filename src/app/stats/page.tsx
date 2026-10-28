import Link from 'next/link'
import type { Metadata } from 'next'
import { Button } from '@/components/ui/button'
import { EmptyState, Panel } from '@/components/ui/misc'
import { LevelChart, LifeBalanceChart, LifeScoreChart, WeeklyChart, WinRateChart } from '@/components/stats/stats-charts'
import { getSessionUser } from '@/server/auth/session'
import { statsFor } from '@/server/services/games'
import { levelLabel } from '@/lib/chess/types'

export const metadata: Metadata = { title: 'Your stats' }

function Kpi({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="panel p-5">
      <p className="text-[13px] text-ink-3">{label}</p>
      <p className="tabular mt-1 font-display text-4xl">{value}</p>
      {sub && <p className="mt-1 text-[12.5px] text-ink-3">{sub}</p>}
    </div>
  )
}

export default async function StatsPage() {
  const user = await getSessionUser()
  if (!user) {
    return (
      <main id="main" className="mx-auto max-w-3xl px-4 py-16 sm:px-8">
        <EmptyState
          title="Charts live in your account"
          action={
            <div className="flex gap-3">
              <Button asChild><Link href="/register">Create free account</Link></Button>
              <Button asChild variant="secondary"><Link href="/login">Sign in</Link></Button>
            </div>
          }
        >
          You can play without an account. Sign in and every finished game is saved, so you can watch your win rate, difficulty and life balance change over time. Games you played as a guest on this browser are added automatically.
        </EmptyState>
      </main>
    )
  }

  const { stats: s } = await statsFor(user.id)
  if (!s.total) {
    return (
      <main id="main" className="mx-auto max-w-3xl px-4 py-16 sm:px-8">
        <EmptyState title="No finished games yet" action={<Button asChild><Link href="/">Play your first game</Link></Button>}>
          Finish a game while signed in and your charts will appear here.
        </EmptyState>
      </main>
    )
  }

  return (
    <main id="main" className="mx-auto max-w-6xl space-y-6 px-4 pb-20 pt-10 sm:px-8">
      <div>
        <h1 className="display-md">Hello, {user.name}</h1>
        <p className="mt-2 text-ink-2">Your story across {s.total} finished {s.total === 1 ? 'game' : 'games'}.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Games played" value={s.total} sub={`${s.won} won · ${s.drawn} drawn · ${s.lost} lost`} />
        <Kpi label="Score rate" value={`${s.winRate}%`} sub="Wins plus half of draws" />
        <Kpi label="Best level beaten" value={s.bestLevelWon ? levelLabel(s.bestLevelWon) : 'None yet'} sub={s.streak > 1 ? `${s.streak}-game winning streak` : undefined} />
        <Kpi label="Average life score" value={s.avgLife} sub={`${s.avgMoves} moves per game`} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <WinRateChart data={s.trend} />
        <LifeScoreChart data={s.lifeScores} />
        <LevelChart data={s.byLevel} />
        <LifeBalanceChart data={s.areas} />
      </div>
      <WeeklyChart data={s.weekly} />
      <Panel as="aside" className="text-[13px] text-ink-3">Stats are reported by your browser when a game ends, so they are for your own tracking and are not verified.</Panel>
    </main>
  )
}
