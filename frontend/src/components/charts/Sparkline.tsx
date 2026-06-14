import { useAtomValue } from "jotai";
import { themeAtom } from "../../atoms/theme";
import { Spire } from "../../radio/viz/Skyline";

interface SparklineProps {
	values: (number | null)[];
	color: string;
	width?: number;
	height?: number;
}

export function Sparkline({
	values,
	color,
	width = 80,
	height = 24,
}: SparklineProps) {
	const theme = useAtomValue(themeAtom);
	const valid = values.filter((v): v is number => v !== null);

	if (theme === "radio") {
		return <Spire data={valid} />;
	}

	if (valid.length < 2) return null;

	const min = Math.min(...valid);
	const max = Math.max(...valid);
	const range = max - min || 1;
	const pad = 2;

	const points: { x: number; y: number }[] = [];
	for (let i = 0; i < values.length; i++) {
		const v = values[i];
		if (v === null) continue;
		const x = (i / (values.length - 1)) * width;
		const y = pad + ((max - v) / range) * (height - pad * 2);
		points.push({ x, y });
	}

	if (points.length < 2) return null;

	const lineD = points
		.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`)
		.join(" ");
	const areaD = `${lineD} L${points[points.length - 1].x},${height} L${points[0].x},${height} Z`;

	return (
		<svg
			viewBox={`0 0 ${width} ${height}`}
			width={width}
			height={height}
			className="shrink-0"
		>
			<path d={areaD} fill={color} fillOpacity={0.15} />
			<path
				d={lineD}
				fill="none"
				stroke={color}
				strokeWidth={1.5}
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}
