// ---------------------------------------------------------------------------
// NASA Trek global mosaic textures for the 3D planet globes.
//
// The Trek "EQ" tile service follows the Google global discrete scheme: at
// zoom z the world is 2^(z+1) columns by 2^z rows of 256 px tiles, y = 0 is
// the north pole. We stitch those tiles into a single equirectangular canvas
// that the globe sampler can read back.
//
// The service sends `Access-Control-Allow-Origin: *`, so the canvas stays
// untainted and `getImageData` works.
// ---------------------------------------------------------------------------

export interface PlanetTextureSource {
  /** template with {z}/{y}/{x} placeholders */
  tileUrl: string
  credit: string
}

const TILE_SIZE = 256

export const PLANET_TEXTURES: Record<'mars' | 'moon', PlanetTextureSource> = {
  mars: {
    tileUrl:
      'https://trek.nasa.gov/tiles/Mars/EQ/Mars_Viking_MDIM21_ClrMosaic_global_232m/1.0.0/default/default028mm/{z}/{y}/{x}.jpg',
    credit: 'NASA Mars Trek · Viking MDIM 2.1 Color Global Mosaic (232 m/px)',
  },
  moon: {
    tileUrl:
      'https://trek.nasa.gov/tiles/Moon/EQ/LRO_WAC_Mosaic_Global_303ppd/1.0.0/default/default028mm/{z}/{y}/{x}.jpg',
    credit: 'NASA Moon Trek · LRO WAC Global Mosaic (303 ppd)',
  },
}

/** Columns / rows for a zoom level in the Trek global discrete scheme. */
export function gridForZoom(z: number): { cols: number; rows: number } {
  return { cols: 2 ** (z + 1), rows: 2 ** z }
}

function loadTile(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = url
  })
}

async function pool<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let cursor = 0
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const index = cursor++
      if (index >= items.length) return
      results[index] = await worker(items[index])
    }
  })
  await Promise.all(runners)
  return results
}

/**
 * Stitch the Trek tile pyramid into one equirectangular canvas.
 * Tiles that fail to load are left transparent; the globe falls back to its
 * procedural shading for those regions.
 */
export async function buildEquirectTexture(
  source: PlanetTextureSource,
  zoom: number,
  onProgress?: (loaded: number, total: number) => void,
  signal?: AbortSignal,
): Promise<HTMLCanvasElement | null> {
  const { cols, rows } = gridForZoom(zoom)
  const canvas = document.createElement('canvas')
  canvas.width = cols * TILE_SIZE
  canvas.height = rows * TILE_SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const jobs: Array<{ x: number; y: number; z: number }> = []
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) jobs.push({ x, y, z: zoom })
  }

  let loaded = 0
  await pool(jobs, 10, async (job) => {
    if (signal?.aborted) return
    const url = source.tileUrl
      .replace('{z}', String(job.z))
      .replace('{y}', String(job.y))
      .replace('{x}', String(job.x))
    const img = await loadTile(url)
    if (img) ctx.drawImage(img, job.x * TILE_SIZE, job.y * TILE_SIZE)
    loaded++
    onProgress?.(loaded, jobs.length)
  })

  if (signal?.aborted) return null

  // Nothing usable came back — let the caller fall back to procedural shading.
  const probe = ctx.getImageData(0, 0, canvas.width, canvas.height)
  let opaque = false
  for (let i = 3; i < probe.data.length; i += 4 * 997) {
    if (probe.data[i] > 8) {
      opaque = true
      break
    }
  }
  return opaque ? canvas : null
}
