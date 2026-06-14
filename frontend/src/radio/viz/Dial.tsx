import { useRadioPhase } from "../phase";

export interface DialProps {
	frac: number; // 0..1 fill
	colAt: (f: number) => string; // segment color by position 0..1
	tip: string; // word color
	lcd: string; // readout color (night)
	label: string; // big readout text
	word: string; // status word
	size?: number;
}

function polar(cx: number, cy: number, r: number, deg: number) {
	const rad = (deg * Math.PI) / 180;
	return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}
function arcP(cx: number, cy: number, r: number, a0: number, a1: number) {
	const s = polar(cx, cy, r, a0),
		e = polar(cx, cy, r, a1);
	const la = a1 - a0 > 180 ? 1 : 0;
	return `M ${s.x} ${s.y} A ${r} ${r} 0 ${la} 1 ${e.x} ${e.y}`;
}

export function Dial({
	frac,
	colAt,
	tip,
	lcd,
	label,
	word,
	size = 120,
}: DialProps) {
	const { tokens } = useRadioPhase();
	const day = tokens.cp;
	const cx = size / 2,
		cy = size / 2;
	const START = 150,
		SPAN = 240,
		N = 26,
		r = size * 0.4;
	const lit = Math.round(N * Math.min(Math.max(frac, 0), 1));
	const segs = Array.from({ length: N }, (_, i) => {
		const a0 = START + (SPAN * (i + 0.12)) / N,
			a1 = START + (SPAN * (i + 0.88)) / N;
		const f = i / (N - 1),
			on = i < lit,
			c = colAt(f);
		return on ? (
			<path
				key={i}
				d={arcP(cx, cy, r, a0, a1)}
				fill="none"
				stroke={c}
				strokeWidth={size * 0.085}
				opacity={day ? 0.95 : 1}
				style={day ? undefined : { filter: `drop-shadow(0 0 4px ${c})` }}
			/>
		) : (
			<path
				key={i}
				d={arcP(cx, cy, r, a0, a1)}
				fill="none"
				stroke={day ? "#b9c6d2" : "#241a30"}
				strokeWidth={size * 0.085}
				opacity={day ? 0.6 : 0.8}
			/>
		);
	});
	const lw = label.length * 12 + 12,
		lh = 26;
	const lcdc = day ? "#7fd0ea" : lcd;
	return (
		<svg
			width={size}
			height={size}
			viewBox={`0 0 ${size} ${size}`}
			style={{ overflow: "visible" }}
		>
			<circle
				cx={cx}
				cy={cy}
				r={size * 0.49}
				fill={day ? "#dfe7ef" : "#0d0a16"}
				stroke={day ? "#aab8c6" : "#2a1f38"}
				strokeWidth={3}
			/>
			<circle
				cx={cx}
				cy={cy}
				r={size * 0.455}
				fill="none"
				stroke={day ? "#fff" : "#1a1228"}
				strokeWidth={1.5}
				opacity={0.7}
			/>
			{segs}
			<rect
				x={cx - lw / 2}
				y={cy - lh / 2}
				width={lw}
				height={lh}
				rx={3}
				fill={day ? "#0a2233" : "#0a0f0a"}
				stroke={day ? "#1a5fa8" : "#1a2a1a"}
				strokeWidth={1.5}
				opacity={0.92}
			/>
			<text
				x={cx}
				y={cy + 1}
				textAnchor="middle"
				dominantBaseline="central"
				fontFamily="ui-monospace,monospace"
				fontSize={19}
				fontWeight={800}
				fontStyle="italic"
				letterSpacing={2}
				fill={lcdc}
				style={day ? undefined : { filter: `drop-shadow(0 0 5px ${lcdc})` }}
			>
				{label}
			</text>
			<text
				x={cx}
				y={cy + size * 0.17}
				textAnchor="middle"
				fontSize={8}
				fontWeight={700}
				letterSpacing={2}
				fill={day ? "#0e3a66" : tip}
				style={day ? undefined : { filter: `drop-shadow(0 0 5px ${tip})` }}
			>
				{word}
			</text>
		</svg>
	);
}
