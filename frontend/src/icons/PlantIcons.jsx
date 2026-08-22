// Handgezeichnetes, kategorienbasiertes Icon-Set (kein SVG-Icon pro Pflanze —
// stattdessen eine Handvoll organischer Formen je Kategorie, s. plant.icon in
// plants.json / PLANTS_SCHEMA.md). Unbekannte/neue Kategorien fallen auf
// GenericLeafIcon zurück, damit eine Katalogerweiterung das Rendering nie bricht.

function GenericLeafIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path
        d="M4 20c8-1 14-7 15-16-9 1-15 7-16 16Z"
        fill="currentColor"
        opacity="0.85"
      />
      <path d="M5 19c4-4 8-8 13-13" stroke="var(--color-surface)" strokeWidth="1" opacity="0.5" />
    </svg>
  );
}

function FruitIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <circle cx="12" cy="14" r="7" fill="currentColor" />
      <path d="M12 7c0-2 1.5-3.5 3-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M9 4.5c1 0 2 .6 2.4 1.6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.7" />
    </svg>
  );
}

function RootIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M12 3v7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
      <path
        d="M12 10c-3 0-4 4-3.5 10 1-4 2-6 3.5-6s2.5 2 3.5 6c.5-6-.5-10-3.5-10Z"
        fill="currentColor"
      />
    </svg>
  );
}

function LeafIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M12 21c5-6 5-13 0-18-5 5-5 12 0 18Z" fill="currentColor" />
      <path d="M12 20V6" stroke="var(--color-surface)" strokeWidth="1" opacity="0.5" />
    </svg>
  );
}

function LegumeIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path
        d="M4 14c0-6 6-10 15-9-1 8-6 13-15 9Z"
        fill="currentColor"
        opacity="0.9"
      />
      <circle cx="9" cy="13" r="1.3" fill="var(--color-surface)" opacity="0.7" />
      <circle cx="13" cy="10.5" r="1.3" fill="var(--color-surface)" opacity="0.7" />
      <circle cx="16.5" cy="8" r="1.1" fill="var(--color-surface)" opacity="0.7" />
    </svg>
  );
}

function HerbIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M12 21V9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M12 12c-3-1-5-3-5-6 3 0 5 2 5 5Z" fill="currentColor" />
      <path d="M12 9c3-1 5-3 5-6-3 0-5 2-5 5Z" fill="currentColor" opacity="0.8" />
    </svg>
  );
}

function BerryIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M12 4c1.6 0 2.5 1 3 2.2H9c.5-1.2 1.4-2.2 3-2.2Z" fill="currentColor" opacity="0.6" />
      <path
        d="M6 10c0-2 2.7-3.5 6-3.5S18 8 18 10c0 5-3 10-6 10S6 15 6 10Z"
        fill="currentColor"
      />
    </svg>
  );
}

function TuberIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path
        d="M5 14c-1-4 2-8 7-8s7 3 6 7-4 6-8 6-4.3-2-5-5Z"
        fill="currentColor"
      />
    </svg>
  );
}

function StalkIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M8 21c0-7 1-11 2-15M12 21c0-8 1-13 1-17M16 21c0-6 0-10-1-15"
        stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none" />
    </svg>
  );
}

const ICONS = {
  fruit: FruitIcon,
  root: RootIcon,
  leaf: LeafIcon,
  legume: LegumeIcon,
  herb: HerbIcon,
  berry: BerryIcon,
  tuber: TuberIcon,
  stalk: StalkIcon,
};

export default function PlantIcon({ icon, ...props }) {
  const Cmp = ICONS[icon] || GenericLeafIcon;
  return <Cmp {...props} />;
}
