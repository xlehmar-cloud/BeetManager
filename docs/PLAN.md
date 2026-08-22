# Beet-Manager: Interaktiver Hochbeet-Pflanzplaner

## Context

Beet-Manager ist bisher nur ein Auth-Grundgerüst (React/Vite + Express/SQLite, siehe `CLAUDE.md`) ohne fachliche Funktionen. Der Anwender möchte damit seine Hochbeete planen: Er legt Beete an (Bezeichnung, Breite, Länge, Standort) und plant darin interaktiv, was er wann pflanzt. Das eigentliche Problem, das die App lösen soll: Gemüseplanung ist fachlich fehleranfällig — Pflanzen brauchen Mindestabstand (sonst verdrängen sie sich), manche Sorten vertragen sich nebeneinander nicht (Mischkultur), und man darf nicht beliebig dasselbe wieder ins gleiche Beet pflanzen (Fruchtfolge/Zehrertyp). Der Anwender will hierbei aktiv geführt werden (Tooltips, Hinweise, Kalendervorschau), nicht nur ein leeres Formular ausfüllen.

Dieser Plan deckt die erste vollständige Ausbaustufe ab: Beete anlegen, den visuellen Pflanzplaner (Saatgut/Setzlinge, Abstandsradius, Mischkultur, Kompatibilitäts-Hinweise, Fruchtfolge-Hinweise) und die Kalender-/Zeitvorschau (Aussaat → Keimung → Ernte → Beet wieder frei).

**Nachtrag (Keimung):** Bei Saatgut (Direktsaat) soll der Kalender zusätzlich die Keimphase **wochengenau** zeigen (z.B. "Keimung ca. KW 11–13"), nicht nur monatsgenau wie der Rest der Planung. Das steht nicht im Widerspruch zur "nur Monat, kein exaktes Datum"-Vereinfachung bei der Eingabe: Der Anwender gibt weiterhin nur den Aussaatmonat an, die Wochenangabe wird daraus **berechnet** (angenommenes Aussaatdatum = Monatsmitte + Keimdauer aus der Pflanzendatenbank), siehe Datenmodell und Regel-Engine unten.

## Entschiedene Produktfragen

- **Rückwirkende Erfassung:** Es gibt einen zusätzlichen, einfachen "Historie nachtragen"-Modus (Pflanze + Jahr + Monat, ohne exakte Position) — damit die Fruchtfolge-Warnung schon im ersten Nutzungsjahr greift, nicht erst nach 3-4 Jahren App-Nutzung.
- **Abstandsstrenge:** Der recherchierte **Mindestabstand** (`spacingMinCm`) ist die harte Blockiergrenze — es passt so viel wie fachlich gerade noch vertretbar ins Beet.
- **Rand-Verhalten:** Der komplette Sicherheitsradius (nicht nur der Mittelpunkt) muss innerhalb der Beetfläche bleiben — keine Platzierung, deren Radius über den Rand hinausragt.

Alle übrigen technischen Detailentscheidungen (s. u. "Implementierungsentscheidungen") sind vom Entwurfsagenten sinnvoll vorgegeben und hier final festgelegt, ohne dass der Anwender das noch einzeln entscheiden muss.

## Architektur — wo lebt die Regel-Logik?

Ein neuer, dritter npm-Workspace **`shared/`** (kein externes Package, nur ESM-Pure-Functions ohne Dependencies) enthält die Zeit-/Abstandsberechnung, die **identisch** auf Backend (Durchsetzung, hart) und Frontend (Live-Vorschau) laufen muss — Abweichung zwischen Client-Vorschau und Server-Validierung würde sich als kaputte UX anfühlen. Mischkultur- und Fruchtfolge-Warnungen sind rein beratend und laufen nur im Frontend. Die Pflanzendatenbank bleibt eine reine Backend-JSON-Datei, über `GET /api/plants` ausgeliefert — Bearbeiten der Datei erfordert keinen Frontend-Build.

## Datenmodell

### SQLite (`backend/src/db.js`)

Vor den neuen Tabellen ergänzen (fehlt aktuell, wird für `ON DELETE CASCADE` gebraucht):
```js
db.pragma('foreign_keys = ON');
```

```sql
CREATE TABLE IF NOT EXISTS beds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  width_cm INTEGER NOT NULL,
  length_cm INTEGER NOT NULL,
  standort TEXT NOT NULL CHECK (standort IN ('sonne','halbschatten','schatten')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_beds_user ON beds(user_id);

CREATE TABLE IF NOT EXISTS plantings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bed_id INTEGER NOT NULL REFERENCES beds(id) ON DELETE CASCADE,
  plant_id TEXT NOT NULL,                     -- slug aus plants.json, z.B. "tomate"
  plant_name_snapshot TEXT NOT NULL,          -- s. Begründung unten
  plant_family_snapshot TEXT NOT NULL,
  plant_zehrertyp_snapshot TEXT NOT NULL,
  method TEXT NOT NULL CHECK (method IN ('saatgut','setzling','historisch')),
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  x_cm REAL,                                  -- NULL bei method='historisch' (keine exakte Position)
  y_cm REAL,                                  -- NULL bei method='historisch'
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_plantings_bed ON plantings(bed_id);
CREATE INDEX IF NOT EXISTS idx_plantings_bed_year ON plantings(bed_id, year);
```

