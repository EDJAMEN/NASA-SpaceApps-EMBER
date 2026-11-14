// Live summary the Overview publishes into the shared React Query cache; the sidebar (on every page) reads it.
import type { Hotspot } from "./hotspots";

export const TELEMETRY_KEY = ["ember-sidebar-telemetry"] as const;

export interface SidebarTelemetry {
  latest: { name: string; distanceKm: number; date: string; time: string; source: string; conf: string; lat: number; lng: number } | null;
  window: { fused: number; raw: number; dual: number; viirs: number; modis: number; bufferKm: number | null };
  boundary: { place: string; windKmh: number | null; from: string | null; toward: string | null; inside: number; border: number; spread: string; region: string; sync: string };
}

/** Newest detection by acquisition date + time (FIRMS gives both in UTC). */
export function newest(fires: Hotspot[]): Hotspot | null {
  let best: Hotspot | null = null;
  for (const f of fires) if (!best || `${f.acqDate} ${f.acqTime}` > `${best.acqDate} ${best.acqTime}`) best = f;
  return best;
}
