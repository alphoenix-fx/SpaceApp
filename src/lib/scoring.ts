import { cropById, cropWaterMid } from './crops'
import { soilProfile } from './soil'
import type {
  ClimateFeatures,
  CriterionScore,
  Crop,
  DailyTrend,
  Priorities,
  RotationYear,
  SoilInfo,
  Strategy,
  TerrainInfo,
} from './types'

// ---------------------------------------------------------------------------
// The rotation engine: turns NASA POWER climatology + terrain + soil context +
// farmer priorities into explainable multi-criteria scores and suggested
// rotation strategies. Every rule is rule-of-thumb agronomy, deliberately
// transparent rather than a black box.
// ---------------------------------------------------------------------------

/** Main growth window per season kind (month indices 0=Jan) */
const GROWTH_WINDOW: Record<Crop['season'], number[]> = {
  summer: [9, 10, 11, 0, 1, 2], // Oct–Mar
  winter: [3, 4, 5, 6, 7, 8], // Apr–Sep
  perennial: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
}

/** Rough N removal per grain crop (kg N/ha) */
const N_DEMAND: Record<string, number> = {
  maize: 170, sorghum: 110, wheat: 95, barley: 85, triticale: 90,
  millets: 75, sunflower: 60, canola: 90, lupin: 25, soybean: 25,
  groundnut: 20, drybean: 30, cowpea: 25, lucerne: 0, medic: 0,
  oats: 40, vetch: 0, covermix: 0, fallow: 0,
}

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v))
const r1 = (v: number) => Math.round(v * 10) / 10

export interface AnalysisContext {
  climate: ClimateFeatures
  soil: SoilInfo
  slope: TerrainInfo
  regime: 'summer-rain' | 'winter-rain' | 'any'
}

// ---------------------------------------------------------------------------
// Water accounting
// ---------------------------------------------------------------------------

interface CropWater {
  demandMm: number
  supplyMm: number
  deficitMm: number
  deficitRatio: number
  irrigatedCover: boolean
}

function cropWater(crop: Crop, ctx: AnalysisContext): CropWater {
  const { climate, soil } = ctx
  const profile = soilProfile(soil)
  const window = GROWTH_WINDOW[crop.season]
  const seasonRain = window.reduce((a, m) => a + climate.monthly.P[m], 0)
  const seasonET0 = window.reduce((a, m) => a + climate.monthly.ET0[m], 0)

  const mid = cropWaterMid(crop)
  // Hotter/drier sites push demand up; very cool sites pull it down.
  const scale =
    crop.needsIrrigation ? 1 : clamp(seasonET0 / (crop.season === 'winter' ? 850 : 1250), 0.8, 1.45)
  const demand = mid * scale

  if (soil.irrigated) {
    return {
      demandMm: Math.round(demand),
      supplyMm: Math.round(demand),
      deficitMm: 0,
      deficitRatio: 0,
      irrigatedCover: true,
    }
  }

  const bank = profile.whcMmPerM * Math.min(crop.rootM, 1.6) * 0.55
  const effectiveRain = seasonRain * 0.75
  const supply = effectiveRain + bank
  const deficit = Math.max(0, demand - supply)
  return {
    demandMm: Math.round(demand),
    supplyMm: Math.round(supply),
    deficitMm: Math.round(deficit),
    deficitRatio: demand > 0 ? deficit / demand : 0,
    irrigatedCover: false,
  }
}

// ---------------------------------------------------------------------------
// Criterion scores
// ---------------------------------------------------------------------------

interface ScoredCrop {
  crop: Crop
  water: CropWater
}

function scoreWater(scores: ScoredCrop[], ctx: AnalysisContext): CriterionScore {
  const avgRatio =
    scores.reduce((a, s) => a + s.water.deficitRatio, 0) / Math.max(1, scores.length)
  const totalDemand = scores.reduce((a, s) => a + s.water.demandMm, 0)
  const totalDeficit = scores.reduce((a, s) => a + s.water.deficitMm, 0)

  let score: number
  let detail: string
  if (ctx.soil.irrigated) {
    score = clamp(94 - totalDemand / scores.length / 16, 30, 96)
    detail = `Irrigated: full-season water demand ≈ ${Math.round(totalDemand / scores.length)} mm/yr (efficient pivots matter most).`
  } else {
    score = clamp(100 - 165 * avgRatio)
    const droughtBonus =
      ctx.climate.aridityIndex < 0.55
        ? (scores.reduce((a, s) => a + s.crop.droughtScore, 0) / scores.length - 1.5) * 4
        : 0
    score = clamp(score + droughtBonus)
    detail =
      totalDeficit > 0
        ? `Rainfed: demand ≈ ${Math.round(totalDemand / scores.length)} mm/crop-yr vs ≈ ${Math.round(
            (totalDemand - totalDeficit) / scores.length,
          )} mm reliably supplyable — average shortfall ${Math.round(
            totalDeficit / scores.length,
          )} mm.`
        : `Rainfed supply meets demand for this sequence (NASA POWER rainfall & ET0).`
  }
  return { key: 'water', label: 'Water fit', score: Math.round(score), detail }
}

