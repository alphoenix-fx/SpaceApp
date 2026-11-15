import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  Crosshair,
  Loader2,
  Radar,
  Satellite,
  Trees,
  ThermometerSun,
} from 'lucide-react'
import { nearbyFarms, type NearbyFarm } from '../lib/places'

// ---------------------------------------------------------------------------
// The Field Console map — full-bleed satellite map for the left panel.
// Floating translucent controls: layer switcher, nearby-farm scanner, cursor
// readout. Everything here is real data — GIBS imagery, Copernicus-derived
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
}

export default function FieldConsole({
  lat,
  lon,
  layer,
  mapDate,
  onPick,
  onLayer,
  onMapDate,
}: Props) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const marker = useRef<L.Marker | null>(null)
  const overlay = useRef<L.TileLayer | null>(null)
  const farmLayer = useRef<L.LayerGroup | null>(null)

  const [farms, setFarms] = useState<NearbyFarm[]>([])
  const [farmState, setFarmState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
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
          html: `<div style="position:relative"><div style="position:absolute;inset:-11px;border-radius:50%;background:rgba(29,128,61,.28);animation:ping-soft 1.6s ease-out infinite"></div>
            <div style="width:20px;height:20px;border-radius:50%;background:var(--color-emerald-600);border:3px solid #fff;box-shadow:0 1px 8px rgba(0,0,0,.45)"></div></div>`,
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
        color: f.kind === 'farm' ? '#d97706' : '#10b981',
        weight: 2,
        fillColor: f.kind === 'farm' ? '#d97706' : '#10b981',
        fillOpacity: 0.75,
      })
        .bindPopup(`<strong>${f.name}</strong>${f.crop ? `<br/>${f.crop}` : ''}`)
        .addTo(group)
    }
  }, [farms])

  const active = LAYERS.find((l) => l.id === layer)!

  return (
    <section id="console" className="relative h-full w-full bg-slate-900 text-slate-200">
      {/* map */}
      <div ref={el} className="h-full w-full overflow-hidden" />

      {/* layer switcher */}
      <div className="absolute left-4 top-4 z-[500] flex flex-col gap-1.5">
        {LAYERS.map((l) => (
          <button
            key={l.id}
            onClick={() => onLayer(l.id)}
            title={l.legend}
            aria-pressed={layer === l.id}
            className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-semibold shadow-card backdrop-blur transition ${
              layer === l.id
                ? 'border-emerald-500 bg-emerald-500 text-white'
                : 'border-slate-700 bg-slate-800/80 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {l.id === 'ndvi' ? (
              <Trees className="h-3 w-3" />
            ) : l.id === 'lst' ? (
              <ThermometerSun className="h-3 w-3" />
            ) : l.id === 'cropland' ? (
              <Radar className="h-3 w-3" />
            ) : (
              <Satellite className="h-3 w-3" />
            )}
            {l.short}
          </button>
        ))}
        {layer !== 'cropland' && (
          <label className="flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-[10px] text-slate-400 backdrop-blur">
            <span className="sr-only">Imagery date</span>
            <input
              type="date"
              value={date}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => onMapDate(e.target.value)}
              className="data-tabular bg-transparent text-[10px] text-slate-300 outline-none"
            />
          </label>
        )}
      </div>

      {/* nearby farms toggle */}
      <div className="absolute left-4 bottom-4 z-[500] flex flex-wrap items-center gap-2">
        <button
          onClick={() => setShowFarms((v) => !v)}
          aria-pressed={showFarms}
          className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-semibold shadow-card backdrop-blur transition ${
            showFarms
              ? 'border-amber-500 bg-amber-500 text-white'
              : 'border-slate-700 bg-slate-800/80 text-slate-300 hover:bg-slate-700'
          }`}
        >
          <Crosshair className="h-3 w-3" />
          Nearby farms
        </button>
        {farmState === 'loading' && (
          <span className="flex items-center gap-1.5 rounded-full bg-slate-800/80 px-3 py-1.5 text-[10px] text-slate-400 backdrop-blur">
            <Loader2 className="h-2.5 w-2.5 animate-spin" /> scanning OpenStreetMap
          </span>
        )}
        {farmState === 'done' && (
          <span className="rounded-full bg-slate-800/80 px-3 py-1.5 text-[10px] text-slate-400 backdrop-blur">
            {farms.length} farms &amp; plots nearby
          </span>
        )}
        {farmState === 'error' && (
          <span className="rounded-full bg-slate-800/80 px-3 py-1.5 text-[10px] text-slate-500 backdrop-blur">
            farm lookup unavailable
          </span>
        )}
      </div>

      {/* cursor readout */}
      <div className="pointer-events-none absolute bottom-4 right-4 z-[500] rounded-lg bg-slate-800/80 px-2.5 py-1.5 text-[10px] text-slate-400 backdrop-blur">
        <span className="data-tabular">{cursor ? `${cursor.lat.toFixed(3)}, ${cursor.lon.toFixed(3)}` : '—'}</span>
      </div>

      {/* legend */}
      <div className="pointer-events-none absolute top-4 right-4 z-[500] max-w-[220px] rounded-xl border border-slate-700 bg-slate-800/90 px-3 py-2 text-slate-300 backdrop-blur">
        <p className="text-[9px] font-semibold uppercase tracking-wider">{active.label}</p>
        <p className="mt-0.5 text-[9px] leading-snug text-slate-400">{active.legend}</p>
      </div>
    </section>
  )
}
