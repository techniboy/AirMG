import { useRadioPhase } from "../phase";

const ZONE = ["#16d8e8", "#5BD3A0", "#E8C24B", "#E8743B", "#ff2d78"];

export function EQ({
	data,
	height = 100,
	rows = 13,
}: {
	data: number[];
	height?: number;
	rows?: number;
}) {
	const { tokens } = useRadioPhase();
	const max = Math.max(1, ...data);
	return (
		<div
			style={{
				display: "flex",
				alignItems: "flex-end",
				gap: 3,
				height,
				width: "100%",
			}}
		>
			{data.map((v, c) => {
				const lit = Math.round((v / max) * rows);
				return (
					<div
						key={c}
						style={{
							flex: 1,
							display: "flex",
							flexDirection: "column-reverse",
							gap: 2,
							height: "100%",
						}}
					>
						{Array.from({ length: rows }, (_, i) => {
							const on = i < lit;
							const peak = i === lit;
							const z = ZONE[Math.min(4, Math.floor((i / rows) * 5))];
							return (
								<span
									key={i}
									style={{
										height: 6,
										borderRadius: 1,
										background: peak
											? "#fff"
											: on
												? z
												: "#ffffff10",
										boxShadow: peak
											? "0 0 6px #fff"
											: on && tokens.glow > 0.3
												? `0 0 ${(3 + 3 * tokens.glow).toFixed(0)}px ${z}`
												: "none",
										opacity: on ? 0.5 + 0.5 * tokens.glow : 1,
									}}
								/>
							);
						})}
					</div>
				);
			})}
		</div>
	);
}
