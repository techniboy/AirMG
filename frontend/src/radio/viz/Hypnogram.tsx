import { useRadioPhase } from "../phase";

const STAGE = { wake: { y: 0, c: "#E0476B" }, rem: { y: 1, c: "#5BE0C7" }, light: { y: 2, c: "#5C6FB1" }, deep: { y: 3, c: "#2C3A7A" } } as const;
type Stage = keyof typeof STAGE;

export function Hypnogram({ segments, width = 640, height = 160 }: { segments: { stage: Stage; minutes: number }[]; width?: number; height?: number }) {
	const { tokens } = useRadioPhase();
	const total = Math.max(1, segments.reduce((a, s) => a + s.minutes, 0));
	const bandH = height / 4;
	const yFor = (s: Stage) => STAGE[s].y * bandH + bandH / 2;
	let x = 0;
	const rects = segments.map((seg, i) => {
		const w = (seg.minutes / total) * width;
		const y = STAGE[seg.stage].y * bandH + bandH * 0.25;
		const c = STAGE[seg.stage].c;
		const r = <rect key={i} x={x} y={y} width={Math.max(1, w - 1)} height={bandH * 0.5} rx={2} fill={c} opacity={0.55 + 0.45 * tokens.glow} style={tokens.glow > 0.3 ? { filter: `drop-shadow(0 0 5px ${c})` } : undefined} />;
		x += w;
		return r;
	});
	x = 0;
	let d = "";
	segments.forEach((seg, i) => {
		const y = yFor(seg.stage);
		d += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
		x += (seg.minutes / total) * width;
		d += ` L ${x} ${y}`;
	});
	return (
		<svg width="100%" viewBox={`0 0 ${width} ${height}`} style={{ overflow: "visible" }}>
			{(["wake", "rem", "light", "deep"] as Stage[]).map((s) => (
				<text key={s} x={2} y={yFor(s) + 3} fontSize={8} fontFamily="ui-monospace,monospace" letterSpacing={1} fill={tokens.cp ? "#3a6b78" : "#6f6a82"}>{s.toUpperCase()}</text>
			))}
			<path d={d} fill="none" stroke={tokens.cp ? "#7fd0ea" : "#16d8e8"} strokeWidth={1} opacity={0.4} />
			{rects}
		</svg>
	);
}
