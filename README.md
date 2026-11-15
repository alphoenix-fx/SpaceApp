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
| NASA Earth observations | NASA **POWER** agroclimatology (30+ yr normals + 15 yr daily) for the exact field point; **MODIS Terra** (GIBS) true-colour, **NDVI 8-day** and **Land Surface Temperature** map layers; **Copernicus DEM** (via Open-Meteo) elevation → slope → erosion risk |
| Pin the farm, pick crops | Click/drag a pin on satellite imagery, choose one of 5 SA demo regions or your own spot, then build the crop rotation you actually grow |
| Past-vs-present trends | **Then vs now** strip: first 5 years vs last 5 of NASA daily records — rainfall %, growing-season root-zone wetness, days above 32 °C, mean day-high temperature, plus a 15-year trend chart |
| Traffic-light Crop Viability Score | A single **Keep / Adapt / Shift** verdict (green/amber/red) for the dominant crop, blending water balance, climate fit, soil/erosion and **trend momentum** — with its top-3 drivers and a plain-language trend note |
| Field Shifting Recommendations | Green/amber/red **rotation strategies** with why/evidence/benefits/gaps/risks, plus a **Field-Shift Explorer** that scores the same crop against other SA production regions by NASA climatology |
| Micro-management alerts | A dated **season playbook**: planting window, peak irrigation months, harvest timing, heat/frost/storm watches, and a *right now* line from the most recent observed satellite days |
| Local soil information | Farmer-entered soil texture, drainage, organic-matter %, irrigation status, and an adjustable ground slope (the properties USDA WSS/SSURGO encode — US-only datasets don’t cover SA) |
| Crop characteristics | Knowledge base of **20 South African crops** with water requirements (FAO-56 ranges), N-fixation, root depth, heat/drought/frost tolerance, forage & market values |
| Farmer priorities | 5 sliders (water, soil health, income, erosion, forage) that **re-rank every strategy live** |
| ≥ 3 rotation strategies incl. current | Baseline (“your current rotation”) + up to 3 data-driven suggestions (drought-smart, legume bridge, soil-cover builder, forage booster, market spreader) |
| Why / evidence / benefits / gaps / risks | Every strategy card has these sections, with **evidence lines quoting the actual computed data** |
| Visualisation | Monthly rain-vs-ET₀ chart, temperature band, root-zone soil wetness, **15-year rainfall & heat-day trend**, metric cards, interactive satellite map with layer/date controls |
| Farmer-centred design | Plain-language captions everywhere, glossary, priority “voices”, and a persistent *supports-not-replaces* disclaimer |

The scoring engine is **rule-based and explainable by design** — every
criterion (water fit, soil health, erosion, pest/disease break, climate fit,
income, forage) is a transparent calculation from the data, not a black box.

## The flow

1. **01 Field** — pin the farm, pick the crops you grow, describe the soil.
2. **02 Priorities** — weight what matters to you (water, soil, income, erosion,
   forage); every score re-ranks instantly.
3. **03 Data** — what the satellites see: 30-yr normals, then-vs-now shifts,
   trends, and MODIS imagery of your exact field.
4. **04 Verdict** — Keep / Adapt / Shift, with the drivers behind the score.
5. **05 Adapt** — rotation strategies side by side, each with why, evidence,
   gaps and risks.
6. **06 Playbook** — when to plant, irrigate, harvest, and what to watch.
7. **07 Shift** — how the same crop scores in other SA production regions.

## The data sources

**Live & keyless (used in the browser):**

- **NASA POWER** — `power.larc.nasa.gov/api` (climatology + daily, community AG).
  Rainfall, RH, root-zone soil wetness (`GWETROOT`), actual evapotranspiration
  (`EVPTRNS`, MJ/m²/day → mm/day ÷ 2.45). Monthly temperature normals, hot-day
  (>32°C/>35°C) and frost-night (<2°C) frequencies are derived from the 15-year
  daily record, because POWER's climatology returns 30-year record *extremes*
  for `T2M_MAX`/`T2M_MIN`, not means. Reference ET₀ is computed client-side
  with **Hargreaves–Samani** from those Tmax/Tmin means (POWER exposes no ET₀
  parameter over REST).
