"use client";

import { useState } from "react";
import { Calendar, History, Info, Pause, Play, Radio, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatShortDate } from "@/lib/historical-fires";
import type { Granularity, QuickRange, SpanDays, TimelineStep } from "@/lib/timeline";

const QUICK_PILLS: readonly { key: QuickRange; label: string; title: string }[] = [
  { key: "today", label: "Today", title: "Current UTC operational day" },
  { key: "24h", label: "~24hrs", title: "Rolling 24-hour ultra-real-time / NRT detections" },
  { key: "3d", label: "3 days", title: "Past 3 days of MODIS + VIIRS detections" },
  { key: "7d", label: "7 days", title: "Past 7 days of MODIS + VIIRS detections" },
];

const SPAN_OPTIONS: readonly { days: SpanDays; label: string }[] = [
  { days: 1, label: "Day" },
  { days: 3, label: "3 days" },
  { days: 7, label: "Week" },
  { days: 30, label: "Month" },
];

const SPAN_TAG: Record<SpanDays, string> = {
  1: "DAY",
  3: "3 DAYS",
  7: "WEEK",
  30: "MONTH",
};

interface HistoricalFireNavigatorProps {
  todayStr: string;
  quickRange: QuickRange | null;
  granularity: Granularity;
  historicalDate: string | null;
  spanDays: SpanDays;
  steps: TimelineStep[];
  scrubIndex: number;
  startLabel: string;
  endLabel: string;
  isHistorical: boolean;
  isModisEraOnly: boolean;
  playing: boolean;
  spreadOn: boolean;
  loadingArchive?: boolean;
  onSelectQuickRange: (range: QuickRange) => void;
  onChangeGranularity: (granularity: Granularity) => void;
  onSelectHistoricalDate: (date: string) => void;
  onChangeSpanDays: (days: SpanDays) => void;
  onBackToLive: () => void;
  onScrubChange: (index: number) => void;
  onTogglePlay: () => void;
}

