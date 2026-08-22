/**
 * Weiche Warnung (Mischkultur/Fruchtfolge) mit "Trotzdem platzieren"-Bestätigung.
 * Rein beratend — im Unterschied zum harten 409 der Abstandsprüfung kann der
 * Anwender hier bewusst weitermachen.
 */
export default function GuidanceBanner({ companionWarnings = [], rotationWarnings = [], onConfirm, onCancel }) {
  if (companionWarnings.length === 0 && rotationWarnings.length === 0) return null;

  return (
    <div className="guidance-banner" role="alert">
      <p className="guidance-title">⚠ Diese Platzierung könnte problematisch sein:</p>
      <ul>
        {companionWarnings.map((w) => (
          <li key={`companion-${w.plantId}`}>
            Passt nicht gut zu <strong>{w.plantName}</strong> – {w.reason}
          </li>
        ))}
        {rotationWarnings.map((w, i) => (
          <li key={`rotation-${w.type}-${i}`}>{w.message}</li>
        ))}
      </ul>
      <div className="guidance-actions">
        <button type="button" onClick={onConfirm}>
          Trotzdem platzieren
        </button>
        <button type="button" className="secondary" onClick={onCancel}>
          Abbrechen
        </button>
      </div>
    </div>
  );
}
