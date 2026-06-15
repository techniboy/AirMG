import { Outlet } from "react-router";
import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import "./radio.css";
import { useRadioPhase } from "./phase";
import { RadioBackdrop } from "./RadioBackdrop";
import { RadioSidebar } from "./RadioSidebar";
import { RadioBillboard } from "./RadioBillboard";
import { RadioTooltip } from "./RadioTooltip";

export function RadioShell() {
	const { tokens } = useRadioPhase();
	// Pause ambient animation while the tab is hidden so the GPU compositor idles.
	const [hidden, setHidden] = useState(() =>
		typeof document !== "undefined" ? document.hidden : false,
	);
	useEffect(() => {
		const onVis = () => setHidden(document.hidden);
		document.addEventListener("visibilitychange", onVis);
		return () => document.removeEventListener("visibilitychange", onVis);
	}, []);
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
			<div
				className={`radio-app${tokens.cp ? " cp" : ""}${hidden ? " paused" : ""}`}
				style={style}
			>
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
			<RadioTooltip />
		</div>
	);
}
