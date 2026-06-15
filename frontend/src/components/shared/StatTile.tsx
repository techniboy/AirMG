import { useAtomValue } from "jotai";
import { themeAtom } from "../../atoms/theme";
import { Sparkline } from "../charts/Sparkline";
import { Billboard } from "../../radio/viz/Billboard";
import { Spire } from "../../radio/viz/Skyline";
import { Traffic } from "../../radio/viz/Traffic";
import { metricColor } from "../../radio/metricColors";

interface StatTileProps {
	label: string;
	value: string;
	caption?: string;
	color?: string;
	sparkline?: (number | null)[];
	sparkColor?: string;
	delta?: string;
	deltaColor?: string;
	/** Radio theme: pick a non-default form for this tile's mini-viz. */
	radioForm?: "traffic";
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
	radioForm,
}: StatTileProps) {
	const theme = useAtomValue(themeAtom);
	const spark = sparkline?.filter((v): v is number => v !== null) ?? [];
	const hasSpark = spark.length >= 2;

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
				<Billboard value={value} label={caption} color={mc} />
				{delta && (
					<div style={{ fontSize: 10, color: "#7fe0a0" }}>{delta}</div>
				)}
				{radioForm === "traffic" ? (
					<Traffic height={36} />
				) : hasSpark ? (
					<Spire data={spark} height={34} color={mc} unit={caption} />
				) : null}
			</div>
		);
	}

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
