import { useMemo, useRef, useState } from 'react';
import { absoluteMonth, computeOccupancy } from 'shared/src/timing.js';
import { checkPlacement, isCenterWithinBed, isWithinBedBounds, radiusFor } from 'shared/src/spacing.js';
import PlantMarker from './PlantMarker.jsx';

/**
 * Reines inline <svg viewBox="0 0 {width_cm} {length_cm}"> — 1 SVG-Einheit = 1 cm,
 * reale Koordinaten brauchen keine manuelle Skalierung; CSS macht es responsiv,
 * viewBox erhält das reale Seitenverhältnis.
 *
 * Interaktion (klickbasiert, kein Drag&Drop):
 * 1. `armed` (Pflanze+Methode) kommt vom PlantPicker über den Elternknoten.
 * 2. Mausbewegung berechnet cm-Koordinaten, zeigt Geister-Marker + Abstandsring,
 *    sofort clientseitig grün/rot via shared/spacing.js gegen bereits geladene,
 *    zeitlich überlappende Pflanzungen (kein Netzwerk-Roundtrip pro Mausbewegung).
 *    Rot bedeutet nicht zwingend blockiert: ragt nur der Radius über den
 *    Beetrand hinaus, wird trotzdem geklickt werden können (Rand-Bepflanzung
 *    ist erlaubt, der überstehende Teil wird abgeschnitten dargestellt) — nur
 *    ein echter Mindestabstands-Konflikt mit einer anderen Pflanze blockiert.
 * 3. Klick auf zulässiger Stelle → onCandidateConfirmed(x_cm, y_cm); der
 *    Elternknoten (BedPlanner) übernimmt Mischkultur-/Fruchtfolge-Warnung +
 *    tatsächliches Speichern (Server validiert autoritativ erneut).
 * 4. Klick auf einen bestehenden Marker → onMarkerClick(planting) (Auswahl,
 *    von dort aus "Verschieben"/"Entfernen" im PlantTooltip des Elternknotens).
 */
