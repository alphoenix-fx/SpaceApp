import { BookOpen, Database, Satellite } from 'lucide-react'
import { Chip } from './ui'

const GLOSSARY: Array<[string, string]> = [
  [
    'NDVI (vegetation index)',
    'How "green and alive" the plants look to a satellite. High NDVI = dense, healthy canopy; dropping NDVI mid-season = stress (heat, water, disease) or bare ground.',
  ],
  [
    'Evapotranspiration (ET & ET0)',
    'The water a field loses to evaporation from soil plus transpiration through leaves. ET0 is the "reference" loss for a standard grass surface — the atmosphere’s thirst. If ET0 beats rainfall, crops live off soil reserves.',
  ],
  [
    'Soil moisture / wetness anomaly',
    'How full the root-zone water "bank" is compared with normal for that time of year. A negative anomaly running for weeks is the early fingerprint of drought.',
  ],
  [
    'Water balance',
    'Rainfall minus evaporative demand. Positive = the profile is filling; negative = it is spending. Rotation choices change how much demand you schedule into deficit months.',
  ],
  [
    'Aridity index',
    'Annual rainfall ÷ annual ET0. Under ~0.5 is semi-arid: every dryland crop is living partly on stored water. Guides which crops can stand on their own.',
  ],
  [
    'Frost risk',
    'Months where night temperatures approach 0°C. Sets the safe planting and harvest calendar — a summer crop planted too early can be wiped out.',
  ],
  [
    'Climatology normals',
    'Long-term average conditions (30+ years) — the baseline "what this place is normally like", distinct from a single season’s weather.',
  ],
  [
    'Crop rotation',
    'Changing which crop family grows in a field each year. It breaks pest cycles, rebalances nitrogen, spreads water demand and keeps roots in the ground.',
  ],
]

const SOURCES: Array<[string, string]> = [
  [
    'NASA POWER (Agroclimatology)',
    'Daily & 30+ year monthly normals: rainfall, temperature, humidity, root-zone soil wetness, evapotranspiration flux — the quantitative core of every score.',
  ],
  [
    'NASA GIBS / MODIS Terra',
    'Interactive map overlays: true colour, NDVI 8-day crop vigour (250 m), land surface temperature. Tiles served keylessly.',
  ],
  [
    'Copernicus DEM elevation (via Open-Meteo) → slope → erosion risk',
    '30 m terrain around the field centre → slope class → erosion-risk weighting.',
  ],
  [
    'Agronomy knowledge base',
    'Typical crop water requirements & N fixation from FAO Irrigation & Drainage Paper 56/33, with South African context from ARC & Grain SA references; crop suitability cross-checkable against FAO GAEZ.',
  ],
  [
    'Datasets for local review',
    'USDA Web Soil Survey / SSURGO, CropScape (CDL), PRISM, USDA NASS QuickStats & Market News, OpenET, CoCoRaHS, NWIS, NLDAS/GLDAS, ERA5, Sentinel-2 — US-only or authentication-gated layers noted in the README for judges.',
  ],
]

export default function Footer() {
  return (
    <footer className="mt-12 border-t border-slate-200 bg-white/80 backdrop-blur">
      <div className="mx-auto max-w-6xl px-4 lg:px-6 py-10">
        <div className="grid gap-8 md:grid-cols-2">
          {/* Glossary */}
          <div>
            <h3 className="mb-4 flex items-center gap-2 font-display text-base font-bold text-ink">
              <BookOpen className="h-3.5 w-3.5 text-emerald-600" /> Plain-language glossary
            </h3>
            <div className="space-y-2.5">
              {GLOSSARY.map(([term, def]) => (
                <details key={term} className="group rounded-xl border border-slate-100 bg-white px-3 py-2.5">
                  <summary className="cursor-pointer list-none text-xs font-bold text-ink marker:hidden">
                    <span className="mr-1.5 text-emerald-600">＋</span>
                    {term}
                  </summary>
                  <p className="mt-1 text-[10px] leading-relaxed text-ink-2">{def}</p>
                </details>
              ))}
            </div>
          </div>

          {/* Sources & method */}
          <div>
            <h3 className="mb-4 flex items-center gap-2 font-display text-base font-bold text-ink">
              <Satellite className="h-3.5 w-3.5 text-cyan-600" /> Data & method
            </h3>
            <div className="space-y-2.5">
              {SOURCES.map(([name, def]) => (
                <div key={name} className="rounded-xl border border-slate-100 bg-white px-3 py-2.5">
                  <p className="flex items-center gap-1.5 text-xs font-bold text-ink">
                    <Database className="h-2.5 w-2.5 text-cyan-600" /> {name}
                  </p>
                  <p className="mt-1 text-[10px] leading-relaxed text-ink-2">{def}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-8 rounded-xl border border-amber-100 bg-amber-soft px-4 py-3">
          <p className="text-[10px] leading-relaxed text-amber-700">
            <strong className="text-amber-800">FieldShift is a decision-support tool.</strong> It reveals patterns and possibilities from NASA
            Earth observations — it does not replace farmer judgement, local agricultural expertise, soil tests, or
            cultivar trials. Scores are comparative indications built on typical agronomy values; always validate
            suggestions with your local extension officer or agronomist.
          </p>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-2 text-[9px] text-ink-3">
          <p>
            Built for the <strong className="text-ink">NASA International Space Apps Challenge 2026</strong> — challenge:{' '}
            <em className="text-ink-2">Field Shift: Adapting Farms with NASA Data</em>. South Africa team.
          </p>
          <Chip tone="slate">Powered by NASA open data</Chip>
        </div>
      </div>
    </footer>
  )
}
