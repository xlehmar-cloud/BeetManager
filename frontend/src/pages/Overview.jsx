import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { usePlantCatalog } from '../context/PlantCatalogContext.jsx';
import CalendarView from '../components/CalendarView.jsx';

/**
 * Beetübergreifende Kalenderübersicht: alle Pflanzungen des Users über alle
 * Beete, nach Beetname gruppiert. Nutzt GET /api/plantings.
 */
export default function Overview() {
  const { plantsById, loading: catalogLoading } = usePlantCatalog();
  const [plantings, setPlantings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [year, setYear] = useState(new Date().getFullYear());

  useEffect(() => {
    setLoading(true);
    api
      .listAllPlantings()
      .then(({ plantings }) => setPlantings(plantings))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 6 }, (_, i) => currentYear - 2 + i);

  return (
    <main className="overview-page">
      <header>
        <Link to="/" className="back-link">
          ← Meine Beete
        </Link>
        <h1>Kalenderübersicht</h1>
      </header>

      <label className="year-select">
        Jahr
        <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </label>

      {error && <p className="error">{error}</p>}
      {loading || catalogLoading ? (
        <p className="loading">Lade…</p>
      ) : plantings.length === 0 ? (
        <p className="empty-hint">Noch keine Pflanzungen erfasst.</p>
      ) : (
        <div className="panel">
          <CalendarView plantings={plantings} plantsById={plantsById} year={year} groupByBedName />
        </div>
      )}
    </main>
  );
}
