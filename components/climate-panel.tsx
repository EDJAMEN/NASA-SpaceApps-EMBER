"use client";

import type React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { Droplets, Thermometer } from "lucide-react";
import type { HeatLevel } from "@/lib/action-guide";
import type { Conditions } from "@/lib/conditions";
import type { GuidePlace } from "@/lib/geocode";
import type { AdminLevel } from "@/app/api/boundary/route";
import { HEAT_SCALE, HEAT_TICKS, heatColor } from "@/lib/heat-grid";
import { HEAT_BADGE } from "@/components/smart-action-guide";

/** Color scale bar matching the "Max Heat Index" reference legend. */
export function HeatScaleLegend({ title, dark = false }: { title: string; dark?: boolean }) {
  const swatches = HEAT_SCALE.map(([, color]) => color);
  return (
    <div role="img" aria-label={`${title}: color scale from 0 to above 50 °C`} style={{ fontSize: "9px", color: dark ? "oklch(0.97 0.01 90)" : undefined }}>
      <div style={{ fontWeight: 700, textAlign: "center", marginBottom: "4px" }}>{title}</div>
      <div style={{ display: "flex", height: "10px", borderRadius: "var(--radius-pill)", overflow: "hidden", border: "1px solid rgb(0 0 0 / 35%)" }}>
        {swatches.map((c) => (
          <span key={c} style={{ flex: 1, background: c }} />
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--font-mono)", marginTop: "3px" }}>
        {HEAT_TICKS.map((t) => (
          <span key={t}>{t}</span>
        ))}
      </div>
      <div style={{ textAlign: "center", marginTop: "2px", opacity: 0.8 }}>°C</div>
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
  const thumb: React.CSSProperties = {
    display: "block",
    width: "18px",
    height: "18px",
    borderRadius: "var(--radius-pill)",
    background: "#fff",
    border: "2px solid #111",
    boxShadow: "0 1px 5px rgb(0 0 0 / 45%)",
    cursor: "grab",
  };
  const clamp = (v: number) => (domain ? Math.max(domain[0], Math.min(domain[1], v)) : v);
  return (
    <div style={{ fontSize: "9px", color: "oklch(0.97 0.01 90)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, marginBottom: "6px" }}>
        <span>{title}</span>
        <span style={{ fontFamily: "var(--font-mono)" }}>{range ? `${range[0]}–${range[1]}°C` : "loading…"}</span>
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
        style={{ position: "relative", display: "flex", alignItems: "center", width: "100%", height: "24px", touchAction: "none", userSelect: "none" }}
      >
        <SliderPrimitive.Track
          style={{ position: "relative", flexGrow: 1, height: "12px", borderRadius: "var(--radius-pill)", background: `linear-gradient(to right, ${bands})`, border: "1px solid rgb(0 0 0 / 45%)" }}
        >
          {domain && (
            // Faint marker of the temperatures present around this place.
            <span
              aria-hidden
              style={{ position: "absolute", top: "-4px", bottom: "-4px", left: pct(domain[0]), right: `calc(100% - ${pct(domain[1])})`, border: "1px dashed rgb(255 255 255 / 55%)", borderRadius: "var(--radius-control)" }}
            />
          )}
          <SliderPrimitive.Range style={{ position: "absolute", height: "100%", borderRadius: "var(--radius-pill)", boxShadow: "0 0 0 2px #fff" }} />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb aria-label={`Lowest ${title.toLowerCase()}`} style={thumb} />
        <SliderPrimitive.Thumb aria-label={`Highest ${title.toLowerCase()}`} style={thumb} />
      </SliderPrimitive.Root>
      <div style={{ position: "relative", height: "12px", fontFamily: "var(--font-mono)", marginTop: "2px" }}>
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
            style={{ position: "absolute", left: pct(t), transform: "translateX(-50%)", color: "inherit", fontSize: "9px", cursor: "pointer" }}
          >
            {t}
          </button>
        ))}
      </div>
      <div style={{ textAlign: "center", marginTop: "2px", opacity: 0.8 }}>°C · dashed box = temperatures around this place</div>
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
  const thumb: React.CSSProperties = {
    display: "block",
    width: "20px",
    height: "20px",
    borderRadius: "var(--radius-pill)",
    background: "var(--background)",
    border: "2px solid var(--foreground)",
    boxShadow: "0 1px 4px rgb(0 0 0 / 30%)",
    cursor: "grab",
  };
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "8px" }}>
        <span style={{ fontWeight: 700 }}>
          Show areas {range[0]}–{range[1]}°C
        </span>
        {!full && (
          <button
            type="button"
            onClick={() => onRangeChange([min, max])}
            style={{ fontSize: "11px", textDecoration: "underline", color: "var(--muted-foreground)" }}
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
        style={{ position: "relative", display: "flex", alignItems: "center", width: "100%", height: "28px", marginTop: "8px", touchAction: "none", userSelect: "none" }}
      >
        <SliderPrimitive.Track
          style={{ position: "relative", flexGrow: 1, height: "10px", borderRadius: "var(--radius-pill)", background: `linear-gradient(to right, ${stops})`, border: "1px solid rgb(0 0 0 / 25%)" }}
        >
          <SliderPrimitive.Range style={{ position: "absolute", height: "100%", borderRadius: "var(--radius-pill)", boxShadow: "0 0 0 2px var(--foreground)" }} />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb aria-label={`Lowest ${what}`} style={thumb} />
        <SliderPrimitive.Thumb aria-label={`Highest ${what}`} style={thumb} />
      </SliderPrimitive.Root>
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--muted-foreground)" }}>
        <span>{min}°C</span>
        <span>{max}°C</span>
      </div>
      <p style={{ marginTop: "6px", fontSize: "11px", color: status ? "var(--muted-foreground)" : undefined }}>
        {status
          ? status
          : coverage === null
          ? ""
          : coverage === 0
            ? `Nothing here in this range.`
            : `Covers ~${Math.max(1, Math.round(coverage * 100))}% of ${coverageOf ?? "this area"}.`}
      </p>
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
  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }} role="radiogroup" aria-label="Area level">
        {levels === null ? (
        <p style={{ color: "var(--muted-foreground)", fontSize: "11px" }}>Finding this place&rsquo;s country, province, city…</p>
      ) : levels.length === 0 ? (
        <p style={{ color: "var(--muted-foreground)", fontSize: "11px" }}>No administrative areas found here.</p>
      ) : (
        <>
          {levels.map((l) => {
            const on = l.key === levelKey;
            return (
              <button
                type="button"
                role="radio"
                aria-checked={on}
                key={l.key}
                onClick={() => onLevelChange(l.key)}
                title={`${l.label}: ${l.name}`}
                aria-label={`${l.label}: ${l.name}`}
                style={{
                  padding: "4px 10px",
                  borderRadius: "999px",
                  border: `1px solid ${on ? "var(--foreground)" : "var(--border)"}`,
                  background: on ? "var(--foreground)" : "color-mix(in oklab, var(--muted) 40%, transparent)",
                  color: on ? "var(--background)" : "var(--foreground)",
                  fontSize: "11px",
                  fontWeight: on ? 700 : 500,
                  lineHeight: 1.2,
                  boxShadow: on ? "0 1px 6px rgb(0 0 0 / 25%)" : undefined,
                  cursor: "pointer",
                }}
              >
                {l.name}
              </button>
            );
          })}
        </>
      )}
      </div>
      {missing && (
        <p style={{ marginTop: "6px", fontSize: "11px", color: "var(--muted-foreground)" }}>
          {missing} has no official border mapped in OpenStreetMap, so it can&rsquo;t be covered precisely. Choose a larger level, such as the city.
        </p>
      )}
    </div>
  );
}
function Big({ value, label }: { value: number | null; label: string }) {
  const c = value === null ? null : heatColor(value);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        margin: "4px 0",
        padding: "8px 10px",
        borderRadius: "10px",
        border: "1px solid var(--border)",
        background: c ? `color-mix(in oklab, ${c} 14%, var(--card))` : "var(--card)",
      }}
    >
      <span
        aria-hidden
        style={{
          width: "8px",
          alignSelf: "stretch",
          minHeight: "40px",
          borderRadius: "999px",
          background: c ?? "var(--muted)",
          boxShadow: c ? `0 0 0 3px color-mix(in oklab, ${c} 22%, transparent)` : undefined,
        }}
      />
      <div>
        <div style={{ fontSize: "28px", fontWeight: 800, lineHeight: 1, letterSpacing: "-0.02em" }}>{value === null ? "…" : `${Math.round(value)}°C`}</div>
        <div style={{ fontSize: "11px", color: "var(--muted-foreground)", marginTop: "2px" }}>{label}</div>
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
    <div style={{ fontSize: "12px" }} aria-live="polite">
      <section className="ember-panel-section" style={{ gap: "6px" }}>
        <div className="ember-detail-kicker">
          {view === "temperature" ? <Thermometer size={13} /> : <Droplets size={13} />}{" "}
          {view === "temperature" ? "TEMPERATURE" : "HEAT INDEX"} · {place.name}
        </div>
        <div style={{ color: "var(--muted-foreground)", fontSize: "11px" }}>{place.region}</div>
        <AreaLevelPicker levels={levels} levelKey={levelKey} onLevelChange={onLevelChange} missing={levelMissing} />
      </section>

      <section className="ember-panel-section" style={{ gap: "6px" }}>
      {error ? (
        <p style={{ marginTop: "10px" }}>Weather data is unavailable right now.</p>
      ) : view === "temperature" ? (
        <>
          <Big value={conditions?.tempC ?? null} label={`Feels ${heatIndexNow !== null ? `${Math.round(heatIndexNow)}°C` : "…"} · Humidity ${conditions?.humidity != null ? `${Math.round(conditions.humidity)}%` : "…"} · Wind ${conditions?.windKmh != null ? `${Math.round(conditions.windKmh)} km/h` : "…"}`} />
        </>
      ) : (
        <>
          <Big value={maxHi} label={`Now ${heatIndexNow !== null ? `${Math.round(heatIndexNow)}°C` : "…"} · ${heat === "None" ? "No warning" : heat}`} />
          <p style={{ fontSize: "11px", color: "var(--muted-foreground)" }}>
            Temp{" "}
            <b style={{ color: "var(--foreground)" }}>{conditions?.tempC != null ? `${Math.round(conditions.tempC)}°C` : "…"}</b> · Humidity{" "}
            <b style={{ color: "var(--foreground)" }}>{conditions?.humidity != null ? `${Math.round(conditions.humidity)}%` : "…"}</b>
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

      <p style={{ fontSize: "10px", color: "var(--muted-foreground)" }} title="Dashed line = official OpenStreetMap border">
        Tap map or search for another spot. Source: Open-Meteo.
      </p>
      </section>
    </div>
  );
}
