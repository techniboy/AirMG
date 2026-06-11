import { Card } from "@/components/ui/card";

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
