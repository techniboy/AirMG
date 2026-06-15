import { useRadioPhase } from "../phase";

const REC = ["#FF4F73", "#F5A623", "#E8C24B", "#18C98B", "#2FE6A8"];

/** values: array of cells, each 0..100 recovery (or null for no-data). */
export function Facade({
	values,
	cols = 53,
}: {
	values: (number | null)[];
	cols?: number;
}) {
	const { tokens } = useRadioPhase();
	return (
		<div
			style={{
				display: "grid",
				gridTemplateColumns: `repeat(${cols}, 1fr)`,
				gap: 2,
				padding: 6,
				border: `1px solid ${tokens.cp ? "#5a6a86" : "#241634"}`,
				borderRadius: 2,
			}}
		>
			{values.map((v, i) => {
				if (v === null)
					return (
						<span
							key={i}
							style={{
								aspectRatio: "1",
								borderRadius: 1,
								background: "#1a1228",
								opacity: 0.4,
							}}
						/>
					);
				const c = REC[Math.min(4, Math.floor((v / 100) * 5))];
				return (
					<span
						key={i}
						style={{
							aspectRatio: "1",
							borderRadius: 1,
							background: c,
							opacity: 0.5 + 0.45 * tokens.glow,
							boxShadow:
								tokens.glow > 0.3
									? `0 0 ${(2 + 4 * tokens.glow).toFixed(0)}px ${c}`
									: "none",
						}}
					/>
				);
			})}
		</div>
	);
}
