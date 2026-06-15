import { useRadioPhase } from "../phase";
import { useTipBind } from "../tooltip";

const ZC: Record<number, string> = {
	1: "#A3D9F5",
	2: "#7EC8E3",
	3: "#F5A623",
	4: "#E8743B",
	5: "#FF4F73",
};

/** Five zone slots stacked Z1→Z5 (bottom→top). Each slot is an outlined track
 *  ("could be occupied"); the coloured fill rises from the slot's base in
 *  proportion to that zone's time vs the busiest zone. */
export function ZoneStack({
	minutes,
	height = 124,
	width = 52,
}: {
	minutes: Record<1 | 2 | 3 | 4 | 5, number>;
	height?: number;
	width?: number;
}) {
	const { tokens } = useRadioPhase();
	const bind = useTipBind();
	const maxMin = Math.max(1, ...(Object.values(minutes) as number[]));
	const slotH = (height - 4 * 3) / 5; // 5 slots, 3px gaps

	return (
		<div
			style={{
				display: "flex",
				flexDirection: "column-reverse",
				gap: 3,
				width,
				height,
				justifyContent: "flex-end",
			}}
		>
			{[1, 2, 3, 4, 5].map((z) => {
				const c = ZC[z];
				const frac = Math.min(1, minutes[z as 1] / maxMin);
				const fillH = frac * slotH;
				const mins = Math.round(minutes[z as 1] / 60);
				return (
					<div
						key={z}
						{...bind(`${mins} min`, `Zone ${z}`, c)}
						style={{
							height: slotH,
							borderRadius: 2,
							border: "1px solid rgba(255,255,255,0.10)",
							position: "relative",
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							overflow: "hidden",
							cursor: "crosshair",
						}}
					>
						{/* coloured fill rising from the base */}
						<div
							style={{
								position: "absolute",
								left: 0,
								right: 0,
								bottom: 0,
								height: fillH,
								background: c,
								boxShadow: tokens.cp
									? "inset 0 1px 0 #ffffff66"
									: `0 0 8px ${c}88, inset 0 0 10px #ffffff22`,
								opacity: tokens.cp ? 1 : 0.92,
							}}
						/>
						<span
							style={{
								position: "relative",
								fontSize: 8,
								fontWeight: 700,
								color: frac > 0.4 ? (z >= 3 ? "#fff" : "#0009") : "var(--mut)",
							}}
						>
							Z{z}
						</span>
					</div>
				);
			})}
		</div>
	);
}