export default function BedCanvas({
  bed,
  plantings,
  plantsById,
  year,
  month,
  armed, // { plant, method } | null — bewaffnete Neu-Platzierung ODER Verschiebung
  excludePlantingId, // bei Verschiebung: die eigene Pflanzung von der Prüfung ausnehmen
  selectedPlantingId,
  onCandidateConfirmed,
  onMarkerClick,
}) {
  const svgRef = useRef(null);
  const [ghost, setGhost] = useState(null); // { x, y, radius, ok, overflowsEdge }
  const clipId = `bed-clip-${bed.id}`;

  const candidateOccupancy = useMemo(() => {
    if (!armed) return null;
    return computeOccupancy({ year, month }, armed.plant);
  }, [armed, year, month]);

  const concurrentPlacements = useMemo(() => {
    if (!armed) return [];
    const candidateEnd = candidateOccupancy.bedFreeAbs - 1;
    return plantings
      .filter((p) => p.x_cm != null && p.y_cm != null && p.id !== excludePlantingId)
      .filter((p) => {
        const plant = plantsById[p.plant_id];
        if (!plant) return false;
        const occ = computeOccupancy(p, plant);
        const rowEnd = occ.bedFreeAbs - 1;
        return candidateOccupancy.sowAbs <= rowEnd && occ.sowAbs <= candidateEnd;
      })
      .map((p) => ({ id: p.id, plant_id: p.plant_id, plant_name: p.plant_name_snapshot, x_cm: p.x_cm, y_cm: p.y_cm }));
  }, [armed, plantings, plantsById, excludePlantingId, candidateOccupancy]);

  function clientToCm(evt) {
    const svg = svgRef.current;
    const rect = svg.getBoundingClientRect();
    const scaleX = bed.width_cm / rect.width;
    const scaleY = bed.length_cm / rect.height;
    const x = (evt.clientX - rect.left) * scaleX;
    const y = (evt.clientY - rect.top) * scaleY;
    return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
  }

  /**
   * Wertet eine Cursor-Position gegen Randregel + Abstandsprüfung aus. Wird von
   * mousemove (Ghost-Vorschau) UND click (tatsächliche Platzierung) genutzt —
   * der Klick-Handler verlässt sich bewusst NICHT auf den zuvor per mousemove
   * gesetzten `ghost`-State, weil der bei einem schnellen Klick (Trackpad-Tap,
   * synthetische Events) noch nicht committed sein kann.
   *
   * `ok` (erlaubt den Klick) hängt NUR vom Mindestabstand zu anderen Pflanzen
   * ab. `overflowsEdge` ist rein informativ (färbt die Vorschau rot), blockiert
   * aber nichts — Randbepflanzung mit überstehendem Radius ist erlaubt.
   */
  function evaluateCandidate(evt) {
    const { x, y } = clientToCm(evt);
    const radius = radiusFor(armed.plant);
    const centerOk = isCenterWithinBed(x, y, bed.width_cm, bed.length_cm);
    const overflowsEdge = !isWithinBedBounds(x, y, radius, bed.width_cm, bed.length_cm);
    const placement = centerOk
      ? checkPlacement({ plant_id: armed.plant.id, x_cm: x, y_cm: y }, concurrentPlacements, plantsById)
      : { ok: false, conflicts: [] };
    return { x, y, radius, overflowsEdge, ok: centerOk && placement.ok };
  }

  function handleMouseMove(evt) {
    if (!armed) return;
    setGhost(evaluateCandidate(evt));
  }

  function handleMouseLeave() {
    setGhost(null);
  }

  function handleClick(evt) {
    if (!armed) return;
    const candidate = evaluateCandidate(evt);
    if (!candidate.ok) return;
    onCandidateConfirmed(candidate.x, candidate.y);
    setGhost(null);
  }

  const activeAbs = absoluteMonth(year, month);

  return (
    <svg
      ref={svgRef}
      className="bed-canvas"
      viewBox={`0 0 ${bed.width_cm} ${bed.length_cm}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      role="img"
      aria-label={`Beet ${bed.name}, ${bed.width_cm}×${bed.length_cm} cm`}
    >
      <defs>
        {/* Abstandsringe dürfen über den Beetrand hinausragen (Randbepflanzung
            ist erlaubt) — werden aber optisch an der Beetkante abgeschnitten. */}
        <clipPath id={clipId}>
          <rect x="0" y="0" width={bed.width_cm} height={bed.length_cm} />
        </clipPath>
      </defs>

      <rect x="0" y="0" width={bed.width_cm} height={bed.length_cm} className="bed-soil" rx="4" />

      <g clipPath={`url(#${clipId})`}>
        {plantings
          .filter((p) => p.x_cm != null && p.y_cm != null && plantsById[p.plant_id])
          .map((p) => {
            const plant = plantsById[p.plant_id];
            const occ = computeOccupancy(p, plant);
            const isCurrent = occ.sowAbs <= activeAbs && activeAbs <= occ.bedFreeAbs - 1;
            return (
              <PlantMarker
                key={p.id}
                x={p.x_cm}
                y={p.y_cm}
                radiusCm={radiusFor(plant)}
                icon={plant.icon}
                faded={!isCurrent}
                selected={p.id === selectedPlantingId}
                // Solange eine Pflanze bewaffnet ist, zählt jeder Klick im Beet als
                // Platzierungsversuch — auch einer, der (blockiert) auf einem
                // bestehenden Marker landet. Ohne diese Sperre würde ein Klick nahe
                // an eine bestehende Pflanze (rot/blockiert) stattdessen deren
                // Marker auswählen und dabei die Bewaffnung stillschweigend
                // aufheben — weitere Klicks würden dann scheinbar wirkungslos
                // bleiben ("nix geht mehr").
                onSelect={
                  armed
                    ? undefined
                    : (e) => {
                        e.stopPropagation();
                        onMarkerClick(p);
                      }
                }
              />
            );
          })}

        {ghost && (
          <g className={`ghost-marker${ghost.ok && !ghost.overflowsEdge ? ' ok' : ' conflict'}`}>
            <circle cx={ghost.x} cy={ghost.y} r={ghost.radius} />
            <circle cx={ghost.x} cy={ghost.y} r="1.5" className="ghost-center" />
          </g>
        )}
      </g>
    </svg>
  );
}
