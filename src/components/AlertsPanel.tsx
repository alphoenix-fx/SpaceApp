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

const SEVERITY_STYLE: Record<FarmAlert['severity'], { border: string; chip: 'clay' | 'ochre' | 'leaf'; label: string }> = {
  action: { border: 'border-l-clay', chip: 'clay', label: 'Do now / plan for it' },
  watch: { border: 'border-l-ochre', chip: 'ochre', label: 'Watch closely' },
  info: { border: 'border-l-water', chip: 'leaf', label: 'Good to know' },
}

export default function AlertsPanel({ alerts }: { alerts: FarmAlert[] }) {
  return (
    <section id="playbook" className="scroll-mt-24">
      <SectionHead
        index="06"
        title="This season’s playbook"
        sub="Practical micro-management: when to plant, when the irrigation pressure peaks, when to harvest — derived from NASA climatology and the most recent observed days at your pin."
      />
      <div className="grid gap-3 @md:grid-cols-2">
        {alerts.map((a, i) => {
          const Icon = KIND_ICON[a.kind]
          const st = SEVERITY_STYLE[a.severity]
          return (
            <article
              key={a.id}
              className={`rise rounded-xl border border-slate-100 border-l-4 bg-white p-4 shadow-card ${st.border}`}
              style={{ animationDelay: `${i * 70}ms` }}
            >
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <Icon className="h-4 w-4 shrink-0 text-ink-2" />
                  {a.title}
                </h3>
                <Chip tone={st.chip}>{st.label}</Chip>
              </div>
              <p className="text-xs leading-relaxed text-ink-2">{a.body}</p>
              {a.months.length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-1">
                  {a.months.map((m) => (
                    <span
                      key={m}
                      className="data-tabular rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-ink-2"
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
      <p className="mt-4 flex items-start gap-2 rounded-xl bg-slate-100 px-3.5 py-2.5 text-[11px] leading-snug text-ink-3">
        <CalendarClock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Observed values come from NASA POWER’s most recent daily pass (typically 5–8 days behind today);
        forward-looking windows are long-term climatology — your local forecast and scouting always take precedence.
      </p>
    </section>
  )
}