**Warum die `plant_*_snapshot`-Spalten:** Fruchtfolge ist eine mehrjährige Historie, aber der Pflanzenkatalog ist eine vom Anwender editierbare JSON-Datei. Wird ein Katalogeintrag später umbenannt/entfernt, würde reines Nachschlagen über `plant_id` Jahre alte Historie stillschweigend korrumpieren. Für die *aktuelle* Saison (Abstandsprüfung, Mischkultur, Auswahlliste) wird immer live gegen den aktuellen Katalog aufgelöst — das ist korrekt (Katalog-Korrekturen sollen sofort für neue Platzierungen gelten).

**Ownership:** `plantings` hat keine eigene `user_id` — jede Query verifiziert über `beds.user_id = req.user.id` (kleiner `getOwnedBed(bedId, userId)`-Helper in `routes/beds.js`, analog zu den Inline-`db.prepare(...)`-Aufrufen in `routes/auth.js`).

### Pflanzenkatalog (`backend/src/data/plants.json`)

Bewusst **nicht** unter `backend/data/` (das ist die gitignorete SQLite-Datei) — `backend/src/data/` ist versioniert und von Hand editierbar, wie vom Anwender gewünscht. Dazu `backend/src/data/PLANTS_SCHEMA.md` als Doku für spätere manuelle Ergänzungen (JSON kennt keine Kommentare).

Schema pro Pflanze:
```json
{
  "id": "tomate",
  "name": "Tomate",
  "family": "nachtschattengewaechse",
  "familyLabel": "Nachtschattengewächse",
  "zehrertyp": "stark",
  "standort": ["sonne"],
  "methods": ["setzling"],
  "sowing": { "direct": [], "transplant": [5], "note": "Mitte Mai (nach den Eisheiligen)" },
  "germination": { "daysMin": null, "daysMax": null, "note": null },
  "harvest": { "startMonth": 7, "endMonth": 10, "daysToHarvestMin": null, "daysToHarvestMax": null, "note": "Mitte Juli bis Oktober" },
  "spacingMinCm": 50,
  "spacingMaxCm": 80,
  "companions": {
    "good": ["basilikum", "zwiebel", "buschbohne", "sellerie"],
    "bad": [
      { "id": "kartoffel", "reason": "Beide Nachtschattengewächse – ähnliche Krankheiten/Schädlinge, Konkurrenz um Nährstoffe" }
    ]
  },
  "rotationGapYears": 4,
  "icon": "tomato"
}
```

- `sowing.direct`/`sowing.transplant`: Monatszahlen 1-12 — genau das, was Auswahlfilter und Kalender brauchen.
- `germination.daysMin/daysMax`: Keimdauer in Tagen, **nur relevant/gefüllt, wenn `sowing.direct` nicht leer ist** (Setzlinge sind bereits gekeimt, daher bei reinen Setzling-Pflanzen wie Tomate `null`). Speist die wochengenaue Keimphasen-Anzeige im Kalender (s.u.).
- `harvest`: entweder festes `startMonth`/`endMonth` (lange Kultur wie Tomate) **oder** `daysToHarvestMin/Max` ab Aussaatmonat (schnelle Kultur wie Radieschen) — die Zeit-Engine nutzt, was vorhanden ist.
- `companions.bad` trägt bewusst einen `reason`-Text (für die Warnmeldung), `companions.good` nicht (nur Anzeige).
- `icon`: Schlüssel in ein kleines handgezeichnetes SVG-Symbol-Set im Frontend (mit generischem Fallback für noch nicht illustrierte Icons, damit Katalog-Erweiterung nie das Rendering bricht).

**Laden:** `backend/src/plantCatalog.js`, einmalig per `fs.readFileSync` + `JSON.parse` beim Start (wie `db.js`, synchron; bewusst kein `import ... with { type: "json" }`, das ist über Node 18-22 zu versionsabhängig). Validiert beim Laden (eindeutige IDs, alle `companions`-Referenzen lösbar → `console.warn` bei Problemen, kein Crash). **Konsequenz:** Änderungen an `plants.json` erfordern einen Backend-Neustart (`node --watch` verfolgt nur importierte Module, keine per `fs` gelesenen Dateien) — das gehört als kurzer Hinweis in `CLAUDE.md`.

**Startbestand:** ~36 Pflanzen, bereits vollständig recherchiert (Quellen: plantura.garden, wurzelwerk.net, hortica.de u.a.) — kompakte Datentabelle mit allen für das Schema nötigen Feldern im Anhang unten. Muss bei der Implementierung nur noch ins JSON-Schema übertragen werden, keine weitere Recherche nötig.

## Backend-API

Alle Routen über das bestehende `authenticate`-Middleware-Muster, alle Beet-/Planting-Routen auf `req.user.id` skopiert.

