export interface DailyMetrics {
	day: string;
	recovery: number | null;
	strain: number | null;
	sleep_performance: number | null;
	hrv_rmssd: number | null;
	resting_hr: number | null;
	resp_rate: number | null;
	spo2: number | null;
	skin_temp: number | null;
	steps: number | null;
	calories: number | null;
	sleep_minutes: number | null;
	deep_minutes: number | null;
	rem_minutes: number | null;
	light_minutes: number | null;
	wake_minutes: number | null;
}

export interface StageSegment {
	start: number;
	end: number;
	stage: "wake" | "light" | "deep" | "rem";
}

export interface Workout {
	id: number;
	start_ts: number;
	end_ts: number;
	type: string | null;
	calories: number | null;
	avg_hr: number | null;
	max_hr: number | null;
	strain: number | null;
}

export interface Recommendation {
	category: string;
	message: string;
	priority: number;
}

export interface CorrelationResult {
	x: string;
	y: string;
	lag: number;
	r: number;
	n: number;
	p: number;
}

export interface SparklineData {
	recovery: (number | null)[];
	strain: (number | null)[];
	hrv_rmssd: (number | null)[];
	resting_hr: (number | null)[];
	sleep_minutes: (number | null)[];
	sleep_performance: (number | null)[];
	spo2: (number | null)[];
	resp_rate: (number | null)[];
	steps: (number | null)[];
	calories: (number | null)[];
	deep_minutes: (number | null)[];
	rem_minutes: (number | null)[];
}

export interface ReadinessSignal {
	key: string;
	label: string;
	detail: string;
	flag: "good" | "neutral" | "watch" | "bad";
}

export interface ReadinessResult {
	level: "primed" | "balanced" | "strained" | "rundown" | "insufficient";
	headline: string;
	summary: string;
	acwr: number | null;
	signals: ReadinessSignal[];
}

export interface HRTrendPoint {
	ts: number;
	bpm: number;
}

export interface HRTrendData {
	points: HRTrendPoint[];
	min: number;
	avg: number;
	max: number;
}

export interface BehaviorEffect {
	question_key: string;
	question: string;
	category: string;
	with_mean: number;
	without_mean: number;
	effect_size: number;
	n_with: number;
	n_without: number;
	significant: boolean;
	direction: "positive" | "negative" | "neutral";
	sentence: string;
}

export interface SportBreakdown {
	type: string;
	count: number;
	minutes: number;
	avg_strain: number;
	avg_hr: number;
}

export interface WorkoutsSummary {
	count: number;
	total_minutes: number;
	total_calories: number;
	sport_breakdown: SportBreakdown[];
	hr_zones: Record<number, number>;
}

export interface BaselineInfo {
	mean: number;
	spread: number;
	status: string;
}

export type BaselinesResponse = Record<string, BaselineInfo>;
