import { useState } from 'react'
import { History } from 'lucide-react'
import type { DailyTrend } from '../lib/types'
import { DiagnosticCard } from './ui'

// ---------------------------------------------------------------------------
// Card 4 — "How your farm has changed": one clean mini-chart, then vs now.
//
// The point of this card is to show that the shift is a long-term trend and
// not one bad season, so it compares the first five years of the NASA daily
// record with the most recent five.
// ExtraUI theme: white card, emerald/amber/rose semantic accents.
// ---------------------------------------------------------------------------

type Metric = 'rain' | 'heat' | 'temp'

const METRICS: Array<{
  id: Metric
  label: string
  unit: string
  colour: string
  tone: 'emerald' | 'amber' | 'rose' | 'cyan'
}> = [
  { id: 'rain', label: 'Rainfall', unit: 'mm', colour: 'var(--color-status-cyan)', tone: 'cyan' },
  { id: 'heat', label: 'Hot days', unit: 'days >32°C', colour: 'var(--color-verdict-shift)', tone: 'rose' },
  { id: 'temp', label: 'Day highs', unit: '°C', colour: 'var(--color-verdict-adapt)', tone: 'amber' },
]

function seriesFor(metric: Metric, trend: DailyTrend): number[] {
  if (metric === 'rain') return trend.annualRain
  if (metric === 'heat') return trend.heatDays
  return trend.meanTmax
}

