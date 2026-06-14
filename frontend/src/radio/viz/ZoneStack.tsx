import { useRadioPhase } from "../phase";
const ZC: Record<number, string> = { 1: "#A3D9F5", 2: "#7EC8E3", 3: "#F5A623", 4: "#E8743B", 5: "#FF4F73" };

export function ZoneStack({ minutes, height = 124, width = 52 }: { minutes: Record<1 | 2 | 3 | 4 | 5, number>; height?: number; width?: number }) {
	const { tokens } = useRadioPhase();
	const tot = Math.max(1, (Object.values(minutes) as number[]).reduce((a, b) => a + b, 0));
	return (
		<div style={{ display: "flex", flexDirection: "column-reverse", gap: 3, width, height, justifyContent: "flex-end" }}>
			{[1, 2, 3, 4, 5].map((z) => {
				const h = (minutes[z as 1] / tot) * height;
				const c = ZC[z];
				return (
					<div key={z} style={{ height: h, borderRadius: 2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 700, background: c, color: z >= 3 ? "#fff" : "#0009", boxShadow: tokens.cp ? "inset 0 1px 0 #ffffff66,0 1px 2px #0003" : `0 0 8px ${c}88,inset 0 0 10px #ffffff22`, opacity: tokens.cp ? 1 : 0.92 }}>
						{h > 13 ? `Z${z}` : ""}
					</div>
				);
			})}
		</div>
	);
}
