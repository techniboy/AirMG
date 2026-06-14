import { useAtomValue } from "jotai";
import { useState } from "react";
import { themeAtom } from "../../atoms/theme";
import { ZoneStack } from "../../radio/viz/ZoneStack";

const ZONE_COLORS: Record<number, string> = {
	1: "#A3D9F5",
	2: "#7EC8E3",
	3: "#F5A623",
	4: "#E8743B",
	5: "#FF4F73",
};

const ZONE_LABELS: Record<number, string> = {
	1: "Zone 1",
	2: "Zone 2",
	3: "Zone 3",
	4: "Zone 4",
	5: "Zone 5",
};

interface HRZonesBarProps {
	zones: Record<number, number>;
}

export function HRZonesBar({ zones }: HRZonesBarProps) {
	const theme = useAtomValue(themeAtom);
	const [hover, setHover] = useState<number | null>(null);
	const total = Object.values(zones).reduce((s, v) => s + v, 0);

	if (theme === "radio") {
		const z1 = zones[1] ?? 0;
		const z2 = zones[2] ?? 0;
		const z3 = zones[3] ?? 0;
		const z4 = zones[4] ?? 0;
		const z5 = zones[5] ?? 0;
		return <ZoneStack minutes={{ 1: z1, 2: z2, 3: z3, 4: z4, 5: z5 }} />;
	}

	if (total === 0) return null;

	const zoneEntries = [1, 2, 3, 4, 5]
		.map((z) => ({ zone: z, count: zones[z] ?? 0 }))
		.filter((z) => z.count > 0);

	return (
		<div className="space-y-2">
			<div className="flex h-6 rounded-full overflow-hidden bg-surface-inset">
				{zoneEntries.map(({ zone, count }) => {
					const pct = (count / total) * 100;
					return (
						<div
							key={zone}
							className="h-full flex items-center justify-center text-[10px] font-medium transition-opacity"
							style={{
								width: `${pct}%`,
								backgroundColor: ZONE_COLORS[zone],
								color: zone >= 3 ? "#fff" : "#000",
								opacity:
									hover === null || hover === zone ? 1 : 0.4,
							}}
							onMouseEnter={() => setHover(zone)}
							onMouseLeave={() => setHover(null)}
						>
							{pct >= 8 ? `Z${zone}` : ""}
						</div>
					);
				})}
			</div>
			{hover != null && (
				<div className="text-xs text-text-secondary text-center">
					{ZONE_LABELS[hover]}:{" "}
					{Math.round((zones[hover] ?? 0) / 60)} min (
					{Math.round(((zones[hover] ?? 0) / total) * 100)}%)
				</div>
			)}
		</div>
	);
}
