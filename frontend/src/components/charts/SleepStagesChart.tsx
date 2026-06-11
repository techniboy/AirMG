import { sleepStageColor } from '../../lib/colors';
import { formatMinutes } from '../../lib/format';
import type { StageSegment } from '../../lib/types';

interface SleepStagesChartProps {
  stages: StageSegment[] | null;
  totalMinutes: number | null;
  deepMinutes?: number | null;
  remMinutes?: number | null;
  lightMinutes?: number | null;
  wakeMinutes?: number | null;
}

const STAGE_ORDER: Array<StageSegment['stage']> = ['deep', 'light', 'rem', 'wake'];
const STAGE_LABELS: Record<string, string> = {
  wake: 'Awake',
  light: 'Light',
  deep: 'Deep',
  rem: 'REM',
};

function pct(mins: number, total: number): string {
  if (total <= 0) return '0%';
  return `${Math.round((mins / total) * 100)}%`;
}

export function SleepStagesChart({
  stages,
  totalMinutes,
  deepMinutes,
  remMinutes,
  lightMinutes,
  wakeMinutes,
}: SleepStagesChartProps) {
  // Compute per-stage totals either from segments or from provided minute values
  let deep = deepMinutes ?? 0;
  let rem = remMinutes ?? 0;
  let light = lightMinutes ?? 0;
  let wake = wakeMinutes ?? 0;

  if (stages && stages.length > 0) {
    deep = 0; rem = 0; light = 0; wake = 0;
    for (const seg of stages) {
      const mins = (seg.end - seg.start) / 60;
      if (seg.stage === 'deep') deep += mins;
      else if (seg.stage === 'rem') rem += mins;
      else if (seg.stage === 'light') light += mins;
      else if (seg.stage === 'wake') wake += mins;
    }
  }

  const total = totalMinutes ?? (deep + rem + light + wake) || 1;
  const asleep = deep + rem + light;

  const bars: Array<{ stage: string; mins: number; color: string }> = [
    { stage: 'deep', mins: deep, color: sleepStageColor('deep') },
    { stage: 'light', mins: light, color: sleepStageColor('light') },
    { stage: 'rem', mins: rem, color: sleepStageColor('rem') },
    { stage: 'wake', mins: wake, color: sleepStageColor('wake') },
  ].filter((b) => b.mins > 0);

  const hasData = total > 1;

  return (
    <div className="space-y-3">
      {/* Stacked proportional bar */}
      <div className="flex h-8 overflow-hidden rounded-lg" style={{ gap: 2 }}>
        {hasData ? (
          bars.map(({ stage, mins, color }) => (
            <div
              key={stage}
              style={{ width: `${(mins / total) * 100}%`, backgroundColor: color, minWidth: mins > 0 ? 2 : 0 }}
              title={`${STAGE_LABELS[stage]}: ${formatMinutes(Math.round(mins))}`}
            />
          ))
        ) : (
          <div className="flex-1 rounded-lg bg-surface-inset" />
        )}
      </div>

      {/* Legend row */}
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {STAGE_ORDER.filter((s) => {
          const m = s === 'deep' ? deep : s === 'rem' ? rem : s === 'light' ? light : wake;
          return m > 0;
        }).map((stage) => {
          const mins = stage === 'deep' ? deep : stage === 'rem' ? rem : stage === 'light' ? light : wake;
          return (
            <div key={stage} className="flex items-center gap-1.5">
              <div
                className="h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: sleepStageColor(stage) }}
              />
              <span className="text-xs text-text-secondary">
                {STAGE_LABELS[stage]}
              </span>
              <span className="text-xs font-semibold text-text-primary tabular-nums">
                {formatMinutes(Math.round(mins))}
              </span>
              <span className="text-xs text-text-tertiary">
                {pct(mins, total)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Summary line */}
      {hasData && (
        <div className="flex items-center gap-4 text-xs text-text-tertiary">
          <span>
            Asleep: <span className="text-text-secondary font-medium">{formatMinutes(Math.round(asleep))}</span>
          </span>
          <span>
            In bed: <span className="text-text-secondary font-medium">{formatMinutes(Math.round(total))}</span>
          </span>
        </div>
      )}
    </div>
  );
}
