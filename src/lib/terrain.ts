import type { TerrainInfo } from './types'

// ---------------------------------------------------------------------------
// Elevation sampling via the Open-Meteo Elevation API (Copernicus DEM GLO-90,
// open API, CORS-enabled, keyless — OpenTopoData/SRTM dropped CORS in late
// 2026). We sample the field centre + 8 surrounding points and estimate the
// steepest local gradient — a practical erosion-risk proxy without needing
// Earthdata authentication.
// ---------------------------------------------------------------------------

const OTD = 'https://api.open-meteo.com/v1/elevation'

/** Offsets in metres: centre + two rings around it */
const OFFSETS: Array<[number, number]> = [
  [0, 0],
  [90, 0],
  [-90, 0],
  [0, 90],
  [0, -90],
  [64, 64],
  [-64, 64],
  [64, -64],
  [-64, -64],
  [180, 0],
  [-180, 0],
  [0, 180],
  [0, -180],
]

export async function fetchTerrain(lat: number, lon: number): Promise<TerrainInfo> {
  const mPerDegLat = 111_320
  const mPerDegLon = 111_320 * Math.cos((lat * Math.PI) / 180)
  const lats: string[] = []
  const lons: string[] = []
  for (const [dy, dx] of OFFSETS) {
    lats.push((lat + dy / mPerDegLat).toFixed(6))
    lons.push((lon + dx / mPerDegLon).toFixed(6))
  }

  const url = `${OTD}?latitude=${lats.join(',')}&longitude=${lons.join(',')}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Elevation request failed (${res.status})`)
  const data = (await res.json()) as { elevation?: Array<number> }
  if (!data.elevation?.length || data.elevation.length !== OFFSETS.length)
    throw new Error('Elevation data unavailable')

  const elev = data.elevation
  let maxSlope = 0
  for (let i = 1; i < elev.length; i++) {
    const run = Math.hypot(OFFSETS[i][0], OFFSETS[i][1])
    if (run === 0) continue
    const slope = (Math.abs(elev[i] - elev[0]) / run) * 100
    maxSlope = Math.max(maxSlope, slope)
  }

  const slopeClass =
    maxSlope < 2 ? 'flat' : maxSlope < 5 ? 'gentle' : maxSlope < 9 ? 'moderate' : 'steep'

  const erosionRelevance =
    slopeClass === 'flat'
      ? 'Almost level ground — water erosion risk is low as long as soil is covered.'
      : slopeClass === 'gentle'
        ? 'Gently sloping — keep cover through heavy-rain months and avoid up-down-slope tillage.'
        : slopeClass === 'moderate'
          ? 'Sloping ground — cover crops and contour practices really pay off here.'
          : 'Steep ground — high runoff and erosion risk; permanent cover or terracing strongly advised.'

  return { slopePercent: Math.round(maxSlope * 10) / 10, slopeClass, erosionRelevance, source: 'dem' }
}

export function manualTerrain(slopePercent: number): TerrainInfo {
  const slopeClass =
    slopePercent < 2 ? 'flat' : slopePercent < 5 ? 'gentle' : slopePercent < 9 ? 'moderate' : 'steep'
  return {
    slopePercent,
    slopeClass,
    erosionRelevance:
      slopeClass === 'flat'
        ? 'Almost level ground — water erosion risk is low as long as soil is covered.'
        : slopeClass === 'gentle'
          ? 'Gently sloping — keep cover through heavy-rain months and avoid up-down-slope tillage.'
          : slopeClass === 'moderate'
            ? 'Sloping ground — cover crops and contour practices really pay off here.'
            : 'Steep ground — high runoff and erosion risk; permanent cover or terracing strongly advised.',
    source: 'manual',
  }
}
