import type { CSSProperties, ReactNode } from "react";

/** Wraps a wide chart so it scrolls horizontally on phones instead of squishing.
 *  The min-width only applies under 640px (see `.chart-scroll` in index.css); on
 *  desktop the child fills its container as before. */
export function ChartScroll({
	minWidth = 560,
	children,
}: {
	minWidth?: number;
	children: ReactNode;
}) {
	return (
		<div className="chart-scroll" style={{ "--chart-min": `${minWidth}px` } as CSSProperties}>
			{children}
		</div>
	);
}