function scoreSoilHealth(scores: ScoredCrop[], ctx: AnalysisContext): CriterionScore {
  const nBank = scores.reduce((a, s) => a + (s.crop.nFix - (N_DEMAND[s.crop.id] ?? 40)), 0)
  const omAvg = scores.reduce((a, s) => a + s.crop.omScore, 0) / scores.length
  const coverShare = scores.filter((s) => s.crop.erosionScore >= 2 && !s.crop.bareAfter).length / scores.length
  const legumeShare = scores.filter((s) => s.crop.family === 'legume').length / scores.length

  let score =
    42 +
    omAvg * 17 +
    (nBank > 0 ? Math.min(28, nBank / 5) : Math.max(-24, nBank / 4)) +
    coverShare * 10 +
    (ctx.soil.omPercent - 1.5) * 7
  if (legumeShare >= 0.25) score += 8

  const nTxt =
    nBank > 0
      ? `legumes bank ≈ +${Math.round(nBank)} kg N/ha over the cycle`
      : nBank < 0
        ? `grain crops draw down ≈ ${Math.round(-nBank)} kg N/ha of soil N over the cycle`
        : `nitrogen roughly balances`

  return {
    key: 'soilHealth',
    label: 'Soil health',
    score: Math.round(clamp(score)),
    detail: `Organic-matter contribution ${r1(omAvg)}/3 (${ctx.soil.texture}, ~${ctx.soil.omPercent}% OM to start); ${nTxt}.`,
  }
}

function scoreErosion(scores: ScoredCrop[], ctx: AnalysisContext): CriterionScore {
  const { climate, slope } = ctx
  const profile = soilProfile(ctx.soil)
  const erosivity = climate.rainConcentration * clamp(climate.annualRainMm / 650, 0.5, 1.6, )
  const slopeFactor = 1 + slope.slopePercent / 5.5

  const risk =
    scores.reduce((a, s) => a + (3 - s.crop.erosionScore) * (s.crop.id === 'fallow' ? 1.7 : 1), 0) *
    erosivity *
    slopeFactor *
    profile.erodibility *
    9

  const bare = scores.filter((s) => s.crop.id === 'fallow').length
  return {
    key: 'erosion',
    label: 'Erosion control',
    score: Math.round(clamp(100 - risk)),
    detail: `${slope.slopeClass} ground (~${slope.slopePercent}% slope, Copernicus DEM), ${Math.round(
      climate.rainConcentration * 100,
    )}% of rain in 3 months${bare ? `, ${bare} bare-fallow year(s)` : ''}.`,
  }
}

function scorePestCycle(scores: ScoredCrop[]): CriterionScore {
  let score = 55
  const ids = scores.map((s) => s.crop)
  for (let i = 1; i < ids.length; i++) {
    if (ids[i].family === ids[i - 1].family) score -= 11
    if (ids[i].id === ids[i - 1].id) score -= 16
    if (ids[i - 1].family === 'grass' && ids[i].family === 'legume') score += 7
  }
  const fams = new Set(ids.map((c) => c.family))
  if (fams.size >= 3) score += 10
  else if (fams.size === 2) score += 4
  if (ids.some((c) => c.family === 'brassica')) score += 13
  if (ids.some((c) => c.season === 'perennial')) score += 8
  if (fams.size === 1 && new Set(ids.map((c) => c.id)).size === 1) score -= 25

  const pairs = ids.filter((c, i) => i > 0 && c.family === ids[i - 1].family).length
  const brassica = ids.some((c) => c.family === 'brassica')

  return {
    key: 'pestCycle',
    label: 'Pest & disease break',
    score: Math.round(clamp(score, 0, 100)),
    detail: `${pairs} back-to-back same-family year(s); ${brassica ? 'brassica break crop present' : 'no brassica break crop'}.`,
  }
}

