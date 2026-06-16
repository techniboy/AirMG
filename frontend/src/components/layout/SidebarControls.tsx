import { Check, Palette, RefreshCw, Zap } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { THEMES, useThemeSync } from "../../lib/useThemeSync";

const THEME_LABEL: Record<string, string> = {
	radio: "Radio City",
	dark: "Dark",
	"liquid-glass": "Glass",
	orbital: "Orbital",
};

/** Sync + theme controls for the dark / liquid-glass sidebar (tailwind-skinned). */
export function SidebarControls() {
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
		<div ref={ref} className="relative mt-auto space-y-2 border-t border-hairline pt-3">
			{toast && (
				<div className="absolute bottom-full left-0 right-0 mb-2 min-w-[180px] rounded-lg border border-accent bg-surface-overlay px-3 py-2 text-[11px] text-text-primary shadow-xl">
					{toast}
				</div>
			)}

			<button
				type="button"
				onClick={sync}
				disabled={syncing}
				className="flex w-full items-center justify-center gap-2 rounded-lg border border-hairline bg-surface-raised px-2 py-2 text-sm text-text-secondary transition-colors hover:text-text-primary disabled:opacity-60 sm:justify-start sm:px-3"
			>
				<RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
				<span className="hidden sm:inline">{syncing ? "Syncing…" : "Sync"}</span>
				<span className="ml-auto hidden text-[10px] text-text-tertiary sm:inline">{lastSyncedAgo}</span>
			</button>

			<button
				type="button"
				onClick={() => setOpen((o) => !o)}
				className="flex w-full items-center justify-center gap-2 rounded-lg border border-hairline bg-surface-raised px-2 py-2 text-sm text-text-secondary transition-colors hover:text-text-primary sm:justify-start sm:px-3"
			>
				<Palette size={14} />
				<span className="hidden sm:inline">Theme</span>
				<span className="ml-auto hidden text-[11px] text-text-tertiary sm:inline">{THEME_LABEL[theme]}</span>
			</button>

			{open && (
				<div className="absolute bottom-12 left-0 right-0 z-50 min-w-[180px] space-y-0.5 rounded-lg border border-hairline bg-surface-overlay p-1.5 shadow-xl">
					{THEMES.map((t) => (
						<button
							key={t.v}
							type="button"
							onClick={() => {
								setTheme(t.v);
								setOpen(false);
							}}
							className={`flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-[12px] transition-colors ${
								theme === t.v
									? "text-accent"
									: "text-text-secondary hover:bg-surface-raised hover:text-text-primary"
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
	);
}
