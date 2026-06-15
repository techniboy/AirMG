import { useRadioPhase } from "../phase";
import { useTipBind } from "../tooltip";

const STAGE = {
	wake: { y: 0, c: "#E0476B", label: "Awake" },
	rem: { y: 1, c: "#5BE0C7", label: "REM" },
	light: { y: 2, c: "#5C6FB1", label: "Light" },
	deep: { y: 3, c: "#2C3A7A", label: "Deep" },
} as const;
type Stage = keyof typeof STAGE;

const PAD_L = 40; // gutter for the stage labels so they don't sit over the plot

function fmtClock(ts: number): string {
	return new Date(ts * 1000).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function Hypnogram({
	segments,
	startTs,
	endTs,
	width = 640,
	height = 160,
}: {
	segments: { stage: Stage; minutes: number }[];
	startTs?: number;
	endTs?: number;
	width?: number;
	height?: number;
}) {
	const { tokens } = useRadioPhase();
	const bind = useTipBind();
	const total = Math.max(1, segments.reduce((a, s) => a + s.minutes, 0));
	const plotW = width - PAD_L - 4;
	const bandH = height / 4;
	const yFor = (s: Stage) => STAGE[s].y * bandH + bandH / 2;

	// Cumulative minutes before each segment → x without mutating an outer var.
	const cum: number[] = [];
	segments.reduce((a, s) => (cum.push(a), a + s.minutes), 0);
	const xAt = (i: number) => PAD_L + (cum[i] / total) * plotW;
	const wAt = (i: number) => (segments[i].minutes / total) * plotW;

	const rects = segments.map((seg, i) => {
		const y = STAGE[seg.stage].y * bandH + bandH * 0.25;
		const c = STAGE[seg.stage].c;
		return (
			<rect
				key={i}
				{...bind(`${Math.round(seg.minutes)} min`, STAGE[seg.stage].label, c)}
				x={xAt(i)}
				y={y}
				width={Math.max(1, wAt(i) - 1)}
				height={bandH * 0.5}
				rx={2}
				fill={c}
				opacity={0.55 + 0.45 * tokens.glow}
				style={{
					cursor: "crosshair",
					...(tokens.glow > 0.3 ? { filter: `drop-shadow(0 0 5px ${c})` } : {}),
				}}
			/>
		);
	});

	const d = segments
		.map((seg, i) => {
			const y = yFor(seg.stage);
			const x0 = xAt(i);
			return `${i === 0 ? `M ${x0} ${y}` : `L ${x0} ${y}`} L ${x0 + wAt(i)} ${y}`;
		})
		.join(" ");

	const axisColor = tokens.cp ? "#3a6b78" : "#6f6a82";
	const ticks =
		startTs != null && endTs != null
			? [
					{ x: PAD_L, anchor: "start" as const, ts: startTs },
					{ x: PAD_L + plotW / 2, anchor: "middle" as const, ts: (startTs + endTs) / 2 },
					{ x: PAD_L + plotW, anchor: "end" as const, ts: endTs },
				]
			: [];

	return (
		<svg
			width="100%"
			viewBox={`0 0 ${width} ${height + (ticks.length ? 18 : 0)}`}
			style={{ overflow: "visible" }}
		>
			{(["wake", "rem", "light", "deep"] as Stage[]).map((s) => (
				<text
					key={s}
					x={2}
					y={yFor(s) + 3}
					fontSize={8}
					fontFamily="ui-monospace,monospace"
					letterSpacing={1}
					fill={tokens.cp ? "#3a6b78" : "#6f6a82"}
				>
					{STAGE[s].label.toUpperCase()}
				</text>
			))}
			<path
				d={d}
				fill="none"
				stroke={tokens.cp ? "#7fd0ea" : "#16d8e8"}
				strokeWidth={1}
				opacity={0.4}
			/>
			{rects}
			{ticks.map((t) => (
				<text
					key={t.anchor}
					x={t.x}
					y={height + 12}
					fontSize={8}
					fontFamily="ui-monospace,monospace"
					letterSpacing={0.5}
					textAnchor={t.anchor}
					fill={axisColor}
				>
					{fmtClock(t.ts)}
				</text>
			))}
		</svg>
	);
}
