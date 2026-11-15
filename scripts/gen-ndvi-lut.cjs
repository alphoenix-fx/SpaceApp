// Generates src/lib/ndviLut.ts from the NASA GIBS colour maps.
//
// Two palettes are involved:
//   • MODIS_NDVI.xml      — the 250 m MODIS Terra NDVI 8-day layer (field-scale)
//   • MODIS_L3_NDVI.xml   — the 5 km MODIS L3 16-day layer (multi-year history)
//
// GIBS renders NDVI with these ramps, so a sampled pixel colour can be
// inverted back to a real NDVI value.
//
// Usage: node scripts/gen-ndvi-lut.cjs
const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')

function parse(file) {
  const xml = fs.readFileSync(path.join(root, file), 'utf8')
  const re = /<ColorMapEntry rgb="([\d,]+)"([^/]*)\/>/g
  const entries = []
  let m
  while ((m = re.exec(xml))) {
    const v = m[2].match(/value="\[(-?[\d.]+),(-?[\d.]+)\)/)
    if (!v) continue
    const [r, g, b] = m[1].split(',').map(Number)
    entries.push({
      r,
      g,
      b,
      lo: parseFloat(v[1]),
      hi: parseFloat(v[2]),
      transparent: m[2].includes('transparent="true"'),
    })
  }
  entries.sort((a, b) => a.lo - b.lo)
  return entries
}

const fine = parse('MODIS_NDVI.xml')
const coarse = parse('MODIS_L3_NDVI.xml')

const fmt = (entries) =>
  entries
    .map((e) => `  [${e.r}, ${e.g}, ${e.b}, ${((e.lo + e.hi) / 2).toFixed(4)}, ${e.transparent ? 1 : 0}],`)
    .join('\n')

const out = `// AUTO-GENERATED from the NASA GIBS colour maps.
// Sources:
//   https://gibs.earthdata.nasa.gov/colormaps/v1.3/MODIS_NDVI.xml     (250 m)
//   https://gibs.earthdata.nasa.gov/colormaps/v1.3/MODIS_L3_NDVI.xml  (5 km)
// Regenerate with: node scripts/gen-ndvi-lut.cjs
//
// Each entry is [red, green, blue, ndvi, transparent]. GIBS renders NDVI
// with these ramps, so a sampled pixel colour can be inverted back to a real
// NDVI value.

export const NDVI_LUT_FINE: ReadonlyArray<readonly [number, number, number, number, number]> = [
${fmt(fine)}
]

export const NDVI_LUT_COARSE: ReadonlyArray<readonly [number, number, number, number, number]> = [
${fmt(coarse)}
]
`

fs.writeFileSync(path.join(root, 'src', 'lib', 'ndviLut.ts'), out)
console.log('fine entries:', fine.length, '| coarse entries:', coarse.length, '| bytes:', out.length)
