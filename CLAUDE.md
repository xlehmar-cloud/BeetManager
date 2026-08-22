# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Beet-Manager — a web app (browser-based, possible future mobile client) for managing user-specific
"Beete" (garden beds). Auth (register/login) plus the full v1 planting planner are implemented: users
create beds, place plants on a to-scale bed canvas with hard spacing enforcement, get soft
companion-planting/crop-rotation guidance, and see a per-bed and cross-bed calendar. See
`docs/PLAN.md` for the original design spec this was built from (kept for historical context; the
sections below are the current source of truth for what exists).

## Commands

This is an npm-workspaces monorepo with three packages: `shared/`, `backend/`, and `frontend/`. Run
everything from the repo root.

```bash
npm install                  # installs root + shared + backend + frontend (npm workspaces)
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

npm run dev                  # starts backend (:3001) + frontend (:5173) together via `concurrently`
npm run dev:backend          # backend only — node --watch src/server.js
npm run dev:frontend         # frontend only — vite dev server
npm run build                # production build of the frontend (vite build)

cd shared && npm test        # runs shared/'s rule-engine tests (node --test) — the only tests in the repo
```

There is **no linter configured**, and the only test suite is `shared/` (see above) — the rest of
the app (backend routes, frontend components) has no automated tests, don't go looking for them.

### better-sqlite3 install caveat

`backend` depends on `better-sqlite3`, a native module. If no prebuilt binary matches the local
Node/platform, `npm install` falls back to compiling SQLite from source via `node-gyp`, which can
take several minutes (compiling the amalgamated `sqlite3.c` is the slow part) — this is expected,
not a hang. Requires `make`/`gcc`/`g++`/`python3` on the system.

### `plants.json` changes require a backend restart

`backend/src/data/plants.json` (the plant catalog) is read once via `fs.readFileSync` at startup
(`src/plantCatalog.js`), not via `import`, so `node --watch` does **not** pick up edits to it — restart
`npm run dev:backend` after changing it. See `backend/src/data/PLANTS_SCHEMA.md` for the field
reference and known data gaps.

## Architecture

### `shared/` — pure rule-engine workspace (ESM, no dependencies, no React/Express imports)

The time/spacing/companion/rotation logic lives here so it runs **identically** on the backend (hard
enforcement) and frontend (live preview while placing a plant) — the two must never drift.

- [src/timing.js](shared/src/timing.js) — `absoluteMonth`/`fromAbsoluteMonth` (month+year → comparable
  int), `isSowablePlantable`, `matchesStandort`, `computeOccupancy` (sow → harvest window → bed-free
  month, using the "sowing = middle of the month" convention), `computeGerminationWindow` +
  `getIsoWeek` (the only week-granular calculation in the system — germination display only).
- [src/spacing.js](shared/src/spacing.js) — `radiusFor` (= `spacingMinCm / 2`), `isCenterWithinBed`
  (the one hard edge rule: only the center point must stay inside the bed — the spacing radius may
  overhang the edge; the UI clips it visually via SVG `clipPath` instead of blocking placement),
  `isWithinBedBounds` (informational only — full-radius-in-bounds check, drives the red preview color
  on overhang but no longer blocks anything), `checkPlacement` (circle-overlap conflict check against
  concurrent plantings — the other hard rule). Everything below is advisory/frontend-only.
- [src/companions.js](shared/src/companions.js) — `filterNearby` (threshold = `1.5 × (radiusA +
  radiusB)`), `getCompanionWarnings` (bidirectional `companions.bad` lookup, incl. self-reference for
  self-incompatible plants like Radieschen).
- [src/rotation.js](shared/src/rotation.js) — `getRotationWarnings`: same-family-within-
  `rotationGapYears` and Starkzehrer-directly-after-Starkzehrer, evaluated against a bed's
  `plant_*_snapshot` history (including `method='historisch'` entries).
