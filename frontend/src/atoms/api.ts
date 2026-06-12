import { atom } from "jotai";
import { atomWithQuery } from "jotai-tanstack-query";
import { api } from "../api/client";
import type {
	BaselinesResponse,
	BehaviorEffect,
	CorrelationResult,
	DailyMetrics,
	HRTrendData,
	ReadinessResult,
	Recommendation,
	SparklineData,
	StageSegment,
	Workout,
	WorkoutsSummary,
} from "../lib/types";

// ---------------------------------------------------------------------------
// Shared date atoms
// ---------------------------------------------------------------------------

// Local calendar date — toISOString() is UTC and disagrees with the
// backend's local-time day boundaries in the evening/morning.
function dayStr(d: Date) {
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function todayStr() {
	return dayStr(new Date());
}

export const controlCenterDayAtom = atom(todayStr());
export const sleepDayAtom = atom(todayStr());
export const recoveryDayAtom = atom(todayStr());
export const strainDayAtom = atom(todayStr());
export const journalDayAtom = atom(todayStr());

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export const todayMetricsAtom = atomWithQuery((get) => {
	const day = get(controlCenterDayAtom);
	return {
		queryKey: ["today", day],
		queryFn: () => api<DailyMetrics>(`/api/today?day=${day}`),
	};
});

export const weekMetricsAtom = atomWithQuery(() => ({
	queryKey: ["week"],
	queryFn: () => api<{ days: DailyMetrics[] }>("/api/week"),
}));

// ---------------------------------------------------------------------------
// Sleep
// ---------------------------------------------------------------------------

export interface SleepApiResponse {
	id: number;
	start_ts: number;
	end_ts: number;
	efficiency: number | null;
	resting_hr: number | null;
	avg_hrv: number | null;
	status?: string;
	sleep_minutes?: number;
	deep_minutes?: number;
	rem_minutes?: number;
	light_minutes?: number;
	wake_minutes?: number;
	sleep_performance?: number;
	stages?: StageSegment[];
}

export const sleepDetailAtom = atomWithQuery((get) => ({
	queryKey: ["sleep", get(sleepDayAtom)],
	queryFn: () => api<SleepApiResponse>(`/api/sleep/${get(sleepDayAtom)}`),
}));

// ---------------------------------------------------------------------------
// Recovery
// ---------------------------------------------------------------------------

export interface RecoveryDetail {
	day: string;
	recovery: number | null;
	hrv_rmssd: number | null;
	resting_hr: number | null;
	resp_rate: number | null;
	sleep_performance: number | null;
}

export const recoveryDetailAtom = atomWithQuery((get) => ({
	queryKey: ["recovery", get(recoveryDayAtom)],
	queryFn: () =>
		api<RecoveryDetail>(`/api/recovery/${get(recoveryDayAtom)}`),
}));

// ---------------------------------------------------------------------------
// Strain
// ---------------------------------------------------------------------------

export interface StrainDetail {
	day: string;
	strain: number | null;
	calories: number | null;
	avg_hr: number | null;
	max_hr: number | null;
	trend: Array<{ day: string; strain: number | null }>;
}

export const strainDetailAtom = atomWithQuery((get) => ({
	queryKey: ["strain", get(strainDayAtom)],
	queryFn: () => api<StrainDetail>(`/api/strain/${get(strainDayAtom)}`),
}));

// ---------------------------------------------------------------------------
// Workouts
// ---------------------------------------------------------------------------

export const workoutsAtom = atomWithQuery(() => ({
	queryKey: ["workouts"],
	queryFn: () => api<{ workouts: Workout[] }>("/api/workouts"),
}));

// ---------------------------------------------------------------------------
// Trends
// ---------------------------------------------------------------------------

export const trendsRangeAtom = atom<"7d" | "30d" | "90d" | "6m" | "1y" | "all">("30d");
export const trendsMetricAtom = atom<string>("recovery");

export const trendsAtom = atomWithQuery((get) => {
	const rangeMap: Record<string, number> = {
		"7d": 7, "30d": 30, "90d": 90, "6m": 180, "1y": 365, all: 3650,
	};
	const rangeDays = rangeMap[get(trendsRangeAtom)] ?? 30;
	const d = new Date();
	d.setDate(d.getDate() - rangeDays + 1);
	const start = dayStr(d);
	const end = todayStr();
	return {
		queryKey: ["trends", start, end],
		queryFn: () =>
			api<{ days: DailyMetrics[] }>(
				`/api/trends?start=${start}&end=${end}&metrics=recovery,strain,hrv_rmssd,resting_hr,sleep_minutes,sleep_performance`,
			),
	};
});

// ---------------------------------------------------------------------------
// Insights
// ---------------------------------------------------------------------------

export const insightsAtom = atomWithQuery(() => ({
	queryKey: ["insights"],
	queryFn: () =>
		api<{ correlations: CorrelationResult[] }>("/api/insights"),
}));

// ---------------------------------------------------------------------------
// Coach
// ---------------------------------------------------------------------------

export const coachAtom = atomWithQuery(() => ({
	queryKey: ["coach"],
	queryFn: () =>
		api<{ recommendations: Recommendation[] }>("/api/coach"),
}));

// ---------------------------------------------------------------------------
// Journal
// ---------------------------------------------------------------------------

export interface JournalQuestion {
	id: string;
	question: string;
	category: string;
}

interface JournalEntry {
	question_id: string;
	question: string;
	answer: boolean;
	day: string;
}

export const journalCatalogAtom = atomWithQuery(() => ({
	queryKey: ["journal-catalog"],
	queryFn: () =>
		api<{ questions: JournalQuestion[] }>("/api/journal/catalog"),
}));

export const journalEntriesAtom = atomWithQuery((get) => ({
	queryKey: ["journal-entries", get(journalDayAtom)],
	queryFn: () =>
		api<{ entries: JournalEntry[] }>(
			`/api/journal?day=${get(journalDayAtom)}`,
		),
}));

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export interface ProfileSettings {
	age: number | null;
	sex: string | null;
	weight_kg: number | null;
	height_cm: number | null;
	unit_system: "metric" | "imperial";
	hr_max: number | null;
	sleep_need_hours: number | null;
}

export const settingsAtom = atomWithQuery(() => ({
	queryKey: ["settings"],
	queryFn: () => api<ProfileSettings>("/api/settings"),
}));

// ---------------------------------------------------------------------------
// Sparklines
// ---------------------------------------------------------------------------

export const sparklinesAtom = atomWithQuery((get) => {
	const day = get(controlCenterDayAtom);
	return {
		queryKey: ["sparklines", day],
		queryFn: () => api<SparklineData>(`/api/sparklines?days=14&end_day=${day}`),
	};
});

// ---------------------------------------------------------------------------
// Readiness
// ---------------------------------------------------------------------------

export const readinessAtom = atomWithQuery((get) => {
	const day = get(controlCenterDayAtom);
	return {
		queryKey: ["readiness", day],
		queryFn: () => api<ReadinessResult>(`/api/readiness?day=${day}`),
	};
});

// ---------------------------------------------------------------------------
// HR Trend
// ---------------------------------------------------------------------------

export const hrTrendAtom = atomWithQuery((get) => {
	const day = get(controlCenterDayAtom);
	return {
		queryKey: ["hr-trend", day],
		queryFn: () => api<HRTrendData>(`/api/hr-trend?day=${day}`),
	};
});

// ---------------------------------------------------------------------------
// Baselines
// ---------------------------------------------------------------------------

export const baselinesAtom = atomWithQuery(() => ({
	queryKey: ["baselines"],
	queryFn: () => api<BaselinesResponse>("/api/baselines"),
}));

// ---------------------------------------------------------------------------
// Behaviour Effects
// ---------------------------------------------------------------------------

export const behaviourOutcomeAtom = atom<"recovery" | "hrv" | "sleep_performance" | "resting_hr">("recovery");

export const behaviourEffectsAtom = atomWithQuery((get) => ({
	queryKey: ["behaviour-effects", get(behaviourOutcomeAtom)],
	queryFn: () =>
		api<{ effects: BehaviorEffect[] }>(
			`/api/insights/behaviours?outcome=${get(behaviourOutcomeAtom)}`,
		),
}));

// ---------------------------------------------------------------------------
// Workouts Range + Summary
// ---------------------------------------------------------------------------

export const workoutsRangeAtom = atom<"7d" | "30d" | "90d" | "1y" | "all">("30d");

export const workoutsSummaryAtom = atomWithQuery((get) => {
	const days = { "7d": 7, "30d": 30, "90d": 90, "1y": 365, all: 9999 }[
		get(workoutsRangeAtom)
	];
	return {
		queryKey: ["workouts-summary", days],
		queryFn: () => api<WorkoutsSummary>(`/api/workouts/summary?days=${days}`),
	};
});

// ---------------------------------------------------------------------------
// Sleep Trend (dedicated 30-day atom)
// ---------------------------------------------------------------------------

export const sleepTrendAtom = atomWithQuery(() => {
	const d = new Date();
	d.setDate(d.getDate() - 29);
	const start = dayStr(d);
	const end = todayStr();
	return {
		queryKey: ["sleep-trend"],
		queryFn: () =>
			api<{ days: DailyMetrics[] }>(
				`/api/trends?start=${start}&end=${end}&metrics=sleep_minutes`,
			),
	};
});

// ---------------------------------------------------------------------------
// Year Recovery (heatmap)
// ---------------------------------------------------------------------------

export const yearRecoveryAtom = atomWithQuery(() => {
	const d = new Date();
	d.setDate(d.getDate() - 364);
	const start = dayStr(d);
	const end = todayStr();
	return {
		queryKey: ["year-recovery"],
		queryFn: () =>
			api<{ days: DailyMetrics[] }>(
				`/api/trends?start=${start}&end=${end}&metrics=recovery`,
			),
	};
});

// ---------------------------------------------------------------------------
// Health Age
// ---------------------------------------------------------------------------

export interface HealthAgeMetric {
	key: string;
	label: string;
	value: number | null;
	unit: string;
	target: string;
	delta_years: number | null;
}

export interface HealthAgeResult {
	status: "ok" | "needs_profile" | "insufficient_data";
	message?: string;
	chronological_age?: number;
	health_age?: number;
	delta_years?: number;
	window_days?: number;
	metrics?: HealthAgeMetric[];
}

export const healthAgeAtom = atomWithQuery(() => ({
	queryKey: ["health-age"],
	queryFn: () => api<HealthAgeResult>("/api/health-age"),
}));

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export const authStatusAtom = atomWithQuery(() => ({
	queryKey: ["auth-status"],
	queryFn: () => api<{ authenticated: boolean }>("/auth/status"),
}));
