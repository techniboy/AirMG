import type { Workout } from "../../lib/types";
import { formatMinutes } from "../../lib/format";
import { fmtClock, formatWorkoutType } from "../strainData";
import { CountUp, HudPanel } from "./HudPanel";

function strainBand(strain: number): string {
  if (strain >= 18) return "all out";
  if (strain >= 14) return "high";
  if (strain >= 8) return "moderate";
  return "light";
}

/** strain chip when scored; this DB's workouts carry strain=null → avg hr */
function chipText(w: Workout): string {
  if (w.strain != null) return w.strain.toFixed(1);
  if (w.avg_hr != null) return `${w.avg_hr} bpm`;
  return "--";
}

/**
 * Left-side readout for the /strain diorama — day strain count-up plus one
 * row per workout flare on the 24h ring. Same enter/exit pattern as
 * Recovery/SleepHud: CSS fade keyed off the route, inert while hidden.
 */
export default function StrainHud({
  strain,
  workouts,
  visible,
}: {
  /** day strain 0-21 for the control-center day; null = no_data */
  strain: number | null;
  /** that day's workouts, in flare order (oldest first) */
  workouts: Workout[];
  visible: boolean;
}) {
  return (
    <div
      className={`orbital-hud-strain${visible ? "" : " is-hidden"}`}
      inert={!visible}
    >
      <HudPanel className="hud-strain-detail">
        <div className="hud-label">Strain</div>
        <div className="hud-big-row">
          <span className="hud-big">
            <CountUp value={strain} decimals={1} />
          </span>
          {strain != null && (
            <span className="hud-band hud-band--strain">
              {strainBand(strain)}
            </span>
          )}
        </div>
        {workouts.length > 0 && (
          <ul className="hud-workout-list">
            {workouts.map((w) => (
              <li key={w.id} className="hud-workout-row">
                <span className="hud-workout-type">
                  {formatWorkoutType(w.type)}
                </span>
                <span className="hud-workout-time hud-num">
                  {fmtClock(w.start_ts)} ·{" "}
                  {formatMinutes(Math.round((w.end_ts - w.start_ts) / 60))}
                </span>
                <span className="hud-workout-chip hud-num">{chipText(w)}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="hud-ring-foot">
          {strain == null
            ? "no strain recorded · corona dormant"
            : workouts.length === 0
              ? "no workouts logged · flare ring quiet"
              : "corona ∝ day strain · flares ride the 24h ring"}
        </div>
      </HudPanel>
    </div>
  );
}
