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
	// day is yyyy-MM-dd → return "Jun 1"
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
					stroke="#1B2620"
					vertical={false}
				/>
				<XAxis
					dataKey="day"
					tickFormatter={shortDay}
					interval={tickInterval}
					tick={{ fill: "#6F7A74", fontSize: 11 }}
					axisLine={false}
					tickLine={false}
				/>
				<YAxis
					domain={domain ?? ["auto", "auto"]}
					tick={{ fill: "#6F7A74", fontSize: 11 }}
					axisLine={false}
					tickLine={false}
					width={36}
					tickFormatter={(v: number) => (unit ? `${v}${unit}` : `${v}`)}
				/>
				{referenceValue !== undefined && (
					<ReferenceLine
						y={referenceValue}
						stroke="#27362E"
						strokeDasharray="4 4"
					/>
				)}
				<Tooltip
					contentStyle={{
						backgroundColor: "#0D1512",
						border: "1px solid #1B2620",
						borderRadius: 8,
						color: "#F4F7F5",
						fontSize: 12,
					}}
					labelFormatter={shortDay}
					formatter={(val: number) => [
						`${val !== null && val !== undefined ? val.toFixed(1) : "--"}${unit ? " " + unit : ""}`,
						"",
					]}
				/>
				<Line
					type="monotone"
					dataKey="value"
					stroke={color}
					strokeWidth={2}
					dot={false}
					activeDot={{ r: 4, fill: color, stroke: "#060A08", strokeWidth: 2 }}
					connectNulls={false}
				/>
			</LineChart>
		</ResponsiveContainer>
	);
}
