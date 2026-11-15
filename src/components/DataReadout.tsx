import { useEffect, useState } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { CloudRain, Snowflake, Sun, ThermometerSun, Waves } from 'lucide-react'
import { MONTH_LABELS } from '../lib/power'
import type { ClimateFeatures, DailyTrend, TerrainInfo } from '../lib/types'
import { Chip, SectionHead } from './ui'

interface Props {
  climate: ClimateFeatures
  terrain: TerrainInfo
  soil: { texture: string; irrigated: boolean }
}

export default function DataReadout({ climate, terrain }: Props) {
  const m = climate.monthly
  const monthly = MONTH_LABELS.map((label, i) => ({
    month: label,
    rain: +m.P[i].toFixed(1),
    et0: +m.ET0[i].toFixed(1),
    deficit: +(m.P[i] - m.ET0[i]).toFixed(1),
    tmin: +m.Tmin[i].toFixed(1),
    tmax: +m.Tmax[i].toFixed(1),
    tavg: +m.Tavg[i].toFixed(1),
    wetness: +m.GWETROOT[i].toFixed(2),
  }))

  const card = (
    icon: React.ReactNode,
    label: string,
    value: string,
    sub: string,
    tone: 'water' | 'leaf' | 'ochre' | 'clay' = 'leaf',
  ) => {
    const valueColor =
      tone === 'water' ? 'text-water' : tone === 'clay' ? 'text-clay' : tone === 'ochre' ? 'text-ochre' : 'text-leaf-dark'
    return (
      <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
        <div className="mb-1 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-500">
          {icon}
          {label}
        </div>
        <p className={`data-tabular text-lg font-bold leading-tight ${valueColor}`}>{value}</p>
        <p className="mt-0.5 text-[9px] leading-snug text-slate-500">{sub}</p>
      </div>
    )
  }

  const wetNames = climate.wetMonths.map((i) => MONTH_LABELS[i])

  return (
    <section id="data" className="scroll-mt-24">
      <SectionHead
        index="03"
        title="What the satellites see at your field"
        sub="30+ years of NASA POWER agroclimatology at this exact point, plus Copernicus DEM terrain and MODIS imagery. These are the conditions every rotation has to live with."
      />

      {/* Metric cards */}
      <div className="mb-6 grid grid-cols-2 gap-2.5 @md:grid-cols-3 @4xl:grid-cols-6">
        {card(
          <CloudRain className="h-3.5 w-3.5 text-water" />,
          'Annual rainfall',
          `${Math.round(climate.annualRainMm)} mm`,
          `Concentrated in ${wetNames.join('–')} (${Math.round(climate.rainConcentration * 100)}% of the year's rain).`,
          'water',
        )}
        {card(
          <Sun className="h-3.5 w-3.5 text-ochre" />,
          'Evaporative demand',
          `${Math.round(climate.annualET0Mm)} mm`,
          `Reference ET0 — how much water the atmosphere tries to pull out of crops each year.`,
          'ochre',
        )}
        {card(
          <Waves className="h-3.5 w-3.5 text-water" />,
          'Aridity index',
          climate.aridityIndex.toFixed(2),
          climate.aridityIndex < 0.5
            ? 'Semi-arid: rain supplies under half the evaporative demand — every crop runs a water balance.'
            : 'Rain covers a meaningful share of demand — drier spells still bite mid-season.',
          'water',
        )}
        {card(
          <ThermometerSun className="h-3.5 w-3.5 text-clay" />,
          'Heat stress',
          `${climate.heatMonths32} mo >32°C`,
          climate.heatMonths35 > 0
            ? `${climate.heatMonths35} of those see 35°C+ days — flowering crops are at real risk.`
            : '35°C days are rare — flowering heat damage is uncommon here.',
          'clay',
        )}
        {card(
          <Snowflake className="h-3.5 w-3.5 text-water-2" />,
          'Frost risk',
          `${climate.frostMonths} mo`,
          climate.frostMonths > 0
            ? 'Months where nights can dip below ~2°C — shapes your planting calendar.'
            : 'Essentially frost-free — the full calendar is plantable.',
          'water',
        )}
        {card(
          <Sun className="h-3.5 w-3.5 text-leaf" />,
          'Terrain',
          `${terrain.slopePercent}% slope`,
          `${terrain.slopeClass.charAt(0).toUpperCase() + terrain.slopeClass.slice(1)} ground${
            terrain.source === 'manual'
              ? ' — live terrain pass unavailable right now, using your local estimate. Adjust the slope slider in section 01 if this ground is different.'
              : ` (Copernicus DEM). ${terrain.erosionRelevance}`
          }`,
          'leaf',
        )}
      </div>

      {/* Then vs Now */}
      <ThenVsNow trend={climate.trend} />

      {/* Charts */}
      <div className="grid gap-4 @2xl:grid-cols-2">
        <ChartCard
          title="Rainfall vs atmospheric water demand"
          caption="Blue bars: rain received (NASA POWER). Ochre line: ET0 — what crops lose to evaporation & transpiration. Where the line sits above the bars, the soil is spending its bank, not earning."
        >
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={monthly} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
              <CartesianGrid stroke="#e2d9c1" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#6b7260' }} />
              <YAxis tick={{ fontSize: 10, fill: '#6b7260' }} />
              <Tooltip
                contentStyle={{ borderRadius: 10, borderColor: '#e2d9c1', fontSize: 12 }}
                formatter={(v, n) => [`${v} mm`, n === 'rain' ? 'Rain' : 'ET0 demand']}
              />
              <Bar dataKey="rain" name="rain" fill="#2e6e8e" radius={[3, 3, 0, 0]} maxBarSize={22} />
              <Line dataKey="et0" name="et0" stroke="#c98a2d" strokeWidth={2.5} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Temperature through the year"
          caption="The band between night lows and day highs (monthly normals). Frost months and the hot shoulder that punishes flowering crops live at the edges."
        >
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={monthly} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
              <CartesianGrid stroke="#e2d9c1" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#6b7260' }} />
              <YAxis tick={{ fontSize: 10, fill: '#6b7260' }} unit="°" />
              <Tooltip
                contentStyle={{ borderRadius: 10, borderColor: '#e2d9c1', fontSize: 12 }}
                formatter={(v, n) => [`${v} °C`, n === 'tmax' ? 'Day highs' : n === 'tmin' ? 'Night lows' : 'Mean']}
              />
              <Area dataKey="tmax" stroke="#b4552d" fill="#b4552d22" strokeWidth={1.5} name="tmax" />
              <Area dataKey="tmin" stroke="#2e6e8e" fill="#2e6e8e22" strokeWidth={1.5} name="tmin" />
              <Line dataKey="tavg" stroke="#1e241c" strokeWidth={2} dot={false} name="tavg" />
              <ReferenceLine y={32} stroke="#b4552d" strokeDasharray="4 3" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Root-zone soil wetness"
          caption="NASA POWER root-zone wetness (0–1): how full the soil water 'bank' typically runs. The dip-and-recover shape tells you when crops live on reserves."
        >
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={monthly} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
              <CartesianGrid stroke="#e2d9c1" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#6b7260' }} />
              <YAxis tick={{ fontSize: 10, fill: '#6b7260' }} domain={[0, 1]} />
              <Tooltip
                contentStyle={{ borderRadius: 10, borderColor: '#e2d9c1', fontSize: 12 }}
                formatter={(v) => [`${v}`, 'Soil wetness']}
              />
              <Area dataKey="wetness" stroke="#2f7d46" fill="#2f7d4633" strokeWidth={2} />
              <ReferenceLine y={0.5} stroke="#c98a2d" strokeDasharray="4 3" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <TrendCard climate={climate} />
      </div>
    </section>
  )
}