```
GET    /api/plants                          → { plants: [...] }  (vollständiger Katalog)

GET    /api/beds                            → eigene Beete
POST   /api/beds                            → { name, width_cm, length_cm, standort }
GET    /api/beds/:id                        → einzelnes Beet (404 wenn nicht eigenes)
PUT    /api/beds/:id                        → Update (mit Resize-Guard, s.u.)
DELETE /api/beds/:id                        → löschen (kaskadiert zu plantings via FK)

GET    /api/beds/:id/plantings              → alle Plantings des Beets (optional ?year=)
POST   /api/beds/:id/plantings              → { plant_id, method, year, month, x_cm?, y_cm?, notes? }
                                               x_cm/y_cm erforderlich außer bei method='historisch'
PUT    /api/beds/:id/plantings/:plantingId  → Update (Position/Monat/Jahr/Methode/Notiz)
DELETE /api/beds/:id/plantings/:plantingId  → löschen

GET    /api/plantings                       → alle Plantings des Users über alle Beete
                                               (gejoint mit Beetname) — für die beetübergreifende
                                               Übersicht, optional ?year=
```

**Validierung bei `POST/PUT .../plantings`** (nutzt `shared/src/timing.js` + `shared/src/spacing.js`):
1. Beet gehört `req.user.id` (sonst 404).
2. `plant_id` existiert im Katalog (sonst 400).
3. `method` ist eine der laut Katalog erlaubten Methoden der Pflanze (sonst 400).
4. `month` 1-12, `year` plausibel.
5. Bei `method !== 'historisch'`: `x_cm`/`y_cm` Pflichtfelder, und **der komplette Abstandsradius muss innerhalb `[0,width_cm] × [0,length_cm]` liegen** (`radius ≤ x_cm ≤ width_cm-radius`, analog `y_cm`) — nicht nur der Mittelpunkt (Entscheidung s.o.).
6. **Harte Abstandsprüfung:** Belegungsfenster der Kandidat-Pflanzung berechnen (`shared/timing.js`), nur zeitlich überlappende bestehende Pflanzungen desselben Beets laden, dagegen `shared/spacing.js`-Kreisüberlappung prüfen (Radius = `spacingMinCm / 2`, siehe Entscheidung oben). Bei Konflikt: `409` mit `{ error, conflicts: [{plantingId, plantName, requiredDistanceCm, actualDistanceCm}] }`. Bei `PUT` die eigene Pflanzung von der Prüfung ausschließen.
7. `method === 'historisch'`: `x_cm`/`y_cm` bleiben `NULL`, Schritte 5+6 entfallen komplett (keine Geometrie vorhanden).

**Resize-Guard (`PUT /api/beds/:id`):** Würde eine Verkleinerung von `width_cm`/`length_cm` bestehende Pflanzungen (inkl. deren Radius, wegen der Randregel) außerhalb der neuen Grenzen stranden, wird mit `409` und der Liste betroffener Pflanzungen abgelehnt statt Daten stillschweigend inkonsistent zu machen.

## Regel-Engine (`shared/src/*.js`)

Reine Funktionen, kein React-/Express-Import.

- **`timing.js`**: `absoluteMonth(year, month)`; `isSowablePlantable(plant, month, method)`; `matchesStandort(plant, bedStandort)`; `computeOccupancy(planting, plant)` → `{ sowAbs, harvestStartAbs, harvestEndAbs, bedFreeAbs }` (nutzt `daysToHarvestMin/Max`, umgerechnet auf Monatsgranularität mit dokumentierter "Aussaat = Monatsmitte"-Konvention, oder `startMonth/endMonth`; `bedFreeAbs = harvestEndAbs + 1`).
  Zusätzlich `computeGerminationWindow(planting, plant)` — nur für `method === 'saatgut'` und wenn `plant.germination` gesetzt ist: nimmt dasselbe angenommene Aussaatdatum (Monatsmitte des Aussaatmonats), addiert `germination.daysMin/daysMax` in echten Tagen und gibt `{ startDate, endDate, startWeek, endWeek }` zurück, wobei `startWeek`/`endWeek` ISO-Kalenderwochen sind (kleiner handgerollter `getIsoWeek(date)`-Helfer, ~10 Zeilen Standard-Algorithmus, keine neue Dependency). Das ist die einzige Stelle im System, die auf Tages-/Wochengranularität rechnet — alles andere bleibt Monatsebene.
- **`spacing.js`**: `checkPlacement(candidate, existingConcurrentPlacements, plantsById)` → `{ ok, conflicts: [...] }`. Radius = `spacingMinCm / 2`. Identisch von Backend (Durchsetzung) und Frontend (Live-Vorschau beim Platzieren) genutzt.
- **`companions.js`**: `getCompanionWarnings(candidatePlantId, nearbyConcurrentPlantIds, plantsById)` → Warnungen mit `reason`-Text, bidirektional geprüft. "Nahe" = `1.5 × (radiusA + radiusB)`, nicht beetweit.
- **`rotation.js`**: `getRotationWarnings(bedHistory, candidatePlant, candidateYear)` — arbeitet auf den Snapshot-Feldern (inkl. `method='historisch'`-Einträgen), beetweit. Regel 1: gleiche Familie taucht innerhalb `rotationGapYears` wieder auf. Regel 2: direkt vorangegangene Bepflanzung war ebenfalls `zehrertyp: 'stark'` (leichtgewichtige Abbildung des Starkzehrer→Mittelzehrer→Schwachzehrer-Prinzips, keine volle Mehrphasen-Verfolgung — bewusste v1-Vereinfachung).
- **`picker.js`**: `filterPlantable(plants, { month, standort })` — speist `PlantPicker`.

