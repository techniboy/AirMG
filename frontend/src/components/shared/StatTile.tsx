import { Sparkline } from "../charts/Sparkline";

interface StatTileProps {
	label: string;
	value: string;
	caption?: string;
	color?: string;
	sparkline?: (number | null)[];
	sparkColor?: string;
	delta?: string;
	deltaColor?: string;
}

export function StatTile({
	label,
	value,
	caption,
	color = "text-text-primary",
	sparkline,
	sparkColor,
	delta,
	deltaColor = "text-text-tertiary",
}: StatTileProps) {
	return (
		<div className="bg-surface-raised border-hairline rounded-xl p-3 min-h-[90px] flex justify-between">
			<div className="flex flex-col justify-between min-w-0">
				<div className="text-[11px] text-text-tertiary">{label}</div>
				<div className={`text-2xl font-bold tabular-nums ${color}`}>
					{value}
				</div>
				{caption && (
					<div className="text-[11px] text-text-tertiary">{caption}</div>
				)}
				{delta && (
					<div className={`text-[11px] ${deltaColor}`}>{delta}</div>
				)}
			</div>
			{sparkline && sparkline.length >= 2 && (
				<div className="flex items-end shrink-0 ml-2">
					<Sparkline values={sparkline} color={sparkColor ?? "#888"} />
				</div>
			)}
		</div>
	);
}
