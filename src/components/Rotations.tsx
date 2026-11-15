import { useState } from 'react'
import { AlertTriangle, BookOpen, ChevronDown, Compass, Database, Lightbulb, ShieldCheck, Sprout } from 'lucide-react'
import { cropById } from '../lib/crops'
import type { Strategy } from '../lib/types'
import { CropChip, ScoreBar, ScoreRing, SectionHead } from './ui'

interface Props {
  strategies: Strategy[]
}

const CRITERION_ORDER = ['water', 'soilHealth', 'erosion', 'pestCycle', 'climateFit', 'income', 'forage']

export default function Rotations({ strategies }: Props) {
  const ranked = [...strategies].sort((a, b) => b.total - a.total)

  return (
    <section id="rotations" className="scroll-mt-24">
      <SectionHead
        index="05"
        title="Adapt it: rotation strategies, side by side"
        sub="Your current rotation scored against alternatives the engine suggests from the data — re-ranked live by your priorities. Each card explains why it was suggested, what evidence backs it, where the gaps are, and what needs local review."
      />

      {/* Ranking strip */}
      <div className="mb-6 rounded-2xl border border-paper-3 bg-white/60 p-4 shadow-card">
        <p className="mb-3 flex items-center gap-2 text-xs font-semibold text-ink-2">
          <Compass className="h-3.5 w-3.5 text-ochre" /> Ranking for your priorities
        </p>
        <div className="space-y-2.5">
          {ranked.map((s, i) => (
            <div key={s.id} className="flex items-center gap-3">
              <span className="data-tabular w-5 text-right text-xs font-bold text-ink-3">{i + 1}</span>
              <span className="w-40 truncate text-xs font-semibold text-ink sm:w-56">{s.name}</span>
              <div className="scorebar h-2.5 flex-1">
                <i style={{ width: `${s.total}%`, background: barColor(s.total) }} />
              </div>
              <span className="data-tabular w-8 text-right text-xs font-bold text-ink">{s.total}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {strategies.map((s) => (
          <StrategyCard key={s.id} s={s} />
        ))}
      </div>
    </section>
  )
}

function barColor(v: number) {
  return v >= 70 ? 'var(--color-leaf)' : v >= 50 ? 'var(--color-ochre)' : 'var(--color-clay)'
}

function StrategyCard({ s }: { s: Strategy }) {
  const [open, setOpen] = useState<'why' | 'evidence' | 'gaps'>('why')

  const crit = [...s.criteria].sort(
    (a, b) => CRITERION_ORDER.indexOf(a.key) - CRITERION_ORDER.indexOf(b.key),
  )

  return (
    <article
      className={`rise flex flex-col rounded-2xl border p-5 shadow-card ${
        s.kind === 'current' ? 'border-ink/25 bg-white/75' : 'border-leaf/40 bg-white/75'
      }`}
    >
      <header className="mb-4 flex items-start justify-between gap-4">
        <div>
          <div className="mb-1.5 flex items-center gap-2">
            {s.kind === 'current' ? (
              <span className="rounded-full bg-ink px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-paper">
                Baseline
              </span>
            ) : (
              <span className="flex items-center gap-1 rounded-full bg-leaf px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white">
                <Lightbulb className="h-3 w-3" /> Suggested
              </span>
            )}
          </div>
          <h3 className="font-display text-xl font-semibold text-ink">{s.name}</h3>
          <p className="mt-0.5 max-w-md text-xs leading-snug text-ink-3">{s.tagline}</p>
        </div>
        <ScoreRing score={s.total} size={62} />
      </header>

      {/* sequence */}
      <div className="mb-4 flex flex-wrap gap-2">
        {s.sequence.map((y) => {
          const c = cropById(y.cropId)
          if (!c) return null
          return <CropChip key={y.year} name={c.name} family={c.family} season={c.season} water={c.waterMm[1]} />
        })}
      </div>

      {/* criteria */}
      <div className="mb-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {crit.map((c) => (
          <ScoreBar key={c.key} score={c.score} label={c.label} detail={c.detail} />
        ))}
      </div>

      {/* explainer tabs */}
      <div className="mt-auto rounded-xl border border-paper-3 bg-paper-2/60">
        <div className="flex border-b border-paper-3">
          {(
            [
              ['why', 'Why this?', Lightbulb],
              ['evidence', 'Evidence', Database],
              ['gaps', 'Gaps & risks', AlertTriangle],
            ] as const
          ).map(([k, label, Icon]) => (
            <button
              key={k}
              onClick={() => setOpen(k)}
              className={`flex flex-1 items-center justify-center gap-1.5 px-2 py-2 text-[11px] font-semibold transition ${
                open === k ? 'text-leaf-dark' : 'text-ink-3 hover:text-ink'
              }`}
            >
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        </div>
        <div className="max-h-44 overflow-y-auto px-3.5 py-3 thin-scroll">
          {open === 'why' && <p className="text-xs leading-relaxed text-ink-2">{s.why}</p>}
          {open === 'evidence' && (
            <ul className="space-y-1.5">
              {s.evidence.map((e, i) => (
                <li key={i} className="flex gap-1.5 text-[11px] leading-snug text-ink-2">
                  <Database className="mt-0.5 h-3 w-3 shrink-0 text-water" />
                  {e}
                </li>
              ))}
            </ul>
          )}
          {open === 'gaps' && (
            <div className="space-y-2.5">
              <div>
                <p className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-ink-3">
                  <BookOpen className="h-3 w-3" /> Information gaps
                </p>
                <ul className="space-y-1">
                  {s.gaps.map((g, i) => (
                    <li key={i} className="text-[11px] leading-snug text-ink-2">
                      · {g}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-ink-3">
                  <AlertTriangle className="h-3 w-3" /> Risks to review locally
                </p>
                <ul className="space-y-1">
                  {s.risks.map((r, i) => (
                    <li key={i} className="text-[11px] leading-snug text-ink-2">
                      · {r}
                    </li>
                  ))}
                </ul>
              </div>
              <p className="flex items-start gap-1.5 rounded-lg bg-leaf/10 px-2.5 py-2 text-[11px] leading-snug text-leaf-dark">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                This tool supports — never replaces — your judgement and local agricultural expertise. Validate with
                your agronomist before changing hectares.
              </p>
            </div>
          )}
        </div>
      </div>
    </article>
  )
}

export function WaterBalanceStrip({ strategies }: { strategies: Strategy[] }) {
  if (!strategies.length) return null
  return (
    <div className="mt-6 flex flex-wrap items-center gap-2 rounded-2xl border border-paper-3 bg-white/60 px-4 py-3 shadow-card">
      <Sprout className="h-4 w-4 text-leaf" />
      <span className="text-xs text-ink-3">
        Scores blend water fit, soil health, erosion, pest breaks, climate fit, income and forage — weighted by the
        priorities you set in step 02.
      </span>
      <ChevronDown className="h-3.5 w-3.5 text-ink-3" />
    </div>
  )
}
