import { useMemo, useEffect } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { Card } from "@/components/ui/card";
import { TrendLine } from "../components/charts/TrendLine";
import { YearHeatStrip } from "../components/charts/YearHeatStrip";
import { trendsAtom, trendsRangeAtom, trendsMetricAtom, yearRecoveryAtom } from "../atoms/api";

type MetricKey =
	| "recovery"
	| "strain"
	| "hrv_rmssd"
	| "resting_hr"
	| "sleep_performance"
	| "sleep_minutes"
	| "resp_rate";
type RangeKey = "7d" | "30d" | "90d" | "6m" | "1y" | "all";

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

// Radio-theme form per metric: "reach the green" ladders for good-high metrics,
// hot zone bars for metrics where higher is worse.
const RADIO_FORM: Record<MetricKey, "eq-ladder" | "eq"> = {
	recovery: "eq-ladder",
	hrv_rmssd: "eq-ladder",
	sleep_performance: "eq-ladder",
	sleep_minutes: "eq-ladder",
	strain: "eq",
	resting_hr: "eq",
	resp_rate: "eq",
};

const RANGES: Array<{ key: RangeKey; label: string }> = [
	{ key: "7d", label: "7D" },
	{ key: "30d", label: "30D" },
	{ key: "90d", label: "90D" },
	{ key: "6m", label: "6M" },
	{ key: "1y", label: "1Y" },
	{ key: "all", label: "ALL" },
];

export default function Trends() {
	const selectedMetric = useAtomValue(trendsMetricAtom) as MetricKey;
	const setSelectedMetric = useSetAtom(trendsMetricAtom);
	const selectedRange = useAtomValue(trendsRangeAtom);
	const setSelectedRange = useSetAtom(trendsRangeAtom);

	const { data, isPending, error } = useAtomValue(trendsAtom);
	const { data: yearData } = useAtomValue(yearRecoveryAtom);

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

	useEffect(() => {
		if (!isPending && trendPoints.length === 0) {
			const rangeOrder: RangeKey[] = ["7d", "30d", "90d", "6m", "1y", "all"];
			const idx = rangeOrder.indexOf(selectedRange);
			if (idx < rangeOrder.length - 1) {
				setSelectedRange(rangeOrder[idx + 1]);
			}
		}
	}, [isPending, trendPoints.length, selectedRange, setSelectedRange]);

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

			{isPending && <div className="text-text-secondary">Loading…</div>}
			{error && <div className="text-sm text-status-critical">{String(error)}</div>}

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
					radioForm={RADIO_FORM[selectedMetric]}
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

			{/* Supporting metrics */}
			<div className="grid gap-3 sm:grid-cols-3">
				{[
					{ key: "hrv_rmssd", label: "HRV", color: "#A879FF", unit: "ms" },
					{ key: "resting_hr", label: "Resting HR", color: "#FF4F73", unit: "bpm" },
					{ key: "strain", label: "Strain", color: "#E8743B", unit: "" },
				]
					.filter((m) => m.key !== selectedMetric)
					.map((m) => {
						const pts =
							data?.days?.map((d) => ({
								day: d.day,
								value: d[m.key as keyof typeof d] as number | null,
							})) ?? [];
						return (
							<Card key={m.key} className="border-hairline bg-surface-raised p-3 space-y-1">
								<div className="text-xs text-text-tertiary">{m.label}</div>
								{pts.length >= 2 && <TrendLine data={pts} color={m.color} radioForm="spire" />}
							</Card>
						);
					})}
			</div>

			{/* Year heat strip */}
			{yearData?.days && yearData.days.length > 0 && (
				<Card className="border-hairline bg-surface-raised p-4 space-y-2">
					<div className="text-sm font-medium text-text-secondary">Recovery · Past Year</div>
					<YearHeatStrip data={yearData.days.map((d) => ({ day: d.day, value: d.recovery }))} />
				</Card>
			)}
		</div>
	);
}
