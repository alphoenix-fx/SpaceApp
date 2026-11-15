import { useMemo } from 'react'
import { Droplets, MapPin, RotateCcw, Shovel, Sprout, X } from 'lucide-react'
import { CROPS, cropById, cropsForRegime } from '../lib/crops'
import { SOIL_LABELS, SOIL_PROFILES } from '../lib/soil'
import { PRESETS } from '../lib/regions'
import type { FarmPreset, SoilInfo, SoilTexture, TerrainInfo } from '../lib/types'
import FarmMap, { type LayerKind } from './FarmMap'
import { Chip, SectionHead } from './ui'

interface Props {
  preset: FarmPreset | null
  lat: number
  lon: number
  soil: SoilInfo
  terrain: TerrainInfo | null
  rotation: string[]
  layer: LayerKind
  mapDate: string
  onPreset: (p: FarmPreset) => void
  onLocation: (lat: number, lon: number) => void
  onSoil: (s: SoilInfo) => void
  onSlope: (p: number) => void
  onRotation: (r: string[]) => void
  onLayer: (l: LayerKind) => void
  onMapDate: (d: string) => void
}

const textures: SoilTexture[] = ['sand', 'sandyLoam', 'loam', 'clayLoam', 'clay']

const LAYER_OPTS: Array<{ id: LayerKind; label: string }> = [
  { id: 'none', label: 'Satellite imagery only' },
  { id: 'ndvi', label: 'Crop vigour (NDVI)' },
  { id: 'lst', label: 'Land surface temperature' },
  { id: 'truecolor', label: 'True colour (that day)' },
]

