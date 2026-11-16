# 🛰️ Smart Farm — Planetary Innovation Agency

A **decision-support web app** for farmers, built for the
[NASA International Space Apps Challenge 2026](https://www.spaceappschallenge.org/2026/challenges/adapting-farms-with-nasa-data/)
challenge **“Field Shift: Adapting Farms with NASA Data.”**

Smart Farm turns NASA Earth observations into a plain-language **Keep · Adapt ·
Shift** verdict for an exact field: will the current crop plan hold as this
place changes, what should change if it won't, and where in South Africa the
same crop fits better. It scores **crop-rotation strategies** against
**farmer-set priorities**, builds a season **playbook** (when to plant,
irrigate, harvest), and always defers to farmer judgement and local
agricultural expertise.

---

## Architecture — the console, plus the Smart Farm engine

The app is one React + Vite codebase with two cooperating halves:

| Layer | What it is |
| --- | --- |
| **Planetary console** *(main app)* | The full-bleed satellite map, the Earth / Mars / Moon mode switcher, global place search, the live **NASA POWER** telemetry drawer (suitability ring, live conditions vs. crop ideals, crop-shift options, 10-year dual trend) and the **Export Simple Farm Report** modal. |
| **Smart Farm engine** *(add-on)* | Mounted as a second tab in the same right-hand drawer. A deeper diagnosis for the *same* pinned field: 30-year POWER climatology, a 15-year daily archive, the Keep/Adapt/Shift verdict, live field pulse, alternative crops with a 2-season plan, the then-vs-now trend, rotation strategies, the season playbook and the field-shift explorer. |

Both halves share one map, one coordinate state and one theme — clicking the
map or searching for a town moves both. The console answers *"what is it like
right now?"* in seconds; the engine answers *"given 15 years of shift, what
should I plant and when?"*

### The flow

1. **Pin your field** — click the map, drag the pin, search any town, pick one
   of the sample global benchmark farms, or scan 15 km of real OpenStreetMap
   farmland around you.
2. **Live Console** *(default tab)* — NASA POWER telemetry for that point:
   suitability index for the selected crop, root-zone moisture / temperature /
   rainfall against that crop's ideal ranges, top alternatives, and the trend.
3. **Smart Farm engine** *(add-on tab)* — set your soil and rotation, weight
   your priorities, then run the full diagnosis:
   - **Top verdict** — colour-coded badge + one plain-English sentence.
   - **Live field pulse** — root-zone soil moisture, MODIS **NDVI** plant health
     vs the same fortnight in prior years, and a 14-day heat & rainfall outlook.
   - **What to do next** — top-3 alternative crops with match %, a suggested
     2-season rotation, and a *when to act* window.
   - **How your farm has changed** — first 5 vs latest 5 years of the record.
   - **Full analysis** *(on demand)* — 30-year climate record, monthly charts,
     rotation strategies, the complete season playbook, and the shift explorer.

## What it does (mapped to the challenge brief)

| Challenge asks for | Smart Farm delivers |
| --- | --- |
| NASA Earth observations | NASA **POWER** agroclimatology (30+ yr normals + a 15-yr daily archive) for the exact field point; **MODIS Terra** (GIBS) true-colour, **NDVI 8-day 250 m**, **NDVI 16-day 2000–present**, **Land Surface Temperature** and **GFSAD cropland extent** layers; **Copernicus DEM** (via Open-Meteo) elevation → slope → erosion risk; **NASA Trek** orbital mosaics for the Mars and Moon modes |
| Pin the farm, pick crops | Full-bleed interactive satellite map, draggable pin, global place search, sample global benchmark farms, a 15 km **OpenStreetMap farmland scan**, an **adjustable analysis catchment** (0.5–50 km, default 2.5 km), then one of 5 SA demo regions — or your own spot — and the rotation you actually grow |
| Planetary exploration | Real **3D globes** for Mars and Moon, rendered pixel-by-pixel from the NASA Trek Viking MDIM and LRO WAC global mosaics, with a **vertical-farming suitability mask** that highlights ground under 5° slope (HiRISE/CTX DTMs + MOLA for Mars, LOLA + LROC NAC for the Moon) |
| Past-vs-present trends | **Then vs now**: first 5 vs latest 5 years of the 15-yr NASA record — rainfall %, growing-season root-zone wetness, days above 32 °C, mean day-high, plus a full 15-year chart and wet-season onset shift |
| Traffic-light Crop Viability Score | A single **Keep / Adapt / Shift** verdict (green/amber/red) for the dominant crop, blending water balance, climate fit, soil/erosion and **trend momentum** — one sentence of plain English + its top drivers |
| Field Shifting Recommendations | Green/amber/red **rotation strategies** with why/evidence/benefits/gaps/risks; the Actions card ranks the top-3 **alternative crops** for this field with match %, a suggested 2-season rotation and a *when to act* window — plus a **Field-Shift Explorer** scoring the same crop vs other SA regions |
| Micro-management alerts | A dated **season playbook**: planting window (first wet month after last frost), peak irrigation months, harvest timing, heat/frost/storm watches, and a *right now* line from the latest observed satellite days |
| Local soil information | Farmer-entered soil texture, drainage, organic-matter %, irrigation status, and an adjustable ground slope (the properties USDA WSS/SSURGO encode — US-only datasets don’t cover SA) |
| Crop characteristics | Knowledge base of **20 South African crops** with FAO-56 water requirements, N-fixation, root depth, heat/drought/frost tolerance, forage & market values — plus photos for the headline crops |
| Farmer priorities | 5 sliders (water, soil health, income, erosion, forage) that **re-rank every strategy live** |
| ≥ 3 rotation strategies incl. current | Baseline (“your current rotation”) + up to 3 data-driven suggestions (drought-smart, legume bridge, soil-cover builder, forage booster, market spreader) |
| Why / evidence / benefits / gaps / risks | Every strategy card has these sections, with **evidence lines quoting the actual computed data** |
| Farmer-centred design | Plain-language captions everywhere, glossary, priority “voices”, a persistent *supports-not-replaces* disclaimer, and degradation-friendly error states |

The scoring engine is **rule-based and explainable by design** — every
criterion (water fit, soil health, erosion, pest/disease break, climate fit,
income, forage) is a transparent calculation from the data, not a black box.

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
  The console uses a single fast daily pass for its live readout; the engine
  uses the full climatology + daily archive for the diagnosis.
- **NASA GIBS** — WMTS tiles: `MODIS_Terra_CorrectedReflectance_TrueColor`,
  `MODIS_Terra_NDVI_8Day` (250 m, 2025-present), `MODIS_Terra_L3_NDVI_16Day`
  (5 km, 2000-present — used for the multi-year NDVI comparison),
  `MODIS_Terra_Land_Surface_Temp_Day`, `Agricultural_Lands_Croplands_2000`.
  For the in-app NDVI reading, tile pixels are inverted from colour back to
  NDVI using a lookup table auto-generated from the GIBS colormaps
  (`scripts/gen-ndvi-lut.cjs` → `src/lib/ndviLut.ts`).
- **NASA Trek** — Viking MDIM (Mars) and LRO WAC (Moon) global mosaics for the
  off-world modes.
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

## Presentation slides

A six-slide deck for presenting the project lives at **`/slides.html`** (also
reachable at `/slides/`). It is a plain static page in `public/slides/` — no
login, no permissions, no build step of its own.

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
  data/
    planetaryData.ts    Earth / Mars / Moon sites, map layer configs,
                        benchmark farms (the console's data model)
  services/             the console's live layer
    nasaPowerApi.ts     fast NASA POWER daily pass → telemetry + suitability
    reverseGeocode.ts   BigDataCloud + Nominatim place lookup
    overpassFarms.ts    OpenStreetMap farmland scan
  lib/                  the Smart Farm engine's data layer
    power.ts            NASA POWER client, Hargreaves ET₀, climate features,
                        then/now trend, wet-season onset shift
    ndvi.ts             GIBS tile sampling → field NDVI vs prior years
    ndviLut.ts          generated colour→NDVI LUT (MODIS + L3 ramps)
    forecast.ts         14-day outlook vs NASA POWER normals
    scoring.ts          verdict engine, crop viability & match scoring,
                        strategy generation, alternative-crop ranking
    alerts.ts           season playbook (plant / irrigate / harvest / watches)
    crops.ts            SA rotation-crop knowledge base (20 crops)
    soil.ts             texture → water-holding / erodibility profiles
    regions.ts          5 SA demo farm presets
    terrain.ts          Copernicus DEM slope sampling (Open-Meteo)
  components/
    TopNavBar.tsx       emerald header: brand, global search, mode switcher
    SatelliteMapPanel.tsx  full-bleed map, GIBS switcher, benchmark farms,
                        local farm scanner, telemetry footprints, legends
    DiagnosticDrawer.tsx    live console cards: suitability ring, conditions,
                        crop shift, dual trend, export CTA
    DualTrendChart.tsx      hoverable 10-year dual-line chart
    SmsReportModal.tsx      printable / copyable farm report
    FieldShiftAddon.tsx     the add-on tab: hosts the whole Smart Farm engine
    VerdictCard.tsx         traffic-light Keep / Adapt / Shift + drivers
    FieldPulseCard.tsx      moisture / NDVI gauges + 14-day outlook
    ActionsCard.tsx         alternative crops (photos), 2-season plan, when to act
    TrendCard.tsx           then-vs-now card (rain / hot days / highs)
    FieldPanel.tsx          region presets, soil, slope, rotation builder
    PrioritiesPanel.tsx     farmer priority sliders + preset “voices”
    DataReadout.tsx         metric cards + charts — lazy, under Full analysis
    Rotations.tsx           rotation strategies (why/evidence/gaps/risks)
    AlertsPanel.tsx         dated season playbook
    ShiftExplorer.tsx       same crop vs other SA production regions
    ui.tsx                 shared DiagnosticCard, Gauge, Chip, ScoreRing
    Footer.tsx             glossary, data & method, disclaimer
  App.tsx                 shell: nav + map + tabbed drawer + report modal
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
  pixel-by-pixel for the NDVI comparison, NASA Trek serves the off-world
  mosaics, and Copernicus DEM samples the actual terrain. Nothing in the
  *data* is mocked. Visual assets are concept imagery (not photographs of
  specific farms).
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
data. Smart Farm *supports* — never replaces — farmer judgement and local
agricultural expertise.
