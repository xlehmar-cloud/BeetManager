import { Link } from 'react-router-dom';

const STANDORT_LABELS = { sonne: 'Sonne', halbschatten: 'Halbschatten', schatten: 'Schatten' };

export default function BedCard({ bed, onEdit, onDelete }) {
  return (
    <div className="bed-card">
      <h3>{bed.name}</h3>
      <p className="bed-card-meta">
        {bed.width_cm} × {bed.length_cm} cm · {STANDORT_LABELS[bed.standort]}
      </p>
      <Link to={`/beete/${bed.id}`} className="bed-card-open">
        Pflanzplaner öffnen →
      </Link>
      <div className="bed-card-actions">
        <button type="button" className="secondary" onClick={() => onEdit(bed)}>
          Bearbeiten
        </button>
        <button type="button" className="danger" onClick={() => onDelete(bed)}>
          Löschen
        </button>
      </div>
    </div>
  );
}
