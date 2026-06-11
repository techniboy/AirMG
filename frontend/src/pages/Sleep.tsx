import { useAtomValue } from "jotai";
import { Card } from "@/components/ui/card";
import { sleepDayAtom, sleepDetailAtom } from "../atoms/api";
import { SleepStagesChart } from "../components/charts/SleepStagesChart";
import { DateNav } from "../components/shared/DateNav";
import { MetricCard } from "../components/shared/MetricCard";
import { formatMinutes, formatScore } from "../lib/format";

export default function Sleep() {
	const { data, isPending, error } = useAtomValue(sleepDetailAtom);

	const hasData = data != null && !("status" in data && data.status === "no_data");
	const session = hasData ? data : null;

	const deepMin = session?.deep_minutes ?? null;
	const remMin = session?.rem_minutes ?? null;
	const lightMin = session?.light_minutes ?? null;
	const wakeMin = session?.wake_minutes ?? null;
	const totalMin = session?.sleep_minutes ?? null;

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

					<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
						<MetricCard
							label="Sleep Performance"
							value={
								session?.sleep_performance != null
									? `${Math.round(session.sleep_performance)}`
									: "--"
							}
							unit="%"
							color="text-accent"
						/>
						<MetricCard
							label="Efficiency"
							value={
								session?.efficiency != null
									? `${Math.round(session.efficiency <= 1 ? session.efficiency * 100 : session.efficiency)}`
									: "--"
							}
							unit="%"
							color="text-status-positive"
						/>
						<MetricCard
							label="Resting HR"
							value={formatScore(session?.resting_hr ?? null)}
							unit="bpm"
							color="text-metric-rose"
						/>
						<MetricCard
							label="HRV"
							value={formatScore(session?.avg_hrv ?? null, 0)}
							unit="ms"
							color="text-metric-purple"
						/>
					</div>

					<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
						<MetricCard
							label="Deep"
							value={formatMinutes(deepMin)}
							color="text-sleep-deep"
						/>
						<MetricCard
							label="REM"
							value={formatMinutes(remMin)}
							color="text-sleep-rem"
						/>
						<MetricCard
							label="Light"
							value={formatMinutes(lightMin)}
							color="text-sleep-light"
						/>
						<MetricCard
							label="Awake"
							value={formatMinutes(wakeMin)}
							color="text-sleep-awake"
						/>
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
		</div>
	);
}
