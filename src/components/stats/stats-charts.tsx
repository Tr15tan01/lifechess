'use client'

import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Stats } from '@/lib/chess/stats'
import { ChartFrame, ChartTooltip, SERIES, axisProps } from '@/components/charts/chart-kit'

const shortDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
const cursor = { fill: 'color-mix(in oklab, var(--ink) 5%, transparent)' }

export function WinRateChart({ data }: { data: Stats['trend'] }) {
  return (
    <ChartFrame title="Win rate over time" description="Rolling result over your last five games (a draw counts as half)." table={{ headers: ['Game', 'Date', 'Win rate %'], rows: data.map((d) => [d.n, shortDate(d.date), d.rolling]) }}>
      <div className="h-60">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -18 }}>
            <CartesianGrid stroke="var(--grid)" vertical={false} />
            <XAxis dataKey="n" {...axisProps} />
            <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} {...axisProps} />
            <Tooltip cursor={{ stroke: 'var(--line-strong)' }} content={<ChartTooltip labelFormat={(_, p) => `Game ${p?.n}, ${p?.date ? shortDate(String(p.date)) : ''}`} format={(v) => `${v}%`} />} />
            <Line type="monotone" dataKey="rolling" name="Win rate" stroke={SERIES.s1} strokeWidth={2} dot={{ r: 3.5, fill: SERIES.s1, stroke: 'var(--surface)', strokeWidth: 2 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  )
}

export function LifeScoreChart({ data }: { data: Stats['lifeScores'] }) {
  return (
    <ChartFrame title="Life score per game" description="How well your story went, from 0 to 100." table={{ headers: ['Game', 'Level', 'Life score'], rows: data.map((d) => [d.n, d.level, d.score]) }}>
      <div className="h-60">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -18 }}>
            <CartesianGrid stroke="var(--grid)" vertical={false} />
            <XAxis dataKey="n" {...axisProps} />
            <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} {...axisProps} />
            <Tooltip cursor={{ stroke: 'var(--line-strong)' }} content={<ChartTooltip labelFormat={(_, p) => `Game ${p?.n}, ${p?.level ?? ''}`} />} />
            <Area type="monotone" dataKey="score" name="Life score" stroke={SERIES.s3} fill={SERIES.s3} fillOpacity={0.18} strokeWidth={2} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  )
}

export function LevelChart({ data }: { data: Stats['byLevel'] }) {
  return (
    <ChartFrame
      title="Results by difficulty"
      description="How each level has gone for you."
      legend={[
        { label: 'Won', color: SERIES.s3 },
        { label: 'Drawn', color: SERIES.s2 },
        { label: 'Lost', color: SERIES.s1 },
      ]}
      table={{ headers: ['Level', 'Won', 'Drawn', 'Lost'], rows: data.map((d) => [d.name, d.won, d.drawn, d.lost]) }}
    >
      <div className="h-60">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
            <CartesianGrid stroke="var(--grid)" vertical={false} />
            <XAxis dataKey="name" {...axisProps} interval={0} tick={{ fill: 'var(--ink-3)', fontSize: 11 }} />
            <YAxis allowDecimals={false} {...axisProps} />
            <Tooltip cursor={cursor} content={<ChartTooltip />} />
            <Bar dataKey="won" name="Won" stackId="r" fill={SERIES.s3} stroke="var(--surface)" strokeWidth={2} maxBarSize={36} isAnimationActive={false} />
            <Bar dataKey="drawn" name="Drawn" stackId="r" fill={SERIES.s2} stroke="var(--surface)" strokeWidth={2} maxBarSize={36} isAnimationActive={false} />
            <Bar dataKey="lost" name="Lost" stackId="r" fill={SERIES.s1} stroke="var(--surface)" strokeWidth={2} radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  )
}

export function WeeklyChart({ data }: { data: Stats['weekly'] }) {
  return (
    <ChartFrame title="Games per week" description="How often you sit down at the board." table={{ headers: ['Week of', 'Games'], rows: data.map((d) => [shortDate(d.week), d.games]) }}>
      <div className="h-60">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
            <CartesianGrid stroke="var(--grid)" vertical={false} />
            <XAxis dataKey="week" tickFormatter={shortDate} {...axisProps} />
            <YAxis allowDecimals={false} {...axisProps} />
            <Tooltip cursor={cursor} content={<ChartTooltip labelFormat={(l) => `Week of ${shortDate(String(l))}`} />} />
            <Bar dataKey="games" name="Games" fill={SERIES.s2} radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  )
}

export function LifeBalanceChart({ data }: { data: Stats['areas'] }) {
  return (
    <ChartFrame title="Life balance" description="Share of your moves spent on each life area (each piece is a different area)." table={{ headers: ['Area', 'Moves', 'Share %'], rows: data.map((d) => [d.label, d.moves, d.share]) }}>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data} outerRadius="75%">
            <PolarGrid stroke="var(--grid)" />
            <PolarAngleAxis dataKey="label" tick={{ fill: 'var(--ink-3)', fontSize: 12 }} />
            <Tooltip content={<ChartTooltip format={(v) => `${v}%`} />} />
            <Radar dataKey="share" name="Share of moves" stroke={SERIES.s1} fill={SERIES.s1} fillOpacity={0.3} strokeWidth={2} isAnimationActive={false} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  )
}
