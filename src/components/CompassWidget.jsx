export default function CompassWidget({ heading, size = 56 }) {
  return (
    <div className="compass-widget" style={{ width: size }}>
      <svg viewBox="0 0 56 56" width={size} height={size}>
        <circle cx="28" cy="28" r="26" fill="white" stroke="#e5e7eb" strokeWidth="1.5" />
        <text x="28" y="13" textAnchor="middle" fontSize="9" fontWeight="800" fill="#1d4ed8">N</text>
        <g style={{
          transform: `rotate(${-(heading ?? 0)}deg)`,
          transformOrigin: '28px 28px',
          transition: 'transform .2s ease',
        }}>
          <polygon points="28,10 25.5,28 30.5,28" fill="#dc2626" />
          <polygon points="28,46 25.5,28 30.5,28" fill="#9ca3af" />
        </g>
        <circle cx="28" cy="28" r="3" fill="#374151" />
      </svg>
      <div className="compass-widget-deg">{heading !== null ? `${heading}°` : '—'}</div>
    </div>
  );
}
