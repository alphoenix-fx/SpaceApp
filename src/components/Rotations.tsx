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
      <div className="mb-5 rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
        <p className="mb-3 flex items-center gap-2 text-[10px] font-bold text-ink-2">
          <Compass className="h-3 w-3 text-amber-600" /> Ranking for your priorities
        </p>
        <div className="space-y-2">
          {ranked.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2.5">
              <span className="data-tabular w-5 text-right text-[10px] font-bold text-ink-3">{i + 1}</span>
              <span className="w-40 truncate text-xs font-bold text-ink sm:w-56">{s.name}</span>
              <div className="scorebar h-2 flex-1">
                <i style={{ width: `${s.total}%`, background: barColor(s.total) }} />
              </div>
              <span className="data-tabular w-8 text-right text-[10px] font-bold text-ink">{s.total}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        {strategies.map((s) => (
          <StrategyCard key={s.id} s={s} />
        ))}
      </div>
    </section>
  )
}

function barColor(v: number): string {
  return v >= 70 ? 'var(--color-verdict-keep)' : v >= 50 ? 'var(--color-verdict-adapt)' : 'var(--color-verdict-shift)'
}

function StrategyCard({ s }: { s: Strategy }) {
  const [open, setOpen] = useState<'why' | 'evidence' | 'gaps'>('why')

  const crit = [...s.criteria].sort(
    (a, b) => CRITERION_ORDER.indexOf(a.key) - CRITERION_ORDER.indexOf(b.key),
  )

  return (
    <article
      className={`rise flex flex-col rounded-xl border border-slate-100 bg-white p-4 shadow-sm ${
        s.kind === 'current' ? 'border-slate-200' : 'border-emerald-200'
      }`}
    >
      <header className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-1.5">
            {s.kind === 'current' ? (
              <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-white">
                Baseline
              </span>
            ) : (
              <span className="flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-white">
                <Lightbulb className="h-2.5 w-2.5" /> Suggested
              </span>
            )}
          </div>
          <h3 className="font-display text-base font-bold text-ink">{s.name}</h3>
          <p className="mt-0.5 max-w-md text-[10px] leading-snug text-ink-2">{s.tagline}</p>
        </div>
        <ScoreRing score={s.total} size={52} />
      </header>

      {/* sequence */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {s.sequence.map((y) => {
          const c = cropById(y.cropId)
          if (!c) return null
          return <CropChip key={y.year} name={c.name} family={c.family} season={c.season} water={c.waterMm[1]} />
        })}
      </div>

      {/* criteria */}
      <div className="mb-3 grid gap-x-5 gap-y-2 sm:grid-cols-2">
        {crit.map((c) => (
          <ScoreBar key={c.key} score={c.score} label={c.label} detail={c.detail} />
        ))}
      </div>

      {/* explainer tabs */}
      <div className="mt-auto rounded-xl border border-slate-100 bg-white">
        <div className="flex border-b border-slate-100">
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
              className={`flex flex-1 items-center justify-center gap-1 px-2 py-2 text-[10px] font-bold transition ${
                open === k ? 'text-emerald-600 border-b-2 border-emerald-600' : 'text-ink-3 hover:text-emerald-700'
              }`}
            >
              <Icon className="h-2.5 w-2.5" /> {label}
            </button>
          ))}
        </div>
        <div className="max-h-44 overflow-y-auto px-3 py-2.5 thin-scroll">
          {open === 'why' && <p className="text-[10px] leading-relaxed text-ink-2">{s.why}</p>}
          {open === 'evidence' && (
            <ul className="space-y-1.5">
              {s.evidence.map((e, i) => (
                <li key={i} className="flex gap-1 text-[10px] leading-snug text-ink-2">
                  <Database className="mt-0.5 h-2.5 w-2.5 shrink-0 text-cyan-600" />
                  {e}
                </li>
              ))}
            </ul>
          )}
          {open === 'gaps' && (
            <div className="space-y-2">
              <div>
                <p className="mb-1 flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-ink-3">
                  <BookOpen className="h-2.5 w-2.5" /> Information gaps
                </p>
                <ul className="space-y-1">
                  {s.gaps.map((g, i) => (
                    <li key={i} className="text-[10px] leading-snug text-ink-2">· {g}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="mb-1 flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-ink-3">
                  <AlertTriangle className="h-2.5 w-2.5" /> Risks to review locally
                </p>
                <ul className="space-y-1">
                  {s.risks.map((r, i) => (
                    <li key={i} className="text-[10px] leading-snug text-ink-2">· {r}</li>
                  ))}
                </ul>
              </div>
              <p className="flex items-start gap-1.5 rounded-lg border border-emerald-100 bg-emerald-soft px-2.5 py-2 text-[9px] leading-snug text-emerald-700">
                <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0" />
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
    <div className="mt-5 flex flex-wrap items-center gap-2 rounded-xl border border-slate-100 bg-white px-3 py-2.5 shadow-sm">
      <Sprout className="h-3 w-3 text-emerald-600" />
      <span className="text-[9px] text-ink-3">
        Scores blend water fit, soil health, erosion, pest breaks, climate fit, income and forage — weighted by the
        priorities you set in step 02.
      </span>
      <ChevronDown className="h-2.5 w-2.5 text-ink-3" />
    </div>
  )
}
