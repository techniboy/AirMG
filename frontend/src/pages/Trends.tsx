import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { TrendLine } from "../components/charts/TrendLine";
import { useApi } from "../hooks/useApi";

interface TrendDay {
	day: string;
	recovery?: number | null;
	strain?: number | null;
	hrv_rmssd?: number | null;
	resting_hr?: number | null;
	sleep_performance?: number | null;
	sleep_minutes?: number | null;
	resp_rate?: number | null;
}

interface TrendsResponse {
	days: TrendDay[];
}

type MetricKey =
	| "recovery"
	| "strain"
	| "hrv_rmssd"
	| "resting_hr"
	| "sleep_performance"
	| "sleep_minutes"
	| "resp_rate";
type RangeKey = "7d" | "30d" | "90d";

const METRICS: Array<{
	key: MetricKey;
	label: string;
	color: string;
	unit: string;
	domain?: [number, number];
}> = [
	{
		key: "recovery",
		label: "Recovery",
		color: "#18C98B",
		unit: "%",
		domain: [0, 100],
	},
	{
		key: "strain",
		label: "Strain",
		color: "#E8743B",
		unit: "",
		domain: [0, 21],
	},
	{ key: "hrv_rmssd", label: "HRV", color: "#A879FF", unit: "ms" },
	{ key: "resting_hr", label: "Resting HR", color: "#FF4F73", unit: "bpm" },
	{
		key: "sleep_performance",
		label: "Sleep Perf",
		color: "#5BE0C7",
		unit: "%",
		domain: [0, 100],
	},
	{
		key: "sleep_minutes",
		label: "Sleep Duration",
		color: "#5C6FB1",
		unit: "min",
	},
	{ key: "resp_rate", label: "Resp Rate", color: "#2FC7FF", unit: "rpm" },
];

const RANGES: Array<{ key: RangeKey; label: string; days: number }> = [
	{ key: "7d", label: "7D", days: 7 },
	{ key: "30d", label: "30D", days: 30 },
	{ key: "90d", label: "90D", days: 90 },
];

function endOfToday(): string {
	return new Date().toISOString().slice(0, 10);
}

function startOfRange(days: number): string {
	const d = new Date();
	d.setDate(d.getDate() - days + 1);
	return d.toISOString().slice(0, 10);
}

export default function Trends() {
	const [selectedMetric, setSelectedMetric] = useState<MetricKey>("recovery");
	const [selectedRange, setSelectedRange] = useState<RangeKey>("30d");

	const rangeDays = RANGES.find((r) => r.key === selectedRange)?.days ?? 30;
	const start = startOfRange(rangeDays);
	const end = endOfToday();

	const { data, loading, error } = useApi<TrendsResponse>(
		`/api/trends?start=${start}&end=${end}&metrics=${selectedMetric}`,
	);

	const metricMeta = METRICS.find((m) => m.key === selectedMetric)!;

	const trendPoints = useMemo(() => {
		if (!data?.days) return [];
		return data.days.map((d) => ({
			day: d.day,
			value: (d[selectedMetric] ?? null) as number | null,
		}));
	}, [data, selectedMetric]);

	const validPoints = trendPoints.filter((p) => p.value !== null);
	const avg =
		validPoints.length > 0
			? validPoints.reduce((s, p) => s + (p.value ?? 0), 0) / validPoints.length
			: null;
	const min =
		validPoints.length > 0
			? Math.min(...validPoints.map((p) => p.value!))
			: null;
	const max =
		validPoints.length > 0
			? Math.max(...validPoints.map((p) => p.value!))
			: null;

	return (
		<div className="mx-auto max-w-4xl space-y-6">
			<h1 className="text-2xl font-bold">Trends</h1>

			{/* Metric selector */}
			<div className="flex flex-wrap gap-2">
				{METRICS.map((m) => (
					<button
						key={m.key}
						onClick={() => setSelectedMetric(m.key)}
						className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors border ${
							selectedMetric === m.key
								? "border-transparent text-surface-base"
								: "border-hairline text-text-secondary hover:text-text-primary hover:border-hairline-strong"
						}`}
						style={selectedMetric === m.key ? { backgroundColor: m.color } : {}}
					>
						{m.label}
					</button>
				))}
			</div>

			{/* Range selector */}
			<div className="flex gap-2">
				{RANGES.map((r) => (
					<button
						key={r.key}
						onClick={() => setSelectedRange(r.key)}
						className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
							selectedRange === r.key
								? "bg-accent-muted text-accent"
								: "text-text-secondary hover:bg-surface-overlay hover:text-text-primary"
						}`}
					>
						{r.label}
					</button>
				))}
			</div>

			{loading && <div className="text-text-secondary">Loading…</div>}
			{error && <div className="text-sm text-status-critical">{error}</div>}

			{/* Chart */}
			<Card className="border-hairline bg-surface-raised p-4 space-y-3">
				<div className="flex items-center justify-between">
					<div>
						<div className="text-base font-semibold text-text-primary">
							{metricMeta.label}
						</div>
						<div className="text-xs text-text-tertiary">
							{validPoints.length} readings · {selectedRange}
						</div>
					</div>
					{avg !== null && (
						<div className="text-right">
							<div
								className="text-2xl font-bold tabular-nums"
								style={{ color: metricMeta.color }}
							>
								{avg.toFixed(1)}
							</div>
							<div className="text-xs text-text-tertiary">
								avg{metricMeta.unit ? ` ${metricMeta.unit}` : ""}
							</div>
						</div>
					)}
				</div>

				<TrendLine
					data={trendPoints}
					color={metricMeta.color}
					unit={metricMeta.unit}
					domain={metricMeta.domain}
				/>

				{/* Footer stats */}
				{validPoints.length > 0 && (
					<div className="flex gap-6 border-t border-hairline pt-3 text-sm text-text-tertiary">
						<div>
							Avg{" "}
							<span className="text-text-primary font-medium">
								{avg?.toFixed(1)}
							</span>
						</div>
						<div>
							Min{" "}
							<span className="text-text-primary font-medium">
								{min?.toFixed(1)}
							</span>
						</div>
						<div>
							Max{" "}
							<span className="text-text-primary font-medium">
								{max?.toFixed(1)}
							</span>
						</div>
						<div>
							Days{" "}
							<span className="text-text-primary font-medium">
								{validPoints.length}
							</span>
						</div>
					</div>
				)}
			</Card>
		</div>
	);
}
