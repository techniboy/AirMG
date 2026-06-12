import { useAtomValue } from "jotai";
import { NavLink } from "react-router";
import { Card } from "@/components/ui/card";
import { healthAgeAtom } from "../atoms/api";

function deltaColor(d: number | null): string {
	if (d == null) return "text-text-tertiary";
	if (d < 0) return "text-status-positive";
	if (d > 0.5) return "text-status-critical";
	return "text-text-secondary";
}

function deltaLabel(d: number | null): string {
	if (d == null) return "no data";
	if (d === 0) return "±0 yr";
	return `${d > 0 ? "+" : ""}${d.toFixed(1)} yr`;
}

export default function HealthAge() {
	const { data, isPending, error } = useAtomValue(healthAgeAtom);

	if (isPending) return <div className="text-text-secondary">Loading…</div>;
	if (error)
		return <div className="text-sm text-status-critical">{String(error)}</div>;

	if (data?.status !== "ok") {
		return (
			<div className="mx-auto max-w-2xl space-y-4">
				<h1 className="text-2xl font-bold">Health Age</h1>
				<Card className="border-hairline bg-surface-raised p-6 text-sm text-text-secondary">
					{data?.message ?? "Not enough data yet."}{" "}
					{data?.status === "needs_profile" && (
						<NavLink to="/settings" className="text-accent underline">
							Open Settings
						</NavLink>
					)}
				</Card>
			</div>
		);
	}

	const younger = (data.delta_years ?? 0) < 0;

	return (
		<div className="mx-auto max-w-2xl space-y-6">
			<h1 className="text-2xl font-bold">Health Age</h1>

			<Card className="border-hairline bg-surface-raised p-6">
				<div className="flex items-end gap-6">
					<div>
						<div className="text-5xl font-bold text-text-primary tabular-nums">
							{data.health_age}
						</div>
						<div className="text-xs uppercase tracking-widest text-text-tertiary mt-1">
							Health Age
						</div>
					</div>
					<div className="pb-1">
						<div
							className={`text-lg font-semibold tabular-nums ${younger ? "text-status-positive" : "text-status-critical"}`}
						>
							{deltaLabel(data.delta_years ?? 0)}
						</div>
						<div className="text-xs text-text-tertiary">
							vs chronological age {data.chronological_age}
						</div>
					</div>
				</div>
				<p className="mt-4 text-xs text-text-tertiary leading-relaxed">
					Modeled on WHOOP Age: guideline-optimal habits keep your health age
					at or below your real age; each deviation maps to years gained or
					lost. Based on your last {data.window_days} days.
				</p>
			</Card>

			<Card className="border-hairline bg-surface-raised p-5 space-y-3">
				<div className="text-xs uppercase tracking-widest text-text-tertiary">
					Contributing Habits
				</div>
				{data.metrics?.map((m) => (
					<div
						key={m.key}
						className="flex items-center justify-between border-b border-hairline/50 pb-2 last:border-0 last:pb-0"
					>
						<div>
							<div className="text-sm text-text-primary">{m.label}</div>
							<div className="text-xs text-text-tertiary">
								{m.value != null
									? `${m.value.toLocaleString()}${m.unit ? ` ${m.unit}` : ""}`
									: "no data"}{" "}
								· target {m.target}
							</div>
						</div>
						<div
							className={`text-sm font-semibold tabular-nums ${deltaColor(m.delta_years)}`}
						>
							{deltaLabel(m.delta_years)}
						</div>
					</div>
				))}
			</Card>
		</div>
	);
}