/** Per-crop climate suitability (0–100) — shared by rotation scoring,
 *  single-crop viability and the field-shift explorer. Starts from a neutral
 *  baseline and adjusts for real mismatches; water stress is scored separately
 *  in cropWater, so drought appears here only as a tolerance bonus. */
export function cropClimateScore(c: Crop, ctx: AnalysisContext): number {
  const { climate, soil, regime } = ctx
  let v = 62
  if (c.needsIrrigation && !soil.irrigated) v -= 22

  // Frost: summer crops simply plant after the last frost (see playbook), so
  // only heavy frost zones mildly penalize frost-sensitive summer crops.
  if (c.season === 'summer' && c.frostScore === 0) {
    if (climate.frostMonths >= 4) v -= 6
    else if (climate.frostMonths >= 2) v -= 4
  }
  if (c.season === 'perennial' && climate.frostMonths > 0 && c.frostScore <= 1) v -= 6

  // Heat: months that regularly see >32°C days
  if (climate.heatMonths32 >= 3 && c.heatScore <= 1) v -= 7
  if (climate.heatMonths32 >= 5 && c.heatScore === 0) v -= 4
  if (climate.heatMonths35 >= 1 && c.heatScore === 0) v -= 3

  // Wrong rainfall season is a fundamental mismatch
  if (c.regime !== 'any' && c.regime !== regime && regime !== 'any') v -= 20

  // Adaptation bonuses: traits that directly answer this climate's stresses
  if (c.droughtScore >= 2 && climate.aridityIndex < 0.5) v += 4
  if (c.heatScore >= 2 && climate.heatMonths32 >= 3) v += 4
  if (c.frostScore >= 2 && climate.frostMonths >= 2) v += 2
  return clamp(v, 0, 100)
}

function scoreClimateFit(scores: ScoredCrop[], ctx: AnalysisContext): CriterionScore {
  const notes: string[] = []
  let total = 0
  for (const s of scores) {
    const c = s.crop
    if (c.needsIrrigation && !ctx.soil.irrigated) notes.push(`${c.name} needs irrigation here`)
    if (c.season === 'summer' && ctx.climate.frostMonths >= 4 && c.frostScore === 0)
      notes.push(`${c.name} must be planted well after the last frost`)
    if (ctx.climate.heatMonths32 >= 3 && c.heatScore <= 1)
      notes.push(`${c.name} suffers in ${ctx.climate.heatMonths32} hot months (Tmax > 32 °C)`)
    if (c.regime !== 'any' && c.regime !== ctx.regime && ctx.regime !== 'any')
      notes.push(`${c.name} suits the other rainfall season`)
    total += cropClimateScore(c, ctx)
  }
  const avg = total / scores.length
  return {
    key: 'climateFit',
    label: 'Climate fit',
    score: Math.round(clamp(avg)),
    detail: notes.length
      ? `Watch-list: ${[...new Set(notes)].slice(0, 3).join('; ')}.`
      : `Crops align well with this temperature, frost and rainfall profile (NASA POWER normals).`,
  }
}

function scoreIncome(scores: ScoredCrop[], _ctx: AnalysisContext): CriterionScore {
  const avgIncome = scores.reduce((a, s) => a + s.crop.incomeScore, 0) / scores.length
  const unique = new Set(scores.map((s) => s.crop.id)).size
  const fallow = scores.filter((s) => s.crop.id === 'fallow').length
  const perennialCash = scores.some((s) => s.crop.id === 'lucerne' || s.crop.id === 'medic')
  const score = clamp(avgIncome * 24 + Math.min(21, (unique - 1) * 7) + (perennialCash ? 5 : 0) - fallow * 4)
  return {
    key: 'income',
    label: 'Income & markets',
    score: Math.round(score),
    detail: `${unique} different crop(s) across the cycle${perennialCash ? ', includes a high-value perennial' : ''}. Verify off-take locally before switching.`,
  }
}

function scoreForage(scores: ScoredCrop[], _ctx: AnalysisContext): CriterionScore {
  const avgForage = scores.reduce((a, s) => a + s.crop.forageScore, 0) / scores.length
  const perennial = scores.some((s) => s.crop.season === 'perennial')
  const grazing = scores.some((s) => ['oats', 'medic', 'cowpea', 'triticale', 'millets'].includes(s.crop.id))
  const score = clamp(avgForage * 26 + (perennial ? 8 : 0) + (grazing ? 4 : 0))
  return {
    key: 'forage',
    label: 'Forage value',
    score: Math.round(score),
    detail: `Average forage score ${r1(avgForage)}/3 across the rotation${perennial ? ', with year-round ley grazing' : ''}.`,
  }
}

