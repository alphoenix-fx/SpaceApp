import type { ClimateFeatures, DailyTrend } from './types'
import { PRESETS } from './regions'

// ---------------------------------------------------------------------------
// NASA POWER (power.larc.nasa.gov) — Agroclimatology community, point API.
// Free, keyless, CORS-enabled. Two calls:
//  1) Climatology: 30+ year monthly normals (small, instant)
//  2) Daily: last ~15 years (for year-by-year trends & variability)
//
// POWER has no REST ET0 parameter, so reference evapotranspiration (ET0) is
// computed here with the Hargreaves–Samani equation from POWER T2M_MAX /
// T2M_MIN and latitude — the same Tmin/Tmax basis used by POWER's own ET
// toolkit. Actual ET is taken from POWER's EVPTRNS (latent heat flux,
// MJ/m²/day → mm/day ÷ 2.45).
// ---------------------------------------------------------------------------

const POWER = 'https://power.larc.nasa.gov/api/temporal'

const MONTH_KEYS = [
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
  'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
] as const

export const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const MONTH_DAYS = [31, 28.25, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

/** The three consecutive wettest months of the year (month indices). */
function wettestMonths(monthlyP: number[]): number[] {
  let best = 0
  let bestSum = -1
  for (let m = 0; m < 12; m++) {
    const sum =
      (monthlyP[m] ?? 0) + (monthlyP[(m + 1) % 12] ?? 0) + (monthlyP[(m + 2) % 12] ?? 0)
    if (sum > bestSum) {
      bestSum = sum
      best = m
    }
  }
  return [best, (best + 1) % 12, (best + 2) % 12]
}

interface ClimResponse {
  properties: { parameter: Record<string, Record<string, number>> }
  header?: { sources?: string[] }
}

function num(v: number | undefined): number | null {
  if (v === undefined || v === null || v <= -900 || Number.isNaN(v)) return null
  return v
}

/** Extraterrestrial radiation Ra (mm/day) for day-of-year J and latitude (deg) */
function extraterrestrialRa(latDeg: number, j: number): number {
  const phi = (latDeg * Math.PI) / 180
  const dr = 1 + 0.033 * Math.cos((2 * Math.PI * j) / 365)
  const delta = 0.409 * Math.sin((2 * Math.PI * j) / 365 - 1.39)
  const arg = Math.max(-1, Math.min(1, -Math.tan(phi) * Math.tan(delta)))
  const ws = Math.acos(arg)
  const ra =
    ((24 * 60) / Math.PI) * 0.082 * dr *
    (ws * Math.sin(phi) * Math.sin(delta) + Math.cos(phi) * Math.cos(delta) * Math.sin(ws))
  return Math.max(0, ra / 2.45) // MJ/m²/day → mm/day
}

/** Mid-month day-of-year (approx) */
const MID_DOY = [15, 45, 74, 105, 135, 166, 196, 227, 258, 288, 319, 349]

/** Hargreaves–Samani reference ET0 (mm/day) */
function hargreaves(tmax: number, tmin: number, tavg: number, lat: number, doy: number): number {
  const ra = extraterrestrialRa(lat, doy)
  const tRange = Math.max(0.5, tmax - tmin)
  const et0 = 0.0023 * ra * Math.pow(tRange, 0.5) * (tavg + 17.8)
  return Math.max(0.05, et0)
}

export async function fetchClimateFeatures(lat: number, lon: number): Promise<ClimateFeatures> {
  const climParams =
    'PRECTOTCORR,T2M,T2M_MAX,T2M_MIN,RH2M,GWETROOT,GWETTOP,EVPTRNS'
  const climUrl =
    `${POWER}/climatology/point?parameters=${climParams}` +
    `&community=AG&latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(3)}&format=JSON`

  const dailyUrl =
    `${POWER}/daily/point?parameters=PRECTOTCORR,T2M_MAX,T2M_MIN,T2M,GWETROOT&community=AG` +
    `&latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(3)}&start=${dailyStart()}&end=${dailyEnd()}&format=JSON`

  const [climRes, dailyJson] = await Promise.all([
    fetch(climUrl).then((r) => {
      if (!r.ok) throw new Error(`NASA POWER climatology request failed (${r.status})`)
      return r.json() as Promise<ClimResponse>
    }),
    fetch(dailyUrl)
      .then((r) => (r.ok ? (r.json() as Promise<DailyResponse>) : null))
      .catch(() => null),
  ])
  const clim = climRes
  const P = clim.properties.parameter

  const pick = (param: string): number[] =>
    MONTH_KEYS.map((m) => {
      const v = num(P[param]?.[m])
      return v === null ? 0 : v
    })

  const precipDaily = pick('PRECTOTCORR')
  let tmax = pick('T2M_MAX')
  let tmin = pick('T2M_MIN')
  let tavg = pick('T2M')
  const rh = pick('RH2M')
  const gwet = pick('GWETROOT')
  const etActDaily = pick('EVPTRNS').map((v) => Math.max(0, v / 2.45)) // MJ/m²/day → mm/day

  // POWER's climatology returns 30-yr RECORD EXTREMES for T2M_MAX/T2M_MIN
  // (e.g. 40.7°C for a January "normal"), not monthly means. Derive realistic
  // monthly temperature means + hot/frost-day frequencies from the 15-yr
  // daily record instead; fall back to climatology if daily is unavailable.
  const agg = dailyJson ? monthlyTempAggregates(dailyJson) : null
  if (agg) {
    tmax = agg.meanTmax
    tmin = agg.meanTmin
    tavg = agg.meanTavg
  }

  const monthlyP = precipDaily.map((v, i) => v * MONTH_DAYS[i])
  const monthlyET0 = MONTH_KEYS.map((_, i) =>
    hargreaves(tmax[i], tmin[i], tavg[i], lat, MID_DOY[i]) * MONTH_DAYS[i],
  )
  const monthlyETact = etActDaily.map((v, i) => v * MONTH_DAYS[i])

  const annualRainMm = monthlyP.reduce((a, b) => a + b, 0)
  const annualET0Mm = monthlyET0.reduce((a, b) => a + b, 0)
  const aridityIndex = annualET0Mm > 0 ? annualRainMm / annualET0Mm : 0

  // Rain concentration: share of annual rain in the wettest 3 months
  const sortedP = [...monthlyP].sort((a, b) => b - a)
  const rainConcentration =
    annualRainMm > 0 ? (sortedP[0] + sortedP[1] + sortedP[2]) / annualRainMm : 0

  const wetMonths = monthlyP
    .map((p, i) => ({ p, i }))
    .sort((a, b) => b.p - a.p)
    .slice(0, 3)
    .map((o) => o.i)
    .sort((a, b) => a - b)

  const growingMonths = MONTH_KEYS.map((_, i) =>
    monthlyP[i] >= 0.5 * monthlyET0[i] && tavg[i] > 5 ? 1 : 0,
  )

  const heatMonths32 = agg
    ? agg.hotDaysByMonth.filter((d) => d >= 5).length
    : tmax.filter((t) => t > 32).length
  const heatMonths35 = agg
    ? agg.veryHotDaysByMonth.filter((d) => d >= 2).length
    : tmax.filter((t) => t > 35).length
  const frostMonths = agg
    ? agg.frostDaysByMonth.filter((d) => d >= 5).length
    : tmin.filter((t) => t < 2).length

  const wetnessCycle = Math.max(...gwet) - Math.min(...gwet)

  const features: ClimateFeatures = {
    lat,
    lon,
    monthly: {
      P: monthlyP,
      Tmax: tmax,
      Tmin: tmin,
      Tavg: tavg,
      ET0: monthlyET0,
      ETact: monthlyETact,
      GWETROOT: gwet,
      RH: rh,
    },
    annualRainMm,
    annualET0Mm,
    aridityIndex,
    rainConcentration,
    wetMonths,
    growingMonths,
    heatMonths32,
    heatMonths35,
    frostMonths,
    hotDaysByMonth: agg?.hotDaysByMonth,
    veryHotDaysByMonth: agg?.veryHotDaysByMonth,
    frostDaysByMonth: agg?.frostDaysByMonth,
    wetnessCycle,
  }

  if (dailyJson) {
    try {
      features.trend = buildTrend(dailyJson, wettestMonths(monthlyP))
    } catch {
      /* trends are a bonus layer; ignore failures */
    }
  }

  return features
}

/** First of the month, 15 years ago (daily fetch window start) */
function dailyStart(): string {
  const d = new Date()
  d.setFullYear(d.getFullYear() - 15)
  d.setDate(1)
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}01`
}

/** POWER daily end date: a little in the past (data lags) */
function dailyEnd(): string {
  const d = new Date()
  d.setDate(d.getDate() - 8)
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`
}

