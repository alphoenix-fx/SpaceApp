import type { FarmPreset } from './types'

// ---------------------------------------------------------------------------
// Demo farm presets across South Africa's main production regions.
// Coordinates are representative of the region, not real farms.
// ---------------------------------------------------------------------------

export const PRESETS: FarmPreset[] = [
  {
    id: 'freestate',
    name: 'Free State maize belt',
    blurb:
      'Dryland maize country near Senekal. Deep soils, summer thunderstorms, big frost risk in winter.',
    lat: -28.32,
    lon: 27.62,
    regime: 'summer-rain',
    currentRotation: ['maize', 'maize', 'soybean', 'fallow'],
    soil: 'clayLoam',
  },
  {
    id: 'northwest',
    name: 'North West bushveld margins',
    blurb:
      'Drier, sandier maize–sunflower country around Lichtenburg where water is the binding constraint.',
    lat: -26.15,
    lon: 26.15,
    regime: 'summer-rain',
    currentRotation: ['maize', 'sunflower', 'maize', 'fallow'],
    soil: 'sandyLoam',
  },
  {
    id: 'swartland',
    name: 'Swartland, Western Cape',
    blurb:
      'Winter-rain wheat region around Moorreesburg — the home of South Africa’s conservation-agriculture rotation.',
    lat: -33.16,
    lon: 18.66,
    regime: 'winter-rain',
    currentRotation: ['wheat', 'wheat', 'canola', 'wheat'],
    soil: 'sandyLoam',
  },
  {
    id: 'vaalharts',
    name: 'Vaalharts irrigation scheme, Northern Cape',
    blurb:
      'Irrigated pivots on the Vaal River — maize, groundnut and lucerne with plenty of heat and cloudless skies.',
    lat: -27.98,
    lon: 24.75,
    regime: 'summer-rain',
    currentRotation: ['maize', 'groundnut', 'lucerne', 'lucerne'],
    soil: 'sand',
    irrigated: true,
  },
  {
    id: 'kzn',
    name: 'KZN Midlands dairy belt',
    blurb:
      'Frosty highland grasslands near Howick — silage maize and winter forage for the dairy industry.',
    lat: -29.48,
    lon: 30.22,
    regime: 'summer-rain',
    currentRotation: ['maize', 'triticale', 'maize', 'oats'],
    soil: 'clayLoam',
  },
]
