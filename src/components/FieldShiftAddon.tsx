import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ChevronDown,
  Loader2,
  MapPin,
  Satellite,
  Sprout,
} from 'lucide-react'
import { PRESETS } from '../lib/regions'
import { fetchClimateFeatures } from '../lib/power'
import { fetchTerrain, manualTerrain } from '../lib/terrain'
import { fetchOutlook, type Outlook } from '../lib/forecast'
import { fetchNdviPulse, type NdviPulse } from '../lib/ndvi'
import {
  buildStrategies,
  computeVerdict,
  dominantCropId,
  type AnalysisContext,
} from '../lib/scoring'
import { buildPlaybook } from '../lib/alerts'
import type {
  ClimateFeatures,
  FarmPreset,
  Priorities,
  SoilInfo,
  Strategy,
  TerrainInfo,
} from '../lib/types'
import FieldPanel from './FieldPanel'
import PrioritiesPanel from './PrioritiesPanel'
import VerdictCard from './VerdictCard'
import FieldPulseCard from './FieldPulseCard'
import ActionsCard from './ActionsCard'
import TrendCard from './TrendCard'
import AlertsPanel from './AlertsPanel'
import ShiftExplorer from './ShiftExplorer'
import Rotations from './Rotations'

// Charts are the heaviest bundle — load them only once the scan finishes
const DataReadout = lazy(() => import('./DataReadout'))

const DEFAULT_SOIL: SoilInfo = {
  texture: 'clayLoam',
  omPercent: 1.8,
  drainage: 'moderate',
  irrigated: false,
}

const DEFAULT_PRIORITIES: Priorities = {
  water: 70,
  soil: 70,
  income: 40,
  erosion: 55,
  forage: 30,
}

interface Props {
  /** the field the map is currently pointing at */
  lat: number
  lon: number
  /** reverse-geocoded name for the pinned point, when known */
  placeName?: string | null
  /** move the map pin */
  onPick?: (lat: number, lon: number) => void
}

/**
 * The FieldShift engine, mounted as an add-on inside the Planetary console.
 *
 * The console above it answers "what is the weather like right now" from a
 * single live NASA POWER pass. This panel answers the harder question:
 * "given 30 years of NASA climatology and a 15-year daily archive, should
 * this farmer keep, adapt, or shift their rotation — and when should they
 * act?" Same map, same coordinates, a deeper diagnosis.
 */