// ---------------------------------------------------------------------------
// Climatology for the demo regions — used by the Field-Shift Explorer to
// compare the user's own location against alternative SA production regions.
// Cached module-level so repeated renders don't refetch.
// ---------------------------------------------------------------------------

const presetClimateCache = new Map<string, ClimateFeatures>()

export function getCachedPresetClimate(presetId: string): ClimateFeatures | undefined {
  return presetClimateCache.get(presetId)
}

export async function fetchPresetClimates(): Promise<void> {
  const missing = PRESETS.filter((p) => !presetClimateCache.has(p.id))
  if (!missing.length) return
  await Promise.all(
    missing.map(async (p) => {
      try {
        const c = await fetchClimateFeatures(p.lat, p.lon)
        presetClimateCache.set(p.id, c)
      } catch {
        /* region stays unavailable; Explorer hides it */
      }
    }),
  )
}

export function cachedPresetClimates(): Array<{ presetId: string; climate: ClimateFeatures }> {
  return PRESETS.filter((p) => presetClimateCache.has(p.id)).map((p) => ({
    presetId: p.id,
    climate: presetClimateCache.get(p.id)!,
  }))
}

interface DailyResponse {
  properties: { parameter: Record<string, Record<string, number>> }
}

/**
 * Monthly temperature statistics from the 15-yr daily record:
 * realistic mean Tmax/Tmin/Tavg per calendar month, plus the average number
 * of hot (>32°C), very hot (>35°C) and frost (<2°C) days per year in each
 * month. POWER climatology serves extremes for T2M_MAX/T2M_MIN, so this is
 * the only trustworthy source for "normal" temperatures.
 */