export default function FieldPanel({
  preset,
  lat,
  lon,
  soil,
  terrain,
  rotation,
  layer,
  mapDate,
  onPreset,
  onLocation,
  onSoil,
  onSlope,
  onRotation,
  onLayer,
  onMapDate,
}: Props) {
  const addable = useMemo(() => {
    const regime = preset?.regime ?? 'any'
    return cropsForRegime(regime)
  }, [preset])

  const addCrop = (id: string) => {
    if (id && rotation.length < 6) onRotation([...rotation, id])
  }

  return (
    <section id="field" className="scroll-mt-24">
      <SectionHead
        index="01"
        title="Your field"
        sub="Pick a demo region or click the map to place your field. Then tell the tool what it cannot see from orbit — your soil, and what you already grow."
      />

      {/* Region presets */}
      <div className="mb-4 flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => onPreset(p)}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all ${
              preset?.id === p.id
                ? 'border-leaf bg-leaf text-white shadow-card'
                : 'border-paper-3 bg-white/70 text-ink-2 hover:border-leaf/50 hover:bg-leaf/5'
            }`}
          >
            {p.name}
          </button>
        ))}
        {!preset && (
          <span className="rounded-full border border-dashed border-ochre/50 bg-ochre/10 px-3.5 py-1.5 text-xs font-medium text-ochre">
            Custom field — placed on map
          </span>
        )}
      </div>

      {/* Satellite map */}
      <div className="mb-5">
        <FarmMap lat={lat} lon={lon} onPick={onLocation} activePreset={preset} layer={layer} date={mapDate} />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-1.5">
            {LAYER_OPTS.map((o) => (
              <button
                key={o.id}
                onClick={() => onLayer(o.id)}
                className={`rounded-full border px-3 py-1.5 text-[11px] font-medium transition-all ${
                  layer === o.id
                    ? 'border-panel bg-panel text-panel-text shadow-card'
                    : 'border-paper-3 bg-white/70 text-ink-2 hover:border-ink/40'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
          {layer !== 'none' && (
            <div className="flex items-center gap-2">
              <label htmlFor="pass-date" className="text-[11px] font-medium text-ink-2">Pass date</label>
              <input
                id="pass-date"
                type="date"
                value={mapDate}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => onMapDate(e.target.value)}
                className="data-tabular rounded-lg border border-paper-3 bg-white/70 px-2 py-1.5 text-[11px] text-ink"
              />
            </div>
          )}
        </div>
        <p className="mt-2 text-[11px] text-ink-3">
          MODIS Terra 250–1000 m imagery via NASA GIBS: flip layers to see crop vigour (NDVI), ground heat, and the
          true-colour view. NDVI works best a few weeks into a growing season — GIBS keeps a rolling recent archive.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        {/* Coordinates + soil */}
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-2xl border border-paper-3 bg-panel px-4 py-3 shadow-card">
            <div className="flex items-center gap-3">
              <MapPin className="h-4 w-4 text-leaf-3" />
              <div>
                <p className="text-[10px] uppercase tracking-widest text-panel-text/60">Field centre</p>
                <p className="data-tabular text-sm text-panel-text">
                  {lat.toFixed(4)}° S &nbsp; {lon.toFixed(4)}° E
                </p>
              </div>
            </div>
            <p className="data-tabular hidden text-right text-[10px] text-panel-text/50 sm:block">
              click map or drag pin
            </p>
          </div>

          <div className="rounded-2xl border border-paper-3 bg-white/60 p-4 shadow-card">
            <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
              <Shovel className="h-4 w-4 text-ochre" /> Your soil
              <span className="ml-1 text-[10px] font-normal text-ink-3">
                (what satellites can’t see — you know it best)
              </span>
            </p>
            <div className="mb-3 grid grid-cols-5 gap-1.5">
              {textures.map((t) => (
                <button
                  key={t}
                  onClick={() => onSoil({ ...soil, texture: t })}
                  className={`rounded-lg border px-1 py-2 text-center transition-all ${
                    soil.texture === t
                      ? 'border-leaf bg-leaf/10'
                      : 'border-paper-3 bg-white/50 hover:border-leaf/40'
                  }`}
                >
                  <span className="block text-[11px] font-semibold text-ink">{SOIL_LABELS[t].name}</span>
                  <span className="mt-0.5 block text-[9px] leading-tight text-ink-3">
                    {SOIL_LABELS[t].hint}
                  </span>
                </button>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label htmlFor="om-range" className="text-[11px] font-medium text-ink-2">Organic matter</label>
                <div className="flex items-center gap-2">
                  <input
                    id="om-range"
                    type="range"
                    min={0.3}
                    max={4}
                    step={0.1}
                    value={soil.omPercent}
                    onChange={(e) => onSoil({ ...soil, omPercent: Number(e.target.value) })}
                    className="w-full"
                  />
                  <span className="data-tabular w-10 text-right text-xs text-ink">{soil.omPercent.toFixed(1)}%</span>
                </div>
              </div>
              <div>
                <label htmlFor="soil-drainage" className="text-[11px] font-medium text-ink-2">Drainage</label>
                <select
                  id="soil-drainage"
                  value={soil.drainage}
                  onChange={(e) => onSoil({ ...soil, drainage: e.target.value as SoilInfo['drainage'] })}
                  className="w-full rounded-lg border border-paper-3 bg-white/70 px-2 py-1.5 text-xs text-ink"
                >
                  <option value="poor">Poor / waterlogs</option>
                  <option value="moderate">Moderate</option>
                  <option value="good">Good / free</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-medium text-ink-2">Irrigation</label>
                <button
                  onClick={() => onSoil({ ...soil, irrigated: !soil.irrigated })}
                  className={`flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-xs font-medium transition-all ${
                    soil.irrigated
                      ? 'border-water bg-water/10 text-water'
                      : 'border-paper-3 bg-white/70 text-ink-3'
                  }`}
                >
                  <Droplets className="h-3.5 w-3.5" />
                  {soil.irrigated ? 'Irrigated (pump/scheme)' : 'Rainfed only'}
                </button>
              </div>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <label htmlFor="slope-range" className="text-[11px] font-medium text-ink-2">
                  Ground slope{' '}
                  <span className="text-[10px] text-ink-3">
                    {terrain?.source === 'manual' ? '(your estimate)' : '(Copernicus DEM — adjust if needed)'}
                  </span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="slope-range"
                    type="range"
                    min={0}
                    max={25}
                    step={0.5}
                    value={terrain?.slopePercent ?? 3}
                    onChange={(e) => onSlope(Number(e.target.value))}
                    className="w-full"
                  />
                  <span className="data-tabular w-14 text-right text-xs text-ink">
                    {(terrain?.slopePercent ?? 3).toFixed(1)}%
                  </span>
                </div>
              </div>
              <div>
                <span className="text-[11px] font-medium text-ink-2">Slope class</span>
                <p className="rounded-lg border border-paper-3 bg-white/50 px-2 py-1.5 text-xs text-ink">
                  {terrain?.slopeClass
                    ? terrain.slopeClass.charAt(0).toUpperCase() + terrain.slopeClass.slice(1)
                    : 'measuring…'}
                </p>
              </div>
            </div>
            <p className="mt-3 rounded-lg bg-paper-2 px-3 py-2 text-[11px] leading-snug text-ink-3">
              <span className="font-semibold text-ink-2">Soil note:</span>{' '}
              {SOIL_PROFILES[soil.texture].infiltrationNote}
            </p>
          </div>
        </div>

        {/* Rotation builder */}
        <div className="rounded-2xl border border-paper-3 bg-white/60 p-4 shadow-card">
          <div className="mb-1 flex items-center justify-between">
            <p className="flex items-center gap-2 text-sm font-semibold text-ink">
              <Sprout className="h-4 w-4 text-leaf" /> Current rotation
              <span className="text-[10px] font-normal text-ink-3">— what you grow, year by year</span>
            </p>
            {preset && (
              <button
                onClick={() => onRotation(preset.currentRotation)}
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-ink-3 hover:bg-paper-2 hover:text-ink"
              >
                <RotateCcw className="h-3 w-3" /> reset
              </button>
            )}
          </div>
          <p className="mb-3 text-[11px] text-ink-3">
            Add or remove crops to match your real cycle (max 6 years).{preset && ` Typical for ${preset.name}: ${preset.blurb}`}
          </p>
          <div className="min-h-[76px] rounded-xl border border-dashed border-paper-3 bg-paper-2/50 p-2.5">
            <div className="flex flex-wrap gap-2">
              {rotation.map((id, i) => {
                const c = cropById(id)
                if (!c) return null
                return (
                  <div
                    key={`${id}-${i}`}
                    className="group relative flex items-center gap-1.5 rounded-lg border border-paper-3 bg-white px-2.5 py-1.5 shadow-sm"
                  >
                    <span className="data-tabular text-[9px] font-bold text-ink-3">Y{i + 1}</span>
                    <span className="text-xs font-semibold text-ink">{c.name}</span>
                    <Chip tone={c.family === 'legume' ? 'ochre' : c.family === 'grass' ? 'leaf' : c.family === 'brassica' ? 'clay' : 'neutral'}>
                      {c.season === 'perennial' ? 'ley' : c.season}
                    </Chip>
                    <button
                      onClick={() => onRotation(rotation.filter((_, j) => j !== i))}
                      className="rounded-full p-0.5 text-ink-3 opacity-60 transition hover:bg-clay/10 hover:text-clay group-hover:opacity-100"
                      aria-label={`Remove ${c.name}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )
              })}
              {rotation.length === 0 && (
                <p className="px-2 py-3 text-xs text-ink-3">Empty — add crops below to build your rotation.</p>
              )}
            </div>
          </div>
          <div className="mt-3">
            <label htmlFor="add-crop" className="text-[11px] font-medium text-ink-2">Add a crop to the cycle</label>
            <select
              id="add-crop"
              value=""
              onChange={(e) => addCrop(e.target.value)}
              className="mt-1 w-full rounded-lg border border-paper-3 bg-white/70 px-2 py-2 text-xs text-ink"
            >
              <option value="">— choose a crop —</option>
              {addable.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {c.season} · {c.waterMm[0]}–{c.waterMm[1]} mm
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-[10px] text-ink-3">
              {CROPS.length - 1} crops in the knowledge base (FAO/ARC typical values). Water ranges are seasonal
              crop water requirements.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
