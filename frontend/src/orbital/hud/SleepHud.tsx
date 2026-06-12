import type { SleepApiResponse } from "../../atoms/api";
import { sleepStageColor } from "../../lib/colors";
import { formatMinutes } from "../../lib/format";
import { CountUp, HudPanel } from "./HudPanel";

const STAGE_ROWS = [
  { key: "deep", label: "Deep" },
  { key: "rem", label: "REM" },
  { key: "light", label: "Light" },
  { key: "wake", label: "Awake" },
] as const;

function stageMinutes(
  session: SleepApiResponse | null,
  key: (typeof STAGE_ROWS)[number]["key"],
): number | null {
  if (!session) return null;
  switch (key) {
    case "deep":
      return session.deep_minutes ?? null;
    case "rem":
      return session.rem_minutes ?? null;
    case "light":
      return session.light_minutes ?? null;
    case "wake":
      return session.wake_minutes ?? null;
  }
}

/**
 * Left-side readout for the /sleep diorama — sleep performance count-up plus
 * band residency bars (one per altitude band of the descent track, share of
 * time in bed). Same enter/exit pattern as RecoveryHud: CSS fade keyed off
 * the route, inert while hidden.
 */
export default function SleepHud({
  session,
  visible,
}: {
  /** narrowed session for the control-center day; null = no_data */
  session: SleepApiResponse | null;
  visible: boolean;
}) {
  const inBedMin = session
    ? Math.max(1, Math.round((session.end_ts - session.start_ts) / 60))
    : null;
  return (
    <div
      className={`orbital-hud-sleep${visible ? "" : " is-hidden"}`}
      inert={!visible}
    >
      <HudPanel className="hud-sleep-detail">
        <div className="hud-label">Sleep</div>
        <div className="hud-big-row">
          <span className="hud-big">
            <CountUp value={session?.sleep_performance ?? null} />
            <span className="hud-unit">%</span>
          </span>
          {session != null && <span className="hud-band">performance</span>}
        </div>
        <ul className="hud-stage-list">
          {STAGE_ROWS.map((row) => {
            const mins = stageMinutes(session, row.key);
            const pct =
              mins == null || inBedMin == null
                ? 0
                : Math.min(100, (mins / inBedMin) * 100);
            return (
              <li key={row.key} className="hud-stage-row">
                <span className="hud-stage-name">{row.label}</span>
                <span className="hud-stage-bar">
                  <span
                    style={{
                      width: `${pct}%`,
                      background: sleepStageColor(row.key),
                    }}
                  />
                </span>
                <span className="hud-stage-min hud-num">
                  {formatMinutes(mins)}
                </span>
              </li>
            );
          })}
        </ul>
        <div className="hud-ring-foot">
          {session != null
            ? `in bed ${formatMinutes(inBedMin)} · scrub the track for detail`
            : "no session recorded · descent track dormant"}
        </div>
      </HudPanel>
    </div>
  );
}
