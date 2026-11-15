import { useEffect, useState } from 'react'
import { MoveRight, MapPin } from 'lucide-react'
import { PRESETS } from '../lib/regions'
import { cachedPresetClimates, fetchPresetClimates } from '../lib/power'
import { cropById } from '../lib/crops'
import { cropViability, type AnalysisContext } from '../lib/scoring'
import type { ClimateFeatures } from '../lib/types'
import { Chip, SectionHead } from './ui'

// ---------------------------------------------------------------------------
// Field-Shift Explorer — "if the climate here no longer suits this crop,
// where in South Africa still does?" Compares single-crop viability for the
// user's dominant crop across the demo regions using NASA POWER climatology.
// ---------------------------------------------------------------------------

interface Row {
  id: string
  name: string
  blurb: string
  score: number
  isHome: boolean
  lat: number
  lon: number
  aridity: number
  seasonRain: number
}

interface Props {
  ctx: AnalysisContext
  dominantCropId: string | null
}

export default function ShiftExplorer({ ctx, dominantCropId }: Props) {
  const [ready, setReady] = useState(cachedPresetClimates().length === PRESETS.length)

  useEffect(() => {
    if (ready) return
    let alive = true
    fetchPresetClimates().then(() => alive && setReady(true))
    return () => {
      alive = false
    }
  }, [ready])

  const crop = dominantCropId ? cropById(dominantCropId) : null
  if (!crop) return null

  const rows: Row[] = ready
    ? [
        {
          id: 'home',
          name: 'Your field',
          blurb: 'where the pin is now',
          score: cropViability(dominantCropId!, ctx, undefined),
          isHome: true,
          lat: ctx.climate.lat,
          lon: ctx.climate.lon,
          aridity: ctx.climate.aridityIndex,
          seasonRain: seasonRainFor(crop.season, ctx.climate),
        },
        ...cachedPresetClimates().map(({ presetId, climate }) => {
          const preset = PRESETS.find((p) => p.id === presetId)!
          const altCtx: AnalysisContext = { ...ctx, climate, regime: preset.regime }
          return {
            id: presetId,
            name: preset.name,
            blurb: preset.blurb,
            score: cropViability(dominantCropId!, altCtx, undefined),
            isHome: false,
            lat: preset.lat,
            lon: preset.lon,
            aridity: climate.aridityIndex,
            seasonRain: seasonRainFor(crop.season, climate),
          }
        }),
      ].sort((a, b) => b.score - a.score)
    : []

  const best = rows[0]
  const homeRow = rows.find((r) => r.isHome)

  return (
    <section id="shift" className="scroll-mt-24">
      <SectionHead
        index="07"
        title="Shift: could another region grow it better?"
        sub={`The "Field Shift" question. We test ${crop.name} against the climates of South Africa's other production regions using NASA POWER climatology — the same crop, different ground.`}
      />

      <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
        {!ready ? (
          <div className="relative overflow-hidden py-8 text-center">
            <div className="sweep pointer-events-none absolute inset-0 opacity-40 bg-emerald-500" />
            <p className="data-tabular text-[10px] text-ink-3">Scanning regional climates…</p>
          </div>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
              <span className="font-bold text-ink">{crop.name}</span>
              <span className="text-ink-2">ranks best in</span>
              <Chip tone="emerald">
                <MapPin className="h-2.5 w-2.5" /> {best.name}
              </Chip>
              {best.isHome ? (
                <span className="text-[10px] text-ink-2">— right where you are.</span>
              ) : (
                <span className="flex items-center gap-1 text-[10px] text-ink-2">
                  (+{best.score - (homeRow?.score ?? 0)} points vs your field
                  <MoveRight className="h-2.5 w-2.5" />)
                </span>
              )}
            </div>
            <div className="space-y-2">
              {rows.map((r) => (
                <div
                  key={r.id}
                  className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 ${
                    r.isHome ? 'border-emerald-200 bg-emerald-soft' : 'border-slate-100 bg-white'
                  }`}
                >
                  <span
                    className={`data-tabular w-9 text-right text-[10px] font-bold ${
                      r.score >= 62 ? 'text-emerald-700' : r.score >= 44 ? 'text-amber-700' : 'text-rose-700'
                    }`}
                  >
                    {r.score}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-ink">
                      {r.name}
                      {r.isHome && <span className="ml-1.5 text-[9px] font-bold text-emerald-700">YOU</span>}
                    </p>
                    <p className="truncate text-[9px] text-ink-2">
                      aridity {r.aridity.toFixed(2)} · {Math.round(r.seasonRain)} mm rain in-season · {r.lat.toFixed(1)}°S{' '}
                      {r.lon.toFixed(1)}°E
                    </p>
                  </div>
                  <div className="scorebar hidden h-1.5 w-28 sm:block">
                    <i
                      style={{ width: `${r.score}%`, background: barColor(r.score) }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[10px] leading-snug text-ink-2">
              Viability here is a first-pass screen (water balance + temperature/frost fit). A real move involves land
              price, water rights, soils, markets and distance to packhouses — decisions for you and your agronomist,
              not satellites.
            </p>
          </>
        )}
      </div>
    </section>
  )
}

function seasonRainFor(season: 'summer' | 'winter' | 'perennial', climate: ClimateFeatures): number {
  const w =
    season === 'summer'
      ? [9, 10, 11, 0, 1, 2]
      : season === 'winter'
        ? [3, 4, 5, 6, 7, 8]
        : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
  return w.reduce((a, m) => a + climate.monthly.P[m], 0)
}

function barColor(v: number): string {
  return v >= 70 ? 'var(--color-verdict-keep)' : v >= 50 ? 'var(--color-verdict-adapt)' : 'var(--color-verdict-shift)'
}
