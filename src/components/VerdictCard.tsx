import { AlertTriangle, CheckCircle2, MoveRight, ShieldAlert, Sparkles } from 'lucide-react'
import type { Verdict } from '../lib/scoring'
import { verdictSentence } from '../lib/diagnosis'
import type { DailyTrend } from '../lib/types'
import { Chip, DiagnosticCard } from './ui'

// ---------------------------------------------------------------------------
// Card 1 — the top verdict: Keep / Adapt / Shift, in one glance.
// ---------------------------------------------------------------------------

const LEVEL_STYLE = {
  keep: {
    ring: 'border-leaf',
    bg: 'bg-leaf',
    softBg: 'bg-leaf/10',
    border: 'border-leaf/40',
    icon: CheckCircle2,
    iconColor: 'text-leaf',
    label: 'KEEP',
    tag: 'Still a good fit',
  },
  adapt: {
    ring: 'border-ochre',
    bg: 'bg-ochre',
    softBg: 'bg-ochre/10',
    border: 'border-ochre/40',
    icon: AlertTriangle,
    iconColor: 'text-ochre',
    label: 'ADAPT',
    tag: 'Workable, but tightening',
  },
  shift: {
    ring: 'border-clay',
    bg: 'bg-clay',
    softBg: 'bg-clay/10',
    border: 'border-clay/40',
    icon: ShieldAlert,
    iconColor: 'text-clay',
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
  const s = LEVEL_STYLE[verdict.level]
  const Icon = s.icon
  const summary = verdictSentence(verdict, trend, verdict.dominantCrop.toLowerCase())

  return (
    <DiagnosticCard
      id="verdict"
      step="1"
      title="The verdict for this field"
      sub="One answer first — then the details that justify it."
      icon={<Sparkles className="h-5 w-5 text-ochre" />}
    >
      <div className="grid gap-6 lg:grid-cols-[230px_1fr] lg:items-start">
        {/* Score badge */}
        <div className="flex flex-col items-center">
          <div
            className={`flex w-full flex-col items-center rounded-2xl border-4 ${s.ring} ${s.softBg} px-4 py-6`}
          >
            <span className="data-tabular font-display text-6xl font-semibold leading-none text-ink">
              {verdict.score}
              <span className="text-2xl text-ink-3">%</span>
            </span>
            <span className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-3">
              Crop suitability
            </span>
            <span
              className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold tracking-widest text-white ${s.bg}`}
            >
              <Icon className="h-3.5 w-3.5" />
              {s.label}
            </span>
          </div>
          <p className="mt-2 text-center text-[11px] leading-snug text-ink-3">
            {s.tag} · <span className="font-medium text-ink-2">{verdict.dominantCrop}</span>
          </p>
        </div>

        {/* Headline + summary + drivers */}
        <div>
          <h3 className="font-display text-2xl font-semibold leading-tight text-ink sm:text-[28px]">
            {verdict.headline}
          </h3>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-2">{summary}</p>

          {verdict.trendNote && (
            <p className="mt-3 flex max-w-2xl items-start gap-2 rounded-xl bg-panel/90 px-3.5 py-2.5 text-[12px] leading-snug text-panel-text">
              <MoveRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-leaf-3" />
              {verdict.trendNote}
            </p>
          )}

          <div className="mt-4">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-3">
              What drove the score
            </p>
            <div className="flex flex-wrap gap-2">
              {verdict.drivers.map((d) => (
                <Chip key={d.label} tone={d.score < 50 ? 'clay' : d.score < 70 ? 'ochre' : 'leaf'}>
                  {d.label} · {d.score}
                </Chip>
              ))}
            </div>
          </div>

          <p className="mt-4 text-[11px] leading-snug text-ink-3">
            The score weighs water balance, climate fit, soil health, erosion risk, income and forage
            against the priorities you set. It supports your judgement — it never replaces it.
          </p>
        </div>
      </div>
    </DiagnosticCard>
  )
}
