# EMBER Layout Redesign Brief — No Functionality Change

## Goal
Redesign layout + organize UI only. Zero logic change.

## Scope
- `components/ember-shell.tsx` (sidebar, topbar, content wrapper)
- `app/*/page.tsx` + `*-client.tsx` layout structure
- `app/globals.css` + Tailwind classes
- `components/ui/` reuse only

## Rules
- No new props, state, hooks, fetch, routes.
- No change to `app/api/firms`, `lib/supabase.ts`, `context/`, `hooks/`.
- Keep all `aria-*`, `id`, `href`, event handlers, `EmberLiveStatus` strings exact.
- Move JSX / classes only. Extract presentational component only if no props logic change.
- Server secrets stay server-only. `page.tsx` stays server metadata wrapper.
- Keep `SIDEBAR_STORAGE_KEY`, collapse/menu/theme behavior identical.

## Allowed
- Reorder nav, spacing, typography, grid, responsive breakpoints.
- Consolidate duplicated Tailwind into existing `ember-*` classes in `globals.css`.
- Improve mobile: sidebar drawer, topbar wrap, content stacking.

## Not allowed
- New deps, new env vars, schema/migration edits.
- Rename routes (`/`, `/detections`, `/alerts`, `/analytics`, `/calendar`, `/ingestion`).
- Change LIVE/sample toggle behavior, FIRMS query params, Supabase queries.

## Check
```sh
npm run build
npm run lint
```
Manual: load `/`, toggle sidebar collapse, mobile menu, dark mode, LIVE toggle. Same data, same clicks, new look only.
