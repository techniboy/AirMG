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
	it("uses >= lower / < upper boundaries", () => {
		expect(phaseForFraction(5 / 24)).toBe("sunrise");
		expect(phaseForFraction(8 / 24)).toBe("day");
		expect(phaseForFraction(17 / 24)).toBe("dusk");
		expect(phaseForFraction(20 / 24)).toBe("night");
	});
	it("every token bundle has non-empty hex colors", () => {
		for (const p of ["sunrise", "day", "dusk", "night"] as const) {
			const t = PHASE_TOKENS[p];
			for (const k of ["g1", "g2", "g3", "bloomA", "bloomB", "acc"] as const) {
				expect(t[k]).toMatch(/^#[0-9a-fA-F]{3,8}$/);
			}
		}
	});
});
