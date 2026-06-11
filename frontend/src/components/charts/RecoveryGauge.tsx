import { recoveryState, recoveryColor } from '../../lib/colors';

interface RecoveryGaugeProps {
  score: number | null;
  size?: number;
}

// 240° arc gauge: gap at bottom, start lower-left (150°), end lower-right (390°=30°)
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

// Map recovery score → hex color for SVG use
function recoveryHex(score: number): string {
  if (score < 25) return '#FF4F73';
  if (score < 50) return '#F5A623';
  if (score < 70) return '#E8C24B';
  if (score < 88) return '#18C98B';
  return '#2FE6A8';
}

export function RecoveryGauge({ score, size = 200 }: RecoveryGaugeProps) {
  const cx = size / 2;
  const cy = size / 2;
  const strokeWidth = size * 0.075;
  const r = (size - strokeWidth) / 2 - 4;
  const fraction = score !== null ? Math.min(Math.max(score / 100, 0), 1) : 0;
  const color = score !== null ? recoveryHex(score) : '#1B2620';
  const state = score !== null ? recoveryState(score) : '--';
  const displayScore = score !== null ? Math.round(score).toString() : '--';

  // Track arc (full span)
  const trackPath = describeArc(cx, cy, r, START_DEG, SPAN_DEG, 1);
  // Fill arc
  const fillPath = fraction > 0 ? describeArc(cx, cy, r, START_DEG, SPAN_DEG, fraction) : '';

  // Bead at fill tip
  const tipDeg = START_DEG + SPAN_DEG * fraction;
  const bead = fraction > 0.01 ? polarToXY(cx, cy, r, tipDeg) : null;

  // Gradient id unique per instance
  const gradId = `rg-grad-${Math.round((score ?? 0) * 10)}`;

  const colorClass = recoveryColor(score);

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#FF4F73" />
            <stop offset="33%" stopColor="#F5A623" />
            <stop offset="55%" stopColor="#E8C24B" />
            <stop offset="80%" stopColor="#18C98B" />
            <stop offset="100%" stopColor="#2FE6A8" />
          </linearGradient>
          <filter id="glow">
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

        {/* Fill arc */}
        {fillPath && (
          <>
            {/* Bloom/glow layer */}
            <path
              d={fillPath}
              fill="none"
              stroke={`url(#${gradId})`}
              strokeWidth={strokeWidth * 1.6}
              strokeLinecap="round"
              opacity={0.18 + 0.37 * fraction}
              filter="url(#glow)"
            />
            {/* Main arc */}
            <path
              d={fillPath}
              fill="none"
              stroke={`url(#${gradId})`}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
            />
          </>
        )}

        {/* Bead at tip */}
        {bead && (
          <>
            <circle cx={bead.x} cy={bead.y} r={strokeWidth * 1.1} fill={color} opacity={0.5} filter="url(#glow)" />
            <circle cx={bead.x} cy={bead.y} r={strokeWidth * 0.31} fill="white" opacity={0.9} />
          </>
        )}
      </svg>

      {/* Center label — positioned over the SVG */}
      <div
        className="flex flex-col items-center"
        style={{ marginTop: -(size * 0.72), height: size * 0.72 - strokeWidth, justifyContent: 'center' }}
      >
        <span
          className="font-bold tabular-nums text-text-primary"
          style={{ fontSize: size * 0.28, lineHeight: 1 }}
        >
          {displayScore}
        </span>
        <span className={`mt-1 text-xs font-semibold tracking-widest uppercase ${colorClass}`}>
          {state}
        </span>
      </div>
    </div>
  );
}