// ---------------------------------------------------------------------------
// Total score with farmer priorities
// ---------------------------------------------------------------------------

export function computeScore(
  sequence: RotationYear[],
  ctx: AnalysisContext,
  priorities: Priorities,
): { total: number; criteria: CriterionScore[] } {
  const scored: ScoredCrop[] = sequence
    .map((y) => cropById(y.cropId))
    .filter((c): c is Crop => !!c)
    .map((crop) => ({ crop, water: cropWater(crop, ctx) }))

  if (!scored.length) return { total: 0, criteria: [] }

  const criteria = [
    scoreWater(scored, ctx),
    scoreSoilHealth(scored, ctx),
    scoreErosion(scored, ctx),
    scorePestCycle(scored),
    scoreClimateFit(scored, ctx),
    scoreIncome(scored, ctx),
    scoreForage(scored, ctx),
  ]
  const byKey = Object.fromEntries(criteria.map((c) => [c.key, c.score]))

  const sliderSum = priorities.water + priorities.soil + priorities.income + priorities.erosion + priorities.forage
  const w = (v: number) => (sliderSum > 0 ? (v / sliderSum) * 0.74 : 0.74 / 5)

  const total = Math.round(
    byKey.water * w(priorities.water) +
      byKey.soilHealth * w(priorities.soil) +
      byKey.income * w(priorities.income) +
      byKey.erosion * w(priorities.erosion) +
      byKey.forage * w(priorities.forage) +
      byKey.pestCycle * 0.12 +
      byKey.climateFit * 0.14,
  )
  return { total: clamp(total, 0, 100), criteria }
}

// ---------------------------------------------------------------------------
// Diagnostics on the current rotation
// ---------------------------------------------------------------------------

interface Diagnostics {
  scored: ScoredCrop[]
  waterDeficitRatio: number
  thirstiest: ScoredCrop | null
  legumeShare: number
  fallowYears: number
  brassicaPresent: boolean
  monoculture: boolean
  maxFamilyRun: number
  avgOM: number
}

function diagnose(sequence: RotationYear[], ctx: AnalysisContext): Diagnostics {
  const scored: ScoredCrop[] = sequence
    .map((y) => cropById(y.cropId))
    .filter((c): c is Crop => !!c)
    .map((crop) => ({ crop, water: cropWater(crop, ctx) }))

  const legumeShare = scored.filter((s) => s.crop.family === 'legume').length / Math.max(1, scored.length)
  const fallowYears = scored.filter((s) => s.crop.id === 'fallow').length
  const brassicaPresent = scored.some((s) => s.crop.family === 'brassica')
  const unique = new Set(scored.map((s) => s.crop.id))
  const monoculture = unique.size === 1

  let maxFamilyRun = 0
  let run = 1
  for (let i = 1; i < scored.length; i++) {
    if (scored[i].crop.family === scored[i - 1].crop.family) run++
    else run = 1
    maxFamilyRun = Math.max(maxFamilyRun, run)
  }

  const thirstiest =
    scored.length
      ? scored.reduce((a, s) =>
          s.water.deficitRatio > a.water.deficitRatio ? s : a,
        )
      : null

  const avgOM = scored.reduce((a, s) => a + s.crop.omScore, 0) / Math.max(1, scored.length)

  return {
    scored,
    waterDeficitRatio:
      scored.reduce((a, s) => a + s.water.deficitRatio, 0) / Math.max(1, scored.length),
    thirstiest,
    legumeShare,
    fallowYears,
    brassicaPresent,
    monoculture,
    maxFamilyRun,
    avgOM,
  }
}

// ---------------------------------------------------------------------------
// Candidate strategy templates
// ---------------------------------------------------------------------------

interface CandidateSeed {
  id: string
  name: string
  tagline: string
  build: (cur: string[]) => string[]
}

function mkSeq(ids: string[]): RotationYear[] {
  return ids.map((cropId, i) => ({ year: i + 1, cropId }))
}

