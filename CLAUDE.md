# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Beet-Planer — a web app (browser-based, possible future mobile client) for managing user-specific
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

`backend/src/data/plants.json` is the **seed catalog** — no longer served directly to the frontend (see
"Per-user plant catalog" below). It's read once via `fs.readFileSync` at startup (`src/plantCatalog.js`),
not via `import`, so `node --watch` does **not** pick up edits to it — restart `npm run dev:backend`
after changing it. Editing it only changes what *new* users get seeded with; it does not retroactively
change existing users' catalogs (they already have their own copy in the `plants` table, and edit it
themselves via the "Mein Pflanzenkatalog" UI). See `backend/src/data/PLANTS_SCHEMA.md` for the field
reference and known data gaps.

### Per-user plant catalog

Each user has their own editable copy of the plant catalog (`plants` table), seeded from
`plants.json` at registration time. See "Backend" below (`plantSeed.js`, `userPlants.js`,
`routes/plants.js`) and "Frontend" (`PlantManager.jsx`, `PlantForm.jsx`). `plantings.plant_id` is an
**integer** referencing a row in the *placing user's own* `plants` table — not a shared global ID.

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
  (`user_id`-owned), `plants` (`user_id`-owned — each user's own editable catalog, JSON-text columns for
  month arrays/methods, see `userPlants.js`), `plant_companions` (`plant_id`/`companion_plant_id` FKs
  into `plants`, `relation` `'good'|'bad'`, `reason` text), `plantings` (`bed_id`-owned, no own
  `user_id` — ownership always goes through the parent bed; `plant_id` is `INTEGER REFERENCES
  plants(id)`, **not** `ON DELETE CASCADE` — deleting a plant still in use is blocked at the DB level as
  a safety net behind the app-level check in `routes/plants.js`). `plantings` stores
  `plant_name_snapshot`/`plant_family_snapshot`/`plant_zehrertyp_snapshot` at write time so historical
  rotation data survives later catalog edits; *current*-season checks (spacing, companions, picker)
  always resolve live against the current catalog. On startup, `db.js` also runs a **one-time migration**
  (detected via `PRAGMA table_info(plantings)`: legacy schema had `plant_id TEXT`) that seeds every
  existing user's `plants` table from `plants.json` and remaps their existing `plantings.plant_id` from
  the old global catalog slug (e.g. `"tomate"`) to that user's new integer ID — safe to leave in place
  indefinitely, it no-ops once `plant_id` is already `INTEGER`.
- [src/plantCatalog.js](backend/src/plantCatalog.js) — loads/validates
  `src/data/plants.json` once at startup (see restart caveat above), exports `plantList`/`plantsById`
  — the **seed source**, used only by `plantSeed.js` now (no longer served via API directly).
- [src/plantSeed.js](backend/src/plantSeed.js) — `seedPlantsForUser(db, userId)` copies `plantList`
  into a user's `plants`/`plant_companions` rows (two passes: insert plants first, then companions,
  since a companion reference needs the new IDs of *all* seeded plants including later ones in the
  list). Also exports `FAMILIES`/`FAMILY_LABELS` (the 10 known botanical families — a fixed list, not
  free text, so family-based rotation matching stays consistent between seeded and user-created plants
  and doesn't drift from what's already stored in old `plant_family_snapshot` values).
- [src/userPlants.js](backend/src/userPlants.js) — `getPlantsForUser`/`getPlantForUser` (DB row →
  the same JSON shape `plants.json` used to have, so no frontend code needed to change),
  `createPlant`/`updatePlant`/`deletePlant`, `validatePlantInput` (converts a `{sowingDirectFrom,
  sowingDirectTo, …}` form body into month arrays via `monthRange` — wraps across the year boundary,
  e.g. `10→2` gives `[10,11,12,1,2]`; good/bad companions must reference plants owned by the same user).
  Editing a plant's harvest via the form always writes the month-range style
  (`harvest_start_month`/`harvest_end_month`) and clears the legacy days-based fields
  (`harvest_days_min`/`harvest_days_max`) even if the plant was seeded with the latter — touching a
  field through the UI "downgrades" that one plant to the simpler style the form exposes; untouched
  seeded plants keep their original precision.
- [src/routes/auth.js](backend/src/routes/auth.js) — `POST /api/auth/register`, `POST /api/auth/login`.
  Passwords hashed with bcryptjs; a JWT (`JWT_SECRET` env var, 7-day expiry) is issued on success.
  Register also calls `ensureUserPlantsSeeded` (from `db.js`) to give the new user their own catalog copy.
