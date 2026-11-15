import { lazy, Suspense, useMemo, useState } from 'react'
import { AlertTriangle, ArrowRight, ChevronDown, Satellite, Sprout } from 'lucide-react'
import { PRESETS } from './lib/regions'
import { fetchClimateFeatures } from './lib/power'
import { fetchTerrain, manualTerrain } from './lib/terrain'
import { fetchOutlook, type Outlook } from './lib/forecast'
import { fetchNdviPulse, type NdviPulse } from './lib/ndvi'
import { buildStrategies, computeVerdict, dominantCropId, type AnalysisContext } from './lib/scoring'
import { buildPlaybook } from './lib/alerts'
import type {
  ClimateFeatures,
  FarmPreset,
  Priorities,
  SoilInfo,
  Strategy,
  TerrainInfo,
} from './lib/types'
import FieldPanel from './components/FieldPanel'
import FieldConsole, { type ConsoleLayer } from './components/FieldConsole'
import PrioritiesPanel from './components/PrioritiesPanel'
import Rotations from './components/Rotations'
import VerdictCard from './components/VerdictCard'
import FieldPulseCard from './components/FieldPulseCard'
import ActionsCard from './components/ActionsCard'
import TrendCard from './components/TrendCard'
import AlertsPanel from './components/AlertsPanel'
import ShiftExplorer from './components/ShiftExplorer'
import Footer from './components/Footer'
import { Chip } from './components/ui'

// Charts are the heaviest bundle — load them only once the scan finishes
const DataReadout = lazy(() => import('./components/DataReadout'))

const DEFAULT_SOIL: SoilInfo = {
  texture: 'clayLoam',
  omPercent: 1.8,
  drainage: 'moderate',
  irrigated: false,
}

const DEFAULT_PRIORITIES: Priorities = { water: 70, soil: 70, income: 40, erosion: 55, forage: 30 }

function isoDaysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

