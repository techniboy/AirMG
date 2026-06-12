import { sleepStageColor } from "../../lib/colors";
import { formatMinutes } from "../../lib/format";
import type { StageSegment } from "../../lib/types";

interface SleepStagesChartProps {
	stages: StageSegment[] | null;
	totalMinutes: number | null;
	deepMinutes?: number | null;
	remMinutes?: number | null;
	lightMinutes?: number | null;
	wakeMinutes?: number | null;
}

const STAGE_ORDER: Array<StageSegment["stage"]> = [
	"deep",
	"light",
	"rem",
	"wake",
];
const STAGE_LABELS: Record<string, string> = {
	wake: "Awake",
	light: "Light",
	deep: "Deep",
	rem: "REM",
};

function pct(mins: number, total: number): string {
	if (total <= 0) return "0%";
	return `${Math.round((mins / total) * 100)}%`;
}

// Hypnogram geometry (SVG viewBox units)
const ROWS: Array<StageSegment["stage"]> = ["wake", "rem", "light", "deep"];
const ROW_Y: Record<string, number> = { wake: 20, rem: 60, light: 100, deep: 140 };
const PLOT_X = 56;
const PLOT_W = 574;
const BAR_H = 12;

function fmtClock(ts: number): string {
	return new Date(ts * 1000).toLocaleTimeString([], {
		hour: "numeric",
		minute: "2-digit",
	});
}

function Hypnogram({ stages }: { stages: StageSegment[] }) {
	const segs = [...stages].sort((a, b) => a.start - b.start);
	const t0 = segs[0].start;
	const t1 = segs[segs.length - 1].end;
	if (t1 <= t0) return null;
	const x = (ts: number) => PLOT_X + ((ts - t0) / (t1 - t0)) * PLOT_W;
	const mid = (t0 + t1) / 2;

	return (
		<svg
			viewBox="0 0 640 178"
			className="w-full text-text-tertiary"
			role="img"
			aria-label="Sleep stages over the night"
		>
			{ROWS.map((s) => (
				<g key={s}>
					<text x={0} y={ROW_Y[s] + 4} fontSize={12} fill="currentColor">
						{STAGE_LABELS[s]}
					</text>
					<line
						x1={PLOT_X}
						y1={ROW_Y[s]}
						x2={PLOT_X + PLOT_W}
						y2={ROW_Y[s]}
						stroke="currentColor"
						strokeOpacity={0.12}
					/>
				</g>
			))}
			{segs.map((seg, i) => {
				const next = segs[i + 1];
				const x0 = x(seg.start);
				const w = Math.max(x(seg.end) - x0, 3);
				return (
					<g key={`${seg.start}-${seg.stage}`}>
						<rect
							x={x0}
							y={ROW_Y[seg.stage] - BAR_H / 2}
							width={w}
							height={BAR_H}
							rx={BAR_H / 2}
							fill={sleepStageColor(seg.stage)}
						/>
						{next && next.stage !== seg.stage && (
							<rect
								x={x(next.start) - 1.25}
								y={Math.min(ROW_Y[seg.stage], ROW_Y[next.stage])}
								width={2.5}
								height={Math.abs(ROW_Y[next.stage] - ROW_Y[seg.stage])}
								fill={sleepStageColor(next.stage)}
								opacity={0.5}
							/>
						)}
					</g>
				);
			})}
			<line
				x1={PLOT_X}
				y1={158}
				x2={PLOT_X + PLOT_W}
				y2={158}
				stroke="currentColor"
				strokeOpacity={0.3}
			/>
			<text x={PLOT_X} y={174} fontSize={12} fill="currentColor">
				{fmtClock(t0)}
			</text>
			<text x={PLOT_X + PLOT_W / 2} y={174} fontSize={12} fill="currentColor" textAnchor="middle">
				{fmtClock(mid)}
			</text>
			<text x={PLOT_X + PLOT_W} y={174} fontSize={12} fill="currentColor" textAnchor="end">
				{fmtClock(t1)}
			</text>
		</svg>
	);
}

