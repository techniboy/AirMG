import { Check, Palette, RefreshCw, Zap } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { THEMES, useThemeSync } from "../../lib/useThemeSync";

const BTN =
	"grid h-9 w-9 place-items-center rounded-lg border border-white/15 bg-black/40 text-white/70 transition-colors hover:border-cyan-400/60 hover:text-white disabled:opacity-60";

/** Sync + theme controls for the orbital HUD (fixed top-right). */
export function OrbitalControls() {
	const { theme, setTheme, syncing, toast, sync, lastSyncedAgo } = useThemeSync();
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

	return (
		<div ref={ref} className="fixed bottom-4 right-4 z-50 flex items-center gap-2">
			{toast && (
				<div className="absolute bottom-11 right-0 whitespace-nowrap rounded-md border border-cyan-400/40 bg-[#0b1020]/95 px-3 py-2 text-[11px] text-white shadow-xl">
					{toast}
				</div>
			)}
			<span className="text-[10px] uppercase tracking-wide text-white/40">{lastSyncedAgo}</span>
			<button
				type="button"
				className={BTN}
				onClick={sync}
				disabled={syncing}
				title={syncing ? "Syncing…" : `Sync data · last ${lastSyncedAgo}`}
				aria-label="Sync data"
			>
				<RefreshCw size={15} className={syncing ? "animate-spin" : ""} />
			</button>
			<div className="relative">
				<button
					type="button"
					className={BTN}
					onClick={() => setOpen((o) => !o)}
					title="Theme"
					aria-label="Theme"
				>
					<Palette size={15} />
				</button>
				{open && (
					<div className="absolute bottom-11 right-0 z-50 w-44 rounded-lg border border-white/15 bg-[#0b1020]/95 p-1.5 shadow-xl">
						{THEMES.map((t) => (
							<button
								key={t.v}
								type="button"
								onClick={() => {
									setTheme(t.v);
									setOpen(false);
								}}
								className={`flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-[12px] transition-colors ${
									theme === t.v ? "text-cyan-300" : "text-white/70 hover:bg-white/5 hover:text-white"
								}`}
							>
								<span className="flex flex-col">
									{t.l}
									{t.warn && (
										<span className="mt-0.5 flex items-center gap-1 text-[8px] uppercase tracking-wide text-amber-400">
											<Zap size={8} /> {t.warn}
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
