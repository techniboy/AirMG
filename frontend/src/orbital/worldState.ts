import { atom } from "jotai";
import {
	baselinesAtom,
	settingsAtom,
	todayMetricsAtom,
} from "../atoms/api";
import type { DailyMetrics } from "../lib/types";

export interface WorldInputs {
	recovery: number | null;
	strainToday: number | null;
	hrvZ: number | null;
	rhrDelta: number | null;
	sleepPerf: number | null;
	sleepMinutes: number | null;
	sleepNeedMinutes: number;
	steps: number | null;
	syncStale: boolean;
	hasData: boolean;
}

export interface WorldState {
	atmosphereDensity: number; // 0..1
	atmosphereHue: number; // 0 grey-blue .. 1 deep teal
	surfaceSaturation: number; // 0 ashen .. 1 lush
	stormCount: number; // integer 0..6
	auroraIntensity: number; // 0..1
	auroraVioletShift: number; // 0 teal .. 1 violet
	rotationSpeed: number; // rad/s, subtle
	coronaActivity: number; // 0..1
	cityCalm: number; // 0 flicker .. 1 steady
	moonPhase: number; // 0 new .. 1 full
	satelliteSpeed: number; // rad/s
	desaturate: number; // 0..0.3 sync-stale wash
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const nz = (v: number | null, fallback: number) => (v == null ? fallback : v);

export function baselineZ(
	value: number | null,
	baseline: { mean: number; spread: number } | null | undefined,
): number | null {
	if (value == null || baseline == null) return null;
	return (value - baseline.mean) / Math.max(1.253 * baseline.spread, 1e-9);
}

export const DORMANT: WorldState = {
	atmosphereDensity: 0.15,
	atmosphereHue: 0,
	surfaceSaturation: 0.05,
	stormCount: 0,
	auroraIntensity: 0,
	auroraVioletShift: 0,
	rotationSpeed: 0.01,
	coronaActivity: 0.05,
	cityCalm: 0.2,
	moonPhase: 0.3,
	satelliteSpeed: 0.05,
	desaturate: 0.3,
};

export function computeWorldState(i: WorldInputs): WorldState {
	if (!i.hasData) return DORMANT;
	const rec = clamp01(nz(i.recovery, 50) / 100);
	const hrvZ = nz(i.hrvZ, 0);
	return {
		atmosphereDensity: 0.25 + 0.75 * rec,
		atmosphereHue: rec,
		surfaceSaturation: 0.1 + 0.9 * rec,
		stormCount: Math.round(6 * clamp01((40 - nz(i.recovery, 50)) / 40)),
		// gentle slope so a suppressed HRV still leaves a faint violet whisper
		auroraIntensity: clamp01(0.5 + hrvZ / 6),
		auroraVioletShift: clamp01(0.5 - hrvZ * 0.5),
		rotationSpeed: 0.01 + 0.02 * clamp01(nz(i.rhrDelta, 0) / 8 + 0.5),
		coronaActivity: clamp01(nz(i.strainToday, 0) / 21),
		cityCalm: clamp01(nz(i.sleepPerf, 50) / 100),
		moonPhase: clamp01(nz(i.sleepMinutes, 0) / Math.max(1, i.sleepNeedMinutes)),
		satelliteSpeed: 0.05 + 0.25 * clamp01(nz(i.steps, 0) / 10000),
		desaturate: i.syncStale ? 0.3 : 0,
	};
}

// Canned inputs for screenshot fixtures: ?worldFixture=great|avg|bad
// Pure read-side override — live atoms are never subscribed when active.
const FIXTURE_INPUTS: Record<string, WorldInputs> = {
	great: {
		recovery: 95,
		strainToday: 6,
		hrvZ: 1.5,
		rhrDelta: -2,
		sleepPerf: 95,
		sleepMinutes: 480,
		sleepNeedMinutes: 480,
		steps: 12000,
		syncStale: false,
		hasData: true,
	},
	avg: {
		recovery: 60,
		strainToday: 10,
		hrvZ: 0,
		rhrDelta: 0,
		sleepPerf: 75,
		sleepMinutes: 420,
		sleepNeedMinutes: 480,
		steps: 7000,
		syncStale: false,
		hasData: true,
	},
	bad: {
		recovery: 15,
		strainToday: 19,
		hrvZ: -2,
		rhrDelta: 5,
		sleepPerf: 45,
		sleepMinutes: 280,
		sleepNeedMinutes: 480,
		steps: 2000,
		syncStale: false,
		hasData: true,
	},
};

export function readFixtureInputs(): WorldInputs | null {
	if (typeof location === "undefined") return null;
	const name = new URLSearchParams(location.search).get("worldFixture");
	if (name == null) return null;
	return FIXTURE_INPUTS[name] ?? null;
}

// /api/today actually returns DailyMetrics OR {status:"no_data", message} —
// the typed client claims DailyMetrics, so we narrow at runtime.
export function asMetrics(data: unknown): DailyMetrics | null {
	if (data == null || typeof data !== "object") return null;
	if ("status" in data && (data as { status?: string }).status === "no_data")
		return null;
	return data as DailyMetrics;
}

export const worldStateAtom = atom<WorldState>((get) => {
	const fixture = readFixtureInputs();
	if (fixture != null) return computeWorldState(fixture);

	const today = asMetrics(get(todayMetricsAtom).data);
	const baselines = get(baselinesAtom).data ?? {};
	const settings = get(settingsAtom);

	if (today == null) return DORMANT;

	const hrvBase = baselines.hrv;
	const hrvZ = baselineZ(today.hrv_rmssd ?? null, hrvBase);

	const rhrBase = baselines.resting_hr;
	const rhrDelta =
		today.resting_hr != null && rhrBase != null
			? today.resting_hr - rhrBase.mean
			: null;

	const sleepNeedMinutes = Math.max(
		60,
		(settings.data?.sleep_need_hours ?? 8) * 60,
	);

	return computeWorldState({
		recovery: today.recovery,
		strainToday: today.strain,
		hrvZ,
		rhrDelta,
		sleepPerf: today.sleep_performance,
		sleepMinutes: today.sleep_minutes,
		sleepNeedMinutes,
		steps: today.steps,
		syncStale: false, // no staleness signal exposed yet
		hasData: true,
	});
});
