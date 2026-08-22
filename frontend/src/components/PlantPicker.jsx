import { useMemo, useState } from 'react';
import { filterPlantable } from 'shared/src/picker.js';
import PlantIcon from '../icons/PlantIcons.jsx';

/**
 * Gefilterte Pflanzenliste für Monat + Beet-Standort. Klick auf eine Pflanze
 * "bewaffnet" die Platzierung (armedPlant im BedPlanner) oder öffnet bei
 * mehreren verfügbaren Methoden erst eine kleine Methodenwahl.
 */
export default function PlantPicker({ plants, month, standort, onArm, armedPlantId }) {
  const [search, setSearch] = useState('');

  const plantable = useMemo(
    () => filterPlantable(plants, { month, standort }),
    [plants, month, standort],
  );

  const filtered = plantable.filter((p) =>
    p.name.toLowerCase().includes(search.trim().toLowerCase()),
  );

  return (
    <div className="plant-picker">
      <input
        type="search"
        placeholder="Pflanze suchen…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        aria-label="Pflanze suchen"
      />
      {filtered.length === 0 && (
        <p className="empty-hint">Keine Pflanzen für diesen Monat/Standort passend.</p>
      )}
      <ul className="plant-picker-list">
        {filtered.map((plant) => (
          <li key={plant.id}>
            {plant.availableMethods.length > 1 ? (
              <MethodChoice plant={plant} onArm={onArm} armed={armedPlantId === plant.id} />
            ) : (
              <button
                type="button"
                className={`plant-picker-item${armedPlantId === plant.id ? ' armed' : ''}`}
                onClick={() => onArm(plant, plant.availableMethods[0])}
                title={plant.sowing.note || ''}
              >
                <PlantIcon icon={plant.icon} className="plant-icon" />
                <span>{plant.name}</span>
                <MethodBadge method={plant.availableMethods[0]} />
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

const METHOD_LABELS = { saatgut: 'Saatgut', setzling: 'Setzling' };

/** Kleines, nicht-interaktives Kennzeichen: zeigt an, ob eine Pflanze in diesem
 * Monat als Saatgut (Direktsaat) oder Setzling gilt — auch wenn nur eine der
 * beiden Methoden verfügbar ist (sonst wäre das nur bei MethodChoice sichtbar). */
function MethodBadge({ method }) {
  return <span className={`method-badge method-badge-${method}`}>{METHOD_LABELS[method]}</span>;
}

function MethodChoice({ plant, onArm, armed }) {
  return (
    <div className={`plant-picker-item plant-picker-item-multi${armed ? ' armed' : ''}`}>
      <PlantIcon icon={plant.icon} className="plant-icon" />
      <span>{plant.name}</span>
      <span className="method-buttons">
        {plant.availableMethods.map((method) => (
          <button key={method} type="button" onClick={() => onArm(plant, method)}>
            {METHOD_LABELS[method]}
          </button>
        ))}
      </span>
    </div>
  );
}
