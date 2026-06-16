import { useAtomValue, useSetAtom } from "jotai";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { workoutsAtom, workoutsRangeAtom, workoutsSummaryAtom } from "../atoms/api";
import { StatTile } from "../components/shared/StatTile";
import { HRZonesBar } from "../components/charts/HRZonesBar";
import { strainColor } from "../lib/colors";

const RANGES = [
	{ key: "7d", label: "7D" },
	{ key: "30d", label: "30D" },
	{ key: "90d", label: "90D" },
	{ key: "1y", label: "1Y" },
	{ key: "all", label: "ALL" },
] as const;

function formatDuration(startTs: number, endTs: number): string {
	const totalSec = endTs - startTs;
	if (totalSec <= 0) return "--";
	const h = Math.floor(totalSec / 3600);
	const m = Math.floor((totalSec % 3600) / 60);
	if (h > 0) return `${h}h ${m}m`;
	return `${m}m`;
}

function formatTotalTime(mins: number): string {
	if (mins >= 60) return `${Math.floor(mins / 60)}h ${mins % 60}m`;
	return `${mins}m`;
}

function formatDate(ts: number): string {
	return new Date(ts * 1000).toLocaleDateString("en-US", {
		weekday: "short",
		month: "short",
		day: "numeric",
	});
}

function formatTime(ts: number): string {
	return new Date(ts * 1000).toLocaleTimeString([], {
		hour: "2-digit",
		minute: "2-digit",
	});
}

export default function Workouts() {
	const { data, isPending, error } = useAtomValue(workoutsAtom);
	const selectedRange = useAtomValue(workoutsRangeAtom);
	const setRange = useSetAtom(workoutsRangeAtom);
	const { data: summary } = useAtomValue(workoutsSummaryAtom);

	const allWorkouts = data?.workouts ?? [];
	const rangeDays = { "7d": 7, "30d": 30, "90d": 90, "1y": 365, all: 99999 }[selectedRange];
	// eslint-disable-next-line react-hooks/purity -- current-time read for a relative "last N days" filter
	const cutoffTs = Math.floor(Date.now() / 1000) - rangeDays * 86400;
	const workouts = allWorkouts.filter((w) => w.start_ts >= cutoffTs);

	const mostActive = summary?.sport_breakdown?.[0]?.type ?? "--";

	return (
		<div className="mx-auto max-w-4xl space-y-6">
			<div className="flex items-center justify-between">
				<h1 className="text-2xl font-bold">Workouts</h1>
				{workouts.length > 0 && (
					<span className="text-sm text-text-tertiary">
						{workouts.length} sessions
					</span>
				)}
			</div>

			{/* Range filter */}
			<div className="flex gap-2">
				{RANGES.map((r) => (
					<button
						key={r.key}
						onClick={() => setRange(r.key)}
						className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
							selectedRange === r.key
								? "bg-accent-muted text-accent"
								: "text-text-secondary hover:bg-surface-overlay hover:text-text-primary"
						}`}
					>
						{r.label}
					</button>
				))}
			</div>

			{isPending && <div className="text-text-secondary">Loading…</div>}
			{error && <div className="text-sm text-status-critical">{String(error)}</div>}

			{/* Summary tiles */}
			{summary && (
				<div className="grid grid-cols-[repeat(auto-fill,minmax(168px,1fr))] gap-2">
					<StatTile label="Sessions" value={String(summary.count)} color="text-accent" />
					<StatTile label="Total Time" value={formatTotalTime(summary.total_minutes)} color="text-metric-purple" />
					<StatTile label="Calories" value={summary.total_calories.toLocaleString()} color="text-metric-amber" />
					<StatTile label="Most Active" value={mostActive} color="text-text-primary" />
				</div>
			)}

			{/* Sport breakdown */}
			{summary && summary.sport_breakdown.length > 0 && (
				<div>
					<div className="mb-3 text-[11px] uppercase tracking-widest text-text-tertiary">
						Sport Breakdown
					</div>
					<div className="grid grid-cols-[repeat(auto-fill,minmax(168px,1fr))] gap-2">
						{summary.sport_breakdown.map((s) => (
							<Card key={s.type} className="border-hairline bg-surface-raised p-3 space-y-1">
								<div className="flex items-center justify-between">
									<span className="font-semibold text-sm text-text-primary">{s.type}</span>
									<span className="text-xs text-text-tertiary">{s.count}×</span>
								</div>
								<div className="text-xs text-text-tertiary">
									{formatTotalTime(s.minutes)}
									{s.avg_strain > 0 && ` · ${s.avg_strain.toFixed(1)} strain`}
									{s.avg_hr > 0 && ` · ${s.avg_hr} bpm`}
								</div>
							</Card>
						))}
					</div>
				</div>
			)}

			{/* HR Zones */}
			{summary && Object.values(summary.hr_zones).some((v) => v > 0) && (
				<Card className="border-hairline bg-surface-raised p-4 space-y-2">
					<div className="text-[11px] uppercase tracking-widest text-text-tertiary">
						HR Zones
					</div>
					<HRZonesBar zones={summary.hr_zones} />
				</Card>
			)}

			{/* All sessions */}
			{!isPending && workouts.length === 0 && (
				<Card className="border-hairline bg-surface-raised p-8 text-center text-text-tertiary">
					No workouts in this range.
				</Card>
			)}

			<div className="space-y-3">
				{workouts.map((w) => (
					<Card key={w.id} className="border-hairline bg-surface-raised p-4">
						<div className="flex items-start justify-between gap-4">
							<div className="min-w-0 flex-1 space-y-2">
								<div className="flex flex-wrap items-center gap-2">
									<span className="font-semibold text-text-primary">
										{w.type ?? "Activity"}
									</span>
									<span className="text-xs text-text-tertiary">
										{formatDate(w.start_ts)} · {formatTime(w.start_ts)}
									</span>
									<span className="text-xs text-text-tertiary">
										{formatDuration(w.start_ts, w.end_ts)}
									</span>
								</div>
								<div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
									{w.calories != null && (
										<div>
											<span className="text-text-tertiary">Kcal </span>
											<span className="font-medium text-metric-amber">
												{Math.round(w.calories).toLocaleString()}
											</span>
										</div>
									)}
									{w.avg_hr != null && (
										<div>
											<span className="text-text-tertiary">Avg HR </span>
											<span className="font-medium text-metric-rose">
												{Math.round(w.avg_hr)}
											</span>
											<span className="text-text-tertiary"> bpm</span>
										</div>
									)}
									{w.max_hr != null && (
										<div>
											<span className="text-text-tertiary">Max HR </span>
											<span className="font-medium text-status-critical">
												{Math.round(w.max_hr)}
											</span>
											<span className="text-text-tertiary"> bpm</span>
										</div>
									)}
								</div>
							</div>
							{w.strain != null && (
								<div className="flex flex-col items-end gap-1">
									<span
										className={`text-2xl font-bold tabular-nums ${strainColor(w.strain)}`}
									>
										{w.strain.toFixed(1)}
									</span>
									<Badge
										variant="outline"
										className="border-hairline text-xs text-text-tertiary"
									>
										strain
									</Badge>
								</div>
							)}
						</div>
					</Card>
				))}
			</div>
		</div>
	);
}
