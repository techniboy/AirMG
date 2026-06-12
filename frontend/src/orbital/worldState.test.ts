import { describe, expect, it } from "vitest";
import type { DailyMetrics } from "../lib/types";
import {
	baselineZ,
	computeRingMetrics,
	computeWorldState,
	DORMANT,
} from "./worldState";

const base = {
	recovery: 70,
	strainToday: 10,
	hrvZ: 0.5,
	rhrDelta: -2,
	sleepPerf: 85,
	sleepMinutes: 450,
	sleepNeedMinutes: 480,
	steps: 9000,
	syncStale: false,
	hasData: true,
};

describe("computeWorldState", () => {
	it("dormant when no data", () => {
		expect(computeWorldState({ ...base, hasData: false })).toEqual(DORMANT);
	});
	it("recovery drives atmosphere and surface", () => {
		const good = computeWorldState({ ...base, recovery: 95 });
		const bad = computeWorldState({ ...base, recovery: 10 });
		expect(good.atmosphereDensity).toBeGreaterThan(bad.atmosphereDensity);
		expect(good.surfaceSaturation).toBeGreaterThan(bad.surfaceSaturation);
		expect(bad.stormCount).toBeGreaterThan(good.stormCount);
	});
	it("hrv z drives aurora, clamped 0..1", () => {
		expect(computeWorldState({ ...base, hrvZ: 3 }).auroraIntensity).toBe(1);
		expect(computeWorldState({ ...base, hrvZ: -3 }).auroraIntensity).toBe(0);
		expect(
			computeWorldState({ ...base, hrvZ: -1 }).auroraVioletShift,
		).toBeGreaterThan(
			computeWorldState({ ...base, hrvZ: 1 }).auroraVioletShift,
		);
	});
	it("strain drives corona 0..1 over 0..21", () => {
		expect(computeWorldState({ ...base, strainToday: 21 }).coronaActivity).toBe(
			1,
		);
		expect(computeWorldState({ ...base, strainToday: 0 }).coronaActivity).toBe(
			0,
		);
	});
	it("moon phase = sleep minutes vs need, clamped", () => {
		expect(computeWorldState({ ...base, sleepMinutes: 480 }).moonPhase).toBe(1);
		expect(
			computeWorldState({ ...base, sleepMinutes: 240 }).moonPhase,
		).toBeCloseTo(0.5);
	});
	it("null metrics fall back to neutral, not NaN", () => {
		const s = computeWorldState({
			...base,
			recovery: null,
			hrvZ: null,
			strainToday: null,
		});
		for (const v of Object.values(s))
			expect(Number.isNaN(v as number)).toBe(false);
	});
	it("desaturate > 0 when syncStale, 0 otherwise", () => {
		expect(computeWorldState({ ...base, syncStale: true }).desaturate).toBeGreaterThan(0);
		expect(computeWorldState({ ...base, syncStale: false }).desaturate).toBe(0);
	});
});

describe("computeRingMetrics", () => {
	const day = {
		hrv_rmssd: 53,
		resting_hr: 59,
		resp_rate: null,
		sleep_performance: 69.4,
	} as DailyMetrics;
	const baselines = {
		hrv: { mean: 62, spread: 11, status: "trusted" },
		resting_hr: { mean: 54, spread: 2.8, status: "trusted" },
		resp_rate: { mean: 22, spread: 0.5, status: "calibrating" },
	};

	it("returns the four rings in scene order", () => {
		expect(computeRingMetrics(day, baselines).map((m) => m.key)).toEqual([
			"hrv",
			"rhr",
			"resp",
			"sleep",
		]);
	});

	it("hrv below baseline → negative z, bad", () => {
		const hrv = computeRingMetrics(day, baselines)[0];
		expect(hrv.z).not.toBeNull();
		expect(hrv.z!).toBeLessThan(0);
		expect(hrv.good).toBe(false);
	});

	it("rhr above baseline → positive z but bad (inverted)", () => {
		const rhr = computeRingMetrics(day, baselines)[1];
		expect(rhr.z!).toBeGreaterThan(0);
		expect(rhr.good).toBe(false);
	});

	it("rhr below baseline is good", () => {
		const rhr = computeRingMetrics(
			{ ...day, resting_hr: 50 },
			baselines,
		)[1];
		expect(rhr.z!).toBeLessThan(0);
		expect(rhr.good).toBe(true);
	});

	it("null value → null z and good, baseline still carried", () => {
		const resp = computeRingMetrics(day, baselines)[2];
		expect(resp.value).toBeNull();
		expect(resp.z).toBeNull();
		expect(resp.good).toBeNull();
		expect(resp.baselineMean).toBe(22);
	});

	it("sleep uses the 85 ± 12 pseudo-baseline", () => {
		const sleep = computeRingMetrics(day, baselines)[3];
		expect(sleep.baselineMean).toBe(85);
		expect(sleep.baselineSpread).toBe(12);
		expect(sleep.z).toBeCloseTo((69.4 - 85) / 12);
		expect(sleep.good).toBe(false);
		const great = computeRingMetrics(
			{ ...day, sleep_performance: 97 },
			baselines,
		)[3];
		expect(great.z!).toBeGreaterThan(0);
		expect(great.good).toBe(true);
	});

	it("no_data day → everything null", () => {
		for (const m of computeRingMetrics(null, {})) {
			expect(m.value).toBeNull();
			expect(m.z).toBeNull();
			expect(m.good).toBeNull();
		}
	});
});

describe("baselineZ", () => {
	it("returns null when value is null", () => {
		expect(baselineZ(null, { mean: 50, spread: 10 })).toBeNull();
	});
	it("returns null when baseline is null", () => {
		expect(baselineZ(60, null)).toBeNull();
	});
	it("returns null when baseline is undefined", () => {
		expect(baselineZ(60, undefined)).toBeNull();
	});
	it("returns positive z when value is above mean", () => {
		const z = baselineZ(60, { mean: 50, spread: 10 });
		expect(z).not.toBeNull();
		expect(z!).toBeGreaterThan(0);
	});
	it("returns finite value when spread is zero", () => {
		const z = baselineZ(60, { mean: 50, spread: 0 });
		expect(z).not.toBeNull();
		expect(Number.isFinite(z!)).toBe(true);
	});
});
