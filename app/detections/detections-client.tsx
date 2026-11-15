"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown, Download, MapPin, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { EmberShell } from "@/components/ember-shell";
import { StatCard } from "@/components/stat-card";
import { HOTSPOTS, type Confidence, type Hotspot, type SensorSource } from "@/lib/hotspots";

const PAGE_SIZE = 10;
const THREAT_KM = 3;

type SortKey = "acquired" | "brightness" | "distance";
const sortValue: Record<SortKey, (h: Hotspot) => number | string> = {
  acquired: (h) => `${h.acqDate} ${h.acqTime}`,
  brightness: (h) => h.brightness,
  distance: (h) => h.proximityKm,
};

const CONF_DOT: Record<Confidence, string> = { high: "bg-red-500", medium: "bg-amber-500", low: "bg-muted-foreground/50" };

const coords = (h: Hotspot) =>
  `${Math.abs(h.lat).toFixed(3)}°${h.lat >= 0 ? "N" : "S"}, ${Math.abs(h.lng).toFixed(3)}°${h.lng >= 0 ? "E" : "W"}`;

function toCsv(rows: Hotspot[]) {
  const header = "id,source,confidence,brightness,acquired,lat,lng,settlement,distance_km";
  const out = rows.map((h) =>
    [h.id, h.source, h.confidence, h.brightness, `${h.acqDate} ${h.acqTime}`, h.lat, h.lng, `"${h.settlement.replace(/"/g, '""')}"`, h.proximityKm].join(","),
  );
  return [header, ...out].join("\n");
}

