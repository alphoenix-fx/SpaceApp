import { lazy, Suspense, useMemo, useState } from 'react'
import { AlertTriangle, ArrowRight, Satellite, Sprout } from 'lucide-react'
import { PRESETS } from './lib/regions'
import { CROPS } from './lib/crops'
import { fetchClimateFeatures } from './lib/power'
import { fetchTerrain, manualTerrain } from './lib/terrain'
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
import type { LayerKind } from './components/FarmMap'
import PrioritiesPanel from './components/PrioritiesPanel'
import Rotations from './components/Rotations'
import VerdictCard from './components/VerdictCard'
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

  const [layer, setLayer] = useState<LayerKind>('ndvi')
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
    try {
      const [clim, terr] = await Promise.all([
        fetchClimateFeatures(lat, lon),
        fetchTerrain(lat, lon).catch(() => manualTerrain(3)),
      ])
      setClimate(clim)
      setTerrain(terr)
      setPhase('done')
      if (autoScroll) {
        setTimeout(() => document.getElementById('data')?.scrollIntoView({ behavior: 'smooth' }), 250)
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

  return (
    <div className="min-h-screen">
      <Nav phase={phase} />

      <Hero onDemo={runDemo} />

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
            layer={layer}
            mapDate={mapDate}
            onPreset={applyPreset}
            onLocation={pickLocation}
            onSoil={setSoil}
            onSlope={(p) => setTerrain(manualTerrain(p))}
            onRotation={setRotation}
            onLayer={setLayer}
            onMapDate={setMapDate}
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

          {/* Results */}
          {phase === 'done' && climate && terrain && (
            <div className="space-y-16">
              <Suspense
                fallback={
                  <div className="rounded-2xl border border-paper-3 bg-white/60 p-8 text-center shadow-card">
                    <p className="data-tabular animate-pulse text-xs text-ink-3">loading satellite charts…</p>
                  </div>
                }
              >
                <DataReadout climate={climate} terrain={terrain} soil={soil} />
              </Suspense>
              {verdict && <VerdictCard verdict={verdict} />}
              {strategies && <Rotations strategies={strategies} />}
              {alerts.length > 0 && <AlertsPanel alerts={alerts} />}
              {ctx && dominant && verdict && (
                <ShiftExplorer ctx={ctx} dominantCropId={dominant} />
              )}
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
    ['03 Data', '#data'],
    ['04 Verdict', '#verdict'],
    ['05 Adapt', '#rotations'],
    ['06 Playbook', '#playbook'],
    ['07 Shift', '#shift'],
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
                ['#data', '#verdict', '#rotations', '#playbook', '#shift'].includes(href) && phase !== 'done'
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

function Hero({ onDemo }: { onDemo: () => void }) {
  return (
    <section id="top" className="relative overflow-hidden bg-panel text-panel-text">
      {/* contour art */}
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.16]"
        viewBox="0 0 1200 600"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden
      >
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <path
            key={i}
            d={`M -50 ${140 + i * 62} C 250 ${60 + i * 66}, 480 ${230 + i * 58}, 760 ${140 + i * 63} S 1150 ${40 + i * 70}, 1260 ${170 + i * 60}`}
            stroke="#8cc49a"
            strokeWidth={i % 3 === 0 ? 1.4 : 0.8}
            fill="none"
          />
        ))}
      </svg>
      <div className="pointer-events-none absolute -top-32 right-1/4 h-96 w-96 rounded-full bg-leaf/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 left-1/3 h-96 w-96 rounded-full bg-water/10 blur-3xl" />

      <div className="relative mx-auto grid max-w-6xl gap-10 px-5 py-20 lg:grid-cols-[1.15fr_0.85fr] lg:py-28">
        <div className="rise">
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <Chip tone="ochre">NASA Space Apps 2026</Chip>
            <Chip tone="dark">Field Shift challenge</Chip>
            <Chip tone="dark">South Africa 🇿🇦</Chip>
          </div>
          <h1 className="font-display text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
            Read your fields from orbit.
            <span className="block text-leaf-3">Plan the seasons ahead.</span>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-panel-text/75">
            Rainfall is shifting. Heat spells stretch. The water bank under your feet matters more every year.
            FieldShift turns <strong className="text-panel-text">30+ years of NASA Earth observations</strong> into a
            plain-language, side-by-side comparison of crop rotations for your exact field — scored against{' '}
            <em>your</em> priorities, and always deferring to your judgement.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button
              onClick={onDemo}
              className="group flex items-center gap-2.5 rounded-full bg-leaf px-6 py-3.5 text-sm font-semibold text-white shadow-card transition hover:bg-leaf-2 hover:shadow-lift"
            >
              <Sprout className="h-4 w-4 transition group-hover:scale-110" />
              Try a Free State demo farm
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </button>
            <a
              href="#field"
              className="rounded-full border border-panel-line px-6 py-3.5 text-sm font-semibold text-panel-text transition hover:border-leaf-3 hover:text-leaf-3"
            >
              Start with my field
            </a>
          </div>
          <div className="mt-9 flex flex-wrap gap-x-7 gap-y-2 text-[11px] text-panel-text/55">
            <span><strong className="data-tabular text-panel-text/80">{CROPS.length}</strong> SA rotation crops</span>
            <span><strong className="data-tabular text-panel-text/80">5</strong> demo regions</span>
            <span><strong className="data-tabular text-panel-text/80">30+ yrs</strong> NASA POWER climatology</span>
            <span><strong className="data-tabular text-panel-text/80">3</strong> live satellite layers</span>
          </div>
        </div>

        {/* console card */}
        <div className="fadein relative self-center">
          <div className="rounded-2xl border border-panel-line bg-panel-2/80 p-5 shadow-lift backdrop-blur">
            <div className="mb-3 flex items-center justify-between">
              <span className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-panel-text/60">
                <Satellite className="h-3.5 w-3.5 text-leaf-3" /> Satellite console
              </span>
              <span className="ping-soft h-2 w-2 rounded-full bg-leaf-3" />
            </div>
            {/* NDVI-ish field plot */}
            <div className="overflow-hidden rounded-xl border border-panel-line">
              <svg viewBox="0 0 320 150" className="block h-36 w-full" aria-hidden>
                <rect width="320" height="150" fill="#0e140f" />
                {[
                  ['#1b4a2c', 8], ['#2f7d46', 16], ['#55a068', 22], ['#8cc49a', 26],
                ].map(([color, r], idx) => (
                  <ellipse
                    key={idx}
                    cx={90 + idx * 18}
                    cy={80 + idx * 6}
                    rx={Number(r) * 4.2}
                    ry={Number(r) * 1.5}
                    fill="none"
                    stroke={color as string}
                    strokeWidth="1.5"
                  />
                ))}
                {Array.from({ length: 9 }).map((_, i) => (
                  <line
                    key={i}
                    x1={230}
                    y1={20 + i * 14}
                    x2={310}
                    y2={44 + i * 12}
                    stroke="#55a068"
                    strokeOpacity="0.35"
                    strokeWidth="1"
                  />
                ))}
                <circle cx="262" cy="76" r="3" fill="#c98a2d" />
                <text x="18" y="26" fill="#d9e2d2" fontSize="9" fontFamily="monospace">
                  NDVI 0.62 · MODIS Terra
                </text>
                <text x="18" y="42" fill="#8cc49a" fontSize="9" fontFamily="monospace">
                  soil wetness 0.41 ▼
                </text>
                <text x="18" y="132" fill="#c98a2d" fontSize="9" fontFamily="monospace">
                  ET0 5.8 mm/d · Tmax 33.2°C
                </text>
              </svg>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              {[
                ['Rain yr', '512 mm'],
                ['Aridity', '0.41'],
                ['Hot mo >32°', '3'],
              ].map(([k, v]) => (
                <div key={k} className="rounded-lg border border-panel-line bg-panel/60 px-2 py-2">
                  <p className="text-[9px] uppercase tracking-wider text-panel-text/50">{k}</p>
                  <p className="data-tabular text-sm font-semibold text-panel-text">{v}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-center text-[10px] leading-snug text-panel-text/45">
              Example readout — run the scan on your own field for live values.
            </p>
          </div>
        </div>
      </div>

      {/* How it works strip */}
      <div className="relative border-t border-panel-line bg-panel/60">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-6 gap-y-2 px-5 py-4 text-[11px] text-panel-text/60">
          <span>① Pin your field</span>
          <span>② See what shifted (10–15 yrs)</span>
          <span>③ Verdict: keep · adapt · shift</span>
          <span>④ This season's playbook</span>
          <span>⑤ Explore where it fits better</span>
        </div>
      </div>
    </section>
  )
}
