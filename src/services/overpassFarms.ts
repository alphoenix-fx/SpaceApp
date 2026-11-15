export interface OverpassFarmPin {
  id: string;
  name: string;
  category: 'farm' | 'farmland';
  cropTag?: string;
  lat: number;
  lon: number;
}

interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: {
    lat: number;
    lon: number;
  };
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements?: OverpassElement[];
}

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
];

export async function scanLocalFarmsOverpass(
  centerLat: number,
  centerLon: number,
  radiusMeters = 15000,
  signal?: AbortSignal
): Promise<OverpassFarmPin[]> {
  const query = `[out:json][timeout:20];
(
  node["place"="farm"](around:${radiusMeters},${centerLat.toFixed(4)},${centerLon.toFixed(4)});
  way["place"="farm"](around:${radiusMeters},${centerLat.toFixed(4)},${centerLon.toFixed(4)});
  way["landuse"="farmland"](around:${radiusMeters},${centerLat.toFixed(4)},${centerLon.toFixed(4)});
  relation["landuse"="farmland"](around:${radiusMeters},${centerLat.toFixed(4)},${centerLon.toFixed(4)});
);
out center 45;`;

  let lastError: Error | null = null;
  let data: OverpassResponse | null = null;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        },
        body: `data=${encodeURIComponent(query)}`,
        signal,
      });

      if (!response.ok) {
        lastError = new Error(`Overpass API returned HTTP ${response.status}`);
        continue;
      }

      data = (await response.json()) as OverpassResponse;
      break;
    } catch (err: unknown) {
      if ((err as { name?: string })?.name === 'AbortError') throw err;
      lastError = err instanceof Error ? err : new Error('Overpass request failed');
    }
  }

  if (!data) {
    throw lastError || new Error('Unable to reach OpenStreetMap Overpass API');
  }

  const rawElements = data.elements || [];

  // Prioritize named farms and place=farm nodes/ways first
  const sorted = [...rawElements].sort((a, b) => {
    const aNamed = a.tags?.name ? 2 : 0;
    const bNamed = b.tags?.name ? 2 : 0;
    const aPlace = a.tags?.place === 'farm' ? 1 : 0;
    const bPlace = b.tags?.place === 'farm' ? 1 : 0;
    return bNamed + bPlace - (aNamed + aPlace);
  });

  const pins: OverpassFarmPin[] = [];

  for (const el of sorted) {
    const lat = typeof el.lat === 'number' ? el.lat : el.center?.lat;
    const lon = typeof el.lon === 'number' ? el.lon : el.center?.lon;
    if (typeof lat !== 'number' || typeof lon !== 'number') continue;

    // Deduplicate tightly clustered centroids (~250m) so pins stay readable
    const tooClose = pins.some(
      (p) => Math.abs(p.lat - lat) < 0.0025 && Math.abs(p.lon - lon) < 0.0025
    );
    if (tooClose) continue;

    const tags = el.tags || {};
    const isPlaceFarm = tags.place === 'farm';
    const cropTag = tags.crop || tags.produce;
    const rawName = tags.name?.trim();
    const formattedCrop = cropTag
      ? cropTag.charAt(0).toUpperCase() + cropTag.slice(1)
      : null;

    const name = rawName
      ? rawName
      : isPlaceFarm
        ? `Local Farmstead #${pins.length + 1}`
        : formattedCrop
          ? `${formattedCrop} Plot #${pins.length + 1}`
          : `Cropland Plot #${pins.length + 1}`;

    pins.push({
      id: `${el.type}-${el.id}`,
      name,
      category: isPlaceFarm ? 'farm' : 'farmland',
      cropTag: formattedCrop || undefined,
      lat: +lat.toFixed(5),
      lon: +lon.toFixed(5),
    });

    if (pins.length >= 24) break;
  }

  return pins;
}