`shared/package.json` bekommt `"test": "node --test"` (Node-eingebauter Test-Runner, keine neue Dependency) — der einzige Ort im Projekt mit Tests, bewusst begrenzt auf `shared/`, weil hier die Korrektheit einer harten Regel (Abstand) am meisten zählt.

## Frontend-Architektur

### Routing (`frontend/src/App.jsx`)
```
/                → Beete.jsx (Ersatz für Dashboard.jsx) — Beetliste + Anlegen/Bearbeiten
/beete/:bedId    → BedPlanner.jsx — Planer + "Kalender"-Tab + "Historie nachtragen"
/kalender        → Overview.jsx — beetübergreifende Kalenderübersicht (Nice-to-have, Phase 6)
```
Alle weiter in der bestehenden `ProtectedRoute` gekapselt.

### Neuer Context
`frontend/src/context/PlantCatalogContext.jsx` — lädt `GET /api/plants` einmalig, wrappt die App in `main.jsx` neben `AuthProvider`, liefert `{ plants, plantsById, loading, error }`.

### `api/client.js` — Erweiterung des bestehenden `api`-Objekts (kein Parallel-Client)
```js
listPlants, listBeds, createBed, getBed, updateBed, deleteBed,
listPlantings(bedId), createPlanting(bedId, data), updatePlanting(bedId, id, data), deletePlanting(bedId, id),
listAllPlantings
```

### Neue Komponenten (`frontend/src/components/`)
- `BedCard`, `BedForm` — Beetliste/Anlegen/Bearbeiten.
- `BedCanvas` — maßstäbliches SVG-Beet + Platzierungsinteraktion (Kernkomponente, s.u.).
- `PlantMarker` — ein platziertes Symbol + gestrichelter Abstandsring + Hover/Klick.
- `PlantPicker` — gefilterte Pflanzenliste (`shared/picker.js`), Klick "bewaffnet" die Platzierung.
- `MonthSelector` — Monat **und** Jahr (Jahr nötig, weil Fruchtfolge jahresbezogen ist).
- `PlantTooltip` — Detail-Popover (Familie, Zehrertyp, Abstand, Nachbarn, Aussaat-/Erntetext).
- `GuidanceBanner` — weiche Warnung mit "Trotzdem platzieren"-Bestätigung.
- `BedInfoPanel` — Stichpunkt-Zusammenfassung pro Beet (Aussaat → Erntefenster → Beet-frei-Termin).
- `CalendarView` — Gantt-artiges Monatsraster, für Einzelbeet **und** Gesamtübersicht wiederverwendet.
- `HistoryForm` — der einfache "Vorjahres-Bepflanzung nachtragen"-Modus (Pflanze + Jahr + Monat, kein Positions-Picker).
- `frontend/src/icons/PlantIcons.jsx` — handgezeichnetes SVG-Symbol-Set, generischer Fallback (Blatt/Punkt).

### `BedCanvas` — technischer Ansatz

Reines inline `<svg viewBox="0 0 {width_cm} {length_cm}">` — **1 SVG-Einheit = 1 cm**, reale Koordinaten brauchen keine manuelle Skalierung; CSS (`width:100%; max-width:…; height:auto`) macht es responsiv, `viewBox` erhält das reale Seitenverhältnis. Passt zum bestehenden "keine Canvas-Bibliothek, plain CSS"-Stil besser als `konva`/`fabric`/etc.

Interaktion (klickbasiert, wie vom Anwender selbst beschrieben — "durch Anklicken"):
1. Pflanze in `PlantPicker` wählen → Platzierungsmodus aktiv.
2. Mausbewegung über dem SVG berechnet cm-Koordinaten (`getBoundingClientRect()` + viewBox-Skalierung), zeigt Geister-Marker + Abstandsring, grün/rot eingefärbt via **sofortigem clientseitigem** Aufruf von `shared/spacing.js` gegen bereits geladene, zeitlich überlappende Pflanzungen (kein Netzwerk-Roundtrip pro Mausbewegung).
3. Klick auf konfliktfreie Stelle → `shared/companions.js` + `shared/rotation.js` gegen nahe/überlappende Pflanzungen und die Beet-Historie prüfen → bei Warnungen `GuidanceBanner` ("⚠ passt nicht gut zu Tomaten – Grund: … Trotzdem platzieren?"); bei Bestätigung (oder keine Warnung) `POST`. Server validiert autoritativ erneut (Verteidigung gegen Race Conditions/veralteten Client-Zustand) und kann weiterhin 409 liefern.
4. Verschieben = Marker anklicken → neue Stelle anklicken (kein Drag&Drop — nicht gefordert, hält v1 einfach); "Entfernen"-Button im Marker-Tooltip.
5. Marker außerhalb des aktuell gewählten Planungsmonats werden blass/ausgegraut dargestellt (oder über "vergangene Pflanzungen anzeigen"-Toggle ausgeblendet), über dieselbe Belegungsberechnung.

### Kalender (`CalendarView.jsx`)

