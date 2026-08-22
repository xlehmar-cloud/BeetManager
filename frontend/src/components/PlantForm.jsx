import { useState } from 'react';
import { MONTH_NAMES } from './MonthSelector.jsx';
import PlantIcon from '../icons/PlantIcons.jsx';

// Dieselben 10 Familien wie im Startkatalog (s. backend/src/plantSeed.js#FAMILIES)
// — als feste Auswahl statt Freitext, damit die Fruchtfolge-Prüfung (String-
// Vergleich) auch zwischen eigenen und mitgelieferten Pflanzen zuverlässig
// funktioniert.
const FAMILIES = [
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

const ICONS = [
  ['fruit', 'Frucht'],
  ['root', 'Wurzel'],
  ['leaf', 'Blatt'],
  ['legume', 'Hülsenfrucht'],
  ['herb', 'Kraut'],
  ['berry', 'Beere'],
  ['tuber', 'Knolle'],
  ['stalk', 'Stängel'],
];

const STANDORTE = [
  ['sonne', 'Sonne'],
  ['halbschatten', 'Halbschatten'],
  ['schatten', 'Schatten'],
];

function plantToFormValues(plant) {
  if (!plant) {
    return {
      name: '',
      icon: 'leaf',
      zehrertyp: 'mittel',
      family: '',
      standort: ['sonne'],
      methods: ['saatgut'],
      sowingDirectFrom: 3,
      sowingDirectTo: 6,
      sowingTransplantFrom: 4,
      sowingTransplantTo: 6,
      germinationDaysMin: '',
      germinationDaysMax: '',
      harvestFromMonth: 6,
      harvestToMonth: 9,
      spacingMinCm: 30,
      spacingMaxCm: '',
      rotationGapYears: 4,
      companionsGood: [],
      companionsBad: [],
    };
  }
  return {
    name: plant.name,
    icon: plant.icon || 'leaf',
    zehrertyp: plant.zehrertyp,
    family: plant.family || '',
    standort: plant.standort,
    methods: plant.methods,
    sowingDirectFrom: plant.sowing.direct[0] ?? 3,
    sowingDirectTo: plant.sowing.direct[plant.sowing.direct.length - 1] ?? 6,
    sowingTransplantFrom: plant.sowing.transplant[0] ?? 4,
    sowingTransplantTo: plant.sowing.transplant[plant.sowing.transplant.length - 1] ?? 6,
    germinationDaysMin: plant.germination?.daysMin ?? '',
    germinationDaysMax: plant.germination?.daysMax ?? '',
    // Bei Pflanzen, deren Ernte noch im alten "Tage nach Aussaat"-Format
    // hinterlegt ist (aus dem Startkatalog geerbt), gibt es keinen Monatsbereich
    // zum Vorbelegen — dann auf einen neutralen Platzhalter zurückfallen; wird
    // beim Speichern über dieses Formular ohnehin auf den Monatsbereich
    // umgestellt (s. PLANTS_SCHEMA.md-Nachfolgekonzept in userPlants.js).
    harvestFromMonth: plant.harvest.startMonth ?? 6,
    harvestToMonth: plant.harvest.endMonth ?? 9,
    spacingMinCm: plant.spacingMinCm,
    spacingMaxCm: plant.spacingMaxCm ?? '',
    rotationGapYears: plant.rotationGapYears ?? 4,
    companionsGood: plant.companions.good,
    companionsBad: plant.companions.bad,
  };
}

/**
 * Formular zum Anlegen/Bearbeiten einer Pflanze im eigenen Katalog. Gute/
 * schlechte Nachbarn werden explizit gegen die eigene Pflanzenliste gepflegt
 * (kein automatisches Raten der Botanik) — bei "schlecht" zusätzlich ein Grund,
 * genau wie im mitgelieferten Startkatalog.
 */
export default function PlantForm({ plant, otherPlants, onSubmit, onCancel }) {
  const [values, setValues] = useState(() => plantToFormValues(plant));
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  function update(field, value) {
    setValues((v) => ({ ...v, [field]: value }));
  }

  function toggleInArray(field, value) {
    setValues((v) => ({
      ...v,
      [field]: v[field].includes(value) ? v[field].filter((x) => x !== value) : [...v[field], value],
    }));
  }

  function toggleGood(id) {
    setValues((v) => ({
      ...v,
      companionsGood: v.companionsGood.includes(id)
        ? v.companionsGood.filter((x) => x !== id)
        : [...v.companionsGood, id],
    }));
  }

  function toggleBad(id) {
    setValues((v) => ({
      ...v,
      companionsBad: v.companionsBad.some((b) => b.id === id)
        ? v.companionsBad.filter((b) => b.id !== id)
        : [...v.companionsBad, { id, reason: '' }],
    }));
  }

  function setBadReason(id, reason) {
    setValues((v) => ({
      ...v,
      companionsBad: v.companionsBad.map((b) => (b.id === id ? { ...b, reason } : b)),
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        name: values.name.trim(),
        icon: values.icon,
        zehrertyp: values.zehrertyp,
        family: values.family || null,
        standort: values.standort,
        methods: values.methods,
        sowingDirectFrom: values.methods.includes('saatgut') ? Number(values.sowingDirectFrom) : null,
        sowingDirectTo: values.methods.includes('saatgut') ? Number(values.sowingDirectTo) : null,
        sowingTransplantFrom: values.methods.includes('setzling') ? Number(values.sowingTransplantFrom) : null,
        sowingTransplantTo: values.methods.includes('setzling') ? Number(values.sowingTransplantTo) : null,
        germinationDaysMin: values.germinationDaysMin === '' ? null : Number(values.germinationDaysMin),
        germinationDaysMax: values.germinationDaysMax === '' ? null : Number(values.germinationDaysMax),
        harvestFromMonth: Number(values.harvestFromMonth),
        harvestToMonth: Number(values.harvestToMonth),
        spacingMinCm: Number(values.spacingMinCm),
        spacingMaxCm: values.spacingMaxCm === '' ? null : Number(values.spacingMaxCm),
        rotationGapYears: Number(values.rotationGapYears),
        companionsGood: values.companionsGood,
        companionsBad: values.companionsBad,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const pickableCompanions = otherPlants.filter((p) => p.id !== plant?.id);

  return (
    <form className="plant-form" onSubmit={handleSubmit}>
      <div className="plant-form-grid">
        <label>
          Bezeichnung
          <input type="text" value={values.name} onChange={(e) => update('name', e.target.value)} required />
        </label>

        <label>
          Symbol
          <span className="icon-select-row">
            <PlantIcon icon={values.icon} className="plant-icon" />
            <select value={values.icon} onChange={(e) => update('icon', e.target.value)}>
              {ICONS.map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </span>
        </label>

        <label>
          Zehrertyp
          <select value={values.zehrertyp} onChange={(e) => update('zehrertyp', e.target.value)}>
            <option value="stark">Starkzehrer</option>
            <option value="mittel">Mittelzehrer</option>
            <option value="schwach">Schwachzehrer</option>
          </select>
        </label>

        <label>
          Pflanzenfamilie (für Fruchtfolge-Hinweise, optional)
          <select value={values.family} onChange={(e) => update('family', e.target.value)}>
            <option value="">Keine/unbekannt</option>
            {FAMILIES.map(([slug, label]) => (
              <option key={slug} value={slug}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <fieldset>
        <legend>Standort</legend>
        {STANDORTE.map(([key, label]) => (
          <label key={key} className="checkbox-label">
            <input
              type="checkbox"
              checked={values.standort.includes(key)}
              onChange={() => toggleInArray('standort', key)}
            />
            {label}
          </label>
        ))}
      </fieldset>

      <fieldset>
        <legend>Typ</legend>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={values.methods.includes('saatgut')}
            onChange={() => toggleInArray('methods', 'saatgut')}
          />
          Saatgut (Direktsaat)
        </label>
        {values.methods.includes('saatgut') && (
          <div className="month-range-row">
            <MonthRangeSelect
              fromLabel="Aussaat von"
              toLabel="bis"
              from={values.sowingDirectFrom}
              to={values.sowingDirectTo}
              onChange={(from, to) => setValues((v) => ({ ...v, sowingDirectFrom: from, sowingDirectTo: to }))}
            />
            <span className="germination-fields">
              Keimdauer (optional):
              <input
                type="number"
                min="1"
                placeholder="von Tagen"
                value={values.germinationDaysMin}
                onChange={(e) => update('germinationDaysMin', e.target.value)}
              />
              <input
                type="number"
                min="1"
                placeholder="bis Tagen"
                value={values.germinationDaysMax}
                onChange={(e) => update('germinationDaysMax', e.target.value)}
              />
            </span>
          </div>
        )}

        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={values.methods.includes('setzling')}
            onChange={() => toggleInArray('methods', 'setzling')}
          />
          Setzling
        </label>
        {values.methods.includes('setzling') && (
          <div className="month-range-row">
            <MonthRangeSelect
              fromLabel="Pflanzung von"
              toLabel="bis"
              from={values.sowingTransplantFrom}
              to={values.sowingTransplantTo}
              onChange={(from, to) =>
                setValues((v) => ({ ...v, sowingTransplantFrom: from, sowingTransplantTo: to }))
              }
            />
          </div>
        )}
      </fieldset>

      <fieldset>
        <legend>Erntezeitraum</legend>
        <MonthRangeSelect
          fromLabel="von"
          toLabel="bis"
          from={values.harvestFromMonth}
          to={values.harvestToMonth}
          onChange={(from, to) => setValues((v) => ({ ...v, harvestFromMonth: from, harvestToMonth: to }))}
        />
      </fieldset>

      <fieldset>
        <legend>Abstand der ausgewachsenen Pflanze</legend>
        <div className="plant-form-dims">
          <label>
            Mindestabstand (cm)
            <input
              type="number"
              min="1"
              value={values.spacingMinCm}
              onChange={(e) => update('spacingMinCm', e.target.value)}
              required
            />
          </label>
          <label>
            Höchstabstand (cm, optional)
            <input
              type="number"
              min="1"
              value={values.spacingMaxCm}
              onChange={(e) => update('spacingMaxCm', e.target.value)}
            />
          </label>
          <label>
            Fruchtfolge-Pause (Jahre)
            <input
              type="number"
              min="1"
              value={values.rotationGapYears}
              onChange={(e) => update('rotationGapYears', e.target.value)}
            />
          </label>
        </div>
      </fieldset>

      {pickableCompanions.length > 0 && (
        <fieldset>
          <legend>Gute Nachbarn</legend>
          <div className="companion-checklist">
            {pickableCompanions.map((p) => (
              <label key={p.id} className="checkbox-label">
                <input
                  type="checkbox"
                  checked={values.companionsGood.includes(p.id)}
                  onChange={() => toggleGood(p.id)}
                />
                {p.name}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {pickableCompanions.length > 0 && (
        <fieldset>
          <legend>Schlechte Nachbarn</legend>
          <div className="companion-checklist">
            {pickableCompanions.map((p) => {
              const bad = values.companionsBad.find((b) => b.id === p.id);
              return (
                <div key={p.id} className="companion-bad-row">
                  <label className="checkbox-label">
                    <input type="checkbox" checked={!!bad} onChange={() => toggleBad(p.id)} />
                    {p.name}
                  </label>
                  {bad && (
                    <input
                      type="text"
                      className="companion-bad-reason"
                      placeholder="Grund (z.B. teilen sich Krankheiten)"
                      value={bad.reason}
                      onChange={(e) => setBadReason(p.id, e.target.value)}
                      required
                    />
                  )}
                </div>
              );
            })}
          </div>
        </fieldset>
      )}

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

function MonthRangeSelect({ fromLabel, toLabel, from, to, onChange }) {
  return (
    <span className="month-range-select">
      {fromLabel}
      <select value={from} onChange={(e) => onChange(Number(e.target.value), to)}>
        {MONTH_NAMES.map((name, idx) => (
          <option key={name} value={idx + 1}>
            {name}
          </option>
        ))}
      </select>
      {toLabel}
      <select value={to} onChange={(e) => onChange(from, Number(e.target.value))}>
        {MONTH_NAMES.map((name, idx) => (
          <option key={name} value={idx + 1}>
            {name}
          </option>
        ))}
      </select>
    </span>
  );
}
