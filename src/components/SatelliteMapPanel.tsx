import React, { useState, useRef, useEffect, useMemo } from 'react';
import L from 'leaflet';
import {
  Layers,
  Plus,
  Minus,
  RotateCcw,
  Droplets,
  Leaf,
  CloudRain,
  Crosshair,
  Satellite,
  ChevronDown,
  Check,
  Sprout,
  Radar,
  Loader2,
  X,
  MoveHorizontal,
  Sprout as PlantIcon,
  FlaskConical,
} from 'lucide-react';
import {
  BENCHMARK_FARMS,
  PLANET_ASSETS,
} from '../data/planetaryData';
import type {
  BenchmarkFarm,
  MapLayerId,
  PlanetaryMode,
  PlanetarySite,
} from '../data/planetaryData';
import { scanLocalFarmsOverpass } from '../services/overpassFarms';
import type { OverpassFarmPin } from '../services/overpassFarms';
import PlanetGlobe from './PlanetGlobe';
import InfoPopup from './InfoPopup';

interface SatelliteMapPanelProps {
  mode: PlanetaryMode;
  sites: PlanetarySite[];
  selectedSite: PlanetarySite;
  selectedOptionName: string;
  onSelectSite: (site: PlanetarySite) => void;
  activeLayers: Record<MapLayerId, boolean>;
  onToggleLayer: (layerId: MapLayerId) => void;
  customCoordinate: {
    lat: number;
    lon: number;
    zoomTo?: number;
    flyKey?: number;
  } | null;
  customLocationName?: string | null;
  onMapCoordinateClick?: (lat: number, lon: number) => void;
  onSelectBenchmarkFarm?: (farm: BenchmarkFarm) => void;
  onSelectLocalFarmPin?: (farm: OverpassFarmPin) => void;
  isLoadingTelemetry?: boolean;
  /** analysis footprint radius in metres (Earth) */
  catchmentRadiusMeters: number;
  onCatchmentRadiusChange: (meters: number) => void;
  /** vertical-farming suitability mask (Mars / Moon) */
  verticalFarming: boolean;
  onToggleVerticalFarming: () => void;
  /** called when a site marker is picked on the 3D globe */
  onGlobeSitePick?: (site: PlanetarySite) => void;
}

/** The methodology note shown when a new planet mode is opened. */
const METHODOLOGY: Record<'mars' | 'moon', { title: string; body: string; footnote: string }> = {
  mars: {
    title: 'How we found these sites',
    body:
      'We have used the Food and Agriculture Organization (FAO) EcoCrop dataset to define the ideal growing conditions for over 2,500 plant species, creating a biological lookup table. We pair this with NASA’s Subsurface Water Ice Mapping (SWIM), Mars Orbiter Laser Altimeter (MOLA), Mars Climate Sounder (MCS), and HiRISE datasets to find resource-rich, safe locations for greenhouses and recommend which crops to grow on Mars.',
    footnote:
      'EcoCrop · SWIM · MOLA · MCS · HiRISE — all NASA / FAO open data.',
  },
  moon: {
    title: 'How we found these sites',
    body:
      'We have used the Food and Agriculture Organization (FAO) EcoCrop dataset to define the ideal growing conditions for over 2,500 plant species, creating a biological lookup table. We pair this with NASA’s Subsurface Water Ice Mapping (SWIM), Mars Orbiter Laser Altimeter (MOLA), Mars Climate Sounder (MCS), and HiRISE datasets to find resource-rich, safe locations for greenhouses and recommend which crops to grow on the moon.',
    footnote:
      'EcoCrop · SWIM · MOLA · MCS · HiRISE — all NASA / FAO open data.',
  },
};