export default function App() {
  const [preset, setPreset] = useState<FarmPreset | null>(PRESETS[0])
  const [lat, setLat] = useState(PRESETS[0].lat)
  const [lon, setLon] = useState(PRESETS[0].lon)
  const [soil, setSoil] = useState<SoilInfo>({ ...DEFAULT_SOIL, texture: PRESETS[0].soil })
  const [rotation, setRotation] = useState<string[]>([...PRESETS[0].currentRotation])
  const [priorities, setPriorities] = useState<Priorities>(DEFAULT_PRIORITIES)

  const [phase, setPhase] = useState<'idle' | 'loading' | 'done'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [climate, setClimate] = useState<ClimateFeatures | null>(null)
  const [terrain, setTerrain] = useState<TerrainInfo | null>(null)
  const [ndvi, setNdvi] = useState<NdviPulse | null>(null)
  const [outlook, setOutlook] = useState<Outlook | null>(null)
  const [showDetail, setShowDetail] = useState(false)
  const [showExport, setShowExport] = useState(false)

  const [layer, setLayer] = useState<ConsoleLayer>('truecolor')
  const [mapDate, setMapDate] = useState(isoDaysAgo(45))

  const applyPreset = (p: FarmPreset) => {
    setPreset(p)
    setLat(p.lat)
    setLon(p.lon)
    setSoil((s) => ({ ...s, texture: p.soil, irrigated: p.irrigated ?? false }))
    setRotation([...p.currentRotation])
  }

  const pickLocation = (la: number, lo: number) => {
    setPreset(null)
    setLat(la)
    setLon(lo)
  }

  const analyse = async () => {
    setPhase('loading')
    setError(null)
    setNdvi(null)
    setOutlook(null)
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
          ? `Could not reach NASA POWER: ${e.message}. Check your connection and try again.`
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
    () => (ctx ? dominantCropId((rotation.length ? rotation : ['fallow']).map((cropId, i) => ({ year: i + 1, cropId }))) : null),
    [ctx, rotation],
  )

  const alerts = useMemo(() => {
    if (!ctx) return []
    return buildPlaybook(ctx.climate, dominant, ctx.soil, ctx.climate.trend)
  }, [ctx, dominant])

  return (
    <div className="min-h-screen bg-canvas">
      <Nav />

      {/* Split-screen: full-bleed map left (~65%), diagnostic drawer right (~35%) */}
      <div className="flex flex-1 min-h-0 relative">
        {/* Left panel — satellite map */}
        <div className="flex-1 relative min-w-0 bg-slate-900">
          <FieldConsole
            lat={lat}
            lon={lon}
            layer={layer}
            mapDate={mapDate}
            onPick={pickLocation}
            onLayer={setLayer}
            onMapDate={setMapDate}
          />
        </div>

        {/* Right panel — diagnostic drawer */}
        <aside className="w-full lg:w-[35%] bg-canvas overflow-y-auto thin-scroll border-l border-slate-200 z-10 flex-shrink-0">
          <div className="p-4 lg:p-6 space-y-5">
            {/* Field setup card */}
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
            />

            {/* Priorities card */}
            <PrioritiesPanel priorities={priorities} onChange={setPriorities} />

            {/* Analyse CTA */}
            <div className="rounded-2xl border border-emerald-200 bg-emerald-soft px-5 py-6 shadow-card">
              <div className="relative flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                  <h3 className="font-display text-lg font-bold leading-tight text-ink">
                    {phase === 'done' ? 'Field scanned — results are live' : 'Ready to read your field from orbit?'}
                  </h3>
                  <p className="mt-1 max-w-sm text-[12px] leading-relaxed text-ink-2">
                    {phase === 'done'
                      ? 'Changing soil, crops or priorities re-scores the strategies instantly — no need to re-fetch.'
                      : "We'll pull NASA POWER climatology for your exact point, sample Copernicus DEM for erosion risk, then score your rotation against alternatives."}
                  </p>
                  {error && (
                    <p className="mt-2 flex items-center gap-2 text-xs text-rose-600">
                      <AlertTriangle className="h-3 w-3" /> {error}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => void analyse()}
                  disabled={phase === 'loading'}
                  className={`relative flex shrink-0 items-center gap-2 overflow-hidden rounded-full px-4 py-2.5 text-sm font-bold transition-all ${
                    phase === 'loading'
                      ? 'cursor-wait bg-emerald-600/50 text-ink-3'
                      : 'bg-emerald-600 text-white shadow-lift hover:bg-forest-emerald hover:shadow-emerald-lg'
                  }`}
                >
                  <Satellite className={`h-3.5 w-3.5 ${phase === 'loading' ? 'animate-pulse' : ''}`} />
                  {phase === 'loading' ? 'Scanning field…' : phase === 'done' ? 'Re-scan field' : 'Analyse with NASA data'}
                  {phase === 'loading' && <span className="sweep absolute inset-0" />}
                </button>
              </div>
            </div>

            {/* Results — the diagnosis: four cards, top to bottom */}
            {phase === 'done' && climate && terrain && (
              <div className="space-y-5">
                {verdict && (
                  <VerdictCard verdict={verdict} trend={climate.trend} />
                )}
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

                {/* Full analysis — the deep dive, on demand */}
                <div className="pt-1">
                  <button
                    onClick={() => setShowDetail((v) => !v)}
                    aria-expanded={showDetail}
                    className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-100 bg-white px-4 py-3 text-left shadow-card transition hover:border-emerald-200 hover:shadow-lift"
                  >
                    <span>
                      <span className="block font-display text-base font-bold text-ink">Full analysis</span>
                      <span className="block text-[11px] text-ink-3">
                        30-year climate record, then-vs-now data, rotation strategies, the full season playbook and where
                        the same crop fits better
                      </span>
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-ink-3 transition-transform ${showDetail ? 'rotate-180' : ''}`}
                    />
                  </button>

                  {showDetail && (
                    <div className="mt-5 space-y-6">
                      <Suspense
                        fallback={
                          <div className="rounded-2xl border border-slate-100 bg-white p-6 text-center shadow-card">
                            <p className="data-tabular animate-pulse text-xs text-ink-3">Loading satellite charts…</p>
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

            {/* Export CTA */}
            <button
              onClick={() => setShowExport(true)}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-600 px-5 py-4 text-sm font-bold text-white shadow-emerald-lg hover:bg-forest-emerald hover:shadow-emerald-xl transition"
              aria-label="Export simple farm report"
            >
              <Sprout className="h-4 w-4" /> Export simple farm report
            </button>
          </div>
        </aside>
      </div>

      <Footer />

      <div
        role="dialog"
        aria-modal="true"
        aria-hidden={!showExport}
        className={`fixed inset-0 z-[100] ${showExport ? '' : 'hidden'}`}
      >
        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowExport(false)} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md rounded-2xl border border-emerald-200 bg-white p-6 shadow-2xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-lg font-bold text-ink">Export Simple Farm Report</h3>
            <button
              onClick={() => setShowExport(false)}
              className="rounded-full p-1.5 hover:bg-slate-100 text-ink-3"
              aria-label="Close"
            >
              <ChevronDown className="h-4 w-4 rotate-90" />
            </button>
          </div>
          <div className="space-y-3 text-[12px] text-ink-2">
            <p className="flex items-start gap-2">
              <Satellite className="mt-0.5 h-4 w-4 text-emerald-600 shrink-0" />
              <span className="leading-relaxed">
                Field: <span className="font-bold text-ink">{preset?.name ?? 'Custom field'}</span> (
                <span className="data-tabular">{lat.toFixed(4)}°S, {lon.toFixed(4)}°E</span>
              )</span>
            </p>
            {verdict && (
              <p className="flex items-start gap-2">
                <span className="mt-0.5 h-4 w-4 text-emerald-600 shrink-0" />
                <span className="leading-relaxed">
                  Verdict: <span className={`font-bold ${scoreTone(verdict.score)}`}>{verdict.headline}</span> —{' '}
                  {verdict.score}% suitability
                </span>
              </p>
            )}
            <p className="mt-2 text-[11px] text-ink-3">
              Paste this summary into WhatsApp, email or print it for your extension officer. FieldShift supports — never
              replaces — farmer judgement and local expertise.
            </p>
            <button
              onClick={() => {
                setShowExport(false)
                void navigator.clipboard?.writeText(document.body.innerText)
              }}
              className="mt-4 w-full flex items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-soft px-4 py-2.5 text-sm font-bold text-emerald-600 hover:bg-emerald-200 transition"
            >
              <ArrowRight className="h-3.5 w-3.5" /> Copy report summary
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function scoreTone(score: number): string {
  if (score >= 70) return 'text-emerald-600'
  if (score >= 50) return 'text-amber-700'
  return 'text-rose-600'
}

function inferRegime(climate: ClimateFeatures): 'summer-rain' | 'winter-rain' | 'any' {
  const { monthly } = climate
  const summerRain = monthly.P[9] + monthly.P[10] + monthly.P[11] + monthly.P[0] + monthly.P[1] + monthly.P[2]
  const winterRain = monthly.P[3] + monthly.P[4] + monthly.P[5] + monthly.P[6] + monthly.P[7] + monthly.P[8]
  if (summerRain > winterRain * 1.6) return 'summer-rain'
  if (winterRain > summerRain * 1.6) return 'winter-rain'
  return 'any'
}

// ---------------------------------------------------------------------------
// Chrome — 64px emerald top navigation header
// ---------------------------------------------------------------------------

function Nav() {
  return (
    <header className="sticky top-0 z-[900] border-b border-slate-200 bg-emerald-600/95 backdrop-blur-md shadow-lift">
      <div className="mx-auto flex max-w-6xl h-16 items-center justify-between px-4 lg:px-6">
        <a href="#top" className="flex items-center gap-2.5">
          <BrandMark />
          <div>
            <span className="font-display text-sm font-bold leading-none tracking-tight text-white">FieldShift</span>
            <span className="block text-[9px] uppercase tracking-[0.2em] text-emerald-soft/90">
              NASA Space Apps 2026
            </span>
          </div>
        </a>
        <div className="hidden lg:flex-1 lg:max-w-md lg:mx-10 flex items-center">
          <div className="flex w-full items-center rounded-full border border-slate-800 bg-slate-900/80 px-3 py-1.5 text-white">
            <SearchIcon className="h-4 w-4 mr-2 text-emerald-300" />
            <input
              type="search"
              placeholder="Search a farm, town or lat, lon"
              className="bg-transparent w-full text-xs outline-none placeholder-emerald-soft/60"
              aria-label="Search location"
            />
            <button className="ml-2 rounded-full bg-emerald-500 px-3 py-1 text-xs font-bold text-white hover:bg-forest-emerald transition">
              Search
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Chip tone="slate"><span className="hidden sm:inline">Adapting Farms with NASA Data</span><span className="sm:hidden">Field Shift</span></Chip>
          <span className="text-[10px] uppercase tracking-widest font-bold text-emerald-soft/80">Earth</span>
        </div>
      </div>
    </header>
  )
}

function BrandMark() {
  return (
    <svg width="30" height="30" viewBox="0 0 30 30" fill="none" aria-hidden>
      <rect x="1.5" y="1.5" width="27" height="27" rx="7" fill="#0f172a" />
      {[0, 1, 2, 3].map((i) => (
        <path
          key={i}
          d={`M5 ${8 + i * 4} Q 15 ${4 + i * 4} 25 ${8 + i * 4}`}
          stroke={i === 3 ? '#1db954' : '#16a34a'}
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
          opacity={0.9 - i * 0.15}
        />
      ))}
      <ellipse
        cx="15"
        cy="15"
        rx="13"
        ry="6"
        stroke="#d97706"
        strokeWidth="1"
        fill="none"
        transform="rotate(-24 15 15)"
        strokeDasharray="2.5 3"
      />
      <circle cx="25" cy="9" r="1.8" fill="#d97706" />
    </svg>
  )
}

function SearchIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21 -4.3-4.3" />
    </svg>
  )
}
