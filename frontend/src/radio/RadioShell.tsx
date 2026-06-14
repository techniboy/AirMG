import { Outlet } from "react-router";
import type { CSSProperties } from "react";
import "./radio.css";
import { useRadioPhase } from "./phase";
import { RadioBackdrop } from "./RadioBackdrop";
import { RadioSidebar } from "./RadioSidebar";
import { RadioBillboard } from "./RadioBillboard";

export function RadioShell() {
	const { tokens } = useRadioPhase();
	const style: CSSProperties = {
		["--g1" as string]: tokens.g1,
		["--g2" as string]: tokens.g2,
		["--g3" as string]: tokens.g3,
		["--bloomA" as string]: tokens.bloomA,
		["--bloomB" as string]: tokens.bloomB,
		["--acc" as string]: tokens.acc,
		["--glow" as string]: String(tokens.glow),
	};
	return (
		<div className="radio">
			<div className={`radio-app${tokens.cp ? " cp" : ""}`} style={style}>
				<RadioBackdrop />
				<div className="radio-rain">{/* rain disabled v1 (no weather source) */}</div>
				<RadioSidebar />
				<main className="radio-main">
					<RadioBillboard />
					<Outlet />
				</main>
				<div className="radio-scan" />
				<div className="radio-grain" />
				<div className="radio-vig" />
			</div>
		</div>
	);
}
