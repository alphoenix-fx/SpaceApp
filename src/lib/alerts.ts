import { cropById } from './crops'
import type { ClimateFeatures, Crop, DailyTrend, SoilInfo } from './types'
import { MONTH_LABELS } from './power'

// ---------------------------------------------------------------------------
// The season playbook: turns NASA climatology + the most recent observed days
// into practical "when to plant / irrigate / harvest / watch out" guidance.
//
// POWER daily data lags roughly a week (MERRA-2), so "current conditions" are
// labelled as the most recent observed pass, and forward-looking items use
// long-term climatology — always honest about what is observed vs expected.
// ---------------------------------------------------------------------------

export type AlertSeverity = 'action' | 'watch' | 'info'

export interface FarmAlert {
  id: string
  kind: 'plant' | 'irrigate' | 'harvest' | 'heat' | 'frost' | 'storm'
  severity: AlertSeverity
  title: string
  body: string
  months: number[]
}

const monthRange = (start: number, count: number): number[] =>
  Array.from({ length: count }, (_, i) => (start + i) % 12)

const monthNames = (months: number[]): string => {
  if (!months.length) return ''
  const sorted = [...new Set(months)].sort((a, b) => a - b)
  // group into cyclic-consecutive runs: [0,1,2,8,9,10,11] → "Jan–Mar & Sep–Dec"
  const runs: number[][] = []
  for (const m of sorted) {
    const last = runs[runs.length - 1]
    if (last && (m === last[last.length - 1] + 1)) last.push(m)
    else runs.push([m])
  }
  // merge wrap-around (Nov,Dec + Jan) into one run
  if (runs.length > 1 && runs[0][0] === 0 && runs[runs.length - 1][runs[runs.length - 1].length - 1] === 11) {
    const first = runs.shift()!
    runs[runs.length - 1].push(...first)
  }
  return runs.map((r) => (r.length === 1 ? MONTH_LABELS[r[0]] : `${MONTH_LABELS[r[0]]}–${MONTH_LABELS[r[r.length - 1]]}`)).join(' & ')
}

