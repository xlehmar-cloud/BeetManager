# `plants.json` — Schema-Dokumentation

**Seit dem "eigenes Saatgut/Setzling"-Feature ist diese Datei nur noch der
_Startkatalog_:** Bei der Registrierung wird sie einmalig als Kopie in den
eigenen (editierbaren) Pflanzenkatalog des neuen Nutzers übernommen
(`plants`-Tabelle, s. `backend/src/plantSeed.js` und `backend/src/userPlants.js`).
Danach lebt jede Nutzerin/jeder Nutzer mit ihrer/seiner eigenen Kopie weiter —
Änderungen hier wirken sich **nicht** rückwirkend auf bereits registrierte
Nutzer aus, nur auf künftige Neu-Registrierungen. Laufende Bearbeitung des
eigenen Katalogs läuft über die UI ("Mein Pflanzenkatalog", `/pflanzen`), nicht
mehr über das Editieren dieser Datei. Das Schema unten beschreibt trotzdem noch
exakt, was pro Pflanze erfasst wird — nur eben jetzt in einer DB-Tabelle statt
in dieser JSON-Datei.

**Wichtig für Änderungen an `plants.json` selbst:** erfordert einen Neustart des
Backends (`npm run dev:backend`). Die Datei wird per `fs.readFileSync` beim
Start geladen (`src/plantCatalog.js`), nicht über `import … with { type:
"json" }` — `node --watch` verfolgt daher keine Änderungen an dieser Datei
automatisch.

## Struktur

Die Datei enthält ein Objekt `{ "plants": [...] }` mit einem Eintrag pro Pflanze:

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
  "harvest": { "startMonth": 7, "endMonth": 10, "daysToHarvestMin": null, "daysToHarvestMax": null, "note": "…" },
  "spacingMinCm": 50,
  "spacingMaxCm": 80,
  "companions": {
    "good": ["basilikum", "zwiebel"],
    "bad": [{ "id": "kartoffel", "reason": "…" }]
  },
  "rotationGapYears": 4,
  "icon": "fruit"
}
```

### Feldreferenz

- **`id`** — eindeutiger Slug (lowercase, keine Sonderzeichen), wird als Fremdschlüssel
  in `plantings.plant_id` gespeichert und in `companions`-Listen referenziert.
- **`name`** — Anzeigename.
- **`family`** / **`familyLabel`** — botanische Familie als Slug bzw. Anzeigetext.
  Treibt Regel 1 der Fruchtfolge-Prüfung (`shared/rotation.js`).
- **`zehrertyp`** — `"stark"` | `"mittel"` | `"schwach"`. Treibt Regel 2 der
  Fruchtfolge-Prüfung (Starkzehrer sollte nicht direkt auf Starkzehrer folgen).
- **`standort`** — Array aus `"sonne"` | `"halbschatten"` | `"schatten"`; muss
  mindestens einen Wert enthalten, der zum `standort` eines Beets passt, damit die
  Pflanze dort im `PlantPicker` auftaucht (`shared/timing.js#matchesStandort`).
- **`methods`** — welche Anbaumethoden für diese Pflanze grundsätzlich sinnvoll sind:
  Teilmenge von `["saatgut", "setzling"]`. `"historisch"` ist für jede Pflanze
  implizit erlaubt (rückwirkende Erfassung kennt keine Methodeneinschränkung) und
  taucht deshalb hier nicht auf.
- **`sowing.direct`** / **`sowing.transplant`** — Monatszahlen 1–12, in denen
  Direktsaat bzw. Pflanzung/Auspflanzen sinnvoll ist. Leeres Array = Methode nicht
  anwendbar. `sowing.note` ist Freitext für die UI.
- **`germination.daysMin`/`daysMax`** — Keimdauer in Tagen. **Nur relevant, wenn
  `sowing.direct` nicht leer ist** (Setzlinge sind bereits gekeimt). Speist die
  wochengenaue Keimphasen-Anzeige im Kalender
  (`shared/timing.js#computeGerminationWindow`). `null`/`null`, wenn nicht zutreffend.
- **`harvest`** — entweder `startMonth`/`endMonth` (fester Kalendermonat-Bereich;
  `endMonth < startMonth` bedeutet: Ernte reicht über den Jahreswechsel, z.B. Lauch
  `6→4`) **oder** `daysToHarvestMin`/`daysToHarvestMax` (Tage ab Aussaat, für
  schnelle Kulturen wie Radieschen). Die Regel-Engine (`shared/timing.js#computeOccupancy`)
  nutzt, was gefüllt ist — genau eines der beiden Paare sollte belegt sein, das
  andere bleibt `null`. `harvest.note` ist Freitext für die UI.
