// Demo data layer — when VITE_DEMO is set the app runs fully client-side with
// generated sample data (for the static GitHub Pages demo, no backend).
// Curves mirror the backend seed so the charts look like the README gallery.

function mulberry32(seed: number) {
	return () => {
		seed |= 0;
		seed = (seed + 0x6d2b79f5) | 0;
		let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const iso = (d: Date) => d.toISOString().slice(0, 10);
const dayStart = (d: string) => Math.floor(new Date(`${d}T00:00:00`).getTime() / 1000);

export interface DayMetrics {
	day: string;
	recovery: number;
	strain: number;
	sleep_performance: number; // 0..100 (API scale)
	hrv_rmssd: number;
	resting_hr: number;
	resp_rate: number;
	spo2: number;
	skin_temp: number;
	steps: number;
	calories: number;
	sleep_minutes: number;
	deep_minutes: number;
	rem_minutes: number;
	light_minutes: number;
	wake_minutes: number;
}

const N = 120;
const TODAY = new Date();
TODAY.setHours(0, 0, 0, 0);

const DATASET: DayMetrics[] = (() => {
	const rnd = mulberry32(7);
	const out: DayMetrics[] = [];
	for (let i = 0; i < N; i++) {
		const d = new Date(TODAY);
		d.setDate(d.getDate() - (N - 1 - i));
		const p = i;
		const recovery = clamp(62 + 26 * Math.sin(p / 9) + 6 * Math.sin(p / 2.3) + (rnd() - 0.5) * 8, 34, 97);
		const strain = clamp(11 + 5 * Math.sin(p / 6 + 1) + 2 * Math.sin(p / 1.7) + (rnd() - 0.5) * 3, 5, 19);
		const sp = clamp(85 + 10 * Math.sin(p / 7) + (rnd() - 0.5) * 6, 60, 99);
		const hrv = clamp(66 + 14 * Math.sin(p / 8) + (rnd() - 0.5) * 8, 40, 95);
		const rhr = clamp(52 - 3 * Math.sin(p / 8) + (rnd() - 0.5) * 3, 46, 62);
		const sm = Math.round(420 + 40 * Math.sin(p / 7) + (rnd() - 0.5) * 40);
		const deep = Math.round(sm * 0.18);
		const rem = Math.round(sm * 0.22);
		const wake = Math.round(8 + rnd() * 4);
		out.push({
			day: iso(d),
			recovery: Math.round(recovery * 10) / 10,
			strain: Math.round(strain * 10) / 10,
			sleep_performance: Math.round(sp * 10) / 10,
			hrv_rmssd: Math.round(hrv * 10) / 10,
			resting_hr: Math.round(rhr * 10) / 10,
			resp_rate: Math.round((14 + 1.2 * Math.sin(p / 5)) * 10) / 10,
			spo2: Math.round((97 + 1.4 * Math.sin(p / 4)) * 10) / 10,
			skin_temp: Math.round((33 + 0.4 * Math.sin(p / 6)) * 10) / 10,
			steps: Math.round(8000 + 5000 * Math.max(0, Math.sin(p / 3)) + (rnd() - 0.5) * 3000),
			calories: Math.round(380 + 260 * Math.max(0, Math.sin(p / 3 + 0.5)) + (rnd() - 0.5) * 80),
			sleep_minutes: sm,
			deep_minutes: deep,
			rem_minutes: rem,
			wake_minutes: wake,
			light_minutes: sm - deep - rem - wake,
		});
	}
	// hero today
	const t = out[out.length - 1];
	Object.assign(t, {
		recovery: 84, strain: 14.2, sleep_performance: 91, hrv_rmssd: 78, resting_hr: 49,
		steps: 11200, calories: 640, sleep_minutes: 451, deep_minutes: 86, rem_minutes: 102,
		light_minutes: 255, wake_minutes: 8,
	});
	return out;
})();

const byDay = new Map(DATASET.map((d) => [d.day, d]));
const get = (day: string) => byDay.get(day) ?? DATASET[DATASET.length - 1];
const todayIso = DATASET[DATASET.length - 1].day;

function hrTrend(day: string) {
	const rnd = mulberry32(dayStart(day));
	const d0 = dayStart(day);
	const isToday = day === todayIso;
	const endH = isToday ? Math.max(1, Math.min(23, new Date().getHours())) : 23;
	const points: { ts: number; bpm: number }[] = [];
	for (let m = 0; m <= endH * 60; m += 5) {
		const h = m / 60;
		const base = h < 6 ? 52 + 2 * Math.sin(h) : 56 + 11 * Math.sin(((h - 6) / 20) * Math.PI);
		const spike = h >= 17 && h < 18 ? 50 * Math.sin((h - 17) * Math.PI) : 0;
		points.push({ ts: d0 + m * 60, bpm: Math.round(clamp(base + spike + (rnd() - 0.5) * 6, 46, 168)) });
	}
	const bpms = points.map((p) => p.bpm);
	return {
		points,
		min: Math.min(...bpms),
		max: Math.max(...bpms),
		avg: Math.round(bpms.reduce((a, b) => a + b, 0) / bpms.length),
	};
}

function sleepSession(day: string) {
	const d0 = dayStart(day);
	const start = d0 - 3600;
	const end = d0 + Math.round(6.83 * 3600);
	const rnd = mulberry32(d0);
	const pattern: [string, number][] = [["light", 18], ["deep", 30], ["light", 12], ["rem", 22]];
	const stages: { stage: string; start: number; end: number }[] = [];
	let t = start;
	let i = 0;
	while (t < end - 600) {
		const [stage, mins] = pattern[i % 4];
		const e = Math.min(end, t + mins * 60);
		stages.push({ stage, start: t, end: e });
		t = e;
		if (i % 4 === 3 && rnd() < 0.6 && t < end - 600) {
			const e2 = Math.min(end, t + (3 + Math.floor(rnd() * 4)) * 60);
			stages.push({ stage: "wake", start: t, end: e2 });
			t = e2;
		}
		i++;
	}
	const m = get(day);
	return {
		start_ts: start, end_ts: end, efficiency: 0.93, stages, resting_hr: 49, avg_hrv: 72,
		sleep_minutes: m.sleep_minutes, deep_minutes: m.deep_minutes, rem_minutes: m.rem_minutes,
		light_minutes: m.light_minutes, wake_minutes: m.wake_minutes, sleep_performance: m.sleep_performance,
	};
}

const SPARKLINE_METRICS = [
	"recovery", "strain", "hrv_rmssd", "resting_hr", "sleep_minutes", "sleep_performance",
	"spo2", "resp_rate", "steps", "calories", "deep_minutes", "rem_minutes",
] as const;

const BASELINES = {
	hrv: { mean: 66, spread: 8, status: "trusted" },
	resting_hr: { mean: 52, spread: 3, status: "trusted" },
	resp_rate: { mean: 14.5, spread: 0.8, status: "trusted" },
};

function range(start: string, end: string) {
	return DATASET.filter((d) => d.day >= start && d.day <= end);
}

/** Resolve a demo request. `path` is the same string the real api() would fetch. */
export function demoRequest(path: string, options?: RequestInit): unknown {
	const [p, qs] = path.split("?");
	const q = new URLSearchParams(qs);
	const seg = p.split("/").filter(Boolean); // e.g. ["api","recovery","2026-06-16"]

	if (options?.method === "POST" || options?.method === "PUT") {
		if (p === "/sync/start" || p === "/sync/full") return { synced: { heart_rate: 288, sleep: 1 } };
		return { status: "ok" };
	}
	if (p === "/auth/status") return { authenticated: true };
	if (p === "/sync/status") {
		const last = new Date().toISOString();
		return { sync_states: { heart_rate: { last_synced: last }, sleep: { last_synced: last } } };
	}

	if (p === "/api/today") return get(q.get("day") ?? todayIso);
	if (p === "/api/week") {
		const end = todayIso;
		const start = DATASET[DATASET.length - 7].day;
		return { days: range(start, end) };
	}
	if (p === "/api/sparklines") {
		const end = q.get("end_day") ?? todayIso;
		const days = Number(q.get("days") ?? 14);
		const endIdx = DATASET.findIndex((d) => d.day === end);
		const slice = DATASET.slice(Math.max(0, (endIdx < 0 ? DATASET.length - 1 : endIdx) - days + 1), (endIdx < 0 ? DATASET.length : endIdx + 1));
		const res: Record<string, (number | null)[]> = {};
		for (const m of SPARKLINE_METRICS) res[m] = slice.map((d) => (d as unknown as Record<string, number>)[m]);
		return res;
	}
	if (p === "/api/hr-trend") return hrTrend(q.get("day") ?? todayIso);
	if (p === "/api/trends") {
		const start = q.get("start") ?? DATASET[0].day;
		const end = q.get("end") ?? todayIso;
		const keys = (q.get("metrics") ?? "recovery").split(",");
		return { days: range(start, end).map((d) => ({ day: d.day, ...Object.fromEntries(keys.map((k) => [k, (d as unknown as Record<string, number>)[k]])) })) };
	}
	if (seg[0] === "api" && seg[1] === "recovery" && seg[2]) {
		const day = seg[2];
		const m = get(day);
		const tStart = iso(new Date(dayStart(day) * 1000 - 13 * 86400000));
		return {
			day, recovery: m.recovery, hrv_rmssd: m.hrv_rmssd, resting_hr: m.resting_hr,
			resp_rate: m.resp_rate, sleep_performance: m.sleep_performance, baselines: BASELINES,
			trend: range(tStart, day).map((d) => ({ day: d.day, recovery: d.recovery })),
		};
	}
	if (seg[0] === "api" && seg[1] === "strain" && seg[2]) {
		const day = seg[2];
		const m = get(day);
		const tStart = iso(new Date(dayStart(day) * 1000 - 6 * 86400000));
		return { day, strain: m.strain, calories: m.calories, trend: range(tStart, day).map((d) => ({ day: d.day, strain: d.strain })) };
	}
	if (seg[0] === "api" && seg[1] === "sleep" && seg[2]) return sleepSession(seg[2]);

	if (p === "/api/readiness") {
		const m = get(q.get("day") ?? todayIso);
		const sig = (key: string, label: string, detail: string, flag: string) => ({ key, label, detail, flag });
		return {
			level: m.recovery >= 70 ? "primed" : m.recovery >= 50 ? "balanced" : "strained",
			headline: m.recovery >= 70 ? "You're primed — go for it." : "Looking balanced — train with intention.",
			summary: "HRV is elevated above your baseline, resting heart rate is low, and your sleep debt is minimal.",
			acwr: 1.08,
			signals: [
				sig("hrv", "HRV", `HRV is above baseline (z=${((m.hrv_rmssd - 66) / 10).toFixed(2)}).`, m.hrv_rmssd >= 66 ? "good" : "watch"),
				sig("rhr", "Resting HR", `RHR is at or below baseline (${(m.resting_hr - 52).toFixed(1)} bpm).`, m.resting_hr <= 52 ? "good" : "neutral"),
				sig("load", "Training Load", "Acute:chronic load ratio is optimal (ACWR=1.08).", "good"),
				sig("sleep_debt", "Sleep Debt", "Sleep is meeting your need (94% of target).", "good"),
			],
		};
	}
	if (p === "/api/coach") {
		const m = get(todayIso);
		return {
			recommendations: [
				{ category: "recovery", message: "Recovery is green. Your body is ready to push — high-intensity training is appropriate today.", priority: 3 },
				m.sleep_performance < 85 ? { category: "sleep", message: `Sleep performance is ${Math.round(m.sleep_performance)}%. Prioritize an earlier bedtime tonight.`, priority: 1 } : null,
			].filter(Boolean),
		};
	}
	if (p === "/api/health-age") {
		return {
			status: "ok", chronological_age: 30, health_age: 26.4, delta_years: -3.6, window_days: 90,
			metrics: [
				{ key: "hrv", label: "HRV", value: 66, unit: "ms", target: "higher", delta_years: -2.1 },
				{ key: "resting_hr", label: "Resting HR", value: 52, unit: "bpm", target: "lower", delta_years: -1.0 },
				{ key: "vo2", label: "Sleep", value: 91, unit: "%", target: "higher", delta_years: -0.5 },
			],
		};
	}
	if (p === "/api/baselines") return Object.fromEntries(Object.entries(BASELINES).map(([k, v]) => [k, { mean: v.mean, spread: v.spread, status: v.status }]));
	if (p === "/api/workouts") {
		const w = (off: number, type: string, cal: number, ah: number, mh: number, st: number) => {
			const s = dayStart(DATASET[DATASET.length - 1 - off].day) + 17 * 3600;
			return { id: off, start_ts: s, end_ts: s + 3000, type, calories: cal, avg_hr: ah, max_hr: mh, strain: st, source: "demo" };
		};
		return { workouts: [w(0, "Run", 520, 148, 176, 14.2), w(2, "Cycling", 430, 135, 162, 11.8), w(5, "Strength", 300, 118, 150, 9.4)] };
	}
	if (p === "/api/workouts/summary") {
		return {
			count: 14, total_minutes: 690, total_calories: 6200,
			sport_breakdown: [
				{ type: "Run", count: 6, minutes: 300, avg_strain: 13.4, avg_hr: 150 },
				{ type: "Cycling", count: 5, minutes: 250, avg_strain: 11.2, avg_hr: 138 },
				{ type: "Strength", count: 3, minutes: 140, avg_strain: 9.1, avg_hr: 120 },
			],
			hr_zones: { 1: 80, 2: 180, 3: 240, 4: 150, 5: 40 },
		};
	}
	if (p === "/api/insights") {
		return {
			correlations: [
				{ x: "deep_minutes", y: "recovery", lag: 0, r: 0.62, n: 90, p: 0.0001 },
				{ x: "strain", y: "hrv_rmssd", lag: 1, r: -0.41, n: 89, p: 0.001 },
				{ x: "steps", y: "sleep_performance", lag: 0, r: 0.28, n: 90, p: 0.007 },
			],
		};
	}
	if (p === "/api/insights/behaviours") {
		return {
			effects: [
				{ question_key: "alcohol", question: "Did you drink any alcohol?", category: "lifestyle", with_mean: 58.2, without_mean: 71.4, effect_size: -0.74, n_with: 12, n_without: 78, significant: true, direction: "negative", sentence: "On days you drank alcohol, recovery was lower (58.2 vs 71.4, 18% diff) — a worse outcome." },
				{ question_key: "magnesium", question: "Did you take magnesium?", category: "lifestyle", with_mean: 74.1, without_mean: 67.0, effect_size: 0.43, n_with: 30, n_without: 60, significant: false, direction: "positive", sentence: "On days you took magnesium, recovery was higher (74.1 vs 67.0, 11% diff) — a better outcome." },
			],
		};
	}
	if (p === "/api/journal/catalog") {
		return { questions: [
			{ id: "alcohol", question: "Did you drink any alcohol?", category: "lifestyle" },
			{ id: "caffeine_late", question: "Did you have caffeine late in the day?", category: "lifestyle" },
			{ id: "screen_in_bed", question: "Did you view a screen in bed?", category: "sleep" },
			{ id: "stressed", question: "Did you feel stressed?", category: "recovery" },
			{ id: "magnesium", question: "Did you take magnesium?", category: "lifestyle" },
		] };
	}
	if (p === "/api/journal") return { entries: [] };
	if (p === "/api/settings") return { age: 30, sex: "male", weight_kg: 74, height_cm: 178, unit_system: "metric", hr_max: 190, sleep_need_hours: 8 };

	return { status: "no_data" };
}
