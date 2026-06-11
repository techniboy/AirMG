import { Card } from "@/components/ui/card";
import type { BehaviorEffect } from "../../lib/types";

function effectLabel(d: number): string {
	const abs = Math.abs(d);
	if (abs >= 0.8) return "Large";
	if (abs >= 0.5) return "Medium";
	return "Small";
}

interface BehaviourCardProps {
	effect: BehaviorEffect;
}

export function BehaviourCard({ effect }: BehaviourCardProps) {
	const barMax = Math.max(effect.with_mean, effect.without_mean) * 1.1 || 1;
	const withPct = (effect.with_mean / barMax) * 100;
	const withoutPct = (effect.without_mean / barMax) * 100;
	const barColor =
		effect.direction === "positive"
			? "#18C98B"
			: effect.direction === "negative"
				? "#FF4F73"
				: "#666";

	return (
		<Card className="border-hairline bg-surface-raised p-4 space-y-3">
			<div className="flex items-start justify-between gap-3">
				<div>
					<div className="text-xs uppercase tracking-widest text-text-tertiary">
						{effect.category}
					</div>
					<div className="font-semibold text-text-primary text-sm mt-0.5">
						{effect.question}
					</div>
				</div>
				<div className="flex items-center gap-2 shrink-0">
					<span
						className={`text-xs border border-hairline rounded-md px-1.5 py-0.5 ${effect.significant ? "text-status-positive" : "text-text-tertiary"}`}
					>
						{effect.significant ? "Significant" : "n.s."}
					</span>
					<span className="text-xs border border-hairline rounded-md px-1.5 py-0.5 text-text-tertiary">
						{effectLabel(effect.effect_size)}
					</span>
				</div>
			</div>

			<div className="space-y-1.5">
				<div className="flex items-center gap-2 text-xs">
					<span className="w-14 text-text-tertiary shrink-0">With</span>
					<div className="flex-1 h-4 bg-surface-inset rounded-full overflow-hidden">
						<div
							className="h-full rounded-full"
							style={{
								width: `${withPct}%`,
								backgroundColor: barColor,
							}}
						/>
					</div>
					<span className="w-10 text-right tabular-nums text-text-secondary">
						{effect.with_mean.toFixed(1)}
					</span>
				</div>
				<div className="flex items-center gap-2 text-xs">
					<span className="w-14 text-text-tertiary shrink-0">Without</span>
					<div className="flex-1 h-4 bg-surface-inset rounded-full overflow-hidden">
						<div
							className="h-full rounded-full bg-text-tertiary"
							style={{ width: `${withoutPct}%` }}
						/>
					</div>
					<span className="w-10 text-right tabular-nums text-text-secondary">
						{effect.without_mean.toFixed(1)}
					</span>
				</div>
			</div>

			<p className="text-sm text-text-secondary">{effect.sentence}</p>
			<div className="text-xs text-text-tertiary">
				n = {effect.n_with} with, {effect.n_without} without
			</div>
		</Card>
	);
}
