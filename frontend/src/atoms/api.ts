import { atom } from "jotai";
import { atomWithQuery } from "jotai-tanstack-query";
import { api } from "../api/client";
import type {
	CorrelationResult,
	DailyMetrics,
	Recommendation,
	SleepSession,
	StageSegment,
	Workout,
} from "../lib/types";

// ---------------------------------------------------------------------------
// Shared date atoms
// ---------------------------------------------------------------------------

function todayStr() {
	return new Date().toISOString().slice(0, 10);
}

export const sleepDayAtom = atom(todayStr());
export const recoveryDayAtom = atom(todayStr());
export const strainDayAtom = atom(todayStr());
export const journalDayAtom = atom(todayStr());

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export const todayMetricsAtom = atomWithQuery(() => ({
	queryKey: ["today"],
	queryFn: () => api<DailyMetrics>("/api/today"),
}));

export const weekMetricsAtom = atomWithQuery(() => ({
	queryKey: ["week"],
	queryFn: () => api<{ days: DailyMetrics[] }>("/api/week"),
}));

// ---------------------------------------------------------------------------
// Sleep
// ---------------------------------------------------------------------------

export interface SleepApiResponse extends SleepSession {
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

export const trendsRangeAtom = atom<"7d" | "30d" | "90d">("30d");
export const trendsMetricAtom = atom<string>("recovery");

export const trendsAtom = atomWithQuery((get) => {
	const rangeDays = { "7d": 7, "30d": 30, "90d": 90 }[get(trendsRangeAtom)];
	const d = new Date();
	d.setDate(d.getDate() - rangeDays + 1);
	const start = d.toISOString().slice(0, 10);
	const end = todayStr();
	const metric = get(trendsMetricAtom);
	return {
		queryKey: ["trends", start, end, metric],
		queryFn: () =>
			api<{ days: DailyMetrics[] }>(
				`/api/trends?start=${start}&end=${end}&metrics=${metric}`,
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

interface JournalQuestion {
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
// Auth
// ---------------------------------------------------------------------------

export const authStatusAtom = atomWithQuery(() => ({
	queryKey: ["auth-status"],
	queryFn: () => api<{ authenticated: boolean }>("/auth/status"),
}));
