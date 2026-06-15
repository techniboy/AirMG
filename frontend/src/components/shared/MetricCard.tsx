import { useAtomValue } from "jotai";
import { Card } from "@/components/ui/card";
import { themeAtom } from "../../atoms/theme";
import { Billboard } from "../../radio/viz/Billboard";
import { metricColor } from "../../radio/metricColors";

interface MetricCardProps {
	label: string;
	value: string;
	unit?: string;
	color?: string;
}

export function MetricCard({
	label,
	value,
	unit,
	color = "text-text-primary",
}: MetricCardProps) {
	const theme = useAtomValue(themeAtom);

	if (theme === "radio") {
		const mc = metricColor(label);
		return (
			<div
				className="radio-card"
				style={{
					minHeight: 96,
					display: "flex",
					flexDirection: "column",
					justifyContent: "space-between",
					gap: 8,
					borderColor: `${mc}3a`,
				}}
			>
				<div
					style={{
						fontSize: 9,
						letterSpacing: ".16em",
						textTransform: "uppercase",
						color: mc,
						textShadow: `0 0 6px ${mc}66`,
					}}
				>
					{label}
				</div>
				<Billboard value={value} label={unit} color={mc} />
			</div>
		);
	}

	return (
		<Card className="border-hairline bg-surface-raised p-4">
			<div className="text-xs text-text-secondary">{label}</div>
			<div className={`mt-1 text-2xl font-bold ${color}`}>
				{value}
				{unit && (
					<span className="ml-1 text-sm font-normal text-text-secondary">
						{unit}
					</span>
				)}
			</div>
		</Card>
	);
}