Handgebaut mit CSS Grid: Spalten = Monate, Zeilen = eine pro Pflanzung, als Balken von Aussaatmonat bis Beet-frei-Monat (`shared/timing.js`). Bei `method === 'saatgut'` **drei** Segmente statt zwei: Keimung (aus `computeGerminationWindow`), Wachstum, erntereif — sonst nur die letzten beiden. Das Keimungs-Segment ist das einzige mit Wochenauflösung: es wird als schmaler, schraffierter Teilbereich innerhalb der Monatszelle(n) positioniert, die es überspannt (Breite proportional zur Woche im Monat), mit Tooltip/Label "Keimung ca. KW {startWeek}–{endWeek}" — der Rest des Balkens bleibt bewusst monatsgenau, um nicht das ganze Kalenderraster auf Wochenspalten umstellen zu müssen (unnötige Komplexität für die restlichen, ohnehin nur monatsgenau geplanten Phasen). `BedInfoPanel`s Stichpunkt-Liste bekommt denselben dritten Punkt ("Keimung: ca. KW X–Y") als Text, gespeist von derselben Funktion. Keine Kalender-/Gantt-Bibliothek nötig. `CalendarView` unverändert wiederverwendet in `BedPlanner`s "Kalender"-Tab (ein Beet) und `Overview.jsx` (alle Beete via `GET /api/plantings`, nach Beetname gruppiert).

### Styling
Neue Datei `frontend/src/styles/planner.css` (importiert neben `index.css`, wegen des Umfangs der neuen UI), neue Custom Properties `--color-soil`, `--color-radius-ring`, `--color-warning` (amber, getrennt von `--color-error`), `--radius-organic` (z.B. `16px`) für abgerundete, organisch wirkende Formen — konsequent im bestehenden Plain-CSS-Stil.

## Implementierungsentscheidungen (vom Entwurfsagenten vorgeschlagen, hier final)

- **`shared/`-Workspace statt duplizierter Regel-Dateien:** gewählt, weil Server/Client bei einer harten Regel (Abstand) nicht auseinanderdriften dürfen.
- **Mischkultur-Näheschwelle:** `1.5 × (radiusA + radiusB)`.
- **Beet-Maßeinheit:** cm, einfaches Zahlenfeld (kein separates m/cm-Umschalten in v1).
- **`index.css` vs. `planner.css`:** aufgeteilt, wegen des Umfangs der neuen UI.
- **Beetübergreifender Kalender (`/kalender`):** Phase 6, Nice-to-have — kann bei Zeitdruck ohne Bruch anderer Teile entfallen.

## Phasenplan

1. **Fundament:** `shared`-Workspace anlegen (Root-`package.json` + Backend/Frontend-Dependency, Vite-Auflösung verifizieren). `db.js`: `foreign_keys`-Pragma + neue Tabellen. Initiales `plants.json` (Startbestand aus Anhang) + `PLANTS_SCHEMA.md`. `plantCatalog.js`, `GET /api/plants`, `PlantCatalogContext`, `api.listPlants`.
2. **Beete-CRUD:** `routes/beds.js` (nur Beete, noch keine Plantings). `Beete.jsx` (ex-`Dashboard.jsx`) mit `BedCard`/`BedForm`. Verifiziert das komplette Muster ohne Planer-Komplexität.
3. **Pflanzenauswahl + statisches Beet:** `shared/timing.js` (Filter-Teil) + `shared/picker.js`. `MonthSelector`, `PlantPicker` (nur lesend). `BedCanvas` zeigt zunächst nur den maßstäblichen Umriss (validiert SVG/viewBox-Ansatz). Erstes kleines Icon-Set.
4. **Platzierung + harte Abstandsprüfung:** verschachtelte Planting-Routen mit voller serverseitiger Validierung (inkl. Randregel). Klick-Interaktion in `BedCanvas`, Live-Vorschau, `PlantMarker`, an CRUD-API angebunden. **Erster vollständiger End-to-End-Durchstich der Kernfunktion.**
5. **Weiche Führung:** vollständiges ~36-Pflanzen-`plants.json` (Companions/Rotation). `shared/companions.js`, `shared/rotation.js`. `GuidanceBanner` an den Platzierungsfluss aus Phase 4 angebunden. `PlantTooltip`. `HistoryForm` für rückwirkende Erfassung.
6. **Kalender:** `computeGerminationWindow` + `getIsoWeek`-Helfer in `shared/timing.js`. `BedInfoPanel`-Stichpunkte (schnellster Nutzen, zuerst) inkl. Keimungs-Zeile bei Saatgut. `CalendarView`-Gantt-Raster als "Kalender"-Tab in `BedPlanner`, mit dem wochengenauen Keimungs-Segment.
7. **Beetübergreifende Übersicht (optional):** `GET /api/plantings`, `Overview.jsx` unter `/kalender`, Navigationslink.
8. **Feinschliff:** vollständiges Icon-Set, CSS-Politur (organische Tokens, Mobile-Check), Leer-/Ladezustände, Textdurchsicht.

## Zu ändernde/neue Dateien

**Neuer Workspace:** `shared/package.json`, `shared/src/{timing,spacing,companions,rotation,picker}.js`

**Backend:** `backend/src/db.js` (ändern), `backend/src/plantCatalog.js` (neu), `backend/src/data/plants.json` + `PLANTS_SCHEMA.md` (neu), `backend/src/routes/{plants,beds,plantings}.js` (neu), `backend/src/server.js` (ändern — Router mounten), `backend/package.json` (ändern — `shared`-Dependency)

