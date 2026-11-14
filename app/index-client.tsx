"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { TELEMETRY_KEY, newest, type SidebarTelemetry } from "@/lib/telemetry";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Droplets,
  Globe,
  Layers,
  Satellite,
  Wind,
  Map as MapIcon,
  Flame,
  LocateFixed,
  MapPin,
  Maximize2,
  Minus,
  MoreHorizontal,
  Plus,
  Radio,
  Search,
  SlidersHorizontal,
  Thermometer,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
const EmberMap = dynamic(() => import("@/components/ember-map").then((m) => m.EmberMap), {
  ssr: false,
});
import { SmartActionGuide } from "@/components/smart-action-guide";
import { PlaceCombobox } from "@/components/place-combobox";
import { DEFAULT_PLACE, type GuidePlace } from "@/lib/geocode";
import { conditionsKey, fetchConditions } from "@/lib/conditions";
import { heatIndexC, heatLevel } from "@/lib/action-guide";
import { clipToBoundary, contourAreas, fetchHeatGrid, gridDomain } from "@/lib/heat-grid";
import type { BoundaryPayload, LevelsPayload } from "@/app/api/boundary/route";
import { ClimatePanel, HeatScaleSlider } from "@/components/climate-panel";
import { useTheme } from "@/hooks/use-theme";
import { booleanPointInPolygon, pointToPolygonDistance } from "@turf/turf";
import { NEARBY_KM, splitByBorder } from "@/lib/fire-area";
import { type Confidence, type Hotspot, haversineKm } from "@/lib/hotspots";
import { WIND_SCALE, compassOf, fetchFireWinds, fetchWindField, keepBox, sampleWind, spreadEllipse, spreadFeatures } from "@/lib/wind";
import { EmberShell, type EmberLiveStatus } from "@/components/ember-shell";
import type { EmberMapInstance, EmberMapLayers } from "@/components/ember-map";
import {
  clusterHotspots,
  computeHarmonizationStats,
  fetchFirmsWfsHotspots,
  unharmonizedHotspots,
  type ClusteredHotspot,
} from "@/lib/firms-client";
import { HistoricalFireNavigator } from "@/components/historical-fire-navigator";
import {
  buildTimelineSteps,
  hotspotMatchesStep,
  type Granularity,
  type QuickRange,
  type SpanDays,
} from "@/lib/timeline";

const NO_HOTSPOTS: Hotspot[] = []; // stable empty list so memoized map data doesn't change every render

type OverviewView = "fires" | "temperature" | "heatindex";
type MapView = "globe" | "mercator"; // 3D globe or flat map projection
const VIEWS: OverviewView[] = ["fires", "temperature", "heatindex"];
const MAP_SEARCH_ID = "ember-map-search-input";
const OVERVIEW_STORAGE_KEY = "ember.overview.v1";

function readSavedOverview(): { place?: GuidePlace; view?: OverviewView; mapView?: MapView; realistic?: boolean; windTexture?: boolean; adminLevel?: string } {
  try {
    const saved = JSON.parse(localStorage.getItem(OVERVIEW_STORAGE_KEY) ?? "null") as {
      place?: Partial<GuidePlace> | null;
      view?: unknown;
      mapView?: unknown;
      realistic?: unknown;
      windTexture?: unknown;
      adminLevel?: unknown;
    } | null;
    const p = saved?.place;
    const validPlace =
      p &&
      typeof p.name === "string" &&
      typeof p.region === "string" &&
      Number.isFinite(p.lat) &&
      Number.isFinite(p.lng) &&
      Math.abs(p.lat!) <= 90 &&
      Math.abs(p.lng!) <= 180;
    return {
      place: validPlace
        ? {
            name: p.name!,
            region: p.region!,
            lat: p.lat!,
            lng: p.lng!,
            osm: typeof p.osm === "string" && /^[NWR]\d{1,12}$/.test(p.osm) ? p.osm : undefined,
            kind: typeof p.kind === "string" ? p.kind.slice(0, 40) : undefined,
          }
        : undefined,
      view: VIEWS.includes(saved?.view as OverviewView) ? (saved!.view as OverviewView) : undefined,
      mapView: saved?.mapView === "globe" || saved?.mapView === "mercator" ? saved.mapView : undefined,
      realistic: typeof saved?.realistic === "boolean" ? saved.realistic : undefined,
      windTexture: saved?.windTexture === true,
      adminLevel: typeof saved?.adminLevel === "string" ? saved.adminLevel : undefined,
    };
  } catch {
    return {};
  }
}

const SEVERITY_OF: Record<Confidence, string> = {
  high: "critical",
  medium: "high",
  low: "low",
};

const BADGE_OF: Record<Confidence, string> = {
  high: "HIGH",
  medium: "MEDIUM",
  low: "LOW",
};

