import { useEffect, useMemo, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { FarmPreset } from '../lib/types'

// ---------------------------------------------------------------------------
// Interactive satellite map: Esri imagery base + NASA GIBS overlays
// (MODIS Terra true colour, NDVI 8-day crop health, land-surface temperature).
// GIBS serves WMTS tiles keylessly & CORS-open in EPSG:3857.
// ---------------------------------------------------------------------------

const GIBS = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best'

export type LayerKind = 'ndvi' | 'lst' | 'truecolor' | 'none'

interface Props {
  lat: number
  lon: number
  onPick: (lat: number, lon: number) => void
  activePreset?: FarmPreset | null
  layer: LayerKind
  date: string // YYYY-MM-DD
}

export default function FarmMap({ lat, lon, onPick, activePreset, layer, date }: Props) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const marker = useRef<L.Marker | null>(null)
  const overlay = useRef<L.TileLayer | null>(null)

  // init map once
  useEffect(() => {
    if (!el.current || map.current) return
    const m = L.map(el.current, {
      center: [-29.4, 25.2],
      zoom: 5,
      attributionControl: true,
    })
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Imagery © Esri, Maxar | Overlays: NASA GIBS (MODIS) | Terrain: Copernicus DEM via Open-Meteo',
      maxZoom: 17,
    }).addTo(m)
    map.current = m
    m.on('click', (e: L.LeafletMouseEvent) => onPick(+e.latlng.lat.toFixed(4), +e.latlng.lng.toFixed(4)))
    return () => {
      m.remove()
      map.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // marker follows state
  useEffect(() => {
    const m = map.current
    if (!m) return
    const pos: L.LatLngExpression = [lat, lon]
    if (!marker.current) {
      const icon = L.divIcon({
        className: '',
        html: `<div style="position:relative"><div style="position:absolute;inset:-9px;border-radius:50%;background:rgba(47,125,70,.25);animation:ping-soft 1.6s ease-out infinite"></div>
          <div style="width:18px;height:18px;border-radius:50%;background:var(--color-leaf);border:3px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,.4)"></div></div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      })
      marker.current = L.marker(pos, { draggable: true, icon }).addTo(m)
      marker.current.on('dragend', () => {
        const p = marker.current!.getLatLng()
        onPick(+p.lat.toFixed(4), +p.lng.toFixed(4))
      })
    } else {
      marker.current.setLatLng(pos)
    }
  }, [lat, lon, onPick])

  // fly to preset
  useEffect(() => {
    const m = map.current
    if (m && activePreset) {
      m.flyTo([activePreset.lat, activePreset.lon], 10, { duration: 1.2 })
    }
  }, [activePreset])

  // overlay layer switching
  useEffect(() => {
    const m = map.current
    if (!m) return
    if (overlay.current) {
      m.removeLayer(overlay.current)
      overlay.current = null
    }
    if (layer === 'none') return

    let url: string
    let maxNative = 9
    switch (layer) {
      case 'ndvi':
        url = `${GIBS}/MODIS_Terra_NDVI_8Day/default/${date}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.png`
        maxNative = 9
        break
      case 'lst':
        url = `${GIBS}/MODIS_Terra_Land_Surface_Temp_Day/default/${date}/GoogleMapsCompatible_Level7/{z}/{y}/{x}.png`
        maxNative = 7
        break
      case 'truecolor':
        url = `${GIBS}/MODIS_Terra_CorrectedReflectance_TrueColor/default/${date}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpeg`
        maxNative = 9
        break
    }
    const lyr = L.tileLayer(url, {
      opacity: layer === 'truecolor' ? 0.99 : 0.8,
      maxNativeZoom: maxNative,
      maxZoom: 17,
      className: 'gibs-tiles',
    })
    lyr.addTo(m)
    overlay.current = lyr
  }, [layer, date])

  const legend = useMemo(() => {
    switch (layer) {
      case 'ndvi':
        return { title: 'MODIS NDVI — crop vigour (8-day)', body: 'Green = healthy vegetation; tan/pink = bare soil or stress.' }
      case 'lst':
        return { title: 'Land surface temperature (day)', body: 'Red/white = hot ground; blue = cool. Reveals heat and stress hotspots.' }
      case 'truecolor':
        return { title: 'MODIS true colour (daily)', body: 'The field as the satellite saw it that day.' }
      default:
        return null
    }
  }, [layer])

  return (
    <div className="relative h-[420px] overflow-hidden rounded-2xl border border-paper-3 shadow-card sm:h-[460px]">
      <div ref={el} className="h-full w-full" />
      {legend && (
        <div className="pointer-events-none absolute right-2 bottom-2 z-[500] max-w-[240px] rounded-xl border border-panel-line bg-panel/85 px-3 py-2 text-panel-text backdrop-blur">
          <p className="text-[10px] font-semibold tracking-wide">{legend.title}</p>
          <p className="mt-0.5 text-[10px] leading-snug text-panel-text/80">{legend.body}</p>
        </div>
      )}
    </div>
  )
}
