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
// ---------------------------------------------------------------------------

function scoreTone(score: number): string {
  if (score >= 70) return 'text-leaf'
  if (score >= 50) return 'text-ochre'
  return 'text-clay'
}

function barColor(score: number): string {
  if (score >= 70) return 'var(--color-leaf)'
  if (score >= 50) return 'var(--color-ochre)'
  return 'var(--color-clay)'
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
      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-paper-3 bg-leaf/10">
        <Leaf className="h-5 w-5 text-leaf" />
      </span>
    )
  }
  return (
    <img
      src={src}
      alt={name}
      loading="lazy"
      width={56}
      height={56}
      className="h-14 w-14 shrink-0 rounded-2xl border border-paper-3 object-cover shadow-sm"
    />
  )
}

function AltRow({ alt }: { alt: CropAlternative }) {
  return (
    <li className="flex items-center gap-3.5 rounded-xl border border-paper-3 bg-white/70 px-3.5 py-3">
      <CropThumb id={alt.crop.id} name={alt.crop.name} />
      <div className="min-w-0 flex-1">
        <p className="flex items-baseline gap-2">
          <span className="text-sm font-semibold text-ink">{alt.crop.name}</span>
          <span className={`data-tabular text-sm font-bold ${scoreTone(alt.score)}`}>{alt.score}% match</span>
        </p>
        <p className="mt-0.5 text-[12px] leading-snug text-ink-3">{alt.reason}</p>
        <p className="mt-1 text-[11px] leading-snug text-ink-3">{alt.crop.notes}</p>
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
      icon={<Leaf className="h-5 w-5 text-leaf" />}
    >
      <div className="grid gap-6 lg:grid-cols-2">
        {/* What to plant next */}
        <div>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
            <Leaf className="h-4 w-4 text-leaf" />
            What to plant next
          </h3>
          {alternatives.length ? (
            <ul className="space-y-2.5">
              {alternatives.map((alt) => (
                <AltRow key={alt.crop.id} alt={alt} />
              ))}
            </ul>
          ) : (
            <p className="rounded-xl border border-paper-3 bg-white/70 px-3.5 py-3 text-[13px] text-ink-2">
              No alternative crop scores better than your current rotation here — this land still suits
              what you grow. Focus on timing and the rotation notes instead.
            </p>
          )}
          <p className="mt-2 text-[11px] leading-snug text-ink-3">
            Match scores are the same water-and-climate engine used for the verdict, applied to each
            crop on its own. Check local cultivar trials and market prices before switching.
          </p>
        </div>

        <div className="space-y-5">
          {/* Two-season rotation */}
          {plan && (
            <div>
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
                <Repeat className="h-4 w-4 text-ochre" />
                A simple two-season rotation
              </h3>
              <div className="rounded-xl border border-paper-3 bg-white/70 p-3.5">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="rounded-lg border border-leaf/40 bg-leaf/10 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wider text-leaf-dark">Season 1</p>
                    <p className="text-sm font-semibold text-ink">{plan.season1.crop.name}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-ink-3" />
                  <div className="rounded-lg border border-ochre/40 bg-ochre/10 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wider text-ochre">Season 2</p>
                    <p className="text-sm font-semibold text-ink">{plan.season2.crop.name}</p>
                  </div>
                </div>
                <p className="mt-2.5 text-[12px] leading-snug text-ink-2">{plan.rationale}</p>
              </div>
            </div>
          )}

          {/* When to act */}
          <div>
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
              <CalendarClock className="h-4 w-4 text-clay" />
              When to act
            </h3>
            <div className="space-y-2">
              {plantAlert && (
                <div className="rounded-xl border border-paper-3 bg-white/70 px-3.5 py-2.5">
                  <p className="text-[13px] font-semibold text-ink">{plantAlert.title}</p>
                  <p className="mt-0.5 text-[12px] leading-snug text-ink-2">{plantAlert.body}</p>
                </div>
              )}
              {onset && onset.onsetShiftDays !== 0 && Math.abs(onset.onsetShiftDays) >= 4 && (
                <div className="rounded-xl border border-clay/40 bg-clay/10 px-3.5 py-2.5">
                  <p className="text-[13px] font-semibold text-clay">
                    The wet season has moved {Math.abs(Math.round(onset.onsetShiftDays))} days{' '}
                    {onset.onsetShiftDays > 0 ? 'later' : 'earlier'}
                  </p>
                  <p className="mt-0.5 text-[12px] leading-snug text-ink-2">
                    First useful rains used to arrive around {onset.onsetThen ?? 'earlier'}; over the last
                    five seasons they have been closer to {onset.onsetNow ?? 'now'}. Shift your planting
                    date by the same amount rather than by habit.
                  </p>
                </div>
              )}
              {irrigateAlert && (
                <div className="rounded-xl border border-paper-3 bg-white/70 px-3.5 py-2.5">
                  <p className="text-[13px] font-semibold text-ink">{irrigateAlert.title}</p>
                  <p className="mt-0.5 text-[12px] leading-snug text-ink-2">{irrigateAlert.body}</p>
                </div>
              )}
              {harvestAlert && (
                <div className="rounded-xl border border-paper-3 bg-white/70 px-3.5 py-2.5">
                  <p className="text-[13px] font-semibold text-ink">{harvestAlert.title}</p>
                  <p className="mt-0.5 text-[12px] leading-snug text-ink-2">{harvestAlert.body}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </DiagnosticCard>
  )
}
