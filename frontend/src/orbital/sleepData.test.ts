import { describe, expect, it } from "vitest";
import type { StageSegment } from "../lib/types";
import { asSleepSession, decimateStages } from "./sleepData";

const seg = (
	start: number,
	end: number,
	stage: StageSegment["stage"],
): StageSegment => ({ start, end, stage });

describe("decimateStages", () => {
	it("returns null for empty or single-plateau input", () => {
		expect(decimateStages([])).toBeNull();
		expect(decimateStages([seg(0, 600, "light")])).toBeNull();
	});

	it("merges consecutive same-stage segments", () => {
		const t = decimateStages([
			seg(0, 300, "light"),
			seg(300, 600, "light"),
			seg(600, 900, "deep"),
		]);
		expect(t?.segments).toEqual([seg(0, 600, "light"), seg(600, 900, "deep")]);
	});

	it("absorbs sub-2-min non-wake segments into the previous plateau", () => {
		const t = decimateStages([
			seg(0, 600, "light"),
			seg(600, 690, "rem"), // 90s blip — folded into light
			seg(690, 1290, "deep"),
		]);
		expect(t?.segments).toEqual([
			seg(0, 690, "light"),
			seg(690, 1290, "deep"),
		]);
		expect(t?.wakeEvents).toEqual([]);
	});

	it("keeps sub-2-min wake blips as point events", () => {
		const t = decimateStages([
			seg(0, 600, "light"),
			seg(600, 660, "wake"), // 60s — marker, not plateau
			seg(660, 1260, "deep"),
		]);
		expect(t?.segments).toEqual([
			seg(0, 660, "light"),
			seg(660, 1260, "deep"),
		]);
		expect(t?.wakeEvents).toEqual([630]);
	});

	it("keeps wake segments >= 2 min as track plateaus", () => {
		const t = decimateStages([
			seg(0, 600, "light"),
			seg(600, 900, "wake"),
			seg(900, 1500, "deep"),
		]);
		expect(t?.segments.map((s) => s.stage)).toEqual([
			"light",
			"wake",
			"deep",
		]);
		expect(t?.wakeEvents).toEqual([]);
	});

	it("coarsens until under the segment cap", () => {
		// 300 alternating 3-min segments — over the 120 cap at the 2-min
		// threshold, so the threshold doubles until plateaus collapse
		const stages: StageSegment[] = [];
		for (let i = 0; i < 300; i += 1) {
			stages.push(seg(i * 180, (i + 1) * 180, i % 2 === 0 ? "light" : "deep"));
		}
		const t = decimateStages(stages);
		expect(t).not.toBeNull();
		expect(t!.segments.length).toBeLessThanOrEqual(120);
		expect(t!.startTs).toBe(0);
		expect(t!.endTs).toBe(300 * 180);
	});

	it("spans the session and stays sorted/contiguous", () => {
		const t = decimateStages([
			seg(100, 130, "wake"), // 30s wake at sleep onset
			seg(130, 1000, "light"),
			seg(1000, 2000, "deep"),
			seg(2000, 2400, "rem"),
		]);
		expect(t?.startTs).toBe(100);
		expect(t?.endTs).toBe(2400);
		for (let i = 1; i < (t?.segments.length ?? 0); i += 1) {
			expect(t!.segments[i].start).toBe(t!.segments[i - 1].end);
		}
	});
});

describe("asSleepSession", () => {
	it("narrows no_data and nullish to null", () => {
		expect(asSleepSession(null)).toBeNull();
		expect(asSleepSession(undefined)).toBeNull();
		expect(asSleepSession({ status: "no_data" })).toBeNull();
	});
	it("passes sessions through", () => {
		const s = { id: 1, start_ts: 0, end_ts: 60, stages: [] };
		expect(asSleepSession(s)).toBe(s);
	});
});
