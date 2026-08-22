import { useState } from 'react';

const EMPTY = { name: '', width_cm: 100, length_cm: 100, standort: 'sonne' };

export default function BedForm({ initial, onSubmit, onCancel }) {
  const [values, setValues] = useState(initial || EMPTY);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  function update(field, value) {
    setValues((v) => ({ ...v, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        name: values.name.trim(),
        width_cm: Number(values.width_cm),
        length_cm: Number(values.length_cm),
        standort: values.standort,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="bed-form" onSubmit={handleSubmit}>
      <label>
        Bezeichnung
        <input
          type="text"
          value={values.name}
          onChange={(e) => update('name', e.target.value)}
          required
        />
      </label>
      <div className="bed-form-dims">
        <label>
          Breite (cm)
          <input
            type="number"
            min="1"
            value={values.width_cm}
            onChange={(e) => update('width_cm', e.target.value)}
            required
          />
        </label>
        <label>
          Länge (cm)
          <input
            type="number"
            min="1"
            value={values.length_cm}
            onChange={(e) => update('length_cm', e.target.value)}
            required
          />
        </label>
      </div>
      <label>
        Standort
        <select value={values.standort} onChange={(e) => update('standort', e.target.value)}>
          <option value="sonne">Sonne</option>
          <option value="halbschatten">Halbschatten</option>
          <option value="schatten">Schatten</option>
        </select>
      </label>
      {error && <p className="error">{error}</p>}
      <div className="form-actions">
        <button type="submit" disabled={saving}>
          {saving ? 'Speichert…' : 'Speichern'}
        </button>
        <button type="button" className="secondary" onClick={onCancel}>
          Abbrechen
        </button>
      </div>
    </form>
  );
}
