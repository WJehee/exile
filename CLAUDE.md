# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Static Astro site that renders a personal travel log on a single interactive 3D globe (globe.gl + Three.js). One page (`src/pages/index.astro`), output is a static bundle.

## Commands

Use `just` (preferred) — all commands wrap `npm`:

- `just dev` — Astro dev server
- `just build` — static build to `dist/`
- `just preview` — serve the built bundle
- `just import-trip <image-dir> <trip-slug>` — scaffold a new trip from a folder of images (reads EXIF GPS + dates, clusters images within ~0.1 degrees into stops, copies images into `public/trips/<slug>/images/`, writes a `trip.yaml` skeleton)

Nix: `nix develop` enters a shell with `nodejs_20`, `exiftool`, `just`. `nix build` builds the static site as the default package. The flake pins `npmDepsHash` — bump it after any `package-lock.json` change (use `prefetch-npm-deps` or `lib.fakeHash` then read the error).

There is no test suite, lint, or typecheck script. `astro build` performs type checks via `astro/tsconfigs/strict`.

## Architecture

### Data flow

1. `src/lib/trips.ts` — server-side loader. At build time, `loadAllTrips()` reads every `trips/<slug>/trip.yaml`, parses with `js-yaml`, and returns a sorted array of `Trip` objects. Trips are sorted by `date_start` ascending.
2. `src/pages/index.astro` — renders the full UI (sidebar list, globe container, content panel for every trip) server-side. The trips array is also embedded as JSON in `data-trips` for the client script.
3. The client `<script>` boots one persistent `globe.gl` instance and toggles visibility of pre-rendered `.trip-content` blocks based on selection. There is no client-side routing framework — selection state lives in the URL hash (`#/trips/<slug>`) and is wired up via `popstate`.

### Trip content

A trip is a directory under `trips/`:

- `trips/<slug>/trip.yaml` — required. Schema in `src/lib/trips.ts` (`Trip`, `TripStop`).
- `public/trips/<slug>/images/<file>` — image files referenced by `stop.images[]` are served from `public/`, not from the trip directory. The `import-trip` script puts them there automatically; manual additions must follow this layout.

### Globe layer (index.astro client script)

Three layers stacked on the `globe.gl` instance:

- **Points** — one per unique `lat,lon` across all trips (deduplicated). Altitude scales with stop duration (`stopDays`). When a trip is selected, points belonging to that trip animate up to full size (`animatePoints`) while others shrink, using an `easeInOut` interpolation driven by `requestAnimationFrame`.
- **Polygons** — one convex hull per trip, expanded by a padding factor (`tripPolygonCoords`). Single-stop trips get a 32-segment circle. Coordinates are emitted clockwise so d3-geo renders the small enclosed area rather than the inverse.
- **Arcs** — populated only on trip selection, connecting consecutive stops in order.

### Fog of war

A custom `THREE.ShaderMaterial` sphere is added to `globe.scene()` at radius `r * 1.002`. A 4096x2048 mask canvas is built once at load:

1. Fill white (fogged everywhere).
2. Use `destination-out` with a heavy `shadowBlur` (640) to punch soft holes through the trip polygons and through whitelisted country borders fetched from `world-atlas` topojson.
3. Country whitelist lives in `FOGLESS_COUNTRY_IDS` (ISO 3166-1 numeric codes) near the top of the fog block in `index.astro`. Add an entry to clear fog over a country permanently.

The fragment shader perturbs the mask with animated 3D fbm noise to give the fog clouds visible movement. `mesh.rotation.y = -π/2` matches globe.gl's internal globe rotation so the mask aligns with lon=0.

## Conventions

- TS path aliases: `@lib/*` -> `src/lib/*`, `@components/*` -> `src/components/*`.
- All client code lives in the `<script>` block of `index.astro`; there is currently no separate component layer (`src/components/` is empty).
- The chunk size warning limit is bumped to 3000 KB in `astro.config.mjs` because globe.gl bundles Three.js (~2.4 MB unminified). Don't lower it without checking the bundle.

## Adding a trip manually (without `import-trip`)

1. Create `trips/<slug>/trip.yaml` matching the `Trip` schema in `src/lib/trips.ts`.
2. Drop image files into `public/trips/<slug>/images/` and reference them by filename in `stops[].images`.
3. Restart `just dev` — trips are loaded at build/dev-server start, not on every request.
