"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import {
  Flame,
  Layers,
  Wind,
  Clock,
  ArrowUpRight,
  MapPin,
  Search,
  Radio,
  Plus,
  Minus,
  Compass,
} from "lucide-react";

const EarthGlobeCanvas = dynamic(
  () => import("@/components/earth-globe").then((mod) => mod.EarthGlobeCanvas),
  { ssr: false }
);

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

const CIRCULAR_SPECS = [
  {
    top: "MODIS",
    main: "1 km",
    sub: "Wide Swath",
  },
  {
    top: "VIIRS",
    main: "375 m",
    sub: "High Detail",
  },
  {
    top: "FUSED",
    main: "≥85%",
    sub: "Verified",
  },
] as const;

const SECTION2_INTELLIGENCE = [
  {
    id: "clustering",
    code: "01 // CROSS-SENSOR CLUSTERING",
    title: "Unified fire clusters from multi-satellite passes",
    detail:
      "Automatically groups nearby MODIS (1 km) and VIIRS (375 m) heat signatures within a 2.5 km radius into a single incident—filtering out false positives and mapping a clear 375 m safety buffer.",
    metric: "Dual-Sensor ≥96% Conf",
    icon: Layers,
  },
  {
    id: "wind-vectors",
    code: "02 // WIND & SPREAD FORECASTING",
    title: "Live 10 m wind streamlines & downwind spread zones",
    detail:
      "Combines real-time wind speed, direction, and heat index data to project where a fire is likely to push over the next 1, 3, and 6 hours.",
    metric: "NOAA GFS • +1h / +3h / +6h",
    icon: Wind,
  },
  {
    id: "proximity-timeline",
    code: "03 // COMMUNITY PROXIMITY TRIAGE",
    title: "Automated settlement distance alerts & pass replay",
    detail:
      "Flags fires approaching populated areas by urgency (Critical <3 km, Elevated <6 km, Advisory <10 km) and lets teams replay satellite passes across 24-hour to 7-day timelines.",
    metric: "<10 km Alert Tiers • 7-Day Replay",
    icon: Clock,
  },
] as const;

