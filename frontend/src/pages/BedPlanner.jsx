import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { usePlantCatalog } from '../context/PlantCatalogContext.jsx';
import { filterNearby, getCompanionWarnings } from 'shared/src/companions.js';
import { getRotationWarnings } from 'shared/src/rotation.js';
import { computeOccupancy } from 'shared/src/timing.js';
import BedCanvas from '../components/BedCanvas.jsx';
import PlantPicker from '../components/PlantPicker.jsx';
import PlantTooltip from '../components/PlantTooltip.jsx';
import MonthSelector from '../components/MonthSelector.jsx';
import GuidanceBanner from '../components/GuidanceBanner.jsx';
import BedInfoPanel from '../components/BedInfoPanel.jsx';
import CalendarView from '../components/CalendarView.jsx';
import HistoryForm from '../components/HistoryForm.jsx';
import BedPrintSheet from '../components/BedPrintSheet.jsx';

const TABS = { PLANNER: 'planner', CALENDAR: 'kalender', HISTORY: 'historie' };

export default function BedPlanner() {
  const { bedId } = useParams();
  const { plants, plantsById, loading: catalogLoading } = usePlantCatalog();

  const [bed, setBed] = useState(null);
  const [plantings, setPlantings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState(TABS.PLANNER);

  const now = new Date();
  const [planYear, setPlanYear] = useState(now.getFullYear());
  const [planMonth, setPlanMonth] = useState(now.getMonth() + 1);

  const [armed, setArmed] = useState(null); // { plant, method }
  const [moving, setMoving] = useState(null); // planting, das gerade verschoben wird
  const [selectedPlantingId, setSelectedPlantingId] = useState(null);
  const [pendingCandidate, setPendingCandidate] = useState(null); // { x_cm, y_cm, warnings }
  const [saveError, setSaveError] = useState(null);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);

  // reload() läuft nach jeder Platzierung/Verschiebung/Löschung — bei bewaffnet
  // bleibender Pflanze (mehrere Platzierungen hintereinander) also sehr oft.
  // Der volle "Lade Beet…"-Ladebildschirm (s. u.) darf deshalb NUR beim allerersten
  // Laden erscheinen, nicht bei jedem Hintergrund-Reload — sonst würde die ganze
  // Seite bei jedem Klick kurz durch den Ladetext ersetzt ("flackern").
  function reload() {
    Promise.all([api.getBed(bedId), api.listPlantings(bedId)])
      .then(([bedRes, plantingsRes]) => {
        setBed(bedRes.bed);
        setPlantings(plantingsRes.plantings);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  // Der volle "Lade Beet…"-Ladebildschirm (s. u.) erscheint bewusst NUR beim
  // erstmaligen Öffnen eines Beets (bedId ändert sich), gesteuert allein hier —
  // reload() selbst setzt loading nie auf true. reload() läuft sonst nach jeder
  // Platzierung/Verschiebung/Löschung, bei bewaffnet bleibender Pflanze (mehrere
  // Platzierungen hintereinander) also sehr oft; würde reload() dabei jedes Mal
  // den Ladebildschirm zeigen, würde die ganze Seite bei jedem Klick kurz durch
  // den Ladetext ersetzt ("flackern").
  useEffect(() => {
    setLoading(true);
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bedId]);

  const selectedPlanting = plantings.find((p) => p.id === selectedPlantingId) || null;

  function handleArm(plant, method) {
    setMoving(null);
    setSelectedPlantingId(null);
    setArmed({ plant, method });
  }

  function handleMarkerClick(planting) {
    setArmed(null);
    setMoving(null);
    setSelectedPlantingId(planting.id);
  }

  function startMove(planting) {
    const plant = plantsById[planting.plant_id];
    if (!plant) return;
    setSelectedPlantingId(null);
    setMoving(planting);
    setArmed({ plant, method: planting.method });
  }

  async function handleRemove(plantingId) {
    await api.deletePlanting(bedId, plantingId);
    setSelectedPlantingId(null);
    reload();
  }

  async function handleDeleteAll() {
    setDeletingAll(true);
    try {
      await Promise.all(plantings.map((p) => api.deletePlanting(bedId, p.id)));
      setArmed(null);
      setMoving(null);
      setSelectedPlantingId(null);
      setConfirmDeleteAll(false);
      reload();
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setDeletingAll(false);
    }
  }

  function handleCandidateConfirmed(x_cm, y_cm) {
    if (!armed) return;
    setSaveError(null);

    const excludeId = moving?.id ?? null;
    const candidate = { plant_id: armed.plant.id, x_cm, y_cm };
    const candidateOccupancy = computeOccupancy({ year: planYear, month: planMonth }, armed.plant);
    const candidateEnd = candidateOccupancy.bedFreeAbs - 1;

    const others = plantings.filter((p) => p.id !== excludeId);

    // Mischkultur betrifft nur Pflanzen, die zeitgleich im Beet stehen ("nahe UND
    // überlappende Pflanzungen", s. PLAN.md) — zwei zeitgleich gepflanzte Erdbeeren
    // nebeneinander sind keine Mischkultur-Kollision, sondern dieselbe Kultur.
    const concurrent = others.filter((p) => {
      const plant = plantsById[p.plant_id];
      if (!plant) return false;
      const occ = computeOccupancy(p, plant);
      const rowEnd = occ.bedFreeAbs - 1;
      return candidateOccupancy.sowAbs <= rowEnd && occ.sowAbs <= candidateEnd;
    });

    // Fruchtfolge betrifft umgekehrt nur die "Beet-Historie", also Pflanzungen, die
    // NICHT zeitgleich mit der Kandidatin stehen — sonst würde jede zweite Pflanze
    // derselben Familie im selben Jahr fälschlich als "zu früh wiederholt" gelten.
    const history = others.filter((p) => !concurrent.includes(p));

    const nearby = filterNearby(
      candidate,
      concurrent.filter((p) => p.x_cm != null && p.y_cm != null),
      plantsById,
    );
    const companionWarnings = getCompanionWarnings(
      armed.plant.id,
      nearby.map((p) => p.plant_id),
      plantsById,
    );
    const rotationWarnings = getRotationWarnings(history, armed.plant, planYear);

    if (companionWarnings.length > 0 || rotationWarnings.length > 0) {
      setPendingCandidate({ x_cm, y_cm, companionWarnings, rotationWarnings });
    } else {
      commitPlacement(x_cm, y_cm);
    }
  }

  async function commitPlacement(x_cm, y_cm) {
    setPendingCandidate(null);
    const payload = { plant_id: armed.plant.id, method: armed.method, year: planYear, month: planMonth, x_cm, y_cm };
    try {
      if (moving) {
        await api.updatePlanting(bedId, moving.id, { ...payload, notes: moving.notes });
        // Verschieben ist ein einmaliger Vorgang — danach wieder unbewaffnet.
        setArmed(null);
        setMoving(null);
      } else {
        await api.createPlanting(bedId, payload);
        // Bewaffnete Pflanze bleibt aktiv: direkt weiterklicken pflanzt dieselbe
        // Pflanze erneut, ohne sie im PlantPicker neu auswählen zu müssen.
      }
      reload();
    } catch (err) {
      setSaveError(err.message + (err.conflicts ? ` (${err.conflicts.map((c) => c.plantName).join(', ')})` : ''));
    }
  }

  async function handleHistorySubmit(data) {
    await api.createPlanting(bedId, data);
    reload();
  }

  const bedHistoryForInfo = useMemo(
    () => plantings.filter((p) => p.year === planYear || computeOccupancyTouchesYear(p, plantsById, planYear)),
    [plantings, plantsById, planYear],
  );

  if (loading || catalogLoading) return <p className="loading">Lade Beet…</p>;
  if (error) return <p className="error">{error}</p>;
  if (!bed) return <p className="error">Beet nicht gefunden.</p>;

  return (
    <main className="bed-planner-page">
      <div className="no-print">
      <header>
        <Link to="/" className="back-link">
          ← Meine Beete
        </Link>
        <h1>{bed.name}</h1>
        <p className="bed-meta">
          {bed.width_cm} × {bed.length_cm} cm
        </p>
        <button type="button" className="secondary" onClick={() => window.print()}>
          🖨️ Drucken / als PDF speichern
        </button>
      </header>

      <nav className="tab-bar">
        <button className={tab === TABS.PLANNER ? 'active' : ''} onClick={() => setTab(TABS.PLANNER)}>
          Planer
        </button>
        <button className={tab === TABS.CALENDAR ? 'active' : ''} onClick={() => setTab(TABS.CALENDAR)}>
          Kalender
        </button>
        <button className={tab === TABS.HISTORY ? 'active' : ''} onClick={() => setTab(TABS.HISTORY)}>
          Historie nachtragen
        </button>
      </nav>

      {tab === TABS.PLANNER && (
        <div className="planner-layout">
          <div className="planner-sidebar">
            <MonthSelector year={planYear} month={planMonth} onChange={({ year, month }) => { setPlanYear(year); setPlanMonth(month); }} />
            <PlantPicker plants={plants} month={planMonth} standort={bed.standort} onArm={handleArm} armedPlantId={armed?.plant.id} />
            {armed && (
              <p className="armed-hint">
                {moving ? 'Verschieben' : 'Platzieren'}: <strong>{armed.plant.name}</strong> — Klick ins Beet.
                <button type="button" className="link-button" onClick={() => { setArmed(null); setMoving(null); }}>
                  Abbrechen
                </button>
              </p>
            )}
            {saveError && <p className="error">{saveError}</p>}

            {pendingCandidate && (
              <GuidanceBanner
                companionWarnings={pendingCandidate.companionWarnings}
                rotationWarnings={pendingCandidate.rotationWarnings}
                onConfirm={() => commitPlacement(pendingCandidate.x_cm, pendingCandidate.y_cm)}
                onCancel={() => setPendingCandidate(null)}
              />
            )}

            {selectedPlanting && plantsById[selectedPlanting.plant_id] && (
              <PlantTooltip
                plant={plantsById[selectedPlanting.plant_id]}
                onClose={() => setSelectedPlantingId(null)}
                onMove={selectedPlanting.method !== 'historisch' ? () => startMove(selectedPlanting) : null}
                onRemove={() => handleRemove(selectedPlanting.id)}
              />
            )}

            <div className="bed-info-header">
              <h3>Pflanzungen</h3>
              {plantings.length > 0 && (
                <button type="button" className="danger small" onClick={() => setConfirmDeleteAll(true)}>
                  Alle löschen
                </button>
              )}
            </div>
            <BedInfoPanel plantings={bedHistoryForInfo} plantsById={plantsById} onRemove={handleRemove} />
          </div>

          <div className="planner-canvas-area">
            <BedCanvas
              bed={bed}
              plantings={plantings}
              plantsById={plantsById}
              year={planYear}
              month={planMonth}
              armed={armed}
              excludePlantingId={moving?.id}
              selectedPlantingId={selectedPlantingId}
              onCandidateConfirmed={handleCandidateConfirmed}
              onMarkerClick={handleMarkerClick}
            />
          </div>
        </div>
      )}

      {tab === TABS.CALENDAR && (
        <div className="panel">
          <MonthSelector
            year={planYear}
            month={planMonth}
            onChange={({ year, month }) => { setPlanYear(year); setPlanMonth(month); }}
          />
          <CalendarView plantings={plantings} plantsById={plantsById} year={planYear} />
        </div>
      )}

      {tab === TABS.HISTORY && (
        <div className="panel">
          <HistoryForm plants={plants} onSubmit={handleHistorySubmit} onCancel={() => setTab(TABS.PLANNER)} />
        </div>
      )}

      {confirmDeleteAll && (
        <div className="modal-backdrop" onClick={() => setConfirmDeleteAll(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <p>
              Wirklich alle {plantings.length} Pflanzung{plantings.length === 1 ? '' : 'en'} in diesem Beet
              löschen? Das kann nicht rückgängig gemacht werden.
            </p>
            <div className="form-actions">
              <button type="button" className="danger" onClick={handleDeleteAll} disabled={deletingAll}>
                {deletingAll ? 'Löscht…' : 'Alle löschen'}
              </button>
              <button type="button" className="secondary" onClick={() => setConfirmDeleteAll(false)}>
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}
      </div>

      <BedPrintSheet bed={bed} plantings={bedHistoryForInfo} plantsById={plantsById} />
    </main>
  );
}

function computeOccupancyTouchesYear(planting, plantsById, year) {
  const plant = plantsById[planting.plant_id];
  if (!plant) return false;
  const occ = computeOccupancy(planting, plant);
  const yearStart = year * 12;
  return occ.sowAbs <= yearStart + 11 && occ.bedFreeAbs - 1 >= yearStart;
}
