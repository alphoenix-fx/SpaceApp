import { useMemo } from 'react'
import { Droplets, MapPin, RotateCcw, Shovel, Sprout, X } from 'lucide-react'
import { CROPS, cropById, cropsForRegime } from '../lib/crops'
import { SOIL_LABELS, SOIL_PROFILES } from '../lib/soil'
import { PRESETS } from '../lib/regions'
import type { FarmPreset, SoilInfo, SoilTexture, TerrainInfo } from '../lib/types'
import { Chip, SectionHead } from './ui'

interface Props {
  preset: FarmPreset | null
  lat: number
  lon: number
  soil: SoilInfo
  terrain: TerrainInfo | null
  rotation: string[]
  onPreset: (p: FarmPreset) => void
  onSoil: (s: SoilInfo) => void
  onSlope: (p: number) => void
  onRotation: (r: string[]) => void
}

const textures: SoilTexture[] = ['sand', 'sandyLoam', 'loam', 'clayLoam', 'clay']

export default function FieldPanel({
  preset,
  lat,
  lon,
  soil,
  terrain,
  rotation,
  onPreset,
  onSoil,
  onSlope,
  onRotation,
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
        sub="Tell the tool what it cannot see from orbit — your soil, and what you actually grow."
      />

      {/* Region presets */}
      <div className="mb-4 flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => onPreset(p)}
            className={`rounded-full border px-3 py-1.5 text-xs font-bold transition-all ${
              preset?.id === p.id
                ? 'border-emerald-600 bg-emerald-600 text-white shadow-emerald-lg'
                : 'border-slate-100 bg-white text-ink-2 hover:border-emerald-100 hover:bg-emerald-soft'
            }`}
          >
            {p.name}
          </button>
        ))}
        {!preset && (
          <span className="rounded-full border border-dashed border-amber-200 bg-amber-soft px-3 py-1.5 text-xs font-bold text-amber-700">
            Custom field — placed on the map
          </span>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        {/* Coordinates + soil */}
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-white px-3.5 py-2.5 shadow-sm">
            <div className="flex items-center gap-2.5">
              <MapPin className="h-3.5 w-3.5 text-emerald-600" />
              <div>
                <p className="text-[9px] uppercase tracking-wider text-ink-3">Field centre</p>
                <p className="data-tabular text-xs font-bold text-ink">
                  {lat.toFixed(4)}°S &nbsp; {lon.toFixed(4)}°E
                </p>
              </div>
            </div>
            <p className="data-tabular hidden text-right text-[9px] text-ink-3 sm:block">
              click map or drag pin
            </p>
          </div>

          <div className="rounded-xl border border-slate-100 bg-white p-3.5 shadow-sm">
            <p className="mb-3 flex items-center gap-2 text-sm font-bold text-ink">
              <Shovel className="h-3.5 w-3.5 text-amber-600" /> Your soil
              <span className="ml-1 text-[10px] font-normal text-ink-3">
                (what satellites can’t see — you know it best)
              </span>
            </p>
            <div className="mb-3 grid grid-cols-5 gap-1">
              {textures.map((t) => (
                <button
                  key={t}
                  onClick={() => onSoil({ ...soil, texture: t })}
                  className={`rounded-lg border px-1 py-2 text-center transition-all ${
                    soil.texture === t
                      ? 'border-emerald-600 bg-emerald-soft'
                      : 'border-slate-100 bg-slate-50/50 hover:border-emerald-200'
                  }`}
                >
                  <span className="block text-[10px] font-bold text-ink">{SOIL_LABELS[t].name}</span>
                  <span className="mt-0.5 block text-[8px] leading-tight text-ink-3">
                    {SOIL_LABELS[t].hint}
                  </span>
                </button>
              ))}
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <div>
                <label htmlFor="om-range" className="text-[10px] font-bold text-ink-2">Organic matter</label>
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
                  <span className="data-tabular w-10 text-right text-[10px] font-bold text-ink">
                    {soil.omPercent.toFixed(1)}%
                  </span>
                </div>
              </div>
              <div>
                <label htmlFor="soil-drainage" className="text-[10px] font-bold text-ink-2">Drainage</label>
                <select
                  id="soil-drainage"
                  value={soil.drainage}
                  onChange={(e) => onSoil({ ...soil, drainage: e.target.value as SoilInfo['drainage'] })}
                  className="w-full rounded-lg border border-slate-100 bg-white px-2 py-1.5 text-[10px] text-ink"
                >
                  <option value="poor">Poor / waterlogs</option>
                  <option value="moderate">Moderate</option>
                  <option value="good">Good / free</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-ink-2">Irrigation</label>
                <button
                  onClick={() => onSoil({ ...soil, irrigated: !soil.irrigated })}
                  className={`flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-[10px] font-bold transition-all ${
                    soil.irrigated
                      ? 'border-cyan-500 bg-cyan-soft text-cyan-700'
                      : 'border-slate-100 bg-white/50 text-ink-3'
                  }`}
                >
                  <Droplets className="h-3 w-3" />
                  {soil.irrigated ? 'Irrigated' : 'Rainfed only'}
                </button>
              </div>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <label htmlFor="slope-range" className="text-[10px] font-bold text-ink-2">
                  Ground slope{' '}
                  <span className="text-[9px] text-ink-3">
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
                  <span className="data-tabular w-14 text-right text-[10px] font-bold text-ink">
                    {(terrain?.slopePercent ?? 3).toFixed(1)}%
                  </span>
                </div>
              </div>
              <div>
                <span className="text-[10px] font-bold text-ink-2">Slope class</span>
                <p className="rounded-lg border border-slate-100 bg-white px-2 py-1.5 text-[10px] text-ink">
                  {terrain?.slopeClass
                    ? terrain.slopeClass.charAt(0).toUpperCase() + terrain.slopeClass.slice(1)
                    : 'measuring…'}
                </p>
              </div>
            </div>
            <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-[10px] leading-snug text-ink-3">
              <span className="font-bold text-ink-2">Soil note:</span>{' '}
              {SOIL_PROFILES[soil.texture].infiltrationNote}
            </p>
          </div>
        </div>

        {/* Rotation builder */}
        <div className="rounded-xl border border-slate-100 bg-white p-3.5 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <p className="flex items-center gap-2 text-sm font-bold text-ink">
              <Sprout className="h-3.5 w-3.5 text-emerald-600" /> Current rotation
              <span className="text-[10px] font-normal text-ink-3">— what you grow, year by year</span>
            </p>
            {preset && (
              <button
                onClick={() => onRotation(preset.currentRotation)}
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-[9px] text-ink-3 hover:bg-emerald-soft hover:text-emerald-700 transition"
              >
                <RotateCcw className="h-2.5 w-2.5" /> reset
              </button>
            )}
          </div>
          <p className="mb-2 text-[9px] text-ink-3">
            Add or remove crops to match your real cycle (max 6 years).{preset && ` Typical for ${preset.name}: ${preset.blurb}`}
          </p>
          <div className="min-h-[72px] rounded-lg border border-dashed border-slate-200 bg-slate-50 p-2">
            <div className="flex flex-wrap gap-1.5">
              {rotation.map((id, i) => {
                const c = cropById(id)
                if (!c) return null
                return (
                  <div
                    key={`${id}-${i}`}
                    className="group relative flex items-center gap-1 rounded-lg border border-slate-100 bg-white px-2 py-1.5 shadow-sm"
                  >
                    <span className="data-tabular text-[8px] font-bold text-ink-3">Y{i + 1}</span>
                    <span className="text-xs font-bold text-ink">{c.name}</span>
                    <Chip tone={c.family === 'legume' ? 'amber' : c.family === 'grass' ? 'emerald' : c.family === 'brassica' ? 'rose' : 'neutral'}>
                      {c.season === 'perennial' ? 'ley' : c.season}
                    </Chip>
                    <button
                      onClick={() => onRotation(rotation.filter((_, j) => j !== i))}
                      className="rounded-full p-0.5 text-ink-3 opacity-60 transition hover:bg-rose-soft hover:text-rose-600 group-hover:opacity-100"
                      aria-label={`Remove ${c.name}`}
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </div>
                )
              })}
              {rotation.length === 0 && (
                <p className="px-2 py-2.5 text-xs text-ink-3">Empty — add crops below to build your rotation.</p>
              )}
            </div>
          </div>
          <div className="mt-2">
            <label htmlFor="add-crop" className="text-[9px] font-bold text-ink-2">Add a crop to the cycle</label>
            <select
              id="add-crop"
              value=""
              onChange={(e) => addCrop(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-100 bg-white px-2 py-1.5 text-[10px] text-ink"
            >
              <option value="">— choose a crop —</option>
              {addable.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {c.season} · {c.waterMm[0]}–{c.waterMm[1]} mm
                </option>
              ))}
            </select>
            <p className="mt-1 text-[9px] text-ink-3">
              {CROPS.length - 1} crops in the knowledge base (FAO/ARC typical values). Water ranges are seasonal
              crop water requirements.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
