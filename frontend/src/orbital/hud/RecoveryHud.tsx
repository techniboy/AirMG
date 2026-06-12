import { recoveryState } from "../../lib/colors";
import type { RingMetric } from "../worldState";
import { CountUp, HudPanel } from "./HudPanel";

function fmtValue(m: RingMetric): string {
  if (m.value == null) return "--";
  const v = m.value.toFixed(m.decimals);
  return m.unit === "%" ? `${v}%` : `${v} ${m.unit}`;
}

function fmtBaseline(m: RingMetric): string {
  if (m.baselineMean == null || m.baselineSpread == null) return "--";
  return `${m.baselineMean.toFixed(m.decimals)} ± ${m.baselineSpread.toFixed(m.decimals)}`;
}

/**
 * Left-side readout for the /recovery diorama — recovery score plus one row
 * per orbital ring (value, baseline, signed deviation chip). Same enter/exit
 * pattern as LandingHud: CSS fade keyed off the route, inert while hidden.
 */
export default function RecoveryHud({
  metrics,
  recovery,
  visible,
}: {
  metrics: RingMetric[];
  recovery: number | null;
  visible: boolean;
}) {
  return (
    <div
      className={`orbital-hud-recovery${visible ? "" : " is-hidden"}`}
      inert={!visible}
    >
      <HudPanel className="hud-recovery-detail">
        <div className="hud-label">Recovery</div>
        <div className="hud-big-row">
          <span className="hud-big">
            <CountUp value={recovery} />
            <span className="hud-unit">%</span>
          </span>
          {recovery != null && (
            <span className="hud-band">{recoveryState(recovery)}</span>
          )}
        </div>
        <ul className="hud-ring-list">
          {metrics.map((m) => (
            <li key={m.key} className="hud-ring-row">
              <span className="hud-ring-name">{m.label}</span>
              <span className="hud-ring-value hud-num">{fmtValue(m)}</span>
              <span className="hud-ring-base hud-num">{fmtBaseline(m)}</span>
              <span
                className={`hud-ring-z hud-num${
                  m.z == null ? "" : m.good ? " is-good" : " is-bad"
                }`}
              >
                {m.z == null
                  ? "--"
                  : `${m.z >= 0 ? "▲" : "▼"} ${Math.abs(m.z).toFixed(1)}`}
              </span>
            </li>
          ))}
        </ul>
        <div className="hud-ring-foot">
          marker offset · deviation vs personal baseline
        </div>
      </HudPanel>
    </div>
  );
}
