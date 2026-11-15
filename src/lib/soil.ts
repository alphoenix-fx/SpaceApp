import type { SoilInfo, SoilProfile, SoilTexture } from './types'

// ---------------------------------------------------------------------------
// Soil texture presets. Since USDA Web Soil Survey / SSURGO are US-only,
// FieldShift asks the farmer to pick what they know about their own soil
// (texture, drainage, organic matter) — the same properties those datasets
// encode. Typical plant-available water capacities per texture follow
// standard agronomy references (mm available water per metre of soil).
// ---------------------------------------------------------------------------

export const SOIL_PROFILES: Record<SoilTexture, SoilProfile> = {
  sand: {
    whcMmPerM: 70,
    erodibility: 0.24,
    infiltrationNote:
      'Sandy soils drink rain fast but hold little water — crops feel drought within 1–2 dry weeks.',
  },
  sandyLoam: {
    whcMmPerM: 110,
    erodibility: 0.32,
    infiltrationNote:
      'Sandy loam is a good compromise: decent infiltration and a fair water bank for dry spells.',
  },
  loam: {
    whcMmPerM: 150,
    erodibility: 0.38,
    infiltrationNote:
      'Loam holds the most plant-available water — a deep loam is the best buffer against dry spells.',
  },
  clayLoam: {
    whcMmPerM: 160,
    erodibility: 0.42,
    infiltrationNote:
      'Clay loam banks plenty of water but can seal and run off in intense storms when uncovered.',
  },
  clay: {
    whcMmPerM: 170,
    erodibility: 0.40,
    infiltrationNote:
      'Heavy clay holds water tightly; runoff risk is high when rain hits bare crusted soil.',
  },
}

export const SOIL_LABELS: Record<SoilTexture, { name: string; hint: string }> = {
  sand: { name: 'Sand', hint: 'gritty, drains fast' },
  sandyLoam: { name: 'Sandy loam', hint: 'mostly sand, some silt' },
  loam: { name: 'Loam', hint: 'crumbly, ideal mix' },
  clayLoam: { name: 'Clay loam', hint: 'smooth, holds water' },
  clay: { name: 'Clay', hint: 'sticky when wet, cracks' },
}

export function soilProfile(info: SoilInfo): SoilProfile {
  return SOIL_PROFILES[info.texture]
}