- [src/routes/plants.js](backend/src/routes/plants.js) — `GET/POST /api/plants`,
  `PUT/DELETE /api/plants/:id`, all scoped to `req.user.id`. `DELETE` returns `409` if any planting still
  references the plant (checked in `userPlants.js#deletePlant` before hitting the DB-level FK guard).
- [src/routes/beds.js](backend/src/routes/beds.js) — full bed CRUD, all scoped to `req.user.id`.
  Exports `getOwnedBed(bedId, userId)`, reused by `plantings.js`. `PUT /:id` has a resize guard: shrinking
  a bed that would strand an existing planting's *center point* (not its spacing radius — that may
  overhang) outside the new bounds is rejected with `409`. Mounts `plantings.js` at `/:id/plantings`.
- [src/routes/plantings.js](backend/src/routes/plantings.js) (`mergeParams` router) — nested
  bed-scoped planting CRUD. Plant lookups go through `getPlantsForUser(req.user.id)` (per-user catalog),
  not a global map. `POST`/`PUT` validate: plant exists, method is allowed for that plant
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
  `GET /api/plants` (the logged-in user's own catalog) on login, wraps the app (inside `AuthProvider`)
  in `main.jsx`, exposes `{ plants, plantsById, loading, error, reload }` via `usePlantCatalog()` —
  `reload` is called by `PlantManager` after create/update/delete so the rest of the app (picker,
  canvas, tooltips) sees catalog edits immediately without a full page reload.
- [src/api/client.js](frontend/src/api/client.js) — thin `fetch` wrapper; auto-attaches the bearer
  token from `localStorage` except on register/login calls; reads `VITE_API_URL` (defaults to
  `http://localhost:3001/api`). Covers auth + plants (incl. `createPlant`/`updatePlant`/`deletePlant`)
  + beds + plantings (per-bed and cross-bed).
- [src/App.jsx](frontend/src/App.jsx) — routes: `/login`, `/register`, `/` (→ `Beete.jsx`),
  `/beete/:bedId` (→ `BedPlanner.jsx`), `/kalender` (→ `Overview.jsx`), `/pflanzen` (→
  `PlantManager.jsx`), all but auth wrapped in `ProtectedRoute`.
- [src/pages/Beete.jsx](frontend/src/pages/Beete.jsx) — bed list/create/edit/delete
  (`BedCard`/`BedForm`).
- [src/pages/BedPlanner.jsx](frontend/src/pages/BedPlanner.jsx) — the core page: three tabs (Planer /
  Kalender / Historie nachtragen) around one bed. Owns the placement state machine (`armed` plant+method
  → click on `BedCanvas` → soft-warning `GuidanceBanner` if `shared/companions.js`+`shared/rotation.js`
  flag something → `api.createPlanting`/`updatePlanting`, which the server re-validates authoritatively).
- [src/pages/Overview.jsx](frontend/src/pages/Overview.jsx) — cross-bed calendar (`/kalender`), via
  `GET /api/plantings`, reuses `CalendarView` with `groupByBedName`.
- [src/pages/PlantManager.jsx](frontend/src/pages/PlantManager.jsx) — "Mein Pflanzenkatalog"
  (`/pflanzen`, linked from `Beete.jsx`'s nav): list/create/edit/delete over the user's own catalog,
  using [src/components/PlantForm.jsx](frontend/src/components/PlantForm.jsx) for the create/edit panel.
  Good/bad companions are picked explicitly from the user's own other plants (checkboxes, "bad" needs a
  reason) rather than auto-guessed — there's no reliable way to infer botanical compatibility for an
  arbitrary user-named plant, so this mirrors exactly how the curated seed data itself was authored.
  Family is a fixed 10-option dropdown (same list as `plantSeed.js#FAMILIES`), not free text, purely so
  the rotation engine's family-equality check keeps working consistently.
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

Two different things can be edited, don't confuse them:
- **The seed catalog** (`backend/src/data/plants.json`, schema + known data gaps in
  `backend/src/data/PLANTS_SCHEMA.md`) only affects *new* registrations from then on — restart the
  backend after editing it. It's the starting point, not a live-shared catalog.
- **A specific user's own catalog** — edit through the "Mein Pflanzenkatalog" UI (`/pflanzen`), or
  directly via `POST/PUT /api/plants`. This is what actually drives that user's picker/canvas/warnings.

Rule changes (spacing/companions/rotation/timing) belong in `shared/src/*.js` so backend enforcement and
frontend preview stay identical — add a `shared/test/*.test.js` case alongside any change there.
