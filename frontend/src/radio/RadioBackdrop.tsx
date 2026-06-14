import { useMemo } from "react";
import { prefersReducedMotion } from "./phase";

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
	const dust = useMemo(
		() => reduced ? [] : Array.from({ length: 24 }, () => ({
			left: Math.random() * 100, dur: 7 + Math.random() * 9, delay: -Math.random() * 12,
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
			<div className="radio-aurora"><b className="a1" /><b className="a2" /></div>
			<div className="radio-shoot" />
			<div className="radio-bloom" />
			<div className="radio-dust">
				{dust.map((d, i) => (
					<i key={i} style={{ left: `${d.left}%`, bottom: -10,
						animationDuration: `${d.dur}s`, animationDelay: `${d.delay}s` }} />
				))}
			</div>
		</>
	);
}
