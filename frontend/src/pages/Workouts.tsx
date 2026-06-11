import { useAtomValue } from "jotai";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { workoutsAtom } from "../atoms/api";
import { strainColor } from "../lib/colors";

function formatDuration(startTs: number, endTs: number): string {
	const totalSec = endTs - startTs;
	if (totalSec <= 0) return "--";
	const h = Math.floor(totalSec / 3600);
	const m = Math.floor((totalSec % 3600) / 60);
	if (h > 0) return `${h}h ${m}m`;
	return `${m}m`;
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
	const workouts = data?.workouts ?? [];

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

			{isPending && <div className="text-text-secondary">Loading…</div>}
			{error && <div className="text-sm text-status-critical">{String(error)}</div>}

			{!isPending && workouts.length === 0 && (
				<Card className="border-hairline bg-surface-raised p-8 text-center text-text-tertiary">
					No workouts yet. Sync your data to bring in sessions.
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