- [src/picker.js](shared/src/picker.js) — `filterPlantable(plants, {month, standort})`, feeds
  `PlantPicker`.
- `test/*.test.js` — `node --test`, run via `cd shared && npm test`.

### Backend (`backend/`) — Node/Express REST API, ESM (`"type": "module"`)

- [src/server.js](backend/src/server.js) — app entry point: Express setup, CORS, mounts routes, plus
  the cross-bed `GET /api/plantings` overview route inline (joins `beds` for `bed_name`).
- [src/db.js](backend/src/db.js) — opens the SQLite file at `backend/data/beet-manager.db` (created on
  first run, gitignored), sets `foreign_keys = ON`, and defines the schema: `users`, `beds`
  (`user_id`-owned), `plantings` (`bed_id`-owned, no own `user_id` — ownership always goes through the
  parent bed). `plantings` stores `plant_name_snapshot`/`plant_family_snapshot`/`plant_zehrertyp_snapshot`
  at write time so historical rotation data survives later catalog edits; *current*-season checks
  (spacing, companions, picker) always resolve live against the current catalog.
- [src/plantCatalog.js](backend/src/plantCatalog.js) — loads/validates
  `src/data/plants.json` once at startup (see restart caveat above), exports `plantList`/`plantsById`.
- [src/routes/auth.js](backend/src/routes/auth.js) — `POST /api/auth/register`, `POST /api/auth/login`.
  Passwords hashed with bcryptjs; a JWT (`JWT_SECRET` env var, 7-day expiry) is issued on success.
- [src/routes/plants.js](backend/src/routes/plants.js) — `GET /api/plants` → full catalog.
- [src/routes/beds.js](backend/src/routes/beds.js) — full bed CRUD, all scoped to `req.user.id`.
  Exports `getOwnedBed(bedId, userId)`, reused by `plantings.js`. `PUT /:id` has a resize guard: shrinking
  a bed that would strand an existing planting's *center point* (not its spacing radius — that may
  overhang) outside the new bounds is rejected with `409`. Mounts `plantings.js` at `/:id/plantings`.
- [src/routes/plantings.js](backend/src/routes/plantings.js) (`mergeParams` router) — nested
  bed-scoped planting CRUD. `POST`/`PUT` validate: plant exists, method is allowed for that plant
  (`historisch` is always implicitly allowed regardless of the catalog's `methods`), month/year are
  sane, and — for non-`historisch` methods — the center point stays inside the bed (the spacing radius
  may overhang the edge; only the frontend clips it visually) **and** doesn't conflict (via
  `shared/spacing.js`) with other plantings whose occupancy window (via
  `shared/timing.js#computeOccupancy`) overlaps in time. Conflicts return `409` with a `conflicts` array.
- [src/middleware/auth.js](backend/src/middleware/auth.js) — `authenticate` middleware: reads
  `Authorization: Bearer <token>`, verifies the JWT, loads the user from SQLite, attaches as
  `req.user`. Used on every route above.
- `db` uses better-sqlite3's synchronous API — no `await` needed for queries.

### Frontend (`frontend/`) — React + Vite + React Router, ESM

- [src/context/AuthContext.jsx](frontend/src/context/AuthContext.jsx) — holds the logged-in user and
  `login`/`register`/`logout`. On mount, if a token is in `localStorage`
  (`beet-manager-token`), it calls `GET /api/me` to restore the session. Wraps the whole app in
  [src/main.jsx](frontend/src/main.jsx).
- [src/context/PlantCatalogContext.jsx](frontend/src/context/PlantCatalogContext.jsx) — loads
  `GET /api/plants` once per login, wraps the app (inside `AuthProvider`) in `main.jsx`, exposes
  `{ plants, plantsById, loading, error }` via `usePlantCatalog()`.
- [src/api/client.js](frontend/src/api/client.js) — thin `fetch` wrapper; auto-attaches the bearer
  token from `localStorage` except on register/login calls; reads `VITE_API_URL` (defaults to
  `http://localhost:3001/api`). Covers auth + plants + beds + plantings (per-bed and cross-bed).
