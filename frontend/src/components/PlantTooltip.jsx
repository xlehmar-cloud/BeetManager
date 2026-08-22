import PlantIcon from '../icons/PlantIcons.jsx';

/**
 * Detail-Popover für eine Pflanze — Familie, Zehrertyp, Abstand, Nachbarn,
 * Aussaat-/Erntetext. Wird sowohl beim Hover/Klick auf einen PlantMarker als
 * auch (optional) direkt im PlantPicker verwendet.
 */
export default function PlantTooltip({ plant, onClose, onRemove, onMove }) {
  if (!plant) return null;

  return (
    <div className="plant-tooltip" role="dialog">
      <header>
        <PlantIcon icon={plant.icon} className="plant-icon" />
        <h3>{plant.name}</h3>
        {onClose && (
          <button type="button" className="tooltip-close" onClick={onClose} aria-label="Schließen">
            ×
          </button>
        )}
      </header>
      <dl>
        <dt>Familie</dt>
        <dd>{plant.familyLabel}</dd>
        <dt>Zehrertyp</dt>
        <dd className={`zehrertyp zehrertyp-${plant.zehrertyp}`}>{plant.zehrertyp}</dd>
        <dt>Mindestabstand</dt>
        <dd>
          {plant.spacingMinCm}–{plant.spacingMaxCm} cm
        </dd>
        {plant.sowing?.note && (
          <>
            <dt>Aussaat/Pflanzung</dt>
            <dd>{plant.sowing.note}</dd>
          </>
        )}
        {plant.harvest?.note && (
          <>
            <dt>Ernte</dt>
            <dd>{plant.harvest.note}</dd>
          </>
        )}
      </dl>
      {plant.companions?.good?.length > 0 && (
        <p className="companions-good">
          <strong>Gute Nachbarn:</strong> {plant.companions.good.length}
        </p>
      )}
      <div className="plant-tooltip-actions">
        {onMove && (
          <button type="button" className="secondary" onClick={onMove}>
            Verschieben
          </button>
        )}
        {onRemove && (
          <button type="button" className="danger" onClick={onRemove}>
            Entfernen
          </button>
        )}
      </div>
    </div>
  );
}
