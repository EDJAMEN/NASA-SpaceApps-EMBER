"use client";

import { type ReactNode, useEffect } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { TELEMETRY_KEY, type SidebarTelemetry } from "@/lib/telemetry";
import { usePathname } from "next/navigation";
import {
  Bell,
  CalendarDays,
  Flame,
  LayoutGrid,
  Moon,
  Radio,
  Settings2,
  Sun,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useTheme } from "@/hooks/use-theme";

export type EmberNavKey = "overview" | "detections" | "alerts" | "calendar" | "ingestion";

const NAV: Array<{ key: EmberNavKey; to: string; label: string; icon: typeof Flame }> = [
  { key: "overview", to: "/dashboard", label: "Overview", icon: LayoutGrid },
  { key: "detections", to: "/detections", label: "Detections", icon: Radio },
  { key: "alerts", to: "/alerts", label: "Alerts", icon: TriangleAlert },
  { key: "calendar", to: "/calendar", label: "Burn calendar", icon: CalendarDays },
  { key: "ingestion", to: "/ingestion", label: "Ingestion", icon: Flame },
];

export interface EmberLiveStatus {
  mode: "sample" | "live";
  state: "idle" | "loading" | "synced" | "error";
  lastSync?: string;
  region?: string;
  errorMessage?: string;
}

