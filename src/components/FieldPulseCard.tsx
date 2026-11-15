import { CloudRain, Droplets, Leaf, ThermometerSun } from 'lucide-react'
import type { Outlook } from '../lib/forecast'
import type { NdviPulse } from '../lib/ndvi'
import type { ClimateFeatures, DailyTrend } from '../lib/types'
import { DiagnosticCard, Gauge } from './ui'

// ---------------------------------------------------------------------------
// Card 2 — Live field pulse: what is happening on the land right now.
//
// Three simple gauges, each with a plain-language state and one actionable
// tip. No charts, no raw index dumps.
// ExtraUI theme: white card, emerald/amber/rose/cyan semantic accents.
// ---------------------------------------------------------------------------

interface SoilState {
  state: string
  tone: 'emerald' | 'amber' | 'rose' | 'cyan'
  pct: number
  caption: string
  tip: string
  value: string
}

/** Root-zone soil moisture against the normal for this month. */
function soilGauge(climate: ClimateFeatures, trend: DailyTrend | undefined): SoilState | null {
  const recent = trend?.recent
  if (!recent || recent.days === 0 || recent.wetness <= 0) return null
  const month = new Date().getMonth()
  const normal = climate.monthly.GWETROOT[month] ?? 0.5
  const ratio = normal > 0 ? recent.wetness / normal : 1
  const pct = Math.round(recent.wetness * 100)

  if (ratio < 0.85) {
    return {
      state: 'Too dry',
      tone: 'rose',
      pct: Math.round(ratio * 100),
      caption: 'below the usual moisture for this month',
      tip: `Hold off on planting until moisture rises — the root zone is only ${pct}% full against a normal ${Math.round(
        normal * 100,
      )}% for ${MONTH_NAMES[month]}.`,
      value: `${pct}% of water capacity`,
    }
  }
  if (ratio > 1.12) {
    return {
      state: 'Waterlogged',
      tone: 'cyan',
      pct: Math.min(100, Math.round(ratio * 92)),
      caption: 'wetter than usual for this month',
      tip: 'Delay heavy machinery and watch for waterlogging in low spots — the soil bank is full and roots need air.',
      value: `${pct}% of water capacity`,
    }
  }
  return {
    state: 'Optimal',
    tone: 'emerald',
    pct: Math.round(ratio * 88),
    caption: 'in the normal band for this month',
    tip: `Good conditions for establishment — ${recent.rainMm} mm of rain in the last ${recent.days} observed days.`,
    value: `${pct}% of water capacity`,
  }
}

/** Vegetation index vs the same fortnight in previous years. */
function plantGauge(ndvi: NdviPulse | null): SoilState | null {
  if (!ndvi || ndvi.unavailable || !ndvi.now) return null
  const value = ndvi.now.ndvi
  const delta = ndvi.deltaPct
  const pct = Math.round(value * 100)

  if (delta !== null && delta < -8) {
    return {
      state: 'Stressed',
      tone: 'rose',
      pct,
      caption: 'less green than in previous years',
      tip: `Canopy is ${Math.abs(Math.round(delta))}% less green than the same fortnight in previous years — plants are struggling, not the season.`,
      value: `vegetation index ${value.toFixed(2)}`,
    }
  }
  if (delta !== null && delta > 8) {
    return {
      state: 'Thriving',
      tone: 'emerald',
      pct,
      caption: 'greener than in previous years',
      tip: `Canopy is ${Math.round(delta)}% greener than the same fortnight in previous years — the crop is using the season well.`,
      value: `vegetation index ${value.toFixed(2)}`,
    }
  }
  return {
    state: 'Moderate',
    tone: 'amber',
    pct,
    caption: 'in line with previous years',
    tip: 'Canopy looks normal for this time of year — no stress signal from the satellites yet.',
    value: `vegetation index ${value.toFixed(2)}`,
  }
}

