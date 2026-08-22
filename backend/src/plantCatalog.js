import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const catalogPath = path.join(__dirname, 'data', 'plants.json');

// Einmalig beim Start synchron geladen (wie db.js) — bewusst kein
// `import … with { type: "json" }`, das ist über Node 18-22 zu versionsabhängig.
// Konsequenz: Änderungen an plants.json erfordern einen Backend-Neustart,
// da `node --watch` nur importierte Module verfolgt, keine per fs gelesenen Dateien
// (s. PLANTS_SCHEMA.md).
const raw = fs.readFileSync(catalogPath, 'utf-8');
const { plants } = JSON.parse(raw);

function validateCatalog(list) {
  const ids = new Set();
  for (const plant of list) {
    if (ids.has(plant.id)) {
      console.warn(`[plantCatalog] Doppelte Pflanzen-ID in plants.json: "${plant.id}"`);
    }
    ids.add(plant.id);
  }
  for (const plant of list) {
    for (const goodId of plant.companions?.good || []) {
      if (!ids.has(goodId)) {
        console.warn(
          `[plantCatalog] "${plant.id}": unbekannte companions.good-Referenz "${goodId}"`,
        );
      }
    }
    for (const bad of plant.companions?.bad || []) {
      if (!ids.has(bad.id)) {
        console.warn(
          `[plantCatalog] "${plant.id}": unbekannte companions.bad-Referenz "${bad.id}"`,
        );
      }
    }
  }
}

validateCatalog(plants);

export const plantList = plants;
export const plantsById = Object.fromEntries(plants.map((p) => [p.id, p]));
