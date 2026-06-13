import { Html } from "@react-three/drei";
import { useMemo } from "react";
import type { HRTrendPoint, Workout } from "../../lib/types";
import { formatMinutes } from "../../lib/format";
import {
  fmtClock,
  formatWorkoutType,
  sliceTrace,
  tracePath,
} from "../strainData";
import { SUN_POSITION } from "./Planet";
import { flareAnchor, type Flare } from "./Star";

const TRACE_W = 188;
const TRACE_H = 48;

/**
 * Holo readout for the hovered solar flare (/strain): workout stats plus a
 * mini HR trace sliced from the day's 5-min buckets. Pure DOM via drei Html,
 * anchored 80% up the hovered spike (recharts inside a transformed Html is
 * flaky — a plain SVG polyline is plenty for a 1-hour trace).
 */
export default function StrainFlareLayer({
  workouts,
  flares,
  hoverIndex,
  hrPoints,
}: {
  /** day workouts, parallel to `flares` (same order fed to <Star/>) */
  workouts: Workout[];
  flares: Flare[];
  /** hovered flare instance index from Star, null = no panel */
  hoverIndex: number | null;
  /** the day's HR trend buckets — sliced to the workout window */
  hrPoints: HRTrendPoint[] | undefined;
}) {
  const workout = hoverIndex != null ? workouts[hoverIndex] : undefined;
  const flare = hoverIndex != null ? flares[hoverIndex] : undefined;

  const trace = useMemo(() => {
    if (!workout) return null;
    const pts = sliceTrace(hrPoints, workout.start_ts, workout.end_ts);
    return { path: tracePath(pts, TRACE_W, TRACE_H), n: pts.length };
  }, [workout, hrPoints]);

  if (!workout || !flare) return null;

  const minutes = Math.round((workout.end_ts - workout.start_ts) / 60);
  const anchor = flareAnchor(flare);
  return (
    <group position={SUN_POSITION}>
      <Html
        position={anchor}
        center
        style={{ pointerEvents: "none" }}
        zIndexRange={[6, 0]}
      >
        <div className="orbital-flare-panel">
          <div className="flare-panel-title">
            {formatWorkoutType(workout.type)}
          </div>
          <div className="flare-panel-time hud-num">
            {fmtClock(workout.start_ts)} – {fmtClock(workout.end_ts)}
          </div>
          <div className="flare-panel-stats">
            <span>
              <i>dur</i>
              <b className="hud-num">{formatMinutes(minutes)}</b>
            </span>
            <span>
              <i>kcal</i>
              <b className="hud-num">
                {workout.calories != null ? Math.round(workout.calories) : "--"}
              </b>
            </span>
            <span>
              <i>avg hr</i>
              <b className="hud-num">{workout.avg_hr ?? "--"}</b>
            </span>
            <span>
              <i>max hr</i>
              <b className="hud-num">{workout.max_hr ?? "--"}</b>
            </span>
          </div>
          {trace && trace.path !== "" ? (
            <svg
              className="flare-panel-trace"
              width={TRACE_W}
              height={TRACE_H}
              viewBox={`0 0 ${TRACE_W} ${TRACE_H}`}
              aria-label="Heart rate trace during workout"
              role="img"
            >
              <polyline points={trace.path} />
            </svg>
          ) : (
            <div className="flare-panel-notrace">no hr trace for window</div>
          )}
        </div>
      </Html>
    </group>
  );
}
