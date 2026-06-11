import { useState } from "react";
import { Card } from "@/components/ui/card";
import { RecoveryGauge } from "../components/charts/RecoveryGauge";
import { TrendLine } from "../components/charts/TrendLine";
import { MetricCard } from "../components/shared/MetricCard";
import { useApi } from "../hooks/useApi";
import { formatScore } from "../lib/format";
import type { DailyMetrics } from "../lib/types";

interface RecoveryDetail {
	day: string;
	recovery: number | null;
	hrv_rmssd: number | null;
	resting_hr: number | null;
	resp_rate: number | null;
	sleep_performance: number | null;
}

interface TrendResponse {
	days: DailyMetrics[];
}

function todayStr() {
	return new Date().toISOString().slice(0, 10);
}

function offsetDay(base: string, delta: number): string {
	const d = new Date(`${base}T00:00:00`);
	d.setDate(d.getDate() + delta);
	return d.toISOString().slice(0, 10);
}

export default function Recovery() {
	const [selectedDay, setSelectedDay] = useState(todayStr());
	const { data, loading, error } = useApi<RecoveryDetail>(
		`/api/recovery/${selectedDay}`,
	);
	const { data: trendData } = useApi<TrendResponse>("/api/week");

	// Build 14-day trend points from the week data (backend returns last 7; we use what we have)
	const trendPoints =
		trendData?.days?.map((d) => ({ day: d.day, value: d.recovery })) ?? [];

	return (
		<div className="mx-auto max-w-4xl space-y-6">
			{/* Header + date nav */}
			<div className="flex items-center justify-between">
				<h1 className="text-2xl font-bold">Recovery</h1>
				<div className="flex items-center gap-2">
					<button
						className="rounded-lg border border-hairline bg-surface-raised px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors"
						onClick={() => setSelectedDay((d) => offsetDay(d, -1))}
					>
						←
					</button>
					<span className="min-w-[100px] text-center text-sm text-text-secondary">
						{selectedDay}
					</span>
					<button
						className="rounded-lg border border-hairline bg-surface-raised px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors"
						onClick={() => setSelectedDay((d) => offsetDay(d, 1))}
						disabled={selectedDay >= todayStr()}
					>
						→
					</button>
					<button
						className="rounded-lg border border-hairline bg-surface-raised px-3 py-1.5 text-sm text-accent hover:opacity-80"
						onClick={() => setSelectedDay(todayStr())}
					>
						Today
					</button>
				</div>
			</div>

			{loading && <div className="text-text-secondary">Loading…</div>}
			{error && <div className="text-sm text-status-critical">{error}</div>}

			{!loading && !data && (
				<Card className="border-hairline bg-surface-raised p-8 text-center text-text-tertiary">
					No recovery data for {selectedDay}.
				</Card>
			)}

			{data && (
				<>
					{/* Hero: gauge centered */}
					<Card className="border-hairline bg-surface-raised p-8">
						<div className="flex flex-col items-center gap-4">
							<RecoveryGauge score={data.recovery} size={220} />
							<div className="text-sm text-text-tertiary">
								Recovery score for {selectedDay}
							</div>
						</div>
					</Card>

					{/* Contributing factors */}
					<div>
						<div className="mb-3 text-xs uppercase tracking-widest text-text-tertiary">
							Contributing Factors
						</div>
						<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
							<MetricCard
								label="HRV"
								value={formatScore(data.hrv_rmssd, 0)}
								unit="ms"
								color="text-metric-purple"
							/>
							<MetricCard
								label="Resting HR"
								value={formatScore(data.resting_hr, 0)}
								unit="bpm"
								color="text-metric-rose"
							/>
							<MetricCard
								label="Resp Rate"
								value={formatScore(data.resp_rate, 1)}
								unit="rpm"
								color="text-metric-cyan"
							/>
							<MetricCard
								label="Sleep Perf"
								value={
									data.sleep_performance != null
										? `${Math.round(data.sleep_performance)}`
										: "--"
								}
								unit="%"
								color="text-accent"
							/>
						</div>
					</div>

					{/* Trend line */}
					{trendPoints.length >= 2 && (
						<Card className="border-hairline bg-surface-raised p-4 space-y-2">
							<div className="text-sm font-medium text-text-secondary">
								Recovery Trend
							</div>
							<TrendLine data={trendPoints} color="#18C98B" domain={[0, 100]} />
						</Card>
					)}
				</>
			)}
		</div>
	);
}
