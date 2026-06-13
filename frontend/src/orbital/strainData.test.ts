import { describe, expect, it } from "vitest";
import type { HRTrendPoint, Workout } from "../lib/types";
import {
	CAMERA_FACING_ANGLE,
	dayFracToAngle,
	formatWorkoutType,
	HIDDEN_HOUR,
	localDayFrac,
	sliceTrace,
	tracePath,
	workoutFlare,
	workoutIntensity,
	workoutsForDay,
} from "./strainData";

// build a unix-seconds timestamp from LOCAL wall-clock parts (TZ-agnostic)
const localTs = (h: number, min = 0, day = 15) =>
	new Date(2026, 5, day, h, min, 0).getTime() / 1000;

const workout = (over: Partial<Workout> = {}): Workout => ({
	id: 1,
	start_ts: localTs(17, 0),
	end_ts: localTs(18, 0),
	type: "STRENGTH_TRAINING",
	calories: 450,
	avg_hr: 123,
	max_hr: null,
	strain: null,
	...over,
});

describe("dayFracToAngle", () => {
	it("pins the hidden hour to the anti-camera direction", () => {
		expect(dayFracToAngle(HIDDEN_HOUR / 24)).toBeCloseTo(
			CAMERA_FACING_ANGLE + Math.PI,
			10,
		);
	});

	it("advances linearly — half a day is half a turn", () => {
		const a = dayFracToAngle(0.2);
		expect(dayFracToAngle(0.7) - a).toBeCloseTo(Math.PI, 10);
		expect(dayFracToAngle(1.2) - a).toBeCloseTo(2 * Math.PI, 10);
	});
});

describe("localDayFrac", () => {
	it("maps local wall-clock to day fraction", () => {
		expect(localDayFrac(localTs(0, 0))).toBeCloseTo(0, 10);
		expect(localDayFrac(localTs(12, 0))).toBeCloseTo(0.5, 10);
		expect(localDayFrac(localTs(18, 0))).toBeCloseTo(0.75, 10);
	});
});

describe("workoutsForDay", () => {
	it("filters to the local start date and sorts oldest first", () => {
		const a = workout({ id: 1, start_ts: localTs(18), end_ts: localTs(19) });
		const b = workout({ id: 2, start_ts: localTs(7), end_ts: localTs(8) });
		const other = workout({
			id: 3,
			start_ts: localTs(9, 0, 14),
			end_ts: localTs(10, 0, 14),
		});
		const out = workoutsForDay([a, other, b], "2026-06-15");
		expect(out.map((w) => w.id)).toEqual([2, 1]);
	});

	it("drops degenerate sub-2-min blips", () => {
		const blip = workout({ end_ts: localTs(17, 0) + 2 });
		expect(workoutsForDay([blip], "2026-06-15")).toEqual([]);
	});

	it("handles undefined input", () => {
		expect(workoutsForDay(undefined, "2026-06-15")).toEqual([]);
	});
});

describe("workoutIntensity", () => {
	it("maps avg_hr over the 60-180 window", () => {
		expect(workoutIntensity(workout({ avg_hr: 60 }))).toBe(0);
		expect(workoutIntensity(workout({ avg_hr: 120 }))).toBeCloseTo(0.5, 10);
		expect(workoutIntensity(workout({ avg_hr: 200 }))).toBe(1);
	});

	it("falls back to strain/21, then a neutral default", () => {
		expect(
			workoutIntensity(workout({ avg_hr: null, strain: 10.5 })),
		).toBeCloseTo(0.5, 10);
		expect(workoutIntensity(workout({ avg_hr: null, strain: null }))).toBe(
			0.35,
		);
	});
});

describe("workoutFlare", () => {
	it("uses strain/21 for height with a 0.15 floor and a 1.0 ceiling", () => {
		expect(workoutFlare(workout({ strain: 21 })).height).toBe(1);
		expect(workoutFlare(workout({ strain: 30 })).height).toBe(1);
		expect(workoutFlare(workout({ strain: 1 })).height).toBe(0.15);
		expect(workoutFlare(workout({ strain: 10.5 })).height).toBeCloseTo(
			0.5,
			10,
		);
	});

	it("falls back to avg_hr intensity when strain is null", () => {
		const f = workoutFlare(workout({ strain: null, avg_hr: 120 }));
		expect(f.height).toBeCloseTo(0.5, 10);
		expect(f.hue).toBeCloseTo(0.5, 10);
	});

	it("places the flare at the workout's midpoint hour", () => {
		const w = workout({ start_ts: localTs(17), end_ts: localTs(18) });
		expect(workoutFlare(w).angle).toBeCloseTo(
			dayFracToAngle(17.5 / 24),
			10,
		);
	});
});

describe("sliceTrace / tracePath", () => {
	const pts: HRTrendPoint[] = [0, 300, 600, 900, 1200].map((dt) => ({
		ts: 1000 + dt,
		bpm: 60 + dt / 20,
	}));

	it("slices to the workout window with one bucket of padding", () => {
		expect(sliceTrace(pts, 1300, 1900).map((p) => p.ts)).toEqual([
			1000, 1300, 1600, 1900, 2200,
		]);
		expect(sliceTrace(pts, 1600, 1600).map((p) => p.ts)).toEqual([
			1300, 1600, 1900,
		]);
		expect(sliceTrace(undefined, 0, 1)).toEqual([]);
	});

	it("fits the polyline to the box, min at the bottom edge", () => {
		const path = tracePath(pts, 100, 50);
		const coords = path.split(" ").map((p) => p.split(",").map(Number));
		expect(coords).toHaveLength(5);
		expect(coords[0]).toEqual([2, 48]); // first = min bpm → bottom-left
		expect(coords[4]).toEqual([98, 2]); // last = max bpm → top-right
	});

	it("returns empty for fewer than 2 points", () => {
		expect(tracePath([], 100, 50)).toBe("");
		expect(tracePath(pts.slice(0, 1), 100, 50)).toBe("");
	});
});

describe("formatWorkoutType", () => {
	it("title-cases snake-case types", () => {
		expect(formatWorkoutType("STRENGTH_TRAINING")).toBe("Strength Training");
		expect(formatWorkoutType("WALKING")).toBe("Walking");
		expect(formatWorkoutType(null)).toBe("Workout");
	});
});
