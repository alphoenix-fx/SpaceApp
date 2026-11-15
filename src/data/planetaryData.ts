export type PlanetaryMode = 'earth' | 'mars' | 'moon';

export type MapLayerId = 'layer_a' | 'layer_b' | 'layer_c';

export interface TelemetryMetric {
  id: string;
  label: string;
  valueLabel: string;
  progress: number; // 0 to 100
  tone: 'emerald' | 'amber' | 'coral' | 'cyan';
  icon: 'droplets' | 'thermometer' | 'rain' | 'slope' | 'ice' | 'sun';
}

export interface AlternativeCrop {
  name: string;
  matchPercent: number;
  note: string;
}

export interface TrendPoint {
  year: number;
  primaryValue: number; // Temp °C on Earth, Dust/Thermal Index on Mars/Moon
  secondaryValue: number; // Rainfall mm on Earth, Solar/Ice Signal on Mars/Moon
}

export interface CropProfile {
  name: string;
  suitabilityIndex: number;
  verdictLabel: string;
  verdictTone: 'coral' | 'amber' | 'emerald';
  summary: string;
}

export interface PlanetarySite {
  id: string;
  planet: PlanetaryMode;
  name: string;
  region: string;
  coordinates: string;
  lat: number;
  lon: number;
  areaLabel: string;
  pinX: number; // 0..1000 in 16:9 SVG viewBox
  pinY: number; // 0..562.5 in 16:9 SVG viewBox
  polygonPoints: string; // SVG points string in 1000x562.5 space
  defaultOption: string;
  optionLabel: string;
  options: Record<string, CropProfile>;
  suitabilityTitle: string;
  telemetry: TelemetryMetric[];
  alternativesHeading: string;
  alternatives: AlternativeCrop[];
  rotationHeading: string;
  rotationSteps: [string, string];
  trendTitle: string;
  primarySeriesLabel: string;
  primarySeriesUnit: string;
  secondarySeriesLabel: string;
  secondarySeriesUnit: string;
  trend: TrendPoint[];
  /**
   * Measured terrain slope in degrees, from the NASA orbital altimetry /
   * stereo DTMs listed for each body (MOLA, LOLA, HiRISE/CTX, LROC NAC).
   * Drives the vertical-farming suitability mask.
   */
  slopeDeg?: number;
  /** Radius of the contiguous flat plain around the site, in km. */
  flatZoneKm?: number;
}

export interface MapLayerConfig {
  id: MapLayerId;
  label: string;
  shortCode: string;
  description: string;
  colorStopLow: string;
  colorStopHigh: string;
  legendMin: string;
  legendMax: string;
}

export const PLANET_ASSETS: Record<
  PlanetaryMode,
  {
    name: string;
    subtitle: string;
    imageUrl: string;
    fallbackGradient: string;
    layers: MapLayerConfig[];
    scaleLabel: string;
  }
> = {
  earth: {
    name: 'Earth Observation Sector',
    subtitle: 'Landsat-9 / SMAP / GPM Composite',
    imageUrl: '/src/assets/images/earth_satellite_terrain_1794721233469.jpg',
    fallbackGradient: 'linear-gradient(135deg, #1e293b 0%, #334155 45%, #1e3a2f 100%)',
    scaleLabel: '2.5 km',
    layers: [
      {
        id: 'layer_a',
        label: 'Soil Moisture (SMAP)',
        shortCode: 'SMAP L4',
        description: 'Root-zone volumetric water content (0–100 cm)',
        colorStopLow: '#f97316',
        colorStopHigh: '#06b6d4',
        legendMin: '8% Dry',
        legendMax: '42% Wet',
      },
      {
        id: 'layer_b',
        label: 'Vegetation Health (NDVI)',
        shortCode: 'NDVI',
        description: 'Normalized difference vegetation vigor index',
        colorStopLow: '#eab308',
        colorStopHigh: '#10b981',
        legendMin: '0.18 Sparse',
        legendMax: '0.82 Dense',
      },
      {
        id: 'layer_c',
        label: 'Rainfall (GPM)',
        shortCode: 'GPM IMERG',
        description: '90-day accumulated precipitation anomaly',
        colorStopLow: '#94a3b8',
        colorStopHigh: '#2563eb',
        legendMin: '240 mm',
        legendMax: '780 mm',
      },
    ],
  },
  mars: {
    name: 'Mars · NASA Trek Orbital Map',
    subtitle: 'Viking MDIM 2.1 Color Global Mosaic (232 m/px)',
    imageUrl: '/src/assets/images/mars_arcadia_terrain_1794721234697.jpg',
    fallbackGradient: 'linear-gradient(135deg, #451a12 0%, #7c2d12 50%, #3b170e 100%)',
    scaleLabel: '250 km',
    layers: [
      {
        id: 'layer_a',
        label: 'Subsurface Water Ice (SHARAD)',
        shortCode: 'SHARAD',
        description: 'Shallow radar dielectric ice sheet thickness',
        colorStopLow: '#b45309',
        colorStopHigh: '#38bdf8',
        legendMin: '4.5m Deep',
        legendMax: '0.8m Shallow',
      },
      {
        id: 'layer_b',
        label: 'Terrain Slope (MOLA)',
        shortCode: 'MOLA',
        description: 'Orbital laser altimetry landing grade',
        colorStopLow: '#10b981',
        colorStopHigh: '#ef4444',
        legendMin: '0.5° Flat',
        legendMax: '18° Steep',
      },
      {
        id: 'layer_c',
        label: 'Solar Exposure (THEMIS)',
        shortCode: 'THEMIS',
        description: 'Mean diurnal surface irradiance potential',
        colorStopLow: '#64748b',
        colorStopHigh: '#f59e0b',
        legendMin: '340 W/m²',
        legendMax: '590 W/m²',
      },
    ],
  },
  moon: {
    name: 'Moon · NASA LRO Trek Orbital Map',
    subtitle: 'LRO WAC Global Mosaic (303 ppd)',
    imageUrl: '/src/assets/images/moon_shackleton_terrain_1794721234515.jpg',
    fallbackGradient: 'linear-gradient(135deg, #0f172a 0%, #334155 50%, #090d16 100%)',
    scaleLabel: '200 km',
    layers: [
      {
        id: 'layer_a',
        label: 'Regolith Hydration (LRO)',
        shortCode: 'LEND',
        description: 'Epithermal neutron hydrogen concentration',
        colorStopLow: '#475569',
        colorStopHigh: '#22d3ee',
        legendMin: '0.2 wt%',
        legendMax: '4.6 wt%',
      },
      {
        id: 'layer_b',
        label: 'Crater Rim Slope (LOLA)',
        shortCode: 'LOLA',
        description: 'Topographic grade stability for outpost anchors',
        colorStopLow: '#10b981',
        colorStopHigh: '#f43f5e',
        legendMin: '1.2° Safe',
        legendMax: '18° Rim',
      },
      {
        id: 'layer_c',
        label: 'Solar Illumination',
        shortCode: 'SOLAR',
        description: 'Annual peaks-of-eternal-light duty cycle',
        colorStopLow: '#1e293b',
        colorStopHigh: '#fbbf24',
        legendMin: '18% Low',
        legendMax: '88% Peak',
      },
    ],
  },
};

