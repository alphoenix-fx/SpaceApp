import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  Crosshair,
  Droplets,
  Loader2,
  MapPin,
  Navigation,
  Radar,
  Satellite,
  Search,
  Sprout,
  ThermometerSun,
  Trees,
} from 'lucide-react'
import { nearbyFarms, reverseGeocode, searchLocation, type NearbyFarm, type PlaceName } from '../lib/places'

// ---------------------------------------------------------------------------
// The Field Console: the app's front door. A full-bleed satellite map with
// the NASA layer switcher on top and a live reading of the pinned field on the
// right. Everything here is real data — GIBS imagery, Copernicus-derived
// terrain, OpenStreetMap farms — no decorative mock-ups.
// ---------------------------------------------------------------------------

const GIBS = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best'

export type ConsoleLayer = 'truecolor' | 'ndvi' | 'lst' | 'cropland'

const LAYERS: Array<{ id: ConsoleLayer; label: string; short: string; legend: string }> = [
  {
    id: 'truecolor',
    label: 'True colour',
    short: 'True colour',
    legend: 'MODIS Terra true colour — the field as the satellite saw it that day.',
  },
  {
    id: 'ndvi',
    label: 'Crop vigour',
    short: 'NDVI',
    legend: 'MODIS Terra NDVI (8-day, 250 m). Green = vigorous canopy, tan = bare soil or stress.',
  },
  {
    id: 'lst',
    label: 'Ground heat',
    short: 'Heat',
    legend: 'MODIS Terra land-surface temperature. Red/white = hot ground, blue = cool.',
  },
  {
    id: 'cropland',
    label: 'Cropland extent',
    short: 'Cropland',
    legend: 'NASA GFSAD cropland extent — where the satellite sees cultivated land.',
  },
]

const LAYER_URLS: Record<ConsoleLayer, { url: string; maxNative: number; opacity: number }> = {
  truecolor: {
    url: `${GIBS}/MODIS_Terra_CorrectedReflectance_TrueColor/default/{date}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpeg`,
    maxNative: 9,
    opacity: 0.98,
  },
  ndvi: {
    url: `${GIBS}/MODIS_Terra_NDVI_8Day/default/{date}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.png`,
    maxNative: 9,
    opacity: 0.85,
  },
  lst: {
    url: `${GIBS}/MODIS_Terra_Land_Surface_Temp_Day/default/{date}/GoogleMapsCompatible_Level7/{z}/{y}/{x}.png`,
    maxNative: 7,
    opacity: 0.8,
  },
  cropland: {
    url: `${GIBS}/Agricultural_Lands_Croplands_2000/default/GoogleMapsCompatible_Level7/{z}/{y}/{x}.png`,
    maxNative: 7,
    opacity: 0.8,
  },
}

interface Props {
  lat: number
  lon: number
  layer: ConsoleLayer
  mapDate: string
  onPick: (lat: number, lon: number) => void
  onLayer: (l: ConsoleLayer) => void
  onMapDate: (d: string) => void
  /** crops the farmer is growing, shown as a strip under the readout */
  rotation: string[]
  cropLabel: (id: string) => string
  /** live numbers for the pinned field, filled in by the parent */
  readout?: {
    temperature: number | null
    rainMm: number | null
    soilMoisture: number | null
    hotDays: number | null
    loading: boolean
  }
  /** the crop the verdict is about */
  headlineCrop: string
  headline: string
}

