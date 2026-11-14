"use client";

import type React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { MapPin } from "lucide-react";
import type { HeatLevel } from "@/lib/action-guide";
import type { Conditions } from "@/lib/conditions";
import type { GuidePlace } from "@/lib/geocode";
import type { AdminLevel } from "@/app/api/boundary/route";
import { HEAT_SCALE, HEAT_TICKS, heatColor } from "@/lib/heat-grid";
import { HEAT_BADGE } from "@/components/smart-action-guide";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";

/** Color scale bar matching the "Max Heat Index" reference legend. */
export function HeatScaleLegend({ title, dark = false }: { title: string; dark?: boolean }) {
  const swatches = HEAT_SCALE.map(([, color]) => color);
  return (
    <div role="img" aria-label={`${title}: color scale from 0 to above 50 °C`}>
      <div className="mb-1 text-center text-xs font-semibold">{title}</div>
      <div className="flex h-2.5 overflow-hidden rounded-full border border-black/35">
        {swatches.map((c) => (
          <span key={c} className="flex-1" style={{ background: c }} />
        ))}
      </div>
      <div className="mt-1 flex justify-between font-mono text-[9px] text-muted-foreground">
        {HEAT_TICKS.map((t) => (
          <span key={t}>{t}</span>
        ))}
      </div>
      <div className="text-center text-[9px] text-muted-foreground">°C</div>
    </div>
  );
}

const SCALE_MAX = 55; // the legend runs 0 → 50+; 55 gives the dark-red "above 50" band some room

/**
 * The map legend as a slider: drag the two handles along the full color scale (each legend temperature
 * marked) and only areas inside that range stay covered on the map.
 */