function monthlyTempAggregates(data: DailyResponse): {
  meanTmax: number[]
  meanTmin: number[]
  meanTavg: number[]
  hotDaysByMonth: number[]
  veryHotDaysByMonth: number[]
  frostDaysByMonth: number[]
} {
  const P = data.properties.parameter
  const tmaxD = P.T2M_MAX ?? {}
  const tminD = P.T2M_MIN ?? {}
  const tavgD = P.T2M ?? {}
  const sumMax = new Array(12).fill(0)
  const sumMin = new Array(12).fill(0)
  const sumAvg = new Array(12).fill(0)
  const n = new Array(12).fill(0)
  const hot = new Array(12).fill(0)
  const veryHot = new Array(12).fill(0)
  const frost = new Array(12).fill(0)
  const yearsSeen = new Set<string>()

  for (const [date, v] of Object.entries(tmaxD)) {
    const tmaxV = num(v)
    if (tmaxV === null) continue
    const mi = Number(date.slice(4, 6)) - 1
    yearsSeen.add(date.slice(0, 4))
    const tminV = num(tminD[date])
    const tavgV = num(tavgD[date])
    if (tminV !== null) {
      sumMax[mi] += tmaxV
      sumMin[mi] += tminV
      sumAvg[mi] += tavgV ?? (tmaxV + tminV) / 2
      n[mi]++
    }
    if (tmaxV > 32) hot[mi]++
    if (tmaxV > 35) veryHot[mi]++
    if (tminV !== null && tminV < 2) frost[mi]++
  }

  const ny = Math.max(1, yearsSeen.size)
  return {
    meanTmax: sumMax.map((s, i) => (n[i] ? s / n[i] : 0)),
    meanTmin: sumMin.map((s, i) => (n[i] ? s / n[i] : 0)),
    meanTavg: sumAvg.map((s, i) => (n[i] ? s / n[i] : 0)),
    hotDaysByMonth: hot.map((c) => c / ny),
    veryHotDaysByMonth: veryHot.map((c) => c / ny),
    frostDaysByMonth: frost.map((c) => c / ny),
  }
}

