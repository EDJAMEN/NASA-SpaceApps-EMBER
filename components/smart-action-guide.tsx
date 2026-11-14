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
    <Card className="mt-4">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="ember-detail-kicker">
              <ClipboardList size={13} /> SMART ACTION GUIDE
            </div>
            <CardTitle className="mt-1 flex items-center gap-1.5 text-base">
              <MapPin size={15} /> {place.name}
            </CardTitle>
            <CardDescription>{place.region}</CardDescription>
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
            <Button type="button" variant="outline" size="sm" onClick={locateMe}>
              <LocateFixed size={14} /> Use my location
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
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

        <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs" aria-live="polite">
          {loading ? (
            <Skeleton className="h-5 w-full max-w-md" />
          ) : (
            <>
              <span>
                <Thermometer size={13} className="mr-1 inline align-[-2px]" /> Temperature{" "}
                <b>{c?.tempC != null ? `${Math.round(c.tempC)}°C` : "—"}</b>
              </span>
              <span>
                Humidity <b>{c?.humidity != null ? `${Math.round(c.humidity)}%` : "—"}</b>
              </span>
              <span className="flex items-center gap-1.5">
                Heat index <b>{guide.heatIndex !== null ? `${Math.round(guide.heatIndex)}°C` : "—"}</b>
                <Badge variant={guide.heat === "None" ? "secondary" : "destructive"}>
                  {badge.icon} {guide.heat === "None" ? "No heat warning" : guide.heat}
                </Badge>
              </span>
              <span>
                Air quality <b>{c?.usAqi != null ? `AQI ${Math.round(c.usAqi)}` : "—"}</b>
              </span>
              <span className="flex items-center gap-1.5">
                Hotspots ≤ {NEARBY_KM} km
                <Badge variant={guide.nearbyCount > 0 ? "destructive" : "secondary"}>
                  {hotspots.isLoading ? "…" : hotspots.isError ? "n/a" : guide.nearbyCount}
                </Badge>
              </span>
            </>
          )}
        </div>

        <Accordion type="multiple" defaultValue={["update", "todo"]} className="mt-4">
          <GuideSection value="update" icon={<TriangleAlert size={14} />} title="Environmental update" items={guide.update} />
          <GuideSection value="todo" icon={<CircleCheck size={14} />} title="What to do" items={guide.todo} />
          <GuideSection value="bring" icon={<Backpack size={14} />} title="What to bring" items={guide.bring} />
          <GuideSection value="prepare" icon={<ClipboardList size={14} />} title="What to prepare" items={guide.prepare} />
        </Accordion>
        <p className="mt-3 text-[10px] text-muted-foreground">
          General guidance only, based on WHO fire-safety principles and aligned with RA 9514 (BFP). Follow your local DRRMO and health authorities. Weather and air quality: Open-Meteo. Hotspots: NASA FIRMS (last 48 h).
        </p>
      </CardContent>
    </Card>
  );
}

function GuideSection({ value, icon, title, items }: { value: string; icon: React.ReactNode; title: string; items: string[] }) {
  return (
    <AccordionItem value={value}>
      <AccordionTrigger className="text-xs font-bold">
        <span className="flex items-center gap-1.5">
          {icon} {title}
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
