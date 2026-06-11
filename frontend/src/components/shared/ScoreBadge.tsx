import { recoveryBg, recoveryColor } from "../../lib/colors";

interface ScoreBadgeProps {
	score: number | null;
	label: string;
	size?: "sm" | "lg";
}

export function ScoreBadge({ score, label, size = "lg" }: ScoreBadgeProps) {
	const textSize = size === "lg" ? "text-5xl" : "text-2xl";
	return (
		<div
			className={`flex flex-col items-center rounded-xl p-6 ${recoveryBg(score)}`}
		>
			<div className={`font-bold ${textSize} ${recoveryColor(score)}`}>
				{score !== null ? Math.round(score) : "--"}
			</div>
			<div className="mt-1 text-sm text-text-secondary">{label}</div>
		</div>
	);
}
