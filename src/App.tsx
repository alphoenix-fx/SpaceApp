import { lazy, Suspense, useMemo, useState } from 'react'
import { AlertTriangle, ArrowRight, ChevronDown, Satellite, Sprout } from 'lucide-react'
import { PRESETS } from './lib/regions'
import { CROPS, cropById } from './lib/crops'
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

  const analyse = async (autoScroll = true) => {
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
      if (autoScroll) {
        setTimeout(() => document.getElementById('verdict')?.scrollIntoView({ behavior: 'smooth' }), 250)
      }
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

  const runDemo = () => {
    applyPreset(PRESETS[0])
    void analyse(true)
  }

  // Live numbers for the console readout (before a full scan runs).
  const consoleReadout = useMemo(() => {
    if (!climate) {
      return { temperature: null, rainMm: null, soilMoisture: null, hotDays: null, loading: phase === 'loading' }
    }
    const month = new Date().getMonth()
    return {
      temperature: climate.monthly.Tavg[month] ?? null,
      rainMm: climate.trend?.recent.rainMm ?? null,
      soilMoisture: climate.trend?.recent.wetness ?? climate.monthly.GWETROOT[month] ?? null,
      hotDays: climate.heatMonths32,
      loading: false,
    }
  }, [climate, phase])

  const headlineCrop = useMemo(() => {
    const c = dominant ? cropById(dominant) : undefined
    return c?.name ?? 'your crop'
  }, [dominant])

  const consoleHeadline = useMemo(() => {
    if (verdict) return verdict.headline
    return 'Read your fields from orbit'
  }, [verdict])

  return (
    <div className="min-h-screen">
      <Nav phase={phase} />

      <IntroBand onDemo={runDemo} />

      <FieldConsole
        lat={lat}
        lon={lon}
        layer={layer}
        mapDate={mapDate}
        onPick={pickLocation}
        onLayer={setLayer}
        onMapDate={setMapDate}
        rotation={rotation}
        cropLabel={(id) => cropById(id)?.name ?? id}
        readout={consoleReadout}
        headlineCrop={headlineCrop}
        headline={consoleHeadline}
      />

      <main className="mx-auto max-w-6xl px-5">
        {/* Steps 01 + 02 */}
        <div className="space-y-16 py-16">
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
          <PrioritiesPanel priorities={priorities} onChange={setPriorities} />

          {/* Analyse CTA */}
          <div id="analyse" className="scroll-mt-24">
            <div className="relative overflow-hidden rounded-2xl border border-panel bg-panel px-6 py-8 text-panel-text shadow-lift">
              <div className="pointer-events-none absolute -top-24 -right-16 h-64 w-64 rounded-full bg-leaf/20 blur-3xl" />
              <div className="relative flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-center">
                <div>
                  <h3 className="font-display text-2xl font-semibold">
                    {phase === 'done' ? 'Field scanned — results are live below' : 'Ready to read your field from orbit?'}
                  </h3>
                  <p className="mt-1 max-w-xl text-sm text-panel-text/70">
                    {phase === 'done'
                      ? 'Changing soil, crops or priorities re-scores the strategies instantly — no need to re-fetch.'
                      : 'We’ll pull 30+ years of NASA POWER climatology for your exact point, sample Copernicus DEM elevation for erosion risk, then score your rotation against data-driven alternatives.'}
                  </p>
                  {error && (
                    <p className="mt-2 flex items-center gap-2 text-xs text-clay">
                      <AlertTriangle className="h-3.5 w-3.5" /> {error}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => void analyse(false)}
                  disabled={phase === 'loading'}
                  className={`relative flex shrink-0 items-center gap-3 overflow-hidden rounded-full px-6 py-3.5 text-sm font-semibold transition-all ${
                    phase === 'loading'
                      ? 'cursor-wait bg-leaf/40 text-panel-text'
                      : 'bg-leaf text-white shadow-card hover:bg-leaf-dark hover:shadow-lift'
                  }`}
                >
                  <Satellite className={`h-4 w-4 ${phase === 'loading' ? 'animate-pulse' : ''}`} />
                  {phase === 'loading' ? 'Scanning field…' : phase === 'done' ? 'Re-scan field' : 'Analyse with NASA data'}
                  {phase === 'loading' && <span className="sweep absolute inset-0" />}
                </button>
              </div>
            </div>
          </div>

          {/* Results — the diagnosis: four cards, top to bottom */}
          {phase === 'done' && climate && terrain && (
            <div className="space-y-6">
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
              <div className="pt-4">
                <button
                  onClick={() => setShowDetail((v) => !v)}
                  aria-expanded={showDetail}
                  className="flex w-full items-center justify-between gap-3 rounded-2xl border border-paper-3 bg-white/60 px-5 py-4 text-left shadow-card transition hover:border-leaf/40"
                >
                  <span>
                    <span className="block font-display text-lg font-semibold text-ink">
                      Full analysis
                    </span>
                    <span className="block text-[12px] text-ink-3">
                      30-year climate record, then-vs-now data, rotation strategies, the full season
                      playbook and where the same crop fits better
                    </span>
                  </span>
                  <ChevronDown
                    className={`h-5 w-5 shrink-0 text-ink-3 transition-transform ${
                      showDetail ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {showDetail && (
                  <div className="mt-6 space-y-12">
                    <Suspense
                      fallback={
                        <div className="rounded-2xl border border-paper-3 bg-white/60 p-8 text-center shadow-card">
                          <p className="data-tabular animate-pulse text-xs text-ink-3">
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
      </main>

      <Footer />
    </div>
  )
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
// Chrome
// ---------------------------------------------------------------------------

function Nav({ phase }: { phase: string }) {
  const links: Array<[string, string]> = [
    ['01 Field', '#field'],
    ['02 Priorities', '#priorities'],
    ['03 Verdict', '#verdict'],
    ['04 Pulse', '#pulse'],
    ['05 Actions', '#actions'],
    ['06 Trend', '#trend'],
  ]
  return (
    <header className="sticky top-0 z-[900] border-b border-paper-3 bg-paper/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
        <a href="#top" className="flex items-center gap-2.5">
          <BrandMark />
          <div>
            <span className="font-display text-lg font-bold leading-none tracking-tight text-ink">FieldShift</span>
            <span className="block text-[9px] uppercase tracking-[0.2em] text-ink-3">NASA Space Apps 2026</span>
          </div>
        </a>
        <nav className="hidden items-center gap-0.5 lg:flex">
          {links.map(([label, href]) => (
            <a
              key={href}
              href={href}
              className={`rounded-full px-2.5 py-1.5 text-[11px] font-medium transition hover:bg-paper-2 ${
                ['#verdict', '#pulse', '#actions', '#trend'].includes(href) && phase !== 'done'
                  ? 'text-ink-3/50'
                  : 'text-ink-2'
              }`}
            >
              {label}
            </a>
          ))}
        </nav>
        <Chip tone="leaf"><span className="hidden sm:inline">Adapting Farms with NASA Data</span><span className="sm:hidden">Field Shift</span></Chip>
      </div>
    </header>
  )
}

function BrandMark() {
  return (
    <svg width="34" height="34" viewBox="0 0 34 34" fill="none" aria-hidden>
      <rect x="1.5" y="1.5" width="31" height="31" rx="8" fill="#161d17" />
      {[0, 1, 2, 3].map((i) => (
        <path
          key={i}
          d={`M6 ${9 + i * 5} Q 17 ${5 + i * 5} 28 ${9 + i * 5}`}
          stroke={i === 3 ? '#8cc49a' : '#55a068'}
          strokeWidth="1.6"
          strokeLinecap="round"
          fill="none"
          opacity={0.9 - i * 0.15}
        />
      ))}
      <ellipse
        cx="17"
        cy="17"
        rx="14.5"
        ry="6.5"
        stroke="#c98a2d"
        strokeWidth="1.2"
        fill="none"
        transform="rotate(-24 17 17)"
        strokeDasharray="2.5 3"
      />
      <circle cx="28.5" cy="10.5" r="2.1" fill="#c98a2d" />
    </svg>
  )
}

function IntroBand({ onDemo }: { onDemo: () => void }) {
  return (
    <section id="top" className="relative overflow-hidden bg-panel text-panel-text">
      {/* field photograph */}
      <img
        src="/images/hero-farmer.jpg"
        alt=""
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-30"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-panel via-panel/90 to-panel/55" />
      <div className="pointer-events-none absolute -top-32 right-1/4 h-96 w-96 rounded-full bg-leaf/15 blur-3xl" />

      <div className="relative mx-auto max-w-6xl px-5 py-14 lg:py-20">
        <div className="rise max-w-2xl">
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <Chip tone="ochre">NASA Space Apps 2026</Chip>
            <Chip tone="dark">Field Shift challenge</Chip>
            <Chip tone="dark">South Africa 🇿🇦</Chip>
          </div>
          <h1 className="font-display text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">
            Read your fields from orbit.
            <span className="block text-leaf-3">Plan the seasons ahead.</span>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-panel-text/75">
            Rainfall is shifting. Heat spells stretch. The water bank under your feet matters more every
            year. FieldShift turns{' '}
            <strong className="text-panel-text">30+ years of NASA Earth observations</strong> into a
            plain-language health check for your exact field — scored against <em>your</em> priorities,
            and always deferring to your judgement.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <button
              onClick={onDemo}
              className="group flex items-center gap-2.5 rounded-full bg-leaf px-6 py-3.5 text-sm font-semibold text-white shadow-card transition hover:bg-leaf-2 hover:shadow-lift"
            >
              <Sprout className="h-4 w-4 transition group-hover:scale-110" />
              Try a Free State demo farm
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </button>
            <a
              href="#console"
              className="rounded-full border border-panel-line px-6 py-3.5 text-sm font-semibold text-panel-text transition hover:border-leaf-3 hover:text-leaf-3"
            >
              Open the field console
            </a>
          </div>
          <div className="mt-8 flex flex-wrap gap-x-7 gap-y-2 text-[11px] text-panel-text/55">
            <span><strong className="data-tabular text-panel-text/80">{CROPS.length}</strong> SA rotation crops</span>
            <span><strong className="data-tabular text-panel-text/80">5</strong> demo regions</span>
            <span><strong className="data-tabular text-panel-text/80">30+ yrs</strong> NASA POWER climatology</span>
            <span><strong className="data-tabular text-panel-text/80">4</strong> live NASA satellite layers</span>
          </div>
        </div>
      </div>
    </section>
  )
}