export interface BenchmarkFarm {
  id: string;
  name: string;
  regionLabel: string;
  lat: number;
  lon: number;
  defaultCrop: 'Maize' | 'Wheat' | 'Rice';
}

export const BENCHMARK_FARMS: BenchmarkFarm[] = [
  {
    id: 'bench-bothaville',
    name: 'Bothaville Maize Belt, South Africa',
    regionLabel: 'Free State · Maize Hub',
    lat: -27.38,
    lon: 26.62,
    defaultCrop: 'Maize',
  },
  {
    id: 'bench-central-valley',
    name: 'Central Valley, California',
    regionLabel: 'San Joaquin Basin · Irrigated',
    lat: 36.74,
    lon: -119.78,
    defaultCrop: 'Wheat',
  },
  {
    id: 'bench-ames-iowa',
    name: 'Ames Grain Belt, Iowa',
    regionLabel: 'US Corn Belt · Mollisol Plain',
    lat: 42.03,
    lon: -93.62,
    defaultCrop: 'Maize',
  },
  {
    id: 'bench-mekong-delta',
    name: 'Mekong Delta, Vietnam',
    regionLabel: 'Can Tho Basin · Paddy Zone',
    lat: 10.03,
    lon: 105.78,
    defaultCrop: 'Rice',
  },
  {
    id: 'bench-punjab-india',
    name: 'Punjab Plains, India',
    regionLabel: 'Ludhiana Belt · Alluvial',
    lat: 30.9,
    lon: 75.85,
    defaultCrop: 'Wheat',
  },
];

