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
      <div className="grid gap-4 @md:grid-cols-[190px_1fr] @md:items-start">
        {/* Score badge */}
        <div className="flex flex-col items-center">
          <div
            className={`flex w-full flex-col items-center rounded-2xl border-4 ${s.ring} ${s.softBg} px-4 py-5`}
          >
            <span className="data-tabular text-5xl font-bold leading-none text-slate-900">
              {verdict.score}
              <span className="text-xl text-slate-400">%</span>
            </span>
            <span className="mt-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Crop suitability
            </span>
            <span
              className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-white ${s.bg}`}
            >
              <Icon className="h-3 w-3" />
              {s.label}
            </span>
          </div>
          <p className="mt-2 text-center text-[11px] leading-snug text-slate-500">
            {s.tag} · <span className="font-semibold text-slate-700">{verdict.dominantCrop}</span>
          </p>
        </div>

        {/* Headline + summary + drivers */}
        <div>
          <h3 className="text-base font-bold leading-snug text-slate-900">{verdict.headline}</h3>
          <p className="mt-2 text-xs leading-relaxed text-slate-600">{summary}</p>

          {verdict.trendNote && (
            <p className="mt-2.5 flex items-start gap-1.5 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-[11px] leading-snug text-[#15803D]">
              <MoveRight className="mt-0.5 h-3 w-3 shrink-0" />
              {verdict.trendNote}
            </p>
          )}

          <div className="mt-3">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              What drove the score
            </p>
            <div className="flex flex-wrap gap-1.5">
              {verdict.drivers.map((d) => (
                <Chip key={d.label} tone={d.score < 50 ? 'clay' : d.score < 70 ? 'ochre' : 'leaf'}>
                  {d.label} · {d.score}
                </Chip>
              ))}
            </div>
          </div>

          <p className="mt-3 text-[10px] leading-snug text-slate-400">
            The score weighs water balance, climate fit, soil health, erosion risk, income and forage
            against the priorities you set. It supports your judgement — it never replaces it.
          </p>
        </div>
      </div>
    </DiagnosticCard>
  )
}
