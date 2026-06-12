import { atomWithQuery } from "jotai-tanstack-query";
import { api } from "../api/client";
import { controlCenterDayAtom, type SleepApiResponse } from "../atoms/api";
import type { StageSegment } from "../lib/types";

/**
 * Orbital-local sleep query — keyed on `controlCenterDayAtom` (NOT the 2D
 * page's `sleepDayAtom`) so DateNav time travel re-draws the descent track
 * in lockstep with the rest of the world.
 */
export const orbitalSleepAtom = atomWithQuery((get) => {
	const day = get(controlCenterDayAtom);
	return {
		queryKey: ["orbital-sleep", day],
		queryFn: () => api<SleepApiResponse>(`/api/sleep/${day}`),
	};
});

/** `/api/sleep/:day` returns the session OR `{status:"no_data"}` — narrow. */
export function asSleepSession(data: unknown): SleepApiResponse | null {
	if (data == null || typeof data !== "object") return null;
	if ("status" in data && (data as { status?: string }).status === "no_data")
		return null;
	return data as SleepApiResponse;
}

export interface SleepTrack {
	startTs: number;
	endTs: number;
	/** decimated stage plateaus — the rendered descent steps */
	segments: StageSegment[];
	/** midpoints (unix sec) of sub-threshold wake blips — flash markers */
	wakeEvents: number[];
}

const MIN_SEGMENT_SEC = 120;
const MAX_SEGMENTS = 120;

function mergeAdjacent(segments: StageSegment[]): StageSegment[] {
	const out: StageSegment[] = [];
	for (const s of segments) {
		const prev = out[out.length - 1];
		// tolerate tiny scoring gaps (≤60s) between same-stage neighbours
		if (prev && prev.stage === s.stage && s.start - prev.end <= 60) {
			prev.end = Math.max(prev.end, s.end);
		} else {
			out.push({ ...s });
		}
	}
	return out;
}

/**
 * Drop sub-threshold segments by absorbing them into the previous plateau.
 * Wake blips are remembered as point events instead of vanishing — brief
 * awakenings are clinically interesting even when too short to draw.
 */
function absorbShort(
	segments: StageSegment[],
	minSec: number,
): { segments: StageSegment[]; wakeEvents: number[] } {
	const wakeEvents: number[] = [];
	const kept: StageSegment[] = [];
	for (const s of segments) {
		if (s.end - s.start >= minSec) {
			kept.push({ ...s });
			continue;
		}
		if (s.stage === "wake") wakeEvents.push((s.start + s.end) / 2);
		if (kept.length > 0) kept[kept.length - 1].end = s.end;
	}
	if (kept.length > 0) kept[0].start = segments[0].start;
	return { segments: mergeAdjacent(kept), wakeEvents };
}

/**
 * Hypnogram decimation for the 3D track: merge same-stage runs, fold
 * segments < 2 min into their neighbour (wake blips become point markers),
 * then — if still over MAX_SEGMENTS — repeatedly absorb the shortest
 * plateau into its longer neighbour. Shortest-first keeps the dominant
 * architecture intact while bounding the TubeGeometry vertex count.
 */
export function decimateStages(stages: StageSegment[]): SleepTrack | null {
	if (stages.length === 0) return null;
	const merged = mergeAdjacent(
		[...stages].sort((a, b) => a.start - b.start),
	);
	const pass = absorbShort(merged, MIN_SEGMENT_SEC);
	const wakeEvents = pass.wakeEvents;
	let segs = pass.segments;
	while (segs.length > MAX_SEGMENTS) {
		let idx = 0;
		let shortest = Infinity;
		for (let i = 0; i < segs.length; i += 1) {
			const dur = segs[i].end - segs[i].start;
			if (dur < shortest) {
				shortest = dur;
				idx = i;
			}
		}
		const s = segs[idx];
		if (s.stage === "wake") wakeEvents.push((s.start + s.end) / 2);
		const prev = segs[idx - 1];
		const next = segs[idx + 1];
		if (prev && (!next || prev.end - prev.start >= next.end - next.start)) {
			prev.end = s.end;
		} else if (next) {
			next.start = s.start;
		}
		segs.splice(idx, 1);
		segs = mergeAdjacent(segs);
	}
	if (segs.length < 2) return null;
	wakeEvents.sort((a, b) => a - b);
	return {
		startTs: segs[0].start,
		endTs: segs[segs.length - 1].end,
		segments: segs,
		wakeEvents,
	};
}
