import { useAtomValue } from "jotai";
import { Card } from "@/components/ui/card";
import { sleepDayAtom, sleepDetailAtom, sparklinesAtom, sleepTrendAtom } from "../atoms/api";
import { SleepStagesChart } from "../components/charts/SleepStagesChart";
import { TrendLine } from "../components/charts/TrendLine";
import { DateNav } from "../components/shared/DateNav";
import { StatTile } from "../components/shared/StatTile";
import { formatMinutes, formatScore } from "../lib/format";

export default function Sleep() {
	const { data, isPending, error } = useAtomValue(sleepDetailAtom);
	const { data: sparklines } = useAtomValue(sparklinesAtom);
	const { data: sleepTrendData } = useAtomValue(sleepTrendAtom);

	const hasData = data != null && !("status" in data && data.status === "no_data");
	const session = hasData ? data : null;

	const deepMin = session?.deep_minutes ?? null;
	const remMin = session?.rem_minutes ?? null;
	const lightMin = session?.light_minutes ?? null;
	const wakeMin = session?.wake_minutes ?? null;
	const totalMin = session?.sleep_minutes ?? 0;

	const sleepTrendPoints = sleepTrendData?.days?.map((d) => ({
		day: d.day,
		value: d.sleep_minutes,
	})) ?? [];

	return (
		<div className="mx-auto max-w-4xl space-y-6">
			<div className="flex items-center justify-between">
				<h1 className="text-2xl font-bold">Sleep</h1>
				<DateNav dayAtom={sleepDayAtom} />
			</div>

			{isPending && <div className="text-text-secondary">Loading…</div>}
			{error && <div className="text-status-critical text-sm">{String(error)}</div>}

			{!isPending && !hasData && (
				<Card className="border-hairline bg-surface-raised p-8 text-center text-text-tertiary">
					No sleep data for this day.
				</Card>
			)}

			{hasData && (
				<>
					<Card className="border-hairline bg-surface-raised p-6 space-y-4">
						<div className="flex items-center justify-between">
							<div>
								<div className="text-xs uppercase tracking-widest text-text-tertiary">
									Sleep
								</div>
								<div className="text-base font-semibold text-text-primary">
									Stage Breakdown
								</div>
							</div>
							<div className="text-right">
								<div className="text-2xl font-bold text-accent tabular-nums">
									{formatMinutes(totalMin)}
								</div>
								<div className="text-xs text-text-tertiary">asleep</div>
							</div>
						</div>
						<SleepStagesChart
							stages={session?.stages ?? null}
							totalMinutes={totalMin}
							deepMinutes={deepMin}
							remMinutes={remMin}
							lightMinutes={lightMin}
							wakeMinutes={wakeMin}
						/>
					</Card>

					<div className="grid grid-cols-[repeat(auto-fill,minmax(168px,1fr))] gap-2">
						<StatTile label="Sleep Performance" value={session?.sleep_performance != null ? `${Math.round(session.sleep_performance <= 1 ? session.sleep_performance * 100 : session.sleep_performance)}%` : "--"} color="text-accent" sparkline={sparklines?.sleep_performance} sparkColor="#18C98B" />
						<StatTile label="Efficiency" value={session?.efficiency != null ? `${Math.round(session.efficiency <= 1 ? session.efficiency * 100 : session.efficiency)}%` : "--"} color="text-status-positive" />
						<StatTile label="Restorative" value={totalMin && deepMin != null && remMin != null ? `${Math.round(((deepMin + remMin) / totalMin) * 100)}%` : "--"} caption="deep+rem" color="text-metric-purple" />
						<StatTile label="Deep" value={formatMinutes(deepMin)} color="text-metric-purple" sparkline={sparklines?.deep_minutes} sparkColor="#5C6FB1" />
						<StatTile label="REM" value={formatMinutes(remMin)} color="text-metric-purple" sparkline={sparklines?.rem_minutes} sparkColor="#A879FF" />
						<StatTile label="HRV" value={formatScore(session?.avg_hrv ?? null, 0)} caption="ms" color="text-metric-purple" sparkline={sparklines?.hrv_rmssd} sparkColor="#A879FF" />
						<StatTile label="Resting HR" value={formatScore(session?.resting_hr ?? null, 0)} caption="bpm" color="text-metric-rose" sparkline={sparklines?.resting_hr} sparkColor="#FF4F73" />
					</div>

					{session && (
						<Card className="border-hairline bg-surface-raised p-4">
							<div className="flex gap-6 text-sm text-text-secondary">
								<div>
									<span className="mr-1 text-text-tertiary">Onset:</span>
									{new Date(session.start_ts * 1000).toLocaleTimeString([], {
										hour: "2-digit",
										minute: "2-digit",
									})}
								</div>
								<div>
									<span className="mr-1 text-text-tertiary">Wake:</span>
									{new Date(session.end_ts * 1000).toLocaleTimeString([], {
										hour: "2-digit",
										minute: "2-digit",
									})}
								</div>
							</div>
						</Card>
					)}
				</>
			)}

			{sleepTrendPoints.length >= 2 && (
				<Card className="border-hairline bg-surface-raised p-4 space-y-2">
					<div className="text-sm font-medium text-text-secondary">Sleep Duration · 30 days</div>
					<TrendLine data={sleepTrendPoints} color="#A879FF" />
				</Card>
			)}
		</div>
	);
}