export function buildPlaybook(
  climate: ClimateFeatures,
  dominantCropId: string | null,
  soil: SoilInfo,
  trend?: DailyTrend,
): FarmAlert[] {
  const { monthly, wetMonths } = climate
  const crop: Crop | undefined = dominantCropId ? cropById(dominantCropId) : undefined
  const out: FarmAlert[] = []

  // ---- Planting window -------------------------------------------------
  // Frost end: last month whose nights regularly dip below ~2°C.
  const frostIdx = climate.frostDaysByMonth
    ? climate.frostDaysByMonth.map((d, i) => ({ d, i })).filter((o) => o.d >= 5).map((o) => o.i)
    : monthly.Tmin.map((t, i) => (t < 2 ? i : -1)).filter((i) => i >= 0)
  const frostEnd = frostIdx.length ? Math.max(...frostIdx) : -1
  const scanStart = frostEnd >= 0 ? (frostEnd + 1) % 12 : 0

  // Plant into the onset of the wet season: the earliest of the wettest
  // months that falls after the last frost and has warm enough nights.
  // Fallback: strongest rain-to-demand ratio after frost (semi-arid safety).
  const wetSet = new Set(wetMonths)
  let plantStart = -1
  for (let step = 0; step < 12; step++) {
    const m = (scanStart + step) % 12
    if (wetSet.has(m) && monthly.Tmin[m] > 5) {
      plantStart = m
      break
    }
  }
  if (plantStart < 0) {
    const ratio = monthly.P.map((p, i) => p / Math.max(1, monthly.ET0[i]))
    let bestRatio = 0.3
    for (let step = 0; step < 12; step++) {
      const m = (scanStart + step) % 12
      if (monthly.Tmin[m] > 5 && ratio[m] > bestRatio) {
        plantStart = m
        bestRatio = ratio[m]
      }
    }
  }
  if (plantStart >= 0 && crop && crop.season !== 'perennial') {
    const win = monthRange(plantStart, crop.season === 'summer' ? 2 : 1)
    out.push({
      id: 'plant',
      kind: 'plant',
      severity: 'action',
      title: `Aim to plant ${monthNames(win)}`,
      body: climate.frostMonths
        ? `Frost risk ends around ${MONTH_LABELS[(frostEnd + 1) % 12]} and the rains typically re-establish by ${MONTH_LABELS[win[0]]}. Soil moisture is climbing then — seed planted into a warming, wetting profile establishes fastest.`
        : `Rains typically re-establish by ${MONTH_LABELS[win[0]]} — plant into the wet-up rather than chasing it.`,
      months: win,
    })
  }

  // ---- Irrigation pressure --------------------------------------------
  const deficitMonths = monthly.P.map((p, i) => ({ p, i }))
    .filter(({ p, i }) => p < 0.7 * monthly.ET0[i])
    .map(({ i }) => i)
  const inSeason = crop
    ? deficitMonths.filter((m) => (crop.season === 'winter' ? m >= 3 && m <= 8 : m >= 8 || m <= 2))
    : deficitMonths
  const months = (inSeason.length ? inSeason : deficitMonths.slice(0, 4)).sort((a, b) => a - b)
  if (months.length) {
    const shortfall = Math.round(
      months.reduce((a, m) => a + (monthly.ET0[m] - monthly.P[m]), 0),
    )
    out.push({
      id: 'irrigate',
      kind: 'irrigate',
      severity: soil.irrigated ? 'watch' : 'action',
      title: soil.irrigated
        ? `Peak irrigation: ${monthNames(months)}`
        : `Dry window: ${monthNames(months)}`,
      body: soil.irrigated
        ? `Atmospheric demand beats rainfall by ~${Math.round(
            shortfall / months.length,
          )} mm/month per month here. Schedule pivots ahead of ${MONTH_LABELS[months[0]]} — irrigate before root-zone wetness falls below ~0.35, not after visible stress.`
        : `Expect ~${shortfall} mm total shortfall across ${monthNames(months)}. Without irrigation, this is when your soil water bank pays the bills — cover and early planting decide whether it lasts.`,
      months,
    })
  }

  // ---- Harvest / dry-down ---------------------------------------------
  if (crop && crop.season !== 'perennial' && plantStart >= 0) {
    const harvestStart = Math.round(plantStart + crop.seasonMonths) % 12
    const win = monthRange(harvestStart, 2)
    out.push({
      id: 'harvest',
      kind: 'harvest',
      severity: 'info',
      title: `Target harvest from ${monthNames(win)}`,
      body: `${crop.name} needs roughly ${crop.seasonMonths} months from planting — sown ${MONTH_LABELS[plantStart]}, it should mature around ${MONTH_LABELS[harvestStart]}. Line up harvest and transport so the crop isn't standing through the first dry-season heat, which costs yield and quality.`,
      months: win,
    })
  }

  // ---- Heat alerts -----------------------------------------------------
  const hotDays = climate.hotDaysByMonth
  const hotCandidates = hotDays
    ? hotDays
        .map((d, i) => ({ d, i }))
        .filter((o) => o.d >= 2)
        .sort((a, b) => b.d - a.d)
        .slice(0, 3)
        .map((o) => o.i)
        .sort((a, b) => a - b)
    : monthly.Tmax
        .map((t, i) => ({ t, i }))
        .sort((a, b) => b.t - a.t)
        .slice(0, 2)
        .map((o) => o.i)
        .sort((a, b) => a - b)
  // Only warn about heat that lands inside the crop's growing window —
  // mid-summer heat after a winter crop is harvested is not actionable.
  const growMonths =
    plantStart >= 0 && crop && crop.season !== 'perennial'
      ? new Set(monthRange(plantStart, Math.max(2, Math.ceil(crop.seasonMonths))))
      : null
  const hotIdx = growMonths ? hotCandidates.filter((m) => growMonths.has(m)) : hotCandidates
  if (climate.heatMonths32 > 0 && crop && crop.heatScore <= 1 && hotIdx.length) {
    const peakDays = hotDays ? Math.round(Math.max(...hotIdx.map((i) => hotDays[i]))) : null
    out.push({
      id: 'heat',
      kind: 'heat',
      severity: 'watch',
      title: peakDays
        ? `Heat watch: ${monthNames(hotIdx)} — up to ~${peakDays} days above 32°C/month`
        : `Heat watch: ${monthNames(hotIdx)} peaks ~${Math.max(
            ...hotIdx.map((i) => Math.round(monthly.Tmax[i])),
          )}°C`,
      body: `${crop.name} is heat-sensitive at flowering. If you can shift planting a few weeks, aim to flower before or after ${monthNames(hotIdx)} — every day above 32 °C during silking/flowering costs yield.`,
      months: hotIdx,
    })
  }

  // ---- Frost -----------------------------------------------------------
  if (climate.frostMonths > 0 && crop && crop.frostScore === 0) {
    const frostDays = climate.frostDaysByMonth
    const peakFrost = frostDays && frostIdx.length
      ? Math.round(Math.max(...frostIdx.map((i) => frostDays[i])))
      : null
    out.push({
      id: 'frost',
      kind: 'frost',
      severity: 'action',
      title: `Frost risk ${frostIdx.length ? monthNames(frostIdx) : ''}${peakFrost ? ` — up to ~${peakFrost} nights near 0°C` : ''}`,
      body: `${crop.name} will not tolerate a late cold snap — keep ${crop.season === 'summer' ? 'summer' : 'sensitive'} plantings after ${MONTH_LABELS[(frostEnd + 1) % 12]} and watch the 10-day forecast each season.`,
      months: frostIdx,
    })
  }

  // ---- Storm / erosion -------------------------------------------------
  if (climate.rainConcentration > 0.55) {
    out.push({
      id: 'storm',
      kind: 'storm',
      severity: 'watch',
      title: `Storm months: keep cover through ${monthNames(wetMonths)}`,
      body: `${Math.round(climate.rainConcentration * 100)}% of your annual rain arrives in ${monthNames(wetMonths)} as intense events. Bare soil then loses topsoil fast — keep residue or a living cover through these months, especially on slopes.`,
      months: wetMonths,
    })
  }

  // ---- Right-now status ------------------------------------------------
  if (trend?.recent && trend.recent.days > 0) {
    const r = trend.recent
    out.push({
      id: 'now',
      kind: 'irrigate',
      severity: r.wetness < 0.35 ? 'action' : 'info',
      title: `Right now (last ${r.days} observed days): ${r.rainMm.toFixed(0)} mm rain · soil wetness ${r.wetness.toFixed(2)}`,
      body:
        r.wetness < 0.35
          ? `Root-zone wetness is low for this time of year (NASA observed). If a crop is in the ground, this is an irrigate-now signal; if not, hold planting until the profile wets up. Day highs reached ${r.tmaxMax.toFixed(0)}°C.`
          : `Root-zone wetness sits at ${r.wetness.toFixed(2)} (NASA observed) with day highs to ${r.tmaxMax.toFixed(
              0,
            )}°C — the profile is holding. Re-check after the next satellite pass.`,
      months: [],
    })
  }

  return out
}
