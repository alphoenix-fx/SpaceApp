import type { ClimateFeatures } from './types'

// ---------------------------------------------------------------------------
// 14-day outlook.
//
// NASA POWER provides the *climatology* (what is normal for this week of the
// year); the forward-looking numbers come from the ECMWF/NOAA blend served by
// Open-Meteo, which is CORS-enabled and keyless. The card always shows the
// forecast next to the POWER normal so the farmer sees "normal for here" and
// "what is coming" side by side.
// ---------------------------------------------------------------------------

export interface ForecastDay {
  date: string
  rainMm: number
  tmax: number
  tmin: number
}

export interface Outlook {
  days: number
  rainMm: number
  /** climatological rain expected over the same 14 days (NASA POWER normals) */
  normalRainMm: number
  hotDays: number
  veryHotDays: number
  maxTmax: number
  minTmin: number
  wetDays: number
  longestDrySpell: number
  daily: ForecastDay[]
}

interface ForecastResponse {
  daily?: {
    time?: string[]
    precipitation_sum?: Array<number | null>
    temperature_2m_max?: Array<number | null>
    temperature_2m_min?: Array<number | null>
  }
}

const DAYS = 14

function normalRainFor(climate: ClimateFeatures, dates: string[]): number {
  if (!dates.length) return 0
  let total = 0
  for (const d of dates) {
    const dt = new Date(d)
    const mi = dt.getUTCMonth()
    const daysInMonth = new Date(Date.UTC(dt.getUTCFullYear(), mi + 1, 0)).getUTCDate()
    total += (climate.monthly.P[mi] ?? 0) / daysInMonth
  }
  return total
}

/**
 * Fetches the 14-day outlook. Returns null when the forecast service cannot
 * be reached — the card then falls back to climatology only.
 */
export async function fetchOutlook(
  lat: number,
  lon: number,
  climate: ClimateFeatures,
): Promise<Outlook | null> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}` +
    `&daily=precipitation_sum,temperature_2m_max,temperature_2m_min&forecast_days=${DAYS}` +
    `&timezone=UTC`

  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const json = (await res.json()) as ForecastResponse
    const d = json.daily
    if (!d?.time?.length) return null

    const daily: ForecastDay[] = d.time.map((date, i) => ({
      date,
      rainMm: d.precipitation_sum?.[i] ?? 0,
      tmax: d.temperature_2m_max?.[i] ?? 0,
      tmin: d.temperature_2m_min?.[i] ?? 0,
    }))

    let dry = 0
    let longestDry = 0
    let hotDays = 0
    let veryHotDays = 0
    let wetDays = 0
    for (const day of daily) {
      if (day.rainMm < 1) {
        dry++
        longestDry = Math.max(longestDry, dry)
      } else {
        dry = 0
        wetDays++
      }
      if (day.tmax > 32) hotDays++
      if (day.tmax > 35) veryHotDays++
    }

    const rainMm = daily.reduce((a, x) => a + x.rainMm, 0)
    return {
      days: daily.length,
      rainMm,
      normalRainMm: normalRainFor(climate, daily.map((x) => x.date)),
      hotDays,
      veryHotDays,
      maxTmax: Math.max(...daily.map((x) => x.tmax)),
      minTmin: Math.min(...daily.map((x) => x.tmin)),
      wetDays,
      longestDrySpell: longestDry,
      daily,
    }
  } catch {
    return null
  }
}
