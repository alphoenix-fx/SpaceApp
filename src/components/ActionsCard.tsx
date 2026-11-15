import { ArrowRight, CalendarClock, Leaf, Repeat } from 'lucide-react'
import type { FarmAlert } from '../lib/alerts'
import {
  rankAlternatives,
  suggestTwoSeasonPlan,
  type AnalysisContext,
  type CropAlternative,
} from '../lib/scoring'
import type { DailyTrend, Priorities } from '../lib/types'
import { DiagnosticCard } from './ui'

// ---------------------------------------------------------------------------
// Card 3 — What, where and when: the actions a farmer can actually take.
// ExtraUI theme: white card, emerald accents, semantic status colors.
// ---------------------------------------------------------------------------

function scoreTone(score: number): 'emerald' | 'amber' | 'rose' {
  if (score >= 70) return 'emerald'
  if (score >= 50) return 'amber'
  return 'rose'
}

function barColor(score: number): string {
  if (score >= 70) return 'var(--color-verdict-keep)'
  if (score >= 50) return 'var(--color-verdict-adapt)'
  return 'var(--color-verdict-shift)'
}

// Photographs shipped with the app (public/images). Crops without a photo
// render a leaf tile instead — no broken-image states.
const CROP_PHOTOS: Record<string, string> = {
  maize: '/images/crop-maize.jpg',
  sorghum: '/images/crop-sorghum.jpg',
  wheat: '/images/crop-wheat.jpg',
  sunflower: '/images/crop-sunflower.jpg',
  sugarcane: '/images/crop-sugarcane.jpg',
}

function CropThumb({ id, name }: { id: string; name: string }) {
  const src = CROP_PHOTOS[id]
  if (!src) {
    return (
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-slate-100 bg-emerald-soft">
        <Leaf className="h-5 w-5 text-emerald-600" />
      </span>
    )
  }
  return (
    <img
      src={src}
      alt={name}
      loading="lazy"
      width={48}
      height={48}
      className="h-12 w-12 shrink-0 rounded-xl border border-slate-100 object-cover shadow-sm"
    />
  )
}

function AltRow({ alt }: { alt: CropAlternative }) {
  return (
    <li className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white px-3.5 py-3 shadow-sm">
      <CropThumb id={alt.crop.id} name={alt.crop.name} />
      <div className="min-w-0 flex-1">
        <p className="flex items-baseline gap-2">
          <span className="text-sm font-bold text-ink">{alt.crop.name}</span>
          <span className={`data-tabular text-sm font-bold ${scoreTone(alt.score) === 'emerald' ? 'text-emerald-600' : scoreTone(alt.score) === 'amber' ? 'text-amber-700' : 'text-rose-600'}`}>
            {alt.score}% match
          </span>
        </p>
        <p className="mt-0.5 text-[11px] leading-snug text-ink-2">{alt.reason}</p>
        <p className="mt-1 text-[9px] leading-snug text-ink-3">{alt.crop.notes}</p>
      </div>
      <div className="hidden w-16 shrink-0 sm:block">
        <div className="scorebar h-2">
          <i style={{ width: `${alt.score}%`, background: barColor(alt.score) }} />
        </div>
      </div>
    </li>
  )
}

