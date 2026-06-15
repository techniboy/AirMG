import { useMemo } from "react";
import { fmt, RECOVERY_RAMP as REC } from "../metricColors";
import { useRadioPhase } from "../phase";
import { useTipBind } from "../tooltip";

export function Skyline({
	data,
	height = 140,
	labels,
	unit = "",
}: {
	data: number[];
	height?: number;
	labels?: string[];
	unit?: string;
}) {
	const { tokens } = useRadioPhase();
	const bind = useTipBind();
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
					<div
						key={i}
						{...bind(`${fmt(v)}${unit ? ` ${unit}` : ""}`, labels?.[i], c)}
						style={{ flex: 1, height: h, border: `1px solid ${tokens.cp ? "#5a6a86" : "#241634"}`, borderBottom: "none", borderRadius: "2px 2px 0 0", background: tokens.cp ? "#2a3a52" : "#0a0616", display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 2, padding: 3, alignContent: "start", cursor: "crosshair" }}
					>
						{cells.map((on, k) => (
							<span key={k} style={{ aspectRatio: "1", borderRadius: 1, background: on ? c : "#1a1228", opacity: on ? 0.5 + 0.5 * tokens.glow : 0.4, boxShadow: on && tokens.glow > 0.3 ? `0 0 ${(2 + 4 * tokens.glow).toFixed(0)}px ${c}` : "none" }} />
						))}
					</div>
				);
			})}
		</div>
	);
}

/** Mini "spire" sparkline — discrete neon bars (one per point), each a vertical
 *  gradient to the metric colour. Bars (not a filled area) so a row of them reads
 *  as data points / a tiny skyline, and each metric keeps its own colour. */
export function Spire({
	data,
	height = 40,
	color = "#16d8e8",
	labels,
	unit = "",
}: {
	data: number[];
	width?: number;
	height?: number;
	color?: string;
	labels?: string[];
	unit?: string;
}) {
	const { tokens } = useRadioPhase();
	const bind = useTipBind();
	const max = Math.max(1, ...data);
	const min = Math.min(...data, 0);
	const span = Math.max(1, max - min);
	return (
		<div style={{ display: "flex", alignItems: "flex-end", gap: 1.5, height, width: "100%" }}>
			{data.map((v, i) => {
				const h = Math.max(2, ((v - min) / span) * height);
				return (
					<div
						key={i}
						{...bind(`${fmt(v)}${unit ? ` ${unit}` : ""}`, labels?.[i], color)}
						style={{
							flex: 1,
							height: h,
							borderRadius: "1px 1px 0 0",
							background: `linear-gradient(${color}, ${color}22)`,
							boxShadow:
								tokens.glow > 0.3
									? `0 0 ${(2 + 3 * tokens.glow).toFixed(0)}px ${color}88`
									: "none",
							opacity: 0.55 + 0.4 * tokens.glow,
							cursor: "crosshair",
						}}
					/>
				);
			})}
		</div>
	);
}
