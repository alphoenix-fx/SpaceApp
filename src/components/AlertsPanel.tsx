import { CalendarClock, Droplet, Flame, Scissors, Snowflake, Tractor, Waves } from 'lucide-react'
import type { FarmAlert } from '../lib/alerts'
import { MONTH_LABELS } from '../lib/power'
import { Chip, SectionHead } from './ui'

// ---------------------------------------------------------------------------
// Micro-management playbook — practical, dated actions from NASA data.
// ---------------------------------------------------------------------------

const KIND_ICON = {
  plant: Tractor,
  irrigate: Droplet,
  harvest: Scissors,
  heat: Flame,
  frost: Snowflake,
  storm: Waves,
}

const SEVERITY_STYLE: Record<
  FarmAlert['severity'],
  { border: string; chip: 'emerald' | 'amber' | 'rose'; label: string }
> = {
  action: { border: 'border-l-rose-500', chip: 'rose', label: 'Do now / plan for it' },
  watch: { border: 'border-l-amber-500', chip: 'amber', label: 'Watch closely' },
  info: { border: 'border-l-emerald-500', chip: 'emerald', label: 'Good to know' },
}

interface Props {
  alerts: FarmAlert[]
}

export default function AlertsPanel({ alerts }: Props) {
  return (
    <section id="playbook" className="scroll-mt-24">
      <SectionHead
        index="06"
        title="This season's playbook"
        sub="Practical micro-management: when to plant, when the irrigation pressure peaks, when to harvest — derived from NASA climatology and the most recent observed days at your pin."
      />
      <div className="grid gap-3 md:grid-cols-2">
        {alerts.map((a, i) => {
          const Icon = KIND_ICON[a.kind]
          const st = SEVERITY_STYLE[a.severity]
          return (
            <article
              key={a.id}
              className={`rise rounded-xl border border-slate-100 border-l-4 bg-white p-3.5 shadow-sm ${st.border}`}
              style={{ animationDelay: `${i * 70}ms` }}
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <h3 className="flex items-center gap-1.5 text-sm font-bold text-ink">
                  <Icon className="h-3.5 w-3.5 shrink-0 text-ink-2" />
                  {a.title}
                </h3>
                <Chip tone={st.chip}>{st.label}</Chip>
              </div>
              <p className="text-[10px] leading-relaxed text-ink-2">{a.body}</p>
              {a.months.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {a.months.map((m) => (
                    <span
                      key={m}
                      className="data-tabular rounded-md border border-slate-100 bg-white px-1.5 py-0.5 text-[9px] font-bold text-ink-2"
                    >
                      {MONTH_LABELS[m]}
                    </span>
                  ))}
                </div>
              )}
            </article>
          )
        })}
      </div>
      <p className="mt-3 flex items-start gap-1.5 rounded-xl border border-emerald-100 bg-emerald-soft px-3 py-2 text-[10px] leading-snug text-emerald-700">
        <CalendarClock className="mt-0.5 h-3 w-3 shrink-0" />
        Observed values come from NASA POWER's most recent daily pass (typically 5–8 days behind today);
        forward-looking windows are long-term climatology — your local forecast and scouting always take precedence.
      </p>
    </section>
  )
}