**Frontend:** `frontend/src/context/PlantCatalogContext.jsx` (neu), `frontend/src/api/client.js` (ändern), `frontend/src/App.jsx` (ändern), `frontend/src/pages/{Beete,BedPlanner,Overview}.jsx` (neu/umbenannt), `frontend/src/components/{BedCard,BedForm,BedCanvas,PlantMarker,PlantPicker,MonthSelector,PlantTooltip,GuidanceBanner,BedInfoPanel,CalendarView,HistoryForm}.jsx` (neu), `frontend/src/icons/PlantIcons.jsx` (neu), `frontend/src/styles/planner.css` (neu), `frontend/package.json` (ändern), root `package.json` (ändern — `shared` in `workspaces`)

**Doku:** `CLAUDE.md` aktualisieren (neue Tabellen/Routen/Seiten, Hinweis "Backend-Neustart nach `plants.json`-Änderung")

## Verifikation

Nach jeder Phase manuell durchklicken (`npm run dev`), zusätzlich:
- Phase 1: `curl localhost:3001/api/plants` liefert den Katalog; Backend startet ohne SQLite-Fehler.
- Phase 2: Beet anlegen/bearbeiten/löschen über die UI, Reload behält den Zustand (DB-Persistenz prüfen).
- Phase 4: Zwei Pflanzen mit bekanntem Abstand gezielt zu nah aneinander platzieren → muss `409` liefern und der Client darf sie nicht absetzen; eine gültige Platzierung außerhalb der Radien muss klappen. Randfall: Platzierung so nah am Beetrand, dass der Radius übersteht → muss abgelehnt werden (Randregel).
- Phase 5: Tomate neben Kartoffel platzieren → Warnbanner mit Grund erscheint, "Trotzdem platzieren" erlaubt es dennoch; per `HistoryForm` eine Vorjahres-Tomate eintragen und im selben Beet erneut Tomate fürs aktuelle Jahr wählen → Fruchtfolge-Warnung erscheint.
- Phase 6: Radieschen im März säen → Kalender/Info-Panel zeigt plausibles Erntefenster (April/Mai) und Beet-frei-Termin danach, **zusätzlich** eine wochengenaue Keimangabe (bei Radieschen ca. 1 Woche nach Aussaat) als eigenes Segment/Stichpunkt, unterscheidbar vom Wachstums-/Ernte-Teil.
- `cd shared && npm test` läuft grün für die Regel-Engine.

## Anhang: Recherchierte Pflanzendaten (Startbestand für `plants.json`)

Format je Zeile: `id | Name | Familie | Zehrertyp | Standort | Direktsaat-Monate | Pflanzung/Setzling-Monate | Ernte | Abstand cm (min-max) | gute Nachbarn | schlechte Nachbarn (Kurzgrund in Klammern wo bekannt) | Fruchtfolge-Jahre`

(S=Sonne, HS=Halbschatten; Monate als Zahl 1-12)