export function HeatScaleSlider({
  title,
  range,
  domain,
  onRangeChange,
}: {
  title: string;
  range: [number, number] | null;
  domain: [number, number] | null; // what the area around the place actually has
  onRangeChange: (range: [number, number]) => void;
}) {
  const pct = (v: number) => `${(Math.max(0, Math.min(SCALE_MAX, v)) / SCALE_MAX) * 100}%`;
  // Hard color stops so each band reads exactly like the reference legend.
  const bands = HEAT_SCALE.map(([min, color], i) => {
    const from = pct(Math.max(0, min));
    const next = HEAT_SCALE[i + 1]?.[0] ?? SCALE_MAX;
    return `${color} ${from}, ${color} ${pct(next)}`;
  }).join(", ");
  const clamp = (v: number) => (domain ? Math.max(domain[0], Math.min(domain[1], v)) : v);
  return (
    <div className="text-[9px]">
      <div className="mb-1.5 flex justify-between font-semibold">
        <span>{title}</span>
        <span className="font-mono">{range ? `${range[0]}–${range[1]}°C` : "loading…"}</span>
      </div>
      <SliderPrimitive.Root
        min={0}
        max={SCALE_MAX}
        step={1}
        minStepsBetweenThumbs={0}
        value={range ?? [0, SCALE_MAX]}
        disabled={!range}
        // Handles stay within the temperatures that actually occur around this place.
        onValueChange={(v) => onRangeChange([clamp(v[0]!), clamp(v[1]!)])}
        aria-label={`${title} range`}
        className="relative flex h-6 w-full touch-none select-none items-center"
      >
        <SliderPrimitive.Track
          className="relative h-3 grow rounded-full border border-black/45"
          style={{ background: `linear-gradient(to right, ${bands})` }}
        >
          {domain && (
            // Faint marker of the temperatures present around this place.
            <span
              aria-hidden
              className="absolute rounded border border-dashed border-white/55"
              style={{ top: -4, bottom: -4, left: pct(domain[0]), right: `calc(100% - ${pct(domain[1])})` }}
            />
          )}
          <SliderPrimitive.Range className="absolute h-full rounded-full ring-2 ring-white" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb
          aria-label={`Lowest ${title.toLowerCase()}`}
          className="block h-[18px] w-[18px] cursor-grab rounded-full border-2 border-black bg-white shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <SliderPrimitive.Thumb
          aria-label={`Highest ${title.toLowerCase()}`}
          className="block h-[18px] w-[18px] cursor-grab rounded-full border-2 border-black bg-white shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </SliderPrimitive.Root>
      <div className="relative mt-0.5 h-3 font-mono">
        {HEAT_TICKS.map((t) => (
          <button
            type="button"
            key={t}
            // Click a legend temperature to jump the nearest handle there.
            onClick={() => {
              if (!range) return;
              const v = clamp(t);
              onRangeChange(Math.abs(v - range[0]) <= Math.abs(v - range[1]) ? [Math.min(v, range[1]), range[1]] : [range[0], Math.max(v, range[0])]);
            }}
            className="absolute -translate-x-1/2 cursor-pointer text-[9px]"
            style={{ left: pct(t) }}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="text-center text-muted-foreground">°C · dashed box = temperatures around this place</div>
    </div>
  );
}

/** Full-width two-handle slider: pick a °C range; the map covers only areas inside it. */
function RangePicker({
  what,
  domain,
  range,
  onRangeChange,
  coverage,
  loading,
  failed,
  coverageOf,
}: {
  what: string;
  domain: [number, number] | null;
  range: [number, number] | null;
  onRangeChange: (range: [number, number]) => void;
  coverage: number | null;
  loading: boolean;
  failed: boolean; // the temperature grid request errored (weather service unreachable)
  coverageOf: string | null; // name of the place the areas are clipped to
}) {
  // Always usable: before (or without) temperature data the slider spans the whole legend scale,
  // and the chosen range applies as soon as the data arrives.
  const [min, max] = domain ?? [0, SCALE_MAX];
  range = range ?? [min, max];
  const status = domain
    ? null
    : loading
      ? `Loading ${what} data for this area…`
      : failed
        ? `${what[0]!.toUpperCase()}${what.slice(1)} data isn’t available right now (the weather service didn’t respond). Your range applies once it loads.`
        : null;
  // Track painted with the legend colors across this place's own min–max.
  const stops = Array.from({ length: 11 }, (_, k) => {
    const v = min + ((max - min) * k) / 10;
    return `${heatColor(v)} ${k * 10}%`;
  }).join(", ");
  const full = range[0] === min && range[1] === max;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-semibold tabular-nums">
          {range[0]}–{range[1]}°C
        </span>
        {!full && (
          <button
            type="button"
            onClick={() => onRangeChange([min, max])}
            className="text-[11px] text-muted-foreground underline"
          >
            Show all
          </button>
        )}
      </div>
      <SliderPrimitive.Root
        min={min}
        max={max}
        step={1}
        minStepsBetweenThumbs={0}
        value={range}
        onValueChange={(v) => onRangeChange([v[0]!, v[1]!])}
        aria-label={`Select ${what} range`}
        className="relative mt-1 flex h-5 w-full touch-none select-none items-center"
      >
        <SliderPrimitive.Track
          className="relative h-2 grow rounded-full border border-black/25 shadow-sm"
          style={{ background: `linear-gradient(to right, ${stops})` }}
        >
          <SliderPrimitive.Range className="absolute h-full rounded-full ring-1 ring-foreground" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb
          aria-label={`Lowest ${what}`}
          className="block size-4 cursor-grab rounded-full border-2 border-foreground bg-background shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <SliderPrimitive.Thumb
          aria-label={`Highest ${what}`}
          className="block size-4 cursor-grab rounded-full border-2 border-foreground bg-background shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </SliderPrimitive.Root>
      <div className="flex justify-between font-mono text-[9px] text-muted-foreground">
        <span>{min}°C</span>
        <span>{max}°C</span>
      </div>
      {loading && !domain ? (
        <Skeleton className="mt-2 h-4 w-2/3" />
      ) : (
        <p className="mt-1.5 text-xs text-muted-foreground">
          {status
            ? status
            : coverage === null
              ? ""
              : coverage === 0
                ? `Nothing here in this range.`
                : `Covers ~${Math.max(1, Math.round(coverage * 100))}% of ${coverageOf ?? "this area"}.`}
        </p>
      )}
    </div>
  );
}


/** Area level chips: only the levels that really exist for this place, each with its real name. */
function AreaLevelPicker({
  levels,
  levelKey,
  onLevelChange,
  missing,
}: {
  levels: AdminLevel[] | null;
  levelKey: string | null;
  onLevelChange: (key: string) => void;
  missing: string | null;
}) {
  if (levels === null) {
    return <Skeleton className="mt-3 h-9 w-full" />;
  }
  if (levels.length === 0) {
    return <p className="mt-3 text-xs text-muted-foreground">No administrative areas found here.</p>;
  }
  return (
    <div className="mt-2">
      <RadioGroup
        value={levelKey ?? ""}
        onValueChange={onLevelChange}
        aria-label="Area level"
        className="flex flex-wrap gap-1"
      >
        {levels.map((l) => {
          const on = l.key === levelKey;
          return (
            <div key={l.key} className="flex items-center">
              <RadioGroupItem value={l.key} id={`area-${l.key}`} className="sr-only" />
              <Label
                htmlFor={`area-${l.key}`}
                title={`${l.label}: ${l.name}`}
                className={`flex cursor-pointer items-center gap-1 rounded-full border px-2 py-0.5 leading-tight transition-colors ${on ? "border-foreground bg-foreground text-background shadow-sm" : "border-border bg-background/60"}`}
              >
                <span className={`font-mono text-[8px] uppercase ${on ? "opacity-70" : "text-muted-foreground"}`}>{l.label}</span>
                <span className={`text-[11px] ${on ? "font-bold" : "font-medium"}`}>{l.name}</span>
              </Label>
            </div>
          );
        })}
      </RadioGroup>
      {missing && (
        <p className="mt-1.5 text-xs text-muted-foreground">
          {missing} has no official border mapped in OpenStreetMap, so it can&rsquo;t be covered precisely. Choose a larger level, such as the city.
        </p>
      )}
    </div>
  );
}
function Big({ value, label }: { value: number | null; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span
        aria-hidden
        className="h-8 w-2.5 rounded-full shadow-[0_0_8px_rgb(0_0_0/25%)]"
        style={{ background: value === null ? "var(--muted)" : heatColor(value) }}
      />
      <div className="leading-none">
        <div className="bg-gradient-to-br from-foreground to-foreground/60 bg-clip-text text-2xl font-bold tabular-nums text-transparent">
          {value === null ? "…" : `${Math.round(value)}°C`}
        </div>
        <div className="mt-0.5 text-[11px] text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}

export function ClimatePanel({
  view,
  place,
  conditions,
  error,
  heatIndexNow,
  heat,
  domain,
  range,
  onRangeChange,
  coverage,
  areasLoading,
  areasFailed,
  coverageOf,
  levels,
  levelKey,
  onLevelChange,
  levelMissing,
}: {
  view: "temperature" | "heatindex";
  place: GuidePlace;
  conditions: Conditions | undefined;
  error: boolean;
  heatIndexNow: number | null;
  heat: HeatLevel;
  domain: [number, number] | null;
  range: [number, number] | null;
  onRangeChange: (range: [number, number]) => void;
  coverage: number | null;
  areasLoading: boolean;
  areasFailed: boolean;
  coverageOf: string | null;
  levels: AdminLevel[] | null; // the place's real hierarchy, largest → smallest
  levelKey: string | null;
  onLevelChange: (key: string) => void;
  levelMissing: string | null; // chosen level has no mapped border (e.g. a barangay mapped as a point)
}) {
  const badge = HEAT_BADGE[heat];
  const maxHi = conditions?.maxHeatIndexC ?? null;
  return (
    <Card aria-live="polite" className="border-0 bg-transparent shadow-none">
      <CardHeader className="space-y-1 p-3 pb-1">
        <CardDescription className="flex items-center gap-1.5 font-semibold uppercase tracking-wide">
          <span className="flex size-5 items-center justify-center rounded-md bg-sky-500/15 text-sky-600 dark:text-sky-400">
            <MapPin size={12} />
          </span>
          {view === "temperature" ? "Temperature" : "Heat index"}
        </CardDescription>
        <CardTitle className="text-sm leading-tight">{place.name}</CardTitle>
        <CardDescription className="-mt-0.5 text-[11px]">{place.region}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 p-3 pt-0">
        <AreaLevelPicker levels={levels} levelKey={levelKey} onLevelChange={onLevelChange} missing={levelMissing} />
        <Separator className="my-3" />
        {error ? (
          <p className="mt-2.5 text-sm">Weather data is unavailable right now.</p>
        ) : view === "temperature" ? (
          <>
            <Big value={conditions?.tempC ?? null} label={`Now · feels ${heatIndexNow !== null ? `${Math.round(heatIndexNow)}°C` : "…"}`} />
            <p className="text-xs text-muted-foreground">
              Humidity <b className="text-foreground">{conditions?.humidity != null ? `${Math.round(conditions.humidity)}%` : "…"}</b>
              {" · "}Wind <b className="text-foreground">{conditions?.windKmh != null ? `${Math.round(conditions.windKmh)} km/h` : "…"}</b>
            </p>
          </>
        ) : (
          <>
            <Big value={maxHi} label={`Max today · now ${heatIndexNow !== null ? `${Math.round(heatIndexNow)}°C` : "…"}`} />
            <p className="flex flex-wrap items-center gap-x-1 text-xs text-muted-foreground">
              <span>Level</span>
              <Badge variant="secondary">
                {badge.icon} {heat === "None" ? "No heat warning" : heat}
              </Badge>
              <span>(PAGASA) · Temp</span>
              <b className="text-foreground">{conditions?.tempC != null ? `${Math.round(conditions.tempC)}°C` : "…"}</b>
              <span>· Humidity</span>
              <b className="text-foreground">{conditions?.humidity != null ? `${Math.round(conditions.humidity)}%` : "…"}</b>
            </p>
          </>
        )}

        <RangePicker
          what={view === "temperature" ? "temperature" : "max heat index"}
          domain={domain}
          range={range}
          onRangeChange={onRangeChange}
          coverage={coverage}
          loading={areasLoading}
          failed={areasFailed}
          coverageOf={coverageOf}
        />

        <p className="mt-3 text-[10px] leading-snug text-muted-foreground" title="Dashed line = official OpenStreetMap border">
          Tap map or search to check another spot. Source: Open-Meteo.
        </p>
      </CardContent>
    </Card>
  );
}
