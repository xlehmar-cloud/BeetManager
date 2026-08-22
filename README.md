# Beet-Manager

Beet-Manager – eine Web-App zur interaktiven Planung von Hochbeeten. Läuft im
Browser, kann perspektivisch auch als Smartphone-App angeboten werden. Man legt
eigene Beete an und plant darin, was wann gepflanzt wird: mit Mindestabstand-
Prüfung, Mischkultur- und Fruchtfolge-Hinweisen sowie einer Kalendervorschau
von Aussaat bis Ernte.

## Stack

- **Frontend:** React + Vite (`frontend/`)
- **Backend:** Node.js + Express, REST-API (`backend/`)
- **Regel-Engine:** reine ESM-Funktionen ohne Abhängigkeiten (`shared/`), identisch von Backend (harte Abstandsprüfung) und Frontend (Live-Vorschau) genutzt
- **Datenbank:** SQLite-Datei (`backend/data/beet-manager.db`, wird beim ersten Start automatisch angelegt)
- **Login:** E-Mail + Passwort, JWT-basiert

## Voraussetzungen

- **Node.js ≥ 18** (inkl. npm). Installation z. B. via [nvm](https://github.com/nvm-sh/nvm) (kein sudo nötig):

  ```bash
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
  # neues Terminal öffnen oder: source ~/.bashrc
  nvm install --lts
  ```

  Alternativ über die Paketverwaltung, z. B. `sudo apt install nodejs npm`.

## Erste Einrichtung

```bash
# 1. Alle Abhängigkeiten installieren (Root, shared, Backend, Frontend über npm-Workspaces)
npm install

# 2. Umgebungsvariablen anlegen
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

## Lokal starten

```bash
npm run dev
```

Startet Backend (http://localhost:3001) und Frontend (http://localhost:5173)
gleichzeitig. Die App im Browser unter **http://localhost:5173** öffnen.

Alternativ einzeln in zwei Terminals:

```bash
npm run dev:backend
npm run dev:frontend
```

### Tests der Regel-Engine

```bash
cd shared && npm test
```

## Funktionen

- **Beete verwalten:** anlegen/bearbeiten/löschen (Bezeichnung, Maße in cm, Standort).
- **Pflanzplaner:** maßstäbliches Beet (1 SVG-Einheit = 1 cm), Pflanzenauswahl gefiltert
  nach Monat/Standort, Klick-Platzierung mit Live-Vorschau (grün/rot).
- **Harte Abstandsprüfung:** Mindestabstand wird serverseitig durchgesetzt, inkl. Regel,
  dass der komplette Abstandsradius innerhalb des Beetrands bleiben muss.
- **Weiche Führung:** Mischkultur- und Fruchtfolge-Warnungen mit Begründung und
  "Trotzdem platzieren"-Option; historische Bepflanzungen lassen sich ohne exakte
  Position nachtragen.
- **Kalender:** Aussaat → (bei Saatgut: wochengenaue Keimung) → Erntefenster → Beet
  wieder frei, pro Beet und beetübergreifend unter „Kalenderübersicht“.

## Projektstruktur

```
BeetManager/
├── shared/                 Reine Regel-Engine (Zeit/Abstand/Mischkultur/Fruchtfolge)
│   ├── src/                 timing.js, spacing.js, companions.js, rotation.js, picker.js
│   └── test/                node --test
├── backend/                Node/Express-API
│   ├── src/
│   │   ├── server.js        Einstiegspunkt, Middleware, Routen
│   │   ├── db.js            SQLite-Verbindung + Schema (users, beds, plantings)
│   │   ├── plantCatalog.js  Lädt/validiert data/plants.json beim Start
│   │   ├── data/
│   │   │   ├── plants.json         Pflanzenkatalog (von Hand editierbar)
│   │   │   └── PLANTS_SCHEMA.md    Schema-Doku für plants.json
│   │   ├── middleware/
│   │   │   └── auth.js      JWT-Prüfung (req.user)
│   │   └── routes/
│   │       ├── auth.js      /api/auth/register, /api/auth/login
│   │       ├── plants.js    /api/plants
│   │       ├── beds.js      /api/beds (CRUD)
│   │       └── plantings.js /api/beds/:id/plantings (verschachtelt)
│   └── data/                 SQLite-Datei (nicht in Git)
└── frontend/                React-App (Vite)
    └── src/
        ├── api/client.js     Fetch-Wrapper zur Backend-API
        ├── context/          AuthContext, PlantCatalogContext
        ├── components/       BedCanvas, PlantPicker, CalendarView, GuidanceBanner, …
        ├── icons/             PlantIcons.jsx (kategorienbasiertes SVG-Set)
        ├── styles/planner.css
        └── pages/             Beete, BedPlanner, Overview, Login, Register
```

Details zu Architektur und Konventionen: siehe `CLAUDE.md`. Der ursprüngliche
Entwurf steht zur historischen Einordnung in `docs/PLAN.md`.
