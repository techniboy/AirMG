import { strainColor } from '../../lib/colors';

interface StrainGaugeProps {
  strain: number | null;
  size?: number;
}

const START_DEG = 150;
const SPAN_DEG = 240;

function polarToXY(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(cx: number, cy: number, r: number, startDeg: number, spanDeg: number, fraction: number): string {
  const sweep = spanDeg * Math.min(Math.max(fraction, 0), 1);
  if (sweep <= 0) return '';
  const endDeg = startDeg + sweep;
  const start = polarToXY(cx, cy, r, startDeg);
  const end = polarToXY(cx, cy, r, endDeg);
  const largeArc = sweep > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

function strainHex(strain: number): string {
  const t = strain / 21;
  if (t < 0.33) return '#E8B04B';
  if (t < 0.66) return '#E8743B';
  if (t < 0.85) return '#E0476B';
  return '#C13AC1';
}

function strainWord(strain: number): string {
  if (strain < 6) return 'LIGHT';
  if (strain < 10) return 'MODERATE';
  if (strain < 14) return 'STRENUOUS';
  if (strain < 18) return 'HIGH';
  return 'ALL-OUT';
}

export function StrainGauge({ strain, size = 200 }: StrainGaugeProps) {
  const cx = size / 2;
  const cy = size / 2;
  const strokeWidth = size * 0.07;
  const r = (size - strokeWidth) / 2 - 4;
  const fraction = strain !== null ? Math.min(Math.max(strain / 21, 0), 1) : 0;
  const color = strain !== null ? strainHex(strain) : '#1B2620';
  const word = strain !== null ? strainWord(strain) : '--';
  const displayStrain = strain !== null ? strain.toFixed(1) : '--';

  const trackPath = describeArc(cx, cy, r, START_DEG, SPAN_DEG, 1);
  const fillPath = fraction > 0 ? describeArc(cx, cy, r, START_DEG, SPAN_DEG, fraction) : '';

  const tipDeg = START_DEG + SPAN_DEG * fraction;
  const bead = fraction > 0.01 ? polarToXY(cx, cy, r, tipDeg) : null;

  const gradId = `sg-grad-${Math.round((strain ?? 0) * 10)}`;
  const colorClass = strainColor(strain);

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#E8B04B" />
            <stop offset="40%" stopColor="#E8743B" />
            <stop offset="75%" stopColor="#E0476B" />
            <stop offset="100%" stopColor="#C13AC1" />
          </linearGradient>
          <filter id="sg-glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Track */}
        <path
          d={trackPath}
          fill="none"
          stroke="#1B2620"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          opacity={0.7}
        />

        {/* Fill */}
        {fillPath && (
          <>
            <path
              d={fillPath}
              fill="none"
              stroke={`url(#${gradId})`}
              strokeWidth={strokeWidth * 1.6}
              strokeLinecap="round"
              opacity={0.16 + 0.34 * fraction}
              filter="url(#sg-glow)"
            />
            <path
              d={fillPath}
              fill="none"
              stroke={`url(#${gradId})`}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
            />
          </>
        )}

        {/* Bead */}
        {bead && (
          <>
            <circle cx={bead.x} cy={bead.y} r={strokeWidth * 1.0} fill={color} opacity={0.5} filter="url(#sg-glow)" />
            <circle cx={bead.x} cy={bead.y} r={strokeWidth * 0.29} fill="white" opacity={0.9} />
          </>
        )}
      </svg>

      {/* Center label */}
      <div
        className="flex flex-col items-center"
        style={{ marginTop: -(size * 0.72), height: size * 0.72 - strokeWidth, justifyContent: 'center' }}
      >
        <span
          className="font-bold tabular-nums text-text-primary"
          style={{ fontSize: size * 0.24, lineHeight: 1 }}
        >
          {displayStrain}
        </span>
        <span className={`mt-1 text-xs font-semibold tracking-widest uppercase ${colorClass}`}>
          {word}
        </span>
        <span className="text-xs text-text-tertiary mt-0.5">STRAIN</span>
      </div>
    </div>
  );
}
