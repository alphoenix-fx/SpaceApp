import { AlertTriangle, CheckCircle2, MoveRight, ShieldAlert } from 'lucide-react'
import type { Verdict } from '../lib/scoring'
import { Chip, ScoreRing } from './ui'

// ---------------------------------------------------------------------------
// The traffic-light verdict: Keep / Adapt / Shift.
// ---------------------------------------------------------------------------

const LEVEL_STYLE = {
  keep: {
    bg: 'bg-leaf/10 border-leaf/40',
    icon: CheckCircle2,
    iconColor: 'text-leaf',
    chip: 'leaf' as const,
    label: 'KEEP',
    labelLong: 'Keep — conditions still suit this plan',
  },
  adapt: {
    bg: 'bg-ochre/10 border-ochre/40',
    icon: AlertTriangle,
    iconColor: 'text-ochre',
    chip: 'ochre' as const,
    label: 'ADAPT',
    labelLong: 'Adapt — viable, but the pressure is visible',
  },
  shift: {
    bg: 'bg-clay/10 border-clay/40',
    icon: ShieldAlert,
    iconColor: 'text-clay',
    chip: 'clay' as const,
    label: 'SHIFT',
    labelLong: 'Shift — conditions are moving away from this plan',
  },
}

export default function VerdictCard({ verdict }: { verdict: Verdict }) {
  const s = LEVEL_STYLE[verdict.level]
  return (
    <section id="verdict" className="scroll-mt-24">
      <div className={`rise relative overflow-hidden rounded-2xl border ${s.bg} bg-white/70 p-6 shadow-card sm:p-8`}>
        <div className="grid gap-6 sm:grid-cols-[auto_1fr] sm:items-start">
          <div className="flex items-center gap-4">
            <ScoreRing score={verdict.score} size={92} />
            <div className="sm:hidden">
              <TrafficPill level={verdict.level} />
            </div>
          </div>
          <div>
            <div className="mb-2 hidden items-center gap-3 sm:flex">
              <TrafficPill level={verdict.level} />
              <span className="text-xs text-ink-3">viability of your current crop plan</span>
            </div>
            <h3 className="font-display text-2xl font-semibold leading-tight text-ink sm:text-3xl">
              {verdict.headline}
            </h3>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-2">{verdict.body}</p>
            {verdict.trendNote && (
              <p className="mt-3 flex max-w-2xl items-start gap-2 rounded-xl bg-panel/90 px-3.5 py-2.5 text-[12px] leading-snug text-panel-text">
                <MoveRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-leaf-3" />
                {verdict.trendNote}
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              {verdict.drivers.map((d) => (
                <Chip key={d.label} tone={d.score < 50 ? 'clay' : d.score < 70 ? 'ochre' : 'leaf'}>
                  {d.label} · {d.score}
                </Chip>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function TrafficPill({ level }: { level: 'keep' | 'adapt' | 'shift' }) {
  const s = LEVEL_STYLE[level]
  const Icon = s.icon
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold tracking-widest text-white ${
        level === 'keep' ? 'bg-leaf' : level === 'adapt' ? 'bg-ochre' : 'bg-clay'
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {s.label}
    </span>
  )
}
