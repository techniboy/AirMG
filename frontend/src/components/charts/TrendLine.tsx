import { useAtomValue } from "jotai";
import {
	CartesianGrid,
	Line,
	LineChart,
	ReferenceLine,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { themeAtom } from "../../atoms/theme";

interface TrendPoint {
	day: string;
	value: number | null;
}

interface TrendLineProps {
	data: TrendPoint[];
	color?: string;
	unit?: string;
	domain?: [number | "auto", number | "auto"];
	referenceValue?: number;
}

function shortDay(day: string): string {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return day;
	const d = new Date(`${day}T00:00:00`);
	return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function TrendLine({
	data,
	color = "#18C98B",
	unit = "",
	domain,
	referenceValue,
}: TrendLineProps) {
	const theme = useAtomValue(themeAtom);
	const isGlass = theme === "liquid-glass";
	const gridColor = isGlass ? "rgba(0,0,0,0.08)" : "#1B2620";
	const tickColor = isGlass ? "rgba(60,60,67,0.45)" : "#6F7A74";
	const refColor = isGlass ? "rgba(0,0,0,0.12)" : "#27362E";
	const tooltipBg = isGlass ? "rgba(255,255,255,0.85)" : "#0D1512";
	const tooltipBorder = isGlass ? "rgba(0,0,0,0.1)" : "#1B2620";
	const tooltipText = isGlass ? "#1d1d1f" : "#F4F7F5";
	const dotStroke = isGlass ? "#fff" : "#060A08";

	const filtered = data.filter((d) => d.value !== null);

	if (filtered.length < 2) {
		return (
			<div className="flex h-40 items-center justify-center rounded-xl bg-surface-inset">
				<span className="text-sm text-text-tertiary">
					Not enough data for this window.
				</span>
			</div>
		);
	}

	// Tick every ~7 points to keep axis readable
	const tickInterval = Math.max(1, Math.floor(data.length / 6));

	return (
		<ResponsiveContainer width="100%" height={160}>
			<LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
				<CartesianGrid
					strokeDasharray="3 3"
					stroke={gridColor}
					vertical={false}
				/>
				<XAxis
					dataKey="day"
					tickFormatter={shortDay}
					interval={tickInterval}
					tick={{ fill: tickColor, fontSize: 11 }}
					axisLine={false}
					tickLine={false}
				/>
				<YAxis
					domain={domain ?? ["auto", "auto"]}
					tick={{ fill: tickColor, fontSize: 11 }}
					axisLine={false}
					tickLine={false}
					width={36}
					tickFormatter={(v: number) => (unit ? `${v}${unit}` : `${v}`)}
				/>
				{referenceValue !== undefined && (
					<ReferenceLine
						y={referenceValue}
						stroke={refColor}
						strokeDasharray="4 4"
					/>
				)}
				<Tooltip
					contentStyle={{
						backgroundColor: tooltipBg,
						border: `1px solid ${tooltipBorder}`,
						borderRadius: 8,
						color: tooltipText,
						fontSize: 12,
						...(isGlass ? { backdropFilter: "blur(20px)" } : {}),
					}}
					labelFormatter={(val: any) => shortDay(String(val))}
					formatter={(val: any) => [
						`${val !== null && val !== undefined ? Number(val).toFixed(1) : "--"}${unit ? " " + unit : ""}`,
						"",
					]}
				/>
				<Line
					type="monotone"
					dataKey="value"
					stroke={color}
					strokeWidth={2}
					dot={false}
					activeDot={{ r: 4, fill: color, stroke: dotStroke, strokeWidth: 2 }}
					connectNulls={false}
				/>
			</LineChart>
		</ResponsiveContainer>
	);
}
