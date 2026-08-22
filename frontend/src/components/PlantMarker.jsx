import PlantIcon from '../icons/PlantIcons.jsx';

/**
 * Ein platziertes Symbol + gestrichelter Abstandsring, als SVG-<g> innerhalb
 * von BedCanvas' <svg viewBox="0 0 {width_cm} {length_cm}">. 1 SVG-Einheit = 1 cm,
 * daher braucht auch der Icon-Durchmesser eine reale cm-Größe (klein gehalten,
 * damit er bei sehr engem spacingMinCm nicht dominiert).
 */
export default function PlantMarker({ x, y, radiusCm, icon, faded = false, selected = false, onSelect }) {
  const iconSize = Math.max(6, Math.min(radiusCm * 0.9, 14));

  return (
    <g
      className={`plant-marker${faded ? ' faded' : ''}${selected ? ' selected' : ''}`}
      onClick={onSelect}
      style={{ cursor: onSelect ? 'pointer' : 'default' }}
    >
      <circle cx={x} cy={y} r={radiusCm} className="plant-marker-ring" />
      <PlantIcon
        icon={icon}
        x={x - iconSize / 2}
        y={y - iconSize / 2}
        width={iconSize}
        height={iconSize}
        className="plant-marker-icon"
      />
    </g>
  );
}
