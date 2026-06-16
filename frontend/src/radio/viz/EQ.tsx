import { ChartScroll } from "../../components/charts/ChartScroll";
import { fmt, RECOVERY_RAMP as GOOD } from "../metricColors";
import { useTipBind } from "../tooltip";
import { useRadioPhase } from "../phase";

const ZONE = ["#16d8e8", "#5BD3A0", "#E8C24B", "#E8743B", "#ff2d78"];
// GOOD = recovery ramp (low→high, red→green) for "more is better" metrics.

// Safety cap only — render every backend point up to this; bars shrink + the gap
// narrows to fit. Beyond this we average down so the DOM doesn't explode.
const MAX_COLS = 600;
function downsample(d: number[], n: number): number[] {
	const out: number[] = [];
	for (let i = 0; i < n; i++) {
		const s = Math.floor((i * d.length) / n);
		const e = Math.max(s + 1, Math.floor(((i + 1) * d.length) / n));
		const chunk = d.slice(s, e);
		out.push(chunk.reduce((a, b) => a + b, 0) / chunk.length);
	}
	return out;
}

export function EQ({
	data: rawData,
	height = 100,
	rows = 13,
	colorMode = "zone",
	labels: rawLabels,
	unit = "",
	color,
	xTitle,
	yTitle,
	showLabels = false,
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
	/** axis titles (e.g. xTitle="Hour", yTitle="bpm") */
	xTitle?: string;
	yTitle?: string;
	/** render per-column labels as an x-axis tick row */
	showLabels?: boolean;
}) {
	const { tokens } = useRadioPhase();
	const bind = useTipBind();
	// Too many points → average down; labels can't survive bucketing, drop them.
	const data = rawData.length > MAX_COLS ? downsample(rawData, MAX_COLS) : rawData;
	const labels = rawData.length > MAX_COLS ? undefined : rawLabels;
	const max = Math.max(1, ...data);
	// Narrow the gap when there are many bars so a full day of points fits.
	const gap = data.length > 80 ? 1 : 3;
	// Show ~8 evenly-spaced tick labels (rendering all 250 would be unreadable).
	const tickStep = Math.max(1, Math.ceil(data.length / 8));
	const axisStyle = {
		fontSize: 8,
		letterSpacing: ".12em",
		textTransform: "uppercase" as const,
		color: "var(--mut)",
	};
	const bars = (
		<div
			style={{
				display: "flex",
				alignItems: "flex-end",
				gap,
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

	const cw = Math.max(420, data.length * 7);
	if (!xTitle && !yTitle && !showLabels) return <ChartScroll minWidth={cw}>{bars}</ChartScroll>;
	return (
		<ChartScroll minWidth={cw}>
		<div style={{ display: "flex", gap: 6, width: "100%" }}>
			{yTitle && (
				<div
					style={{
						...axisStyle,
						writingMode: "vertical-rl",
						transform: "rotate(180deg)",
						alignSelf: "center",
					}}
				>
					{yTitle}
				</div>
			)}
			<div style={{ flex: 1, minWidth: 0 }}>
				{bars}
				{showLabels && (
					<div style={{ display: "flex", gap, marginTop: 3 }}>
						{data.map((_, c) => (
							<span
								key={c}
								style={{
									flex: 1,
									minWidth: 0,
									textAlign: "center",
									fontSize: 7,
									color: "var(--mut)",
									whiteSpace: "nowrap",
									overflow: "visible",
								}}
							>
								{c % tickStep === 0 ? (labels?.[c] ?? "") : ""}
							</span>
						))}
					</div>
				)}
				{xTitle && (
					<div style={{ ...axisStyle, textAlign: "center", marginTop: 2 }}>{xTitle}</div>
				)}
			</div>
		</div>
		</ChartScroll>
	);
}
