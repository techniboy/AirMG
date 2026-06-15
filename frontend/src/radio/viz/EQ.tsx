import { fmt, RECOVERY_RAMP as GOOD } from "../metricColors";
import { useTipBind } from "../tooltip";
import { useRadioPhase } from "../phase";

const ZONE = ["#16d8e8", "#5BD3A0", "#E8C24B", "#E8743B", "#ff2d78"];
// GOOD = recovery ramp (low→high, red→green) for "more is better" metrics.

export function EQ({
	data,
	height = 100,
	rows = 13,
	colorMode = "zone",
	labels,
	unit = "",
	color,
}: {
	data: number[];
	height?: number;
	rows?: number;
	/** "zone" (HR), "value" (greener taller), "ladder" (recovery bands by row). */
	colorMode?: "zone" | "value" | "ladder";
	labels?: string[];
	unit?: string;
	/** tint for the hover readout (defaults to the column's own colour) */
	color?: string;
}) {
	const { tokens } = useRadioPhase();
	const bind = useTipBind();
	const max = Math.max(1, ...data);
	return (
		<div
			style={{
				display: "flex",
				alignItems: "flex-end",
				gap: 3,
				height,
				width: "100%",
			}}
		>
			{data.map((v, c) => {
				const lit = Math.round((v / max) * rows);
				const colCol = GOOD[Math.min(4, Math.floor((v / max) * 5))];
				return (
					<div
						key={c}
						{...bind(`${fmt(v)}${unit ? ` ${unit}` : ""}`, labels?.[c], color ?? colCol)}
						style={{
							flex: 1,
							display: "flex",
							flexDirection: "column-reverse",
							gap: 2,
							height: "100%",
							cursor: "crosshair",
						}}
					>
						{Array.from({ length: rows }, (_, i) => {
							const on = i < lit;
							const peak = i === lit;
							const rowFrac = Math.min(4, Math.floor((i / rows) * 5));
							const color =
								colorMode === "value"
									? colCol
									: colorMode === "ladder"
										? GOOD[rowFrac]
										: ZONE[rowFrac];
							const filled = on || peak;
							return (
								<span
									key={i}
									style={{
										height: 6,
										borderRadius: 1,
										background: peak ? "#fff" : on ? color : "transparent",
										border: filled
											? "none"
											: "1px solid rgba(255,255,255,0.10)",
										boxShadow: peak
											? "0 0 6px #fff"
											: on && tokens.glow > 0.3
												? `0 0 ${(3 + 3 * tokens.glow).toFixed(0)}px ${color}`
												: "none",
										opacity: filled ? 0.5 + 0.5 * tokens.glow : 1,
									}}
								/>
							);
						})}
					</div>
				);
			})}
		</div>
	);
}
