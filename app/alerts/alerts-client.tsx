"use client";

import { useState } from "react";
import { Check, Megaphone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { EmberShell } from "@/components/ember-shell";
import { StatCard } from "@/components/stat-card";
import { ALERTS, type AlertItem } from "@/lib/hotspots";

type Level = "all" | AlertItem["threatLevel"];

const TIER: Record<AlertItem["threatLevel"], { range: string; dot: string; badge: "destructive" | "default" | "secondary" }> = {
  CRITICAL: { range: "< 3 km", dot: "bg-red-500", badge: "destructive" },
  ELEVATED: { range: "3 – 6 km", dot: "bg-amber-500", badge: "default" },
  ADVISORY: { range: "6 – 10 km", dot: "bg-sky-500", badge: "secondary" },
};

export function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertItem[]>(ALERTS);
  const [filter, setFilter] = useState<Level>("all");
  const [open, setOpen] = useState<AlertItem | null>(null);

  const setDispatched = (id: string, dispatched: boolean) =>
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, dispatched } : a)));
  const filtered = alerts.filter((a) => filter === "all" || a.threatLevel === filter);
  const countOf = (level: AlertItem["threatLevel"]) => alerts.filter((a) => a.threatLevel === level).length;
  const pending = alerts.filter((a) => !a.dispatched).length;

  return (
    <EmberShell active="alerts" title="Alerts">
      <section className="ember-page-heading">
        <div>
          <div className="ember-eyebrow">
            <span /> DRRMC EARLY RESPONSE
          </div>
          <h1>
            Settlement proximity alerts<span>.</span>
          </h1>
          <p>Fires ranked by how close they are to populated places.</p>
        </div>
        <div className="ember-page-actions">
          <Button size="sm" disabled={!pending} onClick={() => setAlerts((prev) => prev.map((a) => ({ ...a, dispatched: true })))}>
            <Megaphone className="size-4" /> Broadcast bulletin
          </Button>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Threat tiers">
        <StatCard label="Critical · < 3 km" value={countOf("CRITICAL")} hint={countOf("CRITICAL") ? "Immediate response" : "None"} tone={countOf("CRITICAL") ? "alert" : undefined} />
        <StatCard label="Elevated · 3 – 6 km" value={countOf("ELEVATED")} hint="Monitor closely" />
        <StatCard label="Advisory · 6 – 10 km" value={countOf("ADVISORY")} hint="Inform residents" />
        <StatCard label="Dispatched" value={`${alerts.length - pending}/${alerts.length}`} hint={pending ? `${pending} awaiting a unit` : "All covered"} />
      </section>

      <section className="mt-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Active alerts</h2>
            <p className="text-sm text-muted-foreground">Sorted by nearest settlement</p>
          </div>
          <ToggleGroup type="single" size="sm" variant="outline" value={filter} onValueChange={(v) => v && setFilter(v as Level)} aria-label="Threat level">
            <ToggleGroupItem value="all">All</ToggleGroupItem>
            <ToggleGroupItem value="CRITICAL">Critical</ToggleGroupItem>
            <ToggleGroupItem value="ELEVATED">Elevated</ToggleGroupItem>
            <ToggleGroupItem value="ADVISORY">Advisory</ToggleGroupItem>
          </ToggleGroup>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((a) => (
            <Card key={a.id} className="flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Badge variant={TIER[a.threatLevel].badge} className="gap-1.5">
                    <span className={`size-1.5 rounded-full bg-current`} aria-hidden />
                    {a.threatLevel.toLowerCase()}
                  </Badge>
                  <span className="ml-auto font-mono text-xs text-muted-foreground">{a.id}</span>
                </div>
                <CardTitle className="pt-2 text-base">{a.settlement}</CardTitle>
                <CardDescription>
                  {a.municipality} · {a.distanceKm.toFixed(1)} km from hotspot #{a.hotspotId}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 pb-3">
                <dl className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <dt className="text-muted-foreground">Detected</dt>
                    <dd className="mt-0.5 font-medium">{a.timestamp}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Sensor</dt>
                    <dd className="mt-0.5 font-mono font-medium">{a.source}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Brightness</dt>
                    <dd className="mt-0.5 font-mono font-medium tabular-nums">{a.brightness} K</dd>
                  </div>
                </dl>
              </CardContent>
              <CardFooter className="gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => setOpen(a)}>
                  Details
                </Button>
                <Button
                  variant={a.dispatched ? "secondary" : "default"}
                  size="sm"
                  className="flex-1"
                  aria-pressed={a.dispatched}
                  onClick={() => setDispatched(a.id, !a.dispatched)}
                >
                  {a.dispatched ? (
                    <>
                      <Check className="size-4" /> Dispatched
                    </>
                  ) : (
                    "Dispatch unit"
                  )}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
        {filtered.length === 0 && (
          <Card className="grid h-40 place-items-center text-center">
            <div>
              <p className="font-medium">No alerts at this level</p>
              <Button variant="link" size="sm" onClick={() => setFilter("all")}>
                Show all alerts
              </Button>
            </div>
          </Card>
        )}
      </section>

      <Dialog open={open !== null} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="sm:max-w-md">
          {open && (
            <>
              <DialogHeader>
                <DialogTitle>Dispatch bulletin · {open.id}</DialogTitle>
                <DialogDescription>
                  {open.settlement}, {open.municipality}
                </DialogDescription>
              </DialogHeader>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-4 text-sm">
                {(
                  [
                    ["Threat level", `${open.threatLevel.toLowerCase()} (${TIER[open.threatLevel].range})`],
                    ["Distance", `${open.distanceKm.toFixed(1)} km`],
                    ["Sensor", `NASA ${open.source}`],
                    ["Confidence", open.confidence],
                    ["Brightness", `${open.brightness} K`],
                    ["Detected", open.timestamp],
                  ] as const
                ).map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-xs text-muted-foreground">{k}</dt>
                    <dd className="mt-1 font-medium capitalize">{v}</dd>
                  </div>
                ))}
              </dl>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="outline" onClick={() => setOpen(null)}>
                  Close
                </Button>
                <Button
                  disabled={open.dispatched}
                  onClick={() => {
                    setDispatched(open.id, true); // confirm always dispatches; never un-dispatches
                    setOpen(null);
                  }}
                >
                  {open.dispatched ? "Already dispatched" : "Confirm dispatch"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </EmberShell>
  );
}
