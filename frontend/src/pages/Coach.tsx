import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useApi } from "../hooks/useApi";
import type { Recommendation } from "../lib/types";

interface CoachResponse {
	recommendations: Recommendation[];
}

function priorityColor(priority: number): string {
	if (priority <= 1) return "text-status-critical";
	if (priority <= 2) return "text-status-warning";
	return "text-accent";
}

function priorityBadgeClass(priority: number): string {
	if (priority <= 1) return "border-status-critical text-status-critical";
	if (priority <= 2) return "border-status-warning text-status-warning";
	return "border-accent text-accent";
}

function priorityLabel(priority: number): string {
	if (priority <= 1) return "High";
	if (priority <= 2) return "Medium";
	return "Low";
}

function categoryIcon(category: string): string {
	const map: Record<string, string> = {
		recovery: "♥",
		sleep: "◐",
		strain: "⚡",
		hrv: "〜",
		nutrition: "◉",
		training: "▶",
	};
	const key = category.toLowerCase();
	for (const [k, v] of Object.entries(map)) {
		if (key.includes(k)) return v;
	}
	return "◇";
}

export default function Coach() {
	const { data, loading, error } = useApi<CoachResponse>("/api/coach");
	const recs = data?.recommendations ?? [];

	// Sort by priority ascending (1 = highest)
	const sorted = [...recs].sort((a, b) => a.priority - b.priority);

	return (
		<div className="mx-auto max-w-4xl space-y-6">
			<div className="flex items-start justify-between">
				<div>
					<h1 className="text-2xl font-bold">Coach</h1>
					<p className="mt-1 text-sm text-text-secondary">
						Rule-based recommendations grounded in your own data.
					</p>
				</div>
				{recs.length > 0 && (
					<span className="text-sm text-text-tertiary">
						{recs.length} recommendations
					</span>
				)}
			</div>

			{loading && <div className="text-text-secondary">Loading…</div>}
			{error && <div className="text-sm text-status-critical">{error}</div>}

			{!loading && recs.length === 0 && (
				<Card className="border-hairline bg-surface-raised p-8 text-center text-text-tertiary">
					No recommendations right now. Sync more data and check back.
				</Card>
			)}

			<div className="space-y-3">
				{sorted.map((rec, i) => (
					<Card key={i} className="border-hairline bg-surface-raised p-5">
						<div className="flex items-start gap-4">
							{/* Icon */}
							<div
								className={`mt-0.5 text-xl shrink-0 ${priorityColor(rec.priority)}`}
							>
								{categoryIcon(rec.category)}
							</div>

							{/* Content */}
							<div className="min-w-0 flex-1 space-y-2">
								<div className="flex flex-wrap items-center gap-2">
									<span className="text-xs uppercase tracking-widest text-text-tertiary">
										{rec.category}
									</span>
									<Badge
										variant="outline"
										className={`text-xs ${priorityBadgeClass(rec.priority)}`}
									>
										{priorityLabel(rec.priority)} priority
									</Badge>
								</div>
								<p className="text-sm text-text-primary leading-relaxed">
									{rec.message}
								</p>
							</div>
						</div>
					</Card>
				))}
			</div>

			<p className="text-xs text-text-tertiary">
				These are deterministic rule-based recommendations, not AI-generated
				advice. Always consult a healthcare professional for medical decisions.
			</p>
		</div>
	);
}
