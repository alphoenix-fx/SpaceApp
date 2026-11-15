import React, { useState } from 'react';
import type { TrendPoint } from '../data/planetaryData';

interface DualTrendChartProps {
  data: TrendPoint[];
  primaryLabel: string;
  primaryUnit: string;
  secondaryLabel: string;
  secondaryUnit: string;
}

export const DualTrendChart: React.FC<DualTrendChartProps> = ({
  data,
  primaryLabel,
  primaryUnit,
  secondaryLabel,
  secondaryUnit,
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const width = 400;
  const height = 148;
  const padLeft = 36;
  const padRight = 38;
  const padTop = 16;
  const padBottom = 26;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const primaryVals = data.map((d) => d.primaryValue);
  const secondaryVals = data.map((d) => d.secondaryValue);

  const pMinRaw = Math.min(...primaryVals);
  const pMaxRaw = Math.max(...primaryVals);
  const pPad = Math.max(0.8, (pMaxRaw - pMinRaw) * 0.2);
  const pMin = pMinRaw - pPad;
  const pMax = pMaxRaw + pPad;

  const sMinRaw = Math.min(...secondaryVals);
  const sMaxRaw = Math.max(...secondaryVals);
  const sPad = Math.max(4, (sMaxRaw - sMinRaw) * 0.2);
  const sMin = sMinRaw - sPad;
  const sMax = sMaxRaw + sPad;

  const getX = (idx: number) =>
    padLeft + (idx / Math.max(1, data.length - 1)) * plotW;

  const getPrimaryY = (val: number) =>
    padTop + plotH - ((val - pMin) / (pMax - pMin || 1)) * plotH;

  const getSecondaryY = (val: number) =>
    padTop + plotH - ((val - sMin) / (sMax - sMin || 1)) * plotH;

  const primaryPath = data
    .map((d, idx) => `${idx === 0 ? 'M' : 'L'} ${getX(idx).toFixed(1)} ${getPrimaryY(d.primaryValue).toFixed(1)}`)
    .join(' ');

  const secondaryPath = data
    .map((d, idx) => `${idx === 0 ? 'M' : 'L'} ${getX(idx).toFixed(1)} ${getSecondaryY(d.secondaryValue).toFixed(1)}`)
    .join(' ');

  const activePoint = hoveredIdx !== null ? data[hoveredIdx] : data[data.length - 1];
  const activeIdx = hoveredIdx !== null ? hoveredIdx : data.length - 1;

  return (
    <div className="w-full">
      {/* Legend & Active Readout */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2 text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-rose-500 inline-block rounded-full" />
            <span className="text-slate-600 font-medium">{primaryLabel}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-blue-600 inline-block rounded-full border-b border-dashed border-blue-600" />
            <span className="text-slate-600 font-medium">{secondaryLabel}</span>
          </div>
        </div>
        <div className="font-mono tabular-nums text-[11px] text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
          {activePoint.year}:{' '}
          <span className="text-rose-600 font-medium">
            {activePoint.primaryValue}
            {primaryUnit}
          </span>{' '}
          <span className="text-slate-400">·</span>{' '}
          <span className="text-blue-600 font-medium">
            {activePoint.secondaryValue}
            {secondaryUnit}
          </span>
        </div>
      </div>

      {/* SVG Dual-Line Chart */}
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto overflow-visible"
        role="img"
        aria-label={`10-year trend chart showing ${primaryLabel} and ${secondaryLabel} from 2016 to 2026`}
        onMouseLeave={() => setHoveredIdx(null)}
      >
        {/* Horizontal Gridlines */}
        {[0, 0.5, 1].map((t) => {
          const y = padTop + t * plotH;
          const pLabel = (pMax - t * (pMax - pMin)).toFixed(1);
          const sLabel = Math.round(sMax - t * (sMax - sMin));
          return (
            <g key={`grid-${t}`}>
              <line
                x1={padLeft}
                y1={y}
                x2={width - padRight}
                y2={y}
                stroke="#E2E8F0"
                strokeWidth="1"
              />
              <text
                x={padLeft - 6}
                y={y + 3}
                textAnchor="end"
                fontSize="9"
                fill="#64748B"
                fontFamily="IBM Plex Mono, monospace"
              >
                {pLabel}
              </text>
              <text
                x={width - padRight + 6}
                y={y + 3}
                textAnchor="start"
                fontSize="9"
                fill="#64748B"
                fontFamily="IBM Plex Mono, monospace"
              >
                {sLabel}
              </text>
            </g>
          );
        })}

        {/* Vertical Hover Crosshair */}
        <line
          x1={getX(activeIdx)}
          y1={padTop}
          x2={getX(activeIdx)}
          y2={padTop + plotH}
          stroke="#CBD5E1"
          strokeWidth="1"
          strokeDasharray="3 3"
        />

        {/* Secondary Series Line (Rainfall / Solar / Illum) */}
        <path
          d={secondaryPath}
          fill="none"
          stroke="#2563EB"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Primary Series Line (Temperature) */}
        <path
          d={primaryPath}
          fill="none"
          stroke="#EF4444"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data Point Markers & Interactive Hover Columns */}
        {data.map((d, idx) => {
          const cx = getX(idx);
          const py = getPrimaryY(d.primaryValue);
          const sy = getSecondaryY(d.secondaryValue);
          const isActive = idx === activeIdx;
          const colWidth = plotW / data.length;

          return (
            <g key={d.year}>
              {/* Year X-Axis Ticks (Show 2016, 2018, 2020, 2022, 2024, 2026) */}
              {idx % 2 === 0 && (
                <text
                  x={cx}
                  y={height - 6}
                  textAnchor="middle"
                  fontSize="9.5"
                  fill={isActive ? '#0F172A' : '#64748B'}
                  fontWeight={isActive ? '600' : '400'}
                  fontFamily="IBM Plex Mono, monospace"
                >
                  {d.year}
                </text>
              )}

              {/* Dots */}
              <circle
                cx={cx}
                cy={sy}
                r={isActive ? 3.8 : 2.2}
                fill="#FFFFFF"
                stroke="#2563EB"
                strokeWidth={isActive ? 2 : 1.5}
              />
              <circle
                cx={cx}
                cy={py}
                r={isActive ? 4 : 2.4}
                fill="#FFFFFF"
                stroke="#EF4444"
                strokeWidth={isActive ? 2.2 : 1.6}
              />

              {/* Invisible Hit Column for Smooth Snapping */}
              <rect
                x={cx - colWidth / 2}
                y={padTop}
                width={colWidth}
                height={plotH + 18}
                fill="transparent"
                className="cursor-pointer"
                onMouseEnter={() => setHoveredIdx(idx)}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
};