export function FieldShiftAddon({ lat, lon, placeName, onPick }: Props) {
  const [preset, setPreset] = useState<FarmPreset | null>(null)
  const [soil, setSoil] = useState<SoilInfo>({ ...DEFAULT_SOIL })
  const [rotation, setRotation] = useState<string[]>([])
  const [priorities, setPriorities] = useState<Priorities>(DEFAULT_PRIORITIES)

  const [phase, setPhase] = useState<'idle' | 'loading' | 'done'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [climate, setClimate] = useState<ClimateFeatures | null>(null)
  const [terrain, setTerrain] = useState<TerrainInfo | null>(null)
  const [ndvi, setNdvi] = useState<NdviPulse | null>(null)
  const [outlook, setOutlook] = useState<Outlook | null>(null)
  const [showDetail, setShowDetail] = useState(false)
  const [seeded, setSeeded] = useState(false)

  // The closest SA demo region to the pinned point — used to seed a sensible
  // starting rotation and soil so the first scan is meaningful.
  const nearestPreset = useMemo(() => {
    let best = PRESETS[0]
    let bestDist = Infinity
    for (const p of PRESETS) {
      const d = Math.hypot(p.lat - lat, p.lon - lon)
      if (d < bestDist) {
        bestDist = d
        best = p
      }
    }
    return best
  }, [lat, lon])

  // A new point on the map invalidates the previous diagnosis.
  useEffect(() => {
    setPhase('idle')
    setClimate(null)
    setTerrain(null)
    setNdvi(null)
    setOutlook(null)
    setError(null)
  }, [lat, lon])

  const applyPreset = (p: FarmPreset) => {
    setPreset(p)
    setSoil((s) => ({ ...s, texture: p.soil, irrigated: p.irrigated ?? false }))
    setRotation([...p.currentRotation])
    onPick?.(p.lat, p.lon)
  }

  const analyse = async () => {
    setPhase('loading')
    setError(null)
    setNdvi(null)
    setOutlook(null)

    // First run: seed a starting rotation and soil from the nearest SA demo
    // region so the diagnosis is meaningful straight away. The farmer can
    // change every value afterwards.
    if (!rotation.length) {
      setRotation([...nearestPreset.currentRotation])
      setSoil((s) => ({ ...s, texture: nearestPreset.soil }))
      setSeeded(true)
    }

    try {
      const [clim, terr] = await Promise.all([
        fetchClimateFeatures(lat, lon),
        fetchTerrain(lat, lon).catch(() => manualTerrain(3)),
      ])
      setClimate(clim)
      setTerrain(terr)
      setPhase('done')
      // Live layers are a bonus: they must never block the diagnosis.
      void fetchNdviPulse(lat, lon)
        .then((p) => setNdvi(p))
        .catch(() => setNdvi(null))
      void fetchOutlook(lat, lon, clim)
        .then((o) => setOutlook(o))
        .catch(() => setOutlook(null))
    } catch (e) {
      setPhase('idle')
      setError(
        e instanceof Error
          ? `Could not reach NASA POWER: ${e.message}`
          : 'Could not reach NASA POWER. Check your connection and try again.',
      )
    }
  }

  const ctx: AnalysisContext | null = useMemo(() => {
    if (!climate || !terrain) return null
    return {
      climate,
      soil,
      slope: terrain,
      regime: preset?.regime ?? inferRegime(climate),
    }
  }, [climate, terrain, soil, preset])

  const strategies: Strategy[] | null = useMemo(() => {
    if (!ctx) return null
    const seq = rotation.length ? rotation : ['fallow', 'fallow', 'fallow', 'fallow']
    return buildStrategies(seq, ctx, priorities)
  }, [ctx, rotation, priorities])

  const verdict = useMemo(() => {
    if (!ctx) return null
    const seq = (rotation.length ? rotation : ['fallow', 'fallow', 'fallow', 'fallow']).map(
      (cropId, i) => ({ year: i + 1, cropId }),
    )
    return computeVerdict(seq, ctx, priorities, ctx.climate.trend)
  }, [ctx, rotation, priorities])

  const dominant = useMemo(
    () =>
      ctx
        ? dominantCropId(
            (rotation.length ? rotation : ['fallow']).map((cropId, i) => ({
              year: i + 1,
              cropId,
            })),
          )
        : null,
    [ctx, rotation],
  )

  const alerts = useMemo(() => {
    if (!ctx) return []
    return buildPlaybook(ctx.climate, dominant, ctx.soil, ctx.climate.trend)
  }, [ctx, dominant])

  return (
    <div className="flex-1 overflow-y-auto drawer-scroll min-h-0 @container">
      {/* Location strip — mirrors the console's header */}
      <div className="px-4 py-3 bg-white border-b border-slate-100">
        <div className="flex items-start gap-1.5 text-sm font-bold text-slate-900 min-w-0">
          <MapPin className="w-3.5 h-3.5 text-[#16A34A] shrink-0 mt-0.5" />
          <span className="line-clamp-2 leading-snug">{placeName ?? 'Selected 5km Catchment'}</span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 mt-0.5">
          <span className="font-mono tabular-nums text-slate-700 font-medium">
            {Math.abs(lat).toFixed(3)}°{lat >= 0 ? 'N' : 'S'}, {Math.abs(lon).toFixed(3)}°{lon >= 0 ? 'E' : 'W'}
          </span>
          <span className="truncate">{preset?.name ?? 'Custom field'}</span>
        </div>
      </div>

      <div className="p-3.5 space-y-3.5">
        {/* Field setup */}
        <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3.5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xs font-semibold text-slate-900">Field setup</h2>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-[11px] font-semibold text-[#15803D]">
              <Sprout className="w-3 h-3 shrink-0" />
              <span>SA demo regions</span>
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => applyPreset(p)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors cursor-pointer ${
                  preset?.id === p.id
                    ? 'bg-[#16A34A] text-white'
                    : 'bg-[#F4F6F5] text-slate-600 hover:bg-emerald-50 hover:text-[#15803D]'
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>

          {seeded && !preset && (
            <p className="text-[10px] leading-snug text-slate-500">
              Seeded from <span className="font-semibold text-slate-700">{nearestPreset.name}</span> — the closest
              SA demo region to your pin. Adjust the rotation and soil below to match your farm.
            </p>
          )}

          <FieldPanel
            preset={preset}
            lat={lat}
            lon={lon}
            soil={soil}
            terrain={terrain}
            rotation={rotation}
            onPreset={applyPreset}
            onSoil={setSoil}
            onSlope={(p) => setTerrain(manualTerrain(p))}
            onRotation={setRotation}
            embedded
          />
        </div>

        {/* Priorities */}
        <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3.5">
          <PrioritiesPanel priorities={priorities} onChange={setPriorities} embedded />
        </div>

        {/* Analyse CTA */}
        <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
          <div>
            <h2 className="text-xs font-semibold text-slate-900">
              {phase === 'done' ? 'Field scanned — results below' : 'Run the full diagnosis'}
            </h2>
            <p className="mt-1 text-[11px] text-slate-600 leading-relaxed">
              {phase === 'done'
                ? 'Changing soil, crops or priorities re-scores everything instantly — no need to re-fetch.'
                : "Pulls 30+ years of NASA POWER climatology plus the 15-year daily archive for this exact point, samples Copernicus DEM terrain for erosion risk, and scores your rotation against the alternatives."}
            </p>
            {error && (
              <p className="mt-2 flex items-center gap-1.5 text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-2.5 py-2">
                <AlertTriangle className="w-3 h-3 shrink-0" /> {error}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => void analyse()}
            disabled={phase === 'loading'}
            className={`w-full py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:cursor-not-allowed ${
              phase === 'loading'
                ? 'bg-slate-200 text-slate-500'
                : 'bg-[#1DB954] hover:bg-[#16A34A] active:bg-[#15803D] text-white shadow-sm'
            }`}
          >
            {phase === 'loading' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Scanning field…</span>
              </>
            ) : (
              <>
                <Satellite className="w-4 h-4" />
                <span>{phase === 'done' ? 'Re-scan field' : 'Analyse with NASA data'}</span>
              </>
            )}
          </button>
        </div>

        {/* Results — the four diagnostic cards */}
        {phase === 'done' && climate && terrain && (
          <div className="space-y-3.5">
            {verdict && <VerdictCard verdict={verdict} trend={climate.trend} />}
            <FieldPulseCard
              climate={climate}
              trend={climate.trend}
              ndvi={ndvi}
              outlook={outlook}
            />
            {ctx && (
              <ActionsCard
                ctx={ctx}
                trend={climate.trend}
                rotation={rotation}
                alerts={alerts}
                priorities={priorities}
              />
            )}
            {climate.trend && <TrendCard trend={climate.trend} />}

            {/* Full analysis */}
            <div>
              <button
                type="button"
                onClick={() => setShowDetail((v) => !v)}
                aria-expanded={showDetail}
                className="w-full flex items-center justify-between gap-3 bg-white rounded-2xl shadow-sm px-4 py-3 text-left transition-colors hover:bg-emerald-50/40 cursor-pointer"
              >
                <span>
                  <span className="block text-xs font-semibold text-slate-900">Full analysis</span>
                  <span className="block text-[10px] text-slate-500">
                    30-year climate record, then-vs-now data, rotation strategies, season playbook and where the same
                    crop fits better
                  </span>
                </span>
                <ChevronDown
                  className={`w-4 h-4 shrink-0 text-slate-400 transition-transform ${
                    showDetail ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {showDetail && (
                <div className="mt-3 space-y-4">
                  <Suspense
                    fallback={
                      <div className="bg-white rounded-2xl shadow-sm px-4 py-6 text-center">
                        <p className="data-tabular animate-pulse text-[11px] text-slate-400">
                          loading satellite charts…
                        </p>
                      </div>
                    }
                  >
                    <DataReadout climate={climate} terrain={terrain} soil={soil} />
                  </Suspense>
                  {strategies && <Rotations strategies={strategies} />}
                  {alerts.length > 0 && <AlertsPanel alerts={alerts} />}
                  {ctx && dominant && verdict && (
                    <ShiftExplorer ctx={ctx} dominantCropId={dominant} />
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function inferRegime(climate: ClimateFeatures): 'summer-rain' | 'winter-rain' | 'any' {
  const { monthly } = climate
  const summerRain =
    monthly.P[9] + monthly.P[10] + monthly.P[11] + monthly.P[0] + monthly.P[1] + monthly.P[2]
  const winterRain = monthly.P[3] + monthly.P[4] + monthly.P[5] + monthly.P[6] + monthly.P[7] + monthly.P[8]
  if (summerRain > winterRain * 1.6) return 'summer-rain'
  if (winterRain > summerRain * 1.6) return 'winter-rain'
  return 'any'
}
