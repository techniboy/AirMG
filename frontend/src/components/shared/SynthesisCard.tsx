interface SynthesisCardProps {
	status: string;
	detail: string;
	statusColor: string;
}

export function SynthesisCard({
	status,
	detail,
	statusColor,
}: SynthesisCardProps) {
	return (
		<div className="bg-surface-raised border-hairline rounded-xl p-6 flex flex-col justify-center">
			<div className="text-[11px] uppercase tracking-widest text-text-tertiary mb-2">
				Recovery
			</div>
			<div className="text-xl font-bold mb-2" style={{ color: statusColor }}>
				{status}
			</div>
			<p className="text-[13px] text-text-secondary leading-relaxed">
				{detail}
			</p>
		</div>
	);
}
