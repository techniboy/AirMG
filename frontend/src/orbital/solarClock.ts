import { useEffect, useMemo, useState } from "react";

/** Azimuth swing from noon to midnight (radians). < π keeps the lit crescent
 *  broadly consistent with the fixed strain-star's on-screen position. */
export const DEFAULT_SWING = 0.62 * Math.PI;
const BASE_ELEVATION = 0.22; // radians — modest, fixed (no season/latitude in v1)

/** Local time as a 0..1 fraction of the day (0 = midnight, 0.5 = noon). */
export function solarDayFraction(d: Date): number {
	return (d.getHours() * 60 + d.getMinutes()) / 1440;
}

/** Daylight amount 0..1 — 1 at noon, 0 at midnight, symmetric around noon. */
export function solarWarmth(f: number): number {
	return 0.5 - 0.5 * Math.cos(2 * Math.PI * f);
}

/** Signed azimuth offset from noon (radians), bounded by `swing`. */
export function solarAzimuth(f: number, swing = DEFAULT_SWING): number {
	return (f - 0.5) * 2 * swing;
}

/** Unit sun direction: noon points toward +z (camera) and slightly up;
 *  it swings around the polar (y) axis with local time. */
export function sunDirFor(
	f: number,
	opts?: { swing?: number; elevation?: number },
): [number, number, number] {
	const az = solarAzimuth(f, opts?.swing ?? DEFAULT_SWING);
	const elev = opts?.elevation ?? BASE_ELEVATION;
	const cosElev = Math.cos(elev);
	return [Math.sin(az) * cosElev, Math.sin(elev), Math.cos(az) * cosElev];
}

// Deterministic overrides for screenshots: ?timeFixture=dawn|noon|dusk|night
const TIME_FIXTURES: Record<string, number> = {
	dawn: 0.27,
	noon: 0.5,
	dusk: 0.79,
	night: 0.96,
};

export function readTimeFixture(): number | null {
	if (typeof location === "undefined") return null;
	const name = new URLSearchParams(location.search).get("timeFixture");
	return name == null ? null : (TIME_FIXTURES[name] ?? null);
}

export interface SolarState {
	sunDir: [number, number, number];
	warmth: number;
}

/** Ambient clock layer — ticks each minute; frozen when a fixture is set. */
export function useSolarClock(): SolarState {
	const fixture = useMemo(() => readTimeFixture(), []);
	const [f, setF] = useState(() => fixture ?? solarDayFraction(new Date()));
	useEffect(() => {
		if (fixture != null) return; // frozen for deterministic screenshots
		const id = setInterval(() => setF(solarDayFraction(new Date())), 60_000);
		return () => clearInterval(id);
	}, [fixture]);
	return useMemo(() => ({ sunDir: sunDirFor(f), warmth: solarWarmth(f) }), [f]);
}
