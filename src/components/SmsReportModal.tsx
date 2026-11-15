import React, { useState } from 'react';
import { X, Copy, Check, Download, FileText } from 'lucide-react';
import type { CropProfile, PlanetarySite } from '../data/planetaryData';
import { getCropIdealComparisons } from '../services/nasaPowerApi';
import type { NasaPowerSummary } from '../services/nasaPowerApi';

interface SmsReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  site: PlanetarySite;
  profile: CropProfile;
  nasaPowerSummary?: NasaPowerSummary | null;
}

export const SmsReportModal: React.FC<SmsReportModalProps> = ({
  isOpen,
  onClose,
  site,
  profile,
  nasaPowerSummary = null,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const alt1 = site.alternatives[0];
  const alt2 = site.alternatives[1];
  const idealMap =
    site.planet === 'earth'
      ? getCropIdealComparisons(profile.name, nasaPowerSummary)
      : {};

  const conditionLines = site.telemetry.map((m) => {
    const liveVal = m.valueLabel.split(' - ')[0];
    const ideal = idealMap[m.id];
    return ideal
      ? `- ${m.label}: ${liveVal} (Ideal for ${profile.name}: ${ideal.idealRangeLabel})`
      : `- ${m.label}: ${m.valueLabel}`;
  });

  const simpleReportText = [
    `Farm Report: ${site.name} (${site.coordinates})`,
    `${site.optionLabel}: ${profile.name} — ${profile.suitabilityIndex}% (${profile.verdictLabel})`,
    '',
    'Live NASA Conditions vs. Ideal:',
    ...conditionLines,
    '',
    `Best Alternatives: ${alt1.name} (${alt1.matchPercent}%), ${alt2.name} (${alt2.matchPercent}%)`,
    `Rotation Plan: ${site.rotationSteps[0]} -> ${site.rotationSteps[1]}`,
  ].join('\n');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(simpleReportText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([simpleReportText + '\n'], {
      type: 'text/plain;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `farm-report-${site.id}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const scoreToneClass =
    profile.verdictTone === 'coral'
      ? 'text-rose-600 bg-rose-50'
      : profile.verdictTone === 'amber'
        ? 'text-amber-700 bg-amber-50'
        : 'text-[#15803D] bg-emerald-50';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="simple-report-title"
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        <div className="bg-[#16A34A] px-5 py-4 flex items-center justify-between gap-4 text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center">
              <FileText className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 id="simple-report-title" className="text-sm font-bold text-white">
                Simple Farm Report
              </h2>
              <p className="text-xs text-emerald-100">
                Ready to share via SMS, WhatsApp, or download
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close report dialog"
            className="w-8 h-8 rounded-full text-white/85 hover:text-white hover:bg-white/15 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Plain-Language Summary Card */}
          <div className="rounded-xl bg-[#F4F6F5] p-3.5 space-y-2.5 text-xs">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[11px] text-slate-500">Location</div>
                <div className="font-semibold text-slate-900 truncate">{site.name}</div>
              </div>
              <span className={`px-2.5 py-1 rounded-full font-bold shrink-0 ${scoreToneClass}`}>
                {profile.name}: {profile.suitabilityIndex}%
              </span>
            </div>

            <div className="pt-2 border-t border-slate-200/70 space-y-1.5">
              <div className="text-[11px] font-semibold text-slate-600">
                Live Conditions vs. {profile.name} Ideal
              </div>
              {site.telemetry.map((m) => {
                const liveVal = m.valueLabel.split(' - ')[0];
                const ideal = idealMap[m.id];
                return (
                  <div key={m.id} className="flex items-center justify-between gap-2">
                    <span className="text-slate-600">{m.label}</span>
                    <span className="font-mono tabular-nums font-semibold text-slate-900">
                      {liveVal}
                      {ideal && (
                        <span className="text-slate-500 font-normal">
                          {' '}
                          (Ideal {ideal.idealRangeLabel})
                        </span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="pt-2 border-t border-slate-200/70">
              <span className="text-slate-500">Recommended Plan: </span>
              <span className="font-semibold text-slate-900">
                {site.rotationSteps[0]} → {site.rotationSteps[1]}
              </span>
            </div>
          </div>

          {/* Copyable Plain-Text Summary */}
          <pre className="p-3 rounded-xl bg-slate-900 text-slate-100 font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-words max-h-40 overflow-y-auto">
            {simpleReportText}
          </pre>

          <div className="flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download .txt</span>
            </button>
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#1DB954] hover:bg-[#16A34A] text-xs font-bold text-white shadow-sm transition-colors cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-white" />
                  <span>Copied Report</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Report</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
