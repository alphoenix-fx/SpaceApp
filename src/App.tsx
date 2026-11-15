import { useState, useMemo, useEffect, useCallback } from 'react';
import { PLANETARY_SITES } from './data/planetaryData';
import type {
  BenchmarkFarm,
  MapLayerId,
  PlanetaryMode,
  PlanetarySite,
} from './data/planetaryData';
import { buildEarthTelemetryFromPower, fetchNasaPowerTelemetry } from './services/nasaPowerApi';
import type { NasaPowerSummary } from './services/nasaPowerApi';
import { reverseGeocodeCoordinate } from './services/reverseGeocode';
import type { ReverseGeocodeResult } from './services/reverseGeocode';
import type { OverpassFarmPin } from './services/overpassFarms';
import { TopNavBar } from './components/TopNavBar';
import { SatelliteMapPanel } from './components/SatelliteMapPanel';
import { DiagnosticDrawer } from './components/DiagnosticDrawer';
import { SmsReportModal } from './components/SmsReportModal';
import { FieldShiftAddon } from './components/FieldShiftAddon';
import { Leaf, ScanLine } from 'lucide-react';

type SidePanel = 'console' | 'analysis';

export default function App() {
  const [mode, setMode] = useState<PlanetaryMode>('earth');
  const [sidePanel, setSidePanel] = useState<SidePanel>('console');

  const modeSites = useMemo(
    () => PLANETARY_SITES.filter((s) => s.planet === mode),
    [mode]
  );

  const [selectedSiteByMode, setSelectedSiteByMode] = useState<
    Record<PlanetaryMode, string>
  >({
    earth: 'earth-rift-a07',
    mars: 'mars-arcadia-ap01',
    moon: 'moon-shackleton-sp01',
  });

  const [activeEarthCrop, setActiveEarthCrop] = useState<string>('Wheat');

  const [selectedOptionBySite, setSelectedOptionBySite] = useState<
    Record<string, string>
  >({
    'custom--33.8500,18.9200': 'Wheat',
  });

  const [activeLayers, setActiveLayers] = useState<Record<MapLayerId, boolean>>({
    layer_a: true,
    layer_b: false,
    layer_c: false,
  });

  /** Analysis footprint around the pinned field — user adjustable (0.5–50 km). */
  const [catchmentRadius, setCatchmentRadius] = useState(2500);

  /** Vertical-farming suitability mask (Mars / Moon). */
  const [verticalFarming, setVerticalFarming] = useState(false);

  const [customCoordinate, setCustomCoordinate] = useState<{
    lat: number;
    lon: number;
    zoomTo?: number;
    flyKey?: number;
    customTitle?: string;
  } | null>({
    lat: -33.85,
    lon: 18.92,
  });

  const [isSmsModalOpen, setIsSmsModalOpen] = useState(false);

  // Live NASA POWER Telemetry & Reverse Geocode State (Earth Mode)
  const [powerCache, setPowerCache] = useState<Record<string, NasaPowerSummary>>({});
  const [geocodeCache, setGeocodeCache] = useState<Record<string, ReverseGeocodeResult>>({});
  const [isLoadingTelemetry, setIsLoadingTelemetry] = useState(false);
  const [telemetryError, setTelemetryError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  const baseSite = useMemo(() => {
    const targetId = selectedSiteByMode[mode];
    return modeSites.find((s) => s.id === targetId) || modeSites[0];
  }, [mode, modeSites, selectedSiteByMode]);

  const activeLat =
    mode === 'earth' && customCoordinate ? customCoordinate.lat : baseSite.lat;
  const activeLon =
    mode === 'earth' && customCoordinate ? customCoordinate.lon : baseSite.lon;

  const coordCacheKey = `${activeLat.toFixed(4)},${activeLon.toFixed(4)}`;
  const activePowerSummary = mode === 'earth' ? powerCache[coordCacheKey] || null : null;
  const activeGeocode = mode === 'earth' ? geocodeCache[coordCacheKey] || null : null;

  useEffect(() => {
    if (mode !== 'earth') {
      setIsLoadingTelemetry(false);
      setTelemetryError(null);
      return;
    }

    const controller = new AbortController();

    if (!geocodeCache[coordCacheKey]) {
      reverseGeocodeCoordinate(activeLat, activeLon, controller.signal)
        .then((geo) => {
          if (geo) {
            setGeocodeCache((prev) => ({
              ...prev,
              [coordCacheKey]: geo,
            }));
          }
        })
        .catch(() => {
          // Non-fatal: fallback to coordinate display if offline or rate-limited
        });
    }

    if (powerCache[coordCacheKey]) {
      setIsLoadingTelemetry(false);
      setTelemetryError(null);
      return () => controller.abort();
    }

    setIsLoadingTelemetry(true);
    setTelemetryError(null);

    fetchNasaPowerTelemetry(activeLat, activeLon, controller.signal)
      .then((summary) => {
        setPowerCache((prev) => ({
          ...prev,
          [coordCacheKey]: summary,
        }));
        setIsLoadingTelemetry(false);
      })
      .catch((err: unknown) => {
        if ((err as { name?: string })?.name === 'AbortError') return;
        const msg =
          err instanceof Error
            ? err.message
            : 'Unable to fetch live NASA POWER telemetry.';
        setTelemetryError(msg);
        setIsLoadingTelemetry(false);
      });

    return () => controller.abort();
  }, [mode, activeLat, activeLon, coordCacheKey, powerCache, geocodeCache, retryToken]);

  const activeSiteKey =
    mode === 'earth' && customCoordinate ? `custom-${coordCacheKey}` : baseSite.id;

  const selectedOptionName =
    selectedOptionBySite[activeSiteKey] ||
    (mode === 'earth' ? activeEarthCrop : baseSite.defaultOption);

  // Build live Earth PlanetarySite view fed by NASA POWER data
  const effectiveSite: PlanetarySite = useMemo(() => {
    if (mode !== 'earth') return baseSite;

    const coordLabel = `${Math.abs(activeLat).toFixed(2)}°${
      activeLat >= 0 ? 'N' : 'S'
    }, ${Math.abs(activeLon).toFixed(2)}°${activeLon >= 0 ? 'E' : 'W'}`;

    const resolvedCustomTitle =
      customCoordinate?.customTitle ||
      activeGeocode?.displayTitle ||
      `Selected Catchment (${coordLabel})`;

    const siteHeader = customCoordinate
      ? {
          ...baseSite,
          id: activeSiteKey,
          name: resolvedCustomTitle,
          region: customCoordinate.customTitle
            ? 'Verified 5km Catchment · NASA POWER'
            : activeGeocode?.principalSubdivision
              ? `5km Catchment · ${activeGeocode.principalSubdivision}`
              : '5km Catchment · Live NASA POWER',
          coordinates: coordLabel,
          lat: activeLat,
          lon: activeLon,
          options: baseSite.options.Rice
            ? baseSite.options
            : {
                ...baseSite.options,
                Rice: {
                  name: 'Rice',
                  suitabilityIndex: 72,
                  verdictLabel: 'Syncing Live Telemetry...',
                  verdictTone: 'emerald' as const,
                  summary:
                    'Evaluating seasonal rainfall, root-zone moisture, and mean temperature for paddy Rice cultivation.',
                },
              },
        }
      : {
          ...baseSite,
          name: activeGeocode?.displayTitle
            ? `${baseSite.name} · ${activeGeocode.displayTitle}`
            : baseSite.name,
        };

    if (!activePowerSummary) return siteHeader;

    const computed = buildEarthTelemetryFromPower(
      activePowerSummary,
      selectedOptionName
    );

    return {
      ...siteHeader,
      options: computed.options,
      telemetry: computed.telemetry,
      alternatives: computed.alternatives,
      rotationSteps: computed.rotationSteps,
      trend: computed.trend,
    };
  }, [
    mode,
    baseSite,
    customCoordinate,
    activeLat,
    activeLon,
    activeSiteKey,
    activePowerSummary,
    activeGeocode,
    selectedOptionName,
  ]);

  // Also enrich Earth map polygons when cached NASA POWER data exists for a site
  const enrichedModeSites = useMemo(() => {
    if (mode !== 'earth') return modeSites;
    return modeSites.map((site) => {
      const key = `${site.lat.toFixed(4)},${site.lon.toFixed(4)}`;
      const cached = powerCache[key];
      if (!cached) return site;
      const crop = selectedOptionBySite[site.id] || site.defaultOption;
      const computed = buildEarthTelemetryFromPower(cached, crop);
      return {
        ...site,
        options: computed.options,
        telemetry: computed.telemetry,
        alternatives: computed.alternatives,
        rotationSteps: computed.rotationSteps,
        trend: computed.trend,
      };
    });
  }, [mode, modeSites, powerCache, selectedOptionBySite]);

  const activeProfile =
    effectiveSite.options[selectedOptionName] ||
    effectiveSite.options[effectiveSite.defaultOption];

  const handleModeChange = (nextMode: PlanetaryMode) => {
    setMode(nextMode);
    setVerticalFarming(false);
    if (nextMode === 'earth') {
      setCustomCoordinate({ lat: -33.85, lon: 18.92 });
    } else if (nextMode === 'mars') {
      setCustomCoordinate(null);
      setSelectedSiteByMode((prev) => ({ ...prev, mars: 'mars-arcadia-ap01' }));
    } else if (nextMode === 'moon') {
      setCustomCoordinate(null);
      setSelectedSiteByMode((prev) => ({ ...prev, moon: 'moon-shackleton-sp01' }));
    }
  };

  const handleSelectSite = (site: PlanetarySite) => {
    setSelectedSiteByMode((prev) => ({
      ...prev,
      [site.planet]: site.id,
    }));
    setCustomCoordinate(null);
  };

  const handleSelectSiteFromSearch = (site: PlanetarySite) => {
    setMode(site.planet);
    setSelectedSiteByMode((prev) => ({
      ...prev,
      [site.planet]: site.id,
    }));
    setCustomCoordinate(null);
  };

  const handleCoordinateJump = (lat: number, lon: number) => {
    let closest = modeSites[0];
    let bestDist = Infinity;
    for (const s of modeSites) {
      const dist = Math.hypot(s.lat - lat, s.lon - lon);
      if (dist < bestDist) {
        bestDist = dist;
        closest = s;
      }
    }
    setSelectedSiteByMode((prev) => ({
      ...prev,
      [mode]: closest.id,
    }));
    setCustomCoordinate({ lat, lon, zoomTo: mode === 'earth' ? 8 : undefined, flyKey: Date.now() });
  };

  const handleGlobalLocationSearch = useCallback(
    (lat: number, lon: number, displayName: string) => {
      setMode('earth');
      setCustomCoordinate({
        lat,
        lon,
        zoomTo: 8,
        flyKey: Date.now(),
        customTitle: displayName,
      });
    },
    []
  );

  const handleMapCoordinateClick = useCallback(
    (lat: number, lon: number) => {
      if (mode !== 'earth') return;
      setCustomCoordinate({ lat, lon });
    },
    [mode]
  );

  const handleSelectBenchmarkFarm = useCallback((farm: BenchmarkFarm) => {
    setMode('earth');
    setActiveEarthCrop(farm.defaultCrop);
    const key = `custom-${farm.lat.toFixed(4)},${farm.lon.toFixed(4)}`;
    setSelectedOptionBySite((prev) => ({
      ...prev,
      [key]: farm.defaultCrop,
    }));
    setCustomCoordinate({
      lat: farm.lat,
      lon: farm.lon,
      zoomTo: 10,
      flyKey: Date.now(),
      customTitle: farm.name,
    });
  }, []);

  const handleSelectLocalFarmPin = useCallback((farm: OverpassFarmPin) => {
    setMode('earth');
    const key = `custom-${farm.lat.toFixed(4)},${farm.lon.toFixed(4)}`;
    const normalizedCrop = farm.cropTag
      ? ['Maize', 'Sorghum', 'Cowpeas', 'Millet', 'Wheat', 'Rice'].find(
          (c) => c.toLowerCase() === farm.cropTag?.toLowerCase()
        )
      : undefined;

    if (normalizedCrop) {
      setActiveEarthCrop(normalizedCrop);
      setSelectedOptionBySite((prev) => ({
        ...prev,
        [key]: normalizedCrop,
      }));
    }

    setCustomCoordinate({
      lat: farm.lat,
      lon: farm.lon,
      customTitle: farm.name,
    });
  }, []);

  const handleOptionChange = (optionName: string) => {
    if (mode === 'earth') {
      setActiveEarthCrop(optionName);
    }
    setSelectedOptionBySite((prev) => ({
      ...prev,
      [activeSiteKey]: optionName,
    }));
  };

  // Only one telemetry footprint layer at a time — stacking them turns the map
  // into a wall of overlapping catchments.
  const handleToggleLayer = (layerId: MapLayerId) => {
    setActiveLayers((prev) => {
      const isOn = prev[layerId]
      const next: Record<MapLayerId, boolean> = { layer_a: false, layer_b: false, layer_c: false }
      next[layerId] = !isOn
      return next
    })
  };

  return (
    <div className="min-h-screen lg:h-screen flex flex-col bg-[#F4F6F5] text-slate-900 overflow-x-hidden lg:overflow-hidden">
      <TopNavBar
        mode={mode}
        onModeChange={handleModeChange}
        sites={PLANETARY_SITES}
        onSelectSiteFromSearch={handleSelectSiteFromSearch}
        onCoordinateJump={handleCoordinateJump}
        onGlobalLocationSearch={handleGlobalLocationSearch}
      />

      <main className="flex-1 flex flex-col lg:flex-row min-h-0">
        <SatelliteMapPanel
          mode={mode}
          sites={enrichedModeSites}
          selectedSite={effectiveSite}
          selectedOptionName={selectedOptionName}
          onSelectSite={handleSelectSite}
          activeLayers={activeLayers}
          onToggleLayer={handleToggleLayer}
          customCoordinate={customCoordinate}
          customLocationName={
            customCoordinate?.customTitle || activeGeocode?.displayTitle || null
          }
          onMapCoordinateClick={handleMapCoordinateClick}
          onSelectBenchmarkFarm={handleSelectBenchmarkFarm}
          onSelectLocalFarmPin={handleSelectLocalFarmPin}
          isLoadingTelemetry={isLoadingTelemetry}
          catchmentRadiusMeters={catchmentRadius}
          onCatchmentRadiusChange={setCatchmentRadius}
          verticalFarming={verticalFarming}
          onToggleVerticalFarming={() => setVerticalFarming((v) => !v)}
        />

        {/* Right column: the live console, with the FieldShift engine as an add-on tab */}
        <div
          className={`w-full flex flex-col min-h-0 bg-[#F4F6F5] lg:border-l border-slate-200 transition-[width] duration-300 ${
            sidePanel === 'analysis' ? 'lg:w-[52%]' : 'lg:w-[35%]'
          }`}
        >
          <div
            role="tablist"
            aria-label="Side panel"
            className="shrink-0 bg-white border-b border-slate-100 px-3 py-2 flex items-center gap-1.5"
          >
            <button
              type="button"
              role="tab"
              aria-selected={sidePanel === 'console'}
              onClick={() => setSidePanel('console')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                sidePanel === 'console'
                  ? 'bg-[#16A34A] text-white'
                  : 'text-slate-600 hover:bg-emerald-50 hover:text-[#15803D]'
              }`}
            >
              <ScanLine className="w-3.5 h-3.5 shrink-0" />
              <span>Live Console</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={sidePanel === 'analysis'}
              onClick={() => setSidePanel('analysis')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                sidePanel === 'analysis'
                  ? 'bg-[#16A34A] text-white'
                  : 'text-slate-600 hover:bg-emerald-50 hover:text-[#15803D]'
              }`}
            >
              <Leaf className="w-3.5 h-3.5 shrink-0" />
              <span>FieldShift Engine</span>
            </button>
          </div>

          {sidePanel === 'console' ? (
            <DiagnosticDrawer
              site={effectiveSite}
              selectedOptionName={selectedOptionName}
              onOptionChange={handleOptionChange}
              onOpenSmsModal={() => setIsSmsModalOpen(true)}
              isLoadingTelemetry={isLoadingTelemetry}
              telemetryError={telemetryError}
              onRetryTelemetry={() => setRetryToken((t) => t + 1)}
              nasaPowerSummary={activePowerSummary}
            />
          ) : (
            <FieldShiftAddon
              lat={activeLat}
              lon={activeLon}
              placeName={activeGeocode?.displayTitle ?? null}
              onPick={handleMapCoordinateClick}
            />
          )}
        </div>
      </main>

      <SmsReportModal
        isOpen={isSmsModalOpen}
        onClose={() => setIsSmsModalOpen(false)}
        site={effectiveSite}
        profile={activeProfile}
        nasaPowerSummary={activePowerSummary}
      />
    </div>
  );
}
