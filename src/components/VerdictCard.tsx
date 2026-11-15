import { AlertTriangle, CheckCircle2, MoveRight, ShieldAlert, Sparkles } from 'lucide-react'
import type { Verdict } from '../lib/scoring'
import { verdictSentence } from '../lib/diagnosis'
import type { DailyTrend } from '../lib/types'
import { Chip, DiagnosticCard } from './ui'

// ---------------------------------------------------------------------------
// Card 1 — the top verdict: Keep / Adapt / Shift, in one glance.
// ExtraUI theme: white card, emerald primary, semantic status accents.
// ---------------------------------------------------------------------------

const LEVEL_STYLE: Record<
  'keep' | 'adapt' | 'shift',
  {
    ring: string
    bg: string
    softBg: string
    border: string
    icon: React.ComponentType<{ className?: string }>
    iconColor: string
    label: string
    tag: string
  }
> = {
  keep: {
    ring: 'border-emerald-500',
    bg: 'bg-emerald-600',
    softBg: 'bg-emerald-soft',
    border: 'border-emerald-200',
    icon: CheckCircle2,
    iconColor: 'text-white',
    label: 'KEEP',
    tag: 'Still a good fit',
  },
  adapt: {
    ring: 'border-amber-500',
    bg: 'bg-amber-600',
    softBg: 'bg-amber-soft',
    border: 'border-amber-200',
    icon: AlertTriangle,
    iconColor: 'text-white',
    label: 'ADAPT',
    tag: 'Workable, but tightening',
  },
  shift: {
    ring: 'border-rose-500',
    bg: 'bg-rose-600',
    softBg: 'bg-rose-soft',
    border: 'border-rose-200',
    icon: ShieldAlert,
    iconColor: 'text-white',
    label: 'SHIFT',
    tag: 'Time to change plan',
  },
}

/**
 * One plain-English sentence that says what changed and what it means for
 * the crop the farmer is growing right now.
 */
export default function VerdictCard({
  verdict,
  trend,
}: {
  verdict: Verdict
  trend?: DailyTrend
}) {
  const s = LEVEL_STYLE[verdict.level as keyof typeof LEVEL_STYLE]
  const Icon = s.icon
  const summary = verdictSentence(verdict, trend, verdict.dominantCrop.toLowerCase())

  return (
    <DiagnosticCard
      id="verdict"
      step="1"
      title="The verdict for this field"
      sub="One answer first — then the details that justify it."
      icon={<Sparkles className="h-4 w-4 text-amber-600" />}
    >
      <div className="grid gap-5 lg:grid-cols-[200px_1fr] lg:items-start">
        {/* Score badge */}
        <div className="flex flex-col items-center">
          <div
            className={`flex w-full flex-col items-center rounded-2xl border-4 ${s.ring} ${s.softBg} px-4 py-5`}
          >
            <span className="data-tabular font-display text-5xl font-bold leading-none text-ink">
              {verdict.score}
              <span className="text-xl text-ink-3">%</span>
            </span>
            <span className="mt-1 text-[9px] font-semibold uppercase tracking-wider text-ink-3">
              Crop suitability
            </span>
            <span
              className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-bold tracking-widest text-white ${s.bg}`}
            >
              <Icon className="h-3 w-3" />
              {s.label}
            </span>
          </div>
          <p className="mt-2 text-center text-[10px] leading-snug text-ink-3">
            {s.tag} · <span className="font-semibold text-ink-2">{verdict.dominantCrop}</span>
          </p>
        </div>

        {/* Headline + summary + drivers */}
        <div>
          <h3 className="font-display text-xl font-bold leading-tight text-ink">{verdict.headline}</h3>
          <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-ink-2">{summary}</p>

          {verdict.trendNote && (
            <p className="mt-3 flex max-w-2xl items-start gap-2 rounded-xl border border-emerald-100 bg-emerald-soft px-3 py-2 text-[11px] leading-snug text-emerald-700">
              <MoveRight className="mt-0.5 h-3 w-3 shrink-0 text-emerald-600" />
              {verdict.trendNote}
            </p>
          )}

          <div className="mt-4">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-ink-3">
              What drove the score
            </p>
            <div className="flex flex-wrap gap-2">
              {verdict.drivers.map((d) => (
                <Chip
                  key={d.label}
                  tone={d.score < 50 ? 'rose' : d.score < 70 ? 'amber' : 'emerald'}
                >
                  {d.label} · {d.score}
                </Chip>
              ))}
            </div>
          </div>

          <p className="mt-3 text-[10px] leading-snug text-ink-3">
            The score weighs water balance, climate fit, soil health, erosion risk, income and forage
            against the priorities you set. It supports your judgement — it never replaces it.
          </p>
        </div>
      </div>
    </DiagnosticCard>
  )
}