export default function ActionsCard({
  ctx,
  trend,
  rotation,
  alerts,
  priorities,
}: {
  ctx: AnalysisContext
  trend?: DailyTrend
  rotation: string[]
  alerts: FarmAlert[]
  priorities: Priorities
}) {
  const alternatives = rankAlternatives(ctx, trend, rotation, 3, priorities)
  const plan = suggestTwoSeasonPlan(ctx, trend, rotation, priorities)

  const plantAlert = alerts.find((a) => a.id === 'plant')
  const irrigateAlert = alerts.find((a) => a.id === 'irrigate')
  const harvestAlert = alerts.find((a) => a.id === 'harvest')
  const onset = trend?.thenNow

  return (
    <DiagnosticCard
      id="actions"
      step="3"
      title="What to do next"
      sub="Concrete options for this land, with the window to act on them."
      icon={<Leaf className="h-4 w-4 text-emerald-600" />}
    >
      <div className="grid gap-5 lg:grid-cols-2">
        {/* What to plant next */}
        <div>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-ink">
            <Leaf className="h-4 w-4 text-emerald-600" />
            What to plant next
          </h3>
          {alternatives.length ? (
            <ul className="space-y-2.5">
              {alternatives.map((alt) => (
                <AltRow key={alt.crop.id} alt={alt} />
              ))}
            </ul>
          ) : (
            <p className="rounded-xl border border-slate-100 bg-emerald-soft px-3.5 py-3 text-[12px] text-emerald-700">
              No alternative crop scores better than your current rotation here — this land still suits
              what you grow. Focus on timing and the rotation notes instead.
            </p>
          )}
          <p className="mt-2 text-[10px] leading-snug text-ink-3">
            Match scores are the same water-and-climate engine used for the verdict, applied to each
            crop on its own. Check local cultivar trials and market prices before switching.
          </p>
        </div>

        <div className="space-y-5">
          {/* Two-season rotation */}
          {plan && (
            <div>
              <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-ink">
                <Repeat className="h-4 w-4 text-amber-600" />
                A simple two-season rotation
              </h3>
              <div className="rounded-xl border border-slate-100 bg-white p-3.5 shadow-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="rounded-lg border border-emerald-100 bg-emerald-soft px-3 py-2">
                    <p className="text-[9px] uppercase tracking-wider text-emerald-600">Season 1</p>
                    <p className="text-sm font-bold text-ink">{plan.season1.crop.name}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-ink-3" />
                  <div className="rounded-lg border border-amber-100 bg-amber-soft px-3 py-2">
                    <p className="text-[9px] uppercase tracking-wider text-amber-700">Season 2</p>
                    <p className="text-sm font-bold text-ink">{plan.season2.crop.name}</p>
                  </div>
                </div>
                <p className="mt-2.5 text-[11px] leading-snug text-ink-2">{plan.rationale}</p>
              </div>
            </div>
          )}

          {/* When to act */}
          <div>
            <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-ink">
              <CalendarClock className="h-4 w-4 text-rose-600" />
              When to act
            </h3>
            <div className="space-y-2">
              {plantAlert && (
                <div className="rounded-xl border border-slate-100 bg-white px-3.5 py-2.5 shadow-sm">
                  <p className="text-[11px] font-bold text-ink">{plantAlert.title}</p>
                  <p className="mt-0.5 text-[11px] leading-snug text-ink-2">{plantAlert.body}</p>
                </div>
              )}
              {onset && onset.onsetShiftDays !== 0 && Math.abs(onset.onsetShiftDays) >= 4 && (
                <div className="rounded-xl border border-rose-100 bg-rose-soft px-3.5 py-2.5">
                  <p className="text-[11px] font-bold text-rose-700">
                    The wet season has moved {Math.abs(Math.round(onset.onsetShiftDays))} days{' '}
                    {onset.onsetShiftDays > 0 ? 'later' : 'earlier'}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-snug text-ink-2">
                    First useful rains used to arrive around {onset.onsetThen ?? 'earlier'}; over the last
                    five seasons they have been closer to {onset.onsetNow ?? 'now'}. Shift your planting
                    date by the same amount rather than by habit.
                  </p>
                </div>
              )}
              {irrigateAlert && (
                <div className="rounded-xl border border-slate-100 bg-white px-3.5 py-2.5 shadow-sm">
                  <p className="text-[11px] font-bold text-ink">{irrigateAlert.title}</p>
                  <p className="mt-0.5 text-[11px] leading-snug text-ink-2">{irrigateAlert.body}</p>
                </div>
              )}
              {harvestAlert && (
                <div className="rounded-xl border border-slate-100 bg-white px-3.5 py-2.5 shadow-sm">
                  <p className="text-[11px] font-bold text-ink">{harvestAlert.title}</p>
                  <p className="mt-0.5 text-[11px] leading-snug text-ink-2">{harvestAlert.body}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </DiagnosticCard>
  )
}
