import { Activity, BookText, BedDouble, HeartPulse, Home, LineChart, Settings, Sparkles, TrendingUp, Trophy, Zap } from "lucide-react";
import type { ComponentType } from "react";

export interface RadioNavItem {
	path: string;
	en: string;       // sidebar english label
	kanji: string;    // sidebar signboard glyphs (verified meaning)
	icon: ComponentType<{ className?: string }>;
	title: string;    // billboard headline
	kana: string;     // billboard kana mount
}

export const RADIO_NAV: RadioNavItem[] = [
	{ path: "/", en: "Today", kanji: "今日", icon: Home, title: "TODAY", kana: "今日" },
	{ path: "/sleep", en: "Sleep", kanji: "睡眠", icon: BedDouble, title: "SLEEP", kana: "睡眠" },
	{ path: "/recovery", en: "Recovery", kanji: "回復", icon: HeartPulse, title: "RECOVERY", kana: "回復" },
	{ path: "/strain", en: "Strain", kanji: "負荷", icon: Zap, title: "STRAIN", kana: "負荷" },
	{ path: "/workouts", en: "Workouts", kanji: "運動", icon: Activity, title: "WORKOUTS", kana: "運動" },
	{ path: "/trends", en: "Trends", kanji: "傾向", icon: TrendingUp, title: "TRENDS", kana: "傾向" },
	{ path: "/insights", en: "Insights", kanji: "洞察", icon: Sparkles, title: "INSIGHTS", kana: "洞察" },
	{ path: "/health-age", en: "Health Age", kanji: "年齢", icon: LineChart, title: "HEALTH AGE", kana: "年齢" },
	{ path: "/coach", en: "Coach", kanji: "指導", icon: Trophy, title: "COACH", kana: "指導" },
	{ path: "/journal", en: "Journal", kanji: "日記", icon: BookText, title: "JOURNAL", kana: "日記" },
	{ path: "/settings", en: "Settings", kanji: "設定", icon: Settings, title: "SETTINGS", kana: "設定" },
];

export const RADIO_LOGO = "空"; // air
