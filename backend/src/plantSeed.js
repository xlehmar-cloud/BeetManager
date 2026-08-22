import { plantList } from './plantCatalog.js';

// Bekannte botanische Familien aus dem Startkatalog — als feste Auswahlliste im
// Formular (verhindert Slug/Label-Inkonsistenzen bei Freitext) UND als
// Slug->Label-Nachschlagetabelle für die API-Antwort (s. userPlants.js).
// `family` wird bewusst als Slug gespeichert (nicht das Label), damit die
// Fruchtfolge-Prüfung (String-Vergleich gegen plant_family_snapshot) auch für
// schon bestehende Pflanzungen aus der Zeit vor diesem Feature weiter funktioniert.
export const FAMILIES = [
  ['nachtschattengewaechse', 'Nachtschattengewächse'],
  ['kuerbisgewaechse', 'Kürbisgewächse'],
  ['kreuzbluetler', 'Kreuzblütler'],
  ['doldenbluetler', 'Doldenblütler'],
  ['lauchgewaechse', 'Lauchgewächse'],
  ['korbbluetler', 'Korbblütler'],
  ['gaensefussgewaechse', 'Gänsefußgewächse'],
  ['huelsenfruechtler', 'Hülsenfrüchtler'],
  ['rosengewaechse', 'Rosengewächse'],
  ['lippenbluetler', 'Lippenblütler'],
];
export const FAMILY_LABELS = Object.fromEntries(FAMILIES);

/**
 * Kopiert den globalen Startkatalog (plants.json) als editierbare Kopie in die
 * plants-Tabelle eines einzelnen Nutzers — Grundlage für "eigenes Saatgut/
 * Setzling hinzufügen": der Nutzer bearbeitet danach seine eigene Kopie, der
 * globale Katalog bleibt nur die Vorlage für neue Nutzer. `db` wird bewusst als
 * Parameter übergeben (nicht importiert), damit dieses Modul zirkelfrei sowohl
 * von db.js (Migration bestehender Nutzer) als auch von den Routen (neuer
 * Nutzer bei der Registrierung) genutzt werden kann.
 *
 * @returns {[catalogId: string]: newPlantId} — für Aufrufer, die bestehende
 *   plant_id-Referenzen (alte Katalog-Slugs) auf die neuen IDs ummappen müssen.
 */
export function seedPlantsForUser(db, userId) {
  const insertPlant = db.prepare(`
    INSERT INTO plants (
      user_id, name, family, zehrertyp, standort, methods,
      sowing_direct_months, sowing_transplant_months, sowing_note,
      germination_days_min, germination_days_max,
      harvest_start_month, harvest_end_month, harvest_days_min, harvest_days_max, harvest_note,
      spacing_min_cm, spacing_max_cm, rotation_gap_years, icon, is_builtin
    ) VALUES (@user_id, @name, @family, @zehrertyp, @standort, @methods,
      @sowing_direct_months, @sowing_transplant_months, @sowing_note,
      @germination_days_min, @germination_days_max,
      @harvest_start_month, @harvest_end_month, @harvest_days_min, @harvest_days_max, @harvest_note,
      @spacing_min_cm, @spacing_max_cm, @rotation_gap_years, @icon, 1)
  `);
  const insertCompanion = db.prepare(`
    INSERT INTO plant_companions (plant_id, companion_plant_id, relation, reason)
    VALUES (?, ?, ?, ?)
  `);

  const newIdByCatalogId = {};

  const seedTx = db.transaction(() => {
    for (const plant of plantList) {
      const result = insertPlant.run({
        user_id: userId,
        name: plant.name,
        family: plant.family || null,
        zehrertyp: plant.zehrertyp,
        standort: JSON.stringify(plant.standort || []),
        methods: JSON.stringify(plant.methods || []),
        sowing_direct_months: JSON.stringify(plant.sowing?.direct || []),
        sowing_transplant_months: JSON.stringify(plant.sowing?.transplant || []),
        sowing_note: plant.sowing?.note || null,
        germination_days_min: plant.germination?.daysMin ?? null,
        germination_days_max: plant.germination?.daysMax ?? null,
        harvest_start_month: plant.harvest?.startMonth ?? null,
        harvest_end_month: plant.harvest?.endMonth ?? null,
        harvest_days_min: plant.harvest?.daysToHarvestMin ?? null,
        harvest_days_max: plant.harvest?.daysToHarvestMax ?? null,
        harvest_note: plant.harvest?.note || null,
        spacing_min_cm: plant.spacingMinCm,
        spacing_max_cm: plant.spacingMaxCm ?? null,
        rotation_gap_years: plant.rotationGapYears ?? 4,
        icon: plant.icon || 'leaf',
      });
      newIdByCatalogId[plant.id] = result.lastInsertRowid;
    }

    // Zweiter Durchlauf: companions erst jetzt eintragen, weil dafür die neuen
    // IDs aller (auch später im Katalog stehender) Pflanzen bekannt sein müssen.
    for (const plant of plantList) {
      const fromId = newIdByCatalogId[plant.id];
      for (const goodId of plant.companions?.good || []) {
        const toId = newIdByCatalogId[goodId];
        if (toId) insertCompanion.run(fromId, toId, 'good', null);
      }
      for (const bad of plant.companions?.bad || []) {
        const toId = newIdByCatalogId[bad.id];
        if (toId) insertCompanion.run(fromId, toId, 'bad', bad.reason || null);
      }
    }
  });

  seedTx();
  return newIdByCatalogId;
}
