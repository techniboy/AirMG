// Per-metric theme colours for the Radio theme. One distinct neon hue per
// metric so users cognitively group "this colour = this metric" across the app.
// Spread around the wheel, tuned for a near-black background (no two neighbours
// collide — fixes the old cyan triplet of resp/spo2/steps). Keeps the
// established semantic hues where they were already unique.
export const METRIC_COLORS = {
	recovery: "#18C98B", // mint green
	strain: "#FF7A3C", // orange
	hrv: "#A879FF", // violet
	restingHr: "#FF4F73", // rose
	resp: "#2FE6C2", // aqua
	spo2: "#4FC3FF", // sky blue
	sleep: "#7C5CFF", // indigo
	sleepDuration: "#B07CFF", // lavender
	steps: "#8AE65A", // lime
	calories: "#FFB347", // amber
	hr: "#FF5277", // coral-red (workout avg/max HR)
} as const;

export type MetricKey = keyof typeof METRIC_COLORS;

// Recovery band ramp (low->high, red->teal). Indexed by Math.floor(frac*5).
// Shared by the recovery-coloured viz (EQ ladder, Skyline, Facade).
export const RECOVERY_RAMP = ["#FF4F73", "#F5A623", "#E8C24B", "#18C98B", "#2FE6A8"] as const;

/** Compact number format: integers bare, else one decimal. */
export function fmt(v: number): string {
	return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

const FALLBACK = "#16d8e8";

/** Map a human label (as passed to StatTile/MetricCard) to a metric key.
 *  Order matters: more specific tests first. */
function keyForLabel(label: string): MetricKey | null {
	const l = label.toLowerCase();
	if (l.includes("recovery")) return "recovery";
	if (l.includes("strain")) return "strain";
	if (l.includes("hrv")) return "hrv";
	if (l.includes("resting")) return "restingHr";
	if (l.includes("resp")) return "resp";
	if (l.includes("oxygen") || l.includes("spo2")) return "spo2";
	if (
		l.includes("sleep") &&
		(l.includes("dur") || l.includes("time") || l.includes("total"))
	)
		return "sleepDuration";
	if (
		l.includes("sleep") ||
		l.includes("rem") ||
		l.includes("deep") ||
		l.includes("restorative") ||
		l.includes("efficiency")
	)
		return "sleep";
	if (l.includes("step")) return "steps";
	if (l.includes("cal")) return "calories";
	if (l.includes("hr")) return "hr"; // "Avg HR" / "Max HR"
	return null;
}

/** Resolve a metric's theme colour from its label. */
export function metricColor(label: string, fallback: string = FALLBACK): string {
	const k = keyForLabel(label);
	return k ? METRIC_COLORS[k] : fallback;
}

