import { useMemo } from "react";
import { useRadioPhase } from "../phase";

const REC = ["#FF4F73", "#F5A623", "#E8C24B", "#18C98B", "#2FE6A8"];

export function Skyline({ data, height = 140 }: { data: number[]; height?: number }) {
	const { tokens } = useRadioPhase();
	const max = Math.max(1, ...data);

	// Per-tower lit-window pattern. Computed once per (data.length, cp) so windows
	// don't re-randomize on every render (phase ticks each minute).
	const windows = useMemo(() => {
		const litChance = tokens.cp ? 0.4 : 0.85;
		return data.map((v) => {
			const h = (v / max) * height;
			const rows = Math.max(2, Math.round(h / 9));
			return Array.from({ length: rows * 2 }, () => Math.random() < litChance);
		});
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [data.length, tokens.cp]);

	return (
		<div style={{ display: "flex", alignItems: "flex-end", gap: 4, height, padding: "0 4px" }}>
			{data.map((v, i) => {
				const h = (v / max) * height;
				const c = REC[Math.min(4, Math.floor((v / max) * 5))];
				const cells = windows[i] ?? [];
				return (
					<div key={i} style={{ flex: 1, height: h, border: `1px solid ${tokens.cp ? "#5a6a86" : "#241634"}`, borderBottom: "none", borderRadius: "2px 2px 0 0", background: tokens.cp ? "#2a3a52" : "#0a0616", display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 2, padding: 3, alignContent: "start" }}>
						{cells.map((on, k) => (
							<span key={k} style={{ aspectRatio: "1", borderRadius: 1, background: on ? c : "#1a1228", opacity: on ? 0.5 + 0.5 * tokens.glow : 0.4, boxShadow: on && tokens.glow > 0.3 ? `0 0 ${(2 + 4 * tokens.glow).toFixed(0)}px ${c}` : "none" }} />
						))}
					</div>
				);
			})}
		</div>
	);
}

export function Spire({ data, width = 200, height = 80 }: { data: number[]; width?: number; height?: number }) {
	const { tokens } = useRadioPhase();
	const max = Math.max(1, ...data);
	const step = width / Math.max(1, data.length - 1);
	const pts = data.map((v, i) => `${(i * step).toFixed(1)},${(height - (v / max) * height).toFixed(1)}`).join(" ");
	const id = `spire-${Math.round(max * 100)}`;
	return (
		<svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: "visible" }}>
			<defs>
				<linearGradient id={id} x1="0" y1="1" x2="0" y2="0">
					<stop offset="0" stopColor="#8a4dff" /><stop offset=".5" stopColor="#ff2d78" /><stop offset="1" stopColor="#16d8e8" />
				</linearGradient>
				<filter id={`f${id}`}><feGaussianBlur stdDeviation={(0.6 + 1.4 * tokens.glow).toFixed(1)} result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
			</defs>
			<polyline points={pts} fill="none" stroke={`url(#${id})`} strokeWidth={2} opacity={0.6 + 0.38 * tokens.glow} filter={`url(#f${id})`} />
		</svg>
	);
}