export function DetectionsPage() {
  const [search, setSearch] = useState("");
  const [source, setSource] = useState<"all" | SensorSource>("all");
  const [confidence, setConfidence] = useState<"all" | Confidence>("all");
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "acquired", desc: true });
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<Hotspot | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = HOTSPOTS.filter(
      (h) =>
        (!q || `${h.settlement} ${h.municipality} ${h.id} ${h.lat} ${h.lng}`.toLowerCase().includes(q)) &&
        (source === "all" || h.source === source) &&
        (confidence === "all" || h.confidence === confidence),
    );
    const get = sortValue[sort.key];
    return rows.sort((a, b) => (get(a) < get(b) ? -1 : get(a) > get(b) ? 1 : 0) * (sort.desc ? -1 : 1));
  }, [search, source, confidence, sort]);

  useEffect(() => setPage(0), [search, source, confidence, sort]);

  const stats = useMemo(
    () => ({
      high: filtered.filter((h) => h.confidence === "high").length,
      threat: filtered.filter((h) => h.proximityKm < THREAT_KM).length,
      maxTemp: filtered.reduce((m, h) => Math.max(m, h.brightness), 0),
      viirs: filtered.filter((h) => h.source === "VIIRS").length,
    }),
    [filtered],
  );

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageItems = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const pageNumbers = useMemo(() => {
    if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i);
    const nums = new Set([0, pageCount - 1, safePage - 1, safePage, safePage + 1]);
    return [...nums].filter((n) => n >= 0 && n < pageCount).sort((a, b) => a - b);
  }, [pageCount, safePage]);

  const filtersActive = search !== "" || source !== "all" || confidence !== "all";
  const clearFilters = () => {
    setSearch("");
    setSource("all");
    setConfidence("all");
  };

  const exportCsv = () => {
    const url = URL.createObjectURL(new Blob([toCsv(filtered)], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "ember-detections.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  // A render helper, not a component: a component defined here would remount (and drop focus) on every sort.
  const sortHead = (k: SortKey, children: string, className?: string) => {
    const active = sort.key === k;
    const Icon = !active ? ArrowUpDown : sort.desc ? ArrowDown : ArrowUp;
    return (
      <TableHead className={className} aria-sort={active ? (sort.desc ? "descending" : "ascending") : "none"}>
        <Button
          variant="ghost"
          size="sm"
          className="-ml-3 h-8 gap-1 font-medium data-[active=true]:text-foreground"
          data-active={active}
          onClick={() => setSort({ key: k, desc: active ? !sort.desc : true })}
        >
          {children}
          <Icon className={`size-3.5 ${active ? "" : "opacity-40"}`} />
        </Button>
      </TableHead>
    );
  };

  return (
    <EmberShell active="detections" title="Detections">
      <section className="ember-page-heading">
        <div>
          <div className="ember-eyebrow">
            <span /> HARMONIZED FEED
          </div>
          <h1>
            Thermal hotspot detections<span>.</span>
          </h1>
          <p>NASA MODIS &amp; VIIRS detections, normalized to one confidence scale.</p>
        </div>
        <div className="ember-page-actions flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard">
              <MapPin className="size-4" /> Live map
            </Link>
          </Button>
          <Button size="sm" onClick={exportCsv} disabled={!filtered.length}>
            <Download className="size-4" /> Export CSV
          </Button>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Detection metrics">
        <StatCard label="Detections" value={filtered.length} hint={`${stats.viirs} VIIRS · ${filtered.length - stats.viirs} MODIS`} />
        <StatCard label="High confidence" value={stats.high} hint={filtered.length ? `${Math.round((stats.high / filtered.length) * 100)}% of shown` : "—"} />
        <StatCard
          label={`Within ${THREAT_KM} km of a settlement`}
          value={stats.threat}
          hint={stats.threat ? "Notify DRRMC" : "No settlement at risk"}
          tone={stats.threat ? "alert" : undefined}
        />
        <StatCard label="Peak brightness" value={stats.maxTemp ? `${stats.maxTemp.toFixed(1)} K` : "—"} hint="Hottest pixel shown" />
      </section>

      <Card className="mt-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">What this page is for</CardTitle>
          <CardDescription>
            A single list of every heat spot NASA&apos;s MODIS and VIIRS satellites picked up in the area, so you can check
            which ones may be real fires, which are near people, and export them for reports or field teams.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
            <div>
              <dt className="font-medium">Detections</dt>
              <dd className="text-muted-foreground">
                How many heat spots match your filters. Each one is a satellite pixel that was much hotter than its
                surroundings. VIIRS sees 375 m pixels, MODIS 1 km.
              </dd>
            </div>
            <div>
              <dt className="font-medium">High confidence</dt>
              <dd className="text-muted-foreground">
                Heat spots the satellite is most sure are real fires, not sun glare or a hot roof. Both sensors&apos;
                ratings are converted to the same low / medium / high scale.
              </dd>
            </div>
            <div>
              <dt className="font-medium">Within {THREAT_KM} km of a settlement</dt>
              <dd className="text-muted-foreground">
                Heat spots close enough to a town or barangay to threaten homes. When this is above zero, notify the
                DRRMC.
              </dd>
            </div>
            <div>
              <dt className="font-medium">Peak brightness</dt>
              <dd className="text-muted-foreground">
                The temperature of the hottest pixel shown, in kelvin (K). Higher usually means a more intense or larger
                fire. 330 K is about 57 °C at the pixel scale.
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader className="gap-4 space-y-0 pb-4 lg:flex-row lg:items-center">
          <div className="mr-auto">
            <CardTitle className="text-base">All detections</CardTitle>
            <CardDescription>
              {filtered.length} of {HOTSPOTS.length} shown · click a row for details
            </CardDescription>
          </div>
          <div className="relative w-full lg:w-64">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Search detections"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search place, ID, coordinates"
              className="h-9 pl-8"
            />
          </div>
          <ToggleGroup type="single" size="sm" variant="outline" value={source} onValueChange={(v) => v && setSource(v as typeof source)} aria-label="Sensor">
            <ToggleGroupItem value="all">All sensors</ToggleGroupItem>
            <ToggleGroupItem value="VIIRS">VIIRS</ToggleGroupItem>
            <ToggleGroupItem value="MODIS">MODIS</ToggleGroupItem>
          </ToggleGroup>
          <ToggleGroup type="single" size="sm" variant="outline" value={confidence} onValueChange={(v) => v && setConfidence(v as typeof confidence)} aria-label="Confidence">
            <ToggleGroupItem value="all">Any</ToggleGroupItem>
            <ToggleGroupItem value="high">High</ToggleGroupItem>
            <ToggleGroupItem value="medium">Medium</ToggleGroupItem>
            <ToggleGroupItem value="low">Low</ToggleGroupItem>
          </ToggleGroup>
          {filtersActive && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Reset <X className="size-4" />
            </Button>
          )}
        </CardHeader>
        <Separator />
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-20 pl-6">ID</TableHead>
                <TableHead>Sensor</TableHead>
                <TableHead>Confidence</TableHead>
                {sortHead("brightness", "Brightness", "text-right")}
                {sortHead("acquired", "Acquired")}
                <TableHead className="hidden md:table-cell">Location</TableHead>
                {sortHead("distance", "Nearest settlement", "pr-6")}
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageItems.map((h) => (
                <TableRow
                  key={h.id}
                  tabIndex={0}
                  className="cursor-pointer"
                  onClick={() => setOpen(h)}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setOpen(h))}
                  aria-label={`Detection ${h.id}, open details`}
                >
                  <TableCell className="pl-6 font-mono text-xs text-muted-foreground">#{h.id}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {h.source}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-2 capitalize">
                      <span className={`size-2 rounded-full ${CONF_DOT[h.confidence]}`} aria-hidden />
                      {h.confidence}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{h.brightness.toFixed(1)} K</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground tabular-nums">
                    {h.acqDate} <span className="text-xs">{h.acqTime}</span>
                  </TableCell>
                  <TableCell className="hidden font-mono text-xs text-muted-foreground md:table-cell">{coords(h)}</TableCell>
                  <TableCell className="pr-6">
                    <div className="flex items-center gap-2">
                      <span className="max-w-48 truncate">{h.settlement}</span>
                      <Badge variant={h.proximityKm < THREAT_KM ? "destructive" : "secondary"} className="tabular-nums">
                        {h.proximityKm.toFixed(1)} km
                      </Badge>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={7} className="h-40 text-center">
                    <p className="font-medium">No detections match these filters</p>
                    <p className="mt-1 text-sm text-muted-foreground">Try another sensor or confidence level.</p>
                    <Button variant="outline" size="sm" className="mt-3" onClick={clearFilters}>
                      Reset filters
                    </Button>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
        {filtered.length > 0 && (
          <>
            <Separator />
            <CardFooter className="flex flex-wrap items-center justify-between gap-2 py-3">
              <p className="text-sm text-muted-foreground tabular-nums">
                {safePage * PAGE_SIZE + 1}–{safePage * PAGE_SIZE + pageItems.length} of {filtered.length}
              </p>
              {pageCount > 1 && (
                <Pagination className="mx-0 w-auto">
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        href="#"
                        aria-disabled={safePage === 0}
                        onClick={(e) => {
                          e.preventDefault();
                          setPage(Math.max(0, safePage - 1));
                        }}
                      />
                    </PaginationItem>
                    {pageNumbers.map((n, i) => (
                      <PaginationItem key={n} className="flex items-center">
                        {/* gap in the sequence → "…" before the number (the number stays clickable) */}
                        {i > 0 && pageNumbers[i - 1] !== n - 1 && <PaginationEllipsis />}
                        <PaginationLink
                          href="#"
                          isActive={n === safePage}
                          onClick={(e) => {
                            e.preventDefault();
                            setPage(n);
                          }}
                        >
                          {n + 1}
                        </PaginationLink>
                      </PaginationItem>
                    ))}
                    <PaginationItem>
                      <PaginationNext
                        href="#"
                        aria-disabled={safePage === pageCount - 1}
                        onClick={(e) => {
                          e.preventDefault();
                          setPage(Math.min(pageCount - 1, safePage + 1));
                        }}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              )}
            </CardFooter>
          </>
        )}
      </Card>

      <Sheet open={open !== null} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent className="sm:max-w-md">
          {open && (
            <>
              <SheetHeader>
                <SheetTitle>Detection #{open.id}</SheetTitle>
                <SheetDescription>
                  {open.name} · {open.municipality}
                </SheetDescription>
              </SheetHeader>
              <div className="mt-6 flex flex-wrap gap-2">
                <Badge variant="outline" className="font-mono">
                  {open.source}
                </Badge>
                <Badge variant="outline" className="gap-1.5 capitalize">
                  <span className={`size-2 rounded-full ${CONF_DOT[open.confidence]}`} /> {open.confidence} confidence
                </Badge>
                {open.proximityKm < THREAT_KM && <Badge variant="destructive">Settlement within {THREAT_KM} km</Badge>}
              </div>
              <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-5 text-sm">
                {(
                  [
                    ["Brightness", `${open.brightness.toFixed(1)} K`],
                    ["Fire power", open.frp !== undefined ? `${open.frp} MW` : "—"],
                    ["Acquired", `${open.acqDate} ${open.acqTime}`],
                    ["Raw confidence", open.rawConfidence],
                    ["Coordinates", coords(open)],
                    ["Thermal pixels", String(open.count)],
                    ["Nearest settlement", open.settlement],
                    ["Distance", `${open.proximityKm.toFixed(1)} km`],
                  ] as const
                ).map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-xs text-muted-foreground">{k}</dt>
                    <dd className="mt-1 font-medium break-words">{v}</dd>
                  </div>
                ))}
              </dl>
              <SheetFooter className="mt-8">
                <Button asChild className="w-full">
                  <Link href="/dashboard">
                    <MapPin className="size-4" /> Open live map
                  </Link>
                </Button>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>
    </EmberShell>
  );
}