function buildTrend(data: DailyResponse, wetSeasonMonths: number[]): DailyTrend {
  const P = data.properties.parameter
  const rain = P.PRECTOTCORR ?? {}
  const tmax = P.T2M_MAX ?? {}
  const wet = P.GWETROOT ?? {}

  const byYearRain = new Map<number, number>()
  const byYearHeat = new Map<number, number>()
  for (const [date, v] of Object.entries(rain)) {
    const rn = num(v)
    if (rn === null) continue
    const y = Number(date.slice(0, 4))
    byYearRain.set(y, (byYearRain.get(y) ?? 0) + rn)
  }
  const byYearTmaxSum = new Map<number, number>()
  const byYearTmaxN = new Map<number, number>()
  for (const [date, v] of Object.entries(tmax)) {
    const tn = num(v)
    if (tn === null) continue
    const y = Number(date.slice(0, 4))
    if (tn > 32) byYearHeat.set(y, (byYearHeat.get(y) ?? 0) + 1)
    byYearTmaxSum.set(y, (byYearTmaxSum.get(y) ?? 0) + tn)
    byYearTmaxN.set(y, (byYearTmaxN.get(y) ?? 0) + 1)
  }
  // Growing-season wetness: months Jan, Feb + Oct, Nov, Dec of the same
  // calendar year — the wet tail + the wet-up of the next season.
  const GROW_MONTHS = new Set(['01', '02', '10', '11', '12'])
  const byYearWetSum = new Map<number, number>()
  const byYearWetN = new Map<number, number>()
  for (const [date, v] of Object.entries(wet)) {
    if (!GROW_MONTHS.has(date.slice(4, 6))) continue
    const wn = num(v)
    if (wn === null) continue
    const y = Number(date.slice(0, 4))
    byYearWetSum.set(y, (byYearWetSum.get(y) ?? 0) + wn)
    byYearWetN.set(y, (byYearWetN.get(y) ?? 0) + 1)
  }

  // Use complete calendar years only (derived from the returned date keys).
  // The daily window starts mid-month, so the first year is partial — a
  // partial year would drag the "then" average down and fake a big trend.
  const allYears = new Set<number>()
  const daysPerYear = new Map<number, number>()
  for (const date of Object.keys(rain)) {
    const y = Number(date.slice(0, 4))
    allYears.add(y)
    daysPerYear.set(y, (daysPerYear.get(y) ?? 0) + 1)
  }
  const currentYear = new Date().getUTCFullYear()
  const years = [...allYears]
    .filter((y) => y !== currentYear && (daysPerYear.get(y) ?? 0) >= 300)
    .sort((a, b) => a - b)
  const annualRain = years.map((y) => byYearRain.get(y) ?? 0)
  const heatDays = years.map((y) => byYearHeat.get(y) ?? 0)
  const growingWetness = years.map((y) => {
    const n = byYearWetN.get(y) ?? 0
    return n > 0 ? (byYearWetSum.get(y) ?? 0) / n : 0
  })
  const meanTmax = years.map((y) => {
    const n = byYearTmaxN.get(y) ?? 0
    return n > 0 ? (byYearTmaxSum.get(y) ?? 0) / n : 0
  })

  const linSlope = (ys: number[]): number => {
    const n = ys.length
    if (n < 3) return 0
    const xs = ys.map((_, i) => i)
    const mx = xs.reduce((a, b) => a + b, 0) / n
    const my = ys.reduce((a, b) => a + b, 0) / n
    let numr = 0
    let den = 0
    for (let i = 0; i < n; i++) {
      numr += (xs[i] - mx) * (ys[i] - my)
      den += (xs[i] - mx) ** 2
    }
    return den > 0 ? (numr / den) * 10 : 0 // per decade
  }

  // ---- Wet-season onset per season -------------------------------------
  // The first day inside the wet-season window with 20 mm or more of rain in
  // the preceding week — the "planting rain" farmers actually wait for.
  // Stored as an offset (days) from the start of the season's window so that
  // seasons in different years can be compared directly.
  const ONSET_RAIN_MM = 20
  const win = wetSeasonMonths.length ? wetSeasonMonths : [9, 10, 11]
  const wraps = win.some((m) => m >= 10) && win.some((m) => m <= 2)
  const onsetOffsets = new Map<number, number>() // season year → days into the window
  {
    const keys = Object.keys(rain).sort()
    const rainOf = keys.map((k) => num(rain[k]) ?? 0)
    for (let i = 0; i < keys.length; i++) {
      const d = keys[i]
      const mo = Number(d.slice(4, 6)) - 1
      if (!win.includes(mo)) continue
      const yr = Number(d.slice(0, 4))
      const season = wraps ? (mo >= 10 ? yr + 1 : yr) : yr
      if (onsetOffsets.has(season)) continue
      let sum = 0
      for (let k = Math.max(0, i - 6); k <= i; k++) sum += rainOf[k]
      if (sum >= ONSET_RAIN_MM) {
        // The season starts in the window's first month; a window that wraps
        // the year boundary (Nov–Jan) starts in November of the prior year.
        const startMonth = wraps ? Math.min(...win.filter((m) => m >= 10)) : Math.min(...win)
        const startYear = wraps && mo >= 10 ? yr : yr - 1
        const start = Date.UTC(startYear, startMonth, 1)
        const day = Date.UTC(yr, mo, Number(d.slice(6, 8)))
        onsetOffsets.set(season, Math.round((day - start) / 86400000))
      }
    }
  }
  const onsetSeasons = [...onsetOffsets.keys()].sort((a, b) => a - b)
  const onsetValues = onsetSeasons.map((s) => onsetOffsets.get(s)!)
  const medianOf = (xs: number[]): number => {
    if (!xs.length) return 0
    const s = [...xs].sort((a, b) => a - b)
    const m = Math.floor(s.length / 2)
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
  }
  const onsetThenOffset = medianOf(onsetValues.slice(0, Math.min(5, onsetValues.length)))
  const onsetNowOffset = medianOf(onsetValues.slice(-Math.min(5, onsetValues.length)))
  const onsetShiftDays = Math.round(onsetNowOffset - onsetThenOffset)

  /** Turn an offset (days into the season window) into a readable date. */
  const onsetLabel = (offset: number): string | null => {
    if (!offset && offset !== 0) return null
    const startMonth = wraps ? Math.min(...win.filter((m) => m >= 10)) : Math.min(...win)
    const base = Date.UTC(2019, startMonth, 1)
    const d = new Date(base + offset * 86400000)
    return `${d.getUTCDate()} ${MONTH_LABELS[d.getUTCMonth()]}`
  }

  const recent = annualRain.slice(-5)
  const histMean = annualRain.reduce((a, b) => a + b, 0) / Math.max(1, annualRain.length)
  const recentMean = recent.reduce((a, b) => a + b, 0) / Math.max(1, recent.length)

  // Then (first 5 complete years) vs Now (last 5)
  const first5 = <T,>(xs: T[]): T[] => xs.slice(0, Math.min(5, xs.length))
  const last5 = <T,>(xs: T[]): T[] => xs.slice(-Math.min(5, xs.length))
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length)
  const thenRain = mean(first5(annualRain))
  const nowRain = mean(last5(annualRain))
  const thenWet = mean(first5(growingWetness))
  const nowWet = mean(last5(growingWetness))
  const thenHot = mean(first5(heatDays))
  const nowHot = mean(last5(heatDays))
  const thenTmax = mean(first5(meanTmax))
  const nowTmax = mean(last5(meanTmax))

  // Recent observed window (last 7 available days, POWER lags ~1 week)
  const dateKeys = Object.keys(rain).sort()
  const lastDates = dateKeys.slice(-7)
  let recentRain = 0
  let recentWetSum = 0
  let recentWetN = 0
  let recentTmaxMax = -999
  for (const d of lastDates) {
    const rn = num(rain[d])
    if (rn !== null) recentRain += rn
    const wn = num(wet[d])
    if (wn !== null) {
      recentWetSum += wn
      recentWetN++
    }
    const tn = num(tmax[d])
    if (tn !== null) recentTmaxMax = Math.max(recentTmaxMax, tn)
  }

  return {
    years,
    annualRain,
    heatDays,
    growingWetness,
    meanTmax,
    rainSlopePerDecade: linSlope(annualRain),
    heatDaysSlopePerDecade: linSlope(heatDays),
    recentVsHistoricalRain: histMean > 0 ? recentMean / histMean - 1 : 0,
    thenNow: {
      yearsSpan: years.length ? years[years.length - 1] - years[0] : 0,
      rainPct: thenRain > 0 ? (nowRain / thenRain - 1) * 100 : 0,
      wetnessDelta: nowWet - thenWet,
      hotDaysDelta: nowHot - thenHot,
      tmaxDelta: nowTmax - thenTmax,
      onsetShiftDays,
      onsetThen: onsetLabel(onsetThenOffset),
      onsetNow: onsetLabel(onsetNowOffset),
    },
    recent: {
      days: lastDates.length,
      rainMm: recentRain,
      wetness: recentWetN > 0 ? recentWetSum / recentWetN : 0,
      tmaxMax: recentTmaxMax <= -900 ? 0 : recentTmaxMax,
    },
  }
}