- **NASA GIBS** — WMTS tiles: `MODIS_Terra_NDVI_8Day` (GoogleMapsCompatible_Level9),
  `MODIS_Terra_Land_Surface_Temp_Day` (Level7), `MODIS_Terra_CorrectedReflectance_TrueColor`.
- **Copernicus DEM GLO-90** via the Open-Meteo Elevation API — centre + 12
  surrounding points → steepest local gradient → erosion-risk factor (with a
  manual slope slider fallback; OpenTopoData/SRTM dropped CORS support in
  late 2026, so the app now uses this CORS-friendly mirror).

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
src/
  lib/
    power.ts      NASA POWER client, Hargreaves ET0, climate features + trends
    terrain.ts    Copernicus DEM slope sampling (Open-Meteo) + manual fallback
    crops.ts      SA rotation-crop knowledge base (agronomy attributes)
    soil.ts       Texture → water-holding / erodibility profiles
    regions.ts    5 demo farm presets (Free State, North West, Swartland, …)
    scoring.ts    The rotation engine: water balance, criteria scores,
                  priority weighting, strategy generation, Keep/Adapt/Shift
                  verdict, single-crop viability, trend momentum
    alerts.ts     Season playbook (plant / irrigate / harvest / heat / frost)
  components/
    FarmMap.tsx         Leaflet + Esri base + NASA GIBS overlays
    FieldPanel.tsx      Region presets, soil, slope, rotation builder, map
    PrioritiesPanel.tsx Farmer priority sliders + preset "voices"
    DataReadout.tsx     Metric cards, Then-vs-Now strip, Recharts (lazy)
    VerdictCard.tsx     Traffic-light Keep / Adapt / Shift verdict
    Rotations.tsx       Strategy cards with why/evidence/gaps/risks + ranking
    AlertsPanel.tsx     Dated season playbook cards
    ShiftExplorer.tsx   Same crop vs other SA production regions
    Footer.tsx          Glossary, data & method, disclaimer
```

## Judging notes

- **Impact / storytelling:** five real SA production regions; the Free State
  demo shows a water-limited maize system (verdict ADAPT — maize under
  pressure), the Swartland shows SA’s famous conservation-agriculture wheat
  system (canola/medic leys). The Shift Explorer shows why maize belongs in
  the wetter KZN Midlands and not the winter-rain Swartland.
- **Relevance to the brief:** the three requested outputs are first-class
  sections — traffic-light viability (04), shifting recommendations (05 + 07)
  and micro-management alerts (06) — on top of every original requirement
  (≥3 rotations, explainability fields, uncertainty/gaps, farmer judgement).
- **NASA data actually used:** POWER is fetched live per field (normals +
  daily), GIBS tiles render the actual MODIS layers, and Copernicus DEM
  samples the actual terrain. Nothing is mocked; demo values in the hero are
  labelled as illustrative.
- **Honesty about limits:** satellite-derived monthly normals are coarse
  (MERRA-2 grid); POWER daily lags ~a week, and the playbook labels observed
  vs expected accordingly. Regional shift scoring is a first-pass climate
  screen — land, water rights and markets stay with the farmer.
- **Future work:** SMAP L4 & ECOSTRESS via Earthdata auth on a small server,
  USDA CDL-style crop-history layers for SA (e.g. Sentinel-2 crop mapping),
  a stronger optimiser (genetic/constraint search) over the crop library, and
  farmer accounts to save fields.

---

Built with 💚 by the team for **NASA Space Apps 2026** · powered by NASA open
data. FieldShift *supports* — never replaces — farmer judgement and local
agricultural expertise.