function ChartCard({ title, caption, children }: { title: string; caption: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-card">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        <Chip tone="dark">NASA POWER</Chip>
      </div>
      {children}
      <p className="mt-2 text-[11px] leading-snug text-ink-3">{caption}</p>
    </div>
  )
}

function ThenVsNow({ trend }: { trend?: DailyTrend }) {
  if (!trend) {
    return (
      <div className="relative mb-6 overflow-hidden rounded-2xl border border-slate-100 bg-white p-4 shadow-card">
        <div className="sweep pointer-events-none absolute inset-0 opacity-40" />
        <h3 className="text-sm font-semibold text-ink">Then vs now — what shifted in 10–15 years?</h3>
        <p className="mt-5 mb-6 text-[11px] text-ink-3">Comparing the first and last five years of NASA daily records…</p>
      </div>
    )
  }
  const tn = trend.thenNow
  const fmt = (v: number, digits: number) => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(digits)
  const cell = (
    label: string,
    then: string,
    now: string,
    delta: number,
    digits: number,
    badWhenNegative: boolean,
    unitNote: string,
  ) => {
    const bad = badWhenNegative ? delta < 0 : delta > 0
    const neutral = Math.abs(delta) < (badWhenNegative ? 2 : 0.005)
    const color = neutral ? 'text-ink' : bad ? 'text-clay' : 'text-leaf'
    return (
      <div className="rounded-xl border border-slate-100 bg-white p-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-3">{label}</p>
        <p className="data-tabular mt-1 text-lg font-semibold text-ink">
          {then} <span className="text-ink-3">→</span> {now}
        </p>
        <p className={`data-tabular text-xs font-semibold ${color}`}>
          {fmt(delta, digits)} {unitNote}
        </p>
      </div>
    )
  }
  return (
    <div className="mb-6 rounded-2xl border border-slate-100 bg-white p-4 shadow-card">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-ink">Then vs now — what shifted in the last {tn.yearsSpan} years?</h3>
        <Chip tone="dark">NASA daily records · 5-yr means</Chip>
      </div>
      <div className="grid grid-cols-2 gap-2 @2xl:grid-cols-4">
        {cell(
          'Annual rainfall',
          `${Math.round(trend.annualRain.slice(0, 5).reduce((a, b) => a + b, 0) / 5)} mm`,
          `${Math.round(trend.annualRain.slice(-5).reduce((a, b) => a + b, 0) / 5)} mm`,
          Math.round(tn.rainPct),
          0,
          true,
          '%',
        )}
        {cell(
          'Growing-season soil wetness',
          (trend.growingWetness.slice(0, 5).reduce((a, b) => a + b, 0) / Math.min(5, trend.growingWetness.length)).toFixed(2),
          (trend.growingWetness.slice(-5).reduce((a, b) => a + b, 0) / Math.min(5, trend.growingWetness.length)).toFixed(2),
          tn.wetnessDelta,
          2,
          true,
          '(0–1)',
        )}
        {cell(
          'Days above 32°C / yr',
          `${Math.round(trend.heatDays.slice(0, 5).reduce((a, b) => a + b, 0) / 5)} d`,
          `${Math.round(trend.heatDays.slice(-5).reduce((a, b) => a + b, 0) / 5)} d`,
          Math.round(tn.hotDaysDelta),
          0,
          false,
          'days',
        )}
        {cell(
          'Average day high',
          `${(trend.meanTmax.slice(0, 5).reduce((a, b) => a + b, 0) / 5).toFixed(1)}°C`,
          `${(trend.meanTmax.slice(-5).reduce((a, b) => a + b, 0) / 5).toFixed(1)}°C`,
          tn.tmaxDelta,
          1,
          false,
          '°C',
        )}
      </div>
    </div>
  )
}

