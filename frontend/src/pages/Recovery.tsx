import { useAtomValue } from "jotai";
import { Card } from "@/components/ui/card";
import { recoveryDayAtom, recoveryDetailAtom, weekMetricsAtom } from "../atoms/api";
import { RecoveryGauge } from "../components/charts/RecoveryGauge";
import { TrendLine } from "../components/charts/TrendLine";
import { DateNav } from "../components/shared/DateNav";
import { MetricCard } from "../components/shared/MetricCard";
import { AlgoInfo } from "../components/shared/AlgoInfo";
import { formatScore } from "../lib/format";

export default function Recovery() {
	const { data, isPending, error } = useAtomValue(recoveryDetailAtom);
	const { data: trendData } = useAtomValue(weekMetricsAtom);

	const trendPoints =
		trendData?.days?.map((d) => ({ day: d.day, value: d.recovery })) ?? [];

	return (
		<div className="mx-auto max-w-4xl space-y-6">
			<div className="flex items-center justify-between">
				<h1 className="text-2xl font-bold">Recovery</h1>
				<DateNav dayAtom={recoveryDayAtom} />
			</div>

			{isPending && <div className="text-text-secondary">Loading…</div>}
			{error && <div className="text-sm text-status-critical">{String(error)}</div>}

			{!isPending && !data && (
				<Card className="border-hairline bg-surface-raised p-8 text-center text-text-tertiary">
					No recovery data for this day.
				</Card>
			)}

			{data && (
				<>
					<Card className="border-hairline bg-surface-raised p-8">
						<div className="flex flex-col items-center gap-4">
							<RecoveryGauge score={data.recovery} size={220} />
							<div className="text-sm text-text-tertiary flex items-center gap-1.5">
								Recovery score for {data.day} <AlgoInfo algo="recovery" />
							</div>
						</div>
					</Card>

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

					{trendPoints.length >= 2 && (
						<Card className="border-hairline bg-surface-raised p-4 space-y-2">
							<div className="text-sm font-medium text-text-secondary">
								Recovery Trend
							</div>
							<TrendLine
								data={trendPoints}
								color="#18C98B"
								domain={[0, 100]}
								radioForm="eq-ladder"
								unit="%"
								xTitle="Day"
								yTitle="%"
							/>
						</Card>
					)}
				</>
			)}
		</div>
	);
}