- **`spacingMinCm`** — der **Mindestabstand** zwischen zwei Pflanzen dieser Art
  (bzw. zur nächsten anderen Pflanze) in cm. Das ist die harte Blockiergrenze in
  der Platzierungsprüfung (Radius = `spacingMinCm / 2`, s. `shared/spacing.js`) —
  bewusst nicht `spacingMaxCm`, siehe Produktentscheidung in `docs/PLAN.md`.
- **`spacingMaxCm`** — nur informativ (empfohlener Abstand für optimalen Ertrag),
  fließt nicht in die harte Prüfung ein.
- **`companions.good`** — Array von Pflanzen-IDs, reine Anzeige, kein `reason`.
- **`companions.bad`** — Array von `{ id, reason }`. `reason` wird in der
  `GuidanceBanner`-Warnmeldung angezeigt. Die Prüfung ist bidirektional: eine
  `bad`-Beziehung zählt unabhängig davon, in wessen Katalogeintrag sie eingetragen
  ist (`shared/companions.js`). Ein Eintrag kann sich auch auf die eigene `id`
  beziehen (Selbstunverträglichkeit, z.B. Radieschen).
- **`rotationGapYears`** — empfohlene Anbaupause in Jahren, bevor dieselbe Familie
  wieder in dasselbe Beet darf (Fruchtfolge-Regel 1).
- **`icon`** — Schlüssel in das handgezeichnete SVG-Symbol-Set im Frontend
  (`frontend/src/icons/PlantIcons.jsx`). Aktuelle Kategorien: `fruit`, `root`,
  `leaf`, `legume`, `herb`, `berry`, `tuber`, `stalk`. Unbekannte/neue Icon-Werte
  fallen automatisch auf ein generisches Blatt-Symbol zurück — Katalogerweiterung
  bricht das Rendering also nie.

## Validierung beim Laden

`plantCatalog.js` prüft beim Start: eindeutige `id`s, alle `companions.good`- und
`companions.bad`-Referenzen zeigen auf existierende `id`s. Bei Problemen wird eine
`console.warn`-Meldung ausgegeben, das Backend startet trotzdem (kein Crash durch
einen Tippfehler in der von Hand gepflegten Datei).

## Allgemeine Fruchtfolge-Regel (Hintergrundwissen für neue Einträge)

Starkzehrer → Mittelzehrer → Schwachzehrer → Gründüngung/Pause, dann von vorn.
Familien-Anbaupause i.d.R. 3–4 Jahre (Ausreißer: Erbsen 6 Jahre, manche
Kreuzblütler bis 5).

## Bekannte Datenlücken (Stand Erstbefüllung)

Chili-Abstand von Paprika abgeleitet, nicht separat verifiziert; Fenchel hat kaum
belastbare "gute Nachbarn"; Basilikum-Fruchtfolge-Jahre sind ein Schätzwert ohne
Quellenbeleg; einige Zehrertyp-Einordnungen (Zwiebel, Lauch, Spinat, Mangold,
Kohlrabi, Grünkohl) schwanken je nach Quelle leicht; die Keimdauer-Werte sind
allgemeine Erfahrungswerte; die Erntefenster von Rettich, Petersilie, Dill und
Schnittlauch sind grobe Schätzwerte (keine feste Quelle) — vor produktivem Einsatz
stichprobenartig gegen plantura.garden o.ä. gegenprüfen.

**Schattenbeet-Ergänzung:** `standort` enthielt bis dahin bei keiner einzigen
Pflanze `"schatten"` — die Option war im Beet-Formular auswählbar, aber im
`PlantPicker` faktisch immer leer. Ergänzt: `baerlauch` (neu, nur Halbschatten/
Schatten — verträgt keine pralle Sonne), `minze` (neu, Lippenblütler wie
`basilikum`, alle drei Standorte), `rhabarber` (neu, `family: null` — Rhabarber
gehört zu den Knöterichgewächsen, keine der 10 geführten Familien, daher bewusst
ohne Fruchtfolge-Familienbezug statt falsch zugeordnet) sowie `schnittlauch`
(bestehender Eintrag, `standort` um `"schatten"` erweitert). `baerlauch` und
`rhabarber` haben `companions.good`/`bad` weitgehend leer gelassen statt
geraten — für beide gibt es kaum belastbare Mischkultur-Literatur, anders als
für die etablierten Gemüsearten. Rhabarber-Erntefenster (April–Juni, traditionell
bis Johannitag) und alle drei Erntefenster/Abstände generell sind Erfahrungswerte,
nicht separat gegengeprüft.