function buildCandidates(ctx: AnalysisContext, priorities: Priorities): CandidateSeed[] {
  const { climate, soil, slope } = ctx
  const summer = ctx.regime === 'summer-rain'
  const out: CandidateSeed[] = []

  // 1. Drought-smart: swap the thirstiest staple for a hardy cereal
  if (!soil.irrigated && climate.aridityIndex < 0.75) {
    out.push({
      id: 'drought-smart',
      name: 'Drought-smart rotation',
      tagline: 'Shift water-hungry cereals toward deeper-rooted, heat-hardy crops.',
      build: (cur) =>
        cur.map((id, i) => {
          if (id === 'maize') return summer || i % 2 === 1 ? 'sorghum' : 'maize'
          if (!summer && id === 'wheat') return i % 2 === 0 ? 'triticale' : 'wheat'
          if (id === 'fallow') return summer ? 'cowpea' : 'oats'
          return id
        }),
    })
  }

  // 2. Legume bridge: guarantee a nitrogen-fixing year
  out.push({
    id: 'legume-bridge',
    name: 'Legume bridge rotation',
    tagline: 'Insert a nitrogen-fixing crop to feed the cereals that follow.',
    build: (cur) =>
      cur.map((id, i) => {
        if (id === 'fallow') return summer ? 'soybean' : 'lupin'
        if (i === 1 && !cur.some((c) => CROPS_IS_LEGUME(c))) return summer ? 'soybean' : 'lupin'
        return id
      }),
  })

  // 3. Soil-cover builder: replace bare fallow / add a cover year
  out.push({
    id: 'soil-cover',
    name: 'Soil-cover builder',
    tagline: 'Trade bare fallow for covered soil: residue, roots and soil biology all year.',
    build: (cur) => {
      let seq = cur.map((id) => (id === 'fallow' ? 'covermix' : id))
      if (slope.slopePercent >= 5 || ctx.climate.rainConcentration > 0.6) {
        // steep or stormy: ensure at least two high-cover years
        if (!seq.includes('oats') && !seq.includes('covermix')) seq = [...seq.slice(0, 3), 'covermix']
      }
      return seq
    },
  })

  // 4. Forage booster
  if (soil.irrigated || priorities.forage >= 50) {
    out.push({
      id: 'forage-boost',
      name: 'Forage booster rotation',
      tagline: 'Grow more feed on-farm: ley grazing or high-biomass winter forage.',
      build: (cur) => {
        if (soil.irrigated) return [cur[0], cur[1], 'lucerne', 'lucerne']
        return summer
          ? [cur[0], 'millets', cur[2], 'cowpea']
          : ['oats', 'triticale', cur[2] === 'wheat' ? 'triticale' : cur[2], 'vetch']
      },
    })
  }

  // 5. Market spreader
  if (priorities.income >= 50) {
    out.push({
      id: 'market-spreader',
      name: 'Market spreader rotation',
      tagline: 'Diversify crops and price risk across several strong local markets.',
      build: (cur) => {
        if (summer) {
          const base = cur.map((id) => (id === 'fallow' ? 'groundnut' : id))
          if (!base.includes('soybean')) base[2] = 'soybean'
          if (!base.includes('sunflower')) base[3] = 'sunflower'
          return base
        }
        const base = cur.map((id) => (id === 'fallow' ? 'canola' : id))
        if (!base.includes('canola')) base[1] = 'canola'
        if (!base.includes('barley')) base[3] = 'barley'
        return base
      },
    })
  }

  return out
}

const CROPS_IS_LEGUME = (id: string) => cropById(id)?.family === 'legume'

// ---------------------------------------------------------------------------
// Keep / Adapt / Shift verdict — the traffic-light answer to "will my current
// crop plan survive the way this place is changing?"
// ---------------------------------------------------------------------------

export type VerdictLevel = 'keep' | 'adapt' | 'shift'

export interface Verdict {
  score: number
  level: VerdictLevel
  headline: string
  body: string
  dominantCrop: string
  drivers: Array<{ label: string; score: number; note: string }>
  trendNote: string | null
}

/** Score momentum from the 10–15 yr NASA daily trend (0–100, 55 = stable) */
export function trendMomentum(trend: DailyTrend | undefined): number {
  if (!trend) return 55
  let v = 58
  const { rainPct, wetnessDelta, hotDaysDelta, tmaxDelta } = trend.thenNow
  if (rainPct < 0) v -= Math.min(24, Math.abs(rainPct) * 1.6)
  else if (rainPct > 0) v += Math.min(8, rainPct * 0.6)
  if (wetnessDelta < -0.02) v -= Math.min(14, Math.abs(wetnessDelta) * 140)
  if (hotDaysDelta > 0) v -= Math.min(12, hotDaysDelta * 1.4)
  if (tmaxDelta > 0.4) v -= Math.min(8, tmaxDelta * 8)
  return clamp(v)
}

