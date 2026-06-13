import { describe, expect, it } from "vitest";
import {
	DEFAULT_SWING,
	solarAzimuth,
	solarDayFraction,
	solarWarmth,
	sunDirFor,
} from "./solarClock";

const at = (h: number, m = 0) => new Date(2026, 5, 13, h, m);

describe("solarDayFraction", () => {
	it("noon = 0.5, midnight = 0", () => {
		expect(solarDayFraction(at(12))).toBeCloseTo(0.5);
		expect(solarDayFraction(at(0))).toBeCloseTo(0);
		expect(solarDayFraction(at(6))).toBeCloseTo(0.25);
	});
});

describe("solarWarmth", () => {
	it("peaks at noon, zero at midnight, symmetric", () => {
		expect(solarWarmth(0.5)).toBeCloseTo(1);
		expect(solarWarmth(0)).toBeCloseTo(0);
		expect(solarWarmth(0.25)).toBeLessThan(solarWarmth(0.5));
		expect(solarWarmth(0.25)).toBeCloseTo(solarWarmth(0.75));
	});
});

describe("solarAzimuth", () => {
	it("zero at noon, signed, magnitude bounded by swing", () => {
		expect(solarAzimuth(0.5, DEFAULT_SWING)).toBeCloseTo(0);
		expect(solarAzimuth(0.75, DEFAULT_SWING)).toBeGreaterThan(0);
		expect(solarAzimuth(0.25, DEFAULT_SWING)).toBeLessThan(0);
		expect(Math.abs(solarAzimuth(0, DEFAULT_SWING))).toBeLessThanOrEqual(DEFAULT_SWING + 1e-9);
	});
});

describe("sunDirFor", () => {
	it("returns a unit vector", () => {
		const [x, y, z] = sunDirFor(0.5);
		expect(Math.hypot(x, y, z)).toBeCloseTo(1);
	});
	it("noon faces the camera (+z) more than midnight", () => {
		expect(sunDirFor(0.5)[2]).toBeGreaterThan(sunDirFor(0)[2]);
	});
});
