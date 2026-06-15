import { readTimeFixture } from "../orbital/solarClock";

export type RadioPhase = "sunrise" | "day" | "dusk" | "night";

export interface PhaseTokens {
	/** gradient stops (top → bottom) */
	g1: string;
	g2: string;
	g3: string;
	/** bloom radial colors (rgba hex with alpha) */
	bloomA: string;
	bloomB: string;
	/** accent color for this phase */
	acc: string;
	/** 0..1 emissive strength (drives glow radii / opacity) */
	glow: number;
	/** City-Pop grade (chrome bezels, stars off) vs HACF night */
	cp: boolean;
}

// Boundaries on the 0..1 local-day fraction (0 = midnight, 0.5 = noon).
// sunrise 05:00–08:00, day 08:00–17:00, dusk 17:00–20:00, else night.
export function phaseForFraction(f: number): RadioPhase {
	if (f >= 5 / 24 && f < 8 / 24) return "sunrise";
	if (f >= 8 / 24 && f < 17 / 24) return "day";
	if (f >= 17 / 24 && f < 20 / 24) return "dusk";
	return "night";
}

export const PHASE_TOKENS: Record<RadioPhase, PhaseTokens> = {
	sunrise: { g1: "#3a1838", g2: "#1c0f28", g3: "#0a0612", bloomA: "#ff7a3344", bloomB: "#ffb34722", acc: "#ff9ec4", glow: 0.5, cp: true },
	day: { g1: "#0e3a44", g2: "#0a2630", g3: "#06141c", bloomA: "#16d8e833", bloomB: "#ffd24a22", acc: "#22e0d0", glow: 0.25, cp: true },
	dusk: { g1: "#2a1248", g2: "#491a3e", g3: "#6e2a2a", bloomA: "#ff7a3344", bloomB: "#ffb34733", acc: "#ff7aa8", glow: 0.7, cp: false },
	night: { g1: "#1a1130", g2: "#0a0818", g3: "#04030a", bloomA: "#8a4dff2e", bloomB: "#ff2d7822", acc: "#16d8e8", glow: 1, cp: false },
};

export interface RadioPhaseState {
	phase: RadioPhase;
	tokens: PhaseTokens;
}

/** Pinned to the night grade. ?timeFixture= still overrides (for screenshots). */
export function useRadioPhase(): RadioPhaseState {
	const fixture = readTimeFixture();
	const phase: RadioPhase = fixture != null ? phaseForFraction(fixture) : "night";
	return { phase, tokens: PHASE_TOKENS[phase] };
}

/** prefers-reduced-motion (read once; fine for theme-level gating). */
export function prefersReducedMotion(): boolean {
	return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}