1. `tomate` Tomate | nachtschattengewaechse | stark | S | – | 5 | 7-10 | 50-80 | basilikum,petersilie,knoblauch,zwiebel,buschbohne,sellerie | kartoffel,paprika,aubergine,gurke,kohlarten,fenchel,erbse,rote_bete | 4
2. `gurke` Gurke | kuerbisgewaechse | stark | S | 5 | 5 | 6-10 | 40-100 | buschbohne,erbse,dill,kohlarten,salat,lauch,rote_bete,zwiebel,basilikum | tomate,kartoffel,radieschen | 4
3. `zucchini` Zucchini | kuerbisgewaechse | stark | S | 5 | 4-5 | 6-10 | 90-100 | buschbohne,stangenbohne,erbse,zwiebel,knoblauch,salat,lauch,karotte,petersilie,rettich,rote_bete,sellerie,spinat,basilikum | gurke,kuerbis,kartoffel,tomate | 4
4. `kuerbis` Kürbis | kuerbisgewaechse | stark | S | – | 5 | 9-10 | 100-150 | stangenbohne,erbse,knoblauch,zwiebel | gurke,zucchini,kartoffel | 5
5. `paprika` Paprika | nachtschattengewaechse | stark | S | – | 5 | 7-10 | 45-50 | kohlarten,tomate,basilikum | kartoffel,aubergine,chili,erbse,fenchel,rote_bete | 4
6. `chili` Chili | nachtschattengewaechse | stark | S | – | 5 | 8-10 | 40-50 | kohlarten,tomate,basilikum | kartoffel,aubergine,paprika,erbse,fenchel | 4
7. `aubergine` Aubergine | nachtschattengewaechse | stark | S | – | 5 | 7-10 | 45-100 | buschbohne | paprika,tomate,kartoffel,chili | 4
8. `radieschen` Radieschen | kreuzbluetler | schwach | S/HS | 3-10 | – | 4-8 Wochen nach Aussaat | 3-5 | buschbohne,erbse,mangold,karotte,tomate,salat | gurke,kohlarten,radieschen (Selbstunverträglichkeit) | 3
9. `rettich` Rettich | kreuzbluetler | mittel | S/HS | 4-5,8 | – | Sommer schnell, Winter lagerfähig | 20-30 | buschbohne,erbse,mangold,karotte,tomate | gurke,kohlarten | 4
10. `karotte` Karotte/Möhre | doldenbluetler | mittel | S | 3-7 | – | 6-10 | 3-5 (Reihe 25-40) | zwiebel,knoblauch,lauch,salat,mangold,erbse,schnittlauch,erdbeere | sellerie,pastinake,petersilie,dill,fenchel,rote_bete (verwandte Doldenblütler) | 4
11. `zwiebel` Zwiebel | lauchgewaechse | schwach | S | 2-4 | 3-4 | 7-9 | 10 (Reihe 25-30) | karotte,dill,gurke,tomate,rote_bete,erdbeere | buschbohne,stangenbohne,erbse,kohlarten,kartoffel (hemmen sich mit Bohnen gegenseitig) | 4
12. `knoblauch` Knoblauch | lauchgewaechse | schwach | S | – | 3-4,9-11 | 6-8 | 15-20 | erdbeere,gurke,karotte,rote_bete,tomate | erbse,buschbohne,stangenbohne,kohlarten | 3
13. `lauch` Lauch/Porree | lauchgewaechse | stark | S/HS | 3 | 4 | 6-4 (winterhart, lange Standzeit) | 15 (Reihe 30) | erdbeere,kohlarten,karotte,salat,sellerie,tomate | buschbohne,stangenbohne,erbse,rote_bete | 4
14. `kopfsalat` Kopfsalat/Pflücksalat | korbbluetler | mittel | S/HS | 4-10 | 3 | 8-10 Wochen nach Aussaat | 25-40 | buschbohne,erbse,fenchel,gurke,kohlarten,karotte,zwiebel,radieschen,tomate,erdbeere | petersilie,sellerie | 3
15. `spinat` Spinat | gaensefussgewaechse | mittel | S/HS | 2-4,8-10 | – | 6-8 Wochen nach Aussaat | 15 (Reihe 25-30) | erdbeere,kartoffel,kohlarten,buschbohne,tomate | rote_bete,mangold (verwandte Gänsefußgewächse) | 3
16. `mangold` Mangold | gaensefussgewaechse | mittel | S/HS | 4-6 | 4 | 6-10 | 20-30 (Reihe 40-60) | buschbohne,kohlarten,radieschen,salat,karotte,zucchini | rote_bete,spinat | 4
17. `kohlrabi` Kohlrabi | kreuzbluetler | mittel | S/HS | 4 | 4 | ab 8 Wochen, Sommer/Herbst | 20-30 | buschbohne,dill,erbse,gurke,kartoffel,lauch,radieschen,sellerie | kohlarten | 4
18. `brokkoli` Brokkoli | kreuzbluetler | stark | S | 4 | 5 | 7-10 | 30-60 | sellerie,buschbohne,salat | kohlarten,kartoffel,zwiebel,knoblauch | 5
19. `blumenkohl` Blumenkohl | kreuzbluetler | stark | S | – | 2,4-6 | 6-10 | 50 | buschbohne,sellerie,erbse | knoblauch,zwiebel,kohlarten | 4
20. `weisskohl` Weißkohl | kreuzbluetler | stark | S | – | 3-5 | 7-12 | 50-70 | buschbohne,dill,salat,erbse,gurke,rote_bete,sellerie,tomate | kohlarten,kartoffel,knoblauch,zwiebel | 4
21. `rotkohl` Rotkohl | kreuzbluetler | stark | S | – | 3-5 | 7-12 | 50 | wie weisskohl | wie weisskohl | 4
22. `gruenkohl` Grünkohl | kreuzbluetler | stark | S/HS | – | 5-6 | 9-3 (nach erstem Frost) | 50 | buschbohne,salat,sellerie | kohlarten | 4
23. `rosenkohl` Rosenkohl | kreuzbluetler | stark | S | – | 4-5 | 8-12 (frostverträglich) | 50 (Reihe 70) | wie andere Kohlarten | wie andere Kohlarten | 3
24. `buschbohne` Buschbohne | huelsenfruechtler | schwach | S | 5 | – | 7-9 (55-70 Tage) | 6-8 (Reihe 40) | dill,erdbeere,gurke,kartoffel,kohlarten,rote_bete,radieschen,salat,sellerie,spinat | erbse,knoblauch,fenchel,paprika,lauch,schnittlauch,zwiebel,stangenbohne | 4
25. `stangenbohne` Stangenbohne | huelsenfruechtler | schwach | S | 5 | – | 7-11 (10-12 Wochen) | 50 | gurke,kartoffel,kohlarten,radieschen,rote_bete,spinat | buschbohne,erbse,lauchgewaechse,paprika | 4
26. `erbse` Erbse | huelsenfruechtler | schwach | S | 3-6 | – | 5-8 | 10 (Reihe 35) | dill,fenchel,gurke,karotte,kohlarten,kohlrabi,salat,radieschen,zucchini | buschbohne,stangenbohne,kartoffel,tomate,zwiebel,knoblauch,schnittlauch (selbstunverträglich, längste Anbaupause) | 6
27. `kartoffel` Kartoffel | nachtschattengewaechse | stark | S | – | 4-5 | 6-10 | 30-35 (Reihe 75) | buschbohne,kohlrabi,spinat | tomate,paprika,aubergine,erbse,gurke,kuerbis,zwiebel | 4
28. `sellerie` Sellerie | doldenbluetler | stark | S | – | 5 | 8-10 | 40 | buschbohne,gurke,salat,lauch,tomate,kohlarten | erbse,kartoffel | 4
29. `rote_bete` Rote Bete | gaensefussgewaechse | mittel | S | 4-5 | – | 6-11 | 10 (Reihe 25-30) | buschbohne,dill,kohlarten,gurke,salat,zwiebel,zucchini,knoblauch,lauch | kartoffel,spinat,mangold | 3
30. `pastinake` Pastinake | doldenbluetler | mittel | S/HS | 2-6 | – | ab 9 (160-200 Tage) | 10-15 (Reihe 30-40) | kartoffel,salat,radieschen,rote_bete,sellerie,dill,kohlrabi | karotte,petersilie,fenchel (verwandte Doldenblütler) | 5
31. `fenchel` Fenchel | doldenbluetler | mittel | S | 4-8 | – | 6-10 (10-12 Wochen) | 30-40 | erbse,gurke,kohlarten,spinat,basilikum | bohnen,tomate (Fenchel generell schwieriger Nachbar für viele Arten) | 4
32. `erdbeere` Erdbeere | rosengewaechse | mittel | S/HS | – | 7-8 | 4-10 | 25-30 (Reihe 40-45) | knoblauch,salat,radieschen,spinat,schnittlauch,zwiebel,buschbohne | kohlarten | 4
33. `basilikum` Basilikum | lippenbluetler | stark | HS | 3 | 5 | 6-10 | 10-25 | tomate,gurke,zucchini | – | 3 (Standardwert, keine Quelle explizit)
34. `petersilie` Petersilie | doldenbluetler | schwach | S/HS | 4-8 | 4-8 | ganzjährig (zweijährige Pflanze) | 10-20 | tomate,gurke,zwiebel,schnittlauch,radieschen,erdbeere | salat | 4
35. `dill` Dill | doldenbluetler | schwach | S | 4-8 | – | laufend während der Kultur | 20-30 | erbse,karotte,kohlarten,salat,radieschen,sellerie,zucchini,gurke | buschbohne,kartoffel,lauch,knoblauch,zwiebel,tomate | 4
36. `schnittlauch` Schnittlauch | lauchgewaechse | mittel | S/HS | 3-4 | – | laufend (mehrjährig, winterhart) | 30 | karotte,erdbeere,petersilie,basilikum,tomate | erbse,blumenkohl,bohnen | 3

