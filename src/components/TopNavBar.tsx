import React, { useState, useRef, useEffect } from 'react';
import { Search, Globe2, Orbit, Moon, X, Sprout, Loader2, MapPin } from 'lucide-react';
import type { PlanetaryMode, PlanetarySite } from '../data/planetaryData';
import { searchGlobalLocation } from '../services/reverseGeocode';

interface TopNavBarProps {
  mode: PlanetaryMode;
  onModeChange: (mode: PlanetaryMode) => void;
  sites: PlanetarySite[];
  onSelectSiteFromSearch: (site: PlanetarySite) => void;
  onCoordinateJump: (lat: number, lon: number) => void;
  onGlobalLocationSearch: (lat: number, lon: number, displayName: string) => void;
}

export const TopNavBar: React.FC<TopNavBarProps> = ({
  mode,
  onModeChange,
  sites,
  onSelectSiteFromSearch,
  onCoordinateJump,
  onGlobalLocationSearch,
}) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      abortRef.current?.abort();
    };
  }, []);

  const trimmed = query.trim().toLowerCase();

  const matchingSites = trimmed
    ? sites.filter(
        (site) =>
          site.name.toLowerCase().includes(trimmed) ||
          site.region.toLowerCase().includes(trimmed) ||
          site.coordinates.toLowerCase().includes(trimmed) ||
          site.planet.toLowerCase().includes(trimmed)
      )
    : sites;

  const parseCoordinates = (input: string): { lat: number; lon: number } | null => {
    const match = input.match(/^\s*(-?\d+(?:\.\d+)?)\s*[,\s]\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (!match) return null;
    const lat = parseFloat(match[1]);
    const lon = parseFloat(match[2]);
    if (Number.isNaN(lat) || Number.isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return null;
    }
    return { lat, lon };
  };

  const parsedCoord = parseCoordinates(query);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawQuery = query.trim();
    if (!rawQuery) return;

    setSearchError(null);

    if (parsedCoord) {
      onCoordinateJump(parsedCoord.lat, parsedCoord.lon);
      setIsOpen(false);
      return;
    }

    // Preserve quick jump for off-world preset sectors (Mars / Moon)
    const offWorldMatch = sites.find(
      (s) =>
        s.planet !== 'earth' &&
        (s.name.toLowerCase().includes(trimmed) || s.region.toLowerCase().includes(trimmed))
    );
    if (offWorldMatch && mode !== 'earth') {
      onSelectSiteFromSearch(offWorldMatch);
      setQuery(offWorldMatch.name);
      setIsOpen(false);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setIsSearching(true);

    try {
      const result = await searchGlobalLocation(rawQuery, controller.signal);
      if (controller.signal.aborted) return;

      if (!result) {
        setSearchError(`No location found for "${rawQuery}". Try another town, province, or lat, lon.`);
        setIsOpen(true);
        setIsSearching(false);
        return;
      }

      onGlobalLocationSearch(result.lat, result.lon, result.displayName);
      setIsOpen(false);
      setSearchError(null);
      setIsSearching(false);
    } catch (err: unknown) {
      if ((err as { name?: string })?.name === 'AbortError') return;
      setSearchError(
        err instanceof Error
          ? `Search failed: ${err.message}`
          : 'Unable to reach location search service.'
      );
      setIsOpen(true);
      setIsSearching(false);
    }
  };

  const modes: { id: PlanetaryMode; label: string; icon: React.ReactNode }[] = [
    {
      id: 'earth',
      label: mode === 'earth' ? 'Earth (Active)' : 'Earth',
      icon: <Globe2 className="w-3.5 h-3.5 shrink-0" />,
    },
    {
      id: 'mars',
      label: mode === 'mars' ? 'Mars (Active)' : 'Mars',
      icon: <Orbit className="w-3.5 h-3.5 shrink-0" />,
    },
    {
      id: 'moon',
      label: mode === 'moon' ? 'Moon (Active)' : 'Moon',
      icon: <Moon className="w-3.5 h-3.5 shrink-0" />,
    },
  ];

  return (
    <header className="min-h-16 bg-[#16A34A] text-white px-4 lg:px-6 py-2.5 flex flex-wrap lg:flex-nowrap items-center justify-between gap-3 lg:gap-6 shrink-0 z-30 shadow-sm">
      {/* Brand Title */}
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
          <Sprout className="w-4.5 h-4.5 text-white" />
        </div>
        <h1 className="text-sm sm:text-base font-bold tracking-tight text-white truncate whitespace-nowrap">
          Planetary Innovation Agency — Field Shift
        </h1>
      </div>

      {/* Sleek Dark-Slate Global Location Search Bar */}
      <div ref={searchRef} className="relative flex-1 min-w-[240px] max-w-xl order-3 lg:order-2 w-full lg:w-auto">
        <form
          onSubmit={handleSubmit}
          className="flex items-center h-10 rounded-full bg-slate-900 border border-slate-700/80 shadow-sm focus-within:ring-2 focus-within:ring-white/85 focus-within:border-slate-500 transition-all overflow-hidden"
        >
          <div className="relative flex-1 flex items-center min-w-0">
            <Search className="w-4 h-4 text-slate-400 ml-3.5 shrink-0 pointer-events-none" />
            <input
              type="text"
              value={query}
              onFocus={() => setIsOpen(true)}
              onChange={(e) => {
                setQuery(e.target.value);
                setSearchError(null);
                setIsOpen(true);
              }}
              placeholder="Search any town, province, or farm region..."
              aria-label="Search any town, province, or farm region"
              className="w-full h-10 px-2.5 bg-transparent text-xs sm:text-sm text-slate-100 placeholder:text-slate-400 focus:outline-none min-w-0"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setSearchError(null);
                  setIsOpen(true);
                }}
                aria-label="Clear search"
                className="p-1.5 mr-1 text-slate-400 hover:text-white cursor-pointer shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            type="submit"
            disabled={isSearching || !query.trim()}
            className="h-8 mr-1 px-3.5 rounded-full bg-[#16A34A] hover:bg-[#15803D] disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer disabled:cursor-not-allowed"
          >
            {isSearching ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Searching</span>
              </>
            ) : (
              <span>Search</span>
            )}
          </button>
        </form>

        {isOpen && (
          <div className="absolute left-0 right-0 mt-1.5 bg-white border border-slate-100 rounded-2xl shadow-xl overflow-hidden z-50 max-h-80 overflow-y-auto">
            {searchError && (
              <div className="px-4 py-2.5 bg-rose-50 border-b border-rose-100 text-xs font-medium text-rose-700">
                {searchError}
              </div>
            )}

            {query.trim() && !parsedCoord && (
              <button
                type="button"
                onClick={(e) => void handleSubmit(e as unknown as React.FormEvent)}
                className="w-full px-4 py-2.5 text-left bg-emerald-50/50 hover:bg-emerald-50 flex items-center justify-between gap-3 border-b border-slate-100 transition-colors cursor-pointer"
              >
                <span className="inline-flex items-center gap-2 text-xs font-semibold text-[#15803D] min-w-0">
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">
                    Fly &amp; analyze &ldquo;{query.trim()}&rdquo; via OpenStreetMap
                  </span>
                </span>
                <span className="text-[11px] font-mono text-slate-500 shrink-0">Enter</span>
              </button>
            )}

            {parsedCoord && (
              <button
                type="button"
                onClick={() => {
                  onCoordinateJump(parsedCoord.lat, parsedCoord.lon);
                  setIsOpen(false);
                }}
                className="w-full px-4 py-2.5 text-left hover:bg-emerald-50/70 flex items-center justify-between border-b border-slate-100 transition-colors cursor-pointer"
              >
                <span className="text-xs font-semibold text-[#16A34A]">
                  Locate coordinates on active map
                </span>
                <span className="text-xs font-mono tabular-nums text-slate-600">
                  {parsedCoord.lat.toFixed(2)}°, {parsedCoord.lon.toFixed(2)}°
                </span>
              </button>
            )}

            {matchingSites.length > 0 && (
              <div className="py-1 divide-y divide-slate-100">
                <div className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 bg-slate-50/70">
                  Quick Sector Presets
                </div>
                {matchingSites.map((site) => (
                  <button
                    key={site.id}
                    type="button"
                    onClick={() => {
                      onSelectSiteFromSearch(site);
                      setQuery(site.name);
                      setSearchError(null);
                      setIsOpen(false);
                    }}
                    className="w-full px-4 py-2.5 text-left hover:bg-slate-50 flex items-center justify-between gap-3 transition-colors cursor-pointer"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-900 truncate">
                        {site.name}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">
                        {site.planet.charAt(0).toUpperCase() + site.planet.slice(1)} · {site.region}
                      </div>
                    </div>
                    <span className="text-[11px] font-mono tabular-nums text-[#16A34A] font-medium shrink-0">
                      {site.coordinates}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Planetary Mode Pill Toggle */}
      <div className="flex items-center gap-2.5 shrink-0 order-2 lg:order-3">
        <span className="text-xs font-semibold text-white/90 hidden xl:inline whitespace-nowrap">
          Planetary Mode
        </span>
        <div
          role="group"
          aria-label="Planetary Mode"
          className="inline-flex items-center p-1 rounded-full bg-emerald-950/25 border border-white/20"
        >
          {modes.map((item) => {
            const isActive = mode === item.id;
            const activeColors =
              item.id === 'mars'
                ? 'bg-amber-500 text-white shadow-xs'
                : item.id === 'moon'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-[#15803D] shadow-xs';

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onModeChange(item.id)}
                aria-pressed={isActive}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                  isActive
                    ? activeColors
                    : 'text-white/90 hover:text-white hover:bg-white/10'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