export function EmberShell({
  active,
  title,
  liveStatus,
  cover = false,
  headerLeft,
  headerRight,
  headerSearch,
  children,
}: {
  headerLeft?: ReactNode; // cover bar: after the breadcrumb + status (e.g. the location chip)
  headerRight?: ReactNode; // cover bar: map controls, before the theme toggle
  headerSearch?: ReactNode; // cover bar: search, kept outside the scrolling controls so its suggestions are not clipped
  cover?: boolean; // Overview: full-screen map behind a floating, slide-off glass sidebar and a see-through top bar
  active?: EmberNavKey;
  title: string;
  liveStatus?: EmberLiveStatus;
  children: ReactNode;
}) {
  const { dark, toggle } = useTheme();
  const pathname = usePathname();
  const isLive = liveStatus?.mode === "live";

  const pillLabel = !isLive
    ? "DEMO PREVIEW"
    : liveStatus.state === "loading"
      ? "SYNCING..."
      : liveStatus.state === "error"
        ? "FEED ERROR"
        : "LIVE FEED";

  const sidebarSubtitle = !isLive
    ? "Sample data preview"
    : liveStatus.state === "loading"
      ? "Syncing NASA FIRMS WFS..."
      : liveStatus.state === "error"
        ? liveStatus.errorMessage || "Connection error"
        : `${liveStatus.region === "Global" ? "Global" : "SE Asia"} · ${liveStatus.lastSync ?? "Just now"}`;

  const updatedLabel = isLive
    ? liveStatus.state === "loading"
      ? "Syncing..."
      : liveStatus.lastSync
        ? `Synced ${liveStatus.lastSync}`
        : "Live feed"
    : "";

  return (
    <SidebarProvider>
      {cover && <BracketShortcut />}
      <Sidebar
        collapsible={cover ? "offcanvas" : "icon"}
        variant={cover ? "floating" : "sidebar"}
        className={
          cover
            ? "z-40 [&_[data-sidebar=sidebar]]:rounded-2xl [&_[data-sidebar=sidebar]]:bg-sidebar/90 [&_[data-sidebar=sidebar]]:shadow-xl [&_[data-sidebar=sidebar]]:backdrop-blur-md"
            : undefined
        }
      >
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild>
                <Link href="/" aria-label="EMBER home">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    <Flame size={18} strokeWidth={2.4} />
                  </span>
                  <span className="grid flex-1 text-left leading-tight">
                    <span className="font-semibold">EMBER.</span>
                    <span className="text-xs text-muted-foreground">Wildfire response</span>
                  </span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Workspace</SidebarGroupLabel>
            <SidebarMenu>
              {NAV.map((item) => {
                const isActive = active
                  ? item.key === active
                  : item.to === "/"
                    ? pathname === "/"
                    : pathname?.startsWith(item.to);
                return (
                  <SidebarMenuItem key={item.key}>
                    <SidebarMenuButton asChild isActive={isActive} tooltip={item.label}>
                      <Link href={item.to} aria-current={isActive ? "page" : undefined}>
                        <item.icon size={17} />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
          <TelemetryCards />
        </SidebarContent>
        <SidebarFooter>
          <div className="flex items-center gap-2 rounded-md border border-sidebar-border px-2.5 py-2 text-[11px] group-data-[collapsible=icon]:hidden">
            <span className={`size-1.5 shrink-0 rounded-full ${liveStatus?.state === "error" ? "bg-red-500" : isLive ? "bg-emerald-500" : "bg-muted-foreground/50"}`} aria-hidden />
            <span className="min-w-0">
              <b className="block font-semibold">FIRMS connection</b>
              <span className="block truncate text-muted-foreground">{sidebarSubtitle}</span>
            </span>
          </div>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <button type="button">
                  <span className="flex size-7 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-red-600 text-[11px] font-bold text-white">
                    OC
                  </span>
                  <span className="grid flex-1 text-left leading-tight">
                    <b className="text-xs">Operations Center</b>
                    <small className="text-xs text-muted-foreground">Bukidnon region</small>
                  </span>
                </button>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset className={cover ? "overflow-x-clip bg-transparent" : undefined}>
        {cover ? (
          // One floating glass bar: navigation context on the left, map controls on the right.
          <header className="pointer-events-none sticky top-0 z-[60] px-2 pt-2 sm:px-3 sm:pt-3">
            <div className="pointer-events-auto flex h-12 items-center gap-1 rounded-xl border bg-card/85 px-1.5 shadow-lg backdrop-blur-md sm:gap-1.5 sm:px-2">
              <SidebarTrigger aria-label="Toggle sidebar ( [ )" className="shrink-0 rounded-lg border" />
              <Breadcrumb className="hidden shrink-0 md:block">
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbLink href="/dashboard">Workspace</BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage className="font-semibold">{title}</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
              <span
                className={`hidden shrink-0 items-center gap-1.5 text-sm font-medium tracking-wide sm:inline-flex ${liveStatus?.state === "error" ? "text-destructive" : ""}`}
                title={updatedLabel || undefined}
              >
                {isLive && liveStatus?.state !== "error" && <span className="ember-live-dot" aria-hidden />}
                {pillLabel}
              </span>
              {headerLeft}
              <div className="ml-auto shrink-0">{headerSearch}</div>
              <div className="ember-topbar-scroll flex min-w-0 items-center gap-1 overflow-x-auto">{headerRight}</div>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0"
                aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
                aria-pressed={dark}
                title={dark ? "Light mode" : "Dark mode"}
                onClick={toggle}
              >
                {dark ? <Sun size={17} /> : <Moon size={17} />}
              </Button>
            </div>
          </header>
        ) : (
          <header
            className={
              "sticky top-0 z-10 flex h-14 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur"
            }
          >
            <SidebarTrigger aria-label="Toggle sidebar" />
            <Separator orientation="vertical" className="h-5" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="/dashboard">Workspace</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>{title}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <div className="ml-auto flex items-center gap-1.5">
              <Badge variant={isLive ? "default" : "secondary"}>
                <span className="relative mr-1 flex size-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" />
                  <span className="relative inline-flex size-1.5 rounded-full bg-current" />
                </span>
                {pillLabel}
              </Badge>
              {updatedLabel && (
                <span className="hidden text-xs text-muted-foreground sm:inline">{updatedLabel}</span>
              )}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
                      aria-pressed={dark}
                      onClick={toggle}
                    >
                      {dark ? <Sun size={17} /> : <Moon size={17} />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{dark ? "Light mode" : "Dark mode"}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label="Notifications">
                      <Bell size={17} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Notifications</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label="Settings">
                      <Settings2 size={17} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Settings</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </header>
        )}
        {cover ? children : <div className="mx-auto w-full max-w-[1400px] p-4 sm:p-6">{children}</div>}
      </SidebarInset>
    </SidebarProvider>
  );
}

export default EmberShell;

// ---- Stacked telemetry inspector cards (sidebar, below the nav) ----
const PILL = {
  ember: "border-[#F5C7B8] bg-[#FCEAE3] text-[#D94E28] dark:border-orange-900 dark:bg-orange-950 dark:text-orange-300",
  green: "border-[#B7DFC1] bg-[#E6F4EA] text-[#1E7E34] dark:border-green-900 dark:bg-green-950 dark:text-green-300",
  sand: "border-[#DFD2BE] bg-[#EFE4D4] text-[#231F1C] dark:border-stone-700 dark:bg-stone-800 dark:text-stone-200",
} as const;

// Shown until the Overview has loaded live data in this session.
const FALLBACK: SidebarTelemetry = {
  latest: { name: "45 km S of Malaybalay City", distanceKm: 44.8, date: "Today", time: "04:39 AM", source: "VIIRS", conf: "≥95%", lat: 7.749, lng: 125.12 },
  window: { fused: 1, raw: 1, dual: 0, viirs: 1, modis: 0, bufferKm: 30 },
  boundary: { place: "Malaybalay", windKmh: 4, from: "N", toward: "S", inside: 0, border: 1, spread: "Normal", region: "Bukidnon", sync: "04:39 AM" },
};

const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

const hemi = (v: number, pos: string, neg: string) => `${Math.abs(v).toFixed(3)}° ${v >= 0 ? pos : neg}`;
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

function TelemetryCards() {
  // Read-only view of what the Overview published; never fetches by itself.
  const { data } = useQuery<SidebarTelemetry>({ queryKey: TELEMETRY_KEY, queryFn: () => Promise.reject(new Error("set by Overview")), enabled: false, staleTime: Infinity });
  const t = data ?? FALLBACK;
  const { latest: l, window: w, boundary: b } = t;
  const live = !!data;
  const towardDeg = b.toward ? COMPASS.indexOf(b.toward) * 45 : null;
  // Flow speed follows the real wind: calm ≈ 6 s per pass, 30+ km/h ≈ 0.8 s.
  const flowSecs = Math.max(0.8, 6 - (b.windKmh ?? 0) / 6);
  const cards: { title: string; subtitle: string; badge: string; pill: string; tone: keyof typeof PILL; cells: [string, string][]; fx: "ping" | "scan" | "wind" }[] = [
    {
      title: "Last recorded detection",
      subtitle: l?.name ?? "No detections in view",
      badge: "Distance",
      pill: l ? `${l.distanceKm.toFixed(1)} km` : "—",
      tone: "ember",
      fx: "ping",
      cells: l
        ? [["Date", l.date], ["Time", l.time.replace(" UTC", "")], ["Source", l.source], ["Conf.", l.conf], ["Latitude", hemi(l.lat, "N", "S")], ["Longitude", hemi(l.lng, "E", "W")]]
        : [["Date", "—"], ["Time", "—"], ["Source", "—"], ["Conf.", "—"], ["Latitude", "—"], ["Longitude", "—"]],
    },
    {
      title: "Detections in the last 24h",
      subtitle: "MODIS + VIIRS Harmonized",
      badge: "Fused",
      pill: String(w.fused),
      tone: "green",
      fx: "scan",
      cells: [["Fused", plural(w.fused, "Event")], ["Raw", `${w.raw} Total`], ["Dual", String(w.dual)], ["VIIRS", `${w.viirs} (375m)`], ["MODIS", `${w.modis} (1km)`], ["Buffer", w.bufferKm ? `${w.bufferKm} km` : "—"]],
    },
    {
      title: "Nearest boundary activity",
      subtitle: b.toward ? `Wind pushing ${b.toward} · ${b.place}` : b.place,
      badge: "Wind",
      pill: b.windKmh !== null ? `${b.windKmh} km/h` : "—",
      tone: "sand",
      fx: "wind",
      cells: [["Vector", b.from && b.toward ? `${b.from} → ${b.toward}` : "—"], ["Inside", plural(b.inside, "Fire")], ["Border", plural(b.border, "Fire")], ["Spread", b.spread], ["Region", b.region], ["Sync", b.sync]],
    },
  ];
  return (
    <section aria-label="Telemetry" className="mt-4 border-t border-sidebar-border pt-1 text-left group-data-[collapsible=icon]:hidden">
      {!data && <p className="px-4 pt-2 text-[10px] text-muted-foreground">Sample values · open Overview for live data</p>}
      <div className="divide-y divide-sidebar-border">
        {cards.map((c, ci) => (
          <article key={c.title} className="relative space-y-2.5 px-4 py-3.5">
            {c.fx === "scan" && live && <span aria-hidden className="ember-scan" />}
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="flex items-center gap-1.5 text-[13px] leading-tight font-semibold text-sidebar-foreground">
                  <span aria-hidden className={live ? "ember-live-dot" : "size-1.5 shrink-0 rounded-full bg-muted-foreground/40"} />
                  {c.title}
                </h3>
                <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{c.subtitle}</p>
              </div>
              <div className="shrink-0 text-right">
                <span className="block text-[9px] tracking-wider text-muted-foreground uppercase">
                  {c.badge}
                  <span className={live ? "ml-1 text-emerald-600 dark:text-emerald-400" : "ml-1"}>· {live ? "live" : "sample"}</span>
                </span>
                <span className={`relative mt-0.5 inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-bold tabular-nums ${PILL[c.tone]}`}>
                  {c.fx === "ping" && live && <span aria-hidden className="ember-ping" />}
                  {c.fx === "wind" && towardDeg !== null && (
                    <svg aria-hidden viewBox="0 0 10 10" className="ember-wind-arrow size-2.5" style={{ rotate: `${towardDeg}deg` }}>
                      <path d="M5 0.5 L8.5 8.5 L5 6.6 L1.5 8.5 Z" fill="currentColor" />
                    </svg>
                  )}
                  <span key={c.pill} className="ember-tick">
                    {c.pill}
                  </span>
                </span>
              </div>
            </div>
            {c.fx === "wind" && towardDeg !== null && (
              <div aria-hidden className="ember-flow" style={{ animationDuration: `${flowSecs}s`, transform: towardDeg > 180 ? "scaleX(-1)" : undefined }} />
            )}
            <dl className="grid grid-cols-3 gap-x-2 gap-y-2.5 pt-1">
              {c.cells.map(([k, v], vi) => (
                <div key={k} className="min-w-0">
                  <dt className="block text-[10px] leading-none text-muted-foreground">{k}</dt>
                  <dd className="mt-1 block truncate text-[11px] font-semibold text-sidebar-foreground capitalize tabular-nums" title={v}>
                    {/* key = value: a changed value remounts and replays the tick; first paint cascades in */}
                    <span key={v} className="ember-tick" style={{ animationDelay: `${ci * 90 + vi * 35}ms` }}>
                      {v}
                    </span>
                  </dd>
                </div>
              ))}
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}

/** "[" toggles the left sidebar (not while typing). */
function BracketShortcut() {
  const { toggleSidebar } = useSidebar();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.key !== "[" || e.metaKey || e.ctrlKey || e.altKey || t?.closest("input, textarea, select, [contenteditable=true]")) return;
      e.preventDefault();
      toggleSidebar();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleSidebar]);
  return null;
}
