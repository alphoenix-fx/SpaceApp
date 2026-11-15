import { NDVI_LUT_COARSE, NDVI_LUT_FINE } from './ndviLut'

// ---------------------------------------------------------------------------
// NASA GIBS vegetation index (NDVI) sampled straight from the WMTS tiles.
//
// Two layers are used:
//   • MODIS_Terra_NDVI_8Day      — 250 m, 8-day composite (archive 2025+).
//     Gives the precise "right now" reading at the field.
//   • MODIS_Terra_L3_NDVI_16Day  — ~5 km, 16-day composite (archive 2000+).
//     Gives the same-fortnight history used to judge whether this season is
//     better or worse than usual.
//
// GIBS renders both with the shared MODIS NDVI colour ramp, so a sampled
// pixel colour can be inverted back to a real NDVI value (see ndviLut.ts).
// ---------------------------------------------------------------------------

const GIBS = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best'
const LAYER_NOW = 'MODIS_Terra_NDVI_8Day'
const LAYER_HISTORY = 'MODIS_Terra_L3_NDVI_16Day'
const TILE_Z = 9
const TILE_SIZE = 256

export interface NdviPoint {
  /** mean NDVI (0–1) of the sampled block */
  ndvi: number
  /** composite date actually used */
  date: string
  /** share of sampled pixels that carried valid data (0–1) */
  cover: number
}

export interface NdviPulse {
  /** high-resolution reading at the field (250 m) */
  now: NdviPoint | null
  /** district-scale reading for the same fortnight, one per past year */
  history: Array<{ year: number; ndvi: number }>
  /** mean of the past years */
  historyAvg: number
  /** % difference of the district-scale now-value vs the past-year mean */
  deltaPct: number | null
  /** true when the reading could not be retrieved at all */
  unavailable: boolean
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function addDays(d: Date, n: number): Date {
  const c = new Date(d.getTime())
  c.setUTCDate(c.getUTCDate() + n)
  return c
}

/** MODIS 16-day composite start dates run 1 Jan + 16k days. */
function l3Composite(date: Date): Date {
  const start = Date.UTC(date.getUTCFullYear(), 0, 1)
  const doy = Math.floor((date.getTime() - start) / 86400000) + 1
  const period = Math.floor((doy - 1) / 16) * 16
  return new Date(start + period * 86400000)
}

function tileCoords(lat: number, lon: number, z: number) {
  const n = 2 ** z
  const xf = ((lon + 180) / 360) * n
  const rad = (lat * Math.PI) / 180
  const yf = ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n
  const tx = Math.floor(xf)
  const ty = Math.floor(yf)
  return {
    tx,
    ty,
    px: Math.min(TILE_SIZE - 1, Math.max(0, Math.floor((xf - tx) * TILE_SIZE))),
    py: Math.min(TILE_SIZE - 1, Math.max(0, Math.floor((yf - ty) * TILE_SIZE))),
  }
}

/** Nearest colour in the GIBS NDVI ramp → NDVI value (null if unmatched). */
function invert(
  r: number,
  g: number,
  b: number,
  lut: ReadonlyArray<readonly [number, number, number, number, number]>,
): number | null {
  let best = Infinity
  let bestNdvi: number | null = null
  for (const [lr, lg, lb, ndvi] of lut) {
    const dr = r - lr
    const dg = g - lg
    const db = b - lb
    const d = dr * dr + dg * dg + db * db
    if (d < best) {
      best = d
      bestNdvi = ndvi
    }
  }
  // reject pixels that are nowhere near the ramp (clouds, water, borders)
  return best < 4000 ? bestNdvi : null
}

async function loadTile(
  layer: string,
  date: string,
  tx: number,
  ty: number,
): Promise<ImageData | null> {
  if (typeof document === 'undefined') return null
  const img = new Image()
  img.crossOrigin = 'anonymous'
  const ok = await new Promise<boolean>((resolve) => {
    const done = (v: boolean) => resolve(v)
    img.onload = () => done(true)
    img.onerror = () => done(false)
    setTimeout(() => done(false), 12000)
    img.src = `${GIBS}/${layer}/default/${date}/GoogleMapsCompatible_Level9/${TILE_Z}/${ty}/${tx}.png`
  })
  if (!ok) return null
  const canvas = document.createElement('canvas')
  canvas.width = TILE_SIZE
  canvas.height = TILE_SIZE
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  try {
    ctx.drawImage(img, 0, 0)
    return ctx.getImageData(0, 0, TILE_SIZE, TILE_SIZE)
  } catch {
    return null
  }
}

/** Mean NDVI of a small block around the point. */
function blockMean(
  data: ImageData,
  px: number,
  py: number,
  radius: number,
  lut: ReadonlyArray<readonly [number, number, number, number, number]>,
): { ndvi: number; cover: number } | null {
  let sum = 0
  let n = 0
  let valid = 0
  let total = 0
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const x = px + dx
      const y = py + dy
      if (x < 0 || y < 0 || x >= TILE_SIZE || y >= TILE_SIZE) continue
      total++
      const i = (y * TILE_SIZE + x) * 4
      if (data.data[i + 3] < 200) continue
      const ndvi = invert(data.data[i], data.data[i + 1], data.data[i + 2], lut)
      if (ndvi === null) continue
      sum += ndvi
      n++
      valid++
    }
  }
  if (!n || !total) return null
  return { ndvi: sum / n, cover: valid / total }
}