export const PLANETARY_SITES: PlanetarySite[] = [
  // ================= EARTH SITES =================
  {
    id: 'earth-rift-a07',
    planet: 'earth',
    name: 'Rift Valley Plot A-07',
    region: 'Nakuru Basin · East Africa',
    coordinates: '0.42°S, 36.18°E',
    lat: -0.42,
    lon: 36.18,
    areaLabel: '142.5 ha',
    pinX: 405,
    pinY: 362,
    polygonPoints: '342,315 446,310 462,402 355,412',
    defaultOption: 'Maize',
    optionLabel: 'Current Crop',
    suitabilityTitle: 'Suitability Index',
    options: {
      Maize: {
        name: 'Maize',
        suitabilityIndex: 48,
        verdictLabel: 'High Risk (Shift Recommended)',
        verdictTone: 'coral',
        summary:
          'Rising seasonal heat (+2.1°C) and depleted root-zone soil moisture have pushed Maize below viable yield thresholds.',
      },
      Sorghum: {
        name: 'Sorghum',
        suitabilityIndex: 92,
        verdictLabel: 'Optimal Fit',
        verdictTone: 'emerald',
        summary:
          'Deep taproot tolerance and C4 stomatal efficiency align closely with current 15% soil moisture and 28.5°C temperatures.',
      },
      Cowpeas: {
        name: 'Cowpeas',
        suitabilityIndex: 87,
        verdictLabel: 'Strong Fit',
        verdictTone: 'emerald',
        summary:
          'Drought-hardy nitrogen fixation thrives under 410mm rainfall while restoring depleted topsoil structure.',
      },
      Millet: {
        name: 'Millet',
        suitabilityIndex: 84,
        verdictLabel: 'Resilient Match',
        verdictTone: 'emerald',
        summary:
          'Short 75-day maturation window avoids late-season moisture deficit and maintains stable grain fill at 28.5°C.',
      },
      Wheat: {
        name: 'Wheat',
        suitabilityIndex: 34,
        verdictLabel: 'Critical Heat Stress',
        verdictTone: 'coral',
        summary:
          'Elevated mean night temperatures and sub-450mm rainfall create severe sterility risk during anthesis.',
      },
    },
    telemetry: [
      {
        id: 'soil-moisture',
        label: 'Root-Zone Soil Moisture',
        valueLabel: '15% - Low',
        progress: 15,
        tone: 'coral',
        icon: 'droplets',
      },
      {
        id: 'avg-temp',
        label: 'Avg Temperature',
        valueLabel: '28.5°C - +2.1°C Shift',
        progress: 78,
        tone: 'amber',
        icon: 'thermometer',
      },
      {
        id: 'rainfall',
        label: 'Seasonal Rainfall',
        valueLabel: '410mm - Below Avg',
        progress: 38,
        tone: 'coral',
        icon: 'rain',
      },
    ],
    alternativesHeading: 'Recommended Alternatives',
    alternatives: [
      { name: 'Sorghum', matchPercent: 92, note: 'Heat & drought resilient' },
      { name: 'Cowpeas', matchPercent: 87, note: 'Nitrogen-fixing legume' },
    ],
    rotationHeading: '2-Season Rotation Plan',
    rotationSteps: ['Season 1: Sorghum', 'Season 2: Cowpeas'],
    trendTitle: '10-Year Trend (2016–2026)',
    primarySeriesLabel: 'Avg Temp',
    primarySeriesUnit: '°C',
    secondarySeriesLabel: 'Rainfall',
    secondarySeriesUnit: 'mm',
    trend: [
      { year: 2016, primaryValue: 26.4, secondaryValue: 590 },
      { year: 2017, primaryValue: 26.6, secondaryValue: 572 },
      { year: 2018, primaryValue: 26.8, secondaryValue: 558 },
      { year: 2019, primaryValue: 27.1, secondaryValue: 534 },
      { year: 2020, primaryValue: 27.3, secondaryValue: 515 },
      { year: 2021, primaryValue: 27.6, secondaryValue: 492 },
      { year: 2022, primaryValue: 27.8, secondaryValue: 470 },
      { year: 2023, primaryValue: 28.0, secondaryValue: 452 },
      { year: 2024, primaryValue: 28.2, secondaryValue: 438 },
      { year: 2025, primaryValue: 28.4, secondaryValue: 422 },
      { year: 2026, primaryValue: 28.5, secondaryValue: 410 },
    ],
  },
  {
    id: 'earth-river-b12',
    planet: 'earth',
    name: 'Alluvial Terrace B-12',
    region: 'Upper Basin · Irrigated Corridor',
    coordinates: '0.39°S, 36.24°E',
    lat: -0.39,
    lon: 36.24,
    areaLabel: '96.0 ha',
    pinX: 598,
    pinY: 224,
    polygonPoints: '554,178 656,192 642,268 548,254',
    defaultOption: 'Maize',
    optionLabel: 'Current Crop',
    suitabilityTitle: 'Suitability Index',
    options: {
      Maize: {
        name: 'Maize',
        suitabilityIndex: 76,
        verdictLabel: 'Moderate Stability',
        verdictTone: 'emerald',
        summary:
          'Adjacent riverbed moisture buffering keeps root-zone hydration adequate, though thermal margin is narrowing.',
      },
      Sorghum: {
        name: 'Sorghum',
        suitabilityIndex: 89,
        verdictLabel: 'High Yield Fit',
        verdictTone: 'emerald',
        summary:
          'Well-drained alluvial loam and 26.9°C mean temperature sustain optimal panicle development.',
      },
      Cowpeas: {
        name: 'Cowpeas',
        suitabilityIndex: 83,
        verdictLabel: 'Strong Fit',
        verdictTone: 'emerald',
        summary:
          'Reliable moisture reserve supports dual-harvest pod production with low supplemental irrigation.',
      },
      Millet: {
        name: 'Millet',
        suitabilityIndex: 80,
        verdictLabel: 'Viable Match',
        verdictTone: 'emerald',
        summary:
          'Rapid canopy closure suppresses evaporation across the river-terrace silt beds.',
      },
      Wheat: {
        name: 'Wheat',
        suitabilityIndex: 58,
        verdictLabel: 'Marginal Fit',
        verdictTone: 'amber',
        summary:
          'Mild thermal stress during grain fill reduces protein index unless early-maturing cultivars are sown.',
      },
    },
    telemetry: [
      {
        id: 'soil-moisture',
        label: 'Root-Zone Soil Moisture',
        valueLabel: '29% - Adequate',
        progress: 64,
        tone: 'emerald',
        icon: 'droplets',
      },
      {
        id: 'avg-temp',
        label: 'Avg Temperature',
        valueLabel: '26.9°C - +1.3°C Shift',
        progress: 58,
        tone: 'amber',
        icon: 'thermometer',
      },
      {
        id: 'rainfall',
        label: 'Seasonal Rainfall',
        valueLabel: '540mm - Near Avg',
        progress: 66,
        tone: 'cyan',
        icon: 'rain',
      },
    ],
    alternativesHeading: 'Recommended Alternatives',
    alternatives: [
      { name: 'Sorghum', matchPercent: 89, note: 'Peak thermal buffer' },
      { name: 'Cowpeas', matchPercent: 83, note: 'Soil nitrogen builder' },
    ],
    rotationHeading: '2-Season Rotation Plan',
    rotationSteps: ['Season 1: Maize', 'Season 2: Cowpeas'],
    trendTitle: '10-Year Trend (2016–2026)',
    primarySeriesLabel: 'Avg Temp',
    primarySeriesUnit: '°C',
    secondarySeriesLabel: 'Rainfall',
    secondarySeriesUnit: 'mm',
    trend: [
      { year: 2016, primaryValue: 25.6, secondaryValue: 640 },
      { year: 2017, primaryValue: 25.7, secondaryValue: 632 },
      { year: 2018, primaryValue: 25.9, secondaryValue: 618 },
      { year: 2019, primaryValue: 26.0, secondaryValue: 610 },
      { year: 2020, primaryValue: 26.2, secondaryValue: 595 },
      { year: 2021, primaryValue: 26.3, secondaryValue: 588 },
      { year: 2022, primaryValue: 26.5, secondaryValue: 575 },
      { year: 2023, primaryValue: 26.6, secondaryValue: 564 },
      { year: 2024, primaryValue: 26.7, secondaryValue: 556 },
      { year: 2025, primaryValue: 26.8, secondaryValue: 548 },
      { year: 2026, primaryValue: 26.9, secondaryValue: 540 },
    ],
  },
  {
    id: 'earth-ridge-c04',
    planet: 'earth',
    name: 'Dryland Bench C-04',
    region: 'Eastern Escarpment · Rainfed',
    coordinates: '0.46°S, 36.29°E',
    lat: -0.46,
    lon: 36.29,
    areaLabel: '188.0 ha',
    pinX: 808,
    pinY: 318,
    polygonPoints: '754,264 866,276 854,366 744,352',
    defaultOption: 'Maize',
    optionLabel: 'Current Crop',
    suitabilityTitle: 'Suitability Index',
    options: {
      Maize: {
        name: 'Maize',
        suitabilityIndex: 39,
        verdictLabel: 'Severe Drought Risk',
        verdictTone: 'coral',
        summary:
          'Shallow upland soils and a +2.4°C warming trend have triggered acute water deficit for Maize cultivation.',
      },
      Sorghum: {
        name: 'Sorghum',
        suitabilityIndex: 88,
        verdictLabel: 'Recommended Shift',
        verdictTone: 'emerald',
        summary:
          'Waxy leaf cuticle and dormant-tillering recovery deliver reliable yields despite 375mm seasonal rainfall.',
      },
      Cowpeas: {
        name: 'Cowpeas',
        suitabilityIndex: 85,
        verdictLabel: 'Strong Fit',
        verdictTone: 'emerald',
        summary:
          'High heat tolerance maintains pod set above 29°C while protecting exposed sandy topsoil from wind erosion.',
      },
      Millet: {
        name: 'Millet',
        suitabilityIndex: 91,
        verdictLabel: 'Optimal Fit',
        verdictTone: 'emerald',
        summary:
          'Pearl millet outperforms all cereals under 12% root-zone moisture on the eastern rainfed bench.',
      },
      Wheat: {
        name: 'Wheat',
        suitabilityIndex: 28,
        verdictLabel: 'Unsuitable',
        verdictTone: 'coral',
        summary:
          'Insufficient soil moisture and excessive thermal load prevent viable germination and tiller survival.',
      },
    },
    telemetry: [
      {
        id: 'soil-moisture',
        label: 'Root-Zone Soil Moisture',
        valueLabel: '12% - Critical',
        progress: 12,
        tone: 'coral',
        icon: 'droplets',
      },
      {
        id: 'avg-temp',
        label: 'Avg Temperature',
        valueLabel: '29.4°C - +2.4°C Shift',
        progress: 86,
        tone: 'coral',
        icon: 'thermometer',
      },
      {
        id: 'rainfall',
        label: 'Seasonal Rainfall',
        valueLabel: '375mm - Deficit',
        progress: 31,
        tone: 'coral',
        icon: 'rain',
      },
    ],
    alternativesHeading: 'Recommended Alternatives',
    alternatives: [
      { name: 'Millet', matchPercent: 91, note: 'Extreme aridity match' },
      { name: 'Sorghum', matchPercent: 88, note: 'Deep root resilience' },
    ],
    rotationHeading: '2-Season Rotation Plan',
    rotationSteps: ['Season 1: Millet', 'Season 2: Cowpeas'],
    trendTitle: '10-Year Trend (2016–2026)',
    primarySeriesLabel: 'Avg Temp',
    primarySeriesUnit: '°C',
    secondarySeriesLabel: 'Rainfall',
    secondarySeriesUnit: 'mm',
    trend: [
      { year: 2016, primaryValue: 27.0, secondaryValue: 560 },
      { year: 2017, primaryValue: 27.2, secondaryValue: 542 },
      { year: 2018, primaryValue: 27.5, secondaryValue: 518 },
      { year: 2019, primaryValue: 27.8, secondaryValue: 496 },
      { year: 2020, primaryValue: 28.0, secondaryValue: 472 },
      { year: 2021, primaryValue: 28.3, secondaryValue: 451 },
      { year: 2022, primaryValue: 28.5, secondaryValue: 432 },
      { year: 2023, primaryValue: 28.8, secondaryValue: 416 },
      { year: 2024, primaryValue: 29.0, secondaryValue: 401 },
      { year: 2025, primaryValue: 29.2, secondaryValue: 388 },
      { year: 2026, primaryValue: 29.4, secondaryValue: 375 },
    ],
  },
  {
    id: 'earth-west-d19',
    planet: 'earth',
    name: 'West Loam Sector D-19',
    region: 'Meander Plain · Agro-Station',
    coordinates: '0.44°S, 36.11°E',
    lat: -0.44,
    lon: 36.11,
    areaLabel: '114.2 ha',
    pinX: 196,
    pinY: 268,
    polygonPoints: '142,226 246,216 254,308 148,318',
    defaultOption: 'Maize',
    optionLabel: 'Current Crop',
    suitabilityTitle: 'Suitability Index',
    options: {
      Maize: {
        name: 'Maize',
        suitabilityIndex: 62,
        verdictLabel: 'Moderate Risk (Monitor)',
        verdictTone: 'amber',
        summary:
          'Loamy clay retains residual moisture, but +1.7°C warming is steadily compressing pollination windows.',
      },
      Sorghum: {
        name: 'Sorghum',
        suitabilityIndex: 94,
        verdictLabel: 'Optimal Fit',
        verdictTone: 'emerald',
        summary:
          'Clay-loam profile and 470mm seasonal precipitation provide ideal grain-fill density for Sorghum.',
      },
      Cowpeas: {
        name: 'Cowpeas',
        suitabilityIndex: 89,
        verdictLabel: 'Optimal Fit',
        verdictTone: 'emerald',
        summary:
          'Strong vegetative cover and minimal disease pressure under moderate 27.6°C daytime highs.',
      },
      Millet: {
        name: 'Millet',
        suitabilityIndex: 82,
        verdictLabel: 'Strong Fit',
        verdictTone: 'emerald',
        summary:
          'Consistent stand establishment across western terrace plots with low input overhead.',
      },
      Wheat: {
        name: 'Wheat',
        suitabilityIndex: 49,
        verdictLabel: 'High Risk',
        verdictTone: 'coral',
        summary:
          'Elevated nocturnal warmth shortens grain-filling duration and reduces harvest index.',
      },
    },
    telemetry: [
      {
        id: 'soil-moisture',
        label: 'Root-Zone Soil Moisture',
        valueLabel: '21% - Moderate',
        progress: 42,
        tone: 'amber',
        icon: 'droplets',
      },
      {
        id: 'avg-temp',
        label: 'Avg Temperature',
        valueLabel: '27.6°C - +1.7°C Shift',
        progress: 68,
        tone: 'amber',
        icon: 'thermometer',
      },
      {
        id: 'rainfall',
        label: 'Seasonal Rainfall',
        valueLabel: '470mm - Slightly Low',
        progress: 51,
        tone: 'amber',
        icon: 'rain',
      },
    ],
    alternativesHeading: 'Recommended Alternatives',
    alternatives: [
      { name: 'Sorghum', matchPercent: 94, note: 'Maximum biomass yield' },
      { name: 'Cowpeas', matchPercent: 89, note: 'Intercrop compatible' },
    ],
    rotationHeading: '2-Season Rotation Plan',
    rotationSteps: ['Season 1: Sorghum', 'Season 2: Cowpeas'],
    trendTitle: '10-Year Trend (2016–2026)',
    primarySeriesLabel: 'Avg Temp',
    primarySeriesUnit: '°C',
    secondarySeriesLabel: 'Rainfall',
    secondarySeriesUnit: 'mm',
    trend: [
      { year: 2016, primaryValue: 25.9, secondaryValue: 612 },
      { year: 2017, primaryValue: 26.1, secondaryValue: 598 },
      { year: 2018, primaryValue: 26.2, secondaryValue: 582 },
      { year: 2019, primaryValue: 26.4, secondaryValue: 569 },
      { year: 2020, primaryValue: 26.6, secondaryValue: 551 },
      { year: 2021, primaryValue: 26.8, secondaryValue: 536 },
      { year: 2022, primaryValue: 27.0, secondaryValue: 520 },
      { year: 2023, primaryValue: 27.2, secondaryValue: 506 },
      { year: 2024, primaryValue: 27.3, secondaryValue: 492 },
      { year: 2025, primaryValue: 27.5, secondaryValue: 481 },
      { year: 2026, primaryValue: 27.6, secondaryValue: 470 },
    ],
  },

  // ================= MARS SITES =================
  {
    id: 'mars-arcadia-ap01',
    planet: 'mars',
    name: 'Site A: Arcadia Planitia',
    region: 'Safe Flat Slope + Shallow Subsurface Ice',
    coordinates: '46.70°N, 172.00°W',
    lat: 46.7,
    lon: -172.0,
    areaLabel: '24.0 km² Landing Zone',
    slopeDeg: 1.4,
    flatZoneKm: 620,
    pinX: 492,
    pinY: 288,
    polygonPoints: '422,232 560,224 574,344 434,352',
    defaultOption: 'Pressurized Hydroponic Dome',
    optionLabel: 'Habitat System',
    suitabilityTitle: 'Landing & Greenhouse Suitability',
    options: {
      'Pressurized Hydroponic Dome': {
        name: 'Pressurized Hydroponic Dome',
        suitabilityIndex: 94,
        verdictLabel: 'Optimal — Safe Flat Slope + Shallow Subsurface Ice',
        verdictTone: 'emerald',
        summary:
          'Flat 1.4° volcanic plain, shallow 1.2m subsurface water-ice sheets, and high solar flux make Arcadia Planitia optimal for closed-loop greenhouse deployment.',
      },
      'Aeroponic Regolith Bay': {
        name: 'Aeroponic Regolith Bay',
        suitabilityIndex: 89,
        verdictLabel: 'High Viability',
        verdictTone: 'emerald',
        summary:
          'Low dust-storm occlusion and abundant near-surface ice enable automated ISRU nutrient hydration with minimal excavation.',
      },
      'Algae Bioreactor Array': {
        name: 'Algae Bioreactor Array',
        suitabilityIndex: 91,
        verdictLabel: 'Optimal',
        verdictTone: 'emerald',
        summary:
          'Consistent 540 W/m² peak diurnal irradiance and CO₂ atmospheric feedstock sustain continuous oxygen and biomass output.',
      },
    },
    telemetry: [
      {
        id: 'mars-slope',
        label: 'Terrain Slope',
        valueLabel: '1.4° - Safe',
        progress: 92,
        tone: 'emerald',
        icon: 'slope',
      },
      {
        id: 'mars-ice',
        label: 'Subsurface Water Ice',
        valueLabel: '1.2m Depth',
        progress: 88,
        tone: 'cyan',
        icon: 'ice',
      },
      {
        id: 'mars-solar',
        label: 'Solar Exposure',
        valueLabel: 'High',
        progress: 85,
        tone: 'amber',
        icon: 'sun',
      },
    ],
    alternativesHeading: 'Recommended Biosphere Crops',
    alternatives: [
      { name: 'Dwarf Wheat', matchPercent: 96, note: 'High caloric density' },
      { name: 'Hydroponic Kale', matchPercent: 91, note: 'Rapid O₂ turnover' },
    ],
    rotationHeading: '2-Cycle Regolith Plan',
    rotationSteps: ['Cycle 1: Perchlorate Rinse', 'Cycle 2: Dwarf Wheat'],
    trendTitle: '10-Year Orbital Trend (2016–2026)',
    primarySeriesLabel: 'Surface Temp',
    primarySeriesUnit: '°C',
    secondarySeriesLabel: 'Solar Flux',
    secondarySeriesUnit: 'W/m²',
    trend: [
      { year: 2016, primaryValue: -58.2, secondaryValue: 512 },
      { year: 2017, primaryValue: -57.9, secondaryValue: 518 },
      { year: 2018, primaryValue: -61.4, secondaryValue: 445 },
      { year: 2019, primaryValue: -57.6, secondaryValue: 524 },
      { year: 2020, primaryValue: -57.4, secondaryValue: 529 },
      { year: 2021, primaryValue: -57.1, secondaryValue: 532 },
      { year: 2022, primaryValue: -56.9, secondaryValue: 536 },
      { year: 2023, primaryValue: -56.8, secondaryValue: 538 },
      { year: 2024, primaryValue: -56.5, secondaryValue: 541 },
      { year: 2025, primaryValue: -56.3, secondaryValue: 544 },
      { year: 2026, primaryValue: -56.1, secondaryValue: 548 },
    ],
  },
  {
    id: 'mars-olympus-b02',
    planet: 'mars',
    name: 'Site B: Olympus Mons Rim',
    region: 'Extreme Slope & No Accessible Ice',
    coordinates: '18.65°N, 133.80°W',
    lat: 18.65,
    lon: -133.8,
    areaLabel: '16.5 km² Caldera Rim',
    slopeDeg: 18.4,
    pinX: 742,
    pinY: 368,
    polygonPoints: '692,318 792,326 780,418 682,408',
    defaultOption: 'Pressurized Hydroponic Dome',
    optionLabel: 'Habitat System',
    suitabilityTitle: 'Landing & Greenhouse Suitability',
    options: {
      'Pressurized Hydroponic Dome': {
        name: 'Pressurized Hydroponic Dome',
        suitabilityIndex: 24,
        verdictLabel: 'High Risk — Extreme Slope & No Accessible Ice',
        verdictTone: 'coral',
        summary:
          'Steep 18.4° volcanic escarpment, ultra-thin 0.7 mbar rim pressure, and zero detectable shallow ice pose severe landing and water-supply hazards.',
      },
      'Aeroponic Regolith Bay': {
        name: 'Aeroponic Regolith Bay',
        suitabilityIndex: 29,
        verdictLabel: 'High Risk — Structural Grade',
        verdictTone: 'coral',
        summary:
          'Requires heavy rock-anchoring piers and imported orbital water reserves due to desiccated basalt bedrock.',
      },
      'Algae Bioreactor Array': {
        name: 'Algae Bioreactor Array',
        suitabilityIndex: 36,
        verdictLabel: 'Marginal — Thin Atmosphere',
        verdictTone: 'amber',
        summary:
          'High elevation reduces atmospheric dust shielding and increases UV/radiation load on exterior dome polymers.',
      },
    },
    telemetry: [
      {
        id: 'mars-slope',
        label: 'Terrain Slope',
        valueLabel: '18.4° - Extreme',
        progress: 94,
        tone: 'coral',
        icon: 'slope',
      },
      {
        id: 'mars-ice',
        label: 'Subsurface Water Ice',
        valueLabel: 'None (>15m)',
        progress: 10,
        tone: 'coral',
        icon: 'ice',
      },
      {
        id: 'mars-solar',
        label: 'Solar Exposure',
        valueLabel: 'Moderate (Dust)',
        progress: 64,
        tone: 'amber',
        icon: 'sun',
      },
    ],
    alternativesHeading: 'Recommended Biosphere Crops',
    alternatives: [
      { name: 'Closed Spirulina', matchPercent: 48, note: 'Low-volume water loop' },
      { name: 'Micro-Cress', matchPercent: 39, note: 'Minimal root depth' },
    ],
    rotationHeading: '2-Cycle Regolith Plan',
    rotationSteps: ['Cycle 1: Relocate to Arcadia', 'Cycle 2: Closed Loop Only'],
    trendTitle: '10-Year Orbital Trend (2016–2026)',
    primarySeriesLabel: 'Surface Temp',
    primarySeriesUnit: '°C',
    secondarySeriesLabel: 'Solar Flux',
    secondarySeriesUnit: 'W/m²',
    trend: [
      { year: 2016, primaryValue: -68.5, secondaryValue: 472 },
      { year: 2017, primaryValue: -68.1, secondaryValue: 478 },
      { year: 2018, primaryValue: -71.9, secondaryValue: 392 },
      { year: 2019, primaryValue: -67.8, secondaryValue: 481 },
      { year: 2020, primaryValue: -67.5, secondaryValue: 485 },
      { year: 2021, primaryValue: -67.3, secondaryValue: 489 },
      { year: 2022, primaryValue: -67.0, secondaryValue: 492 },
      { year: 2023, primaryValue: -66.9, secondaryValue: 496 },
      { year: 2024, primaryValue: -66.7, secondaryValue: 498 },
      { year: 2025, primaryValue: -66.5, secondaryValue: 501 },
      { year: 2026, primaryValue: -66.2, secondaryValue: 504 },
    ],
  },

  // ================= MOON SITES =================
  {
    id: 'moon-shackleton-sp01',
    planet: 'moon',
    name: 'Site A: Shackleton Ridge Alpha',
    region: 'Near-Continuous Sunlight + Adjacent Crater Ice',
    coordinates: '85.00°S, 0.00°E',
    lat: -85.0,
    lon: 0.0,
    areaLabel: '8.4 km² Outpost Zone',
    slopeDeg: 2.6,
    flatZoneKm: 520,
    pinX: 672,
    pinY: 282,
    polygonPoints: '632,238 712,246 704,332 624,324',
    defaultOption: 'Closed-Loop Crater Greenhouse',
    optionLabel: 'Lunar Module',
    suitabilityTitle: 'Lunar Base Suitability',
    options: {
      'Closed-Loop Crater Greenhouse': {
        name: 'Closed-Loop Crater Greenhouse',
        suitabilityIndex: 89,
        verdictLabel: 'Optimal — Near-Continuous Sunlight + Adjacent Crater Ice',
        verdictTone: 'emerald',
        summary:
          '89% continuous polar solar illumination on Shackleton Ridge paired with adjacent permanently shadowed crater ice traps supports year-round greenhouse power and hydration.',
      },
      'Solar Concentrator Array': {
        name: 'Solar Concentrator Array',
        suitabilityIndex: 93,
        verdictLabel: 'Optimal Power Ridge',
        verdictTone: 'emerald',
        summary:
          'Near-continuous sunlight reduces battery mass requirements for thermal regulation and LED grow arrays.',
      },
    },
    telemetry: [
      {
        id: 'moon-slope',
        label: 'Crater Rim Slope',
        valueLabel: '2.6° - Safe',
        progress: 88,
        tone: 'emerald',
        icon: 'slope',
      },
      {
        id: 'moon-ice',
        label: 'Adjacent Crater Ice',
        valueLabel: '0.8 km Haul',
        progress: 86,
        tone: 'cyan',
        icon: 'ice',
      },
      {
        id: 'moon-solar',
        label: 'Solar Illumination',
        valueLabel: '89% Continuous',
        progress: 89,
        tone: 'amber',
        icon: 'sun',
      },
    ],
    alternativesHeading: 'Recommended Lunar Crops',
    alternatives: [
      { name: 'Hydro-Lettuce', matchPercent: 94, note: 'Low power footprint' },
      { name: 'Dwarf Potato', matchPercent: 88, note: 'Radiation shielded bay' },
    ],
    rotationHeading: '2-Cycle Closed Loop',
    rotationSteps: ['Cycle 1: LED Hydro-Greens', 'Cycle 2: Dwarf Potato'],
    trendTitle: '10-Year LRO Telemetry (2016–2026)',
    primarySeriesLabel: 'Peak Temp',
    primarySeriesUnit: '°C',
    secondarySeriesLabel: 'Illum Cycle',
    secondarySeriesUnit: '%',
    trend: [
      { year: 2016, primaryValue: -42.0, secondaryValue: 87 },
      { year: 2017, primaryValue: -41.8, secondaryValue: 88 },
      { year: 2018, primaryValue: -42.2, secondaryValue: 87 },
      { year: 2019, primaryValue: -41.5, secondaryValue: 89 },
      { year: 2020, primaryValue: -41.7, secondaryValue: 88 },
      { year: 2021, primaryValue: -41.4, secondaryValue: 89 },
      { year: 2022, primaryValue: -41.6, secondaryValue: 89 },
      { year: 2023, primaryValue: -41.2, secondaryValue: 90 },
      { year: 2024, primaryValue: -41.5, secondaryValue: 89 },
      { year: 2025, primaryValue: -41.3, secondaryValue: 89 },
      { year: 2026, primaryValue: -41.1, secondaryValue: 89 },
    ],
  },
  {
    id: 'moon-tycho-sp02',
    planet: 'moon',
    name: 'Site B: Tycho Crater Floor',
    region: 'Steep Slopes & 14-Day Lunar Night',
    coordinates: '43.31°S, 11.36°W',
    lat: -43.31,
    lon: -11.36,
    areaLabel: '12.2 km² Impact Floor',
    slopeDeg: 16.8,
    pinX: 282,
    pinY: 318,
    polygonPoints: '240,276 326,282 318,362 232,354',
    defaultOption: 'Closed-Loop Crater Greenhouse',
    optionLabel: 'Lunar Module',
    suitabilityTitle: 'Lunar Base Suitability',
    options: {
      'Closed-Loop Crater Greenhouse': {
        name: 'Closed-Loop Crater Greenhouse',
        suitabilityIndex: 31,
        verdictLabel: 'High Risk — Steep Slopes & 14-Day Lunar Night',
        verdictTone: 'coral',
        summary:
          'Rugged boulder-strewn impact floor, 16.8° surrounding wall grades, and 336-hour cryogenic lunar nights require massive nuclear/battery heating.',
      },
      'Solar Concentrator Array': {
        name: 'Solar Concentrator Array',
        suitabilityIndex: 27,
        verdictLabel: 'High Risk — 14-Day Eclipse',
        verdictTone: 'coral',
        summary:
          '50% diurnal duty cycle and steep crater wall shadowing cut winter solar power generation far below polar ridges.',
      },
    },
    telemetry: [
      {
        id: 'moon-slope',
        label: 'Crater Wall Slope',
        valueLabel: '16.8° - Steep',
        progress: 91,
        tone: 'coral',
        icon: 'slope',
      },
      {
        id: 'moon-ice',
        label: 'Accessible Water Ice',
        valueLabel: '0.1 wt% - Depleted',
        progress: 12,
        tone: 'coral',
        icon: 'ice',
      },
      {
        id: 'moon-solar',
        label: 'Solar Illumination',
        valueLabel: '50% (14-Day Night)',
        progress: 31,
        tone: 'coral',
        icon: 'sun',
      },
    ],
    alternativesHeading: 'Recommended Lunar Crops',
    alternatives: [
      { name: 'Dormant Microgreens', matchPercent: 44, note: 'High thermal demand' },
      { name: 'Stasis Radish', matchPercent: 38, note: 'Requires RTG heating' },
    ],
    rotationHeading: '2-Cycle Closed Loop',
    rotationSteps: ['Cycle 1: Relocate South Pole', 'Cycle 2: Nuclear Backup Only'],
    trendTitle: '10-Year LRO Telemetry (2016–2026)',
    primarySeriesLabel: 'Peak Temp',
    primarySeriesUnit: '°C',
    secondarySeriesLabel: 'Illum Cycle',
    secondarySeriesUnit: '%',
    trend: [
      { year: 2016, primaryValue: -112.0, secondaryValue: 50 },
      { year: 2017, primaryValue: -111.6, secondaryValue: 50 },
      { year: 2018, primaryValue: -112.4, secondaryValue: 49 },
      { year: 2019, primaryValue: -111.8, secondaryValue: 50 },
      { year: 2020, primaryValue: -112.1, secondaryValue: 50 },
      { year: 2021, primaryValue: -111.5, secondaryValue: 50 },
      { year: 2022, primaryValue: -111.9, secondaryValue: 50 },
      { year: 2023, primaryValue: -111.4, secondaryValue: 51 },
      { year: 2024, primaryValue: -111.7, secondaryValue: 50 },
      { year: 2025, primaryValue: -111.6, secondaryValue: 50 },
      { year: 2026, primaryValue: -111.3, secondaryValue: 50 },
    ],
  },
];