export const SatelliteMapPanel: React.FC<SatelliteMapPanelProps> = ({
  mode,
  sites,
  selectedSite,
  selectedOptionName,
  onSelectSite,
  activeLayers,
  onToggleLayer,
  customCoordinate,
  customLocationName = null,
  onMapCoordinateClick,
  onSelectBenchmarkFarm,
  onSelectLocalFarmPin,
  isLoadingTelemetry = false,
  catchmentRadiusMeters,
  onCatchmentRadiusChange,
  verticalFarming,
  onToggleVerticalFarming,
  onGlobeSitePick,
}) => {
  const asset = PLANET_ASSETS[mode];
  const isOffWorld = mode !== 'earth';

  const leafletContainerRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const gibsLayerRef = useRef<L.TileLayer | null>(null);
  const croplandLayerRef = useRef<L.TileLayer | null>(null);
  const siteOverlayGroupRef = useRef<L.LayerGroup | null>(null);
  const telemetryOverlayGroupRef = useRef<L.LayerGroup | null>(null);
  const customPinGroupRef = useRef<L.LayerGroup | null>(null);
  const overpassFarmGroupRef = useRef<L.LayerGroup | null>(null);

  const [earthSatelliteOverlay, setEarthSatelliteOverlay] = useState<
    'standard' | 'modis_truecolor' | 'modis_ndvi'
  >('standard');
  const [showCroplandOverlay, setShowCroplandOverlay] = useState(false);
  const [isSatelliteMenuOpen, setIsSatelliteMenuOpen] = useState(false);
  const [isBenchmarkMenuOpen, setIsBenchmarkMenuOpen] = useState(false);
  const [isCatchmentOpen, setIsCatchmentOpen] = useState(false);
  const [activeBenchmarkId, setActiveBenchmarkId] = useState<string | null>(null);
  const [methodologyOpen, setMethodologyOpen] = useState(false);
  const [greenhouseSite, setGreenhouseSite] = useState<PlanetarySite | null>(null);

  // Overpass local farm scanner state
  const [scannedFarms, setScannedFarms] = useState<OverpassFarmPin[]>([]);
  const [selectedLocalFarmId, setSelectedLocalFarmId] = useState<string | null>(null);
  const [scanCenter, setScanCenter] = useState<{ lat: number; lon: number } | null>(null);
  const [isScanningFarms, setIsScanningFarms] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [hasScannedOnce, setHasScannedOnce] = useState(false);

  const satelliteMenuRef = useRef<HTMLDivElement>(null);
  const benchmarkMenuRef = useRef<HTMLDivElement>(null);
  const scanAbortRef = useRef<AbortController | null>(null);

  // Refs for stable callbacks inside Leaflet event listeners
  const onMapClickRef = useRef(onMapCoordinateClick);
  onMapClickRef.current = onMapCoordinateClick;
  const onSelectSiteRef = useRef(onSelectSite);
  onSelectSiteRef.current = onSelectSite;
  const onSelectLocalFarmRef = useRef(onSelectLocalFarmPin);
  onSelectLocalFarmRef.current = onSelectLocalFarmPin;

  const [cursorCoords, setCursorCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [zoomLevel, setZoomLevel] = useState(mode === 'earth' ? 9 : 3);
  const skipInitialEarthPanRef = useRef(true);

  // Show the methodology note the first time an off-world mode opens
  useEffect(() => {
    if (mode === 'earth') {
      setMethodologyOpen(false);
      return;
    }
    setMethodologyOpen(true);
  }, [mode]);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (
        satelliteMenuRef.current &&
        !satelliteMenuRef.current.contains(e.target as Node)
      ) {
        setIsSatelliteMenuOpen(false);
      }
      if (
        benchmarkMenuRef.current &&
        !benchmarkMenuRef.current.contains(e.target as Node)
      ) {
        setIsBenchmarkMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      scanAbortRef.current?.abort();
    };
  }, []);

  const getSiteStrokeColor = (site: PlanetarySite) => {
    const profile =
      site.id === selectedSite.id
        ? site.options[selectedOptionName] || site.options[site.defaultOption]
        : site.options[site.defaultOption];

    if (profile.verdictTone === 'coral') return '#F43F5E';
    if (profile.verdictTone === 'amber') return '#F59E0B';
    return mode === 'mars' ? '#38BDF8' : '#16A34A';
  };

  // Initialize interactive Leaflet map dynamically for Earth
  useEffect(() => {
    if (!leafletContainerRef.current) return;

    const map = L.map(leafletContainerRef.current, {
      crs: L.CRS.EPSG3857,
      center: [-33.92, 18.86],
      zoom: 9,
      zoomControl: false,
      minZoom: 3,
      maxZoom: 18,
    });

    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        maxZoom: 18,
        attribution: 'Tiles &copy; Esri World Imagery',
      }
    ).addTo(map);

    // Semi-transparent reference labels layer above satellite & GIBS overlays
    const labelsPane = map.createPane('labelsPane');
    labelsPane.style.zIndex = '450';
    labelsPane.style.pointerEvents = 'none';

    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
      {
        pane: 'labelsPane',
        opacity: 0.85,
        maxZoom: 18,
        attribution: 'Labels &copy; Esri',
      }
    ).addTo(map);

    const telemetryGroup = L.layerGroup().addTo(map);
    const siteGroup = L.layerGroup().addTo(map);
    const overpassGroup = L.layerGroup().addTo(map);
    const customGroup = L.layerGroup().addTo(map);

    leafletMapRef.current = map;
    telemetryOverlayGroupRef.current = telemetryGroup;
    siteOverlayGroupRef.current = siteGroup;
    overpassFarmGroupRef.current = overpassGroup;
    customPinGroupRef.current = customGroup;
    setZoomLevel(map.getZoom());

    map.on('mousemove', (e: L.LeafletMouseEvent) => {
      setCursorCoords({
        lat: +e.latlng.lat.toFixed(4),
        lon: +e.latlng.lng.toFixed(4),
      });
    });

    map.on('zoomend', () => {
      setZoomLevel(map.getZoom());
    });

    map.on('click', (e: L.LeafletMouseEvent) => {
      setSelectedLocalFarmId(null);
      setActiveBenchmarkId(null);
      onMapClickRef.current?.(
        +e.latlng.lat.toFixed(4),
        +e.latlng.lng.toFixed(4)
      );
    });

    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    resizeObserver.observe(leafletContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      if (gibsLayerRef.current) {
        gibsLayerRef.current.remove();
        gibsLayerRef.current = null;
      }
      if (croplandLayerRef.current) {
        croplandLayerRef.current.remove();
        croplandLayerRef.current = null;
      }
      map.remove();
      leafletMapRef.current = null;
      siteOverlayGroupRef.current = null;
      telemetryOverlayGroupRef.current = null;
      overpassFarmGroupRef.current = null;
      customPinGroupRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync NASA GIBS Global Cropland Extent (GFSAD) overlay TileLayer
  useEffect(() => {
    if (!leafletMapRef.current) return;
    const map = leafletMapRef.current;

    if (croplandLayerRef.current) {
      map.removeLayer(croplandLayerRef.current);
      croplandLayerRef.current = null;
    }

    if (showCroplandOverlay) {
      const croplandLayer = L.tileLayer(
        'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/Agricultural_Lands_Croplands_2000/default/GoogleMapsCompatible_Level7/{z}/{y}/{x}.png',
        {
          opacity: 0.75,
          maxNativeZoom: 7,
          maxZoom: 18,
          zIndex: 250,
          attribution: 'NASA GFSAD / GIBS Cropland Extent',
        }
      );
      croplandLayer.addTo(map);
      croplandLayerRef.current = croplandLayer;
    }
  }, [mode, showCroplandOverlay]);

  // Sync NASA GIBS MODIS True Color / NDVI overlay TileLayer
  useEffect(() => {
    if (!leafletMapRef.current) return;
    const map = leafletMapRef.current;

    if (gibsLayerRef.current) {
      map.removeLayer(gibsLayerRef.current);
      gibsLayerRef.current = null;
    }

    if (earthSatelliteOverlay === 'modis_truecolor') {
      const twoDaysAgo = new Date(Date.now() - 2 * 86400000)
        .toISOString()
        .slice(0, 10);
      const trueColorLayer = L.tileLayer(
        `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/${twoDaysAgo}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`,
        {
          opacity: 0.85,
          maxNativeZoom: 9,
          maxZoom: 18,
          attribution: 'NASA GIBS MODIS Terra True Color',
        }
      );
      trueColorLayer.addTo(map);
      gibsLayerRef.current = trueColorLayer;
    } else if (earthSatelliteOverlay === 'modis_ndvi') {
      const ndviLayer = L.tileLayer(
        'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_NDVI_8Day/default/default/GoogleMapsCompatible_Level9/{z}/{y}/{x}.png',
        {
          opacity: 0.75,
          maxNativeZoom: 9,
          maxZoom: 18,
          attribution: 'NASA GIBS MODIS 8-Day NDVI',
        }
      );
      ndviLayer.addTo(map);
      gibsLayerRef.current = ndviLayer;
    }
  }, [mode, earthSatelliteOverlay]);

  // Sync site boundary polygons & clickable location pins (Earth)
  useEffect(() => {
    const siteGroup = siteOverlayGroupRef.current;
    if (!siteGroup) return;

    siteGroup.clearLayers();

    const dLat = 0.011;
    const dLon = 0.015;

    sites.forEach((site) => {
      const isSelected = !customCoordinate && site.id === selectedSite.id;
      const color = getSiteStrokeColor(site);
      const activeProfile =
        site.id === selectedSite.id
          ? site.options[selectedOptionName] || site.options[site.defaultOption]
          : site.options[site.defaultOption];

      const polyCoords: L.LatLngExpression[] = [
        [site.lat + dLat, site.lon - dLon],
        [site.lat + dLat * 0.85, site.lon + dLon * 1.1],
        [site.lat - dLat, site.lon + dLon * 0.95],
        [site.lat - dLat * 0.9, site.lon - dLon * 1.05],
      ];

      const polygon = L.polygon(polyCoords, {
        color,
        weight: isSelected ? 3 : 2,
        opacity: isSelected ? 0.95 : 0.78,
        fillColor: color,
        fillOpacity: isSelected ? 0.24 : 0.12,
        dashArray: isSelected ? undefined : '5 5',
      });

      polygon.on('click', (e: L.LeafletMouseEvent) => {
        L.DomEvent.stopPropagation(e);
        onSelectSiteRef.current(site);
      });
      polygon.addTo(siteGroup);

      const escapedName = site.name.replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const toneWord =
        activeProfile.verdictTone === 'coral'
          ? 'High Risk'
          : activeProfile.verdictTone === 'amber'
            ? 'Caution'
            : 'Optimal';
      const subtitleText = `${activeProfile.suitabilityIndex}% ${toneWord} · ${site.coordinates}`;
      const escapedSubtitle = subtitleText
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

      const showSubtitle = isSelected;
      const iconHtml = `
        <div style="display:flex;align-items:center;gap:8px;transform:translate(-10px,-10px);pointer-events:auto;cursor:pointer;">
          <div style="width:20px;height:20px;border-radius:9999px;background:#0F172A;border:3px solid ${color};display:flex;align-items:center;justify-content:center;box-shadow:${
            isSelected ? `0 0 0 4px ${color}33,` : ''
          }0 2px 8px rgba(0,0,0,0.45);">
            <div style="width:6px;height:6px;border-radius:9999px;background:#FFFFFF;"></div>
          </div>
          <div style="background:rgba(255,255,255,0.96);border:1.5px solid ${
            isSelected ? color : 'rgba(15,23,42,0.22)'
          };border-radius:8px;padding:3.5px 8.5px;box-shadow:0 3px 10px rgba(0,0,0,0.28);white-space:nowrap;">
            <div style="font-size:11px;font-weight:${
              isSelected ? '700' : '600'
            };color:#0F172A;line-height:1.25;">${escapedName}</div>
            ${
              showSubtitle
                ? `<div style="font-size:9.5px;font-family:'IBM Plex Mono',monospace;color:#475569;line-height:1.25;">${escapedSubtitle}</div>`
                : ''
            }
          </div>
        </div>
      `;

      const marker = L.marker([site.lat, site.lon], {
        icon: L.divIcon({
          html: iconHtml,
          className: 'leaflet-div-icon',
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        }),
      });

      marker.on('click', (e: L.LeafletMouseEvent) => {
        L.DomEvent.stopPropagation(e);
        onSelectSiteRef.current(site);
      });

      marker.addTo(siteGroup);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, sites, selectedSite.id, selectedOptionName, customCoordinate]);

  // Sync the catchment pin + adjustable radius ring on the Earth map
  useEffect(() => {
    const customGroup = customPinGroupRef.current;
    const map = leafletMapRef.current;
    if (!customGroup || !map) return;

    customGroup.clearLayers();
    if (!customCoordinate) return;

    const { lat, lon } = customCoordinate;

    // The analysis catchment — radius is user adjustable
    L.circle([lat, lon], {
      radius: catchmentRadiusMeters,
      color: '#1DB954',
      weight: 2.5,
      opacity: 0.95,
      fillColor: '#1DB954',
      fillOpacity: 0.16,
      interactive: false,
    }).addTo(customGroup);

    const rawTitle = isLoadingTelemetry
      ? 'Sampling NASA POWER...'
      : customLocationName || 'Selected Catchment';
    const statusTitle = rawTitle.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const coordStr = `${Math.abs(lat).toFixed(3)}°${lat >= 0 ? 'N' : 'S'}, ${Math.abs(
      lon
    ).toFixed(3)}°${lon >= 0 ? 'E' : 'W'}`;
    const radiusLabel =
      catchmentRadiusMeters >= 1000
        ? `${(catchmentRadiusMeters / 1000).toFixed(
            catchmentRadiusMeters % 1000 === 0 ? 0 : 1
          )} km catchment`
        : `${catchmentRadiusMeters} m catchment`;

    const customHtml = `
      <div style="display:flex;align-items:center;gap:8px;transform:translate(-12px,-12px);pointer-events:none;">
        <div style="width:24px;height:24px;border-radius:9999px;background:#0F172A;border:3px solid #1DB954;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 6px rgba(29,185,84,0.32),0 0 16px rgba(22,163,74,0.65);">
          <div style="width:7px;height:7px;border-radius:9999px;background:#FFFFFF;"></div>
        </div>
        <div style="background:rgba(255,255,255,0.97);border:1.5px solid #16A34A;border-radius:8px;padding:4px 9px;box-shadow:0 4px 12px rgba(0,0,0,0.24);max-width:250px;">
          <div style="font-size:11px;font-weight:700;color:#0F172A;line-height:1.25;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${statusTitle}</div>
          <div style="font-size:9.5px;font-family:'IBM Plex Mono',monospace;color:#15803D;line-height:1.25;white-space:nowrap;">${radiusLabel} · ${coordStr}</div>
        </div>
      </div>
    `;

    L.marker([lat, lon], {
      icon: L.divIcon({
        html: customHtml,
        className: 'leaflet-div-icon',
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      }),
    }).addTo(customGroup);
  }, [mode, customCoordinate, customLocationName, isLoadingTelemetry, catchmentRadiusMeters]);

  // Render Overpass API discovered local farms inside the scanned radius
  useEffect(() => {
    const farmGroup = overpassFarmGroupRef.current;
    if (!farmGroup) return;

    farmGroup.clearLayers();

    if (scanCenter && (scannedFarms.length > 0 || hasScannedOnce)) {
      L.circle([scanCenter.lat, scanCenter.lon], {
        radius: 15000,
        color: '#16A34A',
        weight: 1.5,
        dashArray: '6 6',
        fillColor: '#16A34A',
        fillOpacity: 0.04,
        interactive: false,
      }).addTo(farmGroup);
    }

    scannedFarms.forEach((farm) => {
      const isSelected = selectedLocalFarmId === farm.id;
      const pinColor = isSelected ? '#16A34A' : '#F59E0B';
      const escapedTitle = farm.name.replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const badgeLabel = farm.cropTag
        ? farm.cropTag
        : farm.category === 'farm'
          ? 'Farmstead'
          : 'Farmland';

      const farmHtml = `
        <div style="display:flex;align-items:center;gap:6px;transform:translate(-8px,-8px);pointer-events:auto;cursor:pointer;">
          <div style="width:16px;height:16px;border-radius:9999px;background:${pinColor};border:2.5px solid #FFFFFF;box-shadow:0 2px 6px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;">
            <div style="width:4px;height:4px;border-radius:9999px;background:#FFFFFF;"></div>
          </div>
          <div style="background:rgba(15,23,42,0.92);color:#FFFFFF;border:1px solid ${pinColor};border-radius:7px;padding:2.5px 7px;box-shadow:0 3px 8px rgba(0,0,0,0.3);max-width:170px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:10.5px;font-weight:600;">
            ${escapedTitle} · <span style="color:${isSelected ? '#86EFAC' : '#FCD34D'};font-weight:500;">${badgeLabel}</span>
          </div>
        </div>
      `;

      const marker = L.marker([farm.lat, farm.lon], {
        icon: L.divIcon({
          html: farmHtml,
          className: 'leaflet-div-icon',
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        }),
      });

      marker.on('click', (e: L.LeafletMouseEvent) => {
        L.DomEvent.stopPropagation(e);
        setSelectedLocalFarmId(farm.id);
        onSelectLocalFarmRef.current?.(farm);
      });

      marker.addTo(farmGroup);
    });
  }, [mode, scannedFarms, selectedLocalFarmId, scanCenter, hasScannedOnce]);

  // Pan or smoothly fly the Earth map when the pin moves
  useEffect(() => {
    const map = leafletMapRef.current;
    if (!map) return;

    if (skipInitialEarthPanRef.current) {
      skipInitialEarthPanRef.current = false;
      return;
    }

    if (customCoordinate) {
      if (typeof customCoordinate.zoomTo === 'number') {
        map.flyTo(
          [customCoordinate.lat, customCoordinate.lon],
          customCoordinate.zoomTo,
          { animate: true, duration: 1.4 }
        );
      } else {
        map.panTo([customCoordinate.lat, customCoordinate.lon], {
          animate: true,
        });
      }
    } else {
      map.panTo([selectedSite.lat, selectedSite.lon], {
        animate: true,
      });
    }
  }, [mode, selectedSite.id, selectedSite.lat, selectedSite.lon, customCoordinate]);

  // Render active spectral/orbital overlay footprints on the Earth map
  useEffect(() => {
    const telemetryGroup = telemetryOverlayGroupRef.current;
    if (!telemetryGroup) return;

    telemetryGroup.clearLayers();

    const centerLat = customCoordinate ? customCoordinate.lat : selectedSite.lat;
    const centerLon = customCoordinate ? customCoordinate.lon : selectedSite.lon;

    const primaryRadius = 6500;
    const secondaryRadius = 4800;
    const secondaryOffset = 0.035;
    const gridStep = 0.032;

    // Layer A: Soil Moisture (SMAP)
    if (activeLayers.layer_a) {
      L.circle([centerLat, centerLon], {
        radius: primaryRadius,
        stroke: true,
        color: '#F97316',
        weight: 1.4,
        dashArray: '5 4',
        fillColor: '#F97316',
        fillOpacity: 0.16,
        interactive: false,
      }).addTo(telemetryGroup);

      L.circle([centerLat + secondaryOffset, centerLon + secondaryOffset], {
        radius: secondaryRadius,
        stroke: false,
        fillColor: '#06B6D4',
        fillOpacity: 0.18,
        interactive: false,
      }).addTo(telemetryGroup);
    }

    // Layer B: Vegetation Health (NDVI)
    if (activeLayers.layer_b) {
      L.circle([centerLat - secondaryOffset * 0.4, centerLon + secondaryOffset * 0.5], {
        radius: primaryRadius * 0.9,
        stroke: true,
        color: '#10B981',
        weight: 1.4,
        fillColor: '#10B981',
        fillOpacity: 0.2,
        interactive: false,
      }).addTo(telemetryGroup);
    }

    // Layer C: Rainfall (GPM)
    if (activeLayers.layer_c) {
      for (let r = -1; r <= 1; r++) {
        for (let c = -1; c <= 1; c++) {
          const lat1 = centerLat + r * gridStep - gridStep / 2;
          const lon1 = centerLon + c * gridStep - gridStep / 2;
          L.rectangle(
            [
              [lat1, lon1],
              [lat1 + gridStep, lon1 + gridStep],
            ],
            {
              color: '#38BDF8',
              weight: 0.9,
              opacity: 0.55,
              fillColor: '#2563EB',
              fillOpacity: (r + c) % 2 === 0 ? 0.15 : 0.08,
              interactive: false,
            }
          ).addTo(telemetryGroup);
        }
      }
    }
  }, [mode, activeLayers, selectedSite.lat, selectedSite.lon, customCoordinate]);

  const handleZoomIn = () => {
    leafletMapRef.current?.zoomIn();
  };

  const handleZoomOut = () => {
    leafletMapRef.current?.zoomOut();
  };

  const handleResetView = () => {
    const map = leafletMapRef.current;
    if (!map) return;
    map.setView([-33.92, 18.86], 9, { animate: true });
  };

  const handleScanLocalFarms = async () => {
    const map = leafletMapRef.current;
    if (!map) return;
    const center = map.getCenter();

    scanAbortRef.current?.abort();
    const controller = new AbortController();
    scanAbortRef.current = controller;

    setIsScanningFarms(true);
    setScanError(null);
    setScanCenter({ lat: center.lat, lon: center.lng });

    try {
      const results = await scanLocalFarmsOverpass(
        center.lat,
        center.lng,
        15000,
        controller.signal
      );
      if (controller.signal.aborted) return;

      setScannedFarms(results);
      setHasScannedOnce(true);
      setIsScanningFarms(false);

      if (results.length > 0 && map.getZoom() < 11) {
        map.flyTo([center.lat, center.lng], 11, {
          animate: true,
          duration: 1.0,
        });
      }
    } catch (err: unknown) {
      if ((err as { name?: string })?.name === 'AbortError') return;
      setScanError(
        err instanceof Error ? err.message : 'Unable to scan local farms right now.'
      );
      setIsScanningFarms(false);
    }
  };

  const handleClearScannedFarms = () => {
    scanAbortRef.current?.abort();
    setScannedFarms([]);
    setSelectedLocalFarmId(null);
    setScanCenter(null);
    setHasScannedOnce(false);
    setScanError(null);
    setIsScanningFarms(false);
  };

  const getLayerIcon = (layerId: MapLayerId) => {
    if (layerId === 'layer_a') return <Droplets className="w-3.5 h-3.5 shrink-0" />;
    if (layerId === 'layer_b') return <Leaf className="w-3.5 h-3.5 shrink-0" />;
    return <CloudRain className="w-3.5 h-3.5 shrink-0" />;
  };

  // Toggling the layer swaps in its explainer, so the methodology note steps back.
  const handleToggleVerticalFarming = () => {
    setMethodologyOpen(false);
    setGreenhouseSite(null);
    onToggleVerticalFarming();
  };

  const activeLayerConfigs = asset.layers.filter((l) => activeLayers[l.id]);
  const activeBenchmark = BENCHMARK_FARMS.find(
    (f) =>
      f.id === activeBenchmarkId &&
      customCoordinate?.lat === f.lat &&
      customCoordinate?.lon === f.lon
  );

  // log-scale slider: 0 → 500 m, 100 → 50 km
  const sliderValue = (radius: number) =>
    (Math.log(radius / 500) / Math.log(100)) * 100;
  const sliderToRadius = (value: number) =>
    Math.round(500 * Math.pow(100, value / 100));

  const slopeDeg = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of sites) if (s.slopeDeg !== undefined) map[s.id] = s.slopeDeg;
    return map;
  }, [sites]);

  const flatZoneKm = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of sites) if (s.flatZoneKm !== undefined) map[s.id] = s.flatZoneKm;
    return map;
  }, [sites]);

  const verticalFarmingBody = useMemo(() => {
    if (mode === 'mars') {
      return 'NASA MRO HiRISE, CTX Digital Terrain Models (DTMs), and MGS MOLA slope datasets were used to identify flat regions (< 5° slope) suitable for vertical farming.';
    }
    return 'NASA LRO LOLA and LROC NAC Digital Terrain Models (DTMs) were used to identify flat regions (< 5° slope) suitable for vertical farming.';
  }, [mode]);

  return (
    <section
      aria-label="Interactive Satellite Map"
      className="relative w-full lg:w-[65%] h-[54vh] lg:h-full bg-slate-950 overflow-hidden select-none border-b lg:border-b-0 lg:border-r border-slate-200"
    >
      {/* Earth: interactive Leaflet map. Mars / Moon: real 3D globe. */}
      {isOffWorld ? (
        <PlanetGlobe
          planet={mode === 'mars' ? 'mars' : 'moon'}
          sites={sites}
          selectedSiteId={selectedSite.id}
          onSelectSite={(site) => {
            onSelectSite(site);
            onGlobeSitePick?.(site);
            setGreenhouseSite(site);
          }}
          verticalFarming={verticalFarming}
          flatZoneKm={flatZoneKm}
          slopeDeg={slopeDeg}
        />
      ) : (
        <div
          ref={leafletContainerRef}
          className="w-full h-full z-0"
          aria-label="Interactive Earth Satellite Map"
        />
      )}

      {/* Top-Left: catchment & farm tools (icon-first on mobile) */}
      <div className="absolute top-4 left-4 pointer-events-none flex flex-col gap-2 z-[500] max-w-[calc(100%-4.5rem)] sm:max-w-[540px]">
        {/* Sector telemetry HUD — desktop only, mobile keeps the map clear */}
        {!isOffWorld && (
          <div className="hidden sm:block px-3.5 py-2.5 rounded-2xl bg-white/95 backdrop-blur-sm shadow-md text-slate-900 w-fit">
            <div className="text-xs font-bold tracking-tight text-slate-900">
              Western Cape Catchments · Interactive Earth
            </div>
            <div className="text-[11px] font-mono text-slate-500 tabular-nums mt-0.5">
              Click anywhere to select a catchment for NASA POWER
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 pointer-events-auto">
          {/* Catchment size control */}
          {!isOffWorld && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsCatchmentOpen((v) => !v)}
                aria-expanded={isCatchmentOpen}
                title="Adjust the analysis catchment size"
                className={`h-9 px-2.5 sm:px-3 rounded-xl shadow-md text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                  isCatchmentOpen
                    ? 'bg-[#16A34A] text-white'
                    : 'bg-white/95 hover:bg-white text-slate-800'
                }`}
              >
                <MoveHorizontal className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">
                  Catchment{' '}
                  <span className="font-mono tabular-nums">
                    {catchmentRadiusMeters >= 1000
                      ? `${(catchmentRadiusMeters / 1000).toFixed(
                          catchmentRadiusMeters % 1000 === 0 ? 0 : 1
                        )} km`
                      : `${catchmentRadiusMeters} m`}
                  </span>
                </span>
              </button>

              {isCatchmentOpen && (
                <div className="absolute left-0 mt-1.5 w-[260px] bg-white rounded-2xl shadow-xl border border-slate-100 p-3 z-50">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Analysis catchment radius
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">
                    NASA POWER is sampled at the pin; the catchment sets the footprint your result is
                    reported over.
                  </p>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={sliderValue(catchmentRadiusMeters)}
                    onChange={(e) =>
                      onCatchmentRadiusChange(sliderToRadius(Number(e.target.value)))
                    }
                    className="w-full mt-2"
                    aria-label="Catchment radius"
                  />
                  <div className="flex items-center justify-between text-[10px] font-mono tabular-nums text-slate-500">
                    <span>0.5 km</span>
                    <span className="font-bold text-[#15803D]">
                      {catchmentRadiusMeters >= 1000
                        ? `${(catchmentRadiusMeters / 1000).toFixed(
                            catchmentRadiusMeters % 1000 === 0 ? 0 : 1
                          )} km`
                        : `${catchmentRadiusMeters} m`}
                    </span>
                    <span>50 km</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Benchmark farms quick-select */}
          {!isOffWorld && (
            <div ref={benchmarkMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setIsBenchmarkMenuOpen((v) => !v)}
                aria-expanded={isBenchmarkMenuOpen}
                title="Sample global farms"
                className="h-9 px-2.5 sm:px-3 rounded-xl bg-white/95 hover:bg-white shadow-md text-xs font-semibold text-slate-800 inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Sprout className="w-3.5 h-3.5 text-[#16A34A] shrink-0" />
                <span className="hidden sm:inline max-w-[190px] truncate">
                  {activeBenchmark ? activeBenchmark.name : 'Sample Global Farms'}
                </span>
                <ChevronDown className="hidden sm:block w-3.5 h-3.5 text-slate-400 shrink-0" />
              </button>

              {isBenchmarkMenuOpen && (
                <div className="absolute left-0 mt-1.5 w-80 bg-white rounded-2xl shadow-xl border border-slate-100 p-1.5 z-50">
                  <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Sample Global Farms (Benchmark Hubs)
                  </div>
                  {BENCHMARK_FARMS.map((farm) => {
                    const isSelected = activeBenchmarkId === farm.id;
                    return (
                      <button
                        key={farm.id}
                        type="button"
                        onClick={() => {
                          setActiveBenchmarkId(farm.id);
                          setSelectedLocalFarmId(null);
                          setScannedFarms([]);
                          setScanCenter(null);
                          setHasScannedOnce(false);
                          setScanError(null);
                          setIsBenchmarkMenuOpen(false);
                          onSelectBenchmarkFarm?.(farm);
                        }}
                        className={`w-full px-3 py-2 rounded-xl text-left flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-50 text-[#15803D]'
                            : 'hover:bg-slate-50 text-slate-800'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-semibold truncate">{farm.name}</div>
                          <div className="text-[11px] font-mono tabular-nums text-slate-500 mt-0.5">
                            {farm.lat.toFixed(2)}°, {farm.lon.toFixed(2)}° · {farm.regionLabel}
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-[#15803D] shrink-0">
                          {farm.defaultCrop}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Scan local farms */}
          {!isOffWorld && (
            <button
              type="button"
              onClick={() => void handleScanLocalFarms()}
              disabled={isScanningFarms}
              title="Scan local farms (OpenStreetMap)"
              className="h-9 px-2.5 sm:px-3.5 rounded-xl bg-[#16A34A] hover:bg-[#15803D] disabled:bg-emerald-700 text-white shadow-md text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              {isScanningFarms ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                  <span className="hidden sm:inline">Scanning 15km...</span>
                </>
              ) : (
                <>
                  <Radar className="w-3.5 h-3.5 shrink-0" />
                  <span className="hidden sm:inline">Scan Local Farms</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* Overpass scan status / error pill */}
        {!isOffWorld && (hasScannedOnce || scanError) && (
          <div
            className={`pointer-events-auto inline-flex items-center gap-2 px-3 py-1.5 rounded-xl shadow-md text-[11px] font-medium w-fit ${
              scanError
                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                : 'bg-slate-900/92 text-white'
            }`}
          >
            <span>
              {scanError
                ? scanError
                : scannedFarms.length > 0
                  ? `${scannedFarms.length} local farms found within 15km · Click any pin`
                  : 'No OSM farmland polygons found in 15km radius — try panning to cropland'}
            </span>
            <button
              type="button"
              onClick={handleClearScannedFarms}
              aria-label="Clear local farm pins"
              className="p-0.5 rounded-md hover:bg-white/15 cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {cursorCoords && (
          <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/95 shadow-sm text-[11px] font-mono tabular-nums text-[#15803D] font-semibold w-fit">
            <Crosshair className="w-3 h-3 text-[#16A34A]" />
            <span>
              {Math.abs(cursorCoords.lat).toFixed(3)}°{cursorCoords.lat >= 0 ? 'N' : 'S'},{' '}
              {Math.abs(cursorCoords.lon).toFixed(3)}°{cursorCoords.lon >= 0 ? 'E' : 'W'}
            </span>
          </div>
        )}
      </div>

      {/* Top-Right: satellite switcher + vertical farming + zoom */}
      <div className="absolute top-4 right-4 flex items-start gap-2.5 z-[500]">
        {mode === 'earth' && (
          <div ref={satelliteMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setIsSatelliteMenuOpen((v) => !v)}
              aria-expanded={isSatelliteMenuOpen}
              title="Satellite imagery layer"
              className="h-9 px-2.5 sm:px-3.5 rounded-xl bg-white/95 hover:bg-white shadow-md text-xs font-semibold text-slate-800 inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Satellite className="w-3.5 h-3.5 text-[#16A34A] shrink-0" />
              <span className="hidden sm:inline">
                {earthSatelliteOverlay === 'standard'
                  ? 'Standard Satellite'
                  : earthSatelliteOverlay === 'modis_truecolor'
                    ? 'NASA True Color (MODIS)'
                    : 'NASA NDVI Index'}
              </span>
              <ChevronDown className="hidden sm:block w-3.5 h-3.5 text-slate-400" />
            </button>

            {isSatelliteMenuOpen && (
              <div className="absolute right-0 mt-1.5 w-72 bg-white rounded-2xl shadow-xl border border-slate-100 p-1.5 z-50">
                {[
                  {
                    id: 'standard' as const,
                    title: 'Standard Satellite',
                    subtitle: 'Esri World Imagery base map',
                  },
                  {
                    id: 'modis_truecolor' as const,
                    title: 'NASA Live True Color & Clouds (MODIS)',
                    subtitle: 'Terra Corrected Reflectance overlay',
                  },
                  {
                    id: 'modis_ndvi' as const,
                    title: 'NASA Vegetation & Dryness Index (NDVI)',
                    subtitle: '8-day composite vegetation health (75% opacity)',
                  },
                ].map((opt) => {
                  const active = earthSatelliteOverlay === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        setEarthSatelliteOverlay(opt.id);
                        setIsSatelliteMenuOpen(false);
                      }}
                      className={`w-full px-3 py-2.5 rounded-xl text-left flex items-start justify-between gap-2 transition-colors cursor-pointer ${
                        active
                          ? 'bg-emerald-50 text-[#15803D]'
                          : 'hover:bg-slate-50 text-slate-800'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-semibold leading-snug">{opt.title}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">{opt.subtitle}</div>
                      </div>
                      {active && <Check className="w-4 h-4 text-[#16A34A] shrink-0 mt-0.5" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Vertical farming suitability toggle — text on desktop, icon on mobile */}
        {isOffWorld && (
          <button
            type="button"
            onClick={handleToggleVerticalFarming}
            aria-pressed={verticalFarming}
            title="Vertical farming — highlight flat ground (< 5° slope)"
            className={`h-9 px-2.5 sm:px-3.5 rounded-xl shadow-md text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
              verticalFarming
                ? 'bg-emerald-500 text-white'
                : 'bg-white/95 hover:bg-white text-slate-800'
            }`}
          >
            <PlantIcon className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">Vertical Farming</span>
          </button>
        )}

        {!isOffWorld && (
          <div className="flex flex-col gap-1.5">
            <button
              type="button"
              onClick={handleZoomIn}
              aria-label="Zoom in map"
              className="w-9 h-9 rounded-xl bg-white/95 hover:bg-white shadow-md text-slate-800 flex items-center justify-center transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleZoomOut}
              aria-label="Zoom out map"
              className="w-9 h-9 rounded-xl bg-white/95 hover:bg-white shadow-md text-slate-800 flex items-center justify-center transition-colors cursor-pointer"
            >
              <Minus className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleResetView}
              aria-label="Reset map view"
              className="w-9 h-9 rounded-xl bg-white/95 hover:bg-white shadow-md text-slate-800 flex items-center justify-center transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Bottom-Left: legend + layer toggles (Earth) */}
      {!isOffWorld && (
        <div className="absolute bottom-4 left-4 z-[500] flex flex-col gap-2 max-w-[calc(100%-2rem)]">
          {activeLayerConfigs.length > 0 && (
            <div className="hidden sm:flex bg-white/95 backdrop-blur-sm shadow-md rounded-2xl px-3.5 py-2.5 flex-col gap-1.5 w-fit">
              {activeLayerConfigs.map((layer) => (
                <div key={`legend-${layer.id}`} className="flex items-center gap-2.5 text-[11px]">
                  <span className="font-mono font-semibold text-slate-700 w-16 shrink-0">
                    {layer.shortCode}
                  </span>
                  <span className="font-mono tabular-nums text-slate-500">{layer.legendMin}</span>
                  <div
                    className="w-20 h-2 rounded-full"
                    style={{
                      background: `linear-gradient(90deg, ${layer.colorStopLow}, ${layer.colorStopHigh})`,
                    }}
                  />
                  <span className="font-mono tabular-nums font-medium text-slate-800">
                    {layer.legendMax}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-2 flex flex-wrap items-center gap-1.5 shadow-lg max-w-full overflow-x-auto">
            <div className="flex items-center gap-1.5 px-2 text-xs font-semibold text-slate-600 shrink-0">
              <Layers className="w-3.5 h-3.5 text-[#16A34A]" />
              <span className="hidden sm:inline">Layers</span>
            </div>
            <button
              type="button"
              onClick={() => setShowCroplandOverlay((v) => !v)}
              aria-pressed={showCroplandOverlay}
              title="Toggle NASA GFSAD Global Cropland Extent tile layer"
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                showCroplandOverlay
                  ? 'bg-[#16A34A] text-white shadow-xs'
                  : 'bg-emerald-50 text-[#15803D] border border-emerald-200 hover:bg-emerald-100'
              }`}
            >
              <span aria-hidden>🌾</span>
              <span className="hidden sm:inline">NASA Cropland Extent (GFSAD)</span>
            </button>
            {asset.layers.map((layer) => {
              const active = activeLayers[layer.id];
              return (
                <button
                  key={layer.id}
                  type="button"
                  onClick={() => onToggleLayer(layer.id)}
                  aria-pressed={active}
                  title={layer.description}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-[#16A34A] text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900'
                  }`}
                >
                  {getLayerIcon(layer.id)}
                  <span className="hidden sm:inline">{layer.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Bottom-Right: layer legends + zoom readout */}
      <div className="absolute bottom-7 right-4 flex flex-col items-end gap-2 z-[500] pointer-events-none">
        {mode === 'earth' && showCroplandOverlay && (
          <div className="hidden sm:block bg-white/95 backdrop-blur-sm shadow-lg rounded-2xl px-3.5 py-2.5 text-[11px] text-slate-800 space-y-1.5 pointer-events-auto max-w-[245px]">
            <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
              <span>🌾</span>
              <span>NASA Cropland Extent (GFSAD)</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="w-3 h-3 rounded-sm bg-[#22C55E] border border-emerald-700/40 shrink-0 mt-0.5" />
              <span className="text-slate-600 leading-snug">
                Highlighted zones represent NASA-verified active cropland.
              </span>
            </div>
          </div>
        )}

        {mode === 'earth' && earthSatelliteOverlay === 'modis_ndvi' && (
          <div className="hidden sm:block bg-white/95 backdrop-blur-sm shadow-lg rounded-2xl px-3.5 py-2.5 text-[11px] text-slate-800 space-y-1.5 pointer-events-auto">
            <div className="font-bold text-slate-900 text-xs">NASA MODIS NDVI Legend</div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-sm bg-[#8B5A2B] shrink-0" />
              <span>Brown = Dry / Bare Soil</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-sm bg-[#FACC15] shrink-0" />
              <span>Yellow = Moderate Stress</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-sm bg-[#22C55E] shrink-0" />
              <span>Bright Green = Healthy Vegetation</span>
            </div>
          </div>
        )}

        {!isOffWorld && (
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/95 shadow-md text-[11px] font-mono tabular-nums text-slate-800 font-medium">
            <span>Zoom Z{zoomLevel}</span>
          </div>
        )}
      </div>

      {/* Off-world explainers — one at a time, most specific wins */}
      {isOffWorld && greenhouseSite && (
        <InfoPopup
          open
          onClose={() => setGreenhouseSite(null)}
          eyebrow="Greenhouse site"
          title={greenhouseSite.name}
          body={
            (greenhouseSite.slopeDeg ?? 99) < 5
              ? mode === 'mars'
                ? 'This is the ideal location to plant a greenhouse.'
                : 'This is the ideal location to plant a greenhouse on the moon.'
              : 'This slope is too steep for a greenhouse — the orbital altimetry puts it well above the 5° safe-build threshold.'
          }
          footnote={`Measured slope ${greenhouseSite.slopeDeg ?? '—'}° · ${greenhouseSite.areaLabel}`}
          accent="emerald"
        />
      )}

      {isOffWorld && !greenhouseSite && verticalFarming && (
        <InfoPopup
          open
          onClose={handleToggleVerticalFarming}
          eyebrow="Vertical farming suitability"
          title="Flat ground, ready to build on"
          body={verticalFarmingBody}
          footnote="Threshold: slope under 5° — the aerospace engineering limit that keeps heavy structures from tipping and minimises foundation excavation."
          accent="cyan"
        />
      )}

      {isOffWorld && !greenhouseSite && !verticalFarming && (
        <InfoPopup
          open={methodologyOpen}
          onClose={() => setMethodologyOpen(false)}
          eyebrow="NASA data methodology"
          title={METHODOLOGY[mode === 'mars' ? 'mars' : 'moon'].title}
          body={METHODOLOGY[mode === 'mars' ? 'mars' : 'moon'].body}
          footnote={METHODOLOGY[mode === 'mars' ? 'mars' : 'moon'].footnote}
          accent="emerald"
        />
      )}

      {/* Off-world: reopen the methodology note */}
      {isOffWorld && !greenhouseSite && !verticalFarming && !methodologyOpen && (
        <button
          type="button"
          onClick={() => setMethodologyOpen(true)}
          className="absolute bottom-4 left-4 z-[500] h-9 px-3 rounded-xl bg-white/95 hover:bg-white shadow-md text-xs font-semibold text-slate-800 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <FlaskConical className="w-3.5 h-3.5 text-[#16A34A]" />
          How we found these sites
        </button>
      )}
    </section>
  );
};