/** The main cash crop the verdict is about (highest water demand, non-fallow) */
export function dominantCropId(sequence: RotationYear[]): string | null {
  const crops = sequence
    .map((y) => cropById(y.cropId))
    .filter((c): c is Crop => !!c && c.id !== 'fallow')
  if (!crops.length) return null
  return crops.reduce((a, b) => (cropWaterMid(b) > cropWaterMid(a) ? b : a)).id
}

/** Single-crop viability 0–100 for one location (verdict + shift explorer) */
export function cropViability(cropId: string, ctx: AnalysisContext, trend?: DailyTrend): number {
  const crop = cropById(cropId)
  if (!crop) return 0
  const water = cropWater(crop, ctx)
  const waterScore =
    ctx.soil.irrigated
      ? clamp(94 - water.demandMm / 16, 30, 96)
      : clamp(100 - 150 * water.deficitRatio)
  const climate = cropClimateScore(crop, ctx)
  const momentum = trend ? (trendMomentum(trend) - 55) * 0.35 : 0
  return Math.round(clamp(0.6 * waterScore + 0.4 * climate + momentum))
}

export function computeVerdict(
  sequence: RotationYear[],
  ctx: AnalysisContext,
  priorities: Priorities,
  trend?: DailyTrend,
): Verdict {
  const { total, criteria } = computeScore(sequence, ctx, priorities)
  const momentum = trendMomentum(trend)
  const viability = Math.round(clamp(total * 0.8 + momentum * 0.2))

  const domId = dominantCropId(sequence)
  const dom = domId ? cropById(domId) : null
  const domName = dom?.name ?? 'your current crop plan'

  const level: VerdictLevel = viability >= 62 ? 'keep' : viability >= 44 ? 'adapt' : 'shift'

  const drivers = [...criteria]
    .sort((a, b) => a.score - b.score)
    .slice(0, 3)
    .map((c) => ({ label: c.label, score: c.score, note: c.detail }))

  let trendNote: string | null = null
  if (trend) {
    const tn = trend.thenNow
    const parts: string[] = []
    if (Math.abs(tn.rainPct) >= 4)
      parts.push(`rainfall ${tn.rainPct < 0 ? 'down' : 'up'} ~${Math.abs(Math.round(tn.rainPct))}% vs ${tn.yearsSpan} years ago`)
    if (tn.wetnessDelta <= -0.015)
      parts.push(`growing-season soil moisture falling (${tn.wetnessDelta.toFixed(2)})`)
    if (tn.hotDaysDelta >= 1.5)
      parts.push(`~+${Math.round(tn.hotDaysDelta)} more days above 32°C each year`)
    if (tn.tmaxDelta >= 0.3)
      parts.push(`day highs ${tn.tmaxDelta >= 1 ? '+' : ''}${tn.tmaxDelta.toFixed(1)}°C hotter`)
    if (parts.length) trendNote = `Over the last ${tn.yearsSpan} years at this exact point: ${parts.join('; ')}.`
    else trendNote = `Over the last ${tn.yearsSpan} years this spot has stayed remarkably stable — the risk is year-to-year variability, not a trend.`
  }

  const headline =
    level === 'keep'
      ? `${domName} still fits this land — keep it, with eyes open`
      : level === 'adapt'
        ? `${domName} is under pressure — adapt the plan around it`
        : `Conditions are moving away from ${domName} — plan your shift`

  const body =
    level === 'keep'
      ? 'The water balance, temperatures and soils still match what this plan needs. Monitor the trend lines and protect what is working.'
      : level === 'adapt'
        ? 'The crop can still produce here, but the gaps below are where seasons will punish you first. Adjust the rotation, cultivar choice or planting windows — the suggested strategies show how.'
        : 'The trends and water math point away from this plan being reliable. Shift toward the suggested resilient rotations below, and consider whether part of the operation should move where these conditions still fit.'

  return { score: viability, level, headline, body, dominantCrop: domName, drivers, trendNote }
}

// ---------------------------------------------------------------------------
// Strategy assembly
// ---------------------------------------------------------------------------