async function sampleLayer(
  layer: string,
  date: Date,
  lat: number,
  lon: number,
  radius: number,
  lut: ReadonlyArray<readonly [number, number, number, number, number]>,
  fallbackDays: number[] = [],
): Promise<NdviPoint | null> {
  const { tx, ty, px, py } = tileCoords(lat, lon, TILE_Z)
  const candidates = [date, ...fallbackDays.map((d) => addDays(date, d))]
  for (const cand of candidates) {
    const data = await loadTile(layer, iso(cand), tx, ty)
    if (!data) continue
    const mean = blockMean(data, px, py, radius, lut)
    if (!mean || mean.cover < 0.35) continue
    return { ndvi: mean.ndvi, date: iso(cand), cover: mean.cover }
  }
  return null
}

/**
 * Reads the vegetation signal at a point: a field-scale reading now plus the
 * same fortnight in the previous few years for comparison.
 */
export async function fetchNdviPulse(lat: number, lon: number): Promise<NdviPulse> {
  const today = new Date()
  const empty: NdviPulse = { now: null, history: [], historyAvg: 0, deltaPct: null, unavailable: true }

  // High-resolution reading at the field (250 m, 8-day composite).
  const now = await sampleLayer(LAYER_NOW, addDays(today, -6), lat, lon, 3, NDVI_LUT_FINE, [
    -6,
    -12,
    -20,
  ])

  // District-scale reading for the same fortnight each year (5 km, 16-day).
  const target = l3Composite(addDays(today, -24))
  const history: Array<{ year: number; ndvi: number }> = []
  let nowDistrict: number | null = null
  for (let back = 0; back <= 4; back++) {
    const year = target.getUTCFullYear() - back
    const date = new Date(Date.UTC(year, target.getUTCMonth(), target.getUTCDate()))
    const point = await sampleLayer(LAYER_HISTORY, date, lat, lon, 1, NDVI_LUT_COARSE, [-16])
    if (!point) continue
    if (back === 0) nowDistrict = point.ndvi
    else history.push({ year, ndvi: point.ndvi })
  }

  if (!now && !history.length) return empty

  const historyAvg = history.length
    ? history.reduce((a, h) => a + h.ndvi, 0) / history.length
    : 0
  const deltaPct =
    nowDistrict !== null && historyAvg > 0
      ? ((nowDistrict - historyAvg) / historyAvg) * 100
      : null

  return { now, history, historyAvg, deltaPct, unavailable: false }
}