export function SleepStagesChart({
	stages,
	totalMinutes,
	deepMinutes,
	remMinutes,
	lightMinutes,
	wakeMinutes,
}: SleepStagesChartProps) {
	// Compute per-stage totals either from segments or from provided minute values
	let deep = deepMinutes ?? 0;
	let rem = remMinutes ?? 0;
	let light = lightMinutes ?? 0;
	let wake = wakeMinutes ?? 0;

	if (stages && stages.length > 0) {
		deep = 0;
		rem = 0;
		light = 0;
		wake = 0;
		for (const seg of stages) {
			const mins = (seg.end - seg.start) / 60;
			if (seg.stage === "deep") deep += mins;
			else if (seg.stage === "rem") rem += mins;
			else if (seg.stage === "light") light += mins;
			else if (seg.stage === "wake") wake += mins;
		}
	}

	const total = totalMinutes ?? (deep + rem + light + wake || 1);
	const asleep = deep + rem + light;

	const bars: Array<{ stage: string; mins: number; color: string }> = [
		{ stage: "deep", mins: deep, color: sleepStageColor("deep") },
		{ stage: "light", mins: light, color: sleepStageColor("light") },
		{ stage: "rem", mins: rem, color: sleepStageColor("rem") },
		{ stage: "wake", mins: wake, color: sleepStageColor("wake") },
	].filter((b) => b.mins > 0);

	const hasData = total > 1;

	return (
		<div className="space-y-3">
			{/* Hypnogram when segments exist; proportional bar fallback otherwise */}
			{stages && stages.length > 0 ? (
				<Hypnogram stages={stages} />
			) : (
				<div className="flex h-8 overflow-hidden rounded-lg" style={{ gap: 2 }}>
					{hasData ? (
						bars.map(({ stage, mins, color }) => (
							<div
								key={stage}
								style={{
									width: `${(mins / total) * 100}%`,
									backgroundColor: color,
									minWidth: mins > 0 ? 2 : 0,
								}}
								title={`${STAGE_LABELS[stage]}: ${formatMinutes(Math.round(mins))}`}
							/>
						))
					) : (
						<div className="flex-1 rounded-lg bg-surface-inset" />
					)}
				</div>
			)}

			{/* Legend row */}
			<div className="flex flex-wrap gap-x-4 gap-y-1">
				{STAGE_ORDER.filter((s) => {
					const m =
						s === "deep"
							? deep
							: s === "rem"
								? rem
								: s === "light"
									? light
									: wake;
					return m > 0;
				}).map((stage) => {
					const mins =
						stage === "deep"
							? deep
							: stage === "rem"
								? rem
								: stage === "light"
									? light
									: wake;
					return (
						<div key={stage} className="flex items-center gap-1.5">
							<div
								className="h-2.5 w-2.5 rounded-sm"
								style={{ backgroundColor: sleepStageColor(stage) }}
							/>
							<span className="text-xs text-text-secondary">
								{STAGE_LABELS[stage]}
							</span>
							<span className="text-xs font-semibold text-text-primary tabular-nums">
								{formatMinutes(Math.round(mins))}
							</span>
							<span className="text-xs text-text-tertiary">
								{pct(mins, total)}
							</span>
						</div>
					);
				})}
			</div>

			{/* Summary line */}
			{hasData && (
				<div className="flex items-center gap-4 text-xs text-text-tertiary">
					<span>
						Asleep:{" "}
						<span className="text-text-secondary font-medium">
							{formatMinutes(Math.round(asleep))}
						</span>
					</span>
					<span>
						In bed:{" "}
						<span className="text-text-secondary font-medium">
							{formatMinutes(Math.round(total))}
						</span>
					</span>
				</div>
			)}
		</div>
	);
}
