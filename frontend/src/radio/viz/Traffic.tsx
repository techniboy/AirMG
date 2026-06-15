import { useMemo } from "react";
import { useRadioPhase } from "../phase";

const ZONE = ["#16d8e8", "#5BD3A0", "#E8C24B", "#E8743B", "#ff2d78"];

/** Step cadence / flow — neon light-trails streaking across (the gallery
 *  "Traffic" form). Positions/timings are stable per mount. */
export function Traffic({ count = 14, height = 44 }: { count?: number; height?: number }) {
	const { tokens } = useRadioPhase();
	const trails = useMemo(
		() =>
			Array.from({ length: count }, () => ({
				top: 12 + Math.random() * 72,
				w: 16 + Math.random() * 40,
				c: ZONE[Math.floor(Math.random() * 5)],
				dur: 1.4 + Math.random() * 1.6,
				delay: -Math.random() * 3,
				op: 0.45 + Math.random() * 0.5,
			})),
		[count],
	);
	return (
		<div
			className="radio-traffic"
			style={{ position: "relative", height, width: "100%", overflow: "hidden" }}
		>
			{trails.map((t, i) => (
				<div
					key={i}
					style={{
						position: "absolute",
						top: `${t.top}%`,
						left: 0,
						height: 2,
						width: t.w,
						borderRadius: 2,
						background: `linear-gradient(90deg,transparent,${t.c})`,
						boxShadow: `0 0 ${(3 + 4 * tokens.glow).toFixed(0)}px ${t.c}`,
						opacity: t.op * (0.4 + 0.6 * tokens.glow),
						// transform-based (compositor) flow — never animate `left`
						animation: `radio-flow ${t.dur}s linear infinite`,
						animationDelay: `${t.delay}s`,
						willChange: "transform",
					}}
				/>
			))}
		</div>
	);
}
