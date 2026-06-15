import { describe, expect, it } from "vitest";
import { METRIC_COLORS, metricColor } from "./metricColors";

describe("metricColor", () => {
	it("maps the obvious labels", () => {
		expect(metricColor("Recovery")).toBe(METRIC_COLORS.recovery);
		expect(metricColor("Day Strain")).toBe(METRIC_COLORS.strain);
		expect(metricColor("HRV")).toBe(METRIC_COLORS.hrv);
		expect(metricColor("Blood Oxygen")).toBe(METRIC_COLORS.spo2);
		expect(metricColor("Resp Rate")).toBe(METRIC_COLORS.resp);
		expect(metricColor("Steps")).toBe(METRIC_COLORS.steps);
		expect(metricColor("Calories")).toBe(METRIC_COLORS.calories);
	});
	it("disambiguates HR variants (resting vs workout)", () => {
		expect(metricColor("Resting HR")).toBe(METRIC_COLORS.restingHr);
		expect(metricColor("Avg HR")).toBe(METRIC_COLORS.hr);
		expect(metricColor("Max HR")).toBe(METRIC_COLORS.hr);
	});
	it("splits sleep performance vs sleep duration", () => {
		expect(metricColor("Sleep Performance")).toBe(METRIC_COLORS.sleep);
		expect(metricColor("Sleep Perf")).toBe(METRIC_COLORS.sleep);
		expect(metricColor("Sleep Duration")).toBe(METRIC_COLORS.sleepDuration);
	});
	it("falls back for unknown labels", () => {
		expect(metricColor("Frobnicate")).toBe("#16d8e8");
		expect(metricColor("Frobnicate", "#abc")).toBe("#abc");
	});
	it("every metric colour is a distinct hex", () => {
		const vals = Object.values(METRIC_COLORS);
		expect(new Set(vals).size).toBe(vals.length);
	});
});
