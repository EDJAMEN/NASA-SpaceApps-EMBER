"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Backpack, CircleCheck, ClipboardList, LocateFixed, MapPin, Search, Thermometer, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchFirmsHotspots } from "@/lib/firms-client";
import { haversineKm } from "@/lib/hotspots";
import { buildGuide, NEARBY_KM, type HeatLevel } from "@/lib/action-guide";
import { firmsKey, type GuidePlace } from "@/lib/geocode";
import { PlaceCombobox } from "@/components/place-combobox";
import { conditionsKey, fetchConditions } from "@/lib/conditions";

// Icon + text per level so the level never depends on color alone (README §5).
export const HEAT_BADGE: Record<HeatLevel, { icon: string; color: string }> = {
  None: { icon: "○", color: "var(--muted-foreground)" },
  Caution: { icon: "▲", color: "#d99a2b" },
  "Extreme Caution": { icon: "▲▲", color: "#e86a1f" },
  Danger: { icon: "◆", color: "#e2481f" },
  "Extreme Danger": { icon: "✖", color: "#b4161b" },
};

export function SmartActionGuide({ place, onLocate }: { place: GuidePlace; onLocate: (place: GuidePlace) => void }) {
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");

  const choose = (next: GuidePlace) => {
    setQuery("");
    setMessage("");
    onLocate(next);
  };

  const locateMe = () => {
    if (!navigator.geolocation) return setMessage("Your browser does not support location.");
    setMessage("Finding your location…");
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        choose({
          name: "My location",
          region: `${pos.coords.latitude.toFixed(3)}, ${pos.coords.longitude.toFixed(3)}`,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        }),
      () => setMessage("Location permission was denied. Search for your place instead."),
      { enableHighAccuracy: false, timeout: 10_000 },
    );
  };

  const conditions = useQuery({
    queryKey: conditionsKey(place.lat, place.lng),
    queryFn: () => fetchConditions(place.lat, place.lng),
    staleTime: 10 * 60 * 1000,
  });
  const hotspots = useQuery({
    queryKey: firmsKey(place),
    queryFn: () => fetchFirmsHotspots(place),
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });

  const c = conditions.data;
  const guide = buildGuide({
    hotspots: hotspots.isError
      ? null
      : (hotspots.data ?? []).map((h) => ({
          distanceKm: haversineKm(place.lat, place.lng, h.lat, h.lng),
          highConfidence: h.confidence === "high",
        })),
    tempC: c?.tempC ?? null,
    humidity: c?.humidity ?? null,
    windKmh: c?.windKmh ?? null,
    usAqi: c?.usAqi ?? null,
  });
  const loading = conditions.isLoading || hotspots.isLoading;
  const badge = HEAT_BADGE[guide.heat];
  const closeFire = guide.nearestKm !== null && guide.nearestKm <= 5;

  return (
    <Card className="mt-4 overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-primary/[0.07] to-transparent p-3 pb-2 sm:p-4 sm:pb-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <Badge variant="secondary" className="gap-1">
              <ClipboardList size={12} /> Smart action guide
            </Badge>
            <CardTitle className="flex items-center gap-1.5 text-base">
              <MapPin size={15} className="text-primary" /> {place.name}
            </CardTitle>
            <CardDescription className="text-[11px]">{place.region}</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <PlaceCombobox
              className="ember-map-search"
              style={{ position: "relative", top: 0, right: 0 }}
              label="Search any place worldwide"
              placeholder="Search any city or town"
              value={query}
              onChange={setQuery}
              onPick={choose}
              before={<Search size={15} />}
            />
            <Button type="button" variant="outline" size="sm" className="h-8" onClick={locateMe}>
              <LocateFixed size={14} /> Use my location
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-3 sm:p-4">
        {message && (
          <div role="status" className="mb-3 text-xs">
            <span className="text-muted-foreground">{message}</span>
          </div>
        )}

        {closeFire && (
          <Alert variant="destructive" className="mb-4">
            <TriangleAlert size={14} />
            <AlertTitle>Fire within 5 km of this point</AlertTitle>
            <AlertDescription className="flex flex-wrap items-center gap-2">
              Nearest hotspot about {guide.nearestKm!.toFixed(1)} km away. Keep away and follow DRRMO advice.
              <Button asChild variant="outline" size="sm">
                <Link href="/alerts">View related alerts</Link>
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-5" aria-live="polite">
          {loading ? (
            <>
              <Skeleton className="h-[52px]" />
              <Skeleton className="h-[52px]" />
              <Skeleton className="h-[52px]" />
              <Skeleton className="h-[52px]" />
              <Skeleton className="h-[52px]" />
            </>
          ) : (
            <>
              <div className="rounded-lg border bg-muted/40 p-2">
                <p className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-wide text-muted-foreground">
                  <Thermometer size={11} /> Temp
                </p>
                <p className="mt-0.5 text-lg font-bold tabular-nums">{c?.tempC != null ? `${Math.round(c.tempC)}°C` : "—"}</p>
              </div>
              <div className="rounded-lg border bg-muted/40 p-2">
                <p className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">Humidity</p>
                <p className="mt-0.5 text-lg font-bold tabular-nums">{c?.humidity != null ? `${Math.round(c.humidity)}%` : "—"}</p>
              </div>
              <div className="rounded-lg border bg-muted/40 p-2">
                <p className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">Heat index</p>
                <p className="mt-0.5 text-lg font-bold tabular-nums">{guide.heatIndex !== null ? `${Math.round(guide.heatIndex)}°C` : "—"}</p>
                <Badge variant={guide.heat === "None" ? "secondary" : "destructive"} className="mt-1 h-4 px-1 text-[8px]">
                  {badge.icon} {guide.heat === "None" ? "No heat warning" : guide.heat}
                </Badge>
              </div>
              <div className="rounded-lg border bg-muted/40 p-2">
                <p className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">Air quality</p>
                <p className="mt-0.5 text-lg font-bold tabular-nums">{c?.usAqi != null ? `AQI ${Math.round(c.usAqi)}` : "—"}</p>
              </div>
              <div className="rounded-lg border bg-muted/40 p-2">
                <p className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">Hotspots ≤ {NEARBY_KM} km</p>
                <p className="mt-0.5 text-lg font-bold tabular-nums">{hotspots.isLoading ? "…" : hotspots.isError ? "n/a" : guide.nearbyCount}</p>
              </div>
            </>
          )}
        </div>

        <Accordion type="multiple" defaultValue={["update", "todo"]} className="mt-3">
          <GuideSection value="update" icon={<TriangleAlert size={13} />} tint="bg-amber-500/15 text-amber-600 dark:text-amber-400" title="Environmental update" items={guide.update} />
          <GuideSection value="todo" icon={<CircleCheck size={13} />} tint="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" title="What to do" items={guide.todo} />
          <GuideSection value="bring" icon={<Backpack size={13} />} tint="bg-sky-500/15 text-sky-600 dark:text-sky-400" title="What to bring" items={guide.bring} />
          <GuideSection value="prepare" icon={<ClipboardList size={13} />} tint="bg-violet-500/15 text-violet-600 dark:text-violet-400" title="What to prepare" items={guide.prepare} />
        </Accordion>
        <p className="mt-3 text-[10px] text-muted-foreground">
          General guidance only, based on WHO fire-safety principles and aligned with RA 9514 (BFP). Follow your local DRRMO and health authorities. Weather and air quality: Open-Meteo. Hotspots: NASA FIRMS (last 48 h).
        </p>
      </CardContent>
    </Card>
  );
}

function GuideSection({ value, icon, tint, title, items }: { value: string; icon: React.ReactNode; tint: string; title: string; items: string[] }) {
  return (
    <AccordionItem value={value}>
      <AccordionTrigger className="text-xs font-bold hover:no-underline">
        <span className="flex items-center gap-2">
          <span className={`flex size-6 items-center justify-center rounded-md ${tint}`}>{icon}</span>
          {title}
          <Badge variant="secondary" className="h-4 px-1 font-mono text-[9px]">{items.length}</Badge>
        </span>
      </AccordionTrigger>
      <AccordionContent>
        <ul className="list-disc pl-[18px] text-xs leading-relaxed">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </AccordionContent>
    </AccordionItem>
  );
}
