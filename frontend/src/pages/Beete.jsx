import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api/client.js';
import BedCard from '../components/BedCard.jsx';
import BedForm from '../components/BedForm.jsx';

export default function Beete() {
  const { user, logout } = useAuth();
  const [beds, setBeds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingBed, setEditingBed] = useState(null); // null=zu (kein Formular), 'new', oder Bed-Objekt
  const [pendingDelete, setPendingDelete] = useState(null);

  function reload() {
    setLoading(true);
    api
      .listBeds()
      .then(({ beds }) => setBeds(beds))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(reload, []);

  async function handleCreate(data) {
    await api.createBed(data);
    setEditingBed(null);
    reload();
  }

  async function handleUpdate(data) {
    await api.updateBed(editingBed.id, data);
    setEditingBed(null);
    reload();
  }

  async function handleDelete(bed) {
    await api.deleteBed(bed.id);
    setPendingDelete(null);
    reload();
  }

  return (
    <main className="beete-page">
      <header>
        <h1>🌱 Beet-Manager</h1>
        <nav className="top-nav">
          <Link to="/kalender">Kalenderübersicht</Link>
          <Link to="/pflanzen">Mein Pflanzenkatalog</Link>
          <div className="user-bar">
            <span>{user?.email}</span>
            <button onClick={logout}>Abmelden</button>
          </div>
        </nav>
      </header>

      <div className="beete-toolbar">
        <h2>Meine Beete</h2>
        <button type="button" onClick={() => setEditingBed('new')}>
          + Neues Beet
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      {editingBed === 'new' && (
        <div className="panel">
          <h3>Neues Beet anlegen</h3>
          <BedForm onSubmit={handleCreate} onCancel={() => setEditingBed(null)} />
        </div>
      )}

      {editingBed && editingBed !== 'new' && (
        <div className="panel">
          <h3>Beet bearbeiten</h3>
          <BedForm initial={editingBed} onSubmit={handleUpdate} onCancel={() => setEditingBed(null)} />
        </div>
      )}

      {loading ? (
        <p className="loading">Lade Beete…</p>
      ) : beds.length === 0 ? (
        <p className="empty-hint">
          Noch keine Beete angelegt — leg dein erstes Beet an, um mit der Pflanzplanung zu starten.
        </p>
      ) : (
        <div className="bed-grid">
          {beds.map((bed) => (
            <BedCard key={bed.id} bed={bed} onEdit={setEditingBed} onDelete={setPendingDelete} />
          ))}
        </div>
      )}

      {pendingDelete && (
        <div className="modal-backdrop" onClick={() => setPendingDelete(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <p>
              "{pendingDelete.name}" wirklich löschen? Alle Pflanzungen in diesem Beet werden ebenfalls
              gelöscht.
            </p>
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
