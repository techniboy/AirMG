import { describe, expect, it } from "vitest";
import { phaseForFraction, PHASE_TOKENS } from "./phase";

describe("phaseForFraction", () => {
	it("maps midnight to night", () => {
		expect(phaseForFraction(0.0)).toBe("night");
		expect(phaseForFraction(0.98)).toBe("night");
	});
	it("maps early morning to sunrise", () => {
		expect(phaseForFraction(0.27)).toBe("sunrise");
	});
	it("maps midday to day", () => {
		expect(phaseForFraction(0.5)).toBe("day");
	});
	it("maps evening to dusk", () => {
		expect(phaseForFraction(0.79)).toBe("dusk");
	});
	it("every phase has a full token bundle", () => {
		for (const p of ["sunrise", "day", "dusk", "night"] as const) {
			const t = PHASE_TOKENS[p];
			expect(t.acc).toMatch(/^#/);
			expect(t.g1).toMatch(/^#/);
			expect(typeof t.glow).toBe("number");
			expect(typeof t.cp).toBe("boolean");
		}
	});
});
