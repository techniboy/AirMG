export function recoveryState(score: number): string {
	if (score < 25) return "DEPLETED";
	if (score < 50) return "LOW";
	if (score < 70) return "MODERATE";
	if (score < 88) return "PRIMED";
	return "PEAK";
}

// Recovery score → hex (for SVG / inline-style use, e.g. calendar dots).
export function recoveryHex(score: number | null): string | null {
	if (score === null) return null;
	if (score < 25) return "#FF4F73";
	if (score < 50) return "#F5A623";
	if (score < 70) return "#E8C24B";
	if (score < 88) return "#18C98B";
	return "#2FE6A8";
}

export function strainColor(strain: number | null): string {
	if (strain === null) return "text-text-secondary";
	const t = strain / 21;
	if (t < 0.33) return "text-strain-000";
	if (t < 0.66) return "text-strain-033";
	if (t < 0.85) return "text-strain-066";
	return "text-strain-100";
}

export function sleepStageColor(stage: string): string {
	switch (stage) {
		case "wake":
			return "#E0476B";
		case "light":
			return "#5C6FB1";
		case "deep":
			return "#2C3A7A";
		case "rem":
			return "#5BE0C7";
		default:
			return "#5C6FB1";
	}
}