export function LandingPage() {
  const [scrollProgress, setScrollProgress] = useState(0);
  const [mapZoom, setMapZoom] = useState(1);

  useEffect(() => {
    const updateScroll = () => {
      const maxScroll = Math.max(
        1,
        document.documentElement.scrollHeight - window.innerHeight
      );
      setScrollProgress(clamp01(window.scrollY / maxScroll));
    };

    updateScroll();
    window.addEventListener("scroll", updateScroll, { passive: true });
    window.addEventListener("resize", updateScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", updateScroll);
      window.removeEventListener("resize", updateScroll);
    };
  }, []);

  const scrollToStage = (targetNormalized: number) => {
    const maxScroll = Math.max(
      1,
      document.documentElement.scrollHeight - window.innerHeight
    );
    window.scrollTo({
      top: targetNormalized * maxScroll,
      behavior: "smooth",
    });
  };

  // Stage 1 (0.00 -> 0.25): Hero Macro Horizon
  const stage1Exit = smoothstep(0.14, 0.25, scrollProgress);
  const stage1Opacity = 1 - stage1Exit;
  const stage1TranslateY = -32 * stage1Exit;

  // Stage 2 (0.25 -> 0.58): Full Isolated Globe + Harmonization System Intelligence
  const stage2Entry = smoothstep(0.22, 0.30, scrollProgress);
  const stage2Exit = smoothstep(0.50, 0.60, scrollProgress);
  const stage2Opacity = stage2Entry * (1 - stage2Exit);
  const stage2TranslateY = (1 - stage2Entry) * 24 - stage2Exit * 24;

  // Stage 2 editorial background tone (#141619 -> #1c1e22)
  const stage2EditorialTone =
    smoothstep(0.20, 0.30, scrollProgress) *
    (1 - smoothstep(0.52, 0.64, scrollProgress));

  // Stage 3 (0.55 -> 1.00): Regional Target Zoom-In -> Flat Map Crossfade
  const stage3MapOpacity = smoothstep(0.54, 0.66, scrollProgress);
  const webglCanvasOpacity = 1 - smoothstep(0.56, 0.70, scrollProgress);

  return (
    <div className="relative bg-[#05070a] text-[#F8FAFC] selection:bg-[#f97316] selection:text-black overflow-x-clip">
      {/* PHASE 2: Persistent Full-Viewport 3D Earth WebGL Canvas */}
      <EarthGlobeCanvas
        canvasOpacity={webglCanvasOpacity}
        stage2EditorialTone={stage2EditorialTone}
      />

      {/* PHASE 3.1: Persistent Adaptive-Contrast Top Navigation Bar */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/[0.08] bg-[#05070a]/75 backdrop-blur-xl transition-colors duration-300">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 sm:px-10">
          {/* Left: Minimal Circular Emblem + EMBER. Wordmark + Full Meaning */}
          <div className="flex items-center gap-3">
            <Link
              href="/"
              onClick={(e) => {
                e.preventDefault();
                scrollToStage(0);
              }}
              className="flex items-center gap-2.5 text-[#F8FAFC] transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#f97316]"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full border border-[#f97316]/60 bg-[#f97316]/15 text-[#FB923C] shadow-[0_0_18px_rgba(249,115,22,0.35)]">
                <Flame className="h-4 w-4 fill-current" strokeWidth={2.2} />
              </span>
              <span className="text-lg font-bold tracking-tight">EMBER.</span>
            </Link>
            <span
              className="hidden lg:inline-block h-3.5 w-px bg-white/15"
              aria-hidden="true"
            />
            <span className="hidden lg:inline-block text-[11px] font-medium text-slate-400 tracking-wide">
              Emergency Monitoring &amp; Burn-zone Early Response
            </span>
          </div>

          {/* Center/Right Navigation Links */}
          <nav
            aria-label="Primary"
            className="hidden md:flex items-center gap-7 font-mono text-[11px] font-medium tracking-[0.18em] text-slate-300"
          >
            <button
              type="button"
              onClick={() => scrollToStage(0)}
              className={`transition-colors hover:text-[#F8FAFC] cursor-pointer ${
                scrollProgress < 0.28 ? "text-orange-400" : ""
              }`}
            >
              CAPABILITIES
            </button>
            <button
              type="button"
              onClick={() => scrollToStage(0.45)}
              className={`transition-colors hover:text-[#F8FAFC] cursor-pointer ${
                scrollProgress >= 0.28 && scrollProgress < 0.65
                  ? "text-orange-400"
                  : ""
              }`}
            >
              HARMONIZATION
            </button>
            <button
              type="button"
              onClick={() => scrollToStage(0.88)}
              className={`transition-colors hover:text-[#F8FAFC] cursor-pointer ${
                scrollProgress >= 0.65 ? "text-orange-400" : ""
              }`}
            >
              HOW IT WORKS
            </button>
            <Link
              href="/detections"
              className="transition-colors hover:text-[#F8FAFC]"
            >
              TELEMETRY
            </Link>
          </nav>

          {/* Primary CTA: Open dashboard -> */}
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 rounded-full border border-[#f97316]/50 bg-[#f97316] px-4 py-2 text-xs sm:text-sm font-semibold text-black shadow-[0_0_24px_rgba(249,115,22,0.35)] transition-all hover:bg-[#ea580c] active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f97316]"
            >
              <span>Open dashboard</span>
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Scroll Track Driving Stages 1 & 2 before Stage 3 Flat Map */}
      <div className="relative z-10 h-[250vh]">
        <div className="sticky top-0 h-screen w-full overflow-hidden pointer-events-none">
          {/* Protective Left Scrim so foreground text stays razor-sharp over the glowing Earth limb */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0 w-full lg:w-[62%] bg-gradient-to-r from-[#05070a]/90 via-[#05070a]/55 to-transparent"
          />

          {/* =================================================================
              SECTION 1 — HERO: MACRO HORIZON (0% – 30% Scroll)
             ================================================================= */}
          <section
            aria-label="Hero Macro Horizon"
            style={{
              opacity: stage1Opacity,
              transform: `translate3d(0, ${stage1TranslateY}px, 0)`,
              visibility: stage1Opacity <= 0.01 ? "hidden" : "visible",
            }}
            className="relative mx-auto flex h-full max-w-7xl flex-col justify-between px-6 pt-24 pb-8 sm:px-10 will-change-transform"
          >
            {/* Upper-Left Typography + Circular Spec Badges */}
            <div className="max-w-xl pointer-events-auto">
              <div className="inline-flex items-center gap-2 rounded-full border border-orange-400/35 bg-[#090D16]/85 px-3.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-orange-400 backdrop-blur-xl shadow-lg">
                <span>
                  • EMBER — EMERGENCY MONITORING &amp; BURN-ZONE EARLY RESPONSE
                </span>
              </div>

              <h1 className="mt-5 tracking-tight drop-shadow-[0_2px_16px_rgba(0,0,0,0.85)]">
                <span className="block font-light italic text-2xl sm:text-3xl text-slate-200">
                  See the signal.
                </span>
                <span className="mt-1 block text-4xl sm:text-6xl lg:text-[4.25rem] font-extrabold leading-[1.03] text-[#F8FAFC]">
                  Protect what <span className="text-[#f97316]">matters.</span>
                </span>
              </h1>

              <p className="mt-4 max-w-lg text-[14px] sm:text-[15px] leading-relaxed text-slate-300 drop-shadow-[0_2px_16px_rgba(0,0,0,0.85)]">
                Emergency Monitoring &amp; Burn-zone Early Response (EMBER)
                combines NASA satellite thermal detections with live wind
                forecasts and community proximity alerts—helping field teams
                spot, verify, and respond to wildfire risks faster.
              </p>

              {/* 3 Outlined Circular Spec Badges */}
              <div className="mt-7 flex items-center gap-4 sm:gap-5">
                {CIRCULAR_SPECS.map((badge) => (
                  <div
                    key={badge.top}
                    className="flex h-20 w-20 sm:h-22 sm:w-22 flex-col items-center justify-center rounded-full border border-white/15 bg-[#090D16]/85 text-center backdrop-blur-xl shadow-2xl transition-transform duration-200 hover:scale-105 hover:border-orange-400/60"
                  >
                    <span className="font-mono text-[9px] font-semibold tracking-[0.18em] text-orange-400">
                      {badge.top}
                    </span>
                    <span className="mt-0.5 text-base sm:text-lg font-bold tracking-tight text-[#F8FAFC]">
                      {badge.main}
                    </span>
                    <span className="font-mono text-[9px] text-slate-300">
                      {badge.sub}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom Peek Cards Anchored at Bottom Edge of Viewport */}
            <div className="grid gap-4 md:grid-cols-2 pointer-events-auto">
              {/* Left Peek Card */}
              <div className="group flex flex-col justify-between rounded-2xl border border-white/12 bg-[#090D16]/85 p-5 backdrop-blur-xl shadow-2xl transition-all hover:-translate-y-0.5 hover:border-orange-400/45">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[10px] font-semibold tracking-[0.18em] text-orange-400">
                      CROSS-SENSOR HARMONIZATION // 2.5 KM RADIUS
                    </span>
                    <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-0.5 font-mono text-[10px] font-semibold text-emerald-400">
                      LIVE WFS + CSV
                    </span>
                  </div>
                  <p className="mt-2.5 text-[14px] sm:text-[15px] leading-relaxed text-slate-300">
                    Merges overlapping MODIS and VIIRS satellite passes into
                    single, verified fire events—eliminating duplicate alerts
                    and pinpointing the true fire center.
                  </p>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <Link
                    href="/dashboard"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#f97316] px-4 py-2 text-xs font-semibold text-black transition-colors hover:bg-[#ea580c]"
                  >
                    <span>Enter EMBER</span>
                    <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                  <Link
                    href="/detections"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3.5 py-2 text-xs font-medium text-[#F8FAFC] transition-colors hover:bg-white/10"
                  >
                    Explore detections
                  </Link>
                </div>
              </div>

              {/* Right Peek Card */}
              <div className="flex flex-col justify-between rounded-2xl border border-white/12 bg-[#090D16]/85 p-5 backdrop-blur-xl shadow-2xl transition-all hover:-translate-y-0.5 hover:border-white/25">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[10px] font-semibold tracking-[0.18em] text-orange-400">
                      MONITORED CORRIDOR // SE ASIA &amp; BUKIDNON
                    </span>
                    <Search className="h-3.5 w-3.5 text-slate-400" />
                  </div>
                  <p className="mt-2.5 text-[14px] sm:text-[15px] leading-relaxed text-slate-300">
                    Jump directly to any municipality, barangay, or active burn
                    cluster across Bukidnon, Mindanao, and Southeast Asia.
                  </p>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {[
                    "Malaybalay City",
                    "Valencia City",
                    "Maramag",
                    "Quezon",
                  ].map((town) => (
                    <Link
                      key={town}
                      href="/dashboard"
                      className="inline-flex items-center gap-1 rounded-full border border-white/12 bg-white/[0.04] px-2.5 py-1 font-mono text-[10px] text-slate-300 transition-colors hover:border-orange-400/40 hover:text-[#F8FAFC]"
                    >
                      <MapPin className="h-2.5 w-2.5 text-orange-400" />
                      <span>{town}</span>
                    </Link>
                  ))}
                  <button
                    type="button"
                    onClick={() => scrollToStage(0.88)}
                    className="ml-auto inline-flex items-center gap-1 font-mono text-[10px] font-semibold text-orange-400 hover:underline cursor-pointer"
                  >
                    <span>Preview regional map ↓</span>
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* =================================================================
              SECTION 2 — ZOOMED-OUT FULL GLOBE + SYSTEM INTELLIGENCE (30% – 65%)
             ================================================================= */}
          <section
            aria-label="Harmonization System Intelligence"
            style={{
              opacity: stage2Opacity,
              transform: `translate3d(0, ${stage2TranslateY}px, 0)`,
              visibility: stage2Opacity <= 0.01 ? "hidden" : "visible",
            }}
            className="absolute inset-0 mx-auto flex h-full max-w-7xl flex-col justify-between px-6 pt-22 pb-6 sm:px-10 will-change-transform"
          >
            {/* Left-Aligned Editorial Column Opposite Full 3D Sphere on Right */}
            <div className="max-w-xl pointer-events-auto">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.28em] text-orange-400">
                IT&apos;S ALL ABOUT EARLY RESPONSE
              </p>

              <h2 className="mt-2 whitespace-nowrap text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-[0.28em] text-[#F8FAFC] uppercase drop-shadow-[0_2px_16px_rgba(0,0,0,0.85)]">
                HARMONIZATION
              </h2>

              {/* Highlight Tag Row */}
              <div className="mt-3 flex flex-wrap items-center gap-2.5">
                <span className="font-mono text-xs font-semibold tracking-[0.18em] text-slate-300">
                  DUAL-SENSOR FUSION
                </span>
                <span className="rounded-md bg-[#f97316] px-2.5 py-0.5 font-mono text-[11px] font-bold tracking-wider text-black">
                  375M RESOLUTION
                </span>
                <span className="rounded-md border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-emerald-400">
                  VERIFIED CLUSTERS
                </span>
              </div>

              {/* 3 Clear, Authoritative Operational Cards */}
              <div className="mt-5 space-y-3">
                {SECTION2_INTELLIGENCE.map((item) => {
                  const Icon = item.icon;
                  return (
                    <article
                      key={item.id}
                      className="rounded-xl border border-white/12 bg-[#090D16]/85 p-4 backdrop-blur-xl shadow-2xl transition-all hover:border-orange-400/40"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[10px] font-semibold tracking-[0.16em] text-orange-400">
                          {item.code}
                        </span>
                        <span className="rounded-full border border-white/12 bg-white/[0.04] px-2.5 py-0.5 font-mono text-[10px] text-slate-300">
                          {item.metric}
                        </span>
                      </div>
                      <div className="mt-2 flex items-start gap-3">
                        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-orange-400/30 bg-orange-400/10 text-orange-400">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <h3 className="text-sm sm:text-base font-semibold tracking-tight text-[#F8FAFC]">
                            {item.title}
                          </h3>
                          <p className="mt-1 text-[14px] leading-relaxed text-slate-300">
                            {item.detail}
                          </p>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>

            {/* Bottom-Left Scroll Prompt with Vertical Animated Progress Line */}
            <div className="pointer-events-auto flex items-center gap-4">
              <button
                type="button"
                onClick={() => scrollToStage(0.88)}
                className="group inline-flex items-center gap-3 text-left font-mono text-[11px] font-semibold tracking-[0.22em] text-slate-300 hover:text-[#F8FAFC] cursor-pointer"
              >
                <span className="relative flex h-10 w-0.5 overflow-hidden bg-white/15">
                  <span
                    className="block w-full bg-[#f97316] transition-all duration-150"
                    style={{
                      height: `${Math.round(
                        clamp01((scrollProgress - 0.28) / 0.35) * 100
                      )}%`,
                    }}
                  />
                </span>
                <span>EXPLORE REGIONAL MAP</span>
              </button>
            </div>
          </section>
        </div>
      </div>

      {/* =====================================================================
          SECTION 3 — FLAT REGIONAL MAP SHOWCASE (65% – 100% Scroll)
         ===================================================================== */}
      <section
        id="regional-map"
        aria-label="Flat Regional Map Showcase"
        style={{ opacity: Math.max(0.15, stage3MapOpacity) }}
        className="relative z-20 min-h-screen w-full overflow-hidden border-t border-white/10 bg-[#05070a]"
      >
        <div className="relative h-screen w-full overflow-hidden">
          {/* Zoomable Full-bleed EMBER Regional Satellite + Wind Streamlines + Clusters Image */}
          <div
            className="absolute inset-0 transition-transform duration-300 ease-out"
            style={{ transform: `scale(${mapZoom})` }}
          >
            <Image
              src="/regional-map-showcase.jpg"
              alt="EMBER Southeast Asia satellite regional map showing GFS 10m wind streamlines and harmonized MODIS + VIIRS fire clusters"
              fill
              priority
              sizes="100vw"
              className="object-cover object-center select-none"
            />
          </div>

          {/* Subtle top gradient so the fixed navbar remains legible over the satellite map */}
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-28"
            style={{
              background:
                "linear-gradient(to bottom, rgba(5, 7, 10, 0.82) 0%, rgba(5, 7, 10, 0) 100%)",
            }}
          />

          {/* Subtle bottom-left mask so the repositioned legend & zoom controls sit cleanly */}
          <div
            className="pointer-events-none absolute bottom-0 left-0 h-56 w-96"
            style={{
              background:
                "radial-gradient(circle at 0% 100%, rgba(5, 7, 10, 0.96) 0%, rgba(5, 7, 10, 0.78) 55%, rgba(5, 7, 10, 0) 100%)",
            }}
          />

          {/* Repositioned Bottom-Left Zoom Controls & Detection Density Legend (bottom-6 left-6 sm:left-14) */}
          <div className="absolute bottom-6 left-6 sm:left-14 z-30 flex items-end gap-3">
            <div className="flex flex-col overflow-hidden rounded-xl border border-white/12 bg-[#090D16]/85 backdrop-blur-xl shadow-2xl">
              <button
                type="button"
                onClick={() =>
                  setMapZoom((z) => Math.min(1.4, Number((z + 0.12).toFixed(2))))
                }
                aria-label="Zoom in regional map"
                className="flex h-9 w-9 items-center justify-center text-slate-300 transition-colors hover:bg-white/10 hover:text-[#F8FAFC] cursor-pointer"
              >
                <Plus className="h-4 w-4" />
              </button>
              <div className="h-px bg-white/10" />
              <button
                type="button"
                onClick={() =>
                  setMapZoom((z) => Math.max(1.0, Number((z - 0.12).toFixed(2))))
                }
                aria-label="Zoom out regional map"
                className="flex h-9 w-9 items-center justify-center text-slate-300 transition-colors hover:bg-white/10 hover:text-[#F8FAFC] cursor-pointer"
              >
                <Minus className="h-4 w-4" />
              </button>
              <div className="h-px bg-white/10" />
              <button
                type="button"
                onClick={() => setMapZoom(1)}
                aria-label="Reset map zoom"
                className="flex h-9 w-9 items-center justify-center text-slate-300 transition-colors hover:bg-white/10 hover:text-[#F8FAFC] cursor-pointer"
              >
                <Compass className="h-4 w-4 text-orange-400" />
              </button>
            </div>

            <div className="w-60 rounded-xl border border-white/12 bg-[#090D16]/85 p-3.5 backdrop-blur-xl shadow-2xl">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-300">
                DETECTION DENSITY
              </p>
              <div className="mt-2 flex items-center gap-2">
                <div className="flex flex-1 items-center gap-1">
                  <span className="h-1.5 flex-1 rounded-full bg-emerald-500" />
                  <span className="h-1.5 flex-1 rounded-full bg-lime-400" />
                  <span className="h-1.5 flex-1 rounded-full bg-amber-400" />
                  <span className="h-1.5 flex-1 rounded-full bg-[#f97316]" />
                  <span className="h-1.5 flex-1 rounded-full bg-red-500" />
                </div>
                <span className="font-mono text-[10px] text-slate-300">
                  Low · High
                </span>
              </div>
              <div className="mt-2.5 flex items-center justify-between border-t border-white/10 pt-2 text-xs text-slate-300">
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-orange-400" />
                  <span>Settlement</span>
                </span>
                <span className="font-mono text-[11px] font-semibold text-[#F8FAFC]">
                  &lt; 10 km
                </span>
              </div>
            </div>
          </div>

          {/* Top-Right Floating Context Overlay */}
          <div className="absolute top-24 right-6 sm:right-10 z-30 w-full max-w-md rounded-2xl border border-white/12 bg-[#090D16]/85 p-5 backdrop-blur-xl shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <div className="inline-flex items-center gap-2">
                <Radio className="h-3.5 w-3.5 text-orange-400" />
                <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-orange-400">
                  SOUTH EAST ASIA WFS · GFS 10M STREAMLINES
                </span>
              </div>
              <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-0.5 font-mono text-[10px] font-semibold text-emerald-400">
                MODIS + VIIRS
              </span>
            </div>

            <h3 className="mt-2.5 text-lg font-bold tracking-tight text-[#F8FAFC]">
              Regional Fire Picture &amp; Wind Context
            </h3>
            <p className="mt-1.5 text-[14px] sm:text-[15px] leading-relaxed text-slate-300">
              Live harmonized fire clusters across the Philippines and Southeast
              Asia, layered with real-time wind flow and &lt;10 km community
              proximity alerts.
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Link
                href="/dashboard"
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#f97316] px-4 py-2.5 text-xs sm:text-sm font-bold text-black shadow-[0_0_24px_rgba(249,115,22,0.35)] transition-all hover:bg-[#ea580c] active:translate-y-px"
              >
                <span>Launch Full Interactive Dashboard</span>
                <span aria-hidden="true">→</span>
              </Link>
            </div>

            <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3 font-mono text-[10px] text-slate-300">
              <Link href="/detections" className="hover:text-[#F8FAFC]">
                Detections
              </Link>
              <Link href="/alerts" className="hover:text-[#F8FAFC]">
                Alerts
              </Link>
              <Link href="/calendar" className="hover:text-[#F8FAFC]">
                Burn Calendar
              </Link>
              <Link href="/ingestion" className="hover:text-[#F8FAFC]">
                Ingestion
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          5. PROFESSIONAL ENTERPRISE FOOTER (BELOW STAGE 3 FLAT MAP)
         ===================================================================== */}
      <footer className="relative z-30 border-t border-white/10 bg-[#05070a] text-slate-400">
        <div className="mx-auto max-w-7xl px-6 py-14 sm:px-10">
          <div className="grid grid-cols-1 gap-10 md:grid-cols-12">
            {/* 1. Brand Column (md:col-span-5) */}
            <div className="md:col-span-5">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-full border border-[#f97316]/60 bg-[#f97316]/15 text-[#FB923C]">
                  <Flame className="h-4 w-4 fill-current" strokeWidth={2.2} />
                </span>
                <span className="text-lg font-bold tracking-tight text-[#F8FAFC]">
                  EMBER.
                </span>
              </div>
              <p className="mt-2 text-xs font-semibold tracking-wide text-orange-400">
                Emergency Monitoring &amp; Burn-zone Early Response
              </p>
              <p className="mt-3 max-w-md text-[14px] leading-relaxed text-slate-300">
                Satellite-driven wildfire intelligence, cross-sensor
                harmonization, and wind-aware triage built for field response
                teams and regional operations centers.
              </p>
              <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-[#090D16] px-3 py-1 text-xs text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>NASA FIRMS WFS &amp; NOAA GFS Pipelines Operational</span>
              </div>
            </div>

            {/* 2. Platform Modules Column (md:col-span-2) */}
            <div className="md:col-span-2">
              <h3 className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-[#F8FAFC]">
                WORKSPACE
              </h3>
              <ul className="mt-4 space-y-2.5 text-sm text-slate-300">
                <li>
                  <Link
                    href="/dashboard"
                    className="transition-colors hover:text-orange-400"
                  >
                    Overview
                  </Link>
                </li>
                <li>
                  <Link
                    href="/detections"
                    className="transition-colors hover:text-orange-400"
                  >
                    Detections
                  </Link>
                </li>
                <li>
                  <Link
                    href="/alerts"
                    className="transition-colors hover:text-orange-400"
                  >
                    Alerts
                  </Link>
                </li>
                <li>
                  <Link
                    href="/analytics"
                    className="transition-colors hover:text-orange-400"
                  >
                    Analytics
                  </Link>
                </li>
                <li>
                  <Link
                    href="/calendar"
                    className="transition-colors hover:text-orange-400"
                  >
                    Burn Calendar
                  </Link>
                </li>
                <li>
                  <Link
                    href="/ingestion"
                    className="transition-colors hover:text-orange-400"
                  >
                    Ingestion
                  </Link>
                </li>
              </ul>
            </div>

            {/* 3. Intelligence & Specs Column (md:col-span-3) */}
            <div className="md:col-span-3">
              <h3 className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-[#F8FAFC]">
                DATA &amp; SENSORS
              </h3>
              <ul className="mt-4 space-y-2.5 text-sm text-slate-300">
                <li>MODIS (Terra &amp; Aqua • 1 km)</li>
                <li>VIIRS (SNPP &amp; NOAA-20 • 375 m)</li>
                <li>NOAA GFS 10 m Wind Fields</li>
                <li>BFP / Regional Triage Guide</li>
              </ul>
            </div>

            {/* 4. Regional Operations Column (md:col-span-2) */}
            <div className="md:col-span-2">
              <h3 className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-[#F8FAFC]">
                OPERATIONS
              </h3>
              <ul className="mt-4 space-y-2.5 text-sm text-slate-300">
                <li>Bukidnon, Mindanao</li>
                <li>Philippines &amp; SE Asia</li>
                <li className="pt-1">
                  <Link
                    href="/dashboard"
                    className="inline-flex items-center gap-1 font-semibold text-orange-400 transition-colors hover:text-orange-300"
                  >
                    <span>Open Dashboard</span>
                    <span aria-hidden="true">→</span>
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom Legal & Attribution Bar */}
          <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-6 text-xs text-slate-500 sm:flex-row">
            <p>
              © 2026 EMBER — Emergency Monitoring &amp; Burn-zone Early
              Response. Built for field teams.
            </p>
            <p>
              Data sources: NASA LANCE FIRMS • NOAA NOMADS GFS • OpenFreeMap
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
