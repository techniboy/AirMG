import { useAtomValue } from "jotai";
import { radioTipAtom } from "./tooltip";

/** CRT/LCD readout that follows the cursor over any hoverable Radio viz.
 *  Value + glow + border tint to the hovered cell's colour. */
export function RadioTooltip() {
	const tip = useAtomValue(radioTipAtom);
	if (!tip) return null;
	const c = tip.color ?? "#39ffae";
	return (
		<div
			style={{
				position: "fixed",
				left: tip.x,
				top: tip.y,
				transform: "translate(-50%, calc(-100% - 12px))",
				zIndex: 60,
				pointerEvents: "none",
			}}
		>
			<div
				className="radio-tip-box"
				style={{
					borderColor: c,
					boxShadow: `0 0 12px ${c}80, inset 0 0 10px #00000088`,
				}}
			>
				{tip.label && <div className="radio-tip-label">{tip.label}</div>}
				<div className="radio-tip-val" style={{ color: c, textShadow: `0 0 8px ${c}` }}>
					{tip.value}
					<span className="radio-tip-caret" style={{ color: c }}>
						▌
					</span>
				</div>
			</div>
		</div>
	);
}
