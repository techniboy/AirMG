import type { ReadinessResult } from "../../lib/types";
import { Card } from "@/components/ui/card";

const LEVEL_COLORS: Record<string, string> = {
	primed: "#18C98B",
	balanced: "#18C98B",
	strained: "#F5A623",
	rundown: "#FF4F73",
	insufficient: "#666",
};

const FLAG_COLORS: Record<string, string> = {
	good: "#18C98B",
	neutral: "#666",
	watch: "#F5A623",
	bad: "#FF4F73",
};

interface ReadinessCardProps {
	result: ReadinessResult;
}

export function ReadinessCard({ result }: ReadinessCardProps) {
	if (result.level === "insufficient") return null;

	const levelColor = LEVEL_COLORS[result.level] ?? "#666";

	return (
		<Card className="border-hairline bg-surface-raised p-4 space-y-3">
			<div className="text-[11px] uppercase tracking-widest text-text-tertiary">
				Should you push today?
			</div>
			<div className="flex items-center justify-between gap-3">
				<div className="flex items-center gap-2">
					<span
						className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
						style={{ backgroundColor: levelColor }}
					/>
					<span className="font-semibold text-text-primary">
						{result.headline}
					</span>
				</div>
				{result.acwr != null && (
					<span className="text-xs text-text-tertiary tabular-nums">
						load {result.acwr.toFixed(2)}
					</span>
				)}
			</div>
			<p className="text-sm text-text-secondary">{result.summary}</p>
			{result.signals.length > 0 && (
				<>
					<div className="border-t border-hairline" />
					<div className="space-y-1.5">
						{result.signals.map((s) => (
							<div
								key={s.key}
								className="flex items-start gap-2 text-xs"
							>
								<span
									className="inline-block w-[7px] h-[7px] rounded-full mt-1 shrink-0"
									style={{
										backgroundColor: FLAG_COLORS[s.flag] ?? "#666",
									}}
								/>
								<span className="text-text-secondary w-[90px] shrink-0">
									{s.label}
								</span>
								<span className="text-text-tertiary">{s.detail}</span>
							</div>
						))}
					</div>
				</>
			)}
		</Card>
	);
}
