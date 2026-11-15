import React from 'react';
import {
  Droplets,
  Thermometer,
  CloudRain,
  Mountain,
  Snowflake,
  Sun,
  ArrowRight,
  ChevronDown,
  MessageSquareText,
  AlertTriangle,
  CheckCircle2,
  MapPin,
  Loader2,
  RefreshCw,
  Target,
} from 'lucide-react';
import type { CropProfile, PlanetarySite, TelemetryMetric } from '../data/planetaryData';
import { getCropIdealComparisons } from '../services/nasaPowerApi';
import type { NasaPowerSummary } from '../services/nasaPowerApi';
import { DualTrendChart } from './DualTrendChart';

interface DiagnosticDrawerProps {
  site: PlanetarySite;
  selectedOptionName: string;
  onOptionChange: (optionName: string) => void;
  onOpenSmsModal: () => void;
  isLoadingTelemetry?: boolean;
  telemetryError?: string | null;
  onRetryTelemetry?: () => void;
  nasaPowerSummary?: NasaPowerSummary | null;
}

export const DiagnosticDrawer: React.FC<DiagnosticDrawerProps> = ({
  site,
  selectedOptionName,
  onOptionChange,
  onOpenSmsModal,
  isLoadingTelemetry = false,
  telemetryError = null,
  onRetryTelemetry,
  nasaPowerSummary = null,
}) => {
  const profile: CropProfile =
    site.options[selectedOptionName] || site.options[site.defaultOption];

  const optionNames = Object.keys(site.options);
  const cropIdealMap =
    site.planet === 'earth'
      ? getCropIdealComparisons(profile.name, nasaPowerSummary)
      : {};

  const offworldIdealMap: Record<string, string> =
    site.planet === 'mars'
      ? {
          'mars-slope': '≤ 3.0° flat',
          'mars-ice': '≤ 2.0m shallow',
          'mars-solar': 'High (≥ 500 W/m²)',
        }
      : site.planet === 'moon'
        ? {
            'moon-slope': '≤ 5.0° stable',
            'moon-ice': '≤ 2.0 km haul',
            'moon-solar': '≥ 80% continuous',
          }
        : {};

  // Circular Progress Gauge Math
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const dashOffset =
    circumference - (Math.max(0, Math.min(100, profile.suitabilityIndex)) / 100) * circumference;

  const gaugeColors =
    profile.verdictTone === 'coral'
      ? {
          stroke: '#F43F5E',
          track: '#FFE4E6',
          text: 'text-rose-600',
          badgeBg: 'bg-rose-50 text-rose-700 border-rose-200',
        }
      : profile.verdictTone === 'amber'
        ? {
            stroke: '#D97706',
            track: '#FEF3C7',
            text: 'text-amber-600',
            badgeBg: 'bg-amber-50 text-amber-700 border-amber-200',
          }
        : {
            stroke: '#10B981',
            track: '#D1FAE5',
            text: 'text-emerald-600',
            badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          };

  const renderMetricIcon = (icon: TelemetryMetric['icon'], tone: TelemetryMetric['tone']) => {
    const colorClass =
      tone === 'coral'
        ? 'text-rose-500'
        : tone === 'amber'
          ? 'text-amber-500'
          : tone === 'cyan'
            ? 'text-cyan-600'
            : 'text-emerald-600';

    switch (icon) {
      case 'droplets':
        return <Droplets className={`w-4 h-4 shrink-0 ${colorClass}`} />;
      case 'thermometer':
        return <Thermometer className={`w-4 h-4 shrink-0 ${colorClass}`} />;
      case 'rain':
        return <CloudRain className={`w-4 h-4 shrink-0 ${colorClass}`} />;
      case 'slope':
        return <Mountain className={`w-4 h-4 shrink-0 ${colorClass}`} />;
      case 'ice':
        return <Snowflake className={`w-4 h-4 shrink-0 ${colorClass}`} />;
      case 'sun':
        return <Sun className={`w-4 h-4 shrink-0 ${colorClass}`} />;
    }
  };

  const getBarFillClass = (tone: TelemetryMetric['tone']) => {
    switch (tone) {
      case 'coral':
        return 'bg-rose-500';
      case 'amber':
        return 'bg-amber-500';
      case 'cyan':
        return 'bg-cyan-500';
      case 'emerald':
        return 'bg-emerald-500';
    }
  };

  return (
    <aside
      aria-label="Diagnostic Drawer"
      className="w-full h-full bg-[#F4F6F5] flex flex-col min-h-0"
    >
      {/* Selected Site Context Strip */}
      <div className="px-5 py-3.5 bg-white border-b border-slate-100 space-y-1 shrink-0">
        <div className="flex items-start gap-1.5 text-base font-bold text-slate-900 min-w-0">
          <MapPin className="w-4 h-4 text-[#16A34A] shrink-0 mt-1" />
          <span className="line-clamp-2 leading-snug" title={site.name}>
            {site.name}
          </span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <span className="font-mono tabular-nums text-slate-700 font-medium">
            {site.coordinates}
          </span>
          <span className="truncate">
            {nasaPowerSummary?.elevationMeters !== null &&
            nasaPowerSummary?.elevationMeters !== undefined
              ? `${nasaPowerSummary.elevationMeters}m elevation`
              : site.region}
          </span>
        </div>
      </div>

      {/* Scrollable Diagnostic Cards */}
      <div className="flex-1 overflow-y-auto drawer-scroll p-4 space-y-3.5">
        {/* Live NASA POWER Loading / Error Banner */}
        {isLoadingTelemetry && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-2.5 flex items-center gap-2.5 text-xs font-medium text-[#15803D]">
            <Loader2 className="w-4 h-4 animate-spin shrink-0 text-[#16A34A]" />
            <span>Loading live NASA weather &amp; soil data...</span>
          </div>
        )}

        {telemetryError && !isLoadingTelemetry && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl px-4 py-2.5 flex items-center justify-between gap-2 text-xs text-rose-700">
            <span className="truncate">{telemetryError}</span>
            {onRetryTelemetry && (
              <button
                type="button"
                onClick={onRetryTelemetry}
                className="inline-flex items-center gap-1 font-semibold text-rose-800 hover:underline shrink-0 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry</span>
              </button>
            )}
          </div>
        )}

        {/* Card 1: Top Verdict */}
        <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3.5">
          <div className="flex items-center justify-between gap-3">
            <label
              htmlFor="crop-selector"
              className="text-xs font-semibold text-slate-700 whitespace-nowrap"
            >
              {site.optionLabel}
            </label>
            <div className="relative min-w-[165px]">
              <select
                id="crop-selector"
                value={profile.name}
                onChange={(e) => onOptionChange(e.target.value)}
                className="w-full appearance-none bg-[#F4F6F5] hover:bg-slate-100 border border-slate-200 rounded-xl pl-3 pr-8 py-1.5 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1DB954] focus:border-[#1DB954] transition-colors cursor-pointer"
              >
                {optionNames.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          <div className="flex items-center gap-4 pt-1">
            {/* Large Circular Progress Gauge */}
            <div className="relative w-24 h-24 shrink-0 flex items-center justify-center">
              <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r={radius}
                  fill="none"
                  stroke={gaugeColors.track}
                  strokeWidth="9"
                />
                <circle
                  cx="50"
                  cy="50"
                  r={radius}
                  fill="none"
                  stroke={gaugeColors.stroke}
                  strokeWidth="9"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={dashOffset}
                  className="transition-all duration-300 ease-out"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-xl font-bold font-mono tabular-nums ${gaugeColors.text}`}>
                  {profile.suitabilityIndex}%
                </span>
              </div>
            </div>

            {/* Verdict Label & 1-Sentence Summary */}
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="text-xs font-medium text-slate-500">
                {site.suitabilityTitle}
              </div>
              <div className={`text-sm font-semibold leading-snug flex items-start gap-1.5 ${gaugeColors.text}`}>
                {profile.verdictTone === 'emerald' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                )}
                <span>
                  {site.suitabilityTitle}: {profile.suitabilityIndex}%{' '}
                  {profile.verdictTone === 'emerald' && site.planet === 'mars'
                    ? profile.verdictLabel
                    : `— ${profile.verdictLabel}`}
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                {profile.summary}
              </p>
            </div>
          </div>
        </div>

        {/* Card 2: Simple Live NASA Conditions vs Ideal Crop Targets */}
        <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3.5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xs font-semibold text-slate-900">
              Live NASA Conditions
            </h2>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-[11px] font-semibold text-[#15803D]">
              <Target className="w-3 h-3 shrink-0" />
              <span>vs. {profile.name} Ideal</span>
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {site.telemetry.map((metric) => {
              const ideal = cropIdealMap[metric.id];
              const offworldIdeal = offworldIdealMap[metric.id];
              const liveShort = metric.valueLabel.split(' - ')[0];
              const statusText = ideal
                ? ideal.deltaLabel
                : metric.valueLabel.split(' - ')[1] || '';

              const statusBadgeClass = ideal
                ? ideal.inIdealRange
                  ? 'bg-emerald-50 text-[#15803D]'
                  : metric.tone === 'coral'
                    ? 'bg-rose-50 text-rose-700'
                    : 'bg-amber-50 text-amber-700'
                : metric.tone === 'coral'
                  ? 'bg-rose-50 text-rose-700'
                  : metric.tone === 'amber'
                    ? 'bg-amber-50 text-amber-700'
                    : 'bg-emerald-50 text-[#15803D]';

              return (
                <div key={metric.id} className="py-2.5 first:pt-0 last:pb-0 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 min-w-0">
                      {renderMetricIcon(metric.icon, metric.tone)}
                      <span className="truncate">{metric.label}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono tabular-nums text-xs font-bold text-slate-900">
                        {liveShort}
                      </span>
                      {statusText && (
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap ${statusBadgeClass}`}
                        >
                          {statusText}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${getBarFillClass(metric.tone)}`}
                      style={{ width: `${Math.max(4, Math.min(100, metric.progress))}%` }}
                    />
                  </div>

                  {(ideal || offworldIdeal) && (
                    <div className="text-[11px] text-slate-500">
                      Ideal for {profile.name}:{' '}
                      <span className="font-mono tabular-nums font-semibold text-slate-700">
                        {ideal ? ideal.idealRangeLabel : offworldIdeal}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Card 3: Field Shift & Rotation */}
        <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3.5">
          <div className="space-y-2">
            <h2 className="text-xs font-semibold text-slate-900">
              {site.alternativesHeading}
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {site.alternatives.map((alt) => {
                const isSelectable = Boolean(site.options[alt.name]);
                const isSelected = profile.name === alt.name;
                return (
                  <button
                    key={alt.name}
                    type="button"
                    disabled={!isSelectable}
                    onClick={() => {
                      if (isSelectable) onOptionChange(alt.name);
                    }}
                    className={`flex flex-col items-start justify-between p-2.5 rounded-xl border text-left transition-colors ${
                      isSelectable ? 'cursor-pointer' : 'cursor-default'
                    } ${
                      isSelected
                        ? 'bg-emerald-50 border-[#16A34A] ring-1 ring-[#16A34A]'
                        : 'bg-[#F4F6F5] border-transparent hover:bg-emerald-50/70'
                    }`}
                  >
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#16A34A] text-white text-[11px] font-semibold font-mono tabular-nums">
                      {alt.name} ({alt.matchPercent}% Match)
                    </span>
                    <span className="text-[11px] text-slate-600 mt-1.5 font-medium">
                      {alt.note}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-2.5 border-t border-slate-100 space-y-2">
            <div className="text-xs font-medium text-slate-600">
              {site.rotationHeading}
            </div>
            <div className="flex items-center justify-between gap-2 p-2 rounded-full bg-[#F4F6F5]">
              <span className="px-3 py-1 rounded-full bg-white text-[11px] font-semibold text-slate-800 truncate shadow-2xs">
                {site.rotationSteps[0]}
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-[#16A34A] shrink-0" />
              <span className="px-3 py-1 rounded-full bg-[#16A34A] text-white text-[11px] font-semibold truncate">
                {site.rotationSteps[1]}
              </span>
            </div>
          </div>
        </div>

        {/* Card 4: 10-Year Trend */}
        <div className="bg-white rounded-2xl shadow-sm p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-slate-900">
              {site.trendTitle}
            </h2>
            <span className="text-[11px] text-slate-400">Hover to inspect</span>
          </div>
          <DualTrendChart
            data={site.trend}
            primaryLabel={site.primarySeriesLabel}
            primaryUnit={site.primarySeriesUnit}
            secondaryLabel={site.secondarySeriesLabel}
            secondaryUnit={site.secondarySeriesUnit}
          />
        </div>
      </div>

      {/* Bottom Action */}
      <div className="p-4 bg-white border-t border-slate-100 shrink-0">
        <button
          type="button"
          onClick={onOpenSmsModal}
          className="w-full py-3 px-4 rounded-xl bg-[#1DB954] hover:bg-[#16A34A] active:bg-[#15803D] text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1DB954] focus-visible:ring-offset-2"
        >
          <MessageSquareText className="w-4 h-4 text-white shrink-0" />
          <span>Export Simple Farm Report</span>
        </button>
      </div>
    </aside>
  );
};
