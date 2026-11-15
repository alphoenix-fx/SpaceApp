import { useEffect, useState, type ReactNode } from 'react';

// ---------------------------------------------------------------------------
// Shared UI primitives — Exact ExtraUI "Planetary Innovation Agency" theme:
// Poppins typography, IBM Plex Mono data, emerald primary (#16A34A),
// white cards with slate-100 hairline borders, slate-900 map/search darks.
// ---------------------------------------------------------------------------

export function Chip({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: 'neutral' | 'emerald' | 'forest' | 'amber' | 'rose' | 'cyan' | 'slate'
}) {
  const tones: Record<string, string> = {
    neutral: 'bg-slate-100 text-ink-2 border border-slate-200',
    emerald: 'bg-emerald-soft text-emerald-600 border border-emerald-200',
    forest: 'bg-emerald/10 text-forest-emerald border border-emerald/20',
    amber: 'bg-amber-soft text-amber-700 border border-amber-200',
    rose: 'bg-rose-soft text-rose-600 border border-rose-200',
    cyan: 'bg-cyan-soft text-cyan-600 border border-cyan-200',
    slate: 'bg-slate-900 text-white border border-slate-800',
  }
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${tones[tone]}`}
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
  const color = score >= 70 ? 'var(--color-verdict-keep)' : score >= 50 ? 'var(--color-verdict-adapt)' : 'var(--color-verdict-shift)'
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-slate-100)" strokeWidth="5" />
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
        <span className="data-tabular text-sm font-bold text-ink">{score}</span>
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
    score >= 70 ? 'var(--color-verdict-keep)' : score >= 50 ? 'var(--color-verdict-adapt)' : 'var(--color-verdict-shift)'
  return (
    <div className="group">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-ink-2">{label}</span>
        <span className="data-tabular text-xs font-bold text-ink">{score}</span>
      </div>
      <div className="scorebar h-2">
        <i style={{ width: `${w}%`, background: color }} />
      </div>
      {detail && (
        <p className="mt-1 hidden text-[10px] leading-snug text-ink-3 group-hover:block group-focus-within:block">
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
    <div className="mb-6 flex items-start gap-4">
      <span className="data-tabular mt-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-emerald-200 bg-white px-2 text-xs font-bold text-emerald-600">
        {index}
      </span>
      <div>
        <h2 className="font-display text-xl font-bold tracking-tight text-ink sm:text-2xl">{title}</h2>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-2">{sub}</p>
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
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label htmlFor={`priority-${slug}`} className="flex items-center gap-2 text-sm font-medium text-ink-2">
          {icon}
          {label}
        </label>
        <span className="data-tabular text-xs font-bold text-emerald-600">{value}</span>
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
      {hint && <p className="text-[10px] leading-snug text-ink-3">{hint}</p>}
    </div>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-slate-100 bg-white shadow-card ${className}`}>
      {children}
    </div>
  )
}

/**
 * Shell for diagnostic cards: white surface, rounded-2xl, hairline border,
 * numbered step badge, title header.
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
      <div className="rise rounded-2xl border border-slate-100 bg-white p-5 shadow-card sm:p-6">
        <header className="mb-5 flex items-start gap-3">
          <span className="data-tabular mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-emerald-200 bg-emerald-soft text-xs font-bold text-emerald-600">
            {step}
          </span>
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 font-display text-base font-bold tracking-tight text-ink sm:text-lg">
              {icon}
              {title}
            </h2>
            {sub && <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-ink-2">{sub}</p>}
          </div>
        </header>
        {children}
      </div>
    </section>
  )
}

/** A clean labelled gauge used by the live-conditions card. */
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
  tone: 'emerald' | 'amber' | 'rose' | 'cyan' | 'slate'
  value: string
  scale?: { pct: number; caption: string }
  tip: string
  source?: string
}) {
  const color =
    tone === 'emerald'
      ? 'var(--color-verdict-keep)'
      : tone === 'amber'
        ? 'var(--color-verdict-adapt)'
        : tone === 'rose'
          ? 'var(--color-verdict-shift)'
          : tone === 'cyan'
            ? 'var(--color-status-cyan)'
            : 'var(--color-ink)'
  return (
    <div className="flex h-full flex-col rounded-xl border border-slate-100 bg-white p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-3">{label}</p>
      <p className="mt-1 font-display text-xl font-bold leading-tight {tone === 'emerald' ? 'text-emerald-600' : tone === 'amber' ? 'text-amber-700' : tone === 'rose' ? 'text-rose-600' : tone === 'cyan' ? 'text-cyan-600' : 'text-ink'}">{state}</p>
      <p className="data-tabular mt-0.5 text-xs font-bold text-ink">{value}</p>
      {scale && (
        <div className="mt-3">
          <div className="scorebar h-2">
            <i style={{ width: `${Math.max(2, Math.min(100, scale.pct))}%`, background: color }} />
          </div>
          <p className="mt-1 text-[9px] uppercase tracking-wider text-ink-3">{scale.caption}</p>
        </div>
      )}
      <p className="mt-3 flex-1 text-[11px] leading-snug text-ink-2">{tip}</p>
      {source && <p className="mt-2 text-[9px] leading-tight text-ink-3">{source}</p>}
    </div>
  )
}

export const FAMILY_COLOR: Record<string, string> = {
  grass: 'var(--color-verdict-keep)',
  legume: 'var(--color-verdict-adapt)',
  brassica: 'var(--color-verdict-shift)',
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
    <div className="flex min-w-[104px] flex-col items-center gap-1 rounded-xl border border-slate-100 bg-white px-2 py-1.5 text-center shadow-sm">
      <span className="text-[11px] font-bold leading-tight text-ink">{name}</span>
      <div className="flex items-center gap-1">
        <i className="h-2 w-2 rounded-full" style={{ background: color }} />
        <span className="text-[9px] uppercase tracking-wider text-ink-3">
          {season === 'perennial' ? 'ley' : season}
        </span>
      </div>
      {water !== undefined && water > 0 && (
        <span className="data-tabular text-[9px] text-cyan-600">~{water}mm</span>
      )}
    </div>
  )
}