export function HistoricalFireNavigator({
  todayStr,
  quickRange,
  granularity,
  historicalDate,
  spanDays,
  steps,
  scrubIndex,
  startLabel,
  endLabel,
  isHistorical,
  isModisEraOnly,
  playing,
  spreadOn,
  loadingArchive = false,
  onSelectQuickRange,
  onChangeGranularity,
  onSelectHistoricalDate,
  onChangeSpanDays,
  onBackToLive,
  onScrubChange,
  onTogglePlay,
}: HistoricalFireNavigatorProps) {
  const [infoOpen, setInfoOpen] = useState(false);

  const safeMax = Math.max(0, steps.length - 1);
  const clampedIdx = Math.max(0, Math.min(safeMax, scrubIndex));
  const activeStep = steps[clampedIdx] ?? steps[0];
  const progressPct = safeMax > 0 ? Math.round((clampedIdx / safeMax) * 100) : 100;

  // Sample up to 7 evenly distributed tick marks so daily or 56-step sub-daily scales stay crisp.
  const tickIndices: number[] = [];
  if (steps.length > 1) {
    const maxTicks = 7;
    const stride = Math.max(1, Math.ceil((steps.length - 1) / (maxTicks - 1)));
    for (let i = 0; i < steps.length; i += stride) tickIndices.push(i);
    if (tickIndices[tickIndices.length - 1] !== safeMax) tickIndices.push(safeMax);
  }

  return (
    <Card role="region" aria-label="Historical Fire Map Navigator" className="overflow-hidden">
      <CardContent className="space-y-3 p-3">
        {/* Top control strip */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <Badge variant={isHistorical ? "default" : "secondary"} className="gap-1.5">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" />
              <span className="relative inline-flex size-1.5 rounded-full bg-current" />
            </span>
            {isHistorical ? "Archive window" : "Fire timeline"}
          </Badge>
          <ToggleGroup
            type="single"
            value={!isHistorical && quickRange ? quickRange : ""}
            onValueChange={(v) => {
              if (v === "today" || v === "24h" || v === "3d" || v === "7d") onSelectQuickRange(v);
            }}
            aria-label="Quick horizon presets"
            className="rounded-lg border p-0.5"
          >
            {QUICK_PILLS.map((pill) => (
              <ToggleGroupItem key={pill.key} value={pill.key} title={pill.title} aria-label={pill.label} className="h-7 px-2 text-[11px]">
                {pill.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <Popover open={infoOpen} onOpenChange={setInfoOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="size-7" aria-label="Satellite overpass and archive coverage info" title="Satellite overpass latency & MODIS/VIIRS historical archive coverage">
                <Info size={13} />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="max-w-xs text-xs" role="tooltip">
              <p className="font-semibold">FIRMS Overpass &amp; Archive Coverage</p>
              <p className="mt-1 text-muted-foreground">
                NRT passes appear within ~3 hours of acquisition. <b className="text-foreground">MODIS (Terra/Aqua, 1 km)</b> spans Nov 2000–present; <b className="text-foreground">VIIRS (S-NPP, NOAA-20/21, 375 m)</b> begins Jan 2012.
              </p>
            </PopoverContent>
          </Popover>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <ToggleGroup
              type="single"
              value={granularity}
              onValueChange={(v) => {
                if (v === "daily" || v === "subdaily") onChangeGranularity(v);
              }}
              aria-label="Timeline granularity"
              className="rounded-lg border p-0.5"
            >
              <ToggleGroupItem value="daily" title="Step in 24-hour daily increments" aria-label="Daily" className="h-7 px-2 text-[11px]">
                Daily
              </ToggleGroupItem>
              <ToggleGroupItem value="subdaily" title="Step in 3-hour satellite overpass increments (syncs with wind spread cone)" aria-label="Sub-daily" className="h-7 px-2 text-[11px]">
                Sub-daily
              </ToggleGroupItem>
            </ToggleGroup>
            <div className="relative" title="Pick historical date (2000-11-01 to present)">
              <Calendar size={13} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="date"
                min="2000-11-01"
                max={todayStr}
                value={historicalDate ?? todayStr}
                aria-label="Historical fire map date"
                onChange={(e) => {
                  if (e.target.value) onSelectHistoricalDate(e.target.value);
                }}
                className="h-7 w-[132px] pl-7 font-mono text-[11px]"
              />
            </div>
            <Select value={String(spanDays)} onValueChange={(v) => onChangeSpanDays(Number(v) as SpanDays)}>
              <SelectTrigger aria-label="Time window span" title="Time window span" className="h-7 w-[104px] text-[11px]">
                <History size={12} className="text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SPAN_OPTIONS.map((opt) => (
                  <SelectItem key={opt.days} value={String(opt.days)}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Status & era context strip */}
        {(isHistorical || isModisEraOnly) && (
          <div className="space-y-1.5">
            {isHistorical && historicalDate && (
              <Alert className="flex items-center gap-2 border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5">
                <span className="relative flex size-1.5 shrink-0">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-500 opacity-60" />
                  <span className="relative inline-flex size-1.5 rounded-full bg-amber-500" />
                </span>
                <AlertDescription className="flex flex-1 flex-wrap items-center gap-x-1.5 font-mono text-[10px] uppercase tracking-wide">
                  Historical archive · {formatShortDate(historicalDate)} ({SPAN_TAG[spanDays]})
                  {loadingArchive ? " · Syncing…" : ""}
                </AlertDescription>
                <Button variant="ghost" size="sm" className="h-6 shrink-0 gap-1 px-2 text-[11px]" onClick={onBackToLive}>
                  <RotateCcw size={11} /> Back to live
                </Button>
              </Alert>
            )}
            {isModisEraOnly && (
              <Alert className="px-2.5 py-1.5" title="VIIRS launched in 2012 (Suomi NPP); earlier dates use harmonized 1km MODIS">
                <AlertDescription className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Radio size={11} /> MODIS era only (1 km) · harmonized to VIIRS-equivalent scale
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* Scrubber strip */}
        <div className="space-y-1 rounded-lg border bg-muted/40 p-2.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="text-xs font-semibold tabular-nums">
              {activeStep?.displayLabel ?? "Today"}
            </span>
            {granularity === "subdaily" && activeStep && (
              <Badge variant="outline" className="font-mono text-[10px]">
                {spreadOn ? `+${activeStep.spreadHours.toFixed(1)}h cone · ` : ""}
                {activeStep.overpassHint}
              </Badge>
            )}
            <span className="ml-auto font-mono text-[10px] text-muted-foreground tabular-nums">{progressPct}%</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-12 shrink-0 font-mono text-[10px] text-muted-foreground">{startLabel}</span>
            <div className="relative flex-1">
              <Slider
                min={0}
                max={safeMax}
                step={1}
                value={[clampedIdx]}
                onValueChange={([v]) => onScrubChange(v!)}
                aria-label="Historical timeline scrubber"
              />
              {tickIndices.length > 0 && (
                <div className="relative mt-1 h-3" aria-hidden>
                  {tickIndices.map((idx) => {
                    const pct = safeMax > 0 ? (idx / safeMax) * 100 : 0;
                    const step = steps[idx];
                    if (!step) return null;
                    return (
                      <span
                        key={idx}
                        className={`absolute -translate-x-1/2 text-center font-mono text-[9px] ${idx === clampedIdx ? "font-bold text-foreground" : "text-muted-foreground"}`}
                        style={{ left: `${pct}%` }}
                      >
                        {step.shortLabel}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
            <span className="w-12 shrink-0 text-right font-mono text-[10px] text-muted-foreground">{endLabel}</span>
            <Button
              variant={playing ? "default" : "outline"}
              size="icon"
              className="size-8 shrink-0"
              aria-label={playing ? "Pause timeline" : "Play timeline"}
              onClick={onTogglePlay}
            >
              {playing ? <Pause size={14} /> : <Play size={14} />}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
