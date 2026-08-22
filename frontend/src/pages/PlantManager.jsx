import { Link } from 'react-router-dom';
import { useState } from 'react';
import { api } from '../api/client.js';
import { usePlantCatalog } from '../context/PlantCatalogContext.jsx';
import PlantForm from '../components/PlantForm.jsx';
import PlantIcon from '../icons/PlantIcons.jsx';

const METHOD_LABELS = { saatgut: 'Saatgut', setzling: 'Setzling' };

/**
 * Verwaltung des eigenen Pflanzenkatalogs: bei der Registrierung wurde er mit
 * einer Kopie des Startkatalogs befüllt (s. backend/src/plantSeed.js) — hier
 * lässt er sich bearbeiten und um eigene Pflanzen erweitern. Gute/schlechte
 * Nachbarn werden dabei explizit gegen die eigene Liste gepflegt (s. PlantForm).
 */
export default function PlantManager() {
  const { plants, loading, error, reload } = usePlantCatalog();
  const [editing, setEditing] = useState(null); // null=zu, 'new', oder Plant-Objekt
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleteError, setDeleteError] = useState(null);

  async function handleCreate(data) {
    await api.createPlant(data);
    setEditing(null);
    reload();
  }

  async function handleUpdate(data) {
    await api.updatePlant(editing.id, data);
    setEditing(null);
    reload();
  }

  async function handleDelete(plant) {
    setDeleteError(null);
    try {
      await api.deletePlant(plant.id);
      setPendingDelete(null);
      reload();
    } catch (err) {
      setDeleteError(err.message);
    }
  }

  const sorted = [...plants].sort((a, b) => a.name.localeCompare(b.name, 'de'));

  return (
    <main className="plant-manager-page">
      <header>
        <Link to="/" className="back-link">
          ← Meine Beete
        </Link>
        <h1>Mein Pflanzenkatalog</h1>
      </header>

      <p className="hint">
        Dein Katalog startet als Kopie unserer recherchierten Pflanzendaten. Du kannst jeden Eintrag
        bearbeiten und eigenes Saatgut/eigene Setzlinge hinzufügen — deine Änderungen betreffen nur
        deinen eigenen Katalog.
      </p>

      <div className="plant-manager-toolbar">
        <button type="button" onClick={() => setEditing('new')}>
          + Neue Pflanze
        </button>
      </div>

      {error && <p className="error">{error}</p>}
      {deleteError && <p className="error">{deleteError}</p>}

      {editing && (
        <div className="panel">
          <h3>{editing === 'new' ? 'Neue Pflanze anlegen' : `„${editing.name}“ bearbeiten`}</h3>
          <PlantForm
            plant={editing === 'new' ? null : editing}
            otherPlants={plants}
            onSubmit={editing === 'new' ? handleCreate : handleUpdate}
            onCancel={() => setEditing(null)}
          />
        </div>
      )}

      {loading ? (
        <p className="loading">Lade Pflanzenkatalog…</p>
      ) : (
        <div className="plant-manager-list">
          {sorted.map((plant) => (
            <div key={plant.id} className="plant-manager-row">
              <PlantIcon icon={plant.icon} className="plant-icon" />
              <div className="plant-manager-info">
                <strong>{plant.name}</strong>
                {!plant.isBuiltin && <span className="custom-badge">Eigene</span>}
                <span className="plant-manager-meta">
                  {plant.methods.map((m) => METHOD_LABELS[m]).join(' · ')} · {plant.zehrertyp} ·{' '}
                  {plant.spacingMinCm}
                  {plant.spacingMaxCm ? `–${plant.spacingMaxCm}` : ''} cm
                  {plant.familyLabel ? ` · ${plant.familyLabel}` : ''}
                </span>
              </div>
              <div className="plant-manager-actions">
                <button type="button" className="secondary" onClick={() => setEditing(plant)}>
                  Bearbeiten
                </button>
                <button type="button" className="danger" onClick={() => setPendingDelete(plant)}>
                  Löschen
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {pendingDelete && (
        <div className="modal-backdrop" onClick={() => setPendingDelete(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <p>„{pendingDelete.name}“ wirklich aus deinem Katalog löschen?</p>
            <div className="form-actions">
              <button type="button" className="danger" onClick={() => handleDelete(pendingDelete)}>
                Löschen
              </button>
              <button type="button" className="secondary" onClick={() => setPendingDelete(null)}>
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
