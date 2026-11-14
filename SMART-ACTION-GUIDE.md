# Smart Action Guide — Map Layout

Renders below map in `app/index-client.tsx` via `<SmartActionGuide place onLocate>` (`components/smart-action-guide.tsx`). Rules in `lib/action-guide.ts` (`buildGuide`, `NEARBY_KM = 25`, `CLOSE_KM = 5`).

## Placement
Map → timeline → guide. Guide point = map click (`Selected point lat,lng`), place search, or `Use my location`. Same `place` drives FIRMS query (`firmsKey`) + Open-Meteo conditions.

## Header (always)
`SMART ACTION GUIDE` · place name + region. Controls: `Search any city or town`, `Use my location`.
Stat row: `Temperature`, `Humidity`, `Heat index + badge (○/▲/▲▲/◆/✖)`, `Air quality AQI`, `Hotspots ≤ 25 km`.

## States (FIRMS last 48 h)

### No fire near point (example: `8.081, 125.160`, 0 hotspots)
- Stats: `22°C · 92% · HI 23°C ○ No heat warning · AQI 30 · Hotspots 0`.
- `Environmental update`: `No satellite hotspots detected within 25 km in the last 48 hours.` + `A satellite hotspot is a heat anomaly, not automatically a confirmed wildfire.` + `Heat index 23°C.` + `AQI 30.`
- `What to do`: `No immediate action needed. Stay informed through official channels.`
- `What to bring`: water, first-aid, flashlight. `What to prepare`: phone/power bank, hotlines, standby supplies.

### Fire within 25 km
- Stat shows `Hotspots N`, update: `N hotspot clusters within 25 km; nearest X km away (high confidence).`
- Adds: `Check exact location vs official fire reports. Monitor DRRMO.`
- Wind ≥ 20 km/h adds spread warning. AQI > 100 adds smoke advice + N95.

### Fire within 5 km (close)
- Above plus RACE: move people out first, raise alarm, confine (close doors/windows), extinguisher only if trained with an exit, else evacuate.
- `What to bring` adds extinguisher (if trained) + N95 if smoke. `What to prepare` adds smoke alarm access, go-bag, route + meeting point, assist vulnerable, home drill.

### Feed down (`hotspots === null`)
- Update: `Satellite hotspot data unavailable.` Heat/AQI guidance still renders.

## Heat tiers (PAGASA, `heatLevel`)
`None <27 · Caution ≥27 · Extreme Caution ≥33 · Danger ≥42 · Extreme Danger ≥52`.
Caution+ adds hydration + hat/clothing. Extreme Caution+ adds limit 10AM–4PM + check vulnerable. Danger+ adds heat-stroke warning + ORS.

## Footer (always)
`General guidance only, based on WHO fire-safety principles and aligned with RA 9514 (BFP). Follow your local DRRMO and health authorities. Weather and air quality: Open-Meteo. Hotspots: NASA FIRMS (last 48 h).`

## Do not break
- Count = `haversineKm(place, hotspot) ≤ 25`, 48-h window only.
- Badge icon + text, never color alone.
- Null-safe: `…` loading, `—`/`n/a` unavailable. No new deps.
