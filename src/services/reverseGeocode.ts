export interface ReverseGeocodeResult {
  principalSubdivision: string;
  countryName: string;
  locality: string;
  displayTitle: string;
}

interface BigDataCloudResponse {
  principalSubdivision?: string;
  countryName?: string;
  city?: string;
  locality?: string;
  localityInfo?: {
    informative?: Array<{ name?: string; description?: string }>;
  };
}

export async function reverseGeocodeCoordinate(
  lat: number,
  lon: number,
  signal?: AbortSignal
): Promise<ReverseGeocodeResult | null> {
  const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${encodeURIComponent(
    lat
  )}&longitude=${encodeURIComponent(lon)}&localityLanguage=en`;

  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`Reverse geocode returned HTTP ${response.status}`);
  }

  const data: BigDataCloudResponse = await response.json();
  const principalSubdivision = (data.principalSubdivision || '').trim();
  const countryName = (data.countryName || '').trim();
  const locality = (data.city || data.locality || '').trim();

  const uniqueParts = [locality, principalSubdivision, countryName].filter(
    (part, idx, arr) => Boolean(part) && arr.indexOf(part) === idx
  );

  let displayTitle = '';
  if (uniqueParts.length > 0) {
    displayTitle = uniqueParts.join(', ');
  } else {
    const oceanOrRegion = data.localityInfo?.informative?.[0]?.name?.trim();
    displayTitle = oceanOrRegion || 'Offshore / Unmapped Sector';
  }

  return {
    principalSubdivision,
    countryName,
    locality,
    displayTitle,
  };
}

export interface GlobalGeocodeResult {
  lat: number;
  lon: number;
  displayName: string;
}

interface NominatimSearchItem {
  lat: string;
  lon: string;
  display_name: string;
}

export async function searchGlobalLocation(
  query: string,
  signal?: AbortSignal
): Promise<GlobalGeocodeResult | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;

  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
    trimmed
  )}&limit=1`;

  const response = await fetch(url, {
    signal,
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Location search returned HTTP ${response.status}`);
  }

  const data: NominatimSearchItem[] = await response.json();
  if (!Array.isArray(data) || data.length === 0) {
    return null;
  }

  const first = data[0];
  const lat = parseFloat(first.lat);
  const lon = parseFloat(first.lon);
  if (Number.isNaN(lat) || Number.isNaN(lon)) {
    return null;
  }

  return {
    lat,
    lon,
    displayName: first.display_name || trimmed,
  };
}