export default function FieldConsole({
  lat,
  lon,
  layer,
  mapDate,
  onPick,
  onLayer,
  onMapDate,
  rotation,
  cropLabel,
  readout,
  headlineCrop,
  headline,
}: Props) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const marker = useRef<L.Marker | null>(null)
  const overlay = useRef<L.TileLayer | null>(null)
  const farmLayer = useRef<L.LayerGroup | null>(null)

  const [place, setPlace] = useState<PlaceName | null>(null)
  const [farms, setFarms] = useState<NearbyFarm[]>([])
  const [farmState, setFarmState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [cursor, setCursor] = useState<{ lat: number; lon: number } | null>(null)
  const [showFarms, setShowFarms] = useState(false)

  const date = useMemo(() => mapDate || new Date().toISOString().slice(0, 10), [mapDate])

  // ---- map bootstrap -------------------------------------------------------
  useEffect(() => {
    if (!el.current || map.current) return
    const m = L.map(el.current, {
      center: [lat, lon],
      zoom: 8,
      zoomControl: true,
      attributionControl: true,
    })
    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        attribution:
          'Imagery © Esri, Maxar | NASA GIBS overlays | Terrain: Copernicus DEM | Farm data: OpenStreetMap',
        maxZoom: 17,
      },
    ).addTo(m)
    farmLayer.current = L.layerGroup().addTo(m)
    map.current = m
    m.on('click', (e: L.LeafletMouseEvent) => {
      onPick(+e.latlng.lat.toFixed(4), +e.latlng.lng.toFixed(4))
    })
    m.on('mousemove', (e: L.LeafletMouseEvent) => {
      setCursor({ lat: +e.latlng.lat.toFixed(4), lon: +e.latlng.lng.toFixed(4) })
    })
    return () => {
      m.remove()
      map.current = null
      marker.current = null
      overlay.current = null
      farmLayer.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---- marker -------------------------------------------------------------
  useEffect(() => {
    const m = map.current
    if (!m) return
    const pos: L.LatLngExpression = [lat, lon]
    if (!marker.current) {
      marker.current = L.marker(pos, {
        draggable: true,
        icon: L.divIcon({
          className: '',
          html: `<div style="position:relative"><div style="position:absolute;inset:-11px;border-radius:50%;background:rgba(47,125,70,.28);animation:ping-soft 1.6s ease-out infinite"></div>
            <div style="width:20px;height:20px;border-radius:50%;background:var(--color-leaf);border:3px solid #fff;box-shadow:0 1px 8px rgba(0,0,0,.45)"></div></div>`,
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        }),
      }).addTo(m)
      marker.current.on('dragend', () => {
        const p = marker.current!.getLatLng()
        onPick(+p.lat.toFixed(4), +p.lng.toFixed(4))
      })
    } else {
      marker.current.setLatLng(pos)
    }
  }, [lat, lon, onPick])

  // ---- NASA overlay -------------------------------------------------------
  useEffect(() => {
    const m = map.current
    if (!m) return
    if (overlay.current) {
      m.removeLayer(overlay.current)
      overlay.current = null
    }
    const cfg = LAYER_URLS[layer]
    const lyr = L.tileLayer(cfg.url.replace('{date}', date), {
      opacity: cfg.opacity,
      maxNativeZoom: cfg.maxNative,
      maxZoom: 17,
      className: 'gibs-tiles',
    })
    lyr.addTo(m)
    overlay.current = lyr
  }, [layer, date])

  // ---- place name ---------------------------------------------------------
  useEffect(() => {
    const controller = new AbortController()
    reverseGeocode(lat, lon, controller.signal)
      .then((p) => {
        if (!controller.signal.aborted) setPlace(p)
      })
      .catch(() => {
        /* offline: fall back to the coordinates */
      })
    return () => controller.abort()
  }, [lat, lon])

  // ---- nearby farms -------------------------------------------------------
  useEffect(() => {
    if (!showFarms) {
      setFarms([])
      setFarmState('idle')
      return
    }
    const controller = new AbortController()
    setFarmState('loading')
    nearbyFarms(lat, lon, 15000, controller.signal)
      .then((list) => {
        if (controller.signal.aborted) return
        setFarms(list)
        setFarmState('done')
      })
      .catch(() => {
        if (!controller.signal.aborted) setFarmState('error')
      })
    return () => controller.abort()
  }, [showFarms, lat, lon])

  // draw farm pins
  useEffect(() => {
    const group = farmLayer.current
    if (!group) return
    group.clearLayers()
    for (const f of farms) {
      L.circleMarker([f.lat, f.lon], {
        radius: 5,
        color: f.kind === 'farm' ? '#c98a2d' : '#8cc49a',
        weight: 2,
        fillColor: f.kind === 'farm' ? '#c98a2d' : '#8cc49a',
        fillOpacity: 0.75,
      })
        .bindPopup(`<strong>${f.name}</strong>${f.crop ? `<br/>${f.crop}` : ''}`)
        .addTo(group)
    }
  }, [farms])

  // ---- search -------------------------------------------------------------
  const runSearch = async () => {
    const q = query.trim()
    if (!q) return
    setSearching(true)
    setSearchError(null)
    try {
      const hit = await searchLocation(q)
      if (!hit) {
        setSearchError(`Nothing found for "${q}". Try a town, a farm name, or "lat, lon".`)
        return
      }
      onPick(hit.lat, hit.lon)
      map.current?.flyTo([hit.lat, hit.lon], 11, { duration: 1.4 })
      setQuery('')
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Location search failed.')
    } finally {
      setSearching(false)
    }
  }

  const active = LAYERS.find((l) => l.id === layer)!

  return (
    <section id="console" className="relative bg-panel text-panel-text">
      {/* header */}
      <div className="border-b border-panel-line">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-leaf/20">
                <Satellite className="h-4.5 w-4.5 text-leaf-3" />
              </span>
              <div className="min-w-0">
                <h2 className="font-display text-xl font-semibold leading-tight text-panel-text">
                  {headline}
                </h2>
                <p className="truncate text-[12px] text-panel-text/60">
                  {place?.title ?? 'Locating your field…'}
                  {place?.region ? ` · ${place.region}` : ''}
                  {headlineCrop ? ` · ${headlineCrop}` : ''}
                </p>
              </div>
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              void runSearch()
            }}
            className="flex w-full max-w-md items-center gap-2"
          >
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-panel-text/40" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search a farm, town or lat, lon"
                aria-label="Search for a location"
                className="w-full rounded-full border border-panel-line bg-panel-2/70 py-2.5 pl-9 pr-3 text-sm text-panel-text placeholder:text-panel-text/40 focus:border-leaf focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={searching}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-leaf text-panel-text transition hover:bg-leaf-2 disabled:opacity-50"
              aria-label="Search"
            >
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Navigation className="h-4 w-4" />}
            </button>
          </form>
        </div>
        {searchError && (
          <p className="mx-auto max-w-7xl px-5 pb-3 text-[11px] text-clay">{searchError}</p>
        )}
      </div>

      {/* console body */}
      <div className="mx-auto grid max-w-7xl gap-0 px-0 lg:grid-cols-[1fr_340px] lg:px-5 lg:py-6">
        {/* map */}
        <div className="relative">
          <div
            ref={el}
            className="h-[52vh] min-h-[340px] w-full overflow-hidden lg:h-[calc(100vh-320px)] lg:rounded-l-2xl"
          />

          {/* layer switcher */}
          <div className="absolute left-3 top-3 z-[500] flex flex-col gap-1.5">
            {LAYERS.map((l) => (
              <button
                key={l.id}
                onClick={() => onLayer(l.id)}
                title={l.legend}
                aria-pressed={layer === l.id}
                className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-medium shadow-card backdrop-blur transition ${
                  layer === l.id
                    ? 'border-leaf bg-leaf text-white'
                    : 'border-panel-line bg-panel/80 text-panel-text/80 hover:bg-panel'
                }`}
              >
                {l.id === 'ndvi' ? (
                  <Trees className="h-3.5 w-3.5" />
                ) : l.id === 'lst' ? (
                  <ThermometerSun className="h-3.5 w-3.5" />
                ) : l.id === 'cropland' ? (
                  <Radar className="h-3.5 w-3.5" />
                ) : (
                  <Satellite className="h-3.5 w-3.5" />
                )}
                {l.short}
              </button>
            ))}
            {layer !== 'cropland' && (
              <label className="flex items-center gap-1.5 rounded-full border border-panel-line bg-panel/80 px-3 py-1.5 text-[11px] text-panel-text/70 backdrop-blur">
                <span className="sr-only">Imagery date</span>
                <input
                  type="date"
                  value={date}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => onMapDate(e.target.value)}
                  className="data-tabular w-[104px] bg-transparent text-[11px] text-panel-text outline-none"
                />
              </label>
            )}
          </div>

          {/* nearby farms toggle */}
          <div className="absolute bottom-3 left-3 z-[500] flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowFarms((v) => !v)}
              aria-pressed={showFarms}
              className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-medium shadow-card backdrop-blur transition ${
                showFarms
                  ? 'border-ochre bg-ochre text-panel-text'
                  : 'border-panel-line bg-panel/80 text-panel-text/80 hover:bg-panel'
              }`}
            >
              <Crosshair className="h-3.5 w-3.5" />
              Nearby farms
            </button>
            {farmState === 'loading' && (
              <span className="flex items-center gap-1.5 rounded-full bg-panel/80 px-3 py-1.5 text-[11px] text-panel-text/70 backdrop-blur">
                <Loader2 className="h-3 w-3 animate-spin" /> scanning OpenStreetMap
              </span>
            )}
            {farmState === 'done' && (
              <span className="rounded-full bg-panel/80 px-3 py-1.5 text-[11px] text-panel-text/70 backdrop-blur">
                {farms.length} farms &amp; plots nearby
              </span>
            )}
            {farmState === 'error' && (
              <span className="rounded-full bg-panel/80 px-3 py-1.5 text-[11px] text-panel-text/60 backdrop-blur">
                farm lookup unavailable
              </span>
            )}
          </div>

          {/* cursor readout */}
          <div className="pointer-events-none absolute bottom-3 right-3 z-[500] rounded-lg bg-panel/80 px-2.5 py-1.5 text-[10px] text-panel-text/70 backdrop-blur">
            <span className="data-tabular">{cursor ? `${cursor.lat.toFixed(3)}, ${cursor.lon.toFixed(3)}` : '—'}</span>
          </div>

          {/* legend */}
          <div className="pointer-events-none absolute right-3 top-3 z-[500] max-w-[220px] rounded-xl border border-panel-line bg-panel/85 px-3 py-2 text-panel-text backdrop-blur">
            <p className="text-[10px] font-semibold tracking-wide">{active.label}</p>
            <p className="mt-0.5 text-[10px] leading-snug text-panel-text/70">{active.legend}</p>
          </div>
        </div>

        {/* live readout */}
        <aside className="border-panel-line bg-panel-2/60 px-5 py-5 lg:rounded-r-2xl lg:border-l">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-panel-text/50">
            Live field readout
          </p>

          <div className="mt-3 space-y-2.5">
            <ReadoutRow
              icon={<Droplets className="h-3.5 w-3.5" />}
              label="Root-zone moisture"
              value={readout?.soilMoisture != null ? `${Math.round(readout.soilMoisture * 100)}%` : '—'}
              loading={readout?.loading}
            />
            <ReadoutRow
              icon={<ThermometerSun className="h-3.5 w-3.5" />}
              label="Recent temperature"
              value={readout?.temperature != null ? `${readout.temperature.toFixed(1)} °C` : '—'}
              loading={readout?.loading}
            />
            <ReadoutRow
              icon={<Sprout className="h-3.5 w-3.5" />}
              label="Rain, last 7 days"
              value={readout?.rainMm != null ? `${readout.rainMm} mm` : '—'}
              loading={readout?.loading}
            />
            <ReadoutRow
              icon={<Satellite className="h-3.5 w-3.5" />}
              label="Days over 32 °C / yr"
              value={readout?.hotDays != null ? `${readout.hotDays}` : '—'}
              loading={readout?.loading}
            />
          </div>

          <div className="mt-5 rounded-xl border border-panel-line bg-panel/50 p-3">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-panel-text/50">
              <MapPin className="h-3 w-3" /> Your cycle
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {rotation.length ? (
                rotation.map((id, i) => (
                  <span
                    key={`${id}-${i}`}
                    className="rounded-lg border border-panel-line bg-panel/70 px-2 py-1 text-[11px] text-panel-text/80"
                  >
                    <span className="data-tabular mr-1 text-[9px] text-panel-text/40">Y{i + 1}</span>
                    {cropLabel(id)}
                  </span>
                ))
              ) : (
                <span className="text-[11px] text-panel-text/50">No crops added yet</span>
              )}
            </div>
          </div>

          <p className="mt-4 text-[11px] leading-snug text-panel-text/45">
            Click the map or drag the pin to move your field. Impassing right now — everything below is
            measured at the coordinates you choose.
          </p>
        </aside>
      </div>
    </section>
  )
}

function ReadoutRow({
  icon,
  label,
  value,
  loading,
}: {
  icon: ReactNode
  label: string
  value: string
  loading?: boolean
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-panel-line bg-panel/40 px-3 py-2">
      <span className="text-leaf-3">{icon}</span>
      <span className="flex-1 text-[12px] text-panel-text/70">{label}</span>
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin text-panel-text/40" />
      ) : (
        <span className="data-tabular text-[13px] font-semibold text-panel-text">{value}</span>
      )}
    </div>
  )
}
