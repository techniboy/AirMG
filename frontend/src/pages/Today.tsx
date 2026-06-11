import { WeekStrip } from "../components/charts/WeekStrip";
import { MetricCard } from "../components/shared/MetricCard";
import { ScoreBadge } from "../components/shared/ScoreBadge";
import { useApi } from "../hooks/useApi";
import { strainColor } from "../lib/colors";
import { formatMinutes, formatScore } from "../lib/format";
import type { DailyMetrics } from "../lib/types";

export default function Today() {
	const { data: today, loading } = useApi<DailyMetrics>("/api/today");
	const { data: weekData } = useApi<{ days: DailyMetrics[] }>("/api/week");

	if (loading) return <div className="text-text-secondary">Loading...</div>;

	return (
		<div className="mx-auto max-w-4xl space-y-6">
			<h1 className="text-2xl font-bold">Today</h1>

			<div className="grid grid-cols-3 gap-4">
				<ScoreBadge score={today?.recovery ?? null} label="Recovery" />
				<div className="flex flex-col items-center rounded-xl bg-surface-raised p-6">
					<div
						className={`text-5xl font-bold ${strainColor(today?.strain ?? null)}`}
					>
						{today?.strain != null ? today.strain.toFixed(1) : "--"}
					</div>
					<div className="mt-1 text-sm text-text-secondary">Strain</div>
				</div>
				<div className="flex flex-col items-center rounded-xl bg-surface-raised p-6">
					<div className="text-5xl font-bold text-metric-cyan">
						{formatMinutes(today?.sleep_minutes ?? null)}
					</div>
					<div className="mt-1 text-sm text-text-secondary">Sleep</div>
				</div>
			</div>

			<div className="grid grid-cols-4 gap-3">
				<MetricCard
					label="HRV"
					value={formatScore(today?.hrv_rmssd ?? null, 1)}
					unit="ms"
				/>
				<MetricCard
					label="Resting HR"
					value={formatScore(today?.resting_hr ?? null)}
					unit="bpm"
				/>
				<MetricCard
					label="SpO2"
					value={formatScore(today?.spo2 ?? null, 1)}
					unit="%"
				/>
				<MetricCard
					label="Steps"
					value={today?.steps?.toLocaleString() ?? "--"}
				/>
			</div>

			{weekData?.days && weekData.days.length > 0 && (
				<div className="rounded-xl bg-surface-raised p-4">
					<div className="mb-3 text-sm text-text-secondary">This Week</div>
					<WeekStrip days={weekData.days} />
				</div>
			)}
		</div>
	);
}
