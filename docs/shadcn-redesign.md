# shadcn UI Redesign — Plan (no functionality change)

Goal: replace custom inline-style UI with standard shadcn + Tailwind layout. Zero behavior change: same props, state, queries, routes, map logic. Only markup/styling swaps.

## 1. Current inventory (custom → shadcn target)

| Area | Current | Replace with |
|---|---|---|
| App shell `components/ember-shell.tsx` (sidebar, topbar, live badge) | custom divs + `ember-*` CSS | `Sidebar` + `SidebarProvider`, `Sheet` (mobile), `Separator`, `Badge` for LIVE/sample, `Tooltip` on icon buttons, `Button` already used |
| Page heading (`ember-page-heading`, eyebrow, stats) | custom CSS classes | `Card` + `CardHeader/Title/Description`, `Badge` for deltas, keep numbers as-is |
| Stat grid (4 cards overview) | `ember-stat-grid` custom | `Card` grid `grid gap-4 md:grid-cols-4`, `CardContent` |
| Map section layout | `ember-map-layout`, canvas + aside | `Card`, `ResizablePanelGroup` (map resizable vs panel on desktop), `AspectRatio` fallback on mobile |
| Map toolbar / selectors (`ember-window-selector`, layer popover) | custom buttons | `ToggleGroup`, `Tabs` (fires/temperature/heatindex), `DropdownMenu` or `Popover` for Layers, `Command` already in `PlaceCombobox` |
| Incident panel, harmonize bar | custom cards | `Card`, `RadioGroup` for harmonized/raw, `Badge` for counts |
| Climate panel `components/climate-panel.tsx` (`AreaLevelPicker`, `RangePicker`, `Big`, `HeatScaleSlider`, `HeatScaleLegend`) | Radix Slider + inline styles | `Slider` (ui/slider), `RadioGroup` chips, `Card`, `Badge` for PAGASA level, `Skeleton` while loading; keep `heatColor/HEAT_SCALE` logic untouched |
| Smart action guide `components/smart-action-guide.tsx` | custom list | `Alert`, `Accordion` (per recommendation), `Badge` for severity |
| Historical navigator `components/historical-fire-navigator.tsx` | custom scrubber | `Slider`, `Select` (granularity), `Calendar` + `Popover` for date, `Button` play/pause |
| Tables/filters (detections, alerts, analytics, ingestion, calendar clients) | custom tables | `Table`, `Input`, `Select`, `Checkbox`, `Pagination`, `Tabs` |
| Feedback | none/custom text | `Sonner` (`Toaster`) for sync errors, `Skeleton` for loading, `Empty` pattern via `CardDescription` |
| Theme | custom `use-theme` + `.dark` | keep hook, use `dark` class already wired via `@custom-variant`; no token change |

## 2. Layout standard

- Shell: `SidebarProvider > Sidebar + SidebarInset > Header (sticky, breadcrumb + live Badge + theme toggle) + main (container, max-w-[1400px], p-4/6)`.
- Cards: `Card` with `CardHeader (Title + Description + action)` / `CardContent`. No inline `style=` for spacing/colors — Tailwind classes + CSS vars only.
- Radius/spacing: keep existing tokens (`--radius`, `--radius-card/control/chip/pill`) mapped to shadcn `sm/md/lg`; delete one-off values.
- Typography: keep DM Sans / IBM Plex Mono; use `text-xs/sm/lg`, `font-mono` for numbers.
- Dark mode: verify every new component in both themes; borders via `border-border`, text via `muted-foreground`.

## 3. Rules (functionality frozen)

1. No changes to `lib/*`, `app/api/*`, queries, map math, thresholds.
2. Same DOM order + same `aria-*` labels; only element type/class changes.
3. Keep all copy strings identical (later pass can rewrite copy).
4. One component per PR/commit; run `npx tsc --noEmit` + visual check light/dark + mobile before next.

## 4. Phases (small diffs)

1. Shell + pages skeleton (Sidebar, Header, Card grid) — biggest visual win, low risk.
2. Overview map toolbar + incident panel (Tabs, ToggleGroup, Popover).
3. Climate panel (Slider, RadioGroup chips, Badge, Skeleton).
4. Smart action guide + historical navigator (Alert, Accordion, Calendar).
5. Tables/filters pages (Table, Pagination, Select).
6. Cleanup: remove dead `ember-*` CSS, dead inline styles, add `Toaster`, empty states.

## 5. Acceptance per phase

- `npx tsc --noEmit` passes.
- Same data shown in same order; all buttons/filters still work.
- Light + dark screenshot, 390px + 1440px widths.
- No new deps (all targets already in `components/ui`); no `lib/` or API diff.
