import { useEffect, useState, type ReactNode } from 'react'

// ---------------------------------------------------------------------------
// Small shared UI primitives with a warm "field ledger" look.
// ---------------------------------------------------------------------------

export function Chip({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: 'neutral' | 'leaf' | 'ochre' | 'clay' | 'water' | 'dark'
}) {
  const tones: Record<string, string> = {
    neutral: 'bg-paper-2 text-ink-2 border-paper-3',
    leaf: 'bg-leaf/10 text-leaf-dark border-leaf/30',
    ochre: 'bg-ochre/10 text-ochre border-ochre/40',
    clay: 'bg-clay/10 text-clay border-clay/40',
    water: 'bg-water/10 text-water border-water/30',
    dark: 'bg-panel text-panel-text border-panel-line',
  }
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium tracking-wide ${tones[tone]}`}
    >
      {children}
    </span>
  )
}

export function ScoreRing({ score, size = 64 }: { score: number; size?: number }) {
  const [shown, setShown] = useState(0)
  useEffect(() => {
    const t = setTimeout(() => setShown(score), 80)
    return () => clearTimeout(t)
  }, [score])
  const r = (size - 8) / 2
  const c = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(100, shown)) / 100
  const color = score >= 70 ? 'var(--color-leaf)' : score >= 50 ? 'var(--color-ochre)' : 'var(--color-clay)'
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-paper-3)" strokeWidth="5" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          style={{ transition: 'stroke-dashoffset 1.1s cubic-bezier(0.22,1,0.36,1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="data-tabular text-sm font-semibold text-ink">{score}</span>
        <span className="text-[8px] uppercase tracking-widest text-ink-3">score</span>
      </div>
    </div>
  )
}

export function ScoreBar({
  score,
  label,
  detail,
}: {
  score: number
  label: string
  detail?: string
}) {
  const [w, setW] = useState(0)
  useEffect(() => {
    const t = setTimeout(() => setW(score), 120)
    return () => clearTimeout(t)
  }, [score])
  const color =
    score >= 70 ? 'var(--color-leaf)' : score >= 50 ? 'var(--color-ochre)' : 'var(--color-clay)'
  return (
    <div className="group">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-ink-2">{label}</span>
        <span className="data-tabular text-xs font-semibold" style={{ color }}>
          {score}
        </span>
      </div>
      <div className="scorebar h-2">
        <i style={{ width: `${w}%`, background: color }} />
      </div>
      {detail && (
        <p className="mt-1 hidden text-[11px] leading-snug text-ink-3 group-hover:block group-focus-within:block">
          {detail}
        </p>
      )}
    </div>
  )
}

export function SectionHead({
  index,
  title,
  sub,
}: {
  index: string
  title: string
  sub: string
}) {
  return (
    <div className="mb-8 flex items-start gap-5">
      <span className="data-tabular mt-1 hidden rounded-lg border border-paper-3 bg-paper-2 px-2.5 py-1 text-sm font-semibold text-ink-2 sm:block">
        {index}
      </span>
      <div>
        <h2 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          {title}
        </h2>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-3">{sub}</p>
      </div>
    </div>
  )
}

export function Slider({
  label,
  value,
  onChange,
  icon,
  hint,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  icon?: ReactNode
  hint?: string
}) {
  const slug = label.toLowerCase().replace(/[^a-z]+/g, '-')
  return (
    <div>
      <div className="flex items-center justify-between">
        <label htmlFor={`priority-${slug}`} className="flex items-center gap-2 text-sm font-medium text-ink-2">
          {icon}
          {label}
        </label>
        <span className="data-tabular text-xs text-ink-3">{value}</span>
      </div>
      <input
        id={`priority-${slug}`}
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
        aria-label={label}
      />
      {hint && <p className="text-[11px] text-ink-3">{hint}</p>}
    </div>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-paper-3 bg-white/60 shadow-card ${className}`}>
      {children}
    </div>
  )
}

/**
 * The shell for the four diagnostic cards that make up the result screen:
 * verdict → live pulse → actions → trend. Each card is numbered and titled
 * so the farmer always knows where they are in the diagnosis.
 */
export function DiagnosticCard({
  step,
  title,
  sub,
  icon,
  children,
  id,
  className = '',
}: {
  step: string
  title: string
  sub?: string
  icon?: ReactNode
  children: ReactNode
  id?: string
  className?: string
}) {
  return (
    <section id={id} className={`scroll-mt-24 ${className}`}>
      <div className="rise rounded-2xl border border-paper-3 bg-white/70 p-5 shadow-card sm:p-7">
        <header className="mb-5 flex items-start gap-3.5">
          <span className="data-tabular mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-panel text-xs font-bold text-leaf-3">
            {step}
          </span>
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 font-display text-xl font-semibold tracking-tight text-ink sm:text-2xl">
              {icon}
              {title}
            </h2>
            {sub && <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-ink-3">{sub}</p>}
          </div>
        </header>
        {children}
      </div>
    </section>
  )
}

/** A simple labelled gauge used by the live-pulse card. */
export function Gauge({
  label,
  state,
  tone,
  value,
  scale,
  tip,
  source,
}: {
  label: string
  state: string
  tone: 'leaf' | 'ochre' | 'clay' | 'water'
  value: string
  scale?: { pct: number; caption: string }
  tip: string
  source?: string
}) {
  const color = `var(--color-${tone})`
  return (
    <div className="flex h-full flex-col rounded-xl border border-paper-3 bg-paper/40 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-3">{label}</p>
      <p className="mt-1.5 font-display text-2xl font-semibold leading-tight" style={{ color }}>
        {state}
      </p>
      <p className="data-tabular mt-0.5 text-sm font-semibold text-ink">{value}</p>
      {scale && (
        <div className="mt-3">
          <div className="scorebar h-2">
            <i style={{ width: `${Math.max(2, Math.min(100, scale.pct))}%`, background: color }} />
          </div>
          <p className="mt-1 text-[10px] uppercase tracking-wider text-ink-3">{scale.caption}</p>
        </div>
      )}
      <p className="mt-3 flex-1 text-[12px] leading-snug text-ink-2">{tip}</p>
      {source && <p className="mt-2 text-[10px] leading-tight text-ink-3">{source}</p>}
    </div>
  )
}

export const FAMILY_COLOR: Record<string, string> = {
  grass: 'var(--color-leaf)',
  legume: 'var(--color-ochre)',
  brassica: 'var(--color-clay)',
  other: 'var(--color-ink-3)',
}

export function CropChip({
  name,
  family,
  season,
  water,
}: {
  name: string
  family: string
  season: string
  water?: number
}) {
  const color = FAMILY_COLOR[family] ?? 'var(--color-ink-3)'
  return (
    <div className="flex min-w-[104px] flex-col items-center gap-1 rounded-xl border border-paper-3 bg-white/70 px-2 py-1.5 text-center">
      <span className="text-[11px] font-semibold leading-tight text-ink">{name}</span>
      <div className="flex items-center gap-1">
        <i className="h-2 w-2 rounded-full" style={{ background: color }} />
        <span className="text-[9px] uppercase tracking-wider text-ink-3">
          {season === 'perennial' ? 'ley' : season}
        </span>
      </div>
      {water !== undefined && water > 0 && (
        <span className="data-tabular text-[9px] text-water">~{water}mm</span>
      )}
    </div>
  )
}
