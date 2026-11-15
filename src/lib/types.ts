// ---------------------------------------------------------------------------
// Shared types for FieldShift
// ---------------------------------------------------------------------------

export type CropFamily = 'grass' | 'legume' | 'brassica' | 'other'
export type SeasonKind = 'summer' | 'winter' | 'perennial'
export type RainfallRegime = 'summer-rain' | 'winter-rain' | 'any'

export interface Crop {
  id: string
  name: string
  afrikaansName?: string
  family: CropFamily
  season: SeasonKind
  /** Which rainfall regime this crop is typically grown in */
  regime: RainfallRegime
  /** Typical seasonal crop water requirement, mm (FAO-56 style ranges) */
  waterMm: [number, number]
  /** Nitrogen fixed per season, kg N/ha (0 for non-legumes) */
  nFix: number
  /** Root depth, m */
  rootM: number
  /** Organic-matter / residue contribution to soil, 0 (poor) .. 3 (excellent) */
  omScore: 0 | 1 | 2 | 3
  /** Soil protection from erosion while established, 0 .. 3 */
  erosionScore: 0 | 1 | 2 | 3
  /** Tolerance of hot spells (Tmax > 32°C), 0 .. 3 */
  heatScore: 0 | 1 | 2 | 3
  /** Drought tolerance (rainfed, variable rainfall), 0 .. 3 */
  droughtScore: 0 | 1 | 2 | 3
  /** Tolerance of frost, 0 .. 3 (3 = hardy / winter-grown) */
  frostScore: 0 | 1 | 2 | 3
  /** Grazing / forage / hay value, 0 .. 3 */
  forageScore: 0 | 1 | 2 | 3
  /** Local market strength in South Africa, 0 .. 3 */
  incomeScore: 0 | 1 | 2 | 3
  /** Typical season length in months (approx) */
  seasonMonths: number
  /** Needs irrigation to be reliable */
  needsIrrigation: boolean
  /** Can leave soil bare after harvest (adds fallow bare period) */
  bareAfter: boolean
  notes: string
}

export type SoilTexture = 'sand' | 'sandyLoam' | 'loam' | 'clayLoam' | 'clay'

export interface SoilInfo {
  texture: SoilTexture
  /** % organic matter in topsoil (farmer estimate) */
  omPercent: number
  drainage: 'poor' | 'moderate' | 'good'
  irrigated: boolean
}

export interface SoilProfile {
  /** plant-available water holding capacity, mm per m of soil */
  whcMmPerM: number
  /** USLE-style K-factor proxy, 0..1 */
  erodibility: number
  infiltrationNote: string
}

export interface FarmPreset {
  id: string
  name: string
  blurb: string
  lat: number
  lon: number
  regime: RainfallRegime
  /** typical current rotation for the region (crop ids, in year order) */
  currentRotation: string[]
  soil: SoilTexture
  /** preset farms with scheme/pivot irrigation default to irrigated */
  irrigated?: boolean
}

export interface Priorities {
  water: number
  soil: number
  income: number
  erosion: number
  forage: number
}

/** Derived climate features from NASA POWER */
export interface ClimateFeatures {
  lat: number
  lon: number
  monthly: {
    P: number[]
    Tmax: number[]
    Tmin: number[]
    Tavg: number[]
    ET0: number[]
    ETact: number[]
    GWETROOT: number[]
    RH: number[]
  }
  annualRainMm: number
  annualET0Mm: number
  aridityIndex: number
  /** share of annual rain falling in the wettest 3 months */
  rainConcentration: number
  /** month indices (0-11) of the main wet season */
  wetMonths: number[]
  /** months where P >= 0.5 * ET0 */
  growingMonths: number[]
  heatMonths32: number
  heatMonths35: number
  frostMonths: number
  /** average hot days (>32°C) per year, by calendar month (daily 15-yr record) */
  hotDaysByMonth?: number[]
  /** average extreme-hot days (>35°C) per year, by calendar month */
  veryHotDaysByMonth?: number[]
  /** average frost nights (<2°C) per year, by calendar month */
  frostDaysByMonth?: number[]
  /** 0..1, seasonal soil wetness range (high = strong wet/dry cycle) */
  wetnessCycle: number
  trend?: DailyTrend
}

export interface DailyTrend {
  years: number[]
  annualRain: number[]
  heatDays: number[]
  /** mean root-zone wetness (0-1) over the Oct–Mar + Jan–Feb growing months, per year */
  growingWetness: number[]
  /** mean daily Tmax (°C) per year */
  meanTmax: number[]
  rainSlopePerDecade: number
  heatDaysSlopePerDecade: number
  recentVsHistoricalRain: number
  /** Then (earliest 5 complete years) vs Now (latest 5) */
  thenNow: {
    yearsSpan: number
    rainPct: number
    wetnessDelta: number
    hotDaysDelta: number
    tmaxDelta: number
  }
  /** Most recent observed days (POWER daily lags ~1 week) */
  recent: {
    days: number
    rainMm: number
    wetness: number
    tmaxMax: number
  }
}

export interface TerrainInfo {
  slopePercent: number
  slopeClass: 'flat' | 'gentle' | 'moderate' | 'steep'
  erosionRelevance: string
  source: 'dem' | 'manual'
}

export type CriterionKey =
  | 'water'
  | 'soilHealth'
  | 'erosion'
  | 'pestCycle'
  | 'climateFit'
  | 'income'
  | 'forage'

export interface CriterionScore {
  key: CriterionKey
  label: string
  score: number
  detail: string
}

export interface RotationYear {
  year: number
  cropId: string
}

export interface Strategy {
  id: string
  name: string
  tagline: string
  kind: 'current' | 'suggested'
  sequence: RotationYear[]
  total: number
  criteria: CriterionScore[]
  why: string
  evidence: string[]
  benefits: string[]
  gaps: string[]
  risks: string[]
}

export interface PowerFetchState {
  status: 'idle' | 'loading' | 'ready' | 'error'
  error?: string
}
