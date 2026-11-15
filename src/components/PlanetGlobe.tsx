import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, MousePointerClick, Pause, Play } from 'lucide-react'
import type { PlanetarySite } from '../data/planetaryData'
import {
  buildEquirectTexture,
  PLANET_TEXTURES,
  type PlanetTextureSource,
} from '../lib/planetTextures'

// ---------------------------------------------------------------------------
// A real 3D planet globe, drawn from NASA Trek's global mosaics.
//
// The globe is an orthographic projection sampled per pixel from an
// equirectangular texture stitched out of the Trek tile pyramid, so it is a
// genuine rotating sphere rather than a flat map in a circle. Sites are
// projected onto the sphere, and the vertical-farming layer paints the flat
// (< 5° slope) plains that a greenhouse could stand on.
// ---------------------------------------------------------------------------

const BUFFER = 520 // internal resolution of the pixel loop
const DEG = Math.PI / 180

interface Props {
  planet: 'mars' | 'moon'
  sites: PlanetarySite[]
  selectedSiteId: string
  onSelectSite: (site: PlanetarySite) => void
  verticalFarming: boolean
  /** flat-zone radius in km, per site id */
  flatZoneKm?: Record<string, number>
  /** measured slope in degrees, per site id */
  slopeDeg?: Record<string, number>
}

interface View {
  lon: number
  lat: number
}