- [src/App.jsx](frontend/src/App.jsx) — routes: `/login`, `/register`, `/` (→ `Beete.jsx`),
  `/beete/:bedId` (→ `BedPlanner.jsx`), `/kalender` (→ `Overview.jsx`), all but auth wrapped in
  `ProtectedRoute`.
- [src/pages/Beete.jsx](frontend/src/pages/Beete.jsx) — bed list/create/edit/delete
  (`BedCard`/`BedForm`).
- [src/pages/BedPlanner.jsx](frontend/src/pages/BedPlanner.jsx) — the core page: three tabs (Planer /
  Kalender / Historie nachtragen) around one bed. Owns the placement state machine (`armed` plant+method
  → click on `BedCanvas` → soft-warning `GuidanceBanner` if `shared/companions.js`+`shared/rotation.js`
  flag something → `api.createPlanting`/`updatePlanting`, which the server re-validates authoritatively).
- [src/pages/Overview.jsx](frontend/src/pages/Overview.jsx) — cross-bed calendar (`/kalender`), via
  `GET /api/plantings`, reuses `CalendarView` with `groupByBedName`.
- [src/components/](frontend/src/components/) — `BedCard`, `BedForm`, `BedCanvas` (inline
  `<svg viewBox="0 0 {width_cm} {length_cm}">`, 1 SVG unit = 1cm; click-based placement, no drag&drop;
  the click handler recomputes the candidate from the click event itself rather than trusting the prior
  `mousemove`-set ghost state, since a fast click can outrun that state update; markers/ghost render
  inside a `<g clipPath>` scoped to the bed rect, so a spacing radius that overhangs the edge — allowed,
  only the center point must stay inside the bed — is simply clipped rather than blocked; the ghost
  still colors red on overhang, that's cosmetic only, the click still commits; while a plant is armed,
  existing markers don't intercept clicks — `onSelect` is disabled so the click bubbles to the canvas
  and is always evaluated as a placement attempt instead, even over another marker, where it correctly
  reads as a spacing conflict and no-ops; without this, a blocked click near an existing plant used to
  silently select that marker and clear `armed`, making every further click a no-op until the user
  noticed and re-armed — the exact "nothing happens anymore" bug), `PlantMarker`,
  `PlantPicker`, `MonthSelector` (also exports `MONTH_NAMES`/`MONTH_SHORT`), `PlantTooltip`,
  `GuidanceBanner`, `BedInfoPanel`, `CalendarView` (month-grid Gantt, reused for one bed and the
  overview; germination segment is the only week-resolution element, positioned by day-of-year
  percentage), `HistoryForm`.
- [src/icons/PlantIcons.jsx](frontend/src/icons/PlantIcons.jsx) — hand-drawn SVG icons keyed by
  `plant.icon` category (`fruit`/`root`/`leaf`/`legume`/`herb`/`berry`/`tuber`/`stalk`); unknown
  categories fall back to a generic leaf so catalog additions never break rendering.
- [src/styles/planner.css](frontend/src/styles/planner.css) — imported alongside `index.css` in
  `main.jsx`; defines `--color-soil`, `--color-radius-ring`, `--color-warning`, `--radius-organic`.

### Auth flow (end to end)

Register/Login → backend issues JWT → frontend stores it in `localStorage` → every subsequent API
call sends it as a Bearer token → backend's `authenticate` middleware resolves it back to a user row.
There is no server-side session store; the token itself is the credential (stateless JWT).

### Extending the plant catalog / rule engine

Add/edit entries in `backend/src/data/plants.json` (schema + known data gaps documented in
`backend/src/data/PLANTS_SCHEMA.md`), restart the backend. Rule changes (spacing/companions/rotation/
timing) belong in `shared/src/*.js` so backend enforcement and frontend preview stay identical — add a
`shared/test/*.test.js` case alongside any change there.
