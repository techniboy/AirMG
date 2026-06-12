import { useAtomValue } from "jotai";
import { Card } from "@/components/ui/card";
import {
  controlCenterDayAtom,
  todayMetricsAtom,
  sparklinesAtom,
  readinessAtom,
  hrTrendAtom,
  workoutsAtom,
} from "../atoms/api";
import { RecoveryGauge } from "../components/charts/RecoveryGauge";
import { TrendLine } from "../components/charts/TrendLine";
import { DateNav } from "../components/shared/DateNav";
import { ReadinessCard } from "../components/shared/ReadinessCard";
import { StatTile } from "../components/shared/StatTile";
import { SynthesisCard } from "../components/shared/SynthesisCard";
import { AlgoInfo } from "../components/shared/AlgoInfo";
import { strainColor } from "../lib/colors";
import { formatMinutes, formatScore } from "../lib/format";

function greetingWord(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function synthesisWord(score: number | null): string {
  if (score == null) return "No Data";
  if (score < 25) return "Depleted";
  if (score < 50) return "Low";
  if (score < 70) return "Steady";
  if (score < 88) return "Primed";
  return "Peak";
}

function synthesisDetail(
  recovery: number | null,
  sleepMin: number | null,
): string {
  if (recovery == null) return "No metrics yet. Sync your data to begin.";
  const rec =
    recovery < 50
      ? "Recovery is low"
      : recovery < 70
        ? "Recovery is steady"
        : "Recovery is strong";
  const sleep =
    sleepMin == null
      ? ""
      : sleepMin >= 420
        ? " and sleep was consistent"
        : " but sleep ran short";
  return rec + sleep + ".";
}

// Returns a hex color for the recovery score (used where CSS classes won't work)
function recoveryHex(score: number | null): string {
  if (score == null) return "#666";
  if (score < 25) return "#FF4F73";
  if (score < 50) return "#F5A623";
  if (score < 70) return "#E8C24B";
  if (score < 88) return "#18C98B";
  return "#2FE6A8";
}

function formatWorkoutDuration(startTs: number, endTs: number): string {
  const mins = Math.max(0, Math.round((endTs - startTs) / 60));
  if (mins >= 60) return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  return `${mins}m`;
}

function formatWorkoutDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export default function Today() {
  const { data: today, isPending } = useAtomValue(todayMetricsAtom);
  const { data: sparklines } = useAtomValue(sparklinesAtom);
  const { data: readiness } = useAtomValue(readinessAtom);
  const { data: hrTrend } = useAtomValue(hrTrendAtom);
  const { data: workoutsData } = useAtomValue(workoutsAtom);

  const selectedDay = useAtomValue(controlCenterDayAtom);
  const workouts = workoutsData?.workouts?.slice(0, 6) ?? [];

  if (isPending) return <div className="text-text-secondary">Loading...</div>;

  const rec = today?.recovery ?? null;
  const selectedDate = new Date(`${selectedDay}T00:00:00`);

  // Build HR trend points — use time string as "day" key for TrendLine
  const hrPoints =
    hrTrend?.points?.map((p) => ({
      day: new Date(p.ts * 1000).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      value: p.bpm,
    })) ?? [];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">Control Center</h1>
          <p className="text-sm text-text-secondary mt-0.5">
            {selectedDate.toLocaleDateString("en-US", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </p>
        </div>
        <DateNav dayAtom={controlCenterDayAtom} />
      </div>

      {/* Hero — RecoveryGauge + SynthesisCard */}
      <div className="flex gap-4">
        <Card className="flex-1 border-hairline bg-surface-raised p-6 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <RecoveryGauge score={rec} size={168} />
            <div className="text-sm text-text-tertiary flex items-center gap-1.5">
              {rec == null ? "No data" : "Recovery"} <AlgoInfo algo="recovery" />
            </div>
          </div>
        </Card>
        <div className="flex-1">
          <SynthesisCard
            status={synthesisWord(rec)}
            detail={synthesisDetail(rec, today?.sleep_minutes ?? null)}
            statusColor={recoveryHex(rec)}
          />
        </div>
      </div>

      {/* HR Trend — hidden when <2 points */}
      {hrPoints.length >= 2 && (
        <Card className="border-hairline bg-surface-raised p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-widest text-text-tertiary">
                Heart Rate
              </div>
              <div className="text-xs text-text-tertiary">
                5-min avg · since midnight
              </div>
            </div>
            {hrTrend && (
              <span className="text-sm font-medium text-metric-rose">
                {hrTrend.points[hrTrend.points.length - 1]?.bpm ?? "--"} bpm
              </span>
            )}
          </div>
          <TrendLine data={hrPoints} color="#FF4F73" />
          {hrTrend && (
            <div className="flex gap-6 border-t border-hairline pt-2 text-xs text-text-tertiary">
              <span>
                Min{" "}
                <strong className="text-text-primary">{hrTrend.min}</strong>
              </span>
              <span>
                Avg{" "}
                <strong className="text-text-primary">{hrTrend.avg}</strong>
              </span>
              <span>
                Max{" "}
                <strong className="text-text-primary">{hrTrend.max}</strong>
              </span>
            </div>
          )}
        </Card>
      )}

      {/* Readiness — hidden when insufficient */}
      {readiness && <ReadinessCard result={readiness} />}

      {/* Key Metrics */}
      <div>
        <div className="mb-3 text-[11px] uppercase tracking-widest text-text-tertiary">
          Key Metrics · 14-day trend
        </div>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(168px,1fr))] gap-2">
          <StatTile
            label="Recovery"
            value={rec != null ? `${Math.round(rec)}%` : "--"}
            caption={rec != null ? synthesisWord(rec) : undefined}
            color="text-accent"
            sparkline={sparklines?.recovery}
            sparkColor="#18C98B"
          />
          <StatTile
            label="Day Strain"
            value={today?.strain != null ? today.strain.toFixed(1) : "--"}
            caption="of 21"
            color={strainColor(today?.strain ?? null)}
            sparkline={sparklines?.strain}
            sparkColor="#E8743B"
          />
          <StatTile
            label="Sleep"
            value={formatMinutes(today?.sleep_minutes ?? null)}
            color="text-metric-purple"
            sparkline={sparklines?.sleep_minutes}
            sparkColor="#A879FF"
          />
          <StatTile
            label="HRV"
            value={formatScore(today?.hrv_rmssd ?? null, 0)}
            caption="ms"
            color="text-metric-purple"
            sparkline={sparklines?.hrv_rmssd}
            sparkColor="#A879FF"
          />
          <StatTile
            label="Resting HR"
            value={formatScore(today?.resting_hr ?? null, 0)}
            caption="bpm"
            color="text-metric-rose"
            sparkline={sparklines?.resting_hr}
            sparkColor="#FF4F73"
          />
          <StatTile
            label="Blood Oxygen"
            value={
              today?.spo2 != null ? `${Math.round(today.spo2)}%` : "--"
            }
            caption="SpO₂"
            color="text-metric-cyan"
            sparkline={sparklines?.spo2}
            sparkColor="#2FC7FF"
          />
          <StatTile
            label="Respiratory"
            value={formatScore(today?.resp_rate ?? null, 1)}
            caption="rpm"
            color="text-accent"
            sparkline={sparklines?.resp_rate}
            sparkColor="#18C98B"
          />
          <StatTile
            label="Steps"
            value={today?.steps?.toLocaleString() ?? "--"}
            caption="today"
            color="text-metric-cyan"
            sparkline={sparklines?.steps}
            sparkColor="#2FC7FF"
          />
          <StatTile
            label="Calories"
            value={
              today?.calories != null
                ? Math.round(today.calories).toLocaleString()
                : "--"
            }
            caption="active"
            color="text-metric-amber"
            sparkline={sparklines?.calories}
            sparkColor="#F5A623"
          />
        </div>
      </div>

      {/* Last Workouts */}
      {workouts.length > 0 && (
        <div>
          <div className="mb-3 text-[11px] uppercase tracking-widest text-text-tertiary">
            Last Workouts · Activity
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(168px,1fr))] gap-2">
            {workouts.map((w) => (
              <StatTile
                key={w.id}
                label={w.type ?? "Activity"}
                value={formatWorkoutDuration(w.start_ts, w.end_ts)}
                caption={`${formatWorkoutDate(w.start_ts)}${w.avg_hr ? ` · ${w.avg_hr} bpm` : ""}`}
                color={strainColor(w.strain ?? null)}
                delta={
                  w.calories != null
                    ? `${Math.round(w.calories)} kcal`
                    : undefined
                }
                deltaColor="text-metric-amber"
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