/** 14-day heat and rain outlook. */
function outlookGauge(outlook: Outlook | null): SoilState | null {
  if (!outlook) return null
  const rain = Math.round(outlook.rainMm)
  const normal = Math.round(outlook.normalRainMm)
  const dry = outlook.longestDrySpell
  const hot = outlook.hotDays

  if (hot >= 4) {
    return {
      state: 'Heatwave watch',
      tone: 'rose',
      pct: Math.min(100, hot * 14),
      caption: `${hot} hot days above 32°C in 14 days`,
      tip: `Peak ${Math.round(outlook.maxTmax)}°C — irrigate before the hot spell and avoid spraying at midday.`,
      value: `${rain} mm expected (normal ${normal} mm)`,
    }
  }
  if (dry >= 7) {
    return {
      state: 'Dry spell',
      tone: 'amber',
      pct: Math.min(100, dry * 12),
      caption: `${dry} days without useful rain`,
      tip: 'No rain in the next week or so — get the crop established now while there is still soil moisture.',
      value: `${rain} mm expected (normal ${normal} mm)`,
    }
  }
  if (rain >= normal * 1.3) {
    return {
      state: 'Wet coming',
      tone: 'cyan',
      pct: 80,
      caption: `${rain} mm expected vs ${normal} mm normal`,
      tip: 'A wet fortnight ahead — good for germination, but watch for waterlogging and disease pressure.',
      value: `${rain} mm expected (normal ${normal} mm)`,
    }
  }
  return {
    state: 'Settled',
    tone: 'emerald',
    pct: 60,
    caption: `${rain} mm expected vs ${normal} mm normal`,
    tip: `Roughly normal for this time of year — ${hot} hot day${hot === 1 ? '' : 's'} above 32°C in the outlook.`,
    value: `${rain} mm expected (normal ${normal} mm)`,
  }
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export default function FieldPulseCard({
  climate,
  trend,
  ndvi,
  outlook,
}: {
  climate: ClimateFeatures
  trend?: DailyTrend
  ndvi: NdviPulse | null
  outlook: Outlook | null
}) {
  const soil = soilGauge(climate, trend)
  const plant = plantGauge(ndvi)
  const look = outlookGauge(outlook)

  return (
    <DiagnosticCard
      id="pulse"
      step="2"
      title="Live field pulse"
      sub="What the satellites and models say about this field right now."
      icon={<Droplets className="h-4 w-4 text-cyan-600" />}
    >
      <div className="grid gap-4 md:grid-cols-3">
        {soil ? (
          <Gauge
            label="Root-zone soil moisture"
            state={soil.state}
            tone={soil.tone}
            value={soil.value}
            scale={{ pct: soil.pct, caption: soil.caption }}
            tip={soil.tip}
            source="NASA POWER (GWETROOT), last observed days"
          />
        ) : (
          <Gauge
            label="Root-zone soil moisture"
            state="No data"
            tone="amber"
            value="—"
            tip="The soil-moisture model has not delivered an observation for this point yet."
            source="NASA POWER (GWETROOT)"
          />
        )}

        {plant ? (
          <Gauge
            label="Plant health (NDVI)"
            state={plant.state}
            tone={plant.tone}
            value={plant.value}
            scale={{ pct: plant.pct, caption: plant.caption }}
            tip={plant.tip}
            source="MODIS Terra vegetation index, sampled at your pin"
          />
        ) : (
          <Gauge
            label="Plant health (NDVI)"
            state="No signal"
            tone="amber"
            value="—"
            tip="Satellite vegetation imagery for this exact point is not available (clouds or no recent pass)."
            source="MODIS Terra vegetation index"
          />
        )}

        {look ? (
          <Gauge
            label="Heat & rainfall outlook"
            state={look.state}
            tone={look.tone}
            value={look.value}
            scale={{ pct: look.pct, caption: look.caption }}
            tip={look.tip}
            source="14-day forecast, benchmarked against NASA POWER normals"
          />
        ) : (
          <Gauge
            label="Heat & rainfall outlook"
            state="No data"
            tone="amber"
            value="—"
            tip="The 14-day forecast service could not be reached — the season playbook below still applies."
            source="14-day forecast + NASA POWER normals"
          />
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-xl border border-slate-100 bg-emerald-soft px-3.5 py-2.5 text-[10px] text-emerald-700">
        <span className="flex items-center gap-1.5">
          <CloudRain className="h-3 w-3 text-cyan-600" />
          {trend ? `${trend.recent.rainMm} mm rain in the last ${trend.recent.days} observed days` : 'recent rain unknown'}
        </span>
        <span className="flex items-center gap-1.5">
          <ThermometerSun className="h-3 w-3 text-rose-600" />
          {trend ? `hottest recent day ${Math.round(trend.recent.tmaxMax)}°C` : ''}
        </span>
        <span className="flex items-center gap-1.5">
          <Leaf className="h-3 w-3 text-emerald-600" />
          {climate.heatMonths32} months of the year run hot (over 32°C)
        </span>
      </div>
    </DiagnosticCard>
  )
}
