import { recoveryColor } from "../../lib/colors";
import type { DailyMetrics } from "../../lib/types";

interface WeekStripProps {
	days: DailyMetrics[];
}

export function WeekStrip({ days }: WeekStripProps) {
	const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
	return (
		<div className="flex gap-2">
			{days.map((d) => {
				const dt = new Date(`${d.day}T00:00:00`);
				return (
					<div key={d.day} className="flex flex-col items-center gap-1">
						<span className="text-xs text-text-secondary">
							{dayLabels[dt.getDay()]}
						</span>
						<div className={`text-lg font-bold ${recoveryColor(d.recovery)}`}>
							{d.recovery !== null ? Math.round(d.recovery) : "--"}
						</div>
						<span className="text-xs text-text-secondary">
							{d.strain !== null ? d.strain.toFixed(1) : "--"}
						</span>
					</div>
				);
			})}
		</div>
	);
}
