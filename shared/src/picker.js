// Speist den PlantPicker: welche Pflanzen sind in diesem Monat, an diesem
// Standort, überhaupt sinnvoll auswählbar?
import { isSowablePlantable, matchesStandort } from './timing.js';

/**
 * @param plants vollständiger Katalog
 * @param { month, standort } Planungsmonat (1-12) und Beet-Standort
 * @returns Pflanzen, die an diesem Standort stehen dürfen und in diesem Monat
 *   mit mindestens einer Methode aussäh-/pflanzbar sind, angereichert um
 *   `availableMethods` (Teilmenge von ['saatgut','setzling']) für genau diesen Monat.
 */
export function filterPlantable(plants, { month, standort }) {
  return plants
    .filter((plant) => !standort || matchesStandort(plant, standort))
    .map((plant) => {
      const availableMethods = (plant.methods || []).filter((method) =>
        isSowablePlantable(plant, month, method),
      );
      return { ...plant, availableMethods };
    })
    .filter((plant) => plant.availableMethods.length > 0);
}
