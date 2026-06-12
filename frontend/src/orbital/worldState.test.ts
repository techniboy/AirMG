import { describe, expect, it } from "vitest";
import { computeWorldState, DORMANT } from "./worldState";

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
});
