import { useAtomValue, useSetAtom } from "jotai";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { insightsAtom, behaviourEffectsAtom, behaviourOutcomeAtom } from "../atoms/api";
import { BehaviourCard } from "../components/shared/BehaviourCard";

function strengthWord(r: number): string {
	const abs = Math.abs(r);
	if (abs < 0.1) return "no";
	if (abs < 0.3) return "a weak";
	if (abs < 0.5) return "a moderate";
	if (abs < 0.7) return "a strong";
	return "a very strong";
}

function correlationHex(r: number): string {
	const t = (r + 1) / 2;
	if (t < 0.25) return "#FF4F73";
	if (t < 0.45) return "#F5A623";
	if (t < 0.55) return "#E8C24B";
	if (t < 0.75) return "#18C98B";
	return "#2FE6A8";
}

function formatMetricLabel(key: string): string {
	const map: Record<string, string> = {
		recovery: "Recovery",
		strain: "Strain",
		hrv_rmssd: "HRV",
		resting_hr: "Resting HR",
		sleep_performance: "Sleep Performance",
		sleep_minutes: "Sleep Duration",
		resp_rate: "Resp Rate",
		deep_minutes: "Deep Sleep",
		rem_minutes: "REM Sleep",
	};
	return map[key] ?? key.replace(/_/g, " ");
}

function directionWord(r: number): string {
	if (r > 0.05) return "positive";
	if (r < -0.05) return "negative";
	return "flat";
}

export default function Insights() {
	const { data, isPending, error } = useAtomValue(insightsAtom);
	const correlations = data?.correlations ?? [];
	const sorted = [...correlations].sort(
		(a, b) => Math.abs(b.r) - Math.abs(a.r),
	);

	const selectedOutcome = useAtomValue(behaviourOutcomeAtom);
	const setOutcome = useSetAtom(behaviourOutcomeAtom);
	const { data: beData, isPending: bePending } = useAtomValue(behaviourEffectsAtom);
	const effects = beData?.effects ?? [];

	return (
		<div className="mx-auto max-w-4xl space-y-6">
			<h1 className="text-2xl font-bold">Insights</h1>
			<p className="text-sm text-text-secondary">
				Metric correlations across your history. Positive r means the two
				metrics tend to move together; negative means they move oppositely.
			</p>

			{isPending && <div className="text-text-secondary">Loading…</div>}
			{error && <div className="text-sm text-status-critical">{String(error)}</div>}

			{/* Behaviour Effects */}
			<div className="space-y-3">
				<div className="text-[11px] uppercase tracking-widest text-text-tertiary">
					Behaviour Effects
				</div>
				<div className="flex gap-2">
					{(["recovery", "hrv", "sleep_performance", "resting_hr"] as const).map((o) => (
						<button
							key={o}
							onClick={() => setOutcome(o)}
							className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
								selectedOutcome === o
									? "bg-accent-muted text-accent"
									: "text-text-secondary hover:bg-surface-overlay hover:text-text-primary"
							}`}
						>
							{o === "recovery" ? "Recovery" : o === "hrv" ? "HRV" : o === "sleep_performance" ? "Sleep" : "RHR"}
						</button>
					))}
				</div>
				{bePending && <div className="text-text-secondary text-sm">Loading…</div>}
				{effects.length === 0 && !bePending && (
					<Card className="border-hairline bg-surface-raised p-6 text-center text-text-tertiary text-sm">
						Log more journal entries to see behaviour effects. At least 5 days with and without each behaviour needed.
					</Card>
				)}
				{effects.map((e) => (
					<BehaviourCard key={e.question_key} effect={e} />
				))}
			</div>

			{/* Metric Relationships */}
			{!isPending && correlations.length === 0 && (
				<Card className="border-hairline bg-surface-raised p-8 text-center text-text-tertiary">
					Not enough overlapping history to compute correlations yet. Sync more
					data and check back.
				</Card>
			)}

			<div className="text-[11px] uppercase tracking-widest text-text-tertiary">
				Metric Relationships
			</div>

			<div className="space-y-3">
				{sorted.map((c, i) => {
					const color = correlationHex(c.r);
					const isSignificant = c.p < 0.05;
					const title = `${formatMetricLabel(c.x)} ↔ ${formatMetricLabel(c.y)}${c.lag !== 0 ? ` (${c.lag > 0 ? "+" : ""}${c.lag}d lag)` : ""}`;
					const sentence = `${strengthWord(c.r).charAt(0).toUpperCase() + strengthWord(c.r).slice(1)} ${directionWord(c.r)} relationship (r = ${c.r.toFixed(2)}, n = ${c.n}).`;

					return (
						<Card
							key={i}
							className="border-hairline bg-surface-raised p-5 space-y-3"
						>
							<div className="flex items-start justify-between gap-3">
								<div className="font-semibold text-text-primary leading-snug">
									{title}
								</div>
								<div className="flex items-center gap-2 shrink-0">
									<span
										className="text-xl font-bold tabular-nums"
										style={{ color }}
									>
										{c.r >= 0 ? "+" : ""}
										{c.r.toFixed(2)}
									</span>
									<Badge
										variant="outline"
										className={`text-xs border-hairline ${isSignificant ? "text-status-positive" : "text-text-tertiary"}`}
									>
										{isSignificant ? "p < 0.05" : "n.s."}
									</Badge>
								</div>
							</div>
							<div className="relative h-2 overflow-hidden rounded-full bg-surface-inset">
								<div className="absolute inset-y-0 left-1/2 w-px bg-hairline-strong" />
								<div
									className="absolute inset-y-0 rounded-full"
									style={{
										width: `${Math.abs(c.r) * 50}%`,
										left: c.r >= 0 ? "50%" : `${50 - Math.abs(c.r) * 50}%`,
										backgroundColor: color,
									}}
								/>
							</div>
							<p className="text-sm text-text-secondary">{sentence}</p>
							<div className="flex gap-4 text-xs text-text-tertiary">
								<span>n = {c.n}</span>
								<span>p = {c.p.toFixed(3)}</span>
								{c.lag !== 0 && <span>lag {c.lag}d</span>}
							</div>
						</Card>
					);
				})}
			</div>
		</div>
	);
}
