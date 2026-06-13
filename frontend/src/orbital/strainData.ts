import { atomWithQuery } from "jotai-tanstack-query";
import { api } from "../api/client";
import { controlCenterDayAtom } from "../atoms/api";
import type { HRTrendData, HRTrendPoint, Workout } from "../lib/types";
import { CAMERA_TARGETS } from "./cameraRig";
import { SUN_POSITION } from "./scene/Planet";
import type { Flare } from "./scene/Star";

/**
 * Strain diorama data (Task 14): the day's workouts become solar-flare
 * spikes on a 24h equatorial ring around the star.
 *
 * Deliberate cut: corona shells are NOT scaled by HR-zone minutes — no
 * per-day zone endpoint exists (`/api/workouts/summary` is range-wide
 * only), and deriving zones client-side would need resting/max HR
 * assumptions we can't honestly make. Corona activity already encodes day
 * strain (worldState.coronaActivity = strain/21); zone shells can land
 * when a per-day zones endpoint exists.
 */

// ---------------------------------------------------------------------------
// Day HR trace — orbital-local query keyed on controlCenterDayAtom so DateNav
// time travel re-slices the hover panel's mini trace in lockstep.
// ---------------------------------------------------------------------------

export const orbitalHrTrendAtom = atomWithQuery((get) => {
	const day = get(controlCenterDayAtom);
	return {
		queryKey: ["orbital-hr-trend", day],
		queryFn: () => api<HRTrendData>(`/api/hr-trend?day=${day}`),
	};
});

// ---------------------------------------------------------------------------
// hour → ring angle
// ---------------------------------------------------------------------------

const strainCam = CAMERA_TARGETS["/strain"].pos;
/** equatorial angle (rad) of the /strain camera as seen from the star */
export const CAMERA_FACING_ANGLE = Math.atan2(
	strainCam[2] - SUN_POSITION.z,
	strainCam[0] - SUN_POSITION.x,
);

/**
 * The far side of the star hides a slice of the ring from the /strain
 * camera. Anchor that hidden arc on 04:00 — the hour workouts are least
 * likely — so the waking day wraps the visible limbs.
 */
export const HIDDEN_HOUR = 4;

/** local-day fraction (0 = midnight, 0.5 = noon) → ring angle in radians */
export function dayFracToAngle(frac: number): number {
	return (
		CAMERA_FACING_ANGLE + Math.PI + (frac - HIDDEN_HOUR / 24) * Math.PI * 2
	);
}

/** fraction of the local day elapsed at unix-seconds `ts` */
export function localDayFrac(ts: number): number {
	const d = new Date(ts * 1000);
	return (
		(d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds()) / 86400
	);
}

// ---------------------------------------------------------------------------
// workout → flare
// ---------------------------------------------------------------------------

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** ignore degenerate tracker blips (this DB has 2-second "workouts") */
const MIN_WORKOUT_SEC = 120;

function localDayStr(d: Date): string {
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** workouts whose local start date matches `day`, oldest first */
export function workoutsForDay(
	workouts: Workout[] | undefined,
	day: string,
): Workout[] {
	if (!workouts) return [];
	return workouts
		.filter(
			(w) =>
				w.end_ts - w.start_ts >= MIN_WORKOUT_SEC &&
				localDayStr(new Date(w.start_ts * 1000)) === day,
		)
		.sort((a, b) => a.start_ts - b.start_ts);
}

/**
 * Effort 0..1 for hue (amber → magenta). avg_hr maps over a fixed 60–180
 * window; falls back to strain/21, then a neutral 0.35.
 */
export function workoutIntensity(w: Workout): number {
	if (w.avg_hr != null) return clamp01((w.avg_hr - 60) / 120);
	if (w.strain != null) return clamp01(w.strain / 21);
	return 0.35;
}

/**
 * angle = workout midpoint on the 24h ring; height = strain/21 (0.15
 * floor) — this DB's workouts carry strain=null, so height falls back to
 * the avg_hr intensity; hue = intensity.
 */
export function workoutFlare(w: Workout): Flare {
	const mid = (w.start_ts + w.end_ts) / 2;
	const intensity = workoutIntensity(w);
	const height =
		w.strain != null
			? Math.max(0.15, clamp01(w.strain / 21))
			: Math.max(0.15, intensity);
	return { angle: dayFracToAngle(localDayFrac(mid)), height, hue: intensity };
}

// ---------------------------------------------------------------------------
// hover panel helpers
// ---------------------------------------------------------------------------

const TRACE_PAD_SEC = 300;

/** day HR points within the workout window (± one bucket of padding) */
export function sliceTrace(
	points: HRTrendPoint[] | undefined,
	startTs: number,
	endTs: number,
): HRTrendPoint[] {
	if (!points) return [];
	return points.filter(
		(p) => p.ts >= startTs - TRACE_PAD_SEC && p.ts <= endTs + TRACE_PAD_SEC,
	);
}

/** SVG polyline `points` string for a bpm trace, fit to w×h (2px margin) */
export function tracePath(
	points: HRTrendPoint[],
	w: number,
	h: number,
): string {
	if (points.length < 2) return "";
	const t0 = points[0].ts;
	const t1 = points[points.length - 1].ts;
	let lo = Infinity;
	let hi = -Infinity;
	for (const p of points) {
		if (p.bpm < lo) lo = p.bpm;
		if (p.bpm > hi) hi = p.bpm;
	}
	const tSpan = Math.max(1, t1 - t0);
	const bSpan = Math.max(1, hi - lo);
	const m = 2;
	return points
		.map((p) => {
			const x = m + ((p.ts - t0) / tSpan) * (w - 2 * m);
			const y = m + (1 - (p.bpm - lo) / bSpan) * (h - 2 * m);
			return `${x.toFixed(1)},${y.toFixed(1)}`;
		})
		.join(" ");
}

/** "STRENGTH_TRAINING" → "Strength Training" */
export function formatWorkoutType(type: string | null): string {
	if (!type) return "Workout";
	return type
		.toLowerCase()
		.split("_")
		.map((s) => s.charAt(0).toUpperCase() + s.slice(1))
		.join(" ");
}

export function fmtClock(ts: number): string {
	return new Date(ts * 1000).toLocaleTimeString([], {
		hour: "2-digit",
		minute: "2-digit",
	});
}
