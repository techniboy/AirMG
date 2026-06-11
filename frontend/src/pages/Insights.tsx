import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useApi } from "../hooks/useApi";
import type { CorrelationResult } from "../lib/types";

interface InsightsResponse {
	correlations: CorrelationResult[];
}

function strengthWord(r: number): string {
	const abs = Math.abs(r);
	if (abs < 0.1) return "no";
	if (abs < 0.3) return "a weak";
	if (abs < 0.5) return "a moderate";
	if (abs < 0.7) return "a strong";
	return "a very strong";
}

function correlationHex(r: number): string {
	// Map r∈[-1,1] → recovery color scale (red → amber → green)
	const t = (r + 1) / 2; // 0..1
	if (t < 0.25) return "#FF4F73";
	if (t < 0.45) return "#F5A623";
	if (t < 0.55) return "#E8C24B";
	if (t < 0.75) return "#18C98B";
	return "#2FE6A8";
}

function formatMetricLabel(key: string): string {
	const map: Record<string, string> = {
		recovery: "Recovery",
		strain: "Strain",
		hrv_rmssd: "HRV",
		resting_hr: "Resting HR",
		sleep_performance: "Sleep Performance",
		sleep_minutes: "Sleep Duration",
		resp_rate: "Resp Rate",
		deep_minutes: "Deep Sleep",
		rem_minutes: "REM Sleep",
	};
	return map[key] ?? key.replace(/_/g, " ");
}

function directionWord(r: number): string {
	if (r > 0.05) return "positive";
	if (r < -0.05) return "negative";
	return "flat";
}

export default function Insights() {
	const { data, loading, error } = useApi<InsightsResponse>("/api/insights");
	const correlations = data?.correlations ?? [];

	// Sort by |r| descending
	const sorted = [...correlations].sort(
		(a, b) => Math.abs(b.r) - Math.abs(a.r),
	);

	return (
		<div className="mx-auto max-w-4xl space-y-6">
			<h1 className="text-2xl font-bold">Insights</h1>
			<p className="text-sm text-text-secondary">
				Metric correlations across your history. Positive r means the two
				metrics tend to move together; negative means they move oppositely.
			</p>

			{loading && <div className="text-text-secondary">Loading…</div>}
			{error && <div className="text-sm text-status-critical">{error}</div>}

			{!loading && correlations.length === 0 && (
				<Card className="border-hairline bg-surface-raised p-8 text-center text-text-tertiary">
					Not enough overlapping history to compute correlations yet. Sync more
					data and check back.
				</Card>
			)}

			<div className="space-y-3">
				{sorted.map((c, i) => {
					const color = correlationHex(c.r);
					const isSignificant = c.p < 0.05;
					const title = `${formatMetricLabel(c.x)} ↔ ${formatMetricLabel(c.y)}${c.lag !== 0 ? ` (${c.lag > 0 ? "+" : ""}${c.lag}d lag)` : ""}`;
					const sentence = `${strengthWord(c.r).charAt(0).toUpperCase() + strengthWord(c.r).slice(1)} ${directionWord(c.r)} relationship (r = ${c.r.toFixed(2)}, n = ${c.n}).`;

					return (
						<Card
							key={i}
							className="border-hairline bg-surface-raised p-5 space-y-3"
						>
							{/* Header */}
							<div className="flex items-start justify-between gap-3">
								<div className="font-semibold text-text-primary leading-snug">
									{title}
								</div>
								<div className="flex items-center gap-2 shrink-0">
									<span
										className="text-xl font-bold tabular-nums"
										style={{ color }}
									>
										{c.r >= 0 ? "+" : ""}
										{c.r.toFixed(2)}
									</span>
									<Badge
										variant="outline"
										className={`text-xs border-hairline ${isSignificant ? "text-status-positive" : "text-text-tertiary"}`}
									>
										{isSignificant ? "p < 0.05" : "n.s."}
									</Badge>
								</div>
							</div>

							{/* r bar */}
							<div className="relative h-2 overflow-hidden rounded-full bg-surface-inset">
								{/* centre mark */}
								<div className="absolute inset-y-0 left-1/2 w-px bg-hairline-strong" />
								{/* fill */}
								<div
									className="absolute inset-y-0 rounded-full"
									style={{
										width: `${Math.abs(c.r) * 50}%`,
										left: c.r >= 0 ? "50%" : `${50 - Math.abs(c.r) * 50}%`,
										backgroundColor: color,
									}}
								/>
							</div>

							{/* Interpretation */}
							<p className="text-sm text-text-secondary">{sentence}</p>

							{/* Footer */}
							<div className="flex gap-4 text-xs text-text-tertiary">
								<span>n = {c.n}</span>
								<span>p = {c.p.toFixed(3)}</span>
								{c.lag !== 0 && <span>lag {c.lag}d</span>}
							</div>
						</Card>
					);
				})}
			</div>
		</div>
	);
}