export default function TrendCard({ trend }: { trend: DailyTrend }) {
  const [metric, setMetric] = useState<Metric>('rain')
  const meta = METRICS.find((m) => m.id === metric)!
  const values = seriesFor(metric, trend)
  const years = trend.years

  const first5 = values.slice(0, Math.min(5, values.length))
  const last5 = values.slice(-Math.min(5, values.length))
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
  const thenValue = avg(first5)
  const nowValue = avg(last5)
  const delta = thenValue !== 0 ? ((nowValue - thenValue) / thenValue) * 100 : 0
  const deltaText = metric === 'temp' ? `${nowValue - thenValue > 0 ? '+' : ''}${(nowValue - thenValue).toFixed(1)} °C` : `${delta > 0 ? '+' : ''}${Math.round(delta)}%`
  const worse = metric === 'rain' ? delta < 0 : nowValue > thenValue

  // Chart geometry (simple inline SVG so we don't pull in a chart library)
  const W = 640
  const H = 150
  const pad = { l: 8, r: 8, t: 12, b: 20 }
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const x = (i: number) => pad.l + (i / Math.max(1, values.length - 1)) * (W - pad.l - pad.r)
  const y = (v: number) => pad.t + (1 - (v - min) / span) * (H - pad.t - pad.b)
  const path = values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const splitX = x(Math.max(0, values.length - 5.5))

  return (
    <DiagnosticCard
      id="trend"
      step="4"
      title="How your farm has changed"
      sub="The first five years of the NASA record against the last five — proof that this is a shift, not one bad season."
      icon={<History className="h-4 w-4 text-ink-3" />}
    >
      {/* Metric switch */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {METRICS.map((m) => (
          <button
            key={m.id}
            onClick={() => setMetric(m.id)}
            aria-pressed={metric === m.id}
            className={`rounded-full border px-3 py-1.5 text-[10px] font-bold transition-all ${
              metric === m.id
                ? 'border-emerald-600 bg-emerald-600 text-white'
                : 'border-slate-100 bg-white text-ink-2 hover:border-emerald-100 hover:bg-emerald-soft'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_260px] lg:items-start">
        {/* Mini chart */}
        <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${meta.label} per year, ${years[0]} to ${years[years.length - 1]}`}>
            {/* baseline */}
            <line x1={pad.l} y1={H - pad.b} x2={W - pad.r} y2={H - pad.b} stroke="var(--color-slate-100)" strokeWidth="1" />
            {/* split between "then" and "now" */}
            <line x1={splitX} y1={pad.t - 4} x2={splitX} y2={H - pad.b} stroke="var(--color-ink-3)" strokeWidth="1" strokeDasharray="3 4" opacity="0.5" />
            <text x={pad.l} y={H - 6} className="fill-ink-3 text-[9px]" fontFamily="var(--font-mono)">
              {years[0]}
            </text>
            <text x={W - pad.r} y={H - 6} textAnchor="end" className="fill-ink-3 text-[9px]" fontFamily="var(--font-mono)">
              {years[years.length - 1]}
            </text>
            <text x={(pad.l + splitX) / 2} y={H - 6} textAnchor="middle" className="fill-ink-3 text-[9px]">
              then
            </text>
            <text x={(splitX + W - pad.r) / 2} y={H - 6} textAnchor="middle" className="fill-ink-3 text-[9px]">
              now
            </text>
            {/* area + line */}
            <path
              d={`${path} L${x(values.length - 1)},${H - pad.b} L${x(0)},${H - pad.b} Z`}
              fill={meta.colour}
              opacity="0.12"
            />
            <path d={path} fill="none" stroke={meta.colour} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            {values.map((v, i) => (
              <circle
                key={i}
                cx={x(i)}
                cy={y(v)}
                r={i >= values.length - 5 ? 3.2 : 2}
                fill={i >= values.length - 5 ? meta.colour : 'var(--color-white)'}
                stroke={meta.colour}
                strokeWidth="1.4"
              />
            ))}
          </svg>
          <p className="mt-1 text-[10px] text-ink-3">
            {meta.label} per year at your exact point, from the NASA POWER daily record.
          </p>
        </div>

        {/* Then vs now numbers */}
        <div className="space-y-2.5">
          <div className="rounded-xl border border-slate-100 bg-white p-3.5 shadow-sm">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-ink-3">
              {years[0]}–{years[Math.min(4, years.length - 1)]} (then)
            </p>
            <p className="data-tabular mt-0.5 text-xl font-bold text-ink">
              {metric === 'temp' ? `${thenValue.toFixed(1)} °C` : `${Math.round(thenValue)} ${meta.unit}`}
            </p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-white p-3.5 shadow-sm">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-ink-3">
              {years[Math.max(0, years.length - 5)]}–{years[years.length - 1]} (now)
            </p>
            <p className="data-tabular mt-0.5 text-xl font-bold text-ink">
              {metric === 'temp' ? `${nowValue.toFixed(1)} °C` : `${Math.round(nowValue)} ${meta.unit}`}
            </p>
          </div>
          <div
            className={`rounded-xl border px-3.5 py-3 ${
              worse ? 'border-rose-100 bg-rose-soft' : 'border-emerald-100 bg-emerald-soft'
            }`}
          >
            <p className="text-[9px] font-semibold uppercase tracking-wider text-ink-3">
              The shift
            </p>
            <p
              className={`data-tabular mt-0.5 text-xl font-bold ${
                worse ? 'text-rose-700' : 'text-emerald-700'
              }`}
            >
              {deltaText}
            </p>
            <p className="mt-1 text-[10px] leading-snug text-ink-2">
              {worse
                ? metric === 'rain'
                  ? 'Less rain than the first five years of the record — this is the long-run pattern, not one dry season.'
                  : metric === 'heat'
                    ? 'More days over 32°C than the first five years of the record — heat stress is now part of the plan.'
                    : 'Warmer days than the first five years of the record — every degree raises the water demand of the crop.'
                : metric === 'rain'
                  ? 'More rain than the first five years of the record — moisture is not the binding constraint here.'
                  : 'Fewer extreme days than the first five years of the record — conditions have eased at this point.'}
            </p>
          </div>
        </div>
      </div>

      <p className="mt-3 text-[10px] leading-snug text-ink-3">
        Source: NASA POWER daily point record for your coordinates (15 years, reanalysis). POWER daily
        data lags about a week, so the most recent season is still filling in.
      </p>
    </DiagnosticCard>
  )
}
