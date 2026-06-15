import type { CSSProperties } from "react";
import { useRadioPhase } from "../phase";

/** Glowing neon headline number — the gradient-clip + bloom treatment from the
 *  bento/allforms mockups. Used for key-metric values in the Radio theme. */
export function Billboard({
	value,
	label,
	unit,
	size = 34,
	color = "#ff2d78",
}: {
	value: string;
	label?: string;
	unit?: string;
	size?: number;
	/** metric theme colour — tints the neon number + glow */
	color?: string;
}) {
	const { tokens } = useRadioPhase();
	const day = tokens.cp;
	const numStyle: CSSProperties = day
		? { color: "#0a2233" }
		: {
				background: `linear-gradient(#ffffff, ${color})`,
				WebkitBackgroundClip: "text",
				backgroundClip: "text",
				color: "transparent",
				textShadow: `0 0 ${(10 + 8 * tokens.glow).toFixed(0)}px ${color}66`,
			};
	return (
		<div>
			<div
				style={{
					fontFamily: "ui-sans-serif, system-ui, sans-serif",
					fontWeight: 800,
					fontSize: size,
					lineHeight: 1,
					letterSpacing: ".01em",
					...numStyle,
				}}
			>
				{value}
				{unit && <span style={{ fontSize: size * 0.4 }}>{unit}</span>}
			</div>
			{label && (
				<div
					style={{
						fontSize: 8,
						letterSpacing: ".26em",
						textTransform: "uppercase",
						marginTop: 5,
						color: day ? "#1a5fa8" : color,
						textShadow: day ? "none" : `0 0 6px ${color}`,
					}}
				>
					{label}
				</div>
			)}
		</div>
	);
}