function TrendCard({ climate }: { climate: ClimateFeatures }) {
  const [trend, setTrend] = useState(climate.trend)
  useEffect(() => setTrend(climate.trend), [climate.trend])

  if (!trend) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-4 shadow-card">
        <div className="sweep pointer-events-none absolute inset-0 opacity-40" />
        <h3 className="text-sm font-semibold text-ink">15-year trend</h3>
        <p className="mt-6 mb-8 text-[11px] text-ink-3">
          Loading year-by-year rainfall and heat-day history from NASA POWER…
        </p>
      </div>
    )
  }

  const data = trend.years.map((y, i) => ({
    year: String(y),
    rain: Math.round(trend.annualRain[i]),
    heat: trend.heatDays[i],
  }))
  const drying = trend.recentVsHistoricalRain < -0.03
  const wetting = trend.recentVsHistoricalRain > 0.03

  return (
    <ChartCard
      title="Year by year — is it shifting?"
      caption={`Annual rainfall bars + days above 32°C (line), NASA POWER daily data. ${
        drying
          ? `The last 5 years ran ${Math.abs(Math.round(trend.recentVsHistoricalRain * 100))}% drier than the 15-year mean — resilience planning pays here.`
          : wetting
            ? `The last 5 years ran ${Math.round(trend.recentVsHistoricalRain * 100)}% wetter than the mean — but single wet years don't erase dry-season risk.`
            : `Rainfall has been roughly steady — the variability between years is still the story to plan for.`
      }`}
    >
      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={data} margin={{ top: 6, right: 0, left: -18, bottom: 0 }}>
          <CartesianGrid stroke="#e2d9c1" vertical={false} />
          <XAxis dataKey="year" tick={{ fontSize: 9, fill: '#6b7260' }} interval={2} />
          <YAxis yAxisId="l" tick={{ fontSize: 9, fill: '#6b7260' }} />
          <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 9, fill: '#6b7260' }} />
          <Tooltip
            contentStyle={{ borderRadius: 10, borderColor: '#e2d9c1', fontSize: 12 }}
            formatter={(v, n) => [n === 'rain' ? `${v} mm` : `${v} days`, n === 'rain' ? 'Rain' : 'Days >32°C']}
          />
          <Bar yAxisId="l" dataKey="rain" name="rain" fill="#2e6e8e" radius={[2, 2, 0, 0]} maxBarSize={16} />
          <Line yAxisId="r" dataKey="heat" name="heat" stroke="#b4552d" strokeWidth={2} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}
