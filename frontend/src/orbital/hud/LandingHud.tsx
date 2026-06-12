import { useAtomValue, useSetAtom } from "jotai";
import { useEffect } from "react";
import { controlCenterDayAtom, todayMetricsAtom } from "../../atoms/api";
import { DateNav } from "../../components/shared/DateNav";
import { recoveryState } from "../../lib/colors";
import type { WorldState } from "../worldState";
import { asMetrics, readFixtureInputs } from "../worldState";
import { hoveredObjectAtom } from "./hoverAtom";
import { CountUp, HudPanel } from "./HudPanel";

// One-line planetary weather report derived from the simulation state — the
// HUD narrates the world instead of repeating raw numbers.
function worldStatusLine(world: WorldState, hasData: boolean): string {
  if (!hasData) return "system dormant — sync to bring it online";
  const parts: string[] = [];
  if (world.stormCount >= 3) parts.push("storm systems forming");
  else if (world.stormCount >= 1) parts.push("scattered storms");
  else if (world.atmosphereDensity >= 0.65) parts.push("atmosphere stable");
  else parts.push("atmosphere thin");
  if (world.coronaActivity >= 0.7) parts.push("corona flaring");
  else if (world.auroraIntensity >= 0.55) parts.push("aurora active");
  else if (world.cityCalm >= 0.7) parts.push("cities calm");
  else parts.push("aurora faint");
  return parts.join(" · ");
}

function formatHm(minutes: number | null): string {
  if (minutes == null) return "--";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

export default function LandingHud({
  world,
  visible,
}: {
  world: WorldState;
  visible: boolean;
}) {
  const query = useAtomValue(todayMetricsAtom);
  const setHovered = useSetAtom(hoveredObjectAtom);

  // ?worldFixture=… drives the scene; mirror it here so screenshots agree
  const fixture = readFixtureInputs();
  const live = asMetrics(query.data);
  const recovery = fixture ? fixture.recovery : (live?.recovery ?? null);
  const strain = fixture ? fixture.strainToday : (live?.strain ?? null);
  const sleepMinutes = fixture
    ? fixture.sleepMinutes
    : (live?.sleep_minutes ?? null);
  const hasData = fixture ? fixture.hasData : live != null;

  // leaving orbit mid-hover would otherwise pin the highlight on a body
  useEffect(() => {
    if (!visible) setHovered(null);
  }, [visible, setHovered]);

  return (
    <div
      className={`orbital-hud-landing${visible ? "" : " is-hidden"}`}
      inert={!visible}
    >
      <HudPanel
        className="hud-recovery"
        onPointerEnter={() => setHovered("planet")}
        onPointerLeave={() => setHovered(null)}
      >
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
        <div className="hud-status">{worldStatusLine(world, hasData)}</div>
      </HudPanel>

      <div className="hud-minis">
        <HudPanel
          className="hud-mini"
          onPointerEnter={() => setHovered("star")}
          onPointerLeave={() => setHovered(null)}
        >
          <div className="hud-label">Strain</div>
          <div className="hud-mini-value">
            <CountUp value={strain} decimals={1} />
          </div>
        </HudPanel>
        <HudPanel
          className="hud-mini"
          onPointerEnter={() => setHovered("moon")}
          onPointerLeave={() => setHovered(null)}
        >
          <div className="hud-label">Sleep</div>
          <div className="hud-mini-value hud-num">
            {formatHm(sleepMinutes)}
          </div>
        </HudPanel>
      </div>

      <div className="hud-datenav">
        <DateNav dayAtom={controlCenterDayAtom} />
      </div>

      <div className="hud-legend" aria-hidden="true">
        <span>
          Planet <i>·</i> Recovery
        </span>
        <span className="hud-legend-bar" />
        <span>
          Moon <i>·</i> Sleep
        </span>
        <span className="hud-legend-bar" />
        <span>
          Star <i>·</i> Strain
        </span>
      </div>
    </div>
  );
}
