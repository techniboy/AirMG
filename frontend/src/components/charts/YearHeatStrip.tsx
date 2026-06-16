import { useAtomValue } from "jotai";
import { useState } from "react";
import { themeAtom } from "../../atoms/theme";
import { Facade } from "../../radio/viz/Facade";
import { ChartScroll } from "./ChartScroll";

interface HeatDay {
	day: string;
	value: number | null;
}

interface YearHeatStripProps {
	data: HeatDay[];
	colorScale?: (value: number) => string;
}

function defaultRecoveryColor(v: number): string {
	if (v < 33) return "#FF4F73";
	if (v < 50) return "#F5A623";
	if (v < 67) return "#E8C24B";
	if (v < 85) return "#18C98B";
	return "#2FE6A8";
}

const DAY_NAMES = ["Mon", "", "Wed", "", "Fri", "", "Sun"];
const CELL = 12;
const GAP = 2;
const STEP = CELL + GAP;
const LEFT_PAD = 28;
const TOP_PAD = 16;

export function YearHeatStrip({
	data,
	colorScale = defaultRecoveryColor,
}: YearHeatStripProps) {
	const theme = useAtomValue(themeAtom);
	const [tooltip, setTooltip] = useState<{
		x: number;
		y: number;
		text: string;
	} | null>(null);

	const dayMap = new Map(data.map((d) => [d.day, d.value]));

	const today = new Date();
	const cells: {
		day: string;
		col: number;
		row: number;
		value: number | null;
	}[] = [];
	const monthLabels: { col: number; label: string }[] = [];
	let lastMonth = -1;

	for (let i = 364; i >= 0; i--) {
		const d = new Date(today);
		d.setDate(d.getDate() - i);
		const dayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
		const dayOfWeek = (d.getDay() + 6) % 7;
		const col = Math.floor(
			(364 - i + ((today.getDay() + 6) % 7)) / 7,
		);
		const row = dayOfWeek;

		cells.push({
			day: dayStr,
			col,
			row,
			value: dayMap.get(dayStr) ?? null,
		});

		if (d.getMonth() !== lastMonth) {
			monthLabels.push({
				col,
				label: d.toLocaleDateString("en-US", { month: "short" }),
			});
			lastMonth = d.getMonth();
		}
	}

	const maxCol = Math.max(...cells.map((c) => c.col));

	if (theme === "radio") {
		// Flatten the week×day grid into row-major order (7 rows of days-of-week,
		// (maxCol+1) week columns). Cells outside the year window stay null (no-data).
		const cols = maxCol + 1;
		const flatValues: (number | null)[] = new Array(7 * cols).fill(null);
		for (const c of cells) {
			flatValues[c.row * cols + c.col] = c.value;
		}
		return <Facade values={flatValues} cols={cols} />;
	}

	const width = LEFT_PAD + (maxCol + 1) * STEP;
	const height = TOP_PAD + 7 * STEP;

	return (
		<ChartScroll minWidth={width}>
		<div className="relative">
			<svg
				viewBox={`0 0 ${width} ${height}`}
				className="w-full"
				style={{ maxHeight: 140 }}
			>
				{monthLabels.map((m, i) => (
					<text
						key={i}
						x={LEFT_PAD + m.col * STEP}
						y={10}
						fontSize={9}
						fill="#666"
					>
						{m.label}
					</text>
				))}
				{DAY_NAMES.map((name, i) =>
					name ? (
						<text
							key={i}
							x={0}
							y={TOP_PAD + i * STEP + CELL - 2}
							fontSize={9}
							fill="#666"
						>
							{name}
						</text>
					) : null,
				)}
				{cells.map((c) => (
					<rect
						key={c.day}
						x={LEFT_PAD + c.col * STEP}
						y={TOP_PAD + c.row * STEP}
						width={CELL}
						height={CELL}
						rx={2}
						fill={c.value != null ? colorScale(c.value) : "#1a1a1a"}
						fillOpacity={c.value != null ? 1 : 0.3}
						onMouseEnter={() => {
							const label =
								c.value != null
									? `${c.day} — ${Math.round(c.value)}%`
									: c.day;
							setTooltip({
								x: LEFT_PAD + c.col * STEP + CELL / 2,
								y: TOP_PAD + c.row * STEP - 4,
								text: label,
							});
						}}
						onMouseLeave={() => setTooltip(null)}
						className="cursor-default"
					/>
				))}
				{tooltip && (
					<text
						x={tooltip.x}
						y={tooltip.y}
						textAnchor="middle"
						fontSize={10}
						fill="#ccc"
					>
						{tooltip.text}
					</text>
				)}
			</svg>
		</div>
		</ChartScroll>
	);
}
