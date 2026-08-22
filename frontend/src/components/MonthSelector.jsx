export const MONTH_NAMES = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

export const MONTH_SHORT = [
  'Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez',
];

/**
 * Monat **und** Jahr wählen — das Jahr wird gebraucht, weil die Fruchtfolge-Prüfung
 * jahresbezogen ist (nicht nur die aktuelle Saison).
 */
export default function MonthSelector({ year, month, onChange }) {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 6 }, (_, i) => currentYear - 2 + i);

  return (
    <div className="month-selector">
      <label>
        Monat
        <select value={month} onChange={(e) => onChange({ year, month: Number(e.target.value) })}>
          {MONTH_NAMES.map((name, idx) => (
            <option key={name} value={idx + 1}>
              {name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Jahr
        <select value={year} onChange={(e) => onChange({ year: Number(e.target.value), month })}>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
