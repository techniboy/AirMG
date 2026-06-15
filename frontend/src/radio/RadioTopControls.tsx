import { useQueryClient } from "@tanstack/react-query";
import { useAtom } from "jotai";
import { Check, Palette, RefreshCw, Zap } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import { type Theme, themeAtom } from "../atoms/theme";

const THEMES: { v: Theme; l: string; warn?: string }[] = [
	{ v: "radio", l: "Radio City" },
	{ v: "dark", l: "Dark" },
	{ v: "liquid-glass", l: "Liquid Glass" },
	{ v: "orbital", l: "Orbital", warn: "GPU intensive" },
];

/** Icon-only sync + theme controls for the Radio top bar. */
export function RadioTopControls() {
	const qc = useQueryClient();
	const [theme, setTheme] = useAtom(themeAtom);
	const [syncing, setSyncing] = useState(false);
	const [open, setOpen] = useState(false);
	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!open) return;
		const onDown = (e: MouseEvent) => {
			if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
		};
		const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
		document.addEventListener("mousedown", onDown);
		document.addEventListener("keydown", onKey);
		return () => {
			document.removeEventListener("mousedown", onDown);
			document.removeEventListener("keydown", onKey);
		};
	}, [open]);

	async function sync() {
		setSyncing(true);
		try {
			await api("/sync/start", { method: "POST" });
			qc.invalidateQueries();
		} catch {
			/* surfaced by the failed queries themselves */
		} finally {
			setSyncing(false);
		}
	}

	return (
		<div className="radio-topctl" ref={ref}>
			<button
				type="button"
				className="radio-iconbtn"
				onClick={sync}
				disabled={syncing}
				title={syncing ? "Syncing…" : "Sync data"}
				aria-label="Sync data"
			>
				<RefreshCw size={15} className={syncing ? "spin" : ""} />
			</button>

			<div style={{ position: "relative" }}>
				<button
					type="button"
					className="radio-iconbtn"
					onClick={() => setOpen((o) => !o)}
					title="Theme"
					aria-label="Theme"
				>
					<Palette size={15} />
				</button>
				{open && (
					<div className="radio-menu" role="menu">
						{THEMES.map((t) => (
							<button
								key={t.v}
								type="button"
								role="menuitemradio"
								aria-checked={theme === t.v}
								className={`radio-menu-item${theme === t.v ? " on" : ""}`}
								onClick={() => {
									setTheme(t.v);
									setOpen(false);
								}}
							>
								<span className="lbl">
									{t.l}
									{t.warn && (
										<span className="warn">
											<Zap size={9} /> {t.warn}
										</span>
									)}
								</span>
								{theme === t.v && <Check size={13} />}
							</button>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