export function EmberDashboard() {
  const { dark } = useTheme();
  const mapRef = useRef<EmberMapInstance | null>(null);
  const handleMapReady = useCallback((map: EmberMapInstance) => {
    mapRef.current = map;
  }, []);
  // null = default monitored region (Bukidnon); set = any searched/located/clicked place on Earth.
  const [place, setPlace] = useState<GuidePlace | null>(null);
  const [view, setView] = useState<OverviewView>("fires");
  const [mapView, setMapView] = useState<MapView>("globe");
  // Preferred admin level for the climate views (e.g. "city", "state"); null = the place's default.
  const [adminLevel, setAdminLevel] = useState<string | null>(null);
  // blueMarble on = "Realistic" (NASA GIBS satellite imagery); off = "Normal" vector basemap.
  const [layers, setLayers] = useState<EmberMapLayers>({
    blueMarble: false,
    countryBorders: true,
    firmsWms: false, // optional (Layers): live markers + heatspots show the same fires without spending the key's quota
    clusteredHotspots: true,
  });
  // Third map style: the wind-speed colours as the map texture (earth.nullschool / Zoom Earth look).
  const [windTexture, setWindTexture] = useState(false);
  const [restored, setRestored] = useState(false);
  const handleLocate = useCallback((place: GuidePlace) => {
    setPlace(place);
  }, []);

  // Survive a refresh: restore the last place + view, then keep them saved (per-browser convenience only).
  useEffect(() => {
    const saved = readSavedOverview();
    if (saved.place) handleLocate(saved.place);
    if (saved.view) setView(saved.view);
    if (saved.mapView) setMapView(saved.mapView);
    if (saved.realistic !== undefined) setLayers((prev) => ({ ...prev, blueMarble: saved.realistic! }));
    if (saved.windTexture) setWindTexture(true);
    if (saved.adminLevel) setAdminLevel(saved.adminLevel);
    setRestored(true);
  }, [handleLocate]);
  useEffect(() => {
    if (!restored) return;
    try {
      localStorage.setItem(
        OVERVIEW_STORAGE_KEY,
        JSON.stringify({ place, view, mapView, realistic: layers.blueMarble, windTexture, adminLevel }),
      );
    } catch {
      // storage blocked (private mode etc.) — the page still works, it just won't remember
    }
  }, [place, view, mapView, layers.blueMarble, windTexture, adminLevel, restored]);

  const climate = view !== "fires"; // temperature or heat-index view
  const focusPlace = place ?? (climate ? DEFAULT_PLACE : null);
  const conditionsQuery = useQuery({
    queryKey: conditionsKey(focusPlace?.lat ?? 0, focusPlace?.lng ?? 0),
    queryFn: () => fetchConditions(focusPlace!.lat, focusPlace!.lng),
    enabled: climate && focusPlace !== null,
    staleTime: 10 * 60 * 1000,
  });
  // The place's real admin hierarchy (country → region → province/state → … → village).
  const lat3 = focusPlace?.lat.toFixed(3);
  const lng3 = focusPlace?.lng.toFixed(3);
  const levelsQuery = useQuery({
    queryKey: ["admin-levels", lat3, lng3],
    queryFn: async (): Promise<LevelsPayload> => {
      const res = await fetch(`/api/boundary?lat=${focusPlace!.lat}&lng=${focusPlace!.lng}`);
      if (!res.ok) throw new Error(`levels ${res.status}`);
      return res.json();
    },
    enabled: focusPlace !== null, // wildfire view uses the same area as the climate views
    staleTime: Infinity, // admin areas don't change
    retry: 1,
  });
  const levels = levelsQuery.data?.levels ?? null;
  // A place picked from search (e.g. "Bukidnon" the province, "Texas" the state) IS the area to cover —
  // its exact OSM border — until the user picks a different level chip for that place.
  const placeKey = focusPlace ? `${focusPlace.lat},${focusPlace.lng}` : "";
  const [levelChosenFor, setLevelChosenFor] = useState<string | null>(null);
  const pickedArea = !!focusPlace?.osm && levelChosenFor !== placeKey;
  const chooseLevel = useCallback(
    (key: string) => {
      setAdminLevel(key);
      setLevelChosenFor(placeKey);
    },
    [placeKey],
  );
  const sameName = (a?: string, b?: string) => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();
  // Picked area → highlight its own chip; otherwise the preferred level (carries over between places) or the default.
  const level = pickedArea
    ? (levels?.find((l) => sameName(l.name, focusPlace?.name)) ?? null)
    : (levels?.find((l) => l.key === adminLevel) ?? levels?.find((l) => l.key === levelsQuery.data?.defaultKey) ?? null);
  // Border of the chosen area so the heat areas cover exactly it (e.g. Valencia City, or all of Bukidnon).
  const boundaryQuery = useQuery({
    queryKey: pickedArea ? ["boundary-osm", focusPlace?.osm] : ["boundary", lat3, lng3, level?.key, level?.name],
    queryFn: async (): Promise<BoundaryPayload> => {
      const qs = new URLSearchParams({ lat: String(focusPlace!.lat), lng: String(focusPlace!.lng) });
      if (pickedArea) {
        qs.set("osm", focusPlace!.osm!);
        qs.set("kind", focusPlace!.kind ?? "");
      } else {
        qs.set("level", level!.key);
        qs.set("name", level!.name);
      }
      const res = await fetch(`/api/boundary?${qs}`);
      if (!res.ok) throw new Error(`boundary ${res.status}`);
      return res.json();
    },
    enabled: focusPlace !== null && (pickedArea || level !== null),
    staleTime: Infinity,
    retry: 1,
  });
  const boundary = boundaryQuery.data?.geometry ?? null;
  const boundaryBbox = boundaryQuery.data?.bbox ?? null;
  const boundaryName = boundaryQuery.data?.name ?? null;
  // The chosen level exists but has no mapped border (e.g. a barangay mapped only as a point):
  // cover nothing rather than an invented square, and say so.
  const borderMissing = (pickedArea || level !== null) && boundaryQuery.isSuccess && boundary === null;
  const missingName = pickedArea ? (focusPlace?.name ?? null) : (level?.name ?? null);
  // Wait for the border so the weather grid covers exactly the chosen area (a village, or a whole country).
  // Only when the lookups themselves fail (offline, open sea) fall back to ~100 km around the place.
  const borderReady = boundaryQuery.isError || (boundaryQuery.isSuccess && boundary !== null);
  const areaSettled = pickedArea
    ? borderReady
    : levelsQuery.isError || (levelsQuery.isSuccess && (!level || borderReady));
  const gridQuery = useQuery({
    queryKey: ["heat-grid", focusPlace?.lat ?? 0, focusPlace?.lng ?? 0, boundaryBbox?.join(",") ?? "point"],
    queryFn: () => fetchHeatGrid(focusPlace!.lat, focusPlace!.lng, boundaryBbox),
    enabled: climate && focusPlace !== null && areaSettled,
    staleTime: 30 * 60 * 1000,
  });
  const temp = conditionsQuery.data;
  const heatIdx = temp?.tempC != null && temp.humidity != null ? heatIndexC(temp.tempC, temp.humidity) : null;
  const heat = heatIdx === null ? "None" : heatLevel(heatIdx);
  const maxHi = temp?.maxHeatIndexC ?? null;
  const gridCells = gridQuery.data;
  const metric = view === "temperature" ? "tempC" : "maxHeatIndexC";
  const domain = useMemo(() => (climate && gridCells ? gridDomain(gridCells, metric) : null), [climate, gridCells, metric]);
  // Slider selection; null = the full range of values around the place.
  const [tempRange, setTempRange] = useState<[number, number] | null>(null);
  // New place or metric → show everything again. (Not on data arrival, so a range set while loading is kept.)
  useEffect(() => setTempRange(null), [focusPlace?.lat, focusPlace?.lng, metric]);
  // Sliders stay usable without data: they span the whole legend scale until the area's own min–max is known.
  const sliderDomain: [number, number] = domain ?? [0, 55];
  const range: [number, number] = [
    Math.max(sliderDomain[0], Math.min(tempRange?.[0] ?? sliderDomain[0], sliderDomain[1])),
    Math.min(sliderDomain[1], Math.max(tempRange?.[1] ?? sliderDomain[1], sliderDomain[0])),
  ];
  const rangeLo = range?.[0];
  const rangeHi = range?.[1];
  const contours = useMemo(() => {
    if (borderMissing || !gridCells || rangeLo === undefined || rangeHi === undefined) return null;
    const all = contourAreas(gridCells, metric, rangeLo, rangeHi);
    // No border found (open sea, unmapped area, lookup failed): fall back to the surrounding area.
    return boundary ? clipToBoundary(all.areas, boundary) : all;
  }, [borderMissing, gridCells, metric, rangeLo, rangeHi, boundary]);
  const [confidence, setConfidence] = useState<"all" | Confidence>("all");
  const [showViirs, setShowViirs] = useState(true);
  const [showModis, setShowModis] = useState(true);
  const [harmonized, setHarmonized] = useState(true);
  const [todayStr] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [quickRange, setQuickRange] = useState<QuickRange | null>("today");
  const [granularity, setGranularity] = useState<Granularity>("daily");
  const [historicalDate, setHistoricalDate] = useState<string | null>(null);
  const [spanDays, setSpanDays] = useState<SpanDays>(1);
  const [scrubIndex, setScrubIndex] = useState<number>(1);
  const [playing, setPlaying] = useState(false);
  const live = true; // NASA FIRMS live feed only — no sample data
  const [bbox, setBbox] = useState<[number, number, number, number]>([7.3, 124.5, 8.6, 125.5]);

  const timelineModel = useMemo(
    () =>
      buildTimelineSteps({
        todayStr,
        historicalDate,
        spanDays,
        granularity,
        quickRange,
      }),
    [todayStr, historicalDate, spanDays, granularity, quickRange],
  );
  const clampedScrubIndex = Math.max(
    0,
    Math.min(Math.max(0, timelineModel.steps.length - 1), scrubIndex),
  );
  const activeStep = timelineModel.steps[clampedScrubIndex] ?? timelineModel.steps[0]!;
  const isHistoricalMode = timelineModel.isHistorical;
  const activeScrubDate = activeStep.date;
  const activeYear = Number(activeScrubDate.slice(0, 4));
  const isModisEraOnly = activeYear >= 2000 && activeYear <= 2011;
  const effectiveShowViirs = !isModisEraOnly && showViirs;

  const wfsWindow: "24h" | "7d" =
    spanDays > 1 || (quickRange !== "today" && quickRange !== "24h") ? "7d" : "24h";
  const effectiveSensorParam: "BOTH" | "VIIRS" | "MODIS" =
    effectiveShowViirs && showModis ? "BOTH" : effectiveShowViirs ? "VIIRS" : "MODIS";
  // Search the chosen area's extent plus ~NEARBY_KM around it ([minLat, minLon, maxLat, maxLon]), so fires just
  // outside the border (which the wind can push in) are known; ~55 km square only without a border.
  // shortcut: an area crossing the dateline is clamped at ±180°, so its far side is not searched; split the box if that matters.
  const effectiveBbox: [number, number, number, number] = place
    ? boundaryBbox
      ? [boundaryBbox[1] - NEARBY_KM / 111, boundaryBbox[0] - NEARBY_KM / 111, boundaryBbox[3] + NEARBY_KM / 111, boundaryBbox[2] + NEARBY_KM / 111]
      : [place.lat - 0.5, place.lng - 0.5, place.lat + 0.5, place.lng + 0.5]
    : bbox;
  const bboxKey = effectiveBbox.map((n) => n.toFixed(2)).join(",");
  const near = place ? { lat: place.lat, lng: place.lng, name: place.name } : null; // distances are from the searched point
  const firmsQuery = useQuery({
    queryKey: [
      "firms-wfs",
      wfsWindow,
      historicalDate ?? "live",
      spanDays,
      isModisEraOnly ? "MODIS" : "BOTH",
      bboxKey,
      near?.lat,
      near?.lng,
      near?.name,
    ],
    placeholderData: keepPreviousData, // zoom/pan/scrub: keep fires on screen while loading
    queryFn: () =>
      fetchFirmsWfsHotspots({
        bbox: effectiveBbox,
        window: wfsWindow,
        near,
        date: historicalDate ?? (spanDays > 7 ? timelineModel.startDate : null),
        days: historicalDate || spanDays > 7 ? spanDays : undefined,
        sensor: effectiveSensorParam,
      }),
    // Wait for the area's border, so the first request already covers the right area.
    enabled: (live || isHistoricalMode) && (!place || areaSettled || borderMissing),
    staleTime: 2 * 60 * 1000,
    retry: 1,
  });
  const isLiveFeedActive = (live || isHistoricalMode) && Boolean(firmsQuery.data);
  const regionLabel = place ? [place.name, place.region].filter(Boolean).join(" · ") : "Bukidnon, Mindanao · Philippines";
  const [selectedId, setSelectedId] = useState<number>(0);
  const [selectedLayer, setSelectedLayer] = useState("Thermal anomalies");
  const [search, setSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      setScrubIndex((idx) => {
        if (idx >= timelineModel.steps.length - 1) {
          setPlaying(false);
          return idx;
        }
        return idx + 1;
      });
    }, granularity === "subdaily" ? 900 : 1200);
    return () => clearInterval(timer);
  }, [playing, timelineModel.steps.length, granularity]);

  const handleSelectQuickRange = useCallback(
    (next: QuickRange) => {
      const nextSpan: SpanDays = next === "7d" ? 7 : next === "3d" ? 3 : 1;
      const nextSteps = buildTimelineSteps({
        todayStr,
        historicalDate: null,
        spanDays: nextSpan,
        granularity,
        quickRange: next,
      }).steps;
      setQuickRange(next);
      setHistoricalDate(null);
      setSpanDays(nextSpan);
      setPlaying(false);
      setScrubIndex(Math.max(0, nextSteps.length - 1));
    },
    [todayStr, granularity],
  );

  const handleChangeGranularity = useCallback(
    (nextGran: Granularity) => {
      const prevMax = Math.max(1, timelineModel.steps.length - 1);
      const nextSteps = buildTimelineSteps({
        todayStr,
        historicalDate,
        spanDays,
        granularity: nextGran,
        quickRange,
      }).steps;
      const nextMax = Math.max(0, nextSteps.length - 1);
      setGranularity(nextGran);
      setPlaying(false);
      setScrubIndex(Math.round((clampedScrubIndex / prevMax) * nextMax));
      if (nextGran === "subdaily" && !climate) {
        setSpreadOn(true);
      }
    },
    [todayStr, historicalDate, spanDays, quickRange, timelineModel.steps.length, clampedScrubIndex, climate],
  );

  const handleSelectHistoricalDate = useCallback(
    (dateStr: string) => {
      const clamped = dateStr < "2000-11-01" ? "2000-11-01" : dateStr > todayStr ? todayStr : dateStr;
      if (clamped >= todayStr) {
        const nextSteps = buildTimelineSteps({
          todayStr,
          historicalDate: null,
          spanDays: 1,
          granularity,
          quickRange: "today",
        }).steps;
        setHistoricalDate(null);
        setQuickRange("today");
        setSpanDays(1);
        setPlaying(false);
        setScrubIndex(Math.max(0, nextSteps.length - 1));
        return;
      }
      setHistoricalDate(clamped);
      setQuickRange(null);
      setPlaying(false);
      setScrubIndex(0);
    },
    [todayStr, granularity],
  );

  const handleChangeSpanDays = useCallback(
    (nextSpan: SpanDays) => {
      const nextQuick: QuickRange | null = historicalDate
        ? null
        : nextSpan === 1
          ? "today"
          : nextSpan === 3
            ? "3d"
            : nextSpan === 7
              ? "7d"
              : null;
      const nextSteps = buildTimelineSteps({
        todayStr,
        historicalDate,
        spanDays: nextSpan,
        granularity,
        quickRange: nextQuick,
      }).steps;
      setSpanDays(nextSpan);
      setQuickRange(nextQuick);
      setPlaying(false);
      setScrubIndex(historicalDate ? 0 : Math.max(0, nextSteps.length - 1));
    },
    [todayStr, historicalDate, granularity],
  );

  const handleBackToLive = useCallback(() => {
    const nextSteps = buildTimelineSteps({
      todayStr,
      historicalDate: null,
      spanDays: 1,
      granularity,
      quickRange: "today",
    }).steps;
    setHistoricalDate(null);
    setQuickRange("today");
    setSpanDays(1);
    setPlaying(false);
    setScrubIndex(Math.max(0, nextSteps.length - 1));
  }, [todayStr, granularity]);

  // Individual detections passing the filters (live FIRMS pixels or the historical archive).
  // Inside the chosen area's real border (e.g. Valencia City, all of Bukidnon); if it has none, the fires within
  // NEARBY_KM of the border instead, marked as such, so spread/heatspots still show what threatens the area.
  const { fires: filteredFires, nearby: firesNearby } = useMemo(() => {
    const query = search.toLowerCase();
    const matchesFilter = (hotspot: Hotspot) => {
      if (confidence !== "all" && hotspot.confidence !== confidence) return false;
      const sensors = hotspot.sources ?? [hotspot.source];
      if (!sensors.some((s) => (s === "VIIRS" ? effectiveShowViirs : showModis))) return false;
      if (
        !hotspotMatchesStep({
          hotspot,
          step: activeStep,
          granularity,
          isHistorical: isHistoricalMode,
          isSingleDayWindow: spanDays === 1,
          quickRange,
          spanDays,
        })
      ) {
        return false;
      }
      if (
        query &&
        !`${hotspot.name} ${hotspot.settlement} ${hotspot.municipality}`
          .toLowerCase()
          .includes(query)
      )
        return false;
      return true;
    };

    // Live feed only: while loading or on error, show none.
    const source = isLiveFeedActive && firmsQuery.data ? firmsQuery.data.data : NO_HOTSPOTS;
    const fires = source.filter(matchesFilter);
    if (!boundary) return { fires, nearby: false };
    return splitByBorder(fires, boundary, booleanPointInPolygon, pointToPolygonDistance);
  }, [
    confidence,
    effectiveShowViirs,
    showModis,
    activeStep,
    granularity,
    isHistoricalMode,
    spanDays,
    quickRange,
    search,
    isLiveFeedActive,
    firmsQuery.data,
    place,
    boundary,
  ]);
  const areaName = boundaryName ?? place?.name ?? "this area";

  const harmonizedClusters: ClusteredHotspot[] = useMemo(
    () => clusterHotspots(filteredFires),
    [filteredFires],
  );
  const unharmonizedList: ClusteredHotspot[] = useMemo(
    () => unharmonizedHotspots(filteredFires),
    [filteredFires],
  );
  const harmonizationStats = useMemo(
    () => computeHarmonizationStats(filteredFires, harmonizedClusters),
    [filteredFires, harmonizedClusters],
  );
  const visibleHotspots: ClusteredHotspot[] = useMemo(
    () => (harmonized ? harmonizedClusters : unharmonizedList),
    [harmonized, harmonizedClusters, unharmonizedList],
  );
  // Heatspots: every detection (not the clusters), weighted by its fire radiative power when known.
  const heatPoints = useMemo(
    () => filteredFires.map((h) => ({ lat: h.lat, lng: h.lng, weight: h.frp ?? h.count })),
    [filteredFires],
  );

  // Wind overlays (Wildfires view): animated live wind, wind-driven spread estimate, heatspot glow.
  // Part of LIVE mode: wind and heatspots start on (LIVE is the default) and come back on when LIVE is picked.
  const [windOn, setWindOn] = useState(true);
  // Floating side panel (wide screens): slide it away for a full view of the map; remembered on this device.
  const [panelOpen, setPanelOpen] = useState(true);
  useEffect(() => {
    try {
      const saved = localStorage.getItem("ember.panelOpen");
      // Phones/tablets start on the full map (the panel would cover most of it); after that, the user's choice.
      if (saved === "0" || (saved === null && window.matchMedia("(max-width: 1100px)").matches)) setPanelOpen(false);
    } catch {
      /* storage blocked: open */
    }
  }, []);
  const togglePanel = (open: boolean) => {
    setPanelOpen(open);
    try {
      localStorage.setItem("ember.panelOpen", open ? "1" : "0");
    } catch {
      /* not remembered */
    }
  };
  const [windPace, setWindPace] = useState(1); // animation speed only (Slow 0.5× / Normal / Fast 2×), not the data
  const [spreadOn, setSpreadOn] = useState(false);
  const [heatOn, setHeatOn] = useState(true);
  const [viewBbox, setViewBbox] = useState<[number, number, number, number]>([7.3, 124.5, 8.6, 125.5]);
  // One global wind field (NOAA GFS) covers the whole map at every zoom; refreshed every 30 min.
  const windQuery = useQuery({
    queryKey: ["wind-field"],
    queryFn: fetchWindField,
    enabled: !climate && windOn,
    staleTime: 30 * 60 * 1000,
    refetchInterval: 30 * 60 * 1000,
    // NOAA is often slow: keep retrying (the last good wind stays on the map meanwhile).
    retry: 4,
    retryDelay: (n) => Math.min(30_000, 3_000 * 2 ** n),
  });
  // shortcut: spread is estimated for the 40 strongest fires only, to keep the request small.
  const spreadFires = useMemo(() => visibleHotspots.slice(0, 40).map((h) => ({ lat: h.lat, lng: h.lng })), [visibleHotspots]);
  const fireWindQuery = useQuery({
    queryKey: ["fire-wind", spreadFires.map((f) => `${f.lat.toFixed(3)},${f.lng.toFixed(3)}`).join(";")],
    placeholderData: keepPreviousData,
    queryFn: () => fetchFireWinds(spreadFires),
    enabled: !climate && spreadOn && spreadFires.length > 0,
    staleTime: 15 * 60 * 1000,
    retry: 1,
  });
  const spread = useMemo(() => (fireWindQuery.data ? spreadFeatures(fireWindQuery.data) : null), [fireWindQuery.data]);
  // Proximity alert: selected point near a FIRMS fire (≤25 km) or inside a spread ellipse.
  const guidePoint = place ?? DEFAULT_PLACE;
  const nearestFireKm = useMemo(
    () => (filteredFires.length ? Math.min(...filteredFires.map((h) => haversineKm(guidePoint.lat, guidePoint.lng, h.lat, h.lng))) : null),
    [filteredFires, guidePoint.lat, guidePoint.lng],
  );
  const inSpread = useMemo(() => {
    if (climate || !spreadOn || !spread) return false;
    try {
      return spread.features.some((f) => f.geometry.type === "Polygon" && booleanPointInPolygon([guidePoint.lng, guidePoint.lat], f.geometry));
    } catch {
      return false;
    }
  }, [climate, spreadOn, spread, guidePoint.lat, guidePoint.lng]);
  const fireDanger = !climate && ((nearestFireKm !== null && nearestFireKm <= 25) || inSpread);
  // Wind right now at the place (or the map centre), for the sidebar readout.
  const windHere = useMemo(() => {
    if (!windQuery.data) return null;
    const lat = place?.lat ?? (viewBbox[0] + viewBbox[2]) / 2;
    const lng = place?.lng ?? (viewBbox[1] + viewBbox[3]) / 2;
    const v = sampleWind(windQuery.data, lat, lng);
    const toward = ((Math.atan2(v.u, v.v) * 180) / Math.PI + 360) % 360;
    return { speed: Math.hypot(v.u, v.v), from: compassOf(toward + 180), toward: compassOf(toward) };
  }, [windQuery.data, place, viewBbox]);

  // Memoized: a new array every render would re-run the map's marker/pan effect and cut off fly-to animations.
  const selectedHotspot = visibleHotspots.find((h) => h.id === selectedId) ?? visibleHotspots[0];
  const selectedIndex = selectedHotspot ? visibleHotspots.indexOf(selectedHotspot) : 0;
  const mapIncidents = useMemo(
    () =>
      climate
        ? []
        : visibleHotspots.map((h, i) => ({
            name: h.name,
            count: h.count,
            severity: SEVERITY_OF[h.confidence],
            lat: h.lat,
            lng: h.lng,
            sources: h.sources,
            footprint: h.geoJsonPolygon,
            // Label for the selected point: hover on desktop, tap again on mobile.
            detail:
              i === selectedIndex
                ? {
                    badge: `${BADGE_OF[h.confidence]}${h.fusedConfidencePercent !== undefined ? ` · ${h.fusedConfidencePercent}%` : ""}`,
                    sub: `${h.proximityKm.toFixed(1)} km from nearest town`,
                    stats: `${h.count} hotspots · ${(h.sources ?? [h.source]).join(" + ")} · ${h.brightness} K${h.frp !== undefined ? ` · ${h.frp} MW` : ""}`,
                  }
                : undefined,
          })),
    [visibleHotspots, climate, selectedIndex],
  );
  const pinLabel = !focusPlace
    ? ""
    : view === "temperature"
      ? `${focusPlace.name} · ${temp?.tempC != null ? `${Math.round(temp.tempC)}°C` : "…"}`
      : view === "heatindex"
        ? `${focusPlace.name} · HI ${maxHi !== null ? `${Math.round(maxHi)}°C` : "…"}`
        : focusPlace.name;

  // Spread on (or another fire picked): fly to that fire, close enough that its +1 h / +3 h / +6 h zones are
  // clearly visible. They are drawn true to scale, so at region zoom a light wind's zones hide under the marker.
  const fittedSpread = useRef<string | null>(null);
  useEffect(() => {
    if (!spreadOn || climate) {
      fittedSpread.current = null;
      return;
    }
    const fw = fireWindQuery.data?.find((f) => f.lat === selectedHotspot?.lat && f.lng === selectedHotspot?.lng) ?? fireWindQuery.data?.[0];
    if (!fw) return;
    const key = `${fw.lat},${fw.lng}`;
    if (fittedSpread.current === key) return;
    const e = spreadEllipse(fw.lat, fw.lng, fw.hourly, 6);
    if (!e) return;
    fittedSpread.current = key;
    const ring = [...e.polygon.coordinates[0]!, [fw.lng, fw.lat]];
    const xs = ring.map((c) => c[0]!), ys = ring.map((c) => c[1]!);
    mapRef.current?.fitBounds(
      [[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]],
      { padding: 110, maxZoom: 15, duration: 1800 },
    );
  }, [spreadOn, climate, fireWindQuery.data, selectedHotspot?.lat, selectedHotspot?.lng]);

  const liveStatus: EmberLiveStatus = useMemo(() => {
    if (firmsQuery.isFetching) return { mode: "live", state: "loading" };
    if (firmsQuery.isError) {
      return {
        mode: "live",
        state: "error",
        errorMessage: firmsQuery.error instanceof Error ? firmsQuery.error.message : "Sync failed",
      };
    }
    const fetchedAt = firmsQuery.data?.fetchedAt;
    const formattedTime = fetchedAt
      ? new Date(fetchedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : undefined;
    return {
      mode: "live",
      state: firmsQuery.data ? "synced" : "idle",
      lastSync: formattedTime,
      region: firmsQuery.data?.region,
    };
  }, [isHistoricalMode, firmsQuery.isFetching, firmsQuery.isError, firmsQuery.error, firmsQuery.data]);

  // Bottom sheet over the pinned map: dim the map as it slides up; offer a way back once it's well up.
  const [sheetProgress, setSheetProgress] = useState(0);
  useEffect(() => {
    const onScroll = () => setSheetProgress(window.scrollY / Math.max(1, window.innerHeight));
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const mapDim = Math.min(0.55, sheetProgress * 0.7);
  const showBackToMap = sheetProgress > 0.25;
  // "]" toggles the right panel (not while typing).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.key !== "]" || e.metaKey || e.ctrlKey || e.altKey || t?.closest("input, textarea, select, [contenteditable=true]")) return;
      e.preventDefault();
      togglePanel(!panelOpen);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Publish a live summary for the sidebar's telemetry cards (shown on every page via the shared query cache).
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!isLiveFeedActive) return;
    const n = newest(filteredFires);
    const today = new Date().toISOString().slice(0, 10);
    const t: SidebarTelemetry = {
      latest: n && {
        name: n.name,
        distanceKm: n.proximityKm,
        date: n.acqDate === today ? "Today" : n.acqDate,
        time: n.acqTime,
        source: n.source,
        conf: n.confidence,
        lat: n.lat,
        lng: n.lng,
      },
      window: {
        fused: visibleHotspots.length,
        raw: filteredFires.length,
        dual: visibleHotspots.filter((h) => (h.sources?.length ?? 1) > 1).length,
        viirs: filteredFires.filter((f) => f.source === "VIIRS").length,
        modis: filteredFires.filter((f) => f.source === "MODIS").length,
        bufferKm: firesNearby ? NEARBY_KM : null,
      },
      boundary: {
        place: areaName,
        windKmh: windHere ? Math.round(windHere.speed) : null,
        from: windHere?.from ?? null,
        toward: windHere?.toward ?? null,
        inside: firesNearby ? 0 : filteredFires.length,
        border: firesNearby ? filteredFires.length : 0,
        spread: spreadOn ? "On" : "Off",
        region: place?.region?.split(" · ").at(-1) || "Bukidnon",
        sync: liveStatus.lastSync ?? "—",
      },
    };
    queryClient.setQueryData(TELEMETRY_KEY, t);
  }, [queryClient, isLiveFeedActive, filteredFires, visibleHotspots, firesNearby, areaName, windHere, spreadOn, place, liveStatus.lastSync]);

  return (
    <EmberShell
      cover
      active="overview"
      title="Overview"
      liveStatus={liveStatus}
      headerLeft={
        <Button
          variant="outline"
          size="sm"
          className="h-8 max-w-[160px] shrink-0 gap-1.5 border-primary/30 bg-primary/10 px-2.5 text-primary hover:bg-primary/15"
          aria-label={`Location: ${focusPlace?.name ?? "Bukidnon region"}. Search a place`}
          title={regionLabel}
          onClick={() => document.getElementById(MAP_SEARCH_ID)?.focus()}
        >
          <MapPin size={14} />
          <span className="truncate">{focusPlace?.name ?? "Bukidnon"}</span>
        </Button>
      }
      headerSearch={
        <PlaceCombobox
          inputId={MAP_SEARCH_ID}
          className="relative flex h-8 w-56 shrink-0 items-center gap-2 rounded-md border bg-background/70 px-2 text-muted-foreground [&>input]:h-full [&>input]:min-w-0 [&>input]:flex-1 [&>input]:bg-transparent [&>input]:text-xs [&>input]:text-foreground [&>input]:outline-none"
          label="Search any place or filter incidents"
          placeholder="Search any place or incident"
          value={search}
          onChange={setSearch}
          onPick={(picked) => {
            setSearch("");
            handleLocate(picked);
          }}
          before={<Search size={14} className="shrink-0" />}
          after={
            search ? (
              <button type="button" aria-label="Clear search" onClick={() => setSearch("")}>
                <X size={13} />
              </button>
            ) : (
              <kbd className="rounded border px-1 font-mono text-[9px]">⌘ K</kbd>
            )
          }
        />
      }
      headerRight={
        <>
          <ToggleGroup type="single" value={mapView} onValueChange={(v) => (v === "globe" || v === "mercator") && setMapView(v)} aria-label="Map view" className="shrink-0 rounded-lg border p-0.5">
            {(
              [
                ["globe", "Globe", Globe, "3D globe view"],
                ["mercator", "Flat", MapIcon, "Flat map view"],
              ] as const
            ).map(([key, label, Icon, title]) => (
              <ToggleGroupItem key={key} value={key} title={title} aria-label={label} className="h-7 px-2 font-mono text-[10px] font-semibold tracking-wide uppercase gap-1">
                <Icon size={12} /> {label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <ToggleGroup
            type="single"
            value={windTexture ? "wind" : layers.blueMarble ? "realistic" : "normal"}
            onValueChange={(v) => {
              if (!v) return;
              setWindTexture(v === "wind");
              setLayers((prev) => ({ ...prev, blueMarble: v === "realistic" }));
              if (v === "wind") setWindOn(true); // the texture IS the wind: make sure it's loaded
            }}
            aria-label="Map style"
            className="shrink-0 rounded-lg border p-0.5"
          >
            {(
              [
                ["normal", "Normal", Layers, "Normal map: streets, labels and 3D buildings"],
                ["realistic", "Realistic", Satellite, "Realistic: satellite imagery"],
                ["wind", "Wind", Wind, "Wind: full-colour live wind speed with white streamlines"],
              ] as const
            ).map(([key, label, Icon, title]) => (
              <ToggleGroupItem key={key} value={key} title={title} aria-label={label} className="h-7 px-2 font-mono text-[10px] font-semibold tracking-wide uppercase gap-1">
                <Icon size={12} /> {label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          {view === "fires" && (
            <ToggleGroup
              type="multiple"
              value={[effectiveShowViirs ? "viirs" : "", showModis ? "modis" : ""].filter(Boolean)}
              onValueChange={(v) => {
                if (!isModisEraOnly) setShowViirs(v.includes("viirs"));
                setShowModis(v.includes("modis"));
              }}
              aria-label="Sensor layers"
              className="shrink-0 rounded-lg border p-0.5"
            >
              <ToggleGroupItem value="viirs" disabled={isModisEraOnly} title={isModisEraOnly ? "VIIRS launched in 2012" : "VIIRS 375 m"} aria-label="VIIRS" className="h-7 px-2 font-mono text-[10px] font-semibold tracking-wide uppercase">
                VIIRS
              </ToggleGroupItem>
              <ToggleGroupItem value="modis" title="MODIS 1 km" aria-label="MODIS" className="h-7 px-2 font-mono text-[10px] font-semibold tracking-wide uppercase">
                MODIS
              </ToggleGroupItem>
            </ToggleGroup>
          )}
          <Button variant="outline" size="sm" className="h-8 shrink-0 gap-1.5 font-mono text-[10px] uppercase" onClick={() => setFiltersOpen(!filtersOpen)}>
            <SlidersHorizontal size={13} /> Layers
          </Button>
        </>
      }
    >
      <div className="ember-cover">
        {/* Full-screen map, pinned behind everything; panels float over it and never resize it. */}
        <section className="ember-map-section fixed inset-0 z-0" id="map">
          <div className="ember-map-layout">
            <div
              className="ember-map-canvas"
              role="img"
              aria-label={`OpenStreetMap-based thermal anomaly map of ${regionLabel}`}
            >
              <EmberMap
                incidents={mapIncidents}
                selected={Math.max(selectedIndex, 0)}
                onSelect={(index) => {
                  const hotspot = visibleHotspots[index];
                  if (hotspot) setSelectedId(hotspot.id);
                }}
                dark={dark}
                onReady={handleMapReady}
                layers={layers}
                showViirs={effectiveShowViirs}
                showModis={showModis}
                activeDate={activeScrubDate}
                isHistoricalDate={isHistoricalMode}
                onBoundsChange={(b) => setBbox((prev) => (keepBox(prev, b) ? prev : b))} // zooming in keeps the loaded fires
                onViewChange={setViewBbox}
                projection={mapView}
                focus={focusPlace ? { lat: focusPlace.lat, lng: focusPlace.lng, label: pinLabel } : null}
                areas={climate ? (contours?.areas ?? null) : null}
                outline={boundary}
                fitTo={boundaryBbox}
                wind={!climate && windOn ? (windQuery.data ?? null) : null}
                windTexture={windTexture}
                windPace={windPace}
                spread={!climate && spreadOn ? spread : null}
                spreadWinds={!climate && spreadOn ? (fireWindQuery.data ?? null) : null}
                spreadPreviewHour={
                  !climate && spreadOn && granularity === "subdaily" ? activeStep.spreadHours : null
                }
                heatPoints={!climate && heatOn ? heatPoints : null}
                onMapClick={
                  climate
                    ? (lat, lng) =>
                        handleLocate({ name: "Selected point", region: `${lat.toFixed(3)}, ${lng.toFixed(3)}`, lat, lng })
                    : undefined
                }
              />

              {fireDanger && (
                <button
                  type="button"
                  className="ember-fire-badge"
                  onClick={() => document.getElementById("smart-action-guide")?.scrollIntoView({ behavior: "smooth", block: "start" })}
                  aria-label={`${inSpread ? "This point is in the projected fire-spread area" : `Fire within 25 km, nearest ${nearestFireKm!.toFixed(1)} km away`}. Open action guide`}
                >
                  <Flame size={13} />
                  <span>{inSpread ? "In fire-spread area" : `Fire ${nearestFireKm!.toFixed(1)} km away`}</span>
                  <ChevronRight size={13} />
                </button>
              )}
              <div className="ember-map-tools">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Zoom in"
                  onClick={() => mapRef.current?.zoomIn()}
                >
                  <Plus size={17} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Zoom out"
                  onClick={() => mapRef.current?.zoomOut()}
                >
                  <Minus size={17} />
                </Button>
                <span />
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Center map"
                  onClick={() =>
                    mapRef.current?.panTo([
                      // MapLibre takes [lng, lat]
                      selectedHotspot?.lng ?? 125.05,
                      selectedHotspot?.lat ?? 7.95,
                    ])
                  }
                >
                  <LocateFixed size={16} />
                </Button>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="ember-fullscreen"
                aria-label="Expand map"
                onClick={() =>
                  document.querySelector(".ember-map-section .ember-map-layout")?.classList.toggle("map-expanded")
                }
              >
                <Maximize2 size={15} />
              </Button>
              {filtersOpen && (
                <div className="ember-layer-popover">
                  <div>
                    <b>Map layers</b>
                    <button aria-label="Close layers" onClick={() => setFiltersOpen(false)}>
                      <X size={14} />
                    </button>
                  </div>
                  {(
                    [
                      { key: "blueMarble", label: "Blue Marble" },
                      { key: "countryBorders", label: "Country Borders" },
                      { key: "firmsWms", label: "FIRMS WMS Raster Dots" },
                      { key: "clusteredHotspots", label: "Clustered Hotspots" },
                    ] as const
                  ).map((item) => {
                    const checked = layers[item.key];
                    return (
                      <button
                        type="button"
                        className="ember-layer-option"
                        key={item.key}
                        aria-pressed={checked}
                        onClick={() =>
                          setLayers((prev) => ({ ...prev, [item.key]: !prev[item.key] }))
                        }
                      >
                        <span>{item.label}</span>
                        <span className={`ember-layer-check ${checked ? "checked" : ""}`}>
                          {checked && <Check size={12} />}
                        </span>
                      </button>
                    );
                  })}
                  {["Thermal anomalies", "Settlement proximity", "Detection heatmap"].map((layer) => (
                    <button
                      type="button"
                      className="ember-layer-option"
                      key={layer}
                      onClick={() => setSelectedLayer(layer)}
                    >
                      <span>{layer}</span>
                      <span
                        className={`ember-layer-check ${selectedLayer === layer ? "checked" : ""}`}
                      >
                        {selectedLayer === layer && <Check size={12} />}
                      </span>
                    </button>
                  ))}
                  <div className="ember-layer-divider" />
                  <label className="ember-confidence-label">CONFIDENCE</label>
                  <div className="ember-confidence-options">
                    {[
                      { value: "all", label: "All confidence" },
                      { value: "high", label: "High" },
                      { value: "medium", label: "Medium" },
                      { value: "low", label: "Low" },
                    ].map((item) => (
                      <button
                        type="button"
                        aria-pressed={confidence === item.value}
                        className={confidence === item.value ? "selected" : ""}
                        key={item.value}
                        onClick={() => setConfidence(item.value as "all" | Confidence)}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {climate ? (
                <div className="ember-map-legend" style={{ width: "min(380px, calc(100% - 90px))" }}>
                  <HeatScaleSlider
                    title={view === "temperature" ? "Temperature" : "Max Heat Index"}
                    range={range}
                    domain={domain}
                    onRangeChange={setTempRange}
                  />
                </div>
              ) : (
                <div className="ember-map-legend">
                  <span className="ember-legend-title">DETECTION DENSITY</span>
                  <div className="ember-legend-scale">
                    <i />
                    <i />
                    <i />
                    <i />
                    <i />
                    <span>Low</span>
                    <span>High</span>
                  </div>
                  <div className="ember-legend-divider" />
                  <div className="ember-legend-settlement">
                    <MapPin size={12} /> Settlement{" "}
                    <span className="ember-settlement-distance">&lt; 10 km</span>
                  </div>
                </div>
              )}
              <div className="ember-map-compass">
                N<span>↑</span>
              </div>
            </div>

            <button
              type="button"
              className="ember-panel-toggle"
              data-open={panelOpen}
              aria-controls="incidents"
              aria-expanded={panelOpen}
              aria-label={panelOpen ? "Hide side panel (full map view)" : "Show side panel"}
              title={panelOpen ? "Hide panel" : "Show panel"}
              onClick={() => togglePanel(!panelOpen)}
            >
              {panelOpen ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
            <aside
              className="ember-incident-panel gap-3 bg-transparent p-3"
              id="incidents"
              data-open={panelOpen}
              inert={!panelOpen} // hidden panel: out of the tab order and screen readers too
              onKeyDown={(e) => e.key === "Escape" && togglePanel(false)}
            >
              <Card className={climate ? "border-0 bg-transparent shadow-none" : undefined}>
                <CardHeader className="space-y-1.5 p-2.5">
                  <Tabs value={view} onValueChange={(v) => setView(v as OverviewView)} aria-label="What to show on the map">
                    <TabsList className="grid h-8 w-full grid-cols-3">
                      {(
                        [
                          ["fires", "Wildfires", Flame],
                          ["temperature", "Temperature", Thermometer],
                          ["heatindex", "Heat index", Droplets],
                        ] as const
                      ).map(([key, label, Icon]) => (
                        <TabsTrigger key={key} value={key} className="h-7 gap-1 px-1 text-[11px]">
                          <Icon size={12} /> {label}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </Tabs>
                  {view === "fires" && (
                    <>
                      <CardTitle className="pt-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Overlays</CardTitle>
                      <ToggleGroup
                        type="multiple"
                        value={[windOn ? "wind" : "", spreadOn ? "spread" : "", heatOn ? "heat" : ""].filter(Boolean)}
                        onValueChange={(v) => {
                          setWindOn(v.includes("wind"));
                          setSpreadOn(v.includes("spread"));
                          setHeatOn(v.includes("heat"));
                        }}
                        aria-label="Wind and fire overlays"
                        className="grid grid-cols-3 gap-1"
                      >
                        {(
                          [
                            ["wind", "Wind", windQuery.isFetching, "Animated live wind, coloured by speed"],
                            ["spread", "Spread", fireWindQuery.isFetching, "Where the wind pushes each fire in 1, 3 and 6 h"],
                            ["heat", "Heatspots", false, "Heat glow of the detections"],
                          ] as const
                        ).map(([val, label, busy, title]) => (
                          <ToggleGroupItem key={val} value={val} title={title} aria-label={label} className="h-7 gap-1 px-1 text-[11px]">
                            <i
                              aria-hidden
                              className="size-[7px] rounded-full border"
                              style={{
                                background: (val === "wind" ? windOn : val === "spread" ? spreadOn : heatOn) ? "#4cc36a" : "transparent",
                                borderColor: (val === "wind" ? windOn : val === "spread" ? spreadOn : heatOn) ? "#4cc36a" : "currentColor",
                              }}
                            />
                            {label}
                            {busy ? <small className="text-[9px] opacity-80">…</small> : null}
                          </ToggleGroupItem>
                        ))}
                      </ToggleGroup>
                    </>
                  )}
                </CardHeader>
                {view === "fires" && (windOn || spreadOn || (firesNearby && (spreadOn || heatOn))) && (
                  <CardContent className="space-y-1.5 p-2.5 pt-0">
                    {windOn && (
                      <div className="rounded-md border bg-muted/40 p-1.5">
                        {windQuery.isError ? (
                          <span className="text-[11px] opacity-75">Wind unavailable. Try again in a minute.</span>
                        ) : windHere ? (
                          <p className="text-[11px] font-semibold tabular-nums">
                            {Math.round(windHere.speed)} km/h from {windHere.from} → pushing {windHere.toward}
                            {place ? <span className="font-normal text-muted-foreground"> · {place.name}</span> : null}
                          </p>
                        ) : (
                          <span className="text-xs opacity-75">Loading wind…</span>
                        )}
                        <div
                          className="mt-1.5 h-1.5 rounded-full"
                          title={`10 m above ground · ${windQuery.data?.run ?? "NOAA GFS"}`}
                          style={{ background: `linear-gradient(to right, ${WIND_SCALE.map(([, c]) => c).join(", ")})` }}
                        />
                        <div className="mt-0.5 flex justify-between font-mono text-[9px] text-muted-foreground">
                          <span>{WIND_SCALE[0][0]}</span>
                          <span>{WIND_SCALE[WIND_SCALE.length - 1][0]}+ km/h</span>
                        </div>
                        <div className="mt-1.5 flex items-center gap-1 text-[10px]" role="radiogroup" aria-label="Wind animation speed">
                          <span className="mr-auto text-muted-foreground">Animation</span>
                          {([[0.5, "Slow"], [1, "Normal"], [2, "Fast"]] as const).map(([v, label]) => (
                            <button
                              key={label}
                              type="button"
                              role="radio"
                              aria-checked={windPace === v}
                              onClick={() => setWindPace(v)}
                              className={`rounded px-1.5 py-0.5 ${windPace === v ? "bg-accent font-semibold text-accent-foreground" : "text-muted-foreground"}`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {spreadOn && (
                      <div className="flex items-center gap-3 text-xs">
                        {([["+1 h", "#e3211c"], ["+3 h", "#ff8c1a"], ["+6 h", "#ffd000"]] as const).map(([t, c]) => (
                          <span key={t} className="inline-flex items-center gap-1">
                            <i className="size-2.5 rounded-[3px] opacity-80" style={{ background: c }} /> {t}
                          </span>
                        ))}
                        <small className="ml-auto text-[10px] text-muted-foreground">
                          {fireWindQuery.isError
                            ? "Forecast unavailable."
                            : spreadFires.length === 0
                              ? "No fires to project."
                              : `6 h · ${spreadFires.length} strongest.`}
                        </small>
                      </div>
                    )}
                    {firesNearby && (spreadOn || heatOn) && (
                      <div role="status" className="rounded-md border border-orange-500/40 bg-orange-500/10 p-2 text-[11px]">
                        No fires inside {areaName} right now. Showing <b>{filteredFires.length}</b> detection{filteredFires.length === 1 ? "" : "s"} within {NEARBY_KM} km of its border that the wind could push in.
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
              {climate && focusPlace ? (
                <ClimatePanel
                  view={view as "temperature" | "heatindex"}
                  place={focusPlace}
                  conditions={temp}
                  error={conditionsQuery.isError}
                  heatIndexNow={heatIdx}
                  heat={heat}
                  domain={domain}
                  range={range}
                  onRangeChange={setTempRange}
                  coverage={contours?.coverage ?? null}
                  areasLoading={levelsQuery.isLoading || boundaryQuery.isLoading || gridQuery.isLoading}
                  areasFailed={gridQuery.isError}
                  levels={levels}
                  levelKey={level?.key ?? null}
                  onLevelChange={chooseLevel}
                  levelMissing={borderMissing ? missingName : null}
                  coverageOf={boundary ? (boundaryName ?? focusPlace.name) : null}
                />
              ) : (
                <>
              <Card className="overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-2">
                  <div>
                    <CardTitle className="flex items-center gap-1.5 text-sm">
                      {harmonized ? "Priority clusters" : "Raw detections"}{" "}
                      <Badge variant="secondary" className="font-mono text-[10px]">{visibleHotspots.length.toString().padStart(2, "0")}</Badge>
                    </CardTitle>
                    <CardDescription className="mt-0.5 text-[11px]">
                      {harmonized
                        ? "MODIS + VIIRS fused · nearest first"
                        : "Satellite pixels · nearest first"}
                    </CardDescription>
                  </div>
                  <Button variant="ghost" size="icon" className="size-7" aria-label="Incident options">
                    <MoreHorizontal size={16} />
                  </Button>
                </CardHeader>
                <CardContent className="space-y-1 p-3 pt-0">
                    {visibleHotspots.slice(0, 3).map((hotspot) => {
                      const active = selectedHotspot?.id === hotspot.id;
                      return (
                        <button
                          type="button"
                          key={hotspot.id}
                          onClick={() => setSelectedId(hotspot.id)}
                          className={`flex w-full items-center gap-2 overflow-hidden rounded-lg border p-1.5 text-left transition-colors ${active ? "border-foreground bg-accent" : "border-transparent hover:border-border hover:bg-muted/50"}`}
                        >
                          <span className={`flex size-6 shrink-0 items-center justify-center rounded-md ${hotspot.confidence === "high" ? "bg-destructive/15 text-destructive" : hotspot.confidence === "medium" ? "bg-orange-500/15 text-orange-600" : "bg-muted text-muted-foreground"}`}>
                            <Flame size={13} />
                          </span>
                          <span className="grid min-w-0 flex-1 leading-snug">
                            <span className="flex items-center gap-1 text-xs font-medium">
                              <span className="truncate">{hotspot.name}</span>
                              <Badge variant={hotspot.confidence === "high" ? "destructive" : "outline"} className="h-3.5 shrink-0 px-1 text-[8px]">
                                {BADGE_OF[hotspot.confidence]}
                              </Badge>
                              <b className="ml-auto shrink-0 font-mono text-[10px] font-semibold tabular-nums">{hotspot.proximityKm.toFixed(1)} km</b>
                            </span>
                            <span className="truncate text-[10px] text-muted-foreground">
                              {!hotspot.name.startsWith("Sector") ? `${hotspot.settlement} · ` : ""}{hotspot.count} {harmonized ? "detections" : "px"} · {hotspot.acqTime}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                    {visibleHotspots.length === 0 && (
                      <div className="rounded-md border border-dashed p-2 text-center text-[11px] text-muted-foreground">No clusters match this search.</div>
                    )}
                  <Button variant="ghost" size="sm" className="h-7 w-full justify-between px-2 text-[11px]" asChild>
                    <Link href="/detections">
                      View all incidents <ChevronRight size={14} />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
                </>
              )}
            </aside>
          </div>
        </section>
        {/* Theater-style dimming as the sheet slides up. */}
        <div aria-hidden className="pointer-events-none fixed inset-0 z-[1] bg-black" style={{ opacity: mapDim }} />
        <div className="pointer-events-none relative z-10">
          <div className="h-[calc(100vh-76px-68px)]" />
          <div className="pointer-events-auto rounded-t-3xl border-t bg-background px-4 pb-16 shadow-[0_-12px_40px_rgba(0,0,0,0.18)] sm:px-6">
            <div className="sticky top-[68px] z-20 -mx-4 rounded-t-3xl bg-background/95 px-4 pt-2 pb-3 backdrop-blur sm:-mx-6 sm:px-6">
              <div aria-hidden className="mx-auto mb-2 h-1 w-10 rounded-full bg-muted-foreground/30" />
              <HistoricalFireNavigator
                todayStr={todayStr}
                quickRange={quickRange}
                granularity={granularity}
                historicalDate={historicalDate}
                spanDays={spanDays}
                steps={timelineModel.steps}
                scrubIndex={clampedScrubIndex}
                startLabel={timelineModel.startLabel}
                endLabel={timelineModel.endLabel}
                isHistorical={isHistoricalMode}
                isModisEraOnly={isModisEraOnly}
                playing={playing}
                spreadOn={spreadOn}
                loadingArchive={isHistoricalMode && firmsQuery.isFetching}
                onSelectQuickRange={handleSelectQuickRange}
                onChangeGranularity={handleChangeGranularity}
                onSelectHistoricalDate={handleSelectHistoricalDate}
                onChangeSpanDays={handleChangeSpanDays}
                onBackToLive={handleBackToLive}
                onScrubChange={(idx) => {
                  setPlaying(false);
                  setScrubIndex(idx);
                }}
                onTogglePlay={() => {
                  if (!playing && clampedScrubIndex >= timelineModel.steps.length - 1) {
                    setScrubIndex(0);
                  }
                  setPlaying(!playing);
                }}
              />
            </div>
            <div className="space-y-4 pt-4">
            <section className="flex flex-wrap items-end justify-between gap-3">
              <div className="space-y-1">
                <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  <span className="size-1.5 rounded-full bg-emerald-500" /> Field operations <span className="opacity-70">/ Nov 13, 2026</span>
                </p>
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                  Good morning, team.
                </h1>
                <p className="text-sm text-muted-foreground">Here’s the latest across your monitored region.</p>
              </div>
              <div>
                <Button variant="outline" asChild>
                  <Link href="/detections">
                    <Radio size={15} /> Export briefing
                  </Link>
                </Button>
              </div>
            </section>

            {view === "fires" && (
              <Card
                aria-label="Harmonized vs Unharmonized comparison"
                className="border-primary/30 bg-gradient-to-b from-primary/[0.07] to-transparent"
              >
                <CardHeader className="p-3 pb-2">
                  <CardTitle className="flex flex-wrap items-center gap-2 text-[13px]">
                    <span className="flex size-5 items-center justify-center rounded-md bg-primary/15 text-primary">
                      <Layers size={12} />
                    </span>
                    MODIS + VIIRS HARMONIZATION
                    <Badge className="font-mono text-[10px]">
                      {harmonizationStats.mergedDuplicateCount > 0
                        ? `-${harmonizationStats.reductionPercent}% duplicates merged`
                        : "Sensor-fused"}
                    </Badge>
                  </CardTitle>
                  <CardDescription className="text-[11px]">
                    Compare cross-sensor fused fire events against raw unmerged MODIS (1 km) &amp; VIIRS (375 m) detections.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-3 pt-0">
                  <ToggleGroup
                    type="single"
                    value={harmonized ? "fused" : "raw"}
                    onValueChange={(v) => {
                      if (v === "fused") setHarmonized(true);
                      else if (v === "raw") setHarmonized(false);
                    }}
                    aria-label="Harmonization mode"
                    className="grid grid-cols-2 gap-2"
                  >
                    <ToggleGroupItem value="fused" aria-label="Harmonized fused" className="h-auto flex-col items-start gap-0.5 border p-2 data-[state=on]:border-primary/60 data-[state=on]:bg-primary/[0.08] data-[state=on]:shadow-sm">
                      <small className="flex items-center gap-1 text-[10px] font-semibold tracking-wide text-muted-foreground">
                        <span className={`size-1.5 rounded-full ${harmonized ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
                        HARMONIZED (FUSED)
                      </small>
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <strong className="text-lg tabular-nums">{harmonizationStats.harmonizedClusterCount}</strong>
                        <span className="text-[11px] text-muted-foreground">{harmonizationStats.dualSensorConfirmedCount} dual-sensor · ≥96% conf</span>
                      </div>
                    </ToggleGroupItem>
                    <ToggleGroupItem value="raw" aria-label="Unharmonized raw" className="h-auto flex-col items-start gap-0.5 border p-2 data-[state=on]:border-primary/60 data-[state=on]:bg-primary/[0.08]">
                      <small className="flex items-center gap-1 text-[10px] font-semibold tracking-wide text-muted-foreground">
                        <span className={`size-1.5 rounded-full ${!harmonized ? "bg-amber-500" : "bg-muted-foreground/40"}`} />
                        UNHARMONIZED (RAW)
                      </small>
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <strong className="text-lg tabular-nums">{harmonizationStats.rawDetectionCount}</strong>
                        <span className="text-[11px] text-muted-foreground">
                          {harmonizationStats.viirsRawCount} VIIRS · {harmonizationStats.modisRawCount} MODIS
                        </span>
                      </div>
                    </ToggleGroupItem>
                  </ToggleGroup>
                </CardContent>
              </Card>
            )}
            <div id="smart-action-guide" className="scroll-mt-20">
              <SmartActionGuide place={place ?? DEFAULT_PLACE} onLocate={handleLocate} />
            </div>

            </div>
          </div>
        </div>
        {showBackToMap && (
          <Button className="fixed right-5 bottom-5 z-30 rounded-full shadow-xl" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
            <MapIcon size={16} /> Back to map
          </Button>
        )}
      </div>
    </EmberShell>
  );
}
