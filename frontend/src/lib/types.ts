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

export interface SleepSession {
	id: number;
	start_ts: number;
	end_ts: number;
	efficiency: number | null;
	stages: StageSegment[] | null;
	resting_hr: number | null;
	avg_hrv: number | null;
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
