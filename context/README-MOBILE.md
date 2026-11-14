# Mobile view setup

Breakpoints (all in `app/globals.css`): `390px` (small phones) · `680px` (phones) · `860px` (collapsed icon rail, legacy) · `1120px` (narrow desktop) · `1600px` (wide). Phone rules live in the grouped `@media (max-width: 680px)` blocks near the end of the file — add new phone rules there, not scattered through the file.

## Top nav (`components/ember-shell.tsx`, shadcn header)

Sticky `h-14` header: `SidebarTrigger` (opens the sidebar sheet on mobile) · `Breadcrumb` (Workspace / page) · live `Badge` pill · icon buttons with tooltips. No custom topbar CSS remains — the old `.ember-topbar*` rules were deleted as dead.

## Sidebar (shadcn `Sidebar`, `collapsible="icon"`)

Desktop: icon rail, tooltips per item (`components/ember-shell.tsx` NAV array). Mobile: off-canvas Sheet (see `components/ui/sidebar.tsx`, driven by `useIsMobile`). No custom sidebar CSS remains — the old `.ember-sidebar*`/`.ember-nav*`/`.ember-profile*` rules were deleted as dead after the shadcn migration.

## Map navigation buttons (`app/index-client.tsx` + `components/ember-map.tsx`, CSS `ember-map-*`)

- Search (`PlaceCombobox`, `#ember-map-search-input`): full-width top bar on phones, `kbd` hint hidden.
- Zoom in/out + re-center (`.ember-map-tools`) and the legend (`.ember-map-legend`) share one bottom-left column (`.ember-map-bottom-left`): the zoom stack sits directly above the legend. Fullscreen (`.ember-fullscreen`) is bottom-right. All four map controls use equal 30px square buttons on phones.
- Fire alert badge and bottom-left column are siblings of the isolated map canvas, not children. This lets their z-index clear the floating side panel without raising the map above it.
- Right side: fullscreen and the layers popover follow `--map-rail` on `.ember-map-canvas`. Closed panel = inset 10px (phones) / 14px (desktop); open panel = pushed left of the panel, so it is never hidden under it.
- Compass hidden on phones.
- Layers popover (`.ember-layer-popover`): top-right, under the search bar.
- Desktop (≥1101px): same variable, 14px closed / 348px open. Search and popover follow it.
- Incident/climate panel: stacks below the edge-to-edge map (`.ember-map-layout` bleeds `0 -15px`), panel header sticky.

## Rules

- One place for phone CSS: the `680px`/`390px` groups at the end of `globals.css`.
- Touch targets ≥ 34px on phones; never hide search, zoom, or layers behind hover.
- shadcn first (`Sidebar*`, `Input`, `Button`): new chrome goes through `components/ui/*`, not new `ember-*` classes.
