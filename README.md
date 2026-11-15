# 🛰️ FieldShift — Adapting Farms with NASA Data

A **decision-support web app** for South African farmers, built for the
[NASA International Space Apps Challenge 2026](https://www.spaceappschallenge.org/2026/challenges/adapting-farms-with-nasa-data/)
challenge **“Field Shift: Adapting Farms with NASA Data.”**

FieldShift turns NASA Earth observations into a plain-language **Keep · Adapt ·
Shift** verdict for an exact field: will the current crop plan hold as this
place changes, what should change if it won't, and where in South Africa the
same crop fits better. It scores **crop-rotation strategies** against
**farmer-set priorities**, builds a season **playbook** (when to plant,
irrigate, harvest), and always defers to farmer judgement and local
agricultural expertise.

---

## What it does (mapped to the challenge brief)

| Challenge asks for | FieldShift delivers |
| --- | --- |
| NASA Earth observations | NASA **POWER** agroclimatology (30+ yr normals + a 15-yr daily archive) for the exact field point; **MODIS Terra** (GIBS) true-colour, **NDVI 8-day 250 m**, **NDVI 16-day 2000–present**, **Land Surface Temperature** and **GFSAD cropland extent** layers; **Copernicus DEM** (via Open-Meteo) elevation → slope → erosion risk |
| Pin the farm, pick crops | A live **Field Console**: full-bleed satellite map, layer switcher, place search (or paste `lat, lon`), draggable pin, a scan of **real nearby farms** from OpenStreetMap/Overpass, then one of 5 SA demo regions — or your own spot — and the rotation you actually grow |
| Past-vs-present trends | **Then vs now**: first 5 vs latest 5 years of the 15-yr NASA record — rainfall %, growing-season root-zone wetness, days above 32 °C, mean day-high, plus a full 15-year chart and wet-season onset shift |
| Traffic-light Crop Viability Score | A single **Keep / Adapt / Shift** verdict (green/amber/red) for the dominant crop, blending water balance, climate fit, soil/erosion and **trend momentum** — one sentence of plain English + its top drivers |
| Field Shifting Recommendations | Green/amber/red **rotation strategies** with why/evidence/benefits/gaps/risks; the Actions card ranks the top-3 **alternative crops** for this field with match %, a suggested 2-season rotation and a *when to act* window — plus a **Field-Shift Explorer** scoring the same crop vs other SA regions |
| Micro-management alerts | A dated **season playbook**: planting window (first wet month after last frost), peak irrigation months, harvest timing, heat/frost/storm watches, and a *right now* line from the latest observed satellite days |
| Local soil information | Farmer-entered soil texture, drainage, organic-matter %, irrigation status, and an adjustable ground slope (the properties USDA WSS/SSURGO encode — US-only datasets don’t cover SA) |
| Crop characteristics | Knowledge base of **20 South African crops** with FAO-56 water requirements, N-fixation, root depth, heat/drought/frost tolerance, forage & market values — plus photos for the headline crops |
| Farmer priorities | 5 sliders (water, soil health, income, erosion, forage) that **re-rank every strategy live** |
| ≥ 3 rotation strategies incl. current | Baseline (“your current rotation”) + up to 3 data-driven suggestions (drought-smart, legume bridge, soil-cover builder, forage booster, market spreader) |
| Why / evidence / benefits / gaps / risks | Every strategy card has these sections, with **evidence lines quoting the actual computed data** |
| Visualisation | A **diagnostic-first** layout: four plain-language cards (verdict, field pulse, actions, then-vs-now trend) with colour-coded badges, gauges and toggles, on top of a collapsible *Full analysis* deep dive |
| Farmer-centred design | Plain-language captions everywhere, glossary, priority “voices”, a persistent *supports-not-replaces* disclaimer, and degradation-friendly error states |

The scoring engine is **rule-based and explainable by design** — every
criterion (water fit, soil health, erosion, pest/disease break, climate fit,
income, forage) is a transparent calculation from the data, not a black box.

### The four diagnostic cards

1. **Top verdict** — large colour-coded badge (KEEP / ADAPT / SHIFT), one plain-English sentence, then the drivers behind the score.
2. **Live field pulse** — 3–4 simple gauges: root-zone soil moisture, MODIS **NDVI** plant-health vs the same fortnight in prior years, and a 14-day heat & rainfall outlook flagging heatwaves and dry spells (Open-Meteo ECMWF/GFS, benchmarked against NASA POWER normals — labelled accordingly, not passed off as NASA data).
3. **What to do next** — top-3 alternative crops with match %, a suggested 2-season rotation, and a *when to act* window (planting date, wet-season onset shift, peak irrigation, harvest).
4. **How your farm has changed** — first 5 vs latest 5 years (then vs now) with toggles for rainfall, hot days and day-highs.

Everything heavier — 30-yr climate record, monthly charts, rotation strategies,
the full playbook, the shift explorer — lives one click away under
**Full analysis**.

## The flow

0. **Field Console** — the app's front door: pin your field on the live map, read straight-off-orbit numbers, radiograph the neighbourhood (real farms & plots from OpenStreetMap), and search any farm or town.
1. **01 Field** — pick a demo region or your own spot, describe soil and slope, build the rotation you grow. The console above already placed the pin — this is the paperwork.
2. **02 Priorities** — weight what matters (water, soil, income, erosion, forage); every score re-ranks instantly.
3. **Analyse with NASA data** — one click pulls the POWER climatology + 15-yr daily archive for your point and starts the diagnosis.
4. **The four cards** — verdict → pulse → actions → then-vs-now trend.
5. **Full analysis** *(on demand)* — metric cards, monthly rain/ET₀/temperature charts, rotation strategies, the complete season playbook, and the then-vs-now shift explorer.

## The data sources

**Live & keyless (used in the browser):**

- **NASA POWER** — `power.larc.nasa.gov/api` (climatology + daily, community AG).
  Rainfall, RH, root-zone soil wetness (`GWETROOT`), actual evapotranspiration
  (`EVPTRNS`, MJ/m²/day → mm/day ÷ 2.45). Monthly temperature normals, hot-day
  (>32 °C/>35 °C) and frost-night (<2 °C) frequencies are derived from the
  15-year daily record, because POWER's climatology returns 30-year record
  *extremes* for `T2M_MAX`/`T2M_MIN`, not means. Reference ET₀ is computed
  client-side with **Hargreaves–Samani** from those Tmax/Tmin means (POWER
  exposes no ET₀ parameter over REST).
- **NASA GIBS** — WMTS tiles, rendered live in the console and in the analysis
  view: `MODIS_Terra_CorrectedReflectance_TrueColor`,
  `MODIS_Terra_NDVI_8Day` (250 m, 2025-present), `MODIS_Terra_L3_NDVI_16Day`
  (5 km, 2000-present — used for the multi-year NDVI comparison),
  `MODIS_Terra_Land_Surface_Temp_Day`, `Agricultural_Lands_Croplands_2000`.
  For the in-app NDVI reading, tile pixels are inverted from colour back to
  NDVI using a lookup table auto-generated from the GIBS colormaps
  (`scripts/gen-ndvi-lut.cjs` → `src/lib/ndviLut.ts`).
- **Copernicus DEM GLO-90** via the Open-Meteo Elevation API — centre + 12
  surrounding points → steepest local gradient → erosion-risk factor (with a
  manual slope slider fallback).
- **Open-Meteo** — 14-day heat/rainfall outlook (ECMWF/GFS), benchmarked
  against NASA POWER normals; clearly labelled as a forecast, not NASA data.
- **OpenStreetMap via Overpass, Nominatim & BigDataCloud** — place search,
  reverse geocoding, and real nearby-farm listings in the console.

**Referenced agronomy:** FAO Irrigation & Drainage Papers 56/33 (crop water
requirements), ARC / Grain SA context, FAO GAEZ for suitability cross-checks.

**US-only resources from the challenge list** (Web Soil Survey, SSURGO,
CropScape/CDL, PRISM, NASS QuickStats, Market News, OpenET, CoCoRaHS, NWIS,
NLDAS/GLDAS, NAIP, NLCD, LANDFIRE, GEDI) don’t cover South Africa or need
Earthdata authentication — they’re acknowledged in-app under *Data & method* as
the path to extend the tool, which is why farmer-entered soil properties stand
in for SSURGO here.

## Run it locally

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production bundle in dist/
```

No API keys required — all data endpoints are open and CORS-enabled.

## Deploy

### Render (static site)

1. New → **Static Site**, connect the repo.
2. Build command: `npm run build`
3. Publish directory: `dist`

### Railway

Railway auto-detects Vite (Nixpacks). Set:

- Build command: `npm run build`
- Output directory: `dist`

(or use a `railway.toml` / start command `npx serve dist` — either works; the
app is a pure static SPA with no backend.)

## Project structure

```
public/images/          real photographs (field cover + headline crops)
scripts/
  gen-ndvi-lut.cjs      auto-generates the GIBS colour→NDVI lookup table
  prepare-images.ps1    crops/landscape assets, resized for the web
src/
  lib/
    power.ts       NASA POWER client, Hargreaves ET₀, climate features,
                     then/now trend, wet-season onset shift
    ndvi.ts        GIBS tile sampling → field NDVI vs prior years
    ndviLut.ts     generated colour→NDVI LUT (MODIS + L3 ramps)
    forecast.ts    14-day outlook vs NASA POWER normals
    places.ts      reverse geocode / place search / nearby farms (OSM)
    scoring.ts     verdict engine, crop viability & match scoring,
                     strategy generation, alternative-crop ranking
    alerts.ts      season playbook (plant / irrigate / harvest / watches)
    crops.ts       SA rotation-crop knowledge base (20 crops)
    soil.ts        texture → water-holding / erodibility profiles
    regions.ts     5 demo farm presets
  components/
    FieldConsole.tsx      the hero: satellite map, GIBS layers, search,
                          nearby-farm scan, live readout, cycle strip
    FieldPanel.tsx        region presets, soil, slope (map lives in console)
    PrioritiesPanel.tsx   farmer priority sliders + preset “voices”
    VerdictCard.tsx       traffic-light Keep / Adapt / Shift + drivers
    FieldPulseCard.tsx    moisture / NDVI gauges + 14-day outlook
    ActionsCard.tsx       alternative crops (photos), 2-season plan, when to act
    TrendCard.tsx         then-vs-now card (rain / hot days / highs)
    DataReadout.tsx       metric cards + charts — lazy, under Full analysis
    Rotations.tsx         rotation strategies (why/evidence/gaps/risks)
    AlertsPanel.tsx       dated season playbook
    ShiftExplorer.tsx     same crop vs other SA production regions
    ui.tsx                shared DiagnosticCard, Gauge, Chip, ScoreRing
    Footer.tsx            glossary, data & method, disclaimer
  App.tsx                 intro band + console + flow + Full analysis toggle
```

## Judging notes

- **Impact / storytelling:** five real SA production regions; the Free State
  demo shows a water-limited maize system (verdict ADAPT — maize under
  pressure), the Swartland shows SA’s famous conservation-agriculture wheat
  system (canola/medic leys). The Shift Explorer shows why maize belongs in
  the wetter KZN Midlands and not the winter-rain Swartland.
- **Relevance to the brief:** the three requested outputs are first-class —
  traffic-light viability, shifting recommendations, and micro-management
  alerts — with the then-vs-now evidence one tap away, plus every supporting
  requirement (≥3 rotations, explainability fields, uncertainty/gaps, farmer
  judgement deferred).
- **NASA data actually used:** POWER is fetched live per field (normals +
  daily), GIBS tiles render the actual MODIS layers and are sampled
  pixel-by-pixel for the NDVI comparison, and Copernicus DEM samples the actual
  terrain. Nothing in the *data* is mocked. Visual assets are concept
  imagery (not photographs of specific farms).
- **Honesty about limits:** satellite-derived monthly normals are coarse
  (MERRA-2 grid); POWER daily lags ~a week; the 14-day outlook is a real
  forecast (ECMWF/GFS via Open-Meteo), benchmarked on NASA normals and
  labelled as a forecast; the playbook labels observed vs expected;
  incomplete first-year records are excluded from the then-vs-now comparison;
  regional shift scoring is a first-pass climate screen — land, water rights
  and markets stay with the farmer.
- **Future work:** SMAP L4 & ECOSTRESS via Earthdata auth on a small server,
  USDA CDL-style crop-history layers for SA (e.g. Sentinel-2 crop mapping),
  a stronger optimiser (genetic/constraint search) over the crop library, and
  farmer accounts to save fields.

---

Built with 💚 by the team for **NASA Space Apps 2026** · powered by NASA open
data. FieldShift *supports* — never replaces — farmer judgement and local
agricultural expertise.
