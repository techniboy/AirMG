import { useAtomValue } from "jotai";
import { Card } from "@/components/ui/card";
import { strainDayAtom, strainDetailAtom } from "../atoms/api";
import { StrainGauge } from "../components/charts/StrainGauge";
import { TrendLine } from "../components/charts/TrendLine";
import { DateNav } from "../components/shared/DateNav";
import { MetricCard } from "../components/shared/MetricCard";
import { AlgoInfo } from "../components/shared/AlgoInfo";
import { formatScore } from "../lib/format";

export default function Strain() {
	const { data, isPending, error } = useAtomValue(strainDetailAtom);

	const trendPoints =
		data?.trend?.map((d) => ({ day: d.day, value: d.strain })) ?? [];

	return (
		<div className="mx-auto max-w-4xl space-y-6">
			<div className="flex items-center justify-between">
				<h1 className="text-2xl font-bold">Strain</h1>
				<DateNav dayAtom={strainDayAtom} />
			</div>

			{isPending && <div className="text-text-secondary">Loading…</div>}
			{error && <div className="text-sm text-status-critical">{String(error)}</div>}

			{!isPending && !data && (
				<Card className="border-hairline bg-surface-raised p-8 text-center text-text-tertiary">
					No strain data for this day.
				</Card>
			)}

			{data && (
				<>
					<Card className="border-hairline bg-surface-raised p-8">
						<div className="flex flex-col items-center gap-4">
							<StrainGauge strain={data.strain} size={220} />
							<div className="text-sm text-text-tertiary flex items-center gap-1.5">
								Day strain for {data.day} <AlgoInfo algo="strain" />
							</div>
						</div>
					</Card>

					<div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
						<MetricCard
							label="Calories"
							value={
								data.calories != null
									? Math.round(data.calories).toLocaleString()
									: "--"
							}
							unit="kcal"
							color="text-metric-amber"
						/>
						<MetricCard
							label="Avg HR"
							value={formatScore(data.avg_hr, 0)}
							unit="bpm"
							color="text-metric-rose"
						/>
						<MetricCard
							label="Max HR"
							value={formatScore(data.max_hr, 0)}
							unit="bpm"
							color="text-status-critical"
						/>
					</div>

					{trendPoints.length >= 2 && (
						<Card className="border-hairline bg-surface-raised p-4 space-y-2">
							<div className="text-sm font-medium text-text-secondary">
								7-Day Strain Trend
							</div>
							<TrendLine
								data={trendPoints}
								color="#E8743B"
								domain={[0, 21]}
								radioForm="eq"
								xTitle="Day"
								yTitle="strain"
							/>
						</Card>
					)}
				</>
			)}
		</div>
	);
}
