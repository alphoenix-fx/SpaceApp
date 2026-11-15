// ---------------------------------------------------------------------------
// Place lookup services used by the Field Console.
//
//  • reverseGeocode — names the farm: "Bothaville, Free State, South Africa"
//  • searchLocation — finds a farm by typing a place or pasting coordinates
//  • nearbyFarms    — lists real farms / cropland around the pin (OpenStreetMap)
//
// All three are best-effort: every caller must degrade gracefully when the
// network refuses.
// ---------------------------------------------------------------------------

export interface PlaceName {
  locality: string
  region: string
  country: string
  /** "Bothaville, Free State, South Africa" */
  title: string
}

interface BigDataCloudResponse {
  principalSubdivision?: string
  countryName?: string
  city?: string
  locality?: string
  localityInfo?: { informative?: Array<{ name?: string }> }
}

/** Name the coordinates the farmer picked. */
export async function reverseGeocode(
  lat: number,
  lon: number,
  signal?: AbortSignal,
): Promise<PlaceName | null> {
  const url =
    `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat.toFixed(5)}` +
    `&longitude=${lon.toFixed(5)}&localityLanguage=en`
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`Reverse geocode returned HTTP ${res.status}`)
  const data = (await res.json()) as BigDataCloudResponse
  const region = (data.principalSubdivision ?? '').trim()
  const country = (data.countryName ?? '').trim()
  const locality = (data.city ?? data.locality ?? '').trim()
  const parts = [locality, region, country].filter(
    (p, i, arr) => p.length > 0 && arr.indexOf(p) === i,
  )
  const title =
    parts.length > 0
      ? parts.join(', ')
      : (data.localityInfo?.informative?.[0]?.name?.trim() ?? '') ||
        `${lat.toFixed(2)}, ${lon.toFixed(2)}`
  return { locality, region, country, title }
}

export interface LocationHit {
  lat: number
  lon: number
  label: string
}

interface NominatimItem {
  lat: string
  lon: string
  display_name: string
}

/** Find a place by name, or parse "lat, lon" typed straight into the box. */
export async function searchLocation(
  query: string,
  signal?: AbortSignal,
): Promise<LocationHit | null> {
  const trimmed = query.trim()
  if (!trimmed) return null

  const coords = parseCoordinates(trimmed)
  if (coords) {
    const place = await reverseGeocode(coords.lat, coords.lon, signal).catch(() => null)
    return {
      ...coords,
      label: place?.title ?? `${coords.lat.toFixed(4)}, ${coords.lon.toFixed(4)}`,
    }
  }

  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(trimmed)}`
  const res = await fetch(url, {
    signal,
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`Location search returned HTTP ${res.status}`)
  const data = (await res.json()) as NominatimItem[]
  if (!Array.isArray(data) || !data.length) return null
  const first = data[0]
  const lat = parseFloat(first.lat)
  const lon = parseFloat(first.lon)
  if (Number.isNaN(lat) || Number.isNaN(lon)) return null
  return { lat, lon, label: first.display_name || trimmed }
}

/** Accepts "-28.32, 27.62" style input. */
export function parseCoordinates(input: string): { lat: number; lon: number } | null {
  const match = input.match(/^\s*(-?\d+(?:\.\d+)?)\s*[,\s]\s*(-?\d+(?:\.\d+)?)\s*$/)
  if (!match) return null
  const lat = parseFloat(match[1])
  const lon = parseFloat(match[2])
  if (Number.isNaN(lat) || Number.isNaN(lon)) return null
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null
  return { lat, lon }
}

// ---------------------------------------------------------------------------
// Nearby real farms (OpenStreetMap via Overpass)
// ---------------------------------------------------------------------------

export interface NearbyFarm {
  id: string
  name: string
  kind: 'farm' | 'cropland'
  /** crop tag from the OSM record, when present */
  crop?: string
  lat: number
  lon: number
}

interface OverpassElement {
  type: 'node' | 'way' | 'relation'
  id: number
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  tags?: Record<string, string>
}

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
]

/** Farms and cropland within `radiusMeters` of the pin. */
export async function nearbyFarms(
  lat: number,
  lon: number,
  radiusMeters = 15000,
  signal?: AbortSignal,
): Promise<NearbyFarm[]> {
  const query = `[out:json][timeout:20];
(
  node["place"="farm"](around:${radiusMeters},${lat.toFixed(4)},${lon.toFixed(4)});
  way["place"="farm"](around:${radiusMeters},${lat.toFixed(4)},${lon.toFixed(4)});
  way["landuse"="farmland"](around:${radiusMeters},${lat.toFixed(4)},${lon.toFixed(4)});
);
out center 45;`

  let lastError: Error | null = null
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
        body: `data=${encodeURIComponent(query)}`,
        signal,
      })
      if (!res.ok) {
        lastError = new Error(`Overpass API returned HTTP ${res.status}`)
        continue
      }
      const data = (await res.json()) as { elements?: OverpassElement[] }
      return toFarms(data.elements ?? [])
    } catch (err) {
      if ((err as { name?: string })?.name === 'AbortError') throw err
      lastError = err instanceof Error ? err : new Error('Overpass request failed')
    }
  }
  throw lastError ?? new Error('Unable to reach the OpenStreetMap Overpass API')
}

function toFarms(elements: OverpassElement[]): NearbyFarm[] {
  // named places first so the map reads like a farm list, not a scatter
  const sorted = [...elements].sort((a, b) => {
    const weight = (e: OverpassElement) =>
      (e.tags?.name ? 2 : 0) + (e.tags?.place === 'farm' ? 1 : 0)
    return weight(b) - weight(a)
  })

  const out: NearbyFarm[] = []
  for (const el of sorted) {
    const lat = typeof el.lat === 'number' ? el.lat : el.center?.lat
    const lon = typeof el.lon === 'number' ? el.lon : el.center?.lon
    if (typeof lat !== 'number' || typeof lon !== 'number') continue
    // drop near-duplicate centroids so the map stays readable
    if (out.some((p) => Math.abs(p.lat - lat) < 0.0025 && Math.abs(p.lon - lon) < 0.0025)) continue
    const tags = el.tags ?? {}
    const isFarm = tags.place === 'farm'
    const crop = tags.crop ?? tags.produce
    const cropLabel = crop ? crop.charAt(0).toUpperCase() + crop.slice(1) : undefined
    const name =
      tags.name?.trim() ??
      (isFarm
        ? `Local farmstead #${out.length + 1}`
        : cropLabel
          ? `${cropLabel} plot #${out.length + 1}`
          : `Cropland plot #${out.length + 1}`)
    out.push({
      id: `${el.type}-${el.id}`,
      name,
      kind: isFarm ? 'farm' : 'cropland',
      crop: cropLabel,
      lat: +lat.toFixed(5),
      lon: +lon.toFixed(5),
    })
    if (out.length >= 18) break
  }
  return out
}
