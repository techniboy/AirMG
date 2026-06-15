import { useMemo } from "react";
import { prefersReducedMotion } from "./phase";

// Aurora / bloom / drift are baked into the static .radio-app gradient (CSS) —
// they used to repaint the full screen every frame. Only the cheap layers stay:
// stars (opacity twinkle) + the occasional shoot streak.
export function RadioBackdrop() {
	const reduced = prefersReducedMotion();
	const stars = useMemo(
		() => Array.from({ length: reduced ? 30 : 54 }, () => ({
			left: Math.random() * 100, top: Math.random() * 100,
			o: 0.3 + Math.random() * 0.7, big: Math.random() > 0.85,
			delay: -Math.random() * 4, dur: 3 + Math.random() * 3,
		})),
		[reduced],
	);
	return (
		<>
			<div className="radio-stars">
				{stars.map((s, i) => (
					<i key={i} style={{ left: `${s.left}%`, top: `${s.top}%`, opacity: s.o,
						["--o" as string]: s.o, width: s.big ? 3 : 2, height: s.big ? 3 : 2,
						animationDelay: `${s.delay}s`, animationDuration: `${s.dur}s` }} />
				))}
			</div>
			<div className="radio-shoot" />
		</>
	);
}