function evidenceLines(ctx: AnalysisContext): string[] {
  const { climate, slope } = ctx
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const wet = climate.wetMonths.map((m) => months[m]).join(', ')
  const lines = [
    `NASA POWER 30+ year normals: ≈ ${Math.round(climate.annualRainMm)} mm rain/yr, ${Math.round(
      climate.rainConcentration * 100,
    )}% of it in ${wet}; reference ET0 ≈ ${Math.round(climate.annualET0Mm)} mm/yr (aridity index ${r1(
      climate.aridityIndex,
    )}).`,
    `Temperature profile: ${climate.heatMonths32} month(s) above 32 °C, ${climate.heatMonths35} above 35 °C; ${climate.frostMonths} month(s) with frost risk (Tmin < 2 °C).`,
    `Terrain: ~${slope.slopePercent}% slope (${slope.slopeClass}, Copernicus DEM) — ${slope.erosionRelevance.toLowerCase()}`,
  ]
  if (climate.trend) {
    const t = climate.trend
    lines.push(
      `Recent decade: rainfall trend ${t.rainSlopePerDecade >= 0 ? '+' : ''}${Math.round(
        t.rainSlopePerDecade,
      )} mm/decade; last 5 years ${t.recentVsHistoricalRain >= 0 ? 'wetter' : 'drier'} than the 15-year mean by ${Math.abs(
        Math.round(t.recentVsHistoricalRain * 100),
      )}%.`,
    )
  }
  return lines
}

function gapsFor(kind: string, ctx: AnalysisContext): string[] {
  const g = [
    'Cultivar choice, planting dates and input costs need local verification.',
    'Soil chemical test (pH, P, K) recommended before changing fertiliser plans.',
    'FAO GAEZ suitability maps can refine crop feasibility for your district.',
  ]
  if (kind === 'forage-boost')
    g.push('Lucerne needs proven irrigation capacity and a dairy/hay market nearby.')
  if (kind === 'market-spreader')
    g.push('Confirm off-take contracts and storage before committing hectares.')
  if (kind === 'drought-smart')
    g.push('Sorghum/millet yields respond strongly to cultivar and row spacing — check local trial data.')
  if (ctx.soil.irrigated) g.push('Confirm water allocation reliability with your scheme/water user association.')
  return g
}

function risksFor(kind: string, ctx: AnalysisContext): string[] {
  const r = [
    'Short-term cash-flow can dip during transition years.',
    'New crops bring learning costs: equipment, agronomy, market timing.',
  ]
  if (ctx.climate.heatMonths32 >= 3) r.push('Heat spikes around flowering can still cut yields in dry seasons.')
  if (ctx.climate.frostMonths >= 2) r.push('Late or early frost can damage sensitive crops at the season edges.')
  if (kind === 'market-spreader') r.push('Commodity prices swing — diversification reduces, not removes, price risk.')
  if (kind === 'legume-bridge') r.push('Legumes are disease-sensitive in wet seasons; seed treatment and rhizobium matter.')
  return r
}

export function buildStrategies(
  currentRotation: string[],
  ctx: AnalysisContext,
  priorities: Priorities,
): Strategy[] {
  const curSeq = mkSeq(currentRotation)
  const curScore = computeScore(curSeq, ctx, priorities)
  const diag = diagnose(curSeq, ctx)

  const current: Strategy = {
    id: 'current',
    name: 'Your current rotation',
    tagline: 'The plan you farm today — the baseline every alternative is measured against.',
    kind: 'current',
    sequence: curSeq,
    total: curScore.total,
    criteria: curScore.criteria,
    why:
      diag.monoculture
        ? 'This is your current plan. It leans on a single crop year after year — satellite data shows where that is costing soil and water.'
        : 'This is your current plan — the baseline. Its score shows where the existing sequence is doing fine and where the pressure points are.',
    evidence: evidenceLines(ctx),
    benefits: [
      'Known agronomy, machinery and market channels — no transition risk.',
      ...(diag.legumeShare > 0 ? ['Already includes a nitrogen-fixing crop.'] : []),
      ...(diag.brassicaPresent ? ['Includes a brassica break crop for grass-cereal disease cycles.'] : []),
    ],
    gaps: [
      ...(diag.fallowYears > 0 ? [`${diag.fallowYears} year(s) leave soil bare — the biggest lever available.`] : []),
      ...(diag.legumeShare === 0 ? ['No nitrogen-fixing crop in the cycle.'] : []),
      ...(diag.maxFamilyRun >= 3 ? ['Cereal-family crops run back-to-back — disease and weed pressure builds.'] : []),
      'Field observations (soil structure, weeds, past yields) should confirm what satellites cannot see.',
    ],
    risks: risksFor('current', ctx),
  }

  const candidates = buildCandidates(ctx, priorities)
    .map((seed) => {
      const ids = seed.build(currentRotation)
      const sig = ids.join('|')
      if (sig === currentRotation.join('|')) return null
      const seq = mkSeq(ids)
      const score = computeScore(seq, ctx, priorities)
      return { seed, seq, score }
    })
    .filter((c): c is NonNullable<typeof c> => !!c)

  candidates.sort((a, b) => b.score.total - a.score.total)

  const seen = new Set<string>()
  const suggestions: Strategy[] = []
  for (const c of candidates) {
    const sig = c.seq.map((s) => s.cropId).join('|')
    if (seen.has(sig)) continue
    seen.add(sig)
    suggestions.push({
      id: c.seed.id,
      name: c.seed.name,
      tagline: c.seed.tagline,
      kind: 'suggested',
      sequence: c.seq,
      total: c.score.total,
      criteria: c.score.criteria,
      why: whyFor(c.seed.id, diag, ctx),
      evidence: evidenceLines(ctx),
      benefits: benefitsFor(c.seed.id, diag, ctx),
      gaps: gapsFor(c.seed.id, ctx),
      risks: risksFor(c.seed.id, ctx),
    })
    if (suggestions.length >= 3) break
  }

  return [current, ...suggestions]
}

