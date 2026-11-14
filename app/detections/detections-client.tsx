"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Download, Flame, MapPin, Search, Thermometer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
import { HOTSPOTS, type Confidence, type SensorSource } from "@/lib/hotspots";

const PAGE_SIZE = 10;

function toCsv(rows: typeof HOTSPOTS) {
  const header = "id,source,confidence,brightness,acquired,lat,lng,settlement,distance_km";
  const rowsOut = rows.map((h) =>
    [
      h.id,
      h.source,
      h.confidence,
      h.brightness,
      `${h.acqDate} ${h.acqTime}`,
      h.lat,
      h.lng,
      `"${h.settlement}"`,
      h.proximityKm,
    ].join(","),
  );
  return [header, ...rowsOut].join("\n");
}

export function DetectionsPage() {
  const [search, setSearch] = useState("");
  const [source, setSource] = useState<"all" | SensorSource>("all");
  const [confidence, setConfidence] = useState<"all" | Confidence>("all");

  const filtered = useMemo(
    () =>
      HOTSPOTS.filter((h) => {
        const query = search.toLowerCase();
        const matchSearch =
          !query ||
          `${h.settlement} ${h.municipality} ${h.id} ${h.lat} ${h.lng}`
            .toLowerCase()
            .includes(query);
        return (
          matchSearch &&
          (source === "all" || h.source === source) &&
          (confidence === "all" || h.confidence === confidence)
        );
      }),
    [search, source, confidence],
  );
  const maxTemp = useMemo(
    () => filtered.reduce((m, h) => Math.max(m, h.brightness), 0),
    [filtered],
  );
  const highCount = useMemo(
    () => filtered.filter((d) => d.confidence === "high").length,
    [filtered],
  );
  const threatCount = useMemo(
    () => filtered.filter((d) => d.proximityKm < 3).length,
    [filtered],
  );
  const clearFilters = () => {
    setSearch("");
    setSource("all");
    setConfidence("all");
  };

  const [page, setPage] = useState(0);
  useEffect(() => {
    setPage(0);
  }, [search, source, confidence]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageItems = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const pageNumbers = useMemo(() => {
    if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i);
    const nums = new Set([0, pageCount - 1, safePage - 1, safePage, safePage + 1]);
    return [...nums].filter((n) => n >= 0 && n < pageCount).sort((a, b) => a - b);
  }, [pageCount, safePage]);

  const exportCsv = () => {
    const url = URL.createObjectURL(new Blob([toCsv(filtered)], { type: "text/csv" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "ember-bukidnon-detections.csv";
    anchor.click();
    URL.revokeObjectURL(url);
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
          <p>NASA MODIS &amp; VIIRS telemetry normalized for spatial analysis.</p>
        </div>
        <div className="ember-page-actions">
          <Button variant="outline" className="ember-export-button" asChild>
            <Link href="/">View on live map</Link>
          </Button>
          <Button variant="outline" className="ember-export-button" onClick={exportCsv}>
            <Download size={15} /> Export CSV
          </Button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" aria-label="Detection metrics">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardDescription className="font-mono text-[10px] font-semibold tracking-wider">
              TOTAL HOTSPOTS
            </CardDescription>
            <span className="grid size-8 place-items-center rounded-md bg-muted text-muted-foreground">
              <Flame size={16} />
            </span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">{filtered.length}</div>
            <p className="text-xs text-muted-foreground">Across active filters</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardDescription className="font-mono text-[10px] font-semibold tracking-wider">
              HIGH SEVERITY
            </CardDescription>
            <span className="grid size-8 place-items-center rounded-md bg-muted text-muted-foreground">
              <AlertTriangle size={16} />
            </span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">{highCount}</div>
            <p className="text-xs text-muted-foreground">≥ 80% / &apos;h&apos; normalized</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardDescription className="font-mono text-[10px] font-semibold tracking-wider">
              SETTLEMENT THREAT (&lt;3KM)
            </CardDescription>
            <span className="grid size-8 place-items-center rounded-md bg-muted text-muted-foreground">
              <MapPin size={16} />
            </span>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold tabular-nums">{threatCount}</span>
              {threatCount > 0 && <Badge variant="destructive">DRRMC alert</Badge>}
            </div>
            <p className="text-xs text-muted-foreground">
              {threatCount > 0 ? "Requires DRRMC alert" : "No settlement within 3 km"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardDescription className="font-mono text-[10px] font-semibold tracking-wider">
              MAX TEMPERATURE
            </CardDescription>
            <span className="grid size-8 place-items-center rounded-md bg-muted text-muted-foreground">
              <Thermometer size={16} />
            </span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">
              {maxTemp > 0 ? maxTemp.toFixed(1) : "—"}
              <span className="text-sm font-normal text-muted-foreground"> K</span>
            </div>
            <p className="text-xs text-muted-foreground">Kelvin brightness</p>
          </CardContent>
        </Card>
      </section>

      <section className="ember-map-section">
        <Card>
          <CardContent className="flex flex-col gap-4 p-4 lg:flex-row lg:items-end">
            <div className="relative w-full lg:max-w-xs">
              <Search
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                aria-label="Search detections"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search settlement, record #, coords..."
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap items-end gap-4">
              <div className="grid gap-1.5">
                <span className="font-mono text-[10px] font-semibold tracking-wider text-muted-foreground">
                  SOURCE
                </span>
                <div className="ember-window-selector" aria-label="Source filter">
                  {(["all", "VIIRS", "MODIS"] as const).map((s) => (
                    <button
                      type="button"
                      key={s}
                      aria-pressed={source === s}
                      className={source === s ? "selected" : ""}
                      onClick={() => setSource(s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid gap-1.5">
                <span className="font-mono text-[10px] font-semibold tracking-wider text-muted-foreground">
                  CONFIDENCE
                </span>
                <div className="ember-window-selector" aria-label="Confidence filter">
                  {(["all", "high", "medium", "low"] as const).map((c) => (
                    <button
                      type="button"
                      key={c}
                      aria-pressed={confidence === c}
                      className={confidence === c ? "selected" : ""}
                      onClick={() => setConfidence(c)}
                      style={{ textTransform: "capitalize" }}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <p className="font-mono text-[10px] text-muted-foreground lg:ml-auto">
              {filtered.length} of {HOTSPOTS.length} shown
            </p>
          </CardContent>
        </Card>
        <div className="ember-panel">
          <Table className="text-[11px]">
            <TableHeader>
              <TableRow className="font-mono text-[9px] uppercase">
                <TableHead>ID</TableHead>
                <TableHead>Sensor</TableHead>
                <TableHead>Confidence</TableHead>
                <TableHead>Brightness</TableHead>
                <TableHead>Acquired</TableHead>
                <TableHead>Coords</TableHead>
                <TableHead>Settlement proximity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-bold">#{item.id}</TableCell>
                  <TableCell>
                    <span className="font-mono text-[9px] font-bold">{item.source}</span>
                  </TableCell>
                  <TableCell className="capitalize">
                    <span
                      className={
                        item.confidence === "high" ? "confidence-high" : "confidence-nominal"
                      }
                      style={{
                        borderRadius: "var(--radius-chip)",
                        padding: "3px 6px",
                        fontFamily: "var(--font-mono)",
                        fontSize: "9px",
                        fontWeight: 700,
                      }}
                    >
                      {item.confidence}
                    </span>{" "}
                    <span className="text-muted-foreground">({item.rawConfidence})</span>
                  </TableCell>
                  <TableCell>{item.brightness} K</TableCell>
                  <TableCell className="text-muted-foreground">
                    {item.acqDate} {item.acqTime}
                  </TableCell>
                  <TableCell className="font-mono">
                    {Math.abs(item.lat).toFixed(2)}°{item.lat >= 0 ? "N" : "S"},{" "}
                    {Math.abs(item.lng).toFixed(2)}°{item.lng >= 0 ? "E" : "W"}
                  </TableCell>
                  <TableCell>
                    {item.settlement} · <b>{item.proximityKm.toFixed(1)} km</b>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {filtered.length === 0 ? (
            <div className="ember-no-results">
              No detections match the selected filters.{" "}
              <button
                type="button"
                onClick={clearFilters}
                style={{
                  border: 0,
                  background: "transparent",
                  padding: 0,
                  color: "var(--primary)",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <p className="font-mono text-[10px] text-muted-foreground">
                {filtered.length === 0
                  ? "0 results"
                  : `Showing ${safePage * PAGE_SIZE + 1}–${safePage * PAGE_SIZE + pageItems.length} of ${filtered.length}`}
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
                      <PaginationItem key={n}>
                        {i > 0 && pageNumbers[i - 1] !== n - 1 ? (
                          <PaginationEllipsis />
                        ) : (
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
                        )}
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
            </div>
          )}
        </div>
      </section>
    </EmberShell>
  );
}
