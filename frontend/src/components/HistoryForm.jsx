import { useState } from 'react';
import { MONTH_NAMES } from './MonthSelector.jsx';

/**
 * Einfacher "Vorjahres-Bepflanzung nachtragen"-Modus: Pflanze + Jahr + Monat,
 * ohne exakten Positions-Picker (method='historisch', x_cm/y_cm bleiben leer) —
 * damit die Fruchtfolge-Warnung schon im ersten Nutzungsjahr greift.
 */
export default function HistoryForm({ plants, onSubmit, onCancel }) {
  const currentYear = new Date().getFullYear();
  const [plantId, setPlantId] = useState(plants[0]?.id || '');
  const [year, setYear] = useState(currentYear - 1);
  const [month, setMonth] = useState(5);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!plantId) {
      setError('Bitte eine Pflanze auswählen.');
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await onSubmit({ plant_id: Number(plantId), method: 'historisch', year, month, notes });
      // Formular bleibt offen (mehrere Nachträge hintereinander sind der Regelfall),
      // aber ohne Rückmeldung wirkte ein erfolgreicher Eintrag wie "nichts passiert" —
      // insbesondere weil er in der Pflanzungen-Liste erst sichtbar wird, wenn dort
      // das betreffende Jahr ausgewählt ist. Die Bestätigung + Liste unten (s.
      // BedPlanner) geben sofortiges Feedback unabhängig vom aktuell gewählten Jahr.
      setNotes('');
      setSuccess(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="history-form" onSubmit={handleSubmit}>
      <h3>Vergangene Bepflanzung nachtragen</h3>
      <p className="hint">
        Ohne genaue Position — reicht, damit die Fruchtfolge-Prüfung diese Bepflanzung kennt.
      </p>
      <label>
        Pflanze
        <select value={plantId} onChange={(e) => { setPlantId(e.target.value); setSuccess(false); }}>
          {plants.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Jahr
        <input
          type="number"
          value={year}
          onChange={(e) => { setYear(Number(e.target.value)); setSuccess(false); }}
          min="2000"
          max="2100"
        />
      </label>
      <label>
        Monat
        <select value={month} onChange={(e) => { setMonth(Number(e.target.value)); setSuccess(false); }}>
          {MONTH_NAMES.map((name, idx) => (
            <option key={name} value={idx + 1}>
              {name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Notiz (optional)
        <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>
      {error && <p className="error">{error}</p>}
      {success && !error && <p className="success">✓ Eingetragen — siehe Liste unten.</p>}
      <div className="form-actions">
        <button type="submit" disabled={saving}>
          {saving ? 'Speichert…' : 'Eintragen'}
        </button>
        <button type="button" className="secondary" onClick={onCancel}>
          Abbrechen
        </button>
      </div>
    </form>
  );
}