### Keimdauer (nur für Pflanzen mit Direktsaat relevant, `germination.daysMin`–`daysMax`)

Typische, allgemein anerkannte Erfahrungswerte (Standardangaben aus der Gärtnerpraxis, nicht Teil der obigen Einzel-Recherche — vor produktivem Einsatz stichprobenartig gegen die ohnehin genutzten Quellen wie plantura.garden gegenzuprüfen, dort wird Keimdauer i.d.R. mit angegeben):

- `radieschen`: 3-7 Tage
- `rettich`: 4-10 Tage
- `karotte`: 14-21 Tage (langsam keimend)
- `zwiebel` (Saatzwiebeln; bei Steckzwiebeln entfällt Keimung): 10-18 Tage
- `lauch`: 10-18 Tage
- `kopfsalat`: 4-8 Tage
- `spinat`: 8-14 Tage
- `mangold`: 8-14 Tage
- `kohlrabi`: 6-10 Tage
- `brokkoli`: 6-10 Tage
- `buschbohne`: 7-14 Tage
- `stangenbohne`: 7-14 Tage
- `erbse`: 7-14 Tage
- `rote_bete`: 10-14 Tage
- `pastinake`: 14-28 Tage (sehr langsam)
- `fenchel`: 8-14 Tage
- `petersilie`: 14-28 Tage (bekannt sehr langsam keimend)
- `dill`: 10-14 Tage
- `schnittlauch`: 10-14 Tage
- `gurke`: 6-10 Tage
- `zucchini`: 6-10 Tage
- `kuerbis`: 6-10 Tage
- `basilikum`: 5-10 Tage

Alle übrigen Pflanzen im Startbestand werden ausschließlich als Setzling/Knolle/Steckling gepflanzt (kein `sowing.direct`) → `germination: null`.

**Allgemeine Fruchtfolge-Regel** (als Doku-Kommentar in `PLANTS_SCHEMA.md` übernehmen): Starkzehrer → Mittelzehrer → Schwachzehrer → Gründüngung/Pause, dann von vorn; Familien-Anbaupause i.d.R. 3-4 Jahre (Ausreißer: Erbsen 6 Jahre, manche Kreuzblütler bis 5).

**Bekannte Datenlücken** (bei Gelegenheit nachschärfen, kein Blocker für v1): Chili-Abstand von Paprika abgeleitet, nicht separat verifiziert; Fenchel hat kaum belastbare "gute Nachbarn"; Basilikum-Fruchtfolge-Jahre sind ein Schätzwert ohne Quellenbeleg; einige Zehrertyp-Einordnungen (Zwiebel, Lauch, Spinat, Mangold, Kohlrabi, Grünkohl) schwanken je nach Quelle leicht — hier wurde die plausibelste/am häufigsten genannte Einordnung übernommen; die Keimdauer-Werte oben sind allgemeine Erfahrungswerte, nicht einzeln pro Pflanze mit Quellenbeleg gegengeprüft wie der Rest der Tabelle.
