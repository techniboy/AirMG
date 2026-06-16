import { ChartScroll } from "../../components/charts/ChartScroll";
import { RECOVERY_RAMP as REC } from "../metricColors";
import { useRadioPhase } from "../phase";
import { useTipBind } from "../tooltip";

/** values: array of cells, each 0..100 recovery (or null for no-data). */
export function Facade({
	values,
	cols = 53,
	labels,
}: {
	values: (number | null)[];
	cols?: number;
	labels?: (string | undefined)[];
}) {
	const { tokens } = useRadioPhase();
	const bind = useTipBind();
	return (
		<ChartScroll minWidth={Math.max(560, cols * 12)}>
		<div
			style={{
				display: "grid",
				gridTemplateColumns: `repeat(${cols}, 1fr)`,
				gap: 2,
				padding: 6,
				border: `1px solid ${tokens.cp ? "#5a6a86" : "#241634"}`,
				borderRadius: 2,
			}}
		>
			{values.map((v, i) => {
				if (v === null)
					return (
						<span
							key={i}
							style={{
								aspectRatio: "1",
								borderRadius: 1,
								background: "transparent",
								border: "1px solid rgba(255,255,255,0.08)",
							}}
						/>
					);
				const c = REC[Math.min(4, Math.floor((v / 100) * 5))];
				return (
					<span
						key={i}
						{...bind(`${Math.round(v)}%`, labels?.[i], c)}
						style={{
							aspectRatio: "1",
							borderRadius: 1,
							background: c,
							opacity: 0.5 + 0.45 * tokens.glow,
							boxShadow:
								tokens.glow > 0.3
									? `0 0 ${(2 + 4 * tokens.glow).toFixed(0)}px ${c}`
									: "none",
							cursor: "crosshair",
						}}
					/>
				);
			})}
		</div>
		</ChartScroll>
	);
}
