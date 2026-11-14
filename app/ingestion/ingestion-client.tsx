"use client";

import { useState } from "react";
import { RefreshCw, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EmberShell } from "@/components/ember-shell";
import { SATELLITES, SYNC_LOGS } from "@/lib/hotspots";

const STEPS = [
  { title: "FIRMS polling", body: "Ingests rolling 24 h & 48 h CSV/JSON feeds." },
  { title: "Coordinate ordering", body: "Flips [lat, lon] into POINT(lon lat), SRID 4326." },
  { title: "Confidence normalization", body: "Maps MODIS 0–100% and VIIRS l/n/h to low/medium/high." },
  { title: "Spatial deduplication", body: "Merges overlapping MODIS (1 km) and VIIRS (375 m) signals." },
  { title: "Idempotent upsert", body: "ON CONFLICT skip: repeat pulls never duplicate records." },
];

const logTone = (log: string) =>
  log.includes("POSTGIS") || log.includes("COMPLETE") ? "text-emerald-600 dark:text-emerald-400" : log.includes("HARMONIZER") ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground";

export function IngestionPage() {
  const [logs, setLogs] = useState<string[]>(SYNC_LOGS);
  const [syncing, setSyncing] = useState(false);

  // shortcut: simulated run, no backend. Wire to a sync endpoint when connected.
  const triggerSync = () => {
    setSyncing(true);
    setTimeout(() => {
      const now = new Date().toISOString().substring(11, 19);
      setLogs((prev) => [
        `[${now} UTC] [MANUAL_SYNC] Simulated FIRMS poll for bounding box [7.3, 124.5, 8.6, 125.5] (Bukidnon)...`,
        `[${now} UTC] [DB_STATUS] 0 new duplicates skipped, 6 new hotspots staged (sample).`,
        ...prev,
      ]);
      setSyncing(false);
    }, 1200);
  };

  return (
    <EmberShell active="ingestion" title="Ingestion">
      <section className="ember-page-heading">
        <div>
          <div className="ember-eyebrow">
            <span /> PIPELINE SIMULATION
          </div>
          <h1>
            NASA FIRMS ingestion<span>.</span>
          </h1>
          <p>Raw FIRMS payloads are transformed, deduplicated, and stored in PostGIS.</p>
        </div>
        <div className="ember-page-actions">
          <Button size="sm" onClick={triggerSync} disabled={syncing}>
            <RefreshCw className={`size-4 ${syncing ? "animate-spin" : ""}`} /> {syncing ? "Syncing…" : "Trigger manual ingest"}
          </Button>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Satellite feeds">
        {SATELLITES.map((sat) => (
          <Card key={sat.name}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardDescription className="truncate">{sat.name}</CardDescription>
                <Badge variant="outline" className="gap-1.5 text-[10px]">
                  <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden /> {sat.status.toLowerCase()}
                </Badge>
              </div>
              <CardTitle className="text-lg font-semibold">{sat.sensor}</CardTitle>
            </CardHeader>
            <CardContent className="flex justify-between text-xs text-muted-foreground">
              <span>{sat.resolution}</span>
              <span>Synced {sat.lastSync}</span>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Harmonization pipeline</CardTitle>
          <CardDescription>How raw FIRMS payloads are transformed before storage</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {STEPS.map((s, i) => (
              <li key={s.title} className="relative">
                <span className="grid size-7 place-items-center rounded-full border bg-muted font-mono text-xs font-semibold">{i + 1}</span>
                <h3 className="mt-3 text-sm font-medium">{s.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{s.body}</p>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">Ingestion log</CardTitle>
            <CardDescription>Daemon output, newest first</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setLogs([])} disabled={!logs.length}>
            <Trash2 className="size-4" /> Clear
          </Button>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-72 rounded-md border bg-muted/30">
            <div className="space-y-1.5 p-4 font-mono text-xs" role="log" aria-live="polite">
              {logs.map((log, i) => (
                <p key={`${i}-${log}`} className={logTone(log)}>
                  {log}
                </p>
              ))}
              {logs.length === 0 && <p className="text-muted-foreground">Log cleared. Trigger a sync to generate entries.</p>}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </EmberShell>
  );
}