export default function PlanetGlobe({
  planet,
  sites,
  selectedSiteId,
  onSelectSite,
  verticalFarming,
  flatZoneKm = {},
  slopeDeg = {},
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const bufferRef = useRef<HTMLCanvasElement | null>(null)
  const texRef = useRef<HTMLCanvasElement | null>(null)
  const texDataRef = useRef<Uint8ClampedArray | null>(null)

  const viewRef = useRef<View>({ lon: 0, lat: 0 })
  const targetRef = useRef<View>({ lon: 0, lat: 0 })
  const dragRef = useRef<{ x: number; y: number; lon: number; lat: number; moved: boolean } | null>(null)
  const spinRef = useRef(true)
  const dirtyRef = useRef(true)
  const sizeRef = useRef(600)

  const [loading, setLoading] = useState(true)
  const [progress, setProgress] = useState({ loaded: 0, total: 0 })
  const [spinning, setSpinning] = useState(true)
  const [textureReady, setTextureReady] = useState(false)

  // ---- texture ------------------------------------------------------------
  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    setLoading(true)
    setTextureReady(false)
    setProgress({ loaded: 0, total: 0 })
    texRef.current = null
    texDataRef.current = null

    const source: PlanetTextureSource = PLANET_TEXTURES[planet]
    // Mobile keeps the lighter pyramid; desktop refines it.
    const isSmall = typeof window !== 'undefined' && window.innerWidth < 768
    const zoom = isSmall ? 2 : 3

    void buildEquirectTexture(
      source,
      zoom,
      (loaded, total) => {
        if (!cancelled) setProgress({ loaded, total })
      },
      controller.signal,
    ).then((canvas) => {
      if (cancelled || !canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      texRef.current = canvas
      texDataRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height).data
      setTextureReady(true)
      setLoading(false)
      dirtyRef.current = true
    })

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [planet])

  // ---- sizing -------------------------------------------------------------
  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const observer = new ResizeObserver(() => {
      const rect = wrap.getBoundingClientRect()
      const size = Math.max(240, Math.min(rect.width, rect.height || rect.width))
      sizeRef.current = size
      const canvas = canvasRef.current
      if (canvas) {
        const dpr = Math.min(2, window.devicePixelRatio || 1)
        canvas.width = Math.round(size * dpr)
        canvas.height = Math.round(size * dpr)
        canvas.style.width = `${size}px`
        canvas.style.height = `${size}px`
      }
      dirtyRef.current = true
    })
    observer.observe(wrap)
    return () => observer.disconnect()
  }, [])

  // ---- centre on the selected site ---------------------------------------
  useEffect(() => {
    const site = sites.find((s) => s.id === selectedSiteId) ?? sites[0]
    if (!site) return
    targetRef.current = { lon: site.lon, lat: site.lat }
    dirtyRef.current = true
  }, [selectedSiteId, sites])

  // ---- projection helpers -------------------------------------------------
  const project = useCallback((latDeg: number, lonDeg: number) => {
    const size = sizeRef.current
    const R = size * 0.4
    const cx = size / 2
    const cy = size / 2
    const { lon: lon0, lat: lat0 } = viewRef.current
    const phi = latDeg * DEG
    const lam = lonDeg * DEG
    const l0 = lon0 * DEG
    const p0 = lat0 * DEG
    const A = Math.cos(phi) * Math.cos(lam - l0)
    const B = Math.sin(phi)
    const x2 = A * Math.sin(p0) - B * Math.cos(p0)
    const y2 = Math.cos(phi) * Math.sin(lam - l0)
    const z2 = A * Math.cos(p0) + B * Math.sin(p0)
    return { x: cx + R * x2, y: cy - R * y2, z: z2, visible: z2 > 0 }
  }, [])

  // ---- render loop --------------------------------------------------------
  useEffect(() => {
    let raf = 0
    let last = performance.now()

    const paint = () => {
      const canvas = canvasRef.current
      const wrap = wrapRef.current
      if (!canvas || !wrap) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const size = sizeRef.current
      const R = size * 0.4
      const cx = size / 2
      const cy = size / 2
      const { lon: lon0, lat: lat0 } = viewRef.current
      const p0 = lat0 * DEG
      const sinP0 = Math.sin(p0)
      const cosP0 = Math.cos(p0)

      // --- globe pixels -----------------------------------------------------
      const buffer = bufferRef.current ?? document.createElement('canvas')
      if (buffer.width !== BUFFER) buffer.width = BUFFER
      if (buffer.height !== BUFFER) buffer.height = BUFFER
      bufferRef.current = buffer
      const bctx = buffer.getContext('2d')
      if (!bctx) return

      const img = bctx.createImageData(BUFFER, BUFFER)
      const d = img.data
      const tex = texRef.current
      const texData = texDataRef.current
      const tw = tex ? tex.width : 0
      const th = tex ? tex.height : 0
      const hasTex = !!tex && !!texData

      // directional light in view space
      const Lx = 0.55
      const Ly = 0.35
      const Lz = 0.76

      const baseR = planet === 'mars' ? 154 : 138
      const baseG = planet === 'mars' ? 82 : 136
      const baseB = planet === 'mars' ? 54 : 134

      for (let py = 0; py < BUFFER; py++) {
        const ny = (BUFFER / 2 - py) / (BUFFER * 0.4)
        for (let px = 0; px < BUFFER; px++) {
          const nx = (px - BUFFER / 2) / (BUFFER * 0.4)
          const r2 = nx * nx + ny * ny
          const i = (py * BUFFER + px) * 4
          if (r2 > 1) {
            d[i + 3] = 0
            continue
          }
          const pz = Math.sqrt(1 - r2)
          const A = nx * sinP0 + pz * cosP0
          const B = -nx * cosP0 + pz * sinP0
          const sinPhi = Math.max(-1, Math.min(1, B))
          const lat = Math.asin(sinPhi) / DEG
          const dLon = Math.atan2(-ny, A)
          let lon = lon0 + dLon / DEG
          lon = ((((lon + 180) % 360) + 360) % 360) - 180

          let r: number
          let g: number
          let b: number
          if (hasTex) {
            const u = ((lon + 180) / 360) * tw
            const v = ((90 - lat) / 180) * th
            const tx = Math.min(tw - 1, Math.max(0, Math.floor(u)))
            const ty = Math.min(th - 1, Math.max(0, Math.floor(v)))
            const ti = (ty * tw + tx) * 4
            r = texData![ti]
            g = texData![ti + 1]
            b = texData![ti + 2]
          } else {
            // procedural fallback: banded body with polar caps
            const band = Math.cos(lat * 4 * DEG) * 0.12 + Math.cos(lat * 2 * DEG) * 0.08
            const cap = Math.abs(lat) > 62 ? 0.5 : 0
            r = Math.min(255, baseR * (1 + band) + cap * 70)
            g = Math.min(255, baseG * (1 + band) + cap * 70)
            b = Math.min(255, baseB * (1 + band) + cap * 70)
          }

          const light = Math.max(0, nx * Lx + -ny * Ly + pz * Lz)
          const shade = 0.34 + 0.72 * light
          d[i] = r * shade
          d[i + 1] = g * shade
          d[i + 2] = b * shade
          d[i + 3] = 255
        }
      }
      bctx.putImageData(img, 0, 0)

      const scale = canvas.width / size
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.save()
      ctx.scale(scale, scale)

      // atmosphere glow
      const glow = ctx.createRadialGradient(cx, cy, R * 0.97, cx, cy, R * 1.16)
      glow.addColorStop(0, 'rgba(56,189,248,0.28)')
      glow.addColorStop(1, 'rgba(56,189,248,0)')
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.arc(cx, cy, R * 1.16, 0, Math.PI * 2)
      ctx.fill()

      // the planet itself
      ctx.drawImage(buffer, cx - R, cy - R, R * 2, R * 2)

      // graticule
      ctx.strokeStyle = 'rgba(255,255,255,0.13)'
      ctx.lineWidth = 1
      for (let lat = -60; lat <= 60; lat += 30) {
        ctx.beginPath()
        let started = false
        for (let lon = -180; lon <= 180; lon += 3) {
          const p = project(lat, lon)
          if (!p.visible) {
            started = false
            continue
          }
          if (!started) {
            ctx.moveTo(p.x, p.y)
            started = true
          } else ctx.lineTo(p.x, p.y)
        }
        ctx.stroke()
      }

      // vertical-farming flat zones
      if (verticalFarming) {
        for (const site of sites) {
          const slope = slopeDeg[site.id]
          if (slope === undefined || slope >= 5) continue
          const radiusKm = flatZoneKm[site.id] ?? 400
          const dLat = radiusKm / 111.32
          const dLon = radiusKm / Math.max(12, 111.32 * Math.cos(site.lat * DEG))
          const pts: Array<{ x: number; y: number }> = []
          let allVisible = true
          for (let i = 0; i <= 72; i++) {
            const a = (i / 72) * Math.PI * 2
            const plat = site.lat + Math.sin(a) * dLat
            const plon = site.lon + Math.cos(a) * dLon
            const p = project(plat, plon)
            if (!p.visible) allVisible = false
            pts.push({ x: p.x, y: p.y })
          }
          if (!allVisible) continue
          ctx.beginPath()
          ctx.moveTo(pts[0].x, pts[0].y)
          for (const p of pts.slice(1)) ctx.lineTo(p.x, p.y)
          ctx.closePath()
          ctx.fillStyle = 'rgba(16,185,129,0.35)'
          ctx.fill()
          ctx.strokeStyle = 'rgba(16,185,129,0.95)'
          ctx.lineWidth = 2
          ctx.shadowColor = 'rgba(16,185,129,0.85)'
          ctx.shadowBlur = 14
          ctx.stroke()
          ctx.shadowBlur = 0
        }
      }

      // site markers
      for (const site of sites) {
        const p = project(site.lat, site.lon)
        if (!p.visible) continue
        const selected = site.id === selectedSiteId
        const flat = (slopeDeg[site.id] ?? 99) < 5
        const color = flat ? '#10b981' : '#f59e0b'

        if (selected) {
          ctx.beginPath()
          ctx.arc(p.x, p.y, 16, 0, Math.PI * 2)
          ctx.strokeStyle = 'rgba(16,185,129,0.55)'
          ctx.lineWidth = 1.5
          ctx.stroke()
        }
        ctx.beginPath()
        ctx.arc(p.x, p.y, selected ? 9 : 6, 0, Math.PI * 2)
        ctx.fillStyle = '#0f172a'
        ctx.fill()
        ctx.strokeStyle = color
        ctx.lineWidth = selected ? 3 : 2
        ctx.stroke()
        ctx.beginPath()
        ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2)
        ctx.fillStyle = '#ffffff'
        ctx.fill()

        const label = site.name.replace(/^Site [AB]: /, '')
        ctx.font = '600 11px "Poppins", system-ui, sans-serif'
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        const w = ctx.measureText(label).width
        const bx = p.x + 14
        const by = p.y - 11
        ctx.fillStyle = 'rgba(15,23,42,0.88)'
        ctx.beginPath()
        ctx.roundRect(bx, by, w + 14, 22, 6)
        ctx.fill()
        ctx.strokeStyle = selected ? color : 'rgba(148,163,184,0.4)'
        ctx.lineWidth = 1
        ctx.stroke()
        ctx.fillStyle = '#f8fafc'
        ctx.fillText(label, bx + 7, by + 11)
      }

      ctx.restore()
    }

    const loop = (now: number) => {
      const dt = Math.min(64, now - last)
      last = now
      const view = viewRef.current
      const target = targetRef.current

      // ease toward the target centre
      const dLon = ((target.lon - view.lon + 540) % 360) - 180
      if (Math.abs(dLon) > 0.05 || Math.abs(target.lat - view.lat) > 0.05) {
        view.lon += dLon * 0.12
        view.lat += (target.lat - view.lat) * 0.12
        dirtyRef.current = true
      } else if (spinRef.current) {
        view.lon += (dt / 1000) * 3.2
        dirtyRef.current = true
      }

      if (dirtyRef.current) {
        dirtyRef.current = false
        paint()
      }
      raf = requestAnimationFrame(loop)
    }

    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [planet, project, sites, selectedSiteId, verticalFarming, flatZoneKm, slopeDeg])

  // ---- interaction --------------------------------------------------------
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.setPointerCapture(e.pointerId)
    dragRef.current = {
      x: e.clientX,
      y: e.clientY,
      lon: viewRef.current.lon,
      lat: viewRef.current.lat,
      moved: false,
    }
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current
    if (!drag) return
    const dx = e.clientX - drag.x
    const dy = e.clientY - drag.y
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) drag.moved = true
    if (!drag.moved) return
    viewRef.current.lon = drag.lon - dx * 0.32
    viewRef.current.lat = Math.max(-85, Math.min(85, drag.lat + dy * 0.32))
    dirtyRef.current = true
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current
    dragRef.current = null
    if (!drag || drag.moved) return

    // treat it as a click — hit-test the site markers
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const px = e.clientX - rect.left
    const py = e.clientY - rect.top
    let best: PlanetarySite | null = null
    let bestDist = 22
    for (const site of sites) {
      const p = project(site.lat, site.lon)
      if (!p.visible) continue
      const d = Math.hypot(p.x - px, p.y - py)
      if (d < bestDist) {
        bestDist = d
        best = site
      }
    }
    if (best) onSelectSite(best)
  }

  const credit = PLANET_TEXTURES[planet].credit

  return (
    <div ref={wrapRef} className="relative w-full h-full flex items-center justify-center bg-slate-950">
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="touch-none cursor-grab active:cursor-grabbing"
        aria-label={`Interactive 3D ${planet} globe`}
      />

      {/* Spin control */}
      <button
        type="button"
        onClick={() => {
          spinRef.current = !spinRef.current
          setSpinning(spinRef.current)
          dirtyRef.current = true
        }}
        title={spinning ? 'Pause rotation' : 'Auto-rotate globe'}
        aria-label={spinning ? 'Pause rotation' : 'Auto-rotate globe'}
        className="absolute top-3 right-3 z-10 flex h-9 w-9 items-center justify-center rounded-xl bg-white/95 text-slate-800 shadow-md transition hover:bg-white cursor-pointer"
      >
        {spinning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
      </button>

      {/* Loading / attribution */}
      {loading && (
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex flex-col items-center gap-2 text-slate-300 pointer-events-none">
          <Loader2 className="w-5 h-5 animate-spin text-[#1DB954]" />
          <p className="data-tabular text-[11px]">
            Loading NASA {planet === 'mars' ? 'Mars' : 'Moon'} Trek mosaic…
          </p>
          {progress.total > 0 && (
            <p className="data-tabular text-[10px] text-slate-500">
              {progress.loaded}/{progress.total} tiles
            </p>
          )}
        </div>
      )}

      {!loading && (
        <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-3 pointer-events-none">
          <span className="flex items-center gap-1.5 rounded-full bg-slate-900/80 px-2.5 py-1 text-[9px] text-slate-400 backdrop-blur">
            <MousePointerClick className="w-3 h-3" />
            Drag to rotate · tap a site to select
          </span>
          <span className="rounded-full bg-slate-900/80 px-2.5 py-1 text-[9px] text-slate-400 backdrop-blur">
            {credit}
          </span>
        </div>
      )}

      {/* Imagery badge */}
      {textureReady && !loading && (
        <span className="absolute top-3 left-3 z-10 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/90 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-white shadow-md">
          NASA mosaic
        </span>
      )}
    </div>
  )
}