function whyFor(kind: string, diag: Diagnostics, ctx: AnalysisContext): string {
  const { climate, soil, slope } = ctx
  switch (kind) {
    case 'drought-smart':
      return `Aridity index ${r1(climate.aridityIndex)} and ${Math.round(
        diag.waterDeficitRatio * 100,
      )}% average crop-water shortfall — deeper-rooted, heat-hardy cereals convert the same rain into more reliable yield.`
    case 'legume-bridge':
      return diag.legumeShare === 0
        ? `No legume in your current cycle: grain crops are mining soil nitrogen every year. One fixing year restarts the nitrogen bank for the maize/wheat that follows.`
        : `Raising the legume share deepens the nitrogen bank and diversifies root systems between cereal years.`
    case 'soil-cover':
      return diag.fallowYears > 0
        ? `${diag.fallowYears} bare-fallow year(s) leave soil exposed through ${Math.round(
            climate.rainConcentration * 100,
          )}% of your rain — the exact window when erosion and organic-matter loss peak. Cover crops intercept that rain where it falls.`
        : `Your ground sits on ${slope.slopeClass} terrain with ${Math.round(
            climate.rainConcentration * 100,
          )}% of rain in 3 months — a dedicated cover year buffers the intense-storm periods.`
    case 'forage-boost':
      return soil.irrigated
        ? `You irrigate — permanent ley like lucerne turns water into high-value feed while fixing nitrogen and building soil structure.`
        : `Forage priority is high: hardy forage crops (millet, cowpea, vetch) suit the ${Math.round(
            climate.annualRainMm,
          )} mm rain profile without demanding irrigation.`
    case 'market-spreader':
      return `Spreading hectares across several commodity chains cuts price risk — with ${Math.round(
        climate.annualRainMm,
      )} mm/yr of rain your land can carry a broader mix.`
    default:
      return 'Matches your field profile better on balance.'
  }
}

function benefitsFor(kind: string, diag: Diagnostics, _ctx: AnalysisContext): string[] {
  const b: string[] = []
  switch (kind) {
    case 'drought-smart':
      b.push('Lower peak water demand and better stand survival in poor seasons.')
      b.push('Sorghum/millet residues give extra grazing or mulch.')
      break
    case 'legume-bridge':
      b.push('Free nitrogen for the following cereal — less fertiliser dependence.')
      b.push('Different root architecture opens the soil profile.')
      break
    case 'soil-cover':
      b.push('Living cover through the stormy months: infiltration up, runoff down.')
      b.push('Extra organic matter feeds soil biology and water holding.')
      break
    case 'forage-boost':
      b.push('Feed security on-farm; ley grazing builds soil while livestock pay for it.')
      break
    case 'market-spreader':
      b.push('More price points across the year; less exposure to a single commodity crash.')
      break
  }
  if (diag.legumeShare === 0 && kind !== 'legume-bridge')
    b.push('Still worth confirming nitrogen planning with an agronomist.')
  return b
}